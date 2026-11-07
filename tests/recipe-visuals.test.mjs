import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recipes} from '../shared/recipes.mjs';
import {photoPrompt,recipeVisualKey,recipeImageSeed,dishProfile,ingredientAppearance,ingredientContext} from '../shared/recipe-visuals.mjs';

test('all recipes have distinct, reproducible generation prompts and seeds',()=>{
 assert.equal(new Set(recipes.map(photoPrompt)).size,105);
 assert.equal(new Set(recipes.map(recipeImageSeed)).size,105);
 for(const recipe of recipes){
  assert.ok(photoPrompt(recipe).includes(recipe.name));
  assert.ok(photoPrompt(recipe).includes(recipe.description));
  assert.equal(recipeImageSeed(structuredClone(recipe)),recipeImageSeed(recipe));
  assert.ok(recipeImageSeed(recipe)>=0&&recipeImageSeed(recipe)<=2147483647);
  assert.equal(recipeVisualKey({...recipe,image:'https://example.test/new-photo.png',imageGenerated:true}),recipeVisualKey(recipe));
 }
});
test('dish changes invalidate the saved image key',()=>{
 const recipe=recipes[0],key=recipeVisualKey(recipe);
 assert.notEqual(recipeVisualKey({...recipe,ingredients:[...recipe.ingredients,{name:'spinach',amount:80,unit:'g'}]}),key);
 assert.notEqual(recipeVisualKey({...recipe,steps:[...recipe.steps,'Bake until golden.']}),key);
});
test('the screenshot ingredients get separate recognizable forms',()=>{
 assert.equal(dishProfile(recipes.find(r=>r.id==='avocado-toast')).kind,'toast');
 const shapes=['bread','avocado','eggs','lemon','radishes','olive oil'].map(n=>ingredientAppearance(n).shape);
 assert.equal(new Set(shapes).size,6);
 assert.equal(ingredientAppearance('avocado').color,'#7eab4d');
 assert.equal(ingredientAppearance('eggs').shape,'egg');
 assert.equal(ingredientAppearance('radishes').shape,'radish');
 assert.ok(new Set(recipes.map(r=>dishProfile(r).kind)).size>=12);
});
test('ingredient context refers to the actual recipe method',()=>{
 const recipe=recipes.find(r=>r.id==='avocado-toast'),context=ingredientContext(recipe,'avocado');
 assert.equal(context.step,2);assert.equal(context.instruction,recipe.steps[1]);
 for(const recipe of recipes)for(const ingredient of recipe.ingredients){const context=ingredientContext(recipe,ingredient.name);if(context.step!==null)assert.equal(context.instruction,recipe.steps[context.step-1]);}
});
