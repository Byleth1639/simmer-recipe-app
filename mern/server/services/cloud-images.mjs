import {v2 as cloudinary} from 'cloudinary';
import {AppError} from './config.mjs';
export function createCloudImages(env=process.env){
 const ready=Boolean(env.CLOUDINARY_CLOUD_NAME&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET);
 if(ready)cloudinary.config({cloud_name:env.CLOUDINARY_CLOUD_NAME,api_key:env.CLOUDINARY_API_KEY,api_secret:env.CLOUDINARY_API_SECRET,secure:true});
 const folder=(env.CLOUDINARY_FOLDER||'simmer').replace(/[^a-zA-Z0-9/_-]/g,'').slice(0,100)||'simmer';
 return {ready,async uploadBuffer(buffer,publicId){
  if(!ready)throw new AppError(503,'Cloud image storage is not configured.');
  return new Promise((resolve,reject)=>{
   const stream=cloudinary.uploader.upload_stream({resource_type:'image',public_id:folder+'/'+publicId,overwrite:false,unique_filename:false},(error,result)=>{if(error)return reject(new AppError(502,'The image could not be uploaded to cloud storage.'));if(!result?.secure_url)return reject(new AppError(502,'Cloud storage did not return an image URL.'));resolve({url:result.secure_url,publicId:result.public_id});});
   stream.end(buffer);
  });
 }};
}
