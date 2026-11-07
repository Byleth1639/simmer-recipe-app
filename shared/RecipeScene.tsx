import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {scaledAmount} from './recipes.mjs';
type Ingredient={name:string;amount:number;unit:string};
type Recipe={id:string;name:string;servings:number;ingredients:Ingredient[]};
function ingredientStyle(name:string){
 const n=name.toLowerCase();
 if(/spinach|basil|lettuce|broccoli|mint|parsley|pea|cucumber|scallion/.test(n))return {color:'#64954a',shape:'leaf'};
 if(/tomato|pepper|strawberr|salsa|kimchi/.test(n))return {color:'#d65a3b',shape:'round'};
 if(/carrot|sweet potato|mango|turmeric/.test(n))return {color:'#e9a248',shape:'cube'};
 if(/chicken|turkey|tofu|cheese|feta|bread|potato/.test(n))return {color:'#d7bd83',shape:'cube'};
 if(/beef|pork|mushroom|bean|lentil/.test(n))return {color:'#97765a',shape:'round'};
 if(/salmon|shrimp|tuna|fish/.test(n))return {color:'#db9a84',shape:'cube'};
 return {color:'#e2d7aa',shape:'round'};
}
export default function RecipeScene({recipe,servings}:{recipe:Recipe;servings:number}){
 const host=useRef<HTMLDivElement>(null),api=useRef<{select:(i:number)=>void;spread:(v:number)=>void;rotate:(v:boolean)=>void;reset:()=>void}|null>(null);
 const [selected,setSelected]=useState(0),[spread,setSpread]=useState(0),[rotate,setRotate]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const container=host.current;if(!container)return;let renderer:THREE.WebGLRenderer,controls:OrbitControls,frame=0,disposed=false;const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeadd');
  const camera=new THREE.PerspectiveCamera(40,1,0.1,60);camera.position.set(5.4,5.7,6.2);
  const items:THREE.Group[]=[],meshes:THREE.Mesh[]=[],targets:THREE.Vector3[]=[];
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','Interactive 3D ingredient plate for '+recipe.name);renderer.domElement.setAttribute('role','img');container.appendChild(renderer.domElement);
   controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=13;controls.maxPolarAngle=Math.PI/2.05;controls.target.set(0,0.3,0);
   scene.add(new THREE.HemisphereLight('#fff9e8','#a8aa8d',2.5));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(4,8,3);scene.add(light);
   function add(geometry:THREE.BufferGeometry,color:string,parent:THREE.Object3D=scene){const material=new THREE.MeshStandardMaterial({color,roughness:0.6});const mesh=new THREE.Mesh(geometry,material);geometries.push(geometry);materials.push(material);parent.add(mesh);return mesh;}
   const plate=add(new THREE.CylinderGeometry(2.55,2.35,0.16,64),'#faf8ef');plate.position.y=-0.08;
   const rim=add(new THREE.TorusGeometry(2.38,0.1,12,72),'#f3f0e1');rim.rotation.x=Math.PI/2;rim.position.y=0.025;
   const count=recipe.ingredients.length,portion=Math.min(1.35,Math.max(0.65,Math.sqrt(servings/recipe.servings)));
   recipe.ingredients.forEach((ingredient,index)=>{
    const group=new THREE.Group(),angle=index/count*Math.PI*2,radius=count>6?1.35:1.1,style=ingredientStyle(ingredient.name);group.position.set(Math.cos(angle)*radius,0.18,Math.sin(angle)*radius);targets.push(group.position.clone());scene.add(group);items.push(group);
    for(let j=0;j<5;j++){
     const geometry=style.shape==='cube'?new THREE.BoxGeometry(0.31,0.21,0.3):style.shape==='leaf'?new THREE.SphereGeometry(0.24,12,8):new THREE.SphereGeometry(0.19,16,10);
     const mesh=add(geometry,style.color,group);if(style.shape==='leaf')mesh.scale.set(1,0.2,0.7);mesh.position.set(((j%3)-1)*0.28,Math.floor(j/3)*0.16,((j%2)-0.5)*0.25);mesh.rotation.y=(index+j)*0.7;mesh.userData.ingredient=index;meshes.push(mesh);
    }
    group.scale.setScalar(portion);
   });
   function select(i:number){meshes.forEach(m=>{const mat=m.material as THREE.MeshStandardMaterial;mat.emissive.set(m.userData.ingredient===i?'#655828':'#000000');mat.emissiveIntensity=m.userData.ingredient===i?0.28:0;});}
   api.current={select,spread:v=>items.forEach((g,i)=>{g.position.copy(targets[i]).multiplyScalar(1+v*0.6);g.position.y=0.18+v*0.35;}),rotate:v=>{controls.autoRotate=v;},reset:()=>{camera.position.set(5.4,5.7,6.2);controls.target.set(0,0.3,0);controls.update();}};select(0);setSelected(0);setError('');
   const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
   const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
   const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(meshes);if(hits.length){const i=hits[0].object.userData.ingredient;setSelected(i);select(i);}};
   renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
   const resize=new ResizeObserver(()=>{const width=container.clientWidth||300;renderer.setSize(width,330,false);camera.aspect=width/330;camera.updateProjectionMatrix();});resize.observe(container);
   function animate(){if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);}animate();
   return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();api.current=null;};
  }catch{setError('3D is unavailable in this browser. You can still explore the ingredient quantities below.');return()=>{disposed=true;cancelAnimationFrame(frame);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer?.dispose();renderer?.domElement.remove();api.current=null;};}
 },[recipe.id,servings]);
 useEffect(()=>{api.current?.spread(spread);},[spread,recipe.id,servings]);
 useEffect(()=>{api.current?.rotate(rotate);},[rotate,recipe.id,servings]);
 return <div className="recipe-scene"><div ref={host} className="scene-canvas"/>{error&&<p className="alert alert-warning" role="status">{error}</p>}<p className="small text-muted mt-2">Drag to rotate, scroll or pinch to zoom. Choose an ingredient to highlight it. This is a stylized ingredient model, not a scan of the finished meal.</p><div className="row g-2 align-items-center"><div className="col-12 col-sm-6"><label className="form-label" htmlFor="ingredient-spacing">Spread ingredients</label><input id="ingredient-spacing" className="form-range" type="range" min="0" max="1" step="0.1" value={spread} onChange={e=>setSpread(Number(e.target.value))}/></div><div className="col-12 col-sm-6 d-flex gap-2 flex-wrap"><button className="btn btn-outline-secondary btn-sm" onClick={()=>setRotate(v=>!v)} aria-pressed={rotate}>{rotate?'Pause rotation':'Auto rotate'}</button><button className="btn btn-outline-secondary btn-sm" onClick={()=>api.current?.reset()}>Reset view</button></div></div><div className="ingredient-legend mt-3">{recipe.ingredients.map((i,n)=><button className={'btn btn-sm '+(selected===n?'btn-success':'btn-outline-secondary')} key={i.name} aria-pressed={selected===n} onClick={()=>{setSelected(n);api.current?.select(n);}}>{i.name} · {scaledAmount(i.amount,recipe.servings,servings)} {i.unit}</button>)}</div></div>;
}
