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

        // Use 'fit' behavior: scale so the whole design fits the viewport
        // (no cropping). Allow upscaling when viewport is larger than design.
        const scale = Math.min(scaleX, scaleY);

        // Compute translation to center the scaled content
        const scaledW = this.BASE_WIDTH * scale;
        const scaledH = this.BASE_HEIGHT * scale;
        const left = Math.round((viewportW - scaledW) / 2);
        const top = Math.round((viewportH - scaledH) / 2);

        // Apply translate + scale in a way that yields the desired final
        // pixel translation. Because transform functions compose, when using
        // `translate(...) scale(s)` the translation is applied before the
        // scale and would therefore be multiplied by `s`. To get a final
        // visual translation of `left,top` (in screen pixels) we pre-divide
        // the translation by the scale.
        const preTx = left / Math.max(1e-6, scale);
        const preTy = top / Math.max(1e-6, scale);

        this.root.style.left = '0px';
        this.root.style.top = '0px';
        this.root.style.transform = `translate(${preTx}px, ${preTy}px) scale(${scale})`;
        
        // Convert inline viewport-unit styles to design px so UI scales correctly
        // when the #app element is being uniformly scaled.
        this._convertInlineViewportUnits();

                // Ensure #zocaloVideo is anchored to the canvas top-left in design
                // pixels so it scales/positions relative to the design resolution.
                try {
                    const z = document.getElementById('zocaloVideo');
                    if (z) {
                        // Design-space position/size (px in 1920x1080 design)
                        const DESIGN_ZOCALO_TOP = 20; // design-space top margin
                        const DESIGN_ZOCALO_LEFT = 0;

                        z.style.position = 'absolute';
                        z.style.left = `${DESIGN_ZOCALO_LEFT}px`;
                        z.style.top = `${DESIGN_ZOCALO_TOP}px`;

                        z.style.width = 'auto';
                        // Make sure it sits above the canvas but below transient overlays
                        z.style.zIndex = z.style.zIndex || '5000';
                        // Keep pointer-events as originally intended
                        if (!z.style.pointerEvents) z.style.pointerEvents = 'none';
                    }
                } catch (e) {
                    // no-op if DOM not ready
                }

        if (this._currentScene && this._currentScene.onResize) {
            this._currentScene.onResize(this.BASE_WIDTH, this.BASE_HEIGHT);
        }
    }

    // Convert inline style values that use vw/vh/vmin into px based on the
    // application's design resolution (BASE_WIDTH/BASE_HEIGHT). This keeps
    // UI proportions stable when the #app element is scaled to cover the
    // viewport.
    _convertInlineViewportUnits() {
        const designW = this.BASE_WIDTH;
        const designH = this.BASE_HEIGHT;
        const vwBase = designW / 100; // px per 1vw (design)
        const vhBase = designH / 100; // px per 1vh (design)
        const vminBase = Math.min(designW, designH) / 100; // px per 1vmin (design)

        // Only transform elements inside the app root
        const els = this.root.querySelectorAll('[style]');
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            const styleText = el.getAttribute('style');
            if (!styleText) continue;

            // Replace vw/vh/vmin occurrences with px equivalents based on design
            const updated = styleText
                .replace(/([-+]?\d*\.?\d+)vw/g, (_m, n) => Math.round(parseFloat(n) * vwBase) + 'px')
                .replace(/([-+]?\d*\.?\d+)vh/g, (_m, n) => Math.round(parseFloat(n) * vhBase) + 'px')
                .replace(/([-+]?\d*\.?\d+)vmin/g, (_m, n) => Math.round(parseFloat(n) * vminBase) + 'px');

            if (updated !== styleText) {
                el.setAttribute('style', updated);
            }
        }
    }
}