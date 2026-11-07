import {featureStatus,positiveInt} from './config.mjs';
import {recipeVisualKey} from '../../../shared/recipe-visuals.mjs';
import {withoutStockPhoto,isRetiredStockPhoto} from '../../../shared/recipe-photo-updates.mjs';
import {activeImageStatuses,enqueueImageJob,visibleJobStatus} from './image-jobs.mjs';

export async function recipePhotoStatus(models,recipe,env,now=new Date()){
 const clean=withoutStockPhoto(recipe),key=recipeVisualKey(recipe);
 const base={recipeId:recipe.id,image:clean.image||'',generated:Boolean(clean.imageGenerated),canGenerate:false};
 if(clean.image&&(!clean.imageGenerated||!clean.imageRecipeHash||clean.imageRecipeHash===key))return {...base,status:'ready'};
 const features=featureStatus(env);
 if(!features.automaticImages&&!features.imageGeneration)return {...base,status:'offline',message:'Automatic recipe photos need a connected cloud image generator.'};
 const job=await models.ImageJob.findOne({recipeId:recipe.id,$or:[{recipeHash:key},{recipeHash:{$exists:false}}]}).sort({createdAt:-1,_id:-1}).lean();
 if(job&&activeImageStatuses.includes(job.status))return {...base,status:visibleJobStatus(job),message:'Creating a photo for this recipe…'};
 if(!features.automaticImages)return {...base,status:'offline',message:'Automatic recipe photos need a connected cloud image generator.'};
 if(job?.status==='failed'&&job.finishedAt){
  const failedAt=new Date(job.finishedAt);
  const wait=job.failureKind==='daily_limit'?Date.UTC(failedAt.getUTCFullYear(),failedAt.getUTCMonth(),failedAt.getUTCDate()+1)-now.getTime():positiveInt(env.IMAGE_RETRY_COOLDOWN_MS,120000,3600000)-(now.getTime()-new Date(job.finishedAt).getTime());
  if(wait>0)return {...base,status:job.failureKind==='daily_limit'?'limited':'failed',retryAfter:Math.ceil(wait/1000),message:job.failureKind==='daily_limit'?'The kitchen’s daily image limit has been reached. Please try tomorrow.':'This photo could not be created yet. Please try again in a few minutes.'};
 }
 return {...base,status:'missing',canGenerate:true,message:'A photo will be created for this recipe.'};
}
export async function requestRecipePhoto(models,recipe,env){
 const state=await recipePhotoStatus(models,recipe,env);
 if(state.status==='ready'||['queued','running'].includes(state.status)||!state.canGenerate)return state;
 const job=await enqueueImageJob(models,recipe,Boolean(recipe.image)||isRetiredStockPhoto(recipe),env);
 return {...state,status:visibleJobStatus(job),canGenerate:false,message:'Creating a photo for this recipe…'};
}
