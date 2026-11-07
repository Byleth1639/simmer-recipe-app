import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {Focus,Layers3,MoveUpRight,Pause,Play,RotateCcw} from 'lucide-react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {scaledAmount} from './recipes.mjs';
import {dishProfile,ingredientAppearance,ingredientContext} from './recipe-visuals.mjs';
import {buildDishModel} from './dish-model';
type Ingredient={name:string;amount:number;unit:string};
type Recipe={id:string;name:string;servings:number;ingredients:Ingredient[];steps?:string[]};
type Props={recipe:Recipe;servings:number;selectedIngredient?:string|null;onSelectIngredient?:(name:string|null)=>void};
export default function RecipeScene({recipe,servings,selectedIngredient,onSelectIngredient}:Props){
 const host=useRef<HTMLDivElement>(null),api=useRef<{select:(i:number)=>void;spread:(v:number)=>void;rotate:(v:boolean)=>void;reset:()=>void}|null>(null);
 const [localSelection,setLocalSelection]=useState<string|null>(null),[spread,setSpread]=useState(0),[rotate,setRotate]=useState(false),[error,setError]=useState('');
 const selected=selectedIngredient===undefined?localSelection:selectedIngredient,selectedIndex=recipe.ingredients.findIndex(i=>i.name===selected);
 const chooseRef=useRef<(index:number)=>void>(()=>{}),selectionRef=useRef(selectedIndex);
 const sliderId=useId(),contextId=useId(),profile=dishProfile(recipe);
 const ingredient=recipe.ingredients[selectedIndex],context=ingredient?ingredientContext(recipe,ingredient.name):null;
 function choose(index:number){const name=index<0?null:recipe.ingredients[index]?.name||null;setLocalSelection(name);onSelectIngredient?.(name);}
 chooseRef.current=choose;selectionRef.current=selectedIndex;
 useEffect(()=>{setLocalSelection(null);setSpread(0);setRotate(false);},[recipe.id]);
 useEffect(()=>{
  const container=host.current;if(!container)return;
  let renderer:THREE.WebGLRenderer|SVGRenderer|undefined,controls:OrbitControls|undefined,frame=0,disposed=false,observer:ResizeObserver|undefined;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9dc');
  const camera=new THREE.PerspectiveCamera(36,1,.1,40),initial=new THREE.Vector3(3.6,5,5.6);camera.position.copy(initial);
  let dish:ReturnType<typeof buildDishModel>,active=selectionRef.current,exploded=0,dirty=true;
  const groundGeometry=new THREE.CircleGeometry(14,80),groundMaterial=new THREE.MeshStandardMaterial({color:'#e9e2d2',roughness:1});
  const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.4;ground.receiveShadow=true;scene.add(ground);
  const focusTarget=new THREE.Vector3(0,.25,0),target=new THREE.Vector3();
  let onDown:(e:PointerEvent)=>void,onUp:(e:PointerEvent)=>void,onLost:(e:Event)=>void;
  function cleanup(){
   disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
   if(renderer){renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('webglcontextlost',onLost);if(renderer instanceof THREE.WebGLRenderer)renderer.dispose();renderer.domElement.remove();}
   controls?.dispose();dish?.dispose();groundGeometry.dispose();groundMaterial.dispose();api.current=null;
  }
  try{
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{renderer=new SVGRenderer();renderer.setQuality('low');scene.remove(ground);scene.add(new THREE.AmbientLight('#fff8e9',.3));}
   dish=buildDishModel(recipe,{lowPoly:renderer instanceof SVGRenderer});scene.add(dish.root);
   if(renderer instanceof THREE.WebGLRenderer){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
   renderer.domElement.setAttribute('aria-label','Interactive ingredient model of '+recipe.name);renderer.domElement.setAttribute('role','img');container.appendChild(renderer.domElement);
   controls=new OrbitControls(camera,renderer.domElement as unknown as HTMLElement);controls.enableDamping=renderer instanceof THREE.WebGLRenderer;controls.addEventListener('change',()=>{dirty=true;});controls.enablePan=false;controls.minDistance=5;controls.maxDistance=12;controls.maxPolarAngle=Math.PI/2.12;controls.target.set(0,.25,0);controls.autoRotateSpeed=.65;
   scene.add(new THREE.HemisphereLight('#fff7e5','#929b8a',2));
   const light=new THREE.DirectionalLight('#fff6df',renderer instanceof THREE.WebGLRenderer?3.2:.65);light.position.set(-3,7,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-5;light.shadow.camera.right=5;light.shadow.camera.top=5;light.shadow.camera.bottom=-5;light.shadow.normalBias=.03;scene.add(light);
   const fill=new THREE.DirectionalLight('#e6eff3',renderer instanceof THREE.WebGLRenderer?1:.15);fill.position.set(5,3,-2);scene.add(fill);
   function select(index:number){
    active=index;dirty=true;dish.halos.forEach((halo,n)=>{halo.visible=n===index;});
    if(index>=0){const center=new THREE.Box3().setFromObject(dish.layers[index]).getCenter(new THREE.Vector3());focusTarget.set(center.x*.35,.25,center.z*.35);}else focusTarget.set(0,.25,0);
   }
   api.current={select,spread:value=>{exploded=value;dirty=true;},rotate:value=>{if(controls)controls.autoRotate=value;},reset:()=>{dirty=true;camera.position.copy(initial).multiplyScalar(Math.max(1,1.35/camera.aspect));focusTarget.set(0,.25,0);controls?.target.copy(focusTarget);controls?.update();}};
   select(selectionRef.current);setError('');
   const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
   onDown=e=>{down={x:e.clientX,y:e.clientY};};
   onUp=e=>{
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||!renderer)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(dish.pickable)[0];if(hit){const index=hit.object.userData.ingredient;chooseRef.current(index===active?-1:index);}
   };
   onLost=e=>{e.preventDefault();setError('The 3D view paused. Ingredient details are still available.');};
   renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('webglcontextlost',onLost);
   observer=new ResizeObserver(()=>{if(!renderer)return;const width=container.clientWidth||360,height=container.clientHeight||390;if(renderer instanceof THREE.WebGLRenderer)renderer.setSize(width,height,false);else renderer.setSize(width,height);camera.aspect=width/height;if(camera.aspect<1.35)camera.position.copy(initial).multiplyScalar(1.35/camera.aspect);camera.updateProjectionMatrix();dirty=true;});observer.observe(container);
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   let lastRender=0;
   function animate(now=0){
    if(disposed)return;
    if(renderer instanceof SVGRenderer&&now-lastRender<140){frame=requestAnimationFrame(animate);return;}lastRender=now;
    if(disposed||!controls||!renderer)return;
    dish.layers.forEach((layer,n)=>{
     target.copy(layer.userData.explode).multiplyScalar(exploded);if(n===active)target.y+=.29;if(layer.position.distanceToSquared(target)>.00001)dirty=true;layer.position.lerp(target,reduced||renderer instanceof SVGRenderer?1:.13);
     layer.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const material=object.material as THREE.MeshStandardMaterial;
      const targetOpacity=active<0||n===active?1:.17;material.transparent=active>=0&&n!==active;if(Math.abs(material.opacity-targetOpacity)>.001)dirty=true;material.opacity=THREE.MathUtils.lerp(material.opacity,targetOpacity,reduced||renderer instanceof SVGRenderer?1:.16);material.depthWrite=!material.transparent;
      material.emissive.set(n===active?'#7e5f29':'#000000');material.emissiveIntensity=n===active?.12:0;
     });
     dish.halos[n].position.copy(dish.halos[n].userData.basePosition).add(layer.position);
    });
    controls.target.lerp(focusTarget,renderer instanceof SVGRenderer?1:.1);controls.update();if(dirty||renderer instanceof THREE.WebGLRenderer){renderer.render(scene,camera);dirty=false;}frame=requestAnimationFrame(animate);
   }animate();return cleanup;
  }catch{setError('Your browser could not open 3D. Select any ingredient to explore its amount and recipe step.');cleanup();}
 },[recipe.id]);
 useEffect(()=>{api.current?.select(selectedIndex);},[selectedIndex,recipe.id]);
 useEffect(()=>{api.current?.spread(spread);},[spread,recipe.id]);
 useEffect(()=>{api.current?.rotate(rotate);},[rotate,recipe.id]);
 return <div className="dish-explorer" style={{'--dish-accent':profile.accent} as CSSProperties}>
  <header className="explorer-heading"><div><span className="explorer-eyebrow"><Layers3 size={13}/> THE DISH, DECONSTRUCTED</span><h3>{profile.kicker}</h3><p>Every ingredient has a part to play. Pick one to see it.</p></div><span className="explorer-count">{recipe.ingredients.length}<small>ingredients</small></span></header>
  <div className="explorer-layout"><div className="explorer-stage">
   <div ref={host} className={'scene-canvas'+(error?' scene-unavailable':'')}/>
   <div className="stage-label" aria-live="polite"><span className="stage-dot"/>{ingredient?<><strong>{ingredient.name}</strong><span>In the spotlight</span></>:<><strong>{recipe.name}</strong><span>All the good stuff, together</span></>}</div>
   <span className="stage-caption">Interactive ingredient illustration</span>
   <div className="stage-actions"><button title={rotate?'Pause rotation':'Rotate the dish'} aria-label={rotate?'Pause rotation':'Rotate the dish'} aria-pressed={rotate} onClick={()=>setRotate(v=>!v)}>{rotate?<Pause size={15}/>:<Play size={15}/>}</button><button title="Reset camera" aria-label="Reset camera" onClick={()=>{setSpread(0);api.current?.reset();}}><RotateCcw size={15}/></button></div>
   {error&&<p className="scene-error" role="status">{error}</p>}
  </div><aside className="explorer-ingredients" aria-label="Spotlight an ingredient">
   <div className="explorer-list-heading"><span>WHAT GOES IN</span><button className={selectedIndex<0?'is-active':''} aria-pressed={selectedIndex<0} onClick={()=>choose(-1)}>Show all</button></div>
   <div className="ingredient-spotlight-list">{recipe.ingredients.map((item,index)=>{const appearance=ingredientAppearance(item.name);return <button key={item.name} className={'ingredient-spotlight'+(index===selectedIndex?' is-selected':'')} aria-pressed={index===selectedIndex} aria-describedby={index===selectedIndex?contextId:undefined} onClick={()=>choose(index===selectedIndex?-1:index)}><span className="ingredient-swatch" style={{background:appearance.color}}/><span className="ingredient-spotlight-name">{item.name}<small>{scaledAmount(item.amount,recipe.servings,servings)} {item.unit}</small></span>{index===selectedIndex?<Focus size={17}/>:<MoveUpRight size={15}/>}</button>;})}</div>
  </aside></div>
  <div className="explorer-context" id={contextId} aria-live="polite">{ingredient&&context?<><span className="context-number">{String(selectedIndex+1).padStart(2,'0')}</span><div><h4>{ingredient.name}<span>{scaledAmount(ingredient.amount,recipe.servings,servings)} {ingredient.unit}</span></h4><p>{context.note}</p><details key={ingredient.name}><summary>{context.step?'Find it in step '+context.step:'How to use it'}</summary><p>{context.instruction}</p></details></div></>:<><span className="context-number"><Focus size={23}/></span><div><h4>A closer look at your next meal</h4><p>Tap an ingredient or a piece of the dish. The selected layer lifts forward while the others fade.</p></div></>}</div>
  <div className="explorer-controls"><label htmlFor={sliderId}><Layers3 size={15}/><span>Separate the layers</span><input id={sliderId} type="range" min="0" max="1" step=".05" value={spread} onChange={e=>setSpread(Number(e.target.value))}/></label><span>Drag to rotate · Pinch to zoom</span></div>
 </div>;
}
