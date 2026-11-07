import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rateLimit} from 'express-rate-limit';
import {shoppingRows} from '../../shared/recipes.mjs';
import {AppError,featureStatus,requireAdmin} from './services/config.mjs';
import {createEnhancer,validateOptions} from './services/enhance.mjs';
import {createCloudImages} from './services/cloud-images.mjs';
import {createImageWorker,enqueueImageJob} from './services/image-jobs.mjs';
export function createApp({models,env=process.env,enhanceProvider,imageProvider,cloudProvider,startWorker=false}={}){
 const {Recipe,Favorite,Shopping,ImageJob}=models;
 const app=express();app.disable('x-powered-by');if(env.RENDER||env.TRUST_PROXY==='1')app.set('trust proxy',1);
 app.use(express.json({limit:'16kb'}));
 app.use('/api',rateLimit({windowMs:15*60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Please wait a few minutes.'}}));
 app.use('/api',(req,res,next)=>{
  const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('simmer_visitor='))?.slice(15);
  req.visitor=raw&&/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  res.setHeader('Cache-Control','no-store');res.cookie('simmer_visitor',req.visitor,{httpOnly:true,sameSite:'lax',secure:env.NODE_ENV==='production',maxAge:31536000000});
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.origin!==(env.APP_ORIGIN||'http://localhost:5173'))return res.status(403).json({error:'Invalid origin'});
  next();
 });
 const cloud=cloudProvider||createCloudImages(env);
 const enhance=createEnhancer(models,env,enhanceProvider);
 const worker=createImageWorker(models,env,cloud,imageProvider);
 if(startWorker&&featureStatus(env).imageGeneration)void worker.start().catch(e=>console.error('Image worker startup:',e.message));
 app.locals.imageWorker=worker;
 app.get('/api/features',(req,res)=>res.json(featureStatus(env)));
 app.get('/api/health',(req,res)=>res.json({ok:true}));
 app.get('/api/kitchen',async(req,res)=>{
  const [recipes,f,s]=await Promise.all([Recipe.find().lean(),Favorite.find({visitor:req.visitor}).lean(),Shopping.find({visitor:req.visitor}).sort({name:1}).lean()]);
  res.json({recipes,favorites:f.map(x=>x.recipe),shopping:s});
 });
 app.post('/api/kitchen',async(req,res)=>{
  const b=req.body||{},visitor=req.visitor;const r=typeof b.recipeId==='string'?await Recipe.findOne({id:b.recipeId}).lean():null;
  if(b.action==='favorite'&&r&&typeof b.saved==='boolean'){
   if(b.saved)await Favorite.updateOne({visitor,recipe:r.id},{$setOnInsert:{visitor,recipe:r.id}},{upsert:true});else await Favorite.deleteOne({visitor,recipe:r.id});
  }else if(b.action==='add-shopping'&&r&&Number.isInteger(b.servings)&&b.servings>=1&&b.servings<=12){
   await Shopping.bulkWrite(shoppingRows(r,b.servings).map(i=>({updateOne:{filter:{id:visitor+':'+i.name+':'+i.unit,visitor},update:{$setOnInsert:{id:visitor+':'+i.name+':'+i.unit,visitor,name:i.name,unit:i.unit},$set:{checked:0},$inc:{amount:i.amount}},upsert:true}})));
  }else if(b.action==='check'&&typeof b.id==='string'&&typeof b.checked==='boolean')await Shopping.updateOne({id:b.id,visitor},{$set:{checked:b.checked?1:0}});
  else if(b.action==='remove-checked')await Shopping.deleteMany({visitor,checked:1});
  else throw new AppError(400,'Invalid kitchen action.');
  res.json({ok:true});
 });
 const aiLimit=rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait a minute before requesting more recipe ideas.'}});
 app.post('/api/recipes/:id/enhance',aiLimit,async(req,res)=>{
  if(!featureStatus(env).enhancements)throw new AppError(503,'AI recipe ideas are not configured yet.');
  const recipe=await Recipe.findOne({id:req.params.id}).lean();if(!recipe)throw new AppError(404,'Recipe not found.');
  const options=validateOptions(req.body||{});res.json(await enhance(recipe,options));
 });
 const photoLimit=rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait a minute before submitting another photo.'}});
 app.post('/api/media/jobs',photoLimit,async(req,res)=>{
  requireAdmin(req,env);if(!featureStatus(env).imageGeneration)throw new AppError(503,'Configure the image service and Cloudinary before using photo studio.');
  const {recipeId,replace=false}=req.body||{};if(typeof recipeId!=='string'||typeof replace!=='boolean')throw new AppError(400,'Choose a recipe and whether to replace its photo.');
  const recipe=await Recipe.findOne({id:recipeId}).lean();if(!recipe)throw new AppError(404,'Recipe not found.');
  const job=await enqueueImageJob(models,recipe,replace,env);res.status(202).json({id:job.id,status:job.status});
 });
 app.get('/api/media/jobs/:id',async(req,res)=>{
  requireAdmin(req,env);const j=await ImageJob.findOne({id:req.params.id}).lean();if(!j)throw new AppError(404,'Photo job not found.');
  res.json({id:j.id,recipeId:j.recipeId,status:j.status,error:j.error||'',image:j.image||''});
 });
 app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
 const here=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(here,'../client/dist');
 app.use(express.static(dist));app.get('/{*splat}',(req,res)=>res.sendFile(path.join(dist,'index.html')));
 app.use((err,req,res,next)=>{const status=err instanceof AppError?err.status:(err.status>=400&&err.status<500?err.status:500);if(status>=500)console.error('Request failed:',err.message);res.status(status).json({error:err instanceof AppError?err.message:status===413?'Request is too large.':status===400?'Invalid request body.':'Could not complete your request. Try again.'});});
 return app;
}
