import 'dotenv/config';
import mongoose from 'mongoose';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {recipes} from '../../shared/recipes.mjs';
import {recipePhotoUpdates} from '../../shared/recipe-photo-updates.mjs';
import {models} from './models.mjs';
import {createApp} from './app.mjs';
if(!process.env.MONGODB_URI)throw Error('Set MONGODB_URI in the server environment.');
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(Object.values(models).map(model=>model.init()));
await models.Recipe.bulkWrite(recipes.map(r=>({updateOne:{filter:{id:r.id},update:{$setOnInsert:r},upsert:true}})));
// Older deployments may still use the earlier shared photos. Only migrate paths whose files are present.
const photoUpdates=recipePhotoUpdates(recipes).filter(op=>existsSync(fileURLToPath(new URL('../../public'+op.updateOne.update.$set.image,import.meta.url))));if(photoUpdates.length)await models.Recipe.bulkWrite(photoUpdates);
const app=createApp({models,startWorker:true});const port=Number(process.env.PORT)||3001;
const server=app.listen(port,()=>console.log('Simmer API listening on port '+port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.locals.imageWorker.stop();server.close(()=>void mongoose.disconnect().finally(()=>process.exit(0)));});
