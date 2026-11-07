import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recipePhotoUpdates} from '../shared/recipe-photo-updates.mjs';
import {fileURLToPath} from 'node:url';
import {recipes,filterRecipes,scaledAmount,shoppingRows} from '../shared/recipes.mjs';
import {additionalRecipes} from '../shared/additional-recipes.mjs';

// Keep the original five-recipe behavior covered independently of catalog size.
const originalIds=['pesto-pasta','shakshuka','avocado-toast','weekend-pancakes','green-salad'];
const starterRecipes=originalIds.map(id=>recipes.find(r=>r.id===id));
test('ingredient search is case insensitive',()=>{
 const r=filterRecipes(starterRecipes,{q:'EGGS'});
 assert.equal(r.length,3);
 assert.ok(r.every(x=>x.ingredients.some(i=>i.name==='eggs')));
});
test('search terms must all match',()=>{
 assert.equal(filterRecipes(starterRecipes,{q:'eggs avocado'})[0].id,'avocado-toast');
 assert.equal(filterRecipes(recipes,{q:'eggs nonexistent'}).length,0);
});
test('diet, meal and time filters combine',()=>{
 const r=filterRecipes(starterRecipes,{category:'Lunch',diet:'Vegan',maxTime:15});
 assert.deepEqual(r.map(x=>x.id),['green-salad']);
 const expanded=filterRecipes(recipes,{category:'Lunch',diet:'Vegan',maxTime:15});
 assert.ok(expanded.some(r=>r.id==='hummus-veggie-wraps'));
 assert.ok(expanded.every(r=>r.category==='Lunch'&&r.diet.includes('Vegan')&&r.minutes<=15));
});
test('pantry matches rank by number of matching ingredients',()=>{
 const r=filterRecipes(starterRecipes,{pantry:['avocado','eggs','bread']});
 assert.equal(r[0].id,'avocado-toast');assert.equal(r[0].match,3);
 assert.ok(r.every(x=>x.match>0));
});
test('servings scale fractions without rounding to whole ingredients',()=>{
 assert.equal(scaledAmount(0.5,2,3),0.75);
 assert.equal(scaledAmount(200,2,1),100);
});
test('shopping conversion preserves units and recipe data',()=>{
 const original=JSON.stringify(recipes[0]);
 const rows=shoppingRows(recipes[0],4);
 assert.equal(rows[0].amount,400);assert.equal(rows[0].unit,'g');
 assert.equal(JSON.stringify(recipes[0]),original);
});
test('105 recipes retain all original IDs and add exactly 100 unique recipes',()=>{
 assert.equal(recipes.length,105);assert.equal(additionalRecipes.length,100);
 assert.equal(new Set(recipes.map(r=>r.id)).size,105);
 assert.deepEqual(recipes.slice(0,5).map(r=>r.id),originalIds);
 assert.equal(new Set(recipes.map(r=>r.name.toLowerCase())).size,105);
});
test('every recipe has usable content and valid ingredient quantities',()=>{
 for(const r of recipes){
  for(const key of ['id','name','subtitle','description','cuisine','difficulty','tip'])
   assert.ok(typeof r[key]==='string'&&r[key].trim().length>0,`${r.id}: ${key}`);
  assert.match(r.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(['Breakfast','Lunch','Dinner'].includes(r.category),r.id);
  assert.ok(Number.isInteger(r.minutes)&&r.minutes>0,r.id);
  assert.ok(Number.isInteger(r.servings)&&r.servings>=1&&r.servings<=12,r.id);
  assert.ok(r.steps.length>=3&&r.steps.every(s=>typeof s==='string'&&s.length>20),r.id);
  assert.ok(r.ingredients.length>=4,r.id);
  assert.equal(new Set(r.ingredients.map(i=>i.name)).size,r.ingredients.length,r.id);
  for(const i of r.ingredients){
   assert.ok(i.name.trim()&&Number.isFinite(i.amount)&&i.amount>0,r.id+': '+i.name);
   assert.equal(typeof i.unit,'string');
  }
 }
});
test('all recipe seeds start without a bundled stock photo',()=>{
 assert.ok(recipes.every(r=>r.image===''));
 assert.ok(existsSync(new URL('../public/placeholder-recipe.svg',import.meta.url)));
});

test('shopping quantities scale safely for every recipe at 1, 3 and 12 servings',()=>{
 const before=JSON.stringify(recipes);
 for(const r of recipes){
  for(const servings of [1,3,12]){
   const rows=shoppingRows(r,servings);
   assert.equal(rows.length,r.ingredients.length);
   rows.forEach((i,n)=>{
    assert.ok(Number.isFinite(i.amount)&&i.amount>0,r.id+': '+i.name);
    assert.equal(i.name,r.ingredients[n].name);assert.equal(i.unit,r.ingredients[n].unit);
    assert.ok(Math.abs(i.amount-r.ingredients[n].amount*servings/r.servings)<=0.005001);
   });
  }
 }
 assert.equal(JSON.stringify(recipes),before);
});
test('diet tags are supported and plant-based recipes do not include meat or dairy',()=>{
 const dairy=/^(milk|plain (Greek )?yogurt|ricotta|feta|cheddar|mozzarella|halloumi|cream|butter|vegetarian hard cheese)$/i;
 const meat=/\b(chicken|turkey|beef|pork|salmon|cod|shrimp|tuna|white fish)\b/i;
 for(const r of recipes){
  assert.ok(r.diet.every(d=>['Vegetarian','Vegan','Dairy-free','Gluten-free'].includes(d)),r.id);
  if(r.diet.includes('Vegan')){
   assert.ok(r.diet.includes('Vegetarian')&&r.diet.includes('Dairy-free'),r.id);
   assert.ok(r.ingredients.every(i=>!dairy.test(i.name)&&i.name!=='eggs'&&i.name!=='honey'),r.id);
  }
  if(r.diet.includes('Vegetarian'))assert.ok(r.ingredients.every(i=>!meat.test(i.name)),r.id);
  if(r.diet.includes('Dairy-free'))assert.ok(r.ingredients.every(i=>!dairy.test(i.name)),r.id);
 }
});
test('meat and fish recipes stay out of vegetarian search results',()=>{
 for(const id of ['soy-garlic-chicken-rice','turkey-bolognese','teriyaki-salmon-rice','tuna-white-bean-salad']){
  assert.ok(recipes.some(r=>r.id===id),id);
  assert.ok(!filterRecipes(recipes,{diet:'Vegetarian'}).some(r=>r.id===id),id);
 }
 assert.ok(filterRecipes(recipes,{q:'GOCHUJANG TOFU'}).some(r=>r.id==='gochujang-tofu-bowls'));
});
test('root compatibility copies match the deployed shared recipe collection',async()=>{
 const root=await import('../recipes.mjs');
 assert.deepEqual(root.recipes,recipes);
 assert.equal(readFileSync(new URL('../Kitchen.tsx',import.meta.url),'utf8'),readFileSync(new URL('../shared/Kitchen.tsx',import.meta.url),'utf8'));
});

test('the retired stock image bundle is absent from the app',()=>{
 const files=readdirSync(new URL('../public',import.meta.url),{recursive:true});
 assert.equal(files.filter(p=>/^food\//.test(p)&&/\.(jpe?g|png|webp)$/i.test(p)).length,0);
});

test('image information describes generated images rather than stock licenses',()=>{
 const page=readFileSync(new URL('../public/photo-credits.html',import.meta.url),'utf8');
 assert.match(page,/AI-generated/);assert.ok(!page.includes('commons.wikimedia.org'));
});

test('stock retirement only clears known stock metadata and protects AI photos',()=>{
 const updates=recipePhotoUpdates(recipes);
 assert.equal(updates.length,105);
 assert.equal(new Set(updates.map(x=>x.updateOne.filter.id)).size,105);
 for(const {updateOne:op} of updates){
  assert.equal(op.upsert,false);assert.deepEqual(op.filter.imageGenerated,{$ne:true});
  assert.equal(op.update.$set.image,'');assert.equal(op.update.$set.imageSource,'');
  assert.ok(!op.filter.$or[0].image.$in.includes('/my-custom-photo.jpg'));
 }
 assert.deepEqual(recipePhotoUpdates(recipes),updates);
});
