import {readFile,unlink,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const entries=JSON.parse(await readFile(new URL('./retired-stock-assets.json',import.meta.url),'utf8'));
let removed=0,kept=0;
for(const entry of entries){
 if(!entry.path.startsWith('public/food/')&&!['pancakes.jpg','pasta.jpg','shakshuka.jpg','toast.jpg','salad.jpg'].includes(entry.path))throw Error('Invalid stock cleanup path.');
 const target=path.resolve(root,entry.path);
 if(!target.startsWith(root))throw Error('Invalid stock cleanup path.');
 try{
  const info=await lstat(target);
  if(!info.isFile()||info.isSymbolicLink()){kept++;continue;}
  const bytes=await readFile(target);
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256){kept++;continue;}
  await unlink(target);removed++;
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
console.log('Retired stock photos removed: '+removed+(kept?'; modified/custom files kept: '+kept:''));
