// Shared by the 3D explorer, image worker and cloud notebook exporter.
// A content key changes whenever the actual dish changes, but not its saved photo.
export function recipeVisualKey(recipe) {
 const value=JSON.stringify({id:recipe.id,name:recipe.name,description:recipe.description||'',ingredients:recipe.ingredients.map(({name,amount,unit})=>({name,amount,unit})),steps:recipe.steps||[]});
 let hash=2166136261;
 for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16).padStart(8,'0');
}
export function recipeImageSeed(recipe){return parseInt(recipeVisualKey(recipe),16)%2147483647;}
export function dishProfile(recipe){
 const n=recipe.name.toLowerCase();
 const kind=/smoothie/.test(n)?'smoothie':/parfait|yogurt bowl/.test(n)?'yogurt':/shakshuka|breakfast hash/.test(n)?'skillet':/pancake|fritter/.test(n)?'pancakes':/toast/.test(n)?'toast':/burger/.test(n)?'burger':/sandwich|toasties/.test(n)?'sandwich':/quesadilla|taco|wrap|fajita/.test(n)?'wrap':/pizza|flatbread/.test(n)?'pizza':/pasta|spaghetti|bolognese|noodle|stroganoff|gnocchi/.test(n)?'pasta':/soup|stew|dal|chili|curry/.test(n)?'soup':/salad|slaw/.test(n)?'salad':/scramble|omelet/.test(n)?'eggs':/oats/.test(n)?'oats':/tray|salmon potato|chicken potato/.test(n)?'roast':'bowl';
 const greens=recipe.ingredients.some(i=>/avocado|pesto|spinach|lettuce|broccoli/.test(i.name));
 const tomato=recipe.ingredients.some(i=>/tomato|red curry|paprika/.test(i.name));
 const accent=greens?'#64794a':tomato?'#b9573e':'#ae783c';
 const vessels={smoothie:'A glass, blended fresh',yogurt:'A bowl of good things',skillet:'Straight from the skillet',pancakes:'A little stack of comfort',toast:'Built on a good slice',burger:'Every layer, together',sandwich:'A little between the bread',wrap:'Folded, filled & ready',pizza:'A fresh slice of inspiration',pasta:'Tossed together, beautifully',soup:'A bowl worth slowing down for',salad:'Freshness in every layer',eggs:'A brighter kind of breakfast',oats:'Something warm to wake up to',roast:'Good things from the oven',bowl:'Your whole meal, in a bowl'};
 return {kind,accent,kicker:vessels[kind],seed:recipeImageSeed(recipe)};
}
/** @type {[RegExp,string,string,string][]} */
const styles=[
 [/avocado/,'#7eab4d','avocado','Creamy green slices'],
 [/radish/,'#d76c8f','radish','Crisp, peppery slices'],
 [/\beggs?\b/,'#edbe50','egg','Golden yolks & tender whites'],
 [/bread|burger bun|naan|flatbread/,'#bd844d','bread','The golden, toasted base'],
 [/tortilla/,'#d9b977','tortilla','A warm, soft wrapper'],
 [/basil pesto/,'#5e8539','sauce','A bright basil coating'],
 [/spinach|lettuce|basil|parsley|mint|cabbage|chives|dill/,'#537d3d','leaf','A fresh green layer'],
 [/broccoli|cauliflower/,'#6c984c','broccoli','Tender, branching florets'],
 [/tomato|salsa|passata/,'#cb533c','tomato','A little sweetness & color'],
 [/bell pepper|roasted pepper/,'#da7040','pepper','Sweet pepper ribbons'],
 [/strawberr/,'#cb4653','berry','Sweet red berries'],
 [/blueberr|mixed berr/,'#62628b','berry','A handful of bright berries'],
 [/banana/,'#e9cf79','banana','Soft, sweet slices'],
 [/apple/,'#b96c4d','apple','A crisp, fruity bite'],
 [/mango|sweet potato|carrot/,'#e59a42','cube','A naturally sweet accent'],
 [/cucumber|zucchini/,'#7ba264','cucumber','Fresh green rounds'],
 [/lemon|lime/,'#dbbd45','citrus','A little citrus brightness'],
 [/mushroom/,'#9a7a5c','mushroom','A savory, earthy layer'],
 [/shrimp/,'#e49779','shrimp','Tender curled shrimp'],
 [/salmon/,'#dc8e6d','fish','A tender salmon portion'],
 [/tuna|cod|white fish/,'#c7aa91','fish','A flaky fish layer'],
 [/chicken|turkey|pork|beef|sausage/,'#ad7952','protein','The hearty, savory part'],
 [/tofu|halloumi|feta/,'#dacb9d','cube','A tender, savory bite'],
 [/cheese|cheddar|mozzarella|ricotta/,'#e3c771','cheese','A rich, mellow finish'],
 [/rice|quinoa|couscous/,'#ddd0a7','grain','A fluffy grain base'],
 [/pasta|spaghetti|noodle/,'#d6b76c','pasta','The twirlable, tender base'],
 [/gnocchi|potato/,'#c7a26d','potato','A soft, golden bite'],
 [/black bean/,'#695044','bean','Small, hearty black beans'],
 [/bean|lentil|chickpea|edamame|peas/,'#aaa463','bean','A little plant-powered goodness'],
 [/onion|garlic|ginger|scallion/,'#c7bda2','aromatic','A savory aromatic layer'],
 [/oats|flour|granola|breadcrumb/,'#c5a67b','grain','The comforting foundation'],
 [/milk|yogurt|cream|stock|water/,'#e5d9ba','liquid','Blended or stirred into the dish'],
 [/oil|honey|syrup|butter|peanut butter/,'#bca044','sauce','A glossy, flavorful finish'],
 [/seed|nut|walnut|coconut/,'#a58d65','garnish','A little finishing texture'],
 [/soy sauce|miso|vinegar|mustard|curry paste/,'#9c7144','sauce','A little depth in the sauce'],
 [/cinnamon|cumin|paprika|turmeric|pepper|oregano|thyme|chili|sugar|baking powder|cornstarch/,'#ac8455','garnish','Mixed through for flavor or texture']
];
export function ingredientAppearance(name){
 const found=styles.find(([pattern])=>pattern.test(name.toLowerCase()));
 return found?{color:found[1],shape:found[2],note:found[3]}:{color:'#c6a77b',shape:'cube',note:'Part of what makes this recipe yours'};
}
export function ingredientContext(recipe,name){
 const steps=recipe.steps||[];
 const words=name.toLowerCase().replace(/canned|cooked|ground|fresh|frozen|drained|ready|plain|unsweetened|gluten-free|fully|raw|peeled/g,'').split(/[^a-z]+/).filter(s=>s.length>3);
 const index=steps.findIndex(step=>words.some(word=>step.toLowerCase().includes(word.replace(/s$/,''))));
 return {note:ingredientAppearance(name).note,step:index<0?null:index+1,instruction:index<0?'Follow the recipe method below for this ingredient.':steps[index]};
}
export function photoPrompt(recipe){
 // Put dish identity first: shorter-context diffusion models must see it early.
 const ingredients=recipe.ingredients.map(i=>i.name).filter(n=>!/^water$|oil|ground cumin|black pepper/.test(n)).slice(0,9);
 return `Editorial food photograph, ${recipe.name}. ${recipe.description||''} Visible ingredients: ${ingredients.join(', ')}. Method: ${(recipe.steps||[]).at(-1)||'Serve the finished dish.'} ${recipe.cuisine||''} finished meal, prepared and plated together. Natural window light, realistic food texture, close three-quarter view, ceramic tableware, warm linen, one dish only. No text, no labels, no people. Never a collage or a raw ingredient display.`;
}
