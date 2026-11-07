import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {recipes} from '../shared/recipes.mjs';
import {retiredStockPhotos} from '../shared/retired-stock-photos.mjs';
import {recipePhotoUpdates} from '../shared/recipe-photo-updates.mjs';
import {photoPrompt,recipeVisualKey} from '../shared/recipe-visuals.mjs';
import {models} from '../mern/server/models.mjs';
import {createApp} from '../mern/server/app.mjs';
const require=createRequire(new URL('../mern/server/package.json',import.meta.url));
const mongoose=require('mongoose'),request=require('supertest'),{MongoMemoryServer}=require('mongodb-memory-server');
const origin='https://simmer.example.test',id='blueberry-lemon-pancakes';
const env={NODE_ENV:'test',APP_ORIGIN:origin,SD_SERVICE_URL:'https://images.example.test',SD_SERVICE_TOKEN:'s'.repeat(40),CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test',IMAGE_DAILY_LIMIT:'10'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ0AAAAASUVORK5CYII=','base64');
let mongo;
before(async()=>{mongo=await MongoMemoryServer.create({instance:{args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});await mongoose.connect(mongo.getUri());await Promise.all(Object.values(models).map(m=>m.init()));await models.Recipe.insertMany(recipes);},{timeout:180000});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});
beforeEach(async()=>{await Promise.all([models.ImageJob.deleteMany({}),models.Usage.deleteMany({})]);await models.Recipe.bulkWrite(recipes.map(r=>({updateOne:{filter:{id:r.id},update:{$set:{...r,imageGenerated:false,imageProvider:'',imageSource:r.imageSource||''},$unset:{imageRecipeHash:1}}}})));});
function fixture(overrides={},fail=false){
 const calls={images:0,uploads:0,names:[]};
 const app=createApp({models,env:{...env,...overrides},imageProvider:async recipe=>{calls.images++;calls.names.push(recipe.name);if(fail)throw Error('private-provider-detail');return png;},cloudProvider:{ready:true,uploadBuffer:async(bytes,path)=>{assert.deepEqual(bytes,png);calls.uploads++;return {url:'https://res.cloudinary.com/test/image/upload/'+path+'.png',publicId:path};}}});
 return {app,calls};
}
const post=(app,recipeId=id,body={})=>request(app).post('/api/recipes/'+recipeId+'/photo').set('Origin',origin).send(body);

test('opening blueberry lemon pancakes generates, uploads and then reuses its own image',async()=>{
 const {app,calls}=fixture();
 const initial=await request(app).get('/api/recipes/'+id+'/photo');assert.equal(initial.body.status,'missing');assert.equal(initial.body.image,'');
 const queued=await post(app);assert.equal(queued.status,202);assert.equal(queued.body.status,'queued');
 await app.locals.imageWorker.drain();
 const ready=await request(app).get('/api/recipes/'+id+'/photo');assert.equal(ready.body.status,'ready');assert.equal(ready.body.generated,true);assert.match(ready.body.image,/blueberry-lemon-pancakes/);
 const recipe=await models.Recipe.findOne({id}).lean();assert.equal(recipe.imageGenerated,true);assert.equal(recipe.imageRecipeHash,recipeVisualKey(recipe));assert.ok(photoPrompt(recipe).includes('Blueberry lemon pancakes'));
 assert.equal(calls.names[0],'Blueberry lemon pancakes');assert.equal(calls.images,1);assert.equal(calls.uploads,1);
 assert.equal((await post(app)).status,200);assert.equal(calls.images,1);assert.equal(await models.ImageJob.countDocuments({recipeId:id}),1);assert.equal((await models.Usage.findOne({_id:/^image:/})).count,1);
 assert.equal((await request(app).get('/api/kitchen')).body.recipes.find(r=>r.id===id).image,ready.body.image);
});
test('concurrent visitors share one generation and one daily-usage reservation',async()=>{
 const {app}=fixture();const results=await Promise.all([1,2,3].map(()=>post(app)));
 assert.ok(results.every(r=>r.status===202));assert.equal(await models.ImageJob.countDocuments({recipeId:id}),1);assert.equal((await models.Usage.findOne({_id:/^image:/})).count,1);
});
test('public photo requests cannot supply arbitrary prompts, overwrite photos or bypass the origin check',async()=>{
 const {app,calls}=fixture();assert.equal((await request(app).post('/api/recipes/'+id+'/photo').send({})).status,403);
 assert.equal((await post(app,id,{prompt:'Something unrelated',replace:true})).status,400);
 assert.equal((await post(app,'not-a-recipe')).status,404);assert.equal(await models.ImageJob.countDocuments({}),0);assert.equal(calls.images,0);
});
test('existing AI photos still load when the image generator is offline',async()=>{
 const recipe=recipes.find(r=>r.id===id);await models.Recipe.updateOne({id},{$set:{image:'https://example.test/saved-ai.png',imageGenerated:true,imageRecipeHash:recipeVisualKey(recipe)}});
 const {app,calls}=fixture({SD_SERVICE_URL:''});const ready=await post(app);assert.equal(ready.status,200);assert.equal(ready.body.status,'ready');assert.equal(ready.body.image,'https://example.test/saved-ai.png');assert.equal(calls.images,0);assert.equal(await models.Usage.countDocuments({}),0);
});
test('an unconfigured or explicitly disabled generator reports offline without queueing work',async()=>{
 for(const settings of [{SD_SERVICE_URL:''},{AUTO_RECIPE_PHOTOS:'0'}]){
  const {app}=fixture(settings);const status=await request(app).get('/api/recipes/'+id+'/photo');assert.equal(status.body.status,'offline');assert.equal((await post(app)).status,503);
 }
 assert.equal(await models.ImageJob.countDocuments({}),0);
});
test('failed generation is reported safely, preserves the current image and has a retry cooldown',async()=>{
 const {app,calls}=fixture({},true);await post(app);await app.locals.imageWorker.drain();
 const response=await request(app).get('/api/recipes/'+id+'/photo');assert.equal(response.body.status,'failed');assert.ok(response.body.retryAfter>0);assert.ok(!JSON.stringify(response.body).includes('private-provider-detail'));assert.equal((await post(app)).status,429);assert.equal(calls.images,1);
 const recipe=await models.Recipe.findOne({id});assert.equal(recipe.image,'');assert.equal(recipe.imageGenerated,false);
});
test('daily-limit failures become retryable after their daily reset',async()=>{
 const {app}=fixture({IMAGE_DAILY_LIMIT:'1'});assert.equal((await post(app)).status,202);
 const second='banana-oat-pancakes';assert.equal((await post(app,second)).status,429);
 assert.equal((await request(app).get('/api/recipes/'+second+'/photo')).body.status,'limited');
 await models.ImageJob.updateOne({recipeId:second},{$set:{finishedAt:new Date(Date.now()-86400000)}});await models.Usage.deleteMany({});
 assert.equal((await post(app,second)).status,202);
});
test('stock-photo retirement clears old local/cloud stock references while preserving AI and custom photos',async()=>{
 const old=retiredStockPhotos.find(r=>r.id===id);
 await models.Recipe.updateOne({id},{$set:{image:'https://example.test/migrated-stock.jpg',imageSource:old.source,imageGenerated:false}});
 await models.Recipe.updateOne({id:'pesto-pasta'},{$set:{image:'/food/pasta.jpg',imageGenerated:false}});
 await models.Recipe.updateOne({id:'avocado-toast'},{$set:{image:'https://example.test/ai.png',imageGenerated:true}});
 await models.Recipe.updateOne({id:'shakshuka'},{$set:{image:'https://example.test/my-upload.jpg',imageGenerated:false}});
 const {app}=fixture();assert.equal((await request(app).get('/api/kitchen')).body.recipes.find(r=>r.id===id).image,'');
 await models.Recipe.bulkWrite(recipePhotoUpdates(recipes));
 assert.equal((await models.Recipe.findOne({id})).image,'');assert.equal((await models.Recipe.findOne({id:'pesto-pasta'})).image,'');
 assert.equal((await models.Recipe.findOne({id:'avocado-toast'})).image,'https://example.test/ai.png');assert.equal((await models.Recipe.findOne({id:'shakshuka'})).image,'https://example.test/my-upload.jpg');
});
test('recipe edits invalidate an old generated photo and request a fresh image',async()=>{
 const {app,calls}=fixture();await post(app);await app.locals.imageWorker.drain();const first=(await models.Recipe.findOne({id})).image;
 await models.Recipe.updateOne({id},{$push:{ingredients:{name:'raspberries',amount:30,unit:'g'}}});assert.equal((await post(app)).status,202);await app.locals.imageWorker.drain();
 assert.equal(calls.images,2);assert.notEqual((await models.Recipe.findOne({id})).image,first);
});
test('a disconnected generator reports offline even when an old job is queued',async()=>{
 const {app}=fixture();assert.equal((await post(app)).status,202);
 const offline=fixture({SD_SERVICE_URL:''});const status=await request(offline.app).get('/api/recipes/'+id+'/photo');assert.equal(status.body.status,'offline');
});
