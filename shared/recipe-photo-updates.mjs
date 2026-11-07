import {retiredStockPhotos,retiredStockPaths} from './retired-stock-photos.mjs';
const sources=new Map(retiredStockPhotos.filter(r=>r.source).map(r=>[r.id,r.source]));
const paths=new Set(retiredStockPaths);
export function isRetiredStockPhoto(recipe){
 if(recipe.imageGenerated)return false;
 return paths.has(recipe.image)||Boolean(sources.get(recipe.id)&&recipe.imageSource===sources.get(recipe.id));
}
export function withoutStockPhoto(recipe){
 return isRetiredStockPhoto(recipe)?{...recipe,image:'',imageCredit:'',imageSource:'',imageLicense:'',imageLicenseUrl:'',imageGenerated:false}:recipe;
}
// Remove only known stock references. Generated and custom-uploaded photos stay saved.
export function recipePhotoUpdates(recipes){
 const ids=new Set(recipes.map(r=>r.id));
 return retiredStockPhotos.filter(r=>ids.has(r.id)).map(r=>({updateOne:{
  filter:{id:r.id,imageGenerated:{$ne:true},$or:[{image:{$in:retiredStockPaths}},...(r.source?[{imageSource:r.source}]:[])]},
  update:{$set:{image:'',imageCredit:'',imageSource:'',imageLicense:'',imageLicenseUrl:''},$unset:{imageProvider:1,imagePublicId:1,imageRecipeHash:1,imageSeed:1,imageModel:1}},upsert:false
 }}));
}
