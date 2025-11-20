import {
  ShaderMaterial,
  UniformsUtils,
  Vector3
} from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * GamerLUTPass - Post-processing pass que aplica un LUT "gamer" con color grading
 * Añade saturación, contraste, viñeta y tintes de colores vibrantes
 */
export class GamerLUTPass extends ShaderPass {
  constructor(options = {}) {
    const {
      intensity = 0.2,        // Intensidad del efecto (0-1)
      saturation = 0,       // Saturación de colores (1 = normal, >1 más saturado)
      contrast = 1.05,        // Contraste (1 = normal, >1 más contraste)
      brightness = 1.02,      // Brillo (1 = normal, >1 más brillante)
      vignetteStrength = 0.2, // Fuerza de la viñeta
      tintColor = new Vector3(0.03, 0.05, 0.08), // Tinte cyan/azulado gamer
      highlightTint = new Vector3(1.05, 0.98, 0.95), // Tinte cálido en highlights
      shadowTint = new Vector3(0.95, 0.97, 1.05)     // Tinte frío en sombras
    } = options;

    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uIntensity: { value: intensity },
        uSaturation: { value: saturation },
        uContrast: { value: contrast },
        uBrightness: { value: brightness },
        uVignetteStrength: { value: vignetteStrength },
        uTintColor: { value: tintColor },
        uHighlightTint: { value: highlightTint },
        uShadowTint: { value: shadowTint },
        uTime: { value: 0 }
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
        uniform float uIntensity;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uBrightness;
        uniform float uVignetteStrength;
        uniform vec3 uTintColor;
        uniform vec3 uHighlightTint;
        uniform vec3 uShadowTint;
        uniform float uTime;
        
        varying vec2 vUv;
        
        // Convertir RGB a luminancia
        float getLuminance(vec3 color) {
          return dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        // Aplicar saturación
        vec3 applySaturation(vec3 color, float sat) {
          float lum = getLuminance(color);
          return mix(vec3(lum), color, sat);
        }
        
        // Aplicar contraste
        vec3 applyContrast(vec3 color, float contrast) {
          return (color - 0.5) * contrast + 0.5;
        }
        
        // Curva de tonos tipo S (S-curve)
        float sCurve(float x) {
          return smoothstep(0.0, 1.0, x);
        }
        
        // Viñeta
        float getVignette(vec2 uv, float strength) {
          vec2 position = uv - 0.5;
          float dist = length(position);
          return 1.0 - smoothstep(0.3, 0.9, dist) * strength;
        }
        
        // LUT gamer - color grading
        vec3 applyGamerLUT(vec3 color) {
          float lum = getLuminance(color);
          
          // Separar en zonas: sombras, medios, highlights
          float shadows = smoothstep(0.0, 0.3, lum);
          float highlights = smoothstep(0.6, 1.0, lum);
          float midtones = 1.0 - shadows - highlights;
          
          // Aplicar tintes por zona
          vec3 result = color;
          result *= mix(uShadowTint, vec3(1.0), shadows);        // Tinte frío en sombras
          result *= mix(vec3(1.0), uHighlightTint, highlights); // Tinte cálido en highlights
          
          // Curva S para mejorar contraste
          result.r = sCurve(result.r);
          result.g = sCurve(result.g);
          result.b = sCurve(result.b);
          
          return result;
        }
        
        // Filtro cian/azul característico
        vec3 applyCyanFilter(vec3 color, vec3 tint) {
          return color + tint * 0.5;
        }
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;
          
          // 1. Ajustar brillo
          color *= uBrightness;
          
          // 2. Aplicar saturación
          color = applySaturation(color, uSaturation);
          
          // 3. Aplicar contraste
          color = applyContrast(color, uContrast);
          
          // 4. Aplicar LUT gamer (color grading)
          color = applyGamerLUT(color);
          
          // 5. Aplicar tinte general
          color = applyCyanFilter(color, uTintColor);
          
          // 6. Aplicar viñeta
          float vignette = getVignette(vUv, uVignetteStrength);
          color *= vignette;
          
          // 7. Crush blacks ligeramente (más negro los negros)
          color = max(color - 0.02, 0.0);
          
          // 8. Mezclar con original según intensidad
          color = mix(texel.rgb, color, uIntensity);
          
          // Clamp final
          color = clamp(color, 0.0, 1.0);
          
          gl_FragColor = vec4(color, texel.a);
        }
      `
    };

    super(new ShaderMaterial({
      uniforms: UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    }), 'tDiffuse');

    this.material.uniforms = this.uniforms;
  }

  /**
   * Actualizar el tiempo (para animaciones futuras si se necesitan)
   */
  update(time) {
    this.uniforms.uTime.value = time;
  }

  /**
   * Cambiar la intensidad del efecto en runtime
   */
  setIntensity(value) {
    this.uniforms.uIntensity.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Cambiar la saturación en runtime
   */
  setSaturation(value) {
    this.uniforms.uSaturation.value = Math.max(0, value);
  }

  /**
   * Cambiar el contraste en runtime
   */
  setContrast(value) {
    this.uniforms.uContrast.value = Math.max(0, value);
  }

  /**
   * Cambiar el brillo en runtime
   */
  setBrightness(value) {
    this.uniforms.uBrightness.value = Math.max(0, value);
  }

  /**
   * Cambiar la fuerza de la viñeta en runtime
   */
  setVignetteStrength(value) {
    this.uniforms.uVignetteStrength.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Preset: modo "Cyberpunk"
   */
  presetCyberpunk() {
    this.uniforms.uSaturation.value = 1.5;
    this.uniforms.uContrast.value = 1.2;
    this.uniforms.uTintColor.value.set(0.1, 0.0, 0.2); // Magenta
    this.uniforms.uHighlightTint.value.set(1.2, 0.8, 1.1);
    this.uniforms.uShadowTint.value.set(0.7, 0.9, 1.2);
  }

  /**
   * Preset: modo "Competitivo" (más clarity, menos distracciones)
   */
  presetCompetitive() {
    this.uniforms.uSaturation.value = 1.1;
    this.uniforms.uContrast.value = 1.25;
    this.uniforms.uBrightness.value = 1.1;
    this.uniforms.uVignetteStrength.value = 0.1;
    this.uniforms.uTintColor.value.set(0.0, 0.05, 0.1);
  }

  /**
   * Preset: modo "Cinematic" (más dramático)
   */
  presetCinematic() {
    this.uniforms.uSaturation.value = 1.4;
    this.uniforms.uContrast.value = 1.3;
    this.uniforms.uBrightness.value = 0.95;
    this.uniforms.uVignetteStrength.value = 0.5;
    this.uniforms.uTintColor.value.set(0.05, 0.05, 0.1);
    this.uniforms.uHighlightTint.value.set(1.15, 1.0, 0.85);
    this.uniforms.uShadowTint.value.set(0.8, 0.85, 1.15);
  }

  /**
   * Resetear a valores por defecto
   */
  reset() {
    this.uniforms.uIntensity.value = 0.7;
    this.uniforms.uSaturation.value = 1.3;
    this.uniforms.uContrast.value = 1.15;
    this.uniforms.uBrightness.value = 1.05;
    this.uniforms.uVignetteStrength.value = 0.3;
    this.uniforms.uTintColor.value.set(0.05, 0.1, 0.15);
    this.uniforms.uHighlightTint.value.set(1.1, 0.95, 0.85);
    this.uniforms.uShadowTint.value.set(0.85, 0.9, 1.1);
  }
}
