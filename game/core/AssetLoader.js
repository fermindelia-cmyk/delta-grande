import * as THREE from 'three';

export const AssetLoader = {
  texture(url) {
    // Los assets están en caché HTTP, cargar normalmente
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(url, (tex) => { 
        tex.colorSpace = THREE.SRGBColorSpace; 
        resolve(tex); 
      }, undefined, reject);
    });
  },
  
  audio(url) {
    // Cargar desde caché HTTP del navegador con precarga forzada
    const a = new Audio(url);
    a.preload = 'auto';
    // Forzar descarga completa
    a.load();
    return a;
  },
  
  audioBuffer(url) {
    return new Promise(async (resolve, reject) => {
      const { AudioLoader } = await import('three');
      const loader = new AudioLoader();
      loader.load(url, resolve, undefined, reject);
    });
  },
  
  async gltf(url) {
    // Cargar desde caché HTTP del navegador
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  },
  
  video(url) {
    // Cargar desde caché HTTP del navegador con precarga completa
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      
      const handleLoad = () => {
        video.removeEventListener('canplaythrough', handleLoad);
        video.removeEventListener('error', handleError);
        resolve(video);
      };
      
      const handleError = () => {
        video.removeEventListener('canplaythrough', handleLoad);
        video.removeEventListener('error', handleError);
        reject(new Error(`Failed to load video: ${url}`));
      };
      
      video.addEventListener('canplaythrough', handleLoad);
      video.addEventListener('error', handleError);
      video.src = url;
      // Forzar inicio de descarga
      video.load();
    });
  }
};