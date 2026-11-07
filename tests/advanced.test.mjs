import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {recipes} from '../shared/recipes.mjs';
import {recipePhotoUpdates} from '../shared/recipe-photo-updates.mjs';
import {createApp} from '../mern/server/app.mjs';
import {models} from '../mern/server/models.mjs';
import {requestEnhancement} from '../mern/server/services/enhance.mjs';
import {generateStableDiffusion} from '../mern/server/services/image-jobs.mjs';
const require=createRequire(new URL('../mern/server/package.json',import.meta.url));
const mongoose=require('mongoose'),request=require('supertest'),{MongoMemoryServer}=require('mongodb-memory-server');
let mongo;
const ORIGIN='http://localhost:5173',TOKEN='test-admin-token-'+('x'.repeat(40));
const env={APP_ORIGIN:ORIGIN,NODE_ENV:'test',ADMIN_TOKEN:TOKEN,OPENAI_API_KEY:'unit-test-not-a-real-api-key',OPENAI_MODEL:'gpt-4.1-mini',AI_DAILY_LIMIT:'20',IMAGE_DAILY_LIMIT:'5',SD_SERVICE_URL:'https://images.example.test',SD_SERVICE_TOKEN:'test-service-token-'+('x'.repeat(40)),CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test'};
const ideas={summary:'A quicker variation.',variations:[{title:'More greens',description:'Fold in spinach.',changes:['Add 80 g spinach in the last minute.']}],tips:['Reserve pasta water.'],warnings:['Check labels for allergens.']};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ0AAAAASUVORK5CYII=','base64');
function fixture(overrides={}){
 const calls={ai:0,images:0,uploads:0};
 const app=createApp({models,env:{...env,...overrides},enhanceProvider:async()=>{calls.ai++;await new Promise(r=>setTimeout(r,15));return structuredClone(ideas);},imageProvider:async()=>{calls.images++;return png;},cloudProvider:{ready:true,uploadBuffer:async(bytes,id)=>{assert.deepEqual(bytes,png);calls.uploads++;return {url:'https://res.cloudinary.com/test/image/upload/'+id+'.png',publicId:id};}}});
 return {app,calls};
}
const post=(agent,url,body)=>agent.post(url).set('Origin',ORIGIN).send(body);
before(async()=>{mongo=await MongoMemoryServer.create({instance:{args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});await mongoose.connect(mongo.getUri());await Promise.all(Object.values(models).map(m=>m.init()));await models.Recipe.insertMany(recipes);},{timeout:180000});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});
beforeEach(async()=>{await Promise.all([models.Favorite.deleteMany({}),models.Shopping.deleteMany({}),models.Enhancement.deleteMany({}),models.ImageJob.deleteMany({}),models.Usage.deleteMany({})]);await models.Recipe.bulkWrite(recipes.map(r=>({updateOne:{filter:{id:r.id},update:{$set:{...r,imageGenerated:false,imageProvider:'',imageCredit:r.imageCredit||''},$unset:{imageRecipeHash:1,imageSeed:1,imageModel:1,imagePublicId:1}}}})));});
test('MERN API preserves visitor isolation, origin checks and shopping amounts',async()=>{
 const {app}=fixture(),a=request.agent(app),b=request.agent(app);let r=await a.get('/api/kitchen');assert.equal(r.body.recipes.length,105);
 r=await a.post('/api/kitchen').send({action:'favorite',recipeId:'pesto-pasta',saved:true});assert.equal(r.status,403);
 assert.equal((await post(a,'/api/kitchen',{action:'favorite',recipeId:'pesto-pasta',saved:true})).status,200);
 assert.deepEqual((await a.get('/api/kitchen')).body.favorites,['pesto-pasta']);assert.deepEqual((await b.get('/api/kitchen')).body.favorites,[]);
 await post(a,'/api/kitchen',{action:'add-shopping',recipeId:'pesto-pasta',servings:4});assert.equal((await a.get('/api/kitchen')).body.shopping.find(x=>x.name==='pasta').amount,400);
});
test('AI variations are cached and concurrent requests share one provider call',async()=>{
 const {app,calls}=fixture(),body={goal:'Balanced',diet:'No preference',servings:2};
 const responses=await Promise.all([post(request(app),'/api/recipes/pesto-pasta/enhance',body),post(request(app),'/api/recipes/pesto-pasta/enhance',body)]);
 assert.ok(responses.every(r=>r.status===200));assert.equal(calls.ai,1);assert.equal((await post(request(app),'/api/recipes/pesto-pasta/enhance',body)).body.cached,true);assert.equal((await models.Usage.findOne({_id:/^ai:/})).count,1);
});
test('AI input validation and persistent daily limits are enforced',async()=>{
 const {app,calls}=fixture({AI_DAILY_LIMIT:'1'}),agent=request(app);
 assert.equal((await post(agent,'/api/recipes/pesto-pasta/enhance',{goal:'arbitrary',diet:'Vegan',servings:2})).status,400);assert.equal(calls.ai,0);
 assert.equal((await post(agent,'/api/recipes/pesto-pasta/enhance',{goal:'Balanced',diet:'Vegan',servings:2})).status,200);
 assert.equal((await post(agent,'/api/recipes/pesto-pasta/enhance',{goal:'Quicker',diet:'Vegan',servings:2})).status,429);assert.equal(calls.ai,1);
});
test('photo generation needs owner authentication and explicit replacement',async()=>{
 await models.Recipe.updateOne({id:'pesto-pasta'},{$set:{image:'https://example.test/current-photo.jpg'}});
 const {app,calls}=fixture();assert.equal((await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:true})).status,401);
 assert.equal((await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:false}).set('Authorization','Bearer '+TOKEN)).status,409);assert.equal(calls.images,0);
});
test('queued photo jobs upload bytes to cloud storage and persist only metadata',async()=>{
 const {app,calls}=fixture();let r=await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:true}).set('Authorization','Bearer '+TOKEN);assert.equal(r.status,202);const id=r.body.id;
 assert.equal((await request(app).get('/api/media/jobs/'+id)).status,401);await app.locals.imageWorker.drain();
 r=await request(app).get('/api/media/jobs/'+id).set('Authorization','Bearer '+TOKEN);assert.equal(r.body.status,'completed');assert.equal(calls.images,1);assert.equal(calls.uploads,1);
 const recipe=await models.Recipe.findOne({id:'pesto-pasta'}).lean();assert.equal(recipe.imageGenerated,true);assert.equal(recipe.imageProvider,'cloudinary');assert.match(recipe.image,/^https:\/\/res.cloudinary.com\//);assert.deepEqual(recipe.ingredients,recipes[0].ingredients);
 await models.Recipe.bulkWrite(recipePhotoUpdates(recipes));assert.equal((await models.Recipe.findOne({id:'pesto-pasta'})).image,recipe.image);
});
test('a newer photo is preserved instead of being overwritten by an older job',async()=>{
 const {app,calls}=fixture();const r=await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:true}).set('Authorization','Bearer '+TOKEN);
 await models.Recipe.updateOne({id:'pesto-pasta'},{$set:{image:'https://example.test/newer.jpg'}});await app.locals.imageWorker.drain();
 assert.equal((await models.ImageJob.findOne({id:r.body.id})).status,'failed');assert.equal(calls.images,0);assert.equal((await models.Recipe.findOne({id:'pesto-pasta'})).image,'https://example.test/newer.jpg');
});
test('missing-photo recipes can be generated without replacing an existing photo',async()=>{
 const {app}=fixture();await models.Recipe.updateOne({id:'pesto-pasta'},{$set:{image:''}});
 const r=await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta'}).set('Authorization','Bearer '+TOKEN);assert.equal(r.status,202);await app.locals.imageWorker.drain();assert.equal((await models.ImageJob.findOne({id:r.body.id})).status,'completed');
});
test('unconfigured features return disabled status without leaking credentials',async()=>{
 const {app}=fixture({OPENAI_API_KEY:'',SD_SERVICE_URL:''});const r=await request(app).get('/api/features');assert.equal(r.body.enhancements,false);assert.equal(r.body.imageGeneration,false);assert.ok(!JSON.stringify(r.body).includes(TOKEN));
});
test('Responses API adapter sends a strict schema and parses output_text',async()=>{
 let body;const result=await requestEnhancement(recipes[0],{goal:'Balanced',diet:'Vegan',servings:2},env,async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(opts.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(ideas)}]}]})};});
 assert.deepEqual(result,ideas);assert.equal(body.text.format.strict,true);assert.equal(body.store,false);assert.equal(body.model,'gpt-4.1-mini');
});
test('Stable Diffusion adapter authenticates and rejects non-image output',async()=>{
 let requestOptions;const bytes=await generateStableDiffusion(recipes[0],env,async(url,opts)=>{requestOptions=opts;assert.equal(url,'https://images.example.test/generate');return {ok:true,headers:new Headers({'content-type':'image/png'}),arrayBuffer:async()=>png};});
 assert.deepEqual(bytes,png);assert.equal(requestOptions.headers.Authorization,'Bearer '+env.SD_SERVICE_TOKEN);
 await assert.rejects(()=>generateStableDiffusion(recipes[0],env,async()=>({ok:true,headers:new Headers({'content-type':'text/html'})})),/unexpected response/);
});

test('generation catalog supplies distinct recipe-based requests without credentials',async()=>{
 const {app}=fixture(),response=await request(app).get('/api/media/catalog');
 assert.equal(response.status,200);assert.equal(response.body.recipes.length,105);
 assert.equal(new Set(response.body.recipes.map(r=>r.generation.seed)).size,105);
 for(const recipe of response.body.recipes){assert.ok(recipe.generation.prompt.includes(recipe.name));assert.match(recipe.generation.recipeHash,/^[a-f0-9]{8}$/);}
 assert.ok(!JSON.stringify(response.body).includes(TOKEN));
});
test('collection generation requires owner access and queues only recipes without AI photos',async()=>{
 const {app,calls}=fixture({IMAGE_DAILY_LIMIT:'150'});
 assert.equal((await post(request(app),'/api/media/batches',{scope:'ungenerated'})).status,401);
 await models.Recipe.updateOne({id:'avocado-toast'},{$set:{imageGenerated:true,image:'https://example.test/reviewed-ai.png'}});
 const response=await post(request(app),'/api/media/batches',{scope:'ungenerated'}).set('Authorization','Bearer '+TOKEN);
 assert.equal(response.status,202);assert.equal(response.body.queued,104);assert.equal(response.body.skipped,1);
 await app.locals.imageWorker.drain();assert.equal(calls.images,1);
 const status=await request(app).get('/api/media/batches/'+response.body.id).set('Authorization','Bearer '+TOKEN);
 assert.equal(status.body.total,104);assert.equal(status.body.completed,1);assert.equal(status.body.queued,103);
 assert.equal((await models.Recipe.findOne({id:'avocado-toast'})).image,'https://example.test/reviewed-ai.png');
 await models.Recipe.bulkWrite(recipes.map(r=>({updateOne:{filter:{id:r.id},update:{$set:{image:r.image,imageGenerated:false},$unset:{imageRecipeHash:1}}}})));
});
test('batch daily limits are reported as deferred recipes instead of pretending completion',async()=>{
 const {app}=fixture({IMAGE_DAILY_LIMIT:'3'});
 const response=await post(request(app),'/api/media/batches',{scope:'ungenerated'}).set('Authorization','Bearer '+TOKEN);
 assert.equal(response.status,202);assert.equal(response.body.queued,3);assert.equal(response.body.deferred,102);assert.match(response.body.reason,/daily generation limit/);
});
test('concurrent submissions share one active image job',async()=>{
 const {app}=fixture();
 const responses=await Promise.all([1,2].map(()=>post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:true}).set('Authorization','Bearer '+TOKEN)));
 assert.ok(responses.every(r=>r.status===202));assert.equal(responses[0].body.id,responses[1].body.id);assert.equal(await models.ImageJob.countDocuments({recipeId:'pesto-pasta'}),1);
});
test('editing recipe ingredients after queueing rejects the stale photo job',async()=>{
 const {app,calls}=fixture();
 const response=await post(request(app),'/api/media/jobs',{recipeId:'pesto-pasta',replace:true}).set('Authorization','Bearer '+TOKEN);
 await models.Recipe.updateOne({id:'pesto-pasta'},{$push:{ingredients:{name:'spinach',amount:80,unit:'g'}}});await app.locals.imageWorker.drain();
 const job=await models.ImageJob.findOne({id:response.body.id});assert.equal(job.status,'failed');assert.match(job.error,/recipe changed/);assert.equal(calls.images,0);assert.equal(job.activeKey,undefined);
});
