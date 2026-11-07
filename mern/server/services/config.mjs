import crypto from 'node:crypto';
export class AppError extends Error{constructor(status,message){super(message);this.status=status;}}
export function positiveInt(value,fallback,max=10000){const n=Number(value);return Number.isInteger(n)&&n>=0?Math.min(n,max):fallback;}
export function featureStatus(env=process.env){
 const cloudImages=Boolean(env.CLOUDINARY_CLOUD_NAME&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET);
 const admin=Boolean(env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=32);
 const generator=Boolean(cloudImages&&env.SD_SERVICE_URL&&env.SD_SERVICE_TOKEN?.length>=32)&&positiveInt(env.IMAGE_DAILY_LIMIT,5)>0;
 return {enhancements:Boolean(env.OPENAI_API_KEY)&&positiveInt(env.AI_DAILY_LIMIT,30)>0,cloudImages,imageGeneration:generator&&admin,automaticImages:generator&&env.AUTO_RECIPE_PHOTOS!=='0'};
}
export function requireAdmin(req,env){
 const expected=env.ADMIN_TOKEN||'';const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(expected.length<32)throw new AppError(503,'Photo studio is not configured. Set an ADMIN_TOKEN of at least 32 characters.');
 const wanted=Buffer.from(expected),actual=Buffer.from(supplied);
 if(actual.length!==wanted.length||!crypto.timingSafeEqual(actual,wanted))throw new AppError(401,'Incorrect studio access token.');
}
export async function reserveUsage(Usage,scope,limit,now=new Date()){
 if(limit<=0)throw new AppError(503,'This feature is disabled.');
 const day=now.toISOString().slice(0,10),_id=scope+':'+day;
 try{await Usage.findOneAndUpdate({_id,count:{$lt:limit}},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(now.getTime()+3*86400000)}},{upsert:true,new:true});}
 catch(e){if(e.code===11000)throw new AppError(429,'The daily generation limit has been reached. Please try tomorrow.');throw e;}
}
