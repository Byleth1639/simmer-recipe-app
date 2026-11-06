import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {recipes as starterRecipes,shoppingRows} from '../../shared/recipes.mjs';
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
const recipeSchema=new mongoose.Schema({id:{type:String,required:true,unique:true},name:String,subtitle:String,description:String,category:String,cuisine:String,minutes:Number,servings:Number,diet:[String],image:String,difficulty:String,ingredients:[{name:String,amount:Number,unit:String,_id:false}],steps:[String],tip:String},{versionKey:false});
const Recipe=mongoose.model('Recipe',recipeSchema);
const favoriteSchema=new mongoose.Schema({visitor:{type:String,required:true},recipe:{type:String,required:true}},{versionKey:false});favoriteSchema.index({visitor:1,recipe:1},{unique:true});
const Favorite=mongoose.model('Favorite',favoriteSchema);
const shoppingSchema=new mongoose.Schema({id:{type:String,required:true,unique:true},visitor:{type:String,required:true},name:String,unit:String,amount:Number,checked:{type:Number,default:0}},{versionKey:false});
const Shopping=mongoose.model('Shopping',shoppingSchema);
app.use((req,res,next)=>{const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('simmer_visitor='))?.slice(15);req.visitor=raw&&/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();res.setHeader('Cache-Control','no-store');res.cookie('simmer_visitor',req.visitor,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:31536000000});next();});
app.get('/api/kitchen',async(req,res,next)=>{try{const [recipes,f,s]=await Promise.all([Recipe.find().lean(),Favorite.find({visitor:req.visitor}).lean(),Shopping.find({visitor:req.visitor}).sort({name:1}).lean()]);res.json({recipes,favorites:f.map(x=>x.recipe),shopping:s});}catch(e){next(e);}});
app.post('/api/kitchen',async(req,res,next)=>{try{
 // In production, configure APP_ORIGIN to the public HTTPS origin.
 const origin=req.headers.origin;const expected=process.env.APP_ORIGIN||'http://localhost:5173';
 if(origin!==expected)return res.status(403).json({error:'Invalid origin'});
 const b=req.body,visitor=req.visitor;const r=typeof b.recipeId==='string'?await Recipe.findOne({id:b.recipeId}).lean():null;
 if(b.action==='favorite'&&r&&typeof b.saved==='boolean'){
 if(b.saved)await Favorite.updateOne({visitor,recipe:r.id},{$setOnInsert:{visitor,recipe:r.id}},{upsert:true});else await Favorite.deleteOne({visitor,recipe:r.id});
 }else if(b.action==='add-shopping'&&r&&Number.isInteger(b.servings)&&b.servings>=1&&b.servings<=12){
 await Shopping.bulkWrite(shoppingRows(r,b.servings).map(i=>({updateOne:{filter:{id:visitor+':'+i.name+':'+i.unit,visitor},update:{$setOnInsert:{id:visitor+':'+i.name+':'+i.unit,visitor,name:i.name,unit:i.unit},$set:{checked:0},$inc:{amount:i.amount}},upsert:true}})));
 }else if(b.action==='check'&&typeof b.id==='string'&&typeof b.checked==='boolean')await Shopping.updateOne({id:b.id,visitor},{$set:{checked:b.checked?1:0}});
 else if(b.action==='remove-checked')await Shopping.deleteMany({visitor,checked:1});
 else return res.status(400).json({error:'Invalid kitchen action.'});
 res.json({ok:true});
 }catch(e){next(e);}});
const here=path.dirname(fileURLToPath(import.meta.url));app.use(express.static(path.join(here,'../client/dist')));
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(here,'../client/dist/index.html')));
app.use((err,req,res,next)=>{console.error(err.message);res.status(500).json({error:'Could not complete your request. Try again.'});});
if(!process.env.MONGODB_URI)throw Error('Set MONGODB_URI in .env (see .env.example).');
await mongoose.connect(process.env.MONGODB_URI);await Promise.all([Recipe.init(),Favorite.init(),Shopping.init()]);
await Recipe.bulkWrite(starterRecipes.map(r=>({updateOne:{filter:{id:r.id},update:{$setOnInsert:r},upsert:true}})));
const port=Number(process.env.PORT)||3001;app.listen(port,()=>console.log(`Simmer API listening on http://localhost:${port}`));
