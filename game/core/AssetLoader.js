import * as THREE from 'three';
import { resolvePublicPath } from './paths.js';


export const AssetLoader = {
texture(url){
const resolved = resolvePublicPath(url);
return new Promise((resolve, reject) => {
const loader = new THREE.TextureLoader();
loader.load(resolved, (tex)=>{ tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); }, undefined, reject);
});
},
audio(url){
// Devuelve un HTMLAudioElement listo para usar
const a = new Audio(resolvePublicPath(url));
a.preload = 'auto';
return a;
},
audioBuffer(url){
  const resolved = resolvePublicPath(url);
  return new Promise(async (resolve, reject) => {
    const { AudioLoader } = await import('three');
    const loader = new AudioLoader();
    loader.load(resolved, resolve, undefined, reject);
  });
},
async gltf(url){
const resolved = resolvePublicPath(url);
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const loader = new GLTFLoader();
return new Promise((resolve, reject)=> loader.load(resolved, resolve, undefined, reject));
}
};