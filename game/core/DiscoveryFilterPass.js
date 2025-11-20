import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderMaterial, UniformsUtils, Vector2 } from 'three';

/**
 * DiscoveryFilterPass - Post-processing para aplicar efecto de "no descubierto"
 * Aplica baja saturación, bajo contraste y tinte verde-amarillento antes de descubrir especies
 */
export class DiscoveryFilterPass extends Pass {
  constructor() {
    super();

    // Estado inicial: efecto activo (antes de descubrir)
    this.enabled = true;
    this.discoveryProgress = 0.0; // 0 = no descubierto, 1 = completamente descubierto

    // Transición suave cuando se descubre
    this.targetProgress = 0.0;
    this.transitionSpeed = 2.0; // Velocidad de la transición

    console.log('[DiscoveryFilterPass] Constructor - inicializando con progress=0 (efecto ACTIVO)');

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uProgress: { value: 0.0 }, // 0 = efecto completo, 1 = sin efecto
        uSaturation: { value: 0.9 }, // Saturación reducida pero sin apagar del todo
        uContrast: { value: 0.95 }, // Contraste suave
        uTintColor: { value: [0.99, 0.96, 0.99] }, // Tinte casi neutro con leve calidez
        uRevealCenter: { value: new Vector2(0.5, 0.5) },
        uRevealRadius: { value: -1.0 },
        uRevealFeather: { value: 0.18 },
        uRevealActive: { value: 0.0 },
        uIntroVisibility: { value: 0.0 }
      },

      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uProgress;
        uniform float uSaturation;
        uniform float uContrast;
        uniform vec3 uTintColor;
        uniform vec2 uRevealCenter;
        uniform float uRevealRadius;
        uniform float uRevealFeather;
        uniform float uRevealActive;
        uniform float uIntroVisibility;
        
        varying vec2 vUv;

        // Función para ajustar saturación
        vec3 adjustSaturation(vec3 color, float saturation) {
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          return mix(vec3(luminance), color, saturation);
        }

        // Función para ajustar contraste
        vec3 adjustContrast(vec3 color, float contrast) {
          return (color - 0.5) * contrast + 0.5;
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;

          if (uIntroVisibility <= 0.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, texel.a);
            return;
          }

          float effectStrength = 1.0 - uProgress;

          // Aplicar efectos solo cuando uProgress < 1.0
          if (uRevealActive > 0.5) {
            float dist = distance(vUv, uRevealCenter);
            float radialMask = smoothstep(uRevealRadius, uRevealRadius + uRevealFeather, dist);
            effectStrength *= radialMask;
          }

          if (effectStrength > 0.0) {
            // Ajustar saturación (interpolado entre saturación reducida y normal)
            float currentSaturation = mix(1.0, uSaturation, effectStrength);
            color = adjustSaturation(color, currentSaturation);

            // Ajustar contraste (interpolado entre contraste reducido y normal)
            float currentContrast = mix(1.0, uContrast, effectStrength);
            color = adjustContrast(color, currentContrast);

            // Aplicar tinte muy sutil (evitar dominante verdosa)
            vec3 tinted = mix(color, uTintColor, 0.3);
            float tintStrength = 0.25 * effectStrength; // 25% de intensidad atenuada por progreso
            color = mix(color, tinted, tintStrength);
          }

          gl_FragColor = vec4(color * uIntroVisibility, texel.a);
        }
      `
    };

    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });

    this.fsQuad = new FullScreenQuad(this.material);

    this.revealActive = false;
    this.revealRadius = -1.0;
    this.maxRadius = Math.sqrt(2.0);
    this.revealSpeed = 1.4;
    this.introVisibility = 0.0;
    this.introFadeSpeed = 2.5; // Fade-in rápido tras cargar el LUT
  }

  /**
   * Activa el efecto de "descubierto" - inicia la transición
   * @param {Object} centerUv - Coordenadas UV del centro de la revelación
   * @param {Function} onComplete - Callback a ejecutar cuando la transición termine
   */
  triggerDiscovery(centerUv, onComplete = null) {
    this.targetProgress = 1.0;
    this.revealActive = true;
    this.revealRadius = 0.0;
    this.material.uniforms.uRevealActive.value = 1.0;
    this.material.uniforms.uRevealRadius.value = this.revealRadius;
    this.onComplete = onComplete; // Guardar callback para ejecutar cuando termine

    if (centerUv) {
      const x = typeof centerUv.x === 'number' ? centerUv.x : centerUv[0];
      const y = typeof centerUv.y === 'number' ? centerUv.y : centerUv[1];
      this.material.uniforms.uRevealCenter.value.set(x, y);
    }
  }

  /**
   * Resetea al estado "no descubierto"
   */
  reset() {
    this.discoveryProgress = 0.0;
    this.targetProgress = 0.0;
    this.material.uniforms.uProgress.value = 0.0;
    this.revealActive = false;
    this.revealRadius = -1.0;
    this.material.uniforms.uRevealActive.value = 0.0;
    this.material.uniforms.uRevealRadius.value = this.revealRadius;
    this.introVisibility = 0.0;
    this.material.uniforms.uIntroVisibility.value = this.introVisibility;
  }

  /**
   * Actualiza la transición del efecto
   */
  update(deltaTime) {
    if (this.introVisibility < 1.0) {
      this.introVisibility = Math.min(1.0, this.introVisibility + this.introFadeSpeed * deltaTime);
      this.material.uniforms.uIntroVisibility.value = this.introVisibility;
    }

    // Interpolar suavemente hacia el progreso objetivo
    if (Math.abs(this.discoveryProgress - this.targetProgress) > 0.001) {
      this.discoveryProgress += (this.targetProgress - this.discoveryProgress) * this.transitionSpeed * deltaTime;
      this.material.uniforms.uProgress.value = this.discoveryProgress;
    } else {
      this.discoveryProgress = this.targetProgress;
      this.material.uniforms.uProgress.value = this.targetProgress;
    }

    if (this.revealActive) {
      if (this.revealRadius < this.maxRadius) {
        this.revealRadius = Math.min(
          this.revealRadius + this.revealSpeed * deltaTime,
          this.maxRadius
        );
        this.material.uniforms.uRevealRadius.value = this.revealRadius;
      }

      if (this.revealRadius >= this.maxRadius - 0.01 && this.discoveryProgress >= 0.99) {
        this.revealActive = false;
        this.material.uniforms.uRevealActive.value = 0.0;
        this.material.uniforms.uRevealRadius.value = this.maxRadius;
        
        // Ejecutar callback si existe
        if (this.onComplete) {
          console.log('[DiscoveryFilterPass] Transición completada, ejecutando callback');
          this.onComplete();
          this.onComplete = null;
        }
      }
    }
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;

    // Debug: log cada 60 frames (aproximadamente 1 segundo)
    if (!this._debugFrameCount) this._debugFrameCount = 0;
    this._debugFrameCount++;
    if (this._debugFrameCount % 60 === 0) {
      console.log('[DiscoveryFilterPass] Rendering - progress:', this.material.uniforms.uProgress.value.toFixed(3));
    }

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
