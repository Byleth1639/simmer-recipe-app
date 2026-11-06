import {test} from 'node:test';import assert from 'node:assert/strict';
import {recipes,filterRecipes,scaledAmount,shoppingRows} from '../shared/recipes.mjs';
test('ingredient search is case insensitive',()=>{const r=filterRecipes(recipes,{q:'EGGS'});assert.equal(r.length,3);assert.ok(r.every(x=>x.ingredients.some(i=>i.name==='eggs')));});
test('search terms must all match',()=>{assert.equal(filterRecipes(recipes,{q:'eggs avocado'})[0].id,'avocado-toast');assert.equal(filterRecipes(recipes,{q:'eggs nonexistent'}).length,0);});
test('diet, meal and time filters combine',()=>{const r=filterRecipes(recipes,{category:'Lunch',diet:'Vegan',maxTime:15});assert.deepEqual(r.map(x=>x.id),['green-salad']);});
test('pantry matches rank by number of matching ingredients',()=>{const r=filterRecipes(recipes,{pantry:['avocado','eggs','bread']});assert.equal(r[0].id,'avocado-toast');assert.equal(r[0].match,3);assert.ok(r.every(x=>x.match>0));});
test('servings scale fractions without rounding to whole ingredients',()=>{assert.equal(scaledAmount(0.5,2,3),0.75);assert.equal(scaledAmount(200,2,1),100);});
test('shopping conversion preserves units and recipe data',()=>{const original=JSON.stringify(recipes[0]);const rows=shoppingRows(recipes[0],4);assert.equal(rows[0].amount,400);assert.equal(rows[0].unit,'g');assert.equal(JSON.stringify(recipes[0]),original);});
test('starter recipe ids are unique and required recipe content exists',()=>{assert.equal(new Set(recipes.map(r=>r.id)).size,recipes.length);for(const r of recipes){assert.ok(r.steps.length>=3);assert.ok(r.ingredients.length>=4);assert.ok(r.minutes>0);assert.ok(r.servings>0);}});
