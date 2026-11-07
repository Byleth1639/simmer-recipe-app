import crypto from 'node:crypto';
import {AppError,positiveInt,reserveUsage} from './config.mjs';
export function photoPrompt(recipe){return 'Professional editorial food photograph of '+recipe.name+'. '+recipe.description+' Main ingredients: '+recipe.ingredients.slice(0,14).map(i=>i.name).join(', ')+'. A single finished dish, appetizing natural light, close food composition, realistic textures, ceramic plate or bowl, no people, no text, no logos.';}
export async function generateStableDiffusion(recipe,env=process.env,fetchImpl=fetch){
 const url=new URL(env.SD_SERVICE_URL);if(!['https:','http:'].includes(url.protocol))throw new AppError(503,'Image service URL is invalid.');
 const r=await fetchImpl(url.toString().replace(/\/$/,'')+'/generate',{method:'POST',headers:{Authorization:'Bearer '+env.SD_SERVICE_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(Math.max(30000,positiveInt(env.SD_REQUEST_TIMEOUT_MS,600000,1800000))),body:JSON.stringify({prompt:photoPrompt(recipe).slice(0,1600),seed:crypto.randomInt(0,2147483647),steps:25})});
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
    if((recipe.image||'')!==job.previousImage)throw new AppError(409,'The recipe photo changed before this job started. The newer photo was kept.');
    if(recipe.image&&!job.replace){await ImageJob.updateOne({id:job.id},{$set:{status:'completed',image:recipe.image,finishedAt:new Date()}});return;}
    const image=await generate(recipe,env);const uploaded=await cloud.uploadBuffer(image,'generated/'+recipe.id+'/'+job.id);
    const updated=await Recipe.updateOne({id:recipe.id,image:recipe.image||{$in:[null,'']}},{$set:{image:uploaded.url,imagePublicId:uploaded.publicId,imageProvider:'cloudinary',imageGenerated:true,imageCredit:'AI-generated illustration',imageSource:'',imageLicense:'',imageLicenseUrl:''}});
    if(!updated.matchedCount)throw new AppError(409,'The recipe photo changed while this image was being generated. The newer photo was kept.');
    await ImageJob.updateOne({id:job.id},{$set:{status:'completed',image:uploaded.url,finishedAt:new Date()}});
   }catch(e){console.error('Image job failed:',e.message);await ImageJob.updateOne({id:job.id},{$set:{status:'failed',error:e instanceof AppError?e.message:'Image generation failed. Check the image-service configuration and logs.',finishedAt:new Date()}});}
  }finally{running=false;}
 }
 return {drain,async start(){
  // A restart cannot safely resume a provider call; queued jobs survive, in-flight jobs become retryable failures.
  await ImageJob.updateMany({status:'running'},{$set:{status:'failed',error:'Server restarted during generation. Please submit the job again.',finishedAt:new Date()}});
  timer=setInterval(()=>void drain().catch(e=>console.error('Image worker:',e.message)),1500);timer.unref();void drain();
 },stop(){stopped=true;clearInterval(timer);}};
}
export async function enqueueImageJob(models,recipe,replace,env){
 const active=await models.ImageJob.findOne({recipeId:recipe.id,status:{$in:['queued','running']}}).lean();if(active)return active;
 if(recipe.image&&!replace)throw new AppError(409,'This recipe already has a photo. Select “Replace existing photo” to generate another.');
 const queued=await models.ImageJob.countDocuments({status:{$in:['queued','running']}});if(queued>=5)throw new AppError(429,'The photo queue is full. Try again after a job finishes.');
 await reserveUsage(models.Usage,'image',positiveInt(env.IMAGE_DAILY_LIMIT,5));
 return models.ImageJob.create({id:crypto.randomUUID(),recipeId:recipe.id,replace,previousImage:recipe.image||'',status:'queued'});
}
