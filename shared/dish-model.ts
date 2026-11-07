import * as THREE from 'three';
import {dishProfile,ingredientAppearance} from './recipe-visuals.mjs';
type Ingredient={name:string;amount:number;unit:string};
type Recipe={id:string;name:string;servings:number;ingredients:Ingredient[]};
export type DishModel={root:THREE.Group;layers:THREE.Group[];pickable:THREE.Mesh[];halos:THREE.Mesh[];dispose:()=>void};
export function buildDishModel(recipe:Recipe,{lowPoly=false}:{lowPoly?:boolean}={}):DishModel{
 const root=new THREE.Group(),layers:THREE.Group[]=[],pickable:THREE.Mesh[]=[],halos:THREE.Mesh[]=[];
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const profile=dishProfile(recipe);let randomState=profile.seed||1;
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 function mesh(geometry:THREE.BufferGeometry,color:string,parent:THREE.Object3D,index=-1,roughness=.72){
  const material=new THREE.MeshStandardMaterial({color,roughness,metalness:0});
  const object=new THREE.Mesh(geometry,material);geometries.add(geometry);materials.add(material);parent.add(object);object.castShadow=true;object.receiveShadow=true;
  if(index>=0){object.userData.ingredient=index;object.userData.baseColor=color;pickable.push(object);}return object;
 }
 const box=(x:number,y:number,z:number,color:string,parent:THREE.Object3D,index:number)=>mesh(new THREE.BoxGeometry(x,y,z),color,parent,index);
 const ellipsoid=(x:number,y:number,z:number,color:string,parent:THREE.Object3D,index:number)=>{const m=mesh(new THREE.SphereGeometry(1,lowPoly?8:18,lowPoly?5:12),color,parent,index);m.scale.set(x,y,z);return m;};
 const disk=(radius:number,height:number,color:string,parent:THREE.Object3D,index:number)=>mesh(new THREE.CylinderGeometry(radius,radius*.97,height,lowPoly?16:48),color,parent,index);
 const names=recipe.ingredients.map(i=>i.name.toLowerCase()),has=(pattern:RegExp)=>names.some(n=>pattern.test(n));
 const isBowl=['bowl','soup','salad','oats','yogurt','pasta'].includes(profile.kind);
 const vesselColor=profile.kind==='skillet'?'#3b4140':'#eee8d9';
 const plate=disk(isBowl?2.5:2.65,isBowl?.35:.13,vesselColor,root,-1);plate.position.y=-.19;
 const rim=mesh(new THREE.TorusGeometry(isBowl?2.47:2.48,isBowl?.11:.065,lowPoly?6:12,lowPoly?40:96),profile.kind==='skillet'?'#555d57':'#c7c8ad',root);rim.rotation.x=Math.PI/2;rim.position.y=isBowl?.03:-.08;
 if(profile.kind==='skillet'){const handle=box(.42,.18,1.25,'#373d38',root,-1);handle.position.set(0,-.12,3.1);}
 const toast=profile.kind==='toast'||profile.kind==='sandwich',stacks=[-.89,.89];
 recipe.ingredients.forEach((ingredient,index)=>{
  const layer=new THREE.Group();layer.userData.index=index;layers.push(layer);root.add(layer);
  const style=ingredientAppearance(ingredient.name),shape=style.shape,color=style.color,angle=index/Math.max(recipe.ingredients.length,1)*Math.PI*2;
  layer.userData.explode=new THREE.Vector3(Math.cos(angle)*1.6,.2+index*.035,Math.sin(angle)*1.6);
  function at(object:THREE.Object3D,x:number,y:number,z:number,rotation=0){object.position.set(x,y,z);object.rotation.y=rotation;return object;}
  function scattered(count:number,radius:number,create:(x:number,z:number,k:number)=>void){for(let k=0;k<count;k++){const a=random()*Math.PI*2,r=Math.sqrt(random())*radius;create(Math.cos(a)*r,Math.sin(a)*r,k);}}
  function leaf(x:number,y:number,z:number,size=.35){
   const m=ellipsoid(size,.045,size*.52,color,layer,index);at(m,x,y,z,random()*Math.PI);m.rotation.z=(random()-.5)*.25;
   const vein=box(size*1.5,.013,.018,'#93a66a',layer,index);at(vein,x,y+.046,z,m.rotation.y);
  }
  function egg(x:number,y:number,z:number,size=.42){at(ellipsoid(size,.075,size*.77,'#fff6df',layer,index),x,y,z);at(ellipsoid(size*.49,.095,size*.44,'#e5ae35',layer,index),x+.03,y+.055,z);}
  function bread(x:number,y:number,z:number){
   at(box(1.52,.2,1.83,'#9c6239',layer,index),x,y,z,-.12);at(box(1.38,.1,1.67,'#dfbd7c',layer,index),x,y+.12,z,-.12);
   for(let k=0;k<14;k++)at(ellipsoid(.045,.008,.025,'#af7c4a',layer,index),x+(random()-.5)*1.15,y+.174,z+(random()-.5)*1.4);
  }
  if(toast&&shape==='bread')stacks.forEach(x=>bread(x,.15,0));
  else if(toast&&shape==='avocado')stacks.forEach(x=>{for(let k=0;k<7;k++)at(ellipsoid(.58,.07,.15,color,layer,index),x+(k-3)*.09,.38+k*.01,(k-3)*.19,-.22);});
  else if(toast&&shape==='egg')stacks.forEach(x=>{for(let k=0;k<3;k++)egg(x+.12,.53+k*.012,(k-1)*.43,.35);});
  else if(toast&&shape==='radish')stacks.forEach(x=>{for(let k=0;k<3;k++){const x1=x-.42+random()*.3,z1=(k-1)*.5;at(disk(.18,.04,'#bd4e72',layer,index),x1,.59,z1);at(disk(.14,.047,'#fbeddc',layer,index),x1,.6,z1);}});
  else if(profile.kind==='pancakes'&&/grain|liquid|egg/.test(shape)){
   const baseIndex=recipe.ingredients.findIndex(i=>/flour|oats/.test(i.name)),relevant=index===baseIndex||baseIndex<0;
   for(let k=0;k<3;k++)at(disk(1.14-k*.04,index===baseIndex?.18:.025,relevant?'#c39252':color,layer,index),Math.sin(k)*.06,.2+k*.22+(relevant?0:.13+index*.009),Math.cos(k)*.04);
  }
  else if(profile.kind==='pizza'&&shape==='bread')at(disk(1.95,.2,'#c79a5d',layer,index),0,.15,0);
  else if(profile.kind==='pizza'&&/tomato|sauce/.test(shape))at(disk(1.76,.035,color,layer,index),0,.27+index*.004,0);
  else if(profile.kind==='burger'&&shape==='bread'){
   at(disk(1.18,.24,'#c79555',layer,index),0,.12,0);at(ellipsoid(1.2,.38,1.2,'#c99a5b',layer,index),0,.97,0);
   scattered(18,.9,(x,z)=>at(ellipsoid(.05,.016,.025,'#eee2b6',layer,index),x,1.29-Math.hypot(x,z)*.12,z));
  }
  else if(profile.kind==='burger'&&/protein|bean|grain/.test(shape))at(disk(1.09,.21,color,layer,index),0,.39+index*.025,0);
  else if(profile.kind==='burger'&&shape==='leaf')for(let k=0;k<9;k++)leaf(Math.cos(k)*.75,.68,Math.sin(k)*.75,.56);
  else if(profile.kind==='burger'&&shape==='avocado')for(let k=0;k<4;k++)at(ellipsoid(.74,.08,.18,color,layer,index),(k-1.5)*.3,.84,0,.15);
  else if(profile.kind==='sandwich'&&shape==='cheese')stacks.forEach(x=>at(box(1.25,.035,1.45,color,layer,index),x,.54,0,-.12));
  else if(shape==='bread')bread(-1.35,.15,.9);
  else if(shape==='avocado')scattered(7,1.4,(x,z,k)=>at(ellipsoid(.42,.08,.16,color,layer,index),x,.39+k*.006,z,k*.35));
  else if(shape==='radish'||shape==='cucumber'||shape==='banana')scattered(9,1.55,(x,z)=>{
   at(disk(shape==='banana'?.22:.27,.055,color,layer,index),x,.36+random()*.05,z);
   if(shape!=='banana')at(disk(shape==='radish'?.21:.20,.06,shape==='radish'?'#f5e9d7':'#b6c798',layer,index),x,.366,z);
  });
  else if(shape==='egg'){
   if(profile.kind==='eggs')scattered(21,1.65,(x,z)=>at(ellipsoid(.28,.11,.19,'#e8bc50',layer,index),x,.21+random()*.1,z));
   else for(let k=0;k<3;k++)egg(Math.cos(k*2.1)*1.05,.33,Math.sin(k*2.1)*1.05,.47);
  }
  else if(shape==='pasta'){
   const noodle=/spaghetti|noodle/.test(ingredient.name);
   for(let k=0;k<(noodle?34:43);k++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*1.6,x=Math.cos(a)*r,z=Math.sin(a)*r,y=.18+random()*.25;
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x-.23,y,z-.22),new THREE.Vector3(x,y+.12,z),new THREE.Vector3(x+.27,y,z+.28)]);
    mesh(new THREE.TubeGeometry(path,10,noodle?.035:.075,6,false),has(/pesto/)?'#b2b575':color,layer,index);
   }
  }
  else if(shape==='grain'){
   if(profile.kind==='oats'){at(disk(1.96,.17,color,layer,index),0,.11,0);scattered(42,1.8,(x,z)=>at(ellipsoid(.1,.025,.06,'#dbc5a0',layer,index),x,.215,z));}
   else scattered(lowPoly?40:85,1.85,(x,z)=>at(ellipsoid(.09,.055,.17,color,layer,index),x,.15+random()*.12,z,random()*Math.PI));
  }
  else if(shape==='leaf')scattered(profile.kind==='salad'?22:13,1.8,(x,z)=>leaf(x,profile.kind==='salad'?.32+random()*.25:.42,z,profile.kind==='salad'?.48:.25));
  else if(shape==='tomato')scattered(8,1.7,(x,z)=>{at(ellipsoid(.26,.2,.24,color,layer,index),x,.31+random()*.07,z);at(ellipsoid(.2,.025,.18,'#e98458',layer,index),x,.49,z);});
  else if(shape==='broccoli')scattered(6,1.65,(x,z)=>{at(box(.08,.28,.08,'#a4b57a',layer,index),x,.3,z);for(let k=0;k<4;k++)at(ellipsoid(.19,.16,.18,color,layer,index),x+Math.cos(k*1.6)*.14,.51,z+Math.sin(k*1.6)*.14);});
  else if(shape==='mushroom')scattered(7,1.6,(x,z)=>{at(box(.1,.18,.1,'#d2bea2',layer,index),x,.28,z);at(ellipsoid(.28,.13,.24,color,layer,index),x,.41,z);});
  else if(shape==='citrus')for(let k=0;k<2;k++){
   at(mesh(new THREE.CylinderGeometry(.34,.34,.09,24,1,false,0,Math.PI*.65),color,layer,index),2-k*.43,.13,1.05+k*.4,k*.8);
   at(mesh(new THREE.CylinderGeometry(.28,.28,.095,24,1,false,0,Math.PI*.65),'#f2dda2',layer,index),2-k*.43,.14,1.05+k*.4,k*.8);
  }
  else if(shape==='fish'){
   at(box(1.2,.25,.65,color,layer,index),0,.35,0,-.24);for(let k=0;k<6;k++)at(box(.025,.012,.62,'#efbca0',layer,index),-.48+k*.18,.484,0,-.24);
  }
  else if(shape==='shrimp')scattered(7,1.5,(x,z,k)=>{const m=mesh(new THREE.TorusGeometry(.21,.09,8,20,Math.PI*1.55),color,layer,index);m.rotation.x=-Math.PI/2;at(m,x,.39,z,k);});
  else if(shape==='pepper'||shape==='aromatic')scattered(shape==='pepper'?12:9,1.7,(x,z,k)=>{const m=mesh(new THREE.TorusGeometry(.24,shape==='pepper'?.055:.028,6,16,Math.PI*1.1),color,layer,index);m.rotation.x=Math.PI/2;at(m,x,.39+random()*.05,z,k);});
  else if(shape==='sauce'||shape==='liquid'){
   if(profile.kind==='soup'||profile.kind==='yogurt'||profile.kind==='smoothie')at(disk(2.1,.1,profile.kind==='soup'?(has(/tomato|curry/)?'#ba6744':'#b8a067'):color,layer,index),0,.04+index*.002,0);
   else{
    const side=toast||profile.kind==='pancakes';
    const path=new THREE.CatmullRomCurve3(Array.from({length:24},(_,k)=>new THREE.Vector3(Math.sin(k*.8)*.45+(side?-.85:0),side?.73:.47,(k/23-.5)*(side?1.45:2.6))));
    const first=mesh(new THREE.TubeGeometry(path,40,.025,6,false),color,layer,index,.32);
    if(side){const other=first.clone();other.position.x=1.7;layer.add(other);other.userData.ingredient=index;pickable.push(other);}
   }
  }
  else if(shape==='tortilla')for(let k=0;k<2;k++){const m=disk(.99,.055,color,layer,index);at(m,(k-.5)*1.8,.18,0);m.rotation.z=k===0?-.25:.25;}
  else if(shape==='garnish')scattered(lowPoly?12:22,1.65,(x,z)=>at(ellipsoid(.035,.024,.025,color,layer,index),x,toast?.79:profile.kind==='pancakes'?.86:.56,z));
  else if(shape==='cheese')scattered(17,1.65,(x,z,k)=>at(box(.16,.045,.055,color,layer,index),x,.52,z,k));
  else if(shape==='berry')scattered(10,profile.kind==='pancakes'?1.2:1.65,(x,z)=>at(ellipsoid(.16,.16,.16,color,layer,index),x,profile.kind==='pancakes'?.86:.39,z));
  else if(shape==='bean')scattered(21,1.75,(x,z)=>at(ellipsoid(.11,.09,.16,color,layer,index),x,.28+random()*.11,z,random()*Math.PI));
  else if(shape==='potato'||shape==='cube'||shape==='apple'||shape==='protein')scattered(shape==='protein'?9:13,1.65,(x,z,k)=>at(box(shape==='protein'?.42:.27,.23,.29,color,layer,index),x,.26+random()*.07,z,k*.6));
  else scattered(9,1.7,(x,z)=>at(ellipsoid(.18,.12,.18,color,layer,index),x,.35,z));
  const bounds=new THREE.Box3().setFromObject(layer),center=bounds.getCenter(new THREE.Vector3());
  const ringMaterial=new THREE.MeshBasicMaterial({color:'#ab743d',transparent:true,opacity:.85,depthTest:false});materials.add(ringMaterial);
  const ringGeometry=new THREE.TorusGeometry(Math.max(.35,Math.min(2.05,bounds.getSize(new THREE.Vector3()).length()*.28)),.025,6,64);geometries.add(ringGeometry);
  const halo=new THREE.Mesh(ringGeometry,ringMaterial);halo.rotation.x=-Math.PI/2;halo.position.copy(center);halo.position.y=.09;halo.userData.basePosition=halo.position.clone();halo.visible=false;halo.renderOrder=10;root.add(halo);halos.push(halo);
 });
 return {root,layers,pickable,halos,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
