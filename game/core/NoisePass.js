import {
  ShaderMaterial,
  UniformsUtils
} from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export class NoisePass extends ShaderPass {
  constructor(intensity = 0.9   5) {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: intensity }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
       uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

float rand(vec2 co){
  return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float n = rand(vUv * uTime * 60.0); // ruido animado
  vec3 noisy = mix(color.rgb, vec3(n), uIntensity);
  gl_FragColor = vec4(noisy, 1.0);
}
      `
    };

    super(new ShaderMaterial({
      uniforms: UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    }), 'tDiffuse');

    this.material.uniforms = this.uniforms; // vincula los uniforms
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }
}
