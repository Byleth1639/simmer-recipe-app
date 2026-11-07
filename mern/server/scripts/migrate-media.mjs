import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Recipe} from '../models.mjs';
import {createCloudImages} from '../services/cloud-images.mjs';
const cloud=createCloudImages();if(!cloud.ready)throw Error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET first.');
if(!process.env.MONGODB_URI)throw Error('Set MONGODB_URI first.');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../public');
await mongoose.connect(process.env.MONGODB_URI);
let uploaded=0,skipped=0,failed=0;
try{
 for(const r of await Recipe.find().lean()){
  if(typeof r.image!=='string'||!r.image.startsWith('/food/')){skipped++;continue;}
  const file=path.resolve(publicRoot,'.'+r.image);if(!file.startsWith(publicRoot+path.sep)){failed++;continue;}
  try{
   const image=await cloud.uploadBuffer(await fs.readFile(file),'catalog/'+r.id);
   const result=await Recipe.updateOne({id:r.id,image:r.image},{$set:{image:image.url,imageProvider:'cloudinary',imagePublicId:image.publicId}});
   if(result.matchedCount){uploaded++;console.log('Uploaded '+r.id);}else{skipped++;console.log('Skipped changed photo '+r.id);}
  }catch(e){failed++;console.error('Failed '+r.id+': '+e.message);}
 }
 console.log(JSON.stringify({uploaded,skipped,failed}));if(failed)process.exitCode=1;
}finally{await mongoose.disconnect();}
