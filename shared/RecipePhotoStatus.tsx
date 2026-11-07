import {useEffect,useRef,useState} from 'react';
import {ImagePlus,LoaderCircle,RotateCcw} from 'lucide-react';
import {recipeVisualKey} from './recipe-visuals.mjs';
type Recipe={id:string;name:string;description?:string;servings:number;image:string;imageGenerated?:boolean;ingredients:{name:string;amount:number;unit:string}[];steps?:string[]};
type PhotoState={status:string;image?:string;generated?:boolean;message?:string;canGenerate?:boolean;retryAfter?:number};
export default function RecipePhotoStatus({recipe,onImageReady}:{recipe:Recipe;onImageReady:()=>Promise<void>}){
 const [state,setState]=useState<PhotoState>({status:'checking'}),[attempt,setAttempt]=useState(0),[remaining,setRemaining]=useState(0);
 const ready=useRef(onImageReady),currentImage=useRef(recipe.image);ready.current=onImageReady;currentImage.current=recipe.image;
 const revision=recipeVisualKey(recipe);
 useEffect(()=>{
  let cancelled=false,timer:ReturnType<typeof setTimeout>,failures=0,lastImage='';const controller=new AbortController(),started=Date.now();
  const endpoint='/api/recipes/'+encodeURIComponent(recipe.id)+'/photo';setState({status:'checking'});
  async function request(method='GET'):Promise<PhotoState>{
   const response=await fetch(endpoint,{method,signal:controller.signal,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
   const data=await response.json();
   if(!response.ok&&!data.status)return {status:response.status===429?'limited':'error',message:data.error||'Could not check this recipe photo.',retryAfter:response.status===429?60:0};
   return data as PhotoState;
  }
  async function check(startIfMissing=false){
   try{
    let data=await request();if(cancelled)return;
    if(startIfMissing&&data.status==='missing'&&data.canGenerate){setState({status:'queued',message:'Creating a photo for '+recipe.name+'…'});data=await request('POST');}
    if(cancelled)return;failures=0;setState(data);
    if(data.status==='ready'&&data.image&&data.image!==currentImage.current&&data.image!==lastImage){await ready.current();lastImage=data.image;}
    if(['queued','running'].includes(data.status)){
     if(Date.now()-started>12*60000){setState({status:'paused',message:'The photo is still being created. Check again in a moment.'});return;}
     timer=setTimeout(()=>void check(),3500);
    }
   }catch(error:any){
    if(cancelled||error.name==='AbortError')return;
    if(++failures<4)timer=setTimeout(()=>void check(),4000);
    else setState({status:'error',message:'Could not reach the photo service. You can still use the recipe.'});
   }
  }
  void check(true);return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
 },[recipe.id,revision,attempt]);
 useEffect(()=>{
  setRemaining(state.retryAfter||0);if(!state.retryAfter)return;
  const interval=setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);return()=>clearInterval(interval);
 },[state.retryAfter,state.status]);
 if(state.status==='ready')return null;
 const pending=['checking','queued','running'].includes(state.status);
 const message=state.status==='checking'?'Checking this recipe’s AI photo…':state.status==='queued'?'Your recipe photo is queued. It will appear here when ready.':state.status==='running'?'AI is creating a photo of '+recipe.name+'…':state.message||'This recipe’s photo is not available yet.';
 return <div className={'recipe-photo-status'+(pending?' is-generating':'')} role="status" aria-live="polite">{pending?<LoaderCircle size={15} className="spin"/>:<ImagePlus size={15}/>}<span>{message}</span>{!pending&&state.status!=='offline'&&<button onClick={()=>setAttempt(value=>value+1)} disabled={remaining>0}><RotateCcw size={12}/>{remaining>0?'Try later':state.status==='paused'?'Check photo':'Try again'}</button>}</div>;
}
