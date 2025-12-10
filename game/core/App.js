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

        // Tamaño de referencia (mantener por compatibilidad interna)
        this.BASE_WIDTH = 1920;
        this.BASE_HEIGHT = 1080;

        // Render buffer maximum logical size (CSS pixels). If viewport is larger,
        // the canvas will be upscaled via CSS, keeping the internal resolution
        // limited to this size to save GPU/CPU.
        this.MAX_RENDER_WIDTH = 1600;
        this.MAX_RENDER_HEIGHT = 900;

        // Configurar root para ocupar todo el viewport
        this.root.style.position = 'fixed';
        this.root.style.left = '0';
        this.root.style.top = '0';
        this.root.style.width = '100vw';
        this.root.style.height = '100vh';
        this.root.style.transformOrigin = 'top left';
    this.root.style.backgroundColor = '#000';

        // Renderer único para todas las escenas
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.zIndex = '0';
        
        this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn('WebGL Context Lost');
        });

        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL Context Restored');
            // Reloading the page is often the safest way to recover state
            window.location.reload();
        });

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

        this.root.style.width = viewportW + 'px';
        this.root.style.height = viewportH + 'px';
        this.root.style.left = '0px';
        this.root.style.top = '0px';
        this.root.style.transform = 'none';

        // Compute the logical render size we will actually draw into (CSS pixels),
        // capped at the configured maximums. If the viewport is larger, the
        // canvas will be upscaled via CSS to fill the viewport.
        const renderLogicalW = Math.min(viewportW, this.MAX_RENDER_WIDTH);
        const renderLogicalH = Math.min(viewportH, this.MAX_RENDER_HEIGHT);

        // Pixel ratio used for backing buffer. Limit to 2 to avoid excessive sizes.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(pixelRatio);

        const bufferW = Math.max(1, Math.round(renderLogicalW * pixelRatio));
        const bufferH = Math.max(1, Math.round(renderLogicalH * pixelRatio));

        // Set the internal drawing buffer size but do NOT update the canvas DOM
        // style (third param `updateStyle` = false). We'll scale the canvas with CSS
        // so it visually occupies the full viewport while keeping a capped resolution.
        this.renderer.setSize(bufferW, bufferH, false);

        // Ensure the canvas is visually sized to the viewport (CSS pixels)
        this.renderer.domElement.style.width = viewportW + 'px';
        this.renderer.domElement.style.height = viewportH + 'px';

        if (this._currentScene && this._currentScene.onResize) {
            this._currentScene.onResize(viewportW, viewportH);
        }
    }
}