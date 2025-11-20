import * as THREE from 'three';
import { EventBus } from './EventBus.js';

export class App {
    constructor(rootSelector) {
        this.root = document.querySelector(rootSelector);
        if (!this.root) throw new Error('App root not found');

        // Fondo negro en el body
        document.body.style.backgroundColor = '#000';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';

        // Tamaño de referencia
        this.BASE_WIDTH = 1920;
        this.BASE_HEIGHT = 1080;

        // Configurar root para escalar todo su contenido
        this.root.style.position = 'absolute';
        this.root.style.width = this.BASE_WIDTH + 'px';
        this.root.style.height = this.BASE_HEIGHT + 'px';
        this.root.style.transformOrigin = 'top left';
    this.root.style.backgroundColor = '#000';

        // Renderer único para todas las escenas
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(this.BASE_WIDTH, this.BASE_HEIGHT);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.zIndex = '0';
        if (this.root.firstChild) {
            this.root.insertBefore(this.renderer.domElement, this.root.firstChild);
        } else {
            this.root.appendChild(this.renderer.domElement);
        }


        // Loop
        this._running = false;
        this._last = performance.now();
        this._currentScene = null;
    this._paused = false;


        // Resize
    addEventListener('resize', () => this._resize());
    new ResizeObserver(() => this._resize()).observe(document.body);

    // Ajuste inicial
    this._resize();
    }

    get canvas() { return this.renderer.domElement; }


    start() {
        if (this._running) return;
        this._running = true;
        const loop = () => {
            if (!this._running) return;
            const now = performance.now();
            const dt = Math.min((now - this._last) / 1000, 0.05);
            this._last = now;


            if (this._currentScene) {
                if (!this._paused) {
                    this._currentScene.update?.(dt);
                }

                const renderDt = this._paused ? 0 : dt;
                const hasCustomRender = typeof this._currentScene.render === 'function';

                if (hasCustomRender) {
                    this.renderer.autoClear = false;
                    this.renderer.clear();
                    this._currentScene.render(this.renderer, renderDt);
                } else if (this._currentScene.scene && this._currentScene.camera) {
                    this.renderer.autoClear = false;
                    this.renderer.clear();

                    // Render principal
                    this.renderer.render(this._currentScene.scene, this._currentScene.camera);

                    // ✅ Overlay solo si la escena actual es "recorrido"
                    if (
                        this._currentScene.name === 'recorrido' &&
                        this._currentScene.overlayScene &&
                        this._currentScene.overlayCam
                    ) {
                        this.renderer.clearDepth();
                        this.renderer.render(this._currentScene.overlayScene, this._currentScene.overlayCam);
                    }
                }
            }


            requestAnimationFrame(loop);
        };
        loop();

    }


    stop() { this._running = false; }


    pause() {
        if (this._paused) return;
        this._paused = true;
        EventBus.emit('app:paused');
    }


    resume() {
        if (!this._paused) return;
        this._paused = false;
        this._last = performance.now();
        EventBus.emit('app:resumed');
    }


    togglePause() {
        if (this._paused) {
            this.resume();
        } else {
            this.pause();
        }
    }


    get paused() {
        return this._paused;
    }


    async setScene(scene) {
        console.log(`[App] Setting scene from ${this._currentScene?.name || 'null'} to ${scene?.name || scene?.constructor?.name || 'unknown'}`);
        if (this._currentScene) {
            console.log(`[App] Unmounting current scene ${this._currentScene.name}`);
            await this._currentScene.unmount?.();
            console.log(`[App] Unmounted current scene`);
            this._currentScene = null;
        }
        this._currentScene = scene;
        console.log(`[App] Mounting new scene ${scene?.name || scene?.constructor?.name}`);
        await this._currentScene.mount?.();
        console.log(`[App] Mounted new scene`);
        this._resize();
        EventBus.emit('scene:changed', { name: scene?.name || scene?.constructor?.name });
    }


    _resize() {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // Calcular escala para mantener proporciones
        const scaleX = viewportW / this.BASE_WIDTH;
        const scaleY = viewportH / this.BASE_HEIGHT;
        const scale = Math.min(scaleX, scaleY, 1); // No escalar hacia arriba

        // Escalar todo el root (canvas + UI HTML)
        this.root.style.transform = `scale(${scale})`;

        // Centrar el contenido escalado
        const scaledW = this.BASE_WIDTH * scale;
        const scaledH = this.BASE_HEIGHT * scale;
        this.root.style.left = ((viewportW - scaledW) / 2) + 'px';
        this.root.style.top = ((viewportH - scaledH) / 2) + 'px';
        
        if (this._currentScene && this._currentScene.onResize) {
            this._currentScene.onResize(this.BASE_WIDTH, this.BASE_HEIGHT);
        }
    }
}