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

export class InstruccionesTransitionScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'instrucciones-transition';
  }

  async mount() {
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

    // Calcular escala responsive basada en 1920x1080
    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 1080;
    const getScale = () => {
      const scaleX = window.innerWidth / BASE_WIDTH;
      const scaleY = window.innerHeight / BASE_HEIGHT;
      return Math.min(scaleX, scaleY);
    };
    this.scale = getScale();
    
    // Actualizar escala en resize
    this.resizeHandler = () => {
      this.scale = getScale();
      if (this.textContainer) {
        this.textContainer.style.transform = `scale(${this.scale})`;
      }
      if (this.logo) {
        this.logo.style.transform = `translateX(-50%) scale(${this.scale})`;
      }
      if (this.clickIndicator) {
        this.clickIndicator.style.transform = `translateX(-50%) scale(${this.scale})`;
      }
      if (this.skipButton) {
        this.skipButton.style.transform = `scale(${this.scale})`;
      }
    };
    window.addEventListener('resize', this.resizeHandler);
    
    // Crear overlay con video de fondo
    const overlay = document.createElement('div');
    // clase para estilos específicos del overlay de instrucciones
    overlay.className = 'efedra-instrucciones-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      opacity: 1;
      overflow: hidden;
    `;
    document.body.appendChild(overlay);

    // Video de fondo
    const bgVideo = document.createElement('video');
    bgVideo.src = '../assets/web-bgs/web-bg01.webm';
    // Use CSS to control layout so we don't rely on inline styles here.
    bgVideo.className = 'efedra-instrucciones-video';
    bgVideo.muted = true;
    bgVideo.playsInline = true;
    bgVideo.loop = true;
    bgVideo.autoplay = true;
    overlay.appendChild(bgVideo);
    // Responsive behavior for wide viewports is provided via global CSS
    // in `game/index.html` (class: .efedra-instrucciones-overlay)
    
    // Reproducir video de fondo
    bgVideo.play().catch((err) => {
      console.warn('No se pudo reproducir video de fondo:', err);
    });

    // Mostrar texto con efecto typewriter
    await this.showTypewriterText(overlay);

    // Limpiar overlay
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    
    // Restaurar cursor
    document.body.style.cursor = 'auto';

    // Ir a la transición del recorrido
    location.hash = '#recorrido-transition';
  }

  async showTypewriterText(overlay) {
    const lines = [
      'Tu rol',
      'Sos aprendiz de guardaparques.',
      'Tu misión es explorar un ecosistema del Delta del Paraná\ny descubrir su biodiversidad.',
      'Tu herramienta principal: la curiosidad\ny la capacidad de observación.',
      'Agudizá los sentidos,\nla naturaleza se muestra a quien sabe observar.',
      'Usá tu silencio: la naturaleza habla bajito.'
    ];

    const textContainer = document.createElement('div');
    this.textContainer = textContainer;
    textContainer.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 10%;
      z-index: 10002;
      opacity: 0;
      transition: opacity 0.8s ease-in-out;
      transform: scale(${this.scale});
      transform-origin: center center;
    `;
    overlay.appendChild(textContainer);

    // Logo arriba
    const logo = document.createElement('video');
    this.logo = logo;
    logo.src = '../game-assets/recorrido/interfaz/logo_naranja_alpha.webm';
    logo.style.cssText = `
      position: absolute;
      top: 8%;
      left: 50%;
      transform: translateX(-50%) scale(${this.scale});
      transform-origin: center center;
      width: 200px;
      height: auto;
      z-index: 10003;
      opacity: 0;
      transition: opacity 0.8s ease-in-out;
    `;
    logo.muted = true;
    logo.playsInline = true;
    logo.loop = true;
    overlay.appendChild(logo);

    // Reproducir logo
    logo.play().catch(() => {});
    requestAnimationFrame(() => {
      logo.style.opacity = '1';
    });

    // Botón de saltear
    const skipButton = document.createElement('button');
    this.skipButton = skipButton;
    skipButton.textContent = 'SALTEAR';
    skipButton.style.cssText = `
      position: absolute;
      top: 5%;
      right: 5%;
      transform: scale(${this.scale});
      transform-origin: top right;
      padding: 12px 24px;
      background: rgba(255, 201, 106, 0.15);
      border: 2px solid ${EFEDRA_OVERLAY_THEME.colors.text};
      color: ${EFEDRA_OVERLAY_THEME.colors.text};
      font-family: ${EFEDRA_OVERLAY_THEME.fonts.family};
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 0.08em;
      cursor: pointer;
      z-index: 10004;
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: auto;
      text-shadow: 0 0 14px ${EFEDRA_OVERLAY_THEME.colors.textShadow};
    `;
    overlay.appendChild(skipButton);

    // Hover effect para el botón
    skipButton.addEventListener('mouseenter', () => {
      skipButton.style.background = `rgba(255, 201, 106, 0.35)`;
      skipButton.style.transform = `scale(${this.scale * 1.05})`;
    });
    skipButton.addEventListener('mouseleave', () => {
      skipButton.style.background = `rgba(255, 201, 106, 0.15)`;
      skipButton.style.transform = `scale(${this.scale})`;
    });

    // Variable para controlar si se saltea
    this.skipRequested = false;

    // Handler para el botón de saltear - ir directo a recorrido
    skipButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skipRequested = true;
      
      // Limpiar elementos y ir directo al recorrido
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        document.body.style.cursor = 'auto';
        location.hash = '#recorrido-transition';
      }, 300);
    });

    // Indicador de click
    const clickIndicator = document.createElement('div');
    this.clickIndicator = clickIndicator;
    clickIndicator.className = 'efedra-click-indicator';
    clickIndicator.style.cssText = `
      position: absolute;
      bottom: 12%;
      left: 50%;
      transform: translateX(-50%) scale(${this.scale});
      transform-origin: center center;
      color: ${EFEDRA_OVERLAY_THEME.colors.text};
      font-family: ${EFEDRA_OVERLAY_THEME.fonts.family};
      font-size: 0.95em;
      text-align: center;
      text-shadow: 0 0 14px ${EFEDRA_OVERLAY_THEME.colors.textShadow};
      z-index: 10003;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    `;
    clickIndicator.innerHTML = `
      <span style="display:inline-block; letter-spacing:0.04em;">Click para continuar</span>
      <div class="efedra-ripple r1" style="position:absolute; left:50%; transform:translateX(-50%); width:64px; height:64px; border-radius:50%; border:1px solid ${EFEDRA_OVERLAY_THEME.colors.text}; opacity:.25; top:-28px;"></div>
      <div class="efedra-ripple r2" style="position:absolute; left:50%; transform:translateX(-50%); width:64px; height:64px; border-radius:50%; border:1px solid ${EFEDRA_OVERLAY_THEME.colors.text}; opacity:.25; top:-28px;"></div>
    `;
    overlay.appendChild(clickIndicator);

    // Agregar animación de pulso
    const style = document.createElement('style');
    style.textContent = `
      /* Indicador con ondas/ripples */
      @keyframes clickFloat {
        0%,100% { transform: translate(-50%, 0); }
        50% { transform: translate(-50%, -6px); }
      }
      @keyframes rippleGrow {
        0% { transform: translate(-50%, 0) scale(0.7); opacity: 0.35; }
        70% { opacity: 0.08; }
        100% { transform: translate(-50%, 0) scale(1.25); opacity: 0; }
      }
      .efedra-click-indicator { animation: clickFloat 2.8s ease-in-out infinite; }
      .efedra-click-indicator .efedra-ripple.r1 { animation: rippleGrow 2.8s ease-in-out infinite; animation-delay: .0s; }
      .efedra-click-indicator .efedra-ripple.r2 { animation: rippleGrow 2.8s ease-in-out infinite; animation-delay: 1.4s; }

      /* Entrada/salida más suave */
      @keyframes fadeWaveIn {
        from { opacity: 0; transform: translateY(24px); filter: blur(4px); }
        to { opacity: 0.98; transform: translateY(0); filter: blur(0); }
      }
      @keyframes fadeWaveOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-26px); }
      }

      /* Ondas por carácter */
      @keyframes charWave {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(var(--waveAmp, 6px)); }
      }
    `;
    document.head.appendChild(style);

    // Fade in del contenedor y botón de saltear
    requestAnimationFrame(() => {
      textContainer.style.opacity = '1';
      this.skipButton.style.opacity = '1';
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    // Crear contenedor fijo para el texto actual
    const currentLineContainer = document.createElement('div');
    currentLineContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      max-width: 1200px;
    `;
    textContainer.appendChild(currentLineContainer);

    for (let i = 0; i < lines.length; i++) {
      // Si se solicitó saltear, salir del loop
      if (this.skipRequested) break;
      const line = lines[i];
      
      // Limpiar el contenedor antes de agregar nueva línea
      currentLineContainer.innerHTML = '';
      currentLineContainer.style.opacity = '1'; // Resetear opacidad para la nueva línea
      
      const lineElement = document.createElement('div');
      // Base font sizes for 1920x1080 (will scale with container)
      const baseFontSize = i === 0 ? 48 : 27;
      lineElement.style.cssText = `
        color: ${EFEDRA_OVERLAY_THEME.colors.text};
        font-family: ${EFEDRA_OVERLAY_THEME.fonts.family};
        font-size: ${baseFontSize}px;
        font-weight: ${i === 0 ? 'bold' : 'normal'};
        margin: ${i === 0 ? '0 0 1.5em 0' : '0.5em 0'};
        text-align: center;
        line-height: 1.6;
        animation: fadeWaveIn 0.6s ease-out forwards;
      `;
      currentLineContainer.appendChild(lineElement);

      // Construir spans por carácter para animación de ondas
      const spans = [];
      const parts = line.split(/(\n)/); // Separa por \n pero mantiene el delimitador

      for (const part of parts) {
        if (part === '\n') {
          lineElement.appendChild(document.createElement('br'));
        } else {
          for (let c = 0; c < part.length; c++) {
            const ch = part[c] === ' ' ? '\u00A0' : part[c];
            const s = document.createElement('span');
            s.textContent = ch;
            s.style.display = 'inline-block';
            s.style.opacity = '0';
            s.style.transform = 'translateY(10px)';
            s.style.filter = 'blur(3px)';
            s.style.transition = 'opacity 220ms ease-out, transform 360ms ease-out, filter 480ms ease-out';
            s.style.willChange = 'transform, opacity, filter';
            // Animación continua de onda una vez revelado
            s.style.setProperty('--waveAmp', i === 0 ? '8px' : '5px');
            s.style.animation = `charWave ${i === 0 ? 2600 : 2800}ms ease-in-out ${c * 60}ms infinite`;
            lineElement.appendChild(s);
            spans.push(s);
          }
        }
      }

      // Variables de control para el typewriter
      let isTyping = true;
      let skipTyping = false;
      let advanceToNext = false;

      // Mostrar indicador de click desde el inicio
      clickIndicator.style.opacity = '1';

      // Configurar click handler: completa el texto si está escribiendo, o avanza si ya terminó
      const clickHandler = () => {
        if (isTyping) {
          skipTyping = true; // completar inmediatamente toda la frase
        } else {
          advanceToNext = true; // pasar a la siguiente línea inmediatamente
        }
      };
      overlay.addEventListener('click', clickHandler);

      // Efecto typewriter revelando spans y manteniendo onda
      for (let j = 0; j < spans.length; j++) {
        // Si se solicitó saltear, salir
        if (this.skipRequested) {
          skipTyping = true;
        }

        if (skipTyping) {
          // Revelar todos de golpe
          for (let k = 0; k < spans.length; k++) {
            const el = spans[k];
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            el.style.filter = 'blur(0)';
          }
          break;
        }

        const el = spans[j];
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.style.filter = 'blur(0)';

        // Pausas según puntuación del carácter recién revelado
        let delay = 40; // base
        const char = line[j];
        if (char === ',' || char === ';') delay = 300;
        else if (char === '.' || char === ':') delay = 400;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Marcar que terminó de escribir
      isTyping = false;

      // Si se solicitó saltear, no esperar
      if (this.skipRequested) {
        advanceToNext = true;
      }

      // Pequeña pausa para que el usuario vea el texto completo antes de poder avanzar
      if (!this.skipRequested) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Si no se clickeó, esperar click para avanzar
      if (!advanceToNext && !this.skipRequested) {
        await new Promise(resolve => {
          const checkAdvance = setInterval(() => {
            if (advanceToNext || this.skipRequested) { clearInterval(checkAdvance); resolve(); }
          }, 50);
        });
      }

      // Remover event listener
      overlay.removeEventListener('click', clickHandler);

      // Transición a la siguiente línea (excepto la última)
      if (i < lines.length - 1) {
        clickIndicator.style.opacity = '0';
        
        // Simplemente hacer fade out sin animación de movimiento
        currentLineContainer.style.transition = 'opacity 0.3s ease';
        currentLineContainer.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        // Última línea - pausa automática
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Mantener el texto visible un momento
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Fade out del texto
    textContainer.style.opacity = '0';
    clickIndicator.style.opacity = '0';
    logo.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 800));
    textContainer.remove();
    clickIndicator.remove();
    logo.remove();
    style.remove();
  }

  async unmount() {
    // Limpiar resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
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
