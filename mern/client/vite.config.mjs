import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
// Shared source sits outside the client directory; resolve its UI libraries
// from the client's installation rather than requiring root dependencies.
const pkg=name=>path.dirname(require.resolve(name+'/package.json'));
export default defineConfig({plugins:[react()],publicDir:'../../public',resolve:{alias:{'three/addons':path.resolve(path.dirname(require.resolve('three')),'../examples/jsm'),three:path.resolve(path.dirname(require.resolve('three')),'three.module.js'),'react-dom':pkg('react-dom'),react:pkg('react'),'lucide-react':pkg('lucide-react')}},css:{postcss:{plugins:[]}},server:{host:'localhost',allowedHosts:['terminal.local'],port:5173,strictPort:true,fs:{allow:['../..']},proxy:{'/api':'http://127.0.0.1:3001'}}});
