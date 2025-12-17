import { BaseScene } from '../core/BaseScene.js';

// Tema visual consistente con RecorridoScene
const EFEDRA_OVERLAY_THEME = {
  fontKitHref: 'https://use.typekit.net/vmy8ypx.css',
  fonts: {
    family: `"new-science-mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`
  },
  colors: {
    text: '#FFC96A', // Color naranja/dorado principal
    textShadow: 'rgba(0, 0, 0, 0.45)'
  }
};

export class RecorridoTransitionScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'recorrido-transition';
  }

  async mount() {
    // 👇 Limpiar cualquier overlay del menú que haya quedado abierto
    const menuOverlays = document.querySelectorAll('body > div');
    menuOverlays.forEach(overlay => {
      const zIndex = window.getComputedStyle(overlay).zIndex;
      if (zIndex === '10000') {
        console.log('[RecorridoTransitionScene] Removing leftover menu overlay');
        overlay.remove();
      }
    });

    // Cargar fuente de TypeKit
    if (!document.getElementById('efedra-transition-font')) {
      const link = document.createElement('link');
      link.id = 'efedra-transition-font';
      link.rel = 'stylesheet';
      link.href = EFEDRA_OVERLAY_THEME.fontKitHref;
      document.head.appendChild(link);
    }

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
      cursor: pointer;
      pointer-events: auto;
      opacity: 1;
    `;
    document.body.appendChild(overlay);

    

    // Iniciar música de fondo continua
    const backgroundAudio = new Audio('/game-assets/transiciones/Video animacion carpa.mp3');
    backgroundAudio.volume = 1.0;
    backgroundAudio.loop = false;
    backgroundAudio.play().catch(() => { });

    // Variable para controlar si se hace skip
    let skipped = false;

    // Hacer click para skip
    const skipHandler = () => {
      skipped = true;
    };
    overlay.addEventListener('click', skipHandler);

    // Reproducir primer video de transición con texto
    await this.playTransitionVideo(
      overlay,
      '/game-assets/transiciones/secuencia_inicio_recorrido1.webm',
      () => skipped,
      'El espinal cubre la gran parte del territorio entrerriano, llegando a las costas del Delta del Paraná, donde se fusiona con la selva en galería.'
    );

    // Si no se hizo skip, reproducir segundo video con texto
    if (!skipped) {
      await this.playTransitionVideo(
        overlay,
        '/game-assets/transiciones/secuencia_inicio_recorrido2.webm',
        () => skipped,
        'Aquí, en la unión de estos ecosistemas, se pueden encontrar una gran variedad de especies: algunas muy escurridizas, otras que les encanta hacerse ver.'
      );
    }

    // Remover event listener
    overlay.removeEventListener('click', skipHandler);

    // Detener música de fondo
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;

    // Limpiar overlay
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));
    document.body.removeChild(overlay);

    // Restaurar cursor
    document.body.style.cursor = 'auto';

    // Ir a la escena de recorrido
    location.hash = '#recorrido';
  }

  async playTransitionVideo(overlay, videoSrc, isSkipped, textContent = null) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoSrc;
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
      video.muted = true; // Muted para que solo se escuche el audio de fondo
      video.playsInline = true;

      overlay.appendChild(video);

      // Crear overlay de texto si se proporciona contenido
      let textOverlay = null;
      let textEl = null;
      if (textContent) {
        // Calcular altura aproximada basada en el texto
        // Scaling values based on 1700px reference width
        const charsPerLine = 50;
        const lines = Math.ceil(textContent.length / charsPerLine);

        // Use CSS classes defined in `game/index.html` for responsive sizing.
        textOverlay = document.createElement('div');
        textOverlay.className = 'recorrido-transition-text-overlay';
        textOverlay.setAttribute('aria-hidden', 'true');

        textEl = document.createElement('div');
        textEl.className = 'recorrido-transition-text-inner';
        // Keep a content-dependent min-height using the same font-size formula
        // (match CSS: font-size uses clamp(12px, 4vmin, 28px) so use min equivalent)
        textEl.style.minHeight = `calc(${lines} * 1.6 * min(28px, 4vmin))`;

        textOverlay.appendChild(textEl);
        overlay.appendChild(textOverlay);
      }

      // Fade in desde negro
      requestAnimationFrame(() => {
        video.style.opacity = '1';
      });

      // Reproducir video
      video.play();

      // Iniciar efecto typewriter después de 2 segundos
      if (textContent && textOverlay && textEl) {
        setTimeout(() => {
          // Fade in del overlay (make visible via aria attribute so CSS handles opacity)
          textOverlay.setAttribute('aria-hidden', 'false');
          textOverlay.style.opacity = '1';

          // Caracteres para el efecto glitch
          const glitchChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?~`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          const getRandomGlitchChar = () => glitchChars[Math.floor(Math.random() * glitchChars.length)];

          const fullText = textContent;
          
          // Pre-renderizar el texto completo para calcular el layout
          textEl.textContent = fullText;
          textEl.style.visibility = 'hidden';
          textEl.offsetHeight; // Forzar reflow
          
          // Crear spans para cada carácter
          textEl.textContent = '';
          textEl.style.visibility = 'visible';
          textEl.style.whiteSpace = 'pre-wrap'; // Preservar saltos de línea y espacios
          
          const chars = fullText.split('');
          const charSpans = [];
          
          chars.forEach((char) => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.opacity = '0';
            span.style.display = 'inline'; // Forzar inline para evitar espacios extras
            textEl.appendChild(span);
            charSpans.push(span);
          });
          
          // Crear contenedor para caracteres glitch
          const glitchSpan = document.createElement('span');
          glitchSpan.style.opacity = '0.3';
          glitchSpan.style.animation = 'glitch-flicker 0.1s infinite';
          textEl.appendChild(glitchSpan);
          
          let currentIndex = 0;

          const typewriterInterval = setInterval(() => {
            if (currentIndex < charSpans.length) {
              // Revelar el siguiente carácter
              charSpans[currentIndex].style.opacity = '1';
              charSpans[currentIndex].style.transition = 'opacity 0.05s ease-in';
              
              // Actualizar caracteres glitch
              const glitchCount = Math.floor(Math.random() * 3) + 3;
              let glitchText = '';
              for (let i = 0; i < glitchCount; i++) {
                glitchText += getRandomGlitchChar();
              }
              glitchSpan.textContent = glitchText;
              
              currentIndex++;
            } else {
              clearInterval(typewriterInterval);
              glitchSpan.remove(); // Remover los caracteres glitch al final
            }
          }, 25); // 25ms entre cada caracter

          // Agregar CSS para el efecto de parpadeo del glitch
          if (!document.getElementById('glitch-flicker-style')) {
            const style = document.createElement('style');
            style.id = 'glitch-flicker-style';
            style.textContent = `
              @keyframes glitch-flicker {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 0.2; }
              }
            `;
            document.head.appendChild(style);
          }
        }, 2000);
      }

      // Chequear si se hace skip cada frame
      const checkSkip = () => {
        if (isSkipped()) {
          endVideo();
        } else {
          requestAnimationFrame(checkSkip);
        }
      };
      checkSkip();

      const endVideo = () => {
        video.pause();

        setTimeout(() => {
          if (video.parentNode) video.parentNode.removeChild(video);
          if (textOverlay && textOverlay.parentNode) textOverlay.parentNode.removeChild(textOverlay);
          resolve();
        }, 1000); // Esperar a que termine el fade out
      };

      // Monitorear el video para iniciar fade out 1 segundo antes del final
      const monitorVideoEnd = () => {
        if (video.paused || video.ended) return;

        const timeRemaining = video.duration - video.currentTime;

        // Iniciar fade out 1 segundo antes del final
        if (timeRemaining <= 1.0 && video.style.opacity !== '0') {
          video.style.opacity = '0';

          // Fade out del texto también
          if (textOverlay) {
              textOverlay.style.transition = 'opacity 1s';
              textOverlay.setAttribute('aria-hidden', 'true');
              textOverlay.style.opacity = '0';
          }
        }

        if (!video.ended) {
          requestAnimationFrame(monitorVideoEnd);
        }
      };

      // Cuando el video cargue metadata, iniciar monitoreo
      video.addEventListener('loadedmetadata', () => {
        monitorVideoEnd();
      });

      // Cuando termine el video, limpiar
      video.addEventListener('ended', endVideo);
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
