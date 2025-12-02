import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { State } from '../core/State.js';
import { Save } from '../core/Save.js';

export class MenuScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'menu';
  }

  async mount() {
    // 👇 Ocultar overlays de recorrido (solo para RecorridoScene)
    const mapOverlay = document.querySelector('.map-overlay');
    const metadataOverlay = document.querySelector('.metadata-overlay');
    const zocaloVideo = document.getElementById('zocaloVideo');
    const inventoryCanvas = document.getElementById('inventoryCanvas');
    if (mapOverlay) mapOverlay.style.display = 'none';
    if (metadataOverlay) metadataOverlay.style.display = 'none';
    if (inventoryCanvas) inventoryCanvas.style.display = 'none';
    if (zocaloVideo) {
      zocaloVideo.style.opacity = '0';
      zocaloVideo.style.display = 'none';
      zocaloVideo.pause();
      zocaloVideo.src = '';
    }

    // Cargar fuente de Adobe Typekit
    this.ensureMenuFont();
    
    // Ocultar el canvas 3D
    this.app.canvas.style.display = 'none';

    // Ocultar cursor durante las cinemáticas
    document.body.style.cursor = 'none';
    
    // Crear overlay persistente para los videos
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: black;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: none;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    // Mostrar botón de inicio cada vez que se entra a la página del menú
    await this.showStartButton(overlay);

    // Delay inicial de medio segundo
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reproducir video del logo naranja con audio (skippeable)
    const introSkipped = await this.playIntroVideo(overlay, '/game-assets/menu/cinematicas/logo_naranja.webm', true, false, '/game-assets/menu/cinematicas/logo delta mas vf2.mp3', 1.0);

    // Mostrar menú principal con botones
    const menuAction = await this.showMainMenu(overlay);

    // Limpiar overlay
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));
    document.body.removeChild(overlay);
    
    // Restaurar cursor
    document.body.style.cursor = 'auto';

    // Ejecutar acción del menú
    if (menuAction === 'recorrido') {
      // Iniciar recorrido con instrucciones
      location.hash = '#instrucciones-transition';
    } else if (menuAction === 'subacuatica') {
      // Llevar a la misión subacuática
      location.hash = '#rio';
    } else if (menuAction === 'simulador') {
      // Entrar al simulador interactivo
      location.hash = '#simulador';
    }
    
  }

  async showStartButton(overlay) {
    return new Promise((resolve) => {
      overlay.style.pointerEvents = 'auto';
      overlay.style.cursor = 'auto';
      
      const button = document.createElement('button');
      button.textContent = 'INICIAR';
      button.style.cssText = `
        /* Responsive sizing: font and width adapt to viewport */
        padding: 18px 24px;
        font-size: clamp(20px, 6vw, 36px);
        font-weight: bold;
        font-family: "new-science-mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        background: transparent;
        color: white;
        border: 3px solid white;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        transition: all 0.3s ease;
        animation: pulse 2s infinite;
        /* Make sure the button never overflows on small screens */
        width: clamp(180px, 70vw, 520px);
        max-width: 90vw;
        box-sizing: border-box;
        white-space: normal; /* allow text to wrap if needed */
        text-align: center;
      `;
      
      // Animación de pulso
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `;
      document.head.appendChild(style);
      
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.style.animation = 'none';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.background = 'transparent';
        button.style.animation = 'pulse 2s infinite';
      });
      
      button.addEventListener('click', () => {
        button.style.transition = 'opacity 0.5s';
        button.style.opacity = '0';
        setTimeout(() => {
          button.remove();
          style.remove();
          overlay.style.pointerEvents = 'none';
          overlay.style.cursor = 'none';
          resolve();
        }, 500);
      });
      
      overlay.appendChild(button);
    });
  }

  async showLogoFlash(overlay, videoSrc, holdDuration, fadeOutDuration) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoSrc;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 1;
        pointer-events: none;
        z-index: 10001;
        position: absolute;
        inset: 0;
      `;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.playbackRate = 2.0;

      overlay.appendChild(video);

      video.play().then(() => {
        // Mantener el logo visible, luego hacer fadeout lento
        setTimeout(() => {
          video.style.transition = `opacity ${fadeOutDuration / 1000}s ease-out`;
          video.style.opacity = '0';
          
          // Remover después del fadeout
          setTimeout(() => {
            overlay.removeChild(video);
            resolve();
          }, fadeOutDuration);
        }, holdDuration);
      });
    });
  }

  async playIntroVideo(overlay, videoSrc, skippeable = false, withFades = false, audioSrc = null, audioVolume = 1.0) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoSrc;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: ${withFades ? '0' : '1'};
        pointer-events: auto;
        position: absolute;
        top: 0;
        left: 0;
        z-index: ${withFades ? '1' : '2'};
      `;
      video.muted = !audioSrc;
      video.playsInline = true;

      overlay.appendChild(video);

      // Audio sincronizado si se proporciona
      let audio = null;
      if (audioSrc) {
        audio = new Audio(audioSrc);
        audio.volume = audioVolume;
      }

      // Permitir saltear el video con clic si skippeable
      const skipVideo = (e) => {
        if (skippeable) {
          e.stopPropagation();
          // Al saltar el video, conservar la reproducción del audio.
          // Solo detener y remover el video.
          try {
            video.pause();
            video.currentTime = 0;
          } catch (err) {}
          if (video.parentNode) video.parentNode.removeChild(video);
          video.removeEventListener('click', skipVideo);
          resolve(true); // Indica que fue skipped
        }
      };
      
      if (skippeable) {
        video.addEventListener('click', skipVideo);
      }

      // Fade in del negro a video (3 segundos) solo si withFades
      video.play().then(() => {
        if (audio) audio.play().catch(() => {});
        
        if (withFades) {
          video.style.transition = 'opacity 3s ease-in';
          video.style.opacity = '1';
        }
      });

      // Calcular cuándo hacer fade out (últimos 3 segundos) solo si withFades
      if (withFades) {
        video.addEventListener('loadedmetadata', () => {
          const fadeOutTime = Math.max(0, video.duration - 3);
          
          const checkTime = () => {
            if (video.currentTime >= fadeOutTime) {
              video.style.transition = 'opacity 3s ease-out';
              video.style.opacity = '0';
            }
          };
          
          video.addEventListener('timeupdate', checkTime);
        });
      }

      // Cuando termine el video, limpiar
      video.addEventListener('ended', () => {
        // No pausar el audio aquí para que la canción pueda continuar
        // hasta su final independiente de la duración del video.
        // Remover el video después de un breve delay
        setTimeout(() => {
          if (video.parentNode) video.parentNode.removeChild(video);
        }, 50);
        video.removeEventListener('click', skipVideo);
        resolve(false); // Indica que terminó normalmente
      });
    });
  }

  async showMainMenu(overlay) {
    return new Promise((resolve) => {
      // Preparar overlay para el menú
      overlay.style.background = 'black';
      overlay.style.pointerEvents = 'auto';
      overlay.style.cursor = 'auto';
      
      // Crear wrapper del menú que permitirá escalar el contenido
      const menuWrapper = document.createElement('div');
      menuWrapper.style.cssText = `
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      `;

      // Contenedor interno que realmente alberga el menú (este será escalado)
      const menuContainer = document.createElement('div');
      menuContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
        position: relative;
        transform-origin: center center;
        transition: transform 200ms ease;
      `;
      
      // Logo naranja en loop arriba del menú
      const logoVideo = document.createElement('video');
      logoVideo.src = '/game-assets/menu/logo_naranja_alpha.webm';
      logoVideo.style.cssText = `
        width: 600px;
        height: auto;
        object-fit: cover;
        margin-bottom: 20px;
      `;
      logoVideo.muted = true;
      logoVideo.playsInline = true;
      logoVideo.loop = true;
      logoVideo.play().catch(() => {});
      
      // Función para crear botones
      const createButton = (text, action) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
          padding: 20px 80px;
          font-size: 28px;
          font-weight: bold;
          font-family: "new-science-mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
          background: transparent;
          color: white;
          border: 2px solid white;
          border-radius: 8px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 2px;
          transition: all 0.3s ease;
          /* Responsive width: clamp(min, preferred, max) */
          width: clamp(220px, 40vw, 420px);
          max-width: 90vw;
        `;
        
        // Efectos hover
        button.addEventListener('mouseenter', () => {
          button.style.transform = 'scale(1.05)';
          button.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.transform = 'scale(1)';
          button.style.background = 'transparent';
        });
        
        // Click del botón
        button.addEventListener('click', () => {
          logoVideo.pause();
          // Limpiar listener y wrapper para evitar fugas
          try {
            if (this && this._menuResizeHandler) {
              window.removeEventListener('resize', this._menuResizeHandler);
            }
          } catch (e) {}
          if (menuWrapper && menuWrapper.parentNode) menuWrapper.parentNode.removeChild(menuWrapper);
          if (this) {
            this._menuResizeHandler = null;
            this._menuWrapper = null;
            this._menuContainer = null;
          }
          resolve(action);
        });
        
        return button;
      };
      
      // Crear los tres botones
      const recorridoBtn = createButton('INICIAR RECORRIDO', 'recorrido');
      const subacuaticaBtn = createButton('MISIÓN SUBACUÁTICA', 'subacuatica');
      const simuladorBtn = createButton('SIMULADOR', 'simulador');
      
      // Botón de borrar progreso en la esquina
      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'BORRAR PROGRESO';
      resetBtn.style.cssText = `
        position: absolute;
        bottom: 30px;
        right: 30px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: bold;
        font-family: "new-science-mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        background: transparent;
        color: rgba(255, 100, 100, 0.8);
        border: 2px solid rgba(255, 100, 100, 0.8);
        border-radius: 6px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.3s ease;
      `;
      
      resetBtn.addEventListener('mouseenter', () => {
        resetBtn.style.transform = 'scale(1.05)';
        resetBtn.style.background = 'rgba(255, 100, 100, 0.15)';
        resetBtn.style.color = 'rgb(255, 100, 100)';
        resetBtn.style.borderColor = 'rgb(255, 100, 100)';
      });
      
      resetBtn.addEventListener('mouseleave', () => {
        resetBtn.style.transform = 'scale(1)';
        resetBtn.style.background = 'transparent';
        resetBtn.style.color = 'rgba(255, 100, 100, 0.8)';
        resetBtn.style.borderColor = 'rgba(255, 100, 100, 0.8)';
      });
      
      resetBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todo el progreso?')) {
          State.resetProgress();
          localStorage.removeItem('deltaPlus.speciesProgress.v1');
          console.log('🗑️ Todo el progreso ha sido borrado del localStorage');
          alert('Progreso borrado exitosamente');
        }
      });
      
      // Agregar logo y botones al contenedor escalable
      menuContainer.appendChild(logoVideo);
      menuContainer.appendChild(recorridoBtn);
      menuContainer.appendChild(subacuaticaBtn);
      menuContainer.appendChild(simuladorBtn);
      // Colocar el botón de reset fuera del contenedor escalable, en el wrapper
      // para que permanezca en la esquina del viewport y no sea afectado por el scale.
      menuWrapper.appendChild(resetBtn);

      // Insertar en el wrapper y luego en el overlay
      menuWrapper.appendChild(menuContainer);
      overlay.appendChild(menuWrapper);

      // --- Responsive scaling logic ---
      // Escala el menú hacia abajo cuando el aspect ratio es menor que 16:9
      // Use a base design resolution and scale down if either width or height
      // is smaller than the base. This avoids cropping on very wide but short screens.
      const BASE_WIDTH = 1920;
      const BASE_HEIGHT = 1080;
      const MIN_SCALE = 0.5;

      const updateMenuScale = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // scale factors relative to base dimensions
        const scaleW = w / BASE_WIDTH;
        const scaleH = h / BASE_HEIGHT;
        // pick the smallest (so we never overflow either dimension) but never > 1
        let scale = Math.min(1, scaleW, scaleH);
        if (scale < MIN_SCALE) scale = MIN_SCALE;
        menuContainer.style.transform = `scale(${scale})`;
      };

      // Guarda referencia para limpieza posterior
      this._menuResizeHandler = updateMenuScale;
      this._menuWrapper = menuWrapper;
      this._menuContainer = menuContainer;

      window.addEventListener('resize', this._menuResizeHandler);
      // Ejecutar inicialmente para ajustar al tamaño actual
      updateMenuScale();
    });
  }

  ensureMenuFont() {
    // Cargar fuente de Adobe Typekit si no está cargada
    const fontLinkId = 'menu-font-kit';
    if (!document.getElementById(fontLinkId)) {
      const link = document.createElement('link');
      link.id = fontLinkId;
      link.rel = 'stylesheet';
      link.href = 'https://use.typekit.net/vmy8ypx.css';
      document.head.appendChild(link);
    }
  }

  async unmount() {
    // Restaurar canvas
    this.app.canvas.style.display = '';
    document.body.style.cursor = 'auto';
    
    // Limpiar listener de resize si existe
    if (this._menuResizeHandler) {
      try {
        window.removeEventListener('resize', this._menuResizeHandler);
      } catch (e) {}
      this._menuResizeHandler = null;
    }

    // Remover wrapper del menú si quedó en el DOM
    if (this._menuWrapper && this._menuWrapper.parentNode) {
      this._menuWrapper.parentNode.removeChild(this._menuWrapper);
      this._menuWrapper = null;
      this._menuContainer = null;
    }

    // Limpiar cualquier overlay del menú que pueda haber quedado (fallback)
    const overlays = document.querySelectorAll('body > div');
    overlays.forEach(overlay => {
      // Solo eliminar overlays con z-index 10000 que son del menú
      const zIndex = window.getComputedStyle(overlay).zIndex;
      if (zIndex === '10000') {
        overlay.remove();
      }
    });
  }

  update(dt) {
    // No se necesita nada en el loop
  }

  render(renderer, dt) {
    // No renderizar nada (solo videos en overlay)
  }
}
