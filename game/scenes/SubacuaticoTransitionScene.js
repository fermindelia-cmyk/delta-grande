import { BaseScene } from '../core/BaseScene.js';

export class SubacuaticoTransitionScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'subacuatico-transition';
  }

  async mount() {
    // Ocultar el canvas 3D
    this.app.canvas.style.display = 'none';

    // Ocultar cursor durante la transición
    document.body.style.cursor = 'none';
    
    // Crear overlay para el video de transición
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: black;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
    `;
    document.body.appendChild(overlay);

    // Reproducir video de transición
    await this.playTransitionVideo(overlay);

    // Limpiar overlay
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));
    document.body.removeChild(overlay);
    
    // Restaurar cursor
    document.body.style.cursor = 'auto';

    // Ir a la escena subacuática
    location.hash = '#sub';
  }

  async playTransitionVideo(overlay) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = '/game-assets/transiciones/lab-a-subacua.webm';
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        pointer-events: none;
        position: absolute;
        inset: 0;
        transition: opacity 1s ease-in-out;
      `;
      video.muted = false;
      video.playsInline = true;

      overlay.appendChild(video);

      // Fade in desde negro
      requestAnimationFrame(() => {
        video.style.opacity = '1';
      });

      // Reproducir video
      video.play().catch((err) => {
        console.warn('[SubacuaticoTransitionScene] Error playing video:', err);
      });

      // Cuando termine el video, hacer fade out
      video.addEventListener('ended', () => {
        // Fade out a negro
        video.style.opacity = '0';
        
        setTimeout(() => {
          if (video.parentNode) video.parentNode.removeChild(video);
          resolve();
        }, 1000); // Esperar a que termine el fade out
      });
    });
  }

  async unmount() {
    // Restaurar canvas
    this.app.canvas.style.display = '';
    document.body.style.cursor = 'auto';
  }

  update(dt) {
    // No se necesita nada en el loop
  }

  render(renderer, dt) {
    // No renderizar nada (solo video en overlay)
  }
}
