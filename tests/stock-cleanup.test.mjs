import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=value=>createHash('sha256').update(value).digest('hex');
async function fixture(){const root=await mkdtemp(path.join(tmpdir(),'simmer-stock-test-'));await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'public/food'),{recursive:true});await copyFile(new URL('../scripts/remove-stock-photos.mjs',import.meta.url),path.join(root,'scripts/remove-stock-photos.mjs'));return root;}
test('deployment cleanup removes known stock files and keeps modified user files',async()=>{
 const root=await fixture();try{
  await writeFile(path.join(root,'shakshuka.jpg'),'legacy hero fixture');await writeFile(path.join(root,'public/food/old.jpg'),'original stock fixture');await writeFile(path.join(root,'public/food/custom.jpg'),'a user replacement');
  await writeFile(path.join(root,'scripts/retired-stock-assets.json'),JSON.stringify([{path:'shakshuka.jpg',sha256:hash('legacy hero fixture')},{path:'public/food/old.jpg',sha256:hash('original stock fixture')},{path:'public/food/custom.jpg',sha256:hash('different original fixture')} ]));
  const result=spawnSync(process.execPath,['scripts/remove-stock-photos.mjs'],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);await assert.rejects(()=>readFile(path.join(root,'shakshuka.jpg')),e=>e.code==='ENOENT');await assert.rejects(()=>readFile(path.join(root,'public/food/old.jpg')),e=>e.code==='ENOENT');assert.equal(await readFile(path.join(root,'public/food/custom.jpg'),'utf8'),'a user replacement');
  const second=spawnSync(process.execPath,['scripts/remove-stock-photos.mjs'],{cwd:root,encoding:'utf8'});assert.equal(second.status,0);assert.match(second.stdout,/removed: 0/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('cleanup rejects a manifest path outside its known stock directories',async()=>{
 const root=await fixture();try{await writeFile(path.join(root,'keep.txt'),'keep this');await writeFile(path.join(root,'scripts/retired-stock-assets.json'),JSON.stringify([{path:'keep.txt',sha256:hash('keep this')}]));const result=spawnSync(process.execPath,['scripts/remove-stock-photos.mjs'],{cwd:root,encoding:'utf8'});assert.notEqual(result.status,0);assert.equal(await readFile(path.join(root,'keep.txt'),'utf8'),'keep this');}finally{await rm(root,{recursive:true,force:true});}
});
