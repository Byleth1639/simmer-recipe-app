import crypto from 'node:crypto';
import {AppError,positiveInt,reserveUsage} from './config.mjs';
import {photoPrompt,recipeVisualKey,recipeImageSeed} from '../../../shared/recipe-visuals.mjs';
export {photoPrompt};
export async function generateStableDiffusion(recipe,env=process.env,fetchImpl=fetch){
 const url=new URL(env.SD_SERVICE_URL);if(!['https:','http:'].includes(url.protocol))throw new AppError(503,'Image service URL is invalid.');
 const r=await fetchImpl(url.toString().replace(/\/$/,'')+'/generate',{method:'POST',headers:{Authorization:'Bearer '+env.SD_SERVICE_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(Math.max(30000,positiveInt(env.SD_REQUEST_TIMEOUT_MS,600000,1800000))),body:JSON.stringify({prompt:photoPrompt(recipe).slice(0,1600),seed:recipeImageSeed(recipe),steps:25})});
 if(!r.ok)throw new AppError(502,'The image model could not complete this photo. Check the image-service logs and retry after it finishes warming up.');
 const mime=(r.headers.get('content-type')||'').split(';')[0];if(mime!=='image/png')throw new AppError(502,'Image service returned an unexpected response.');
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>10*1024*1024||bytes.length<8||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new AppError(502,'Image service returned an invalid image.');
 return bytes;
}
export function createImageWorker({Recipe,ImageJob},env,cloud,generate=generateStableDiffusion){
 let running=false,stopped=false,timer;
 async function drain(){
  if(running||stopped)return;running=true;
  try{
   const job=await ImageJob.findOneAndUpdate({status:'queued'},{$set:{status:'running',startedAt:new Date()}},{sort:{createdAt:1},new:true}).lean();
   if(!job)return;
   try{
    const recipe=await Recipe.findOne({id:job.recipeId}).lean();if(!recipe)throw new AppError(404,'Recipe no longer exists.');
    if(job.recipeHash&&job.recipeHash!==recipeVisualKey(recipe))throw new AppError(409,'This recipe changed after the photo was queued. Generate a photo for the updated recipe.');
    if((recipe.image||'')!==job.previousImage)throw new AppError(409,'The recipe photo changed before this job started. The newer photo was kept.');
    if(recipe.image&&!job.replace){await ImageJob.updateOne({id:job.id},{$set:{status:'completed',image:recipe.image,finishedAt:new Date()},$unset:{activeKey:1}});return;}
    const image=await generate(recipe,env);const uploaded=await cloud.uploadBuffer(image,'generated/'+recipe.id+'/'+job.id);
    const updated=await Recipe.updateOne({id:recipe.id,image:recipe.image||{$in:[null,'']},name:recipe.name,ingredients:recipe.ingredients,steps:recipe.steps,description:recipe.description},{$set:{image:uploaded.url,imagePublicId:uploaded.publicId,imageProvider:'cloudinary',imageGenerated:true,imageRecipeHash:recipeVisualKey(recipe),imageSeed:recipeImageSeed(recipe),imageModel:env.SD_MODEL_ID||'stable-diffusion-v1-5/stable-diffusion-v1-5',imageCredit:'AI-generated illustration',imageSource:'',imageLicense:'',imageLicenseUrl:''}});
    if(!updated.matchedCount)throw new AppError(409,'The recipe photo changed while this image was being generated. The newer photo was kept.');
    await ImageJob.updateOne({id:job.id},{$set:{status:'completed',image:uploaded.url,finishedAt:new Date()},$unset:{activeKey:1}});
   }catch(e){console.error('Image job failed:',e.message);await ImageJob.updateOne({id:job.id},{$set:{status:'failed',error:e instanceof AppError?e.message:'Image generation failed. Check the image-service configuration and logs.',finishedAt:new Date()},$unset:{activeKey:1}});}
  }finally{running=false;}
 }
 return {drain,async start(){
  // A restart cannot safely resume a provider call; queued jobs survive, in-flight jobs become retryable failures.
  await ImageJob.updateMany({status:'running'},{$set:{status:'failed',error:'Server restarted during generation. Please submit the job again.',finishedAt:new Date()},$unset:{activeKey:1}});
  timer=setInterval(()=>void drain().catch(e=>console.error('Image worker:',e.message)),1500);timer.unref();void drain();
 },stop(){stopped=true;clearInterval(timer);}};
}
export async function enqueueImageJob(models,recipe,replace,env,batchId){
 const active=await models.ImageJob.findOne({recipeId:recipe.id,status:{$in:['queued','running']}}).lean();if(active)return active;
 if(recipe.image&&!replace)throw new AppError(409,'This recipe already has a photo. Select “Replace existing photo” to generate another.');
 const queued=await models.ImageJob.countDocuments({status:{$in:['queued','running']}});if(queued>=positiveInt(env.IMAGE_QUEUE_LIMIT,120,250))throw new AppError(429,'The photo queue is full. Try again after a job finishes.');
 await reserveUsage(models.Usage,'image',positiveInt(env.IMAGE_DAILY_LIMIT,5));
 try{return await models.ImageJob.create({id:crypto.randomUUID(),recipeId:recipe.id,activeKey:recipe.id,replace,previousImage:recipe.image||'',recipeHash:recipeVisualKey(recipe),batchId,status:'queued'});}
 catch(error){if(error.code===11000){const existing=await models.ImageJob.findOne({recipeId:recipe.id,status:{$in:['queued','running']}}).lean();if(existing)return existing;}throw error;}
}
export async function enqueuePhotoCollection(models,env){
 const batchId=crypto.randomUUID(),recipes=await models.Recipe.find().sort({id:1}).lean();let skipped=0,queued=0,existing=0,deferred=0,reason='';
 for(let index=0;index<recipes.length;index++){
  const recipe=recipes[index];
  // Existing, genuinely generated photos remain valid when imported from the earlier Colab notebook.
  if(recipe.imageGenerated&&recipe.image&&(!recipe.imageRecipeHash||recipe.imageRecipeHash===recipeVisualKey(recipe))){skipped++;continue;}
  try{const job=await enqueueImageJob(models,recipe,true,env,batchId);if(job.batchId===batchId)queued++;else existing++;}
  catch(error){if(error instanceof AppError&&(error.status===429||error.status===503)){reason=error.message;deferred=recipes.slice(index).filter(r=>!r.imageGenerated||!r.image||(r.imageRecipeHash&&r.imageRecipeHash!==recipeVisualKey(r))).length;break;}throw error;}
 }
 return {id:batchId,total:recipes.length,queued,skipped,existing,deferred,reason};
}
