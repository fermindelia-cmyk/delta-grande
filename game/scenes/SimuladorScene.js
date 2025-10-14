import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { BaseScene } from '../core/BaseScene.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const saturate = (v) => clamp(v, 0, 1);

export const DEFAULT_PARAMS = Object.freeze({
  world: Object.freeze({
    top: 1,
    bottom: -0.38,
    cameraZ: 6.5,
    backgroundZ: -2
  }),
  colors: Object.freeze({
    skyTop: '#8ecae6',
    skyBottom: '#e3f1ff',
    distantBank: '#86b58d',
    distantBankShadow: '#5a8760',
    waterSurface: '#4aa0d9',
    waterDeep: '#1c4b6b',
    waterHighlight: '#9fe2ff',
    waterAverageLine: '#f4fbff',
    riverbedBase: '#caa46b',
    riverbedShadow: '#a67548',
    sedimentParticle: '#f3d3a2',
    sedimentShadow: '#c49563',
    uiBackground: 'rgba(10, 34, 61, 0.6)',
    uiBackgroundActive: 'rgba(20, 54, 90, 0.85)',
    uiAccent: '#ffd166',
    uiText: '#f8fafc'
  }),
  water: Object.freeze({
    surfaceSegments: 200,
    baseLevel: 0.52,
    levelDelta: 0.13,
    bottom: -0.36,
    smoothing: 2.2,
    opacity: 0.87,
    wave: Object.freeze({
      primaryAmplitude: 0.036*0.5,
      secondaryAmplitude: 0.022*0.5,
      tertiaryAmplitude: 0.012*0.5,
      chop: 0.14*0.5,
      primaryFrequency: 7.4,
      secondaryFrequency: 12.8,
      tertiaryFrequency: 3.2,
      primarySpeed: 0.72,
      secondarySpeed: 1.18,
      tertiarySpeed: 0.25,
      noiseAmplitude: 0.018,
      noiseScale: 1.7,
      noiseSpeed: 0.16
    })
  }),
  riverbed: Object.freeze({
    segments: 200,
    baseHeight: -0.16,
    bottom: -0.38,
    maxHeight: 0.82,
    moundCenter: 0.5,
    moundWidth: 0.24,
    moundHeight: 0.24,
    smoothing: 1.1
  }),
  sediment: Object.freeze({
    maxParticles: 55,
    emissionPerClick: 55,
    spawnJitter: 0.02,
    airSpeedMin: 0.22,
    airSpeedMax: 0.45,
    airLateralJitter: 0.06,
    waterSpeedMin: 0.16,
    waterSpeedMax: 0.32,
    gravityAir: -1.05,
    gravityWater: -0.32,
    current: 5.0,
    dragWater: 0.86,
    dissolveSpeed: 0.3,
    depositRadius: 0.12,
    depositAmount: 0.0002,
    particleSize: 0.012,
    minAlpha: 0.35
  }),
  ui: Object.freeze({
    panelWidth: 0.24,
    panelTop: 0.05,
    panelLeft: 0.04,
    gap: 0.012,
    buttonHeight: 0.068,
    fontScale: 0.028,
    borderRadius: 0.035,
    shadowOpacity: 0.4
  }),
  progress: Object.freeze({
    emergenceCoverage: 0.1,
    emergenceMessage: 'La Isla emerge de las aguas del Delta...'
  })
});

export class SimuladorScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'simulador';

    this.params = DEFAULT_PARAMS;
    this.worldWidth = 1;
    this.worldHeight = this.params.world.top - this.params.world.bottom;
    this.worldBottom = this.params.world.bottom;
    this.worldTop = this.params.world.top;

    this._waterLevels = {
      low: this.params.water.baseLevel - this.params.water.levelDelta,
      medium: this.params.water.baseLevel,
      high: this.params.water.baseLevel + this.params.water.levelDelta
    };
    this._currentWaterLevel = this._waterLevels.medium;
    this._targetWaterLevel = this._currentWaterLevel;
    this._waterLevelIndex = 1; // 0 low, 1 medium, 2 high

    this._elapsed = 0;
    this._noise = new SimplexNoise();
    this._noise2D = this._resolveNoise2D(this._noise);

    this._waterStrip = null;
    this._riverbedStrip = null;
    this._averageLine = null;
    this._waterHeights = [];
    this._riverbedHeights = [];
    this._riverbedBase = [];
    this._riverbedDirty = true;

    this._particles = [];
    this._particlePositions = null;
    this._particleAlphas = null;
    this._particleAges = null;
    this._particlesGeometry = null;
    this._particlesPoints = null;
    this._activeParticles = 0;

    this._uiRoot = null;
    this._buttons = {};
    this._sedimentMode = false;
    this._pointerDown = false;
    this._emergenceShown = false;
    this._emergenceEl = null;

    this._boundOnPointerDown = (e) => this._handlePointerDown(e);
    this._boundOnPointerMove = (e) => this._handlePointerMove(e);
    this._boundOnPointerUp = () => { this._pointerDown = false; };
  }

  async mount() {
    // Replace default camera with orthographic for side-view 2D layout.
    const { top, bottom, cameraZ } = this.params.world;
    this.worldHeight = top - bottom;
    this.worldBottom = bottom;
    this.worldTop = top;

    this.camera = new THREE.OrthographicCamera(0, 1, top, bottom, -10, 20);
    this.camera.position.set(0, 0, cameraZ);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.scene = new THREE.Scene();

    this._createBackground();
    this._createRiverbed();
    this._createWater();
    this._createAverageLine();
    this._createSedimentSystem();
    this._createUI();
    this._bindEvents();

    this.onResize(this.app.root.clientWidth, this.app.root.clientHeight);
  }

  async unmount() {
    this._unbindEvents();
    this._destroyUI();
    this._disposeObjects();
  }

  update(dt) {
    this._elapsed += dt;

    const smoothing = this.params.water.smoothing;
    this._currentWaterLevel = THREE.MathUtils.damp(
      this._currentWaterLevel,
      this._targetWaterLevel,
      smoothing,
      dt
    );

    this._updateWater();
    this._updateRiverbed();
    this._updateSediment(dt);
  }

  onResize(width, height) {
    if (!width || !height) return;

    const aspect = width / height;
    this.worldHeight = this.params.world.top - this.params.world.bottom;
    this.worldWidth = this.worldHeight * aspect;

    this.camera.left = 0;
    this.camera.right = this.worldWidth;
    this.camera.top = this.params.world.top;
    this.camera.bottom = this.params.world.bottom;
    this.camera.updateProjectionMatrix();

    this._layoutBackground();
    this._layoutWater();
    this._layoutRiverbed();
    this._layoutAverageLine();
    this._updateUILayout(width, height);
    this._updateWater();
    this._riverbedDirty = true;
    this._updateRiverbed();
    this._updateParticleSize(width, height);
  }

  _createBackground() {
    const { colors, world } = this.params;

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorTop: { value: new THREE.Color(colors.skyTop) },
        colorBottom: { value: new THREE.Color(colors.skyBottom) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        void main(){
          float t = smoothstep(0.0, 1.0, vUv.y);
          vec3 col = mix(colorBottom, colorTop, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false
    });

    this._background = new THREE.Mesh(geometry, material);
    this._background.position.z = world.backgroundZ;
    this.scene.add(this._background);

    const bankGeometry = new THREE.PlaneGeometry(1, 0.15);
    const bankMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.distantBank),
      transparent: true,
      opacity: 0.9
    });
    this._distantBank = new THREE.Mesh(bankGeometry, bankMaterial);
    this._distantBank.position.z = world.backgroundZ + 0.01;
    this.scene.add(this._distantBank);
  }

  _layoutBackground() {
    if (!this._background) return;
    const height = this.worldHeight;
    const width = this.worldWidth;

    this._background.scale.set(width, height * 1.2, 1);
    this._background.position.set(width * 0.5, (this.worldTop + this.worldBottom) * 0.5 + height * 0.1, this.params.world.backgroundZ);

    if (this._distantBank) {
      this._distantBank.scale.set(width, height * 0.22, 1);
      const bankHeight = this.worldTop - this._currentWaterLevel;
      this._distantBank.position.set(width * 0.5, this._currentWaterLevel + bankHeight * 0.4, this.params.world.backgroundZ + 0.01);
    }
  }

  _createWater() {
    const { water, colors } = this.params;
    const segments = water.surfaceSegments;

    const { geometry, topIndices, bottomIndices } = this._buildStripGeometry(segments);
    geometry.setAttribute('position', geometry.getAttribute('position'));
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorSurface: { value: new THREE.Color(colors.waterSurface) },
        colorDeep: { value: new THREE.Color(colors.waterDeep) },
        colorHighlight: { value: new THREE.Color(colors.waterHighlight) },
        opacity: { value: water.opacity }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vDepth;
        void main(){
          vUv = uv;
          vDepth = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vDepth;
        uniform vec3 colorSurface;
        uniform vec3 colorDeep;
        uniform vec3 colorHighlight;
        uniform float opacity;
        void main(){
          float t = pow(1.0 - vUv.y, 1.4);
          vec3 base = mix(colorDeep, colorSurface, t);
          float highlight = smoothstep(0.92, 1.0, 1.0 - vUv.y);
          vec3 col = mix(base, colorHighlight, highlight * 0.45);
          gl_FragColor = vec4(col, opacity);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this._waterStrip = {
      mesh: new THREE.Mesh(geometry, material),
      geometry,
      topIndices,
      bottomIndices,
      bottomY: water.bottom
    };
    this._waterStrip.mesh.renderOrder = 1;
    this.scene.add(this._waterStrip.mesh);

    this._waterHeights = new Float32Array(segments + 1);
  }

  _layoutWater() {
    if (!this._waterStrip) return;
    const { geometry, topIndices, bottomIndices } = this._waterStrip;
    const positions = geometry.attributes.position.array;
    const segments = this.params.water.surfaceSegments;
    const bottomY = this.params.water.bottom;

    for (let i = 0; i <= segments; i++) {
      const x = this.worldWidth * (i / segments);

      const topIndex = topIndices[i] * 3;
      const bottomIndex = bottomIndices[i] * 3;

      positions[topIndex + 0] = x;
      positions[topIndex + 2] = 0;
      positions[bottomIndex + 0] = x;
      positions[bottomIndex + 1] = bottomY;
      positions[bottomIndex + 2] = 0;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  _updateWater() {
    if (!this._waterStrip) return;
    const { geometry, topIndices } = this._waterStrip;
    const positions = geometry.attributes.position.array;
    const segments = this.params.water.surfaceSegments;
    const time = this._elapsed;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = this.worldWidth * t;
      const height = this._sampleWaterHeight(t, time);
      this._waterHeights[i] = height;

      const idx = topIndices[i] * 3;
      positions[idx + 0] = x;
      positions[idx + 1] = height;
      positions[idx + 2] = 0;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  _sampleWaterHeight(t, time) {
    const { wave } = this.params.water;
    const level = this._currentWaterLevel;

    const wave1 = Math.sin(t * wave.primaryFrequency + time * wave.primarySpeed) * wave.primaryAmplitude;
    const wave2 = Math.sin(t * wave.secondaryFrequency - time * wave.secondarySpeed * 0.9 + 1.1) * wave.secondaryAmplitude;
    const wave3 = Math.sin(t * wave.tertiaryFrequency * 0.5 + time * wave.tertiarySpeed * 1.4) * wave.tertiaryAmplitude;
    const chop = Math.sin((t + time * 0.4) * wave.secondaryFrequency * 0.9) * wave.chop * 0.5;
    const noise = this._noise2D(t * wave.noiseScale + time * 0.1, time * wave.noiseSpeed) * wave.noiseAmplitude;

    return level + wave1 + wave2 + wave3 + chop + noise;
  }

  _resolveNoise2D(noiseSource) {
    if (noiseSource && typeof noiseSource.noise2D === 'function') {
      return (x, y) => noiseSource.noise2D(x, y);
    }
    if (noiseSource && typeof noiseSource.noise === 'function') {
      return (x, y) => noiseSource.noise(x, y, 0);
    }
    if (noiseSource && typeof noiseSource.noise3d === 'function') {
      return (x, y) => noiseSource.noise3d(x, y, 0);
    }
    if (noiseSource && typeof noiseSource.noise3D === 'function') {
      return (x, y) => noiseSource.noise3D(x, y, 0);
    }
    return () => 0;
  }

  _createAverageLine() {
    const segments = this.params.water.surfaceSegments;
    const points = [];
    const medium = this._waterLevels.medium;
    const amplitude = 0.015;
    const frequency = 6.5;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = t * this.worldWidth;
      const y = medium + Math.sin(t * frequency) * amplitude;
      points.push(new THREE.Vector3(x, y, 0.01));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.params.colors.waterAverageLine),
      linewidth: 1
    });
    this._averageLine = new THREE.Line(geometry, material);
    this._averageLine.renderOrder = 2;
    this.scene.add(this._averageLine);
  }

  _layoutAverageLine() {
    if (!this._averageLine) return;
    const segments = this.params.water.surfaceSegments;
    const medium = this._waterLevels.medium;
    const amplitude = 0.015;
    const frequency = 6.5;

    const positions = this._averageLine.geometry.attributes.position.array;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = t * this.worldWidth;
      const y = medium + Math.sin(t * frequency) * amplitude;
      const idx = i * 3;
      positions[idx + 0] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = 0.01;
    }
    this._averageLine.geometry.attributes.position.needsUpdate = true;
  }

  _createRiverbed() {
    const { riverbed, colors } = this.params;
    const segments = riverbed.segments;
    const { geometry, topIndices, bottomIndices } = this._buildStripGeometry(segments);

    const colorsAttr = new Float32Array((segments + 1) * 2 * 3);
    const colorTop = new THREE.Color(colors.riverbedBase);
    const colorBottom = new THREE.Color(colors.riverbedShadow);
    for (let i = 0; i <= segments; i++) {
      const topIdx = topIndices[i] * 3;
      const bottomIdx = bottomIndices[i] * 3;
      colorTop.toArray(colorsAttr, topIdx);
      colorBottom.toArray(colorsAttr, bottomIdx);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colorsAttr, 3));
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    this._riverbedStrip = {
      mesh: new THREE.Mesh(geometry, material),
      geometry,
      topIndices,
      bottomIndices
    };
    this._riverbedStrip.mesh.position.z = -0.05;
    this.scene.add(this._riverbedStrip.mesh);

    this._riverbedHeights = new Float32Array(segments + 1);
    this._riverbedBase = new Float32Array(segments + 1);
    this._initializeRiverbed();
  }

  _layoutRiverbed() {
    if (!this._riverbedStrip) return;
    const { geometry, topIndices, bottomIndices } = this._riverbedStrip;
    const positions = geometry.attributes.position.array;
    const segments = this.params.riverbed.segments;
    const bottom = this.params.riverbed.bottom;

    for (let i = 0; i <= segments; i++) {
      const x = this.worldWidth * (i / segments);
      const topIdx = topIndices[i] * 3;
      const bottomIdx = bottomIndices[i] * 3;

      positions[topIdx + 0] = x;
      positions[topIdx + 1] = this._riverbedHeights[i];
      positions[topIdx + 2] = 0;

      positions[bottomIdx + 0] = x;
      positions[bottomIdx + 1] = bottom;
      positions[bottomIdx + 2] = 0;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  _initializeRiverbed() {
    const { riverbed } = this.params;
    const segments = riverbed.segments;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const gaussian = Math.exp(-Math.pow((t - riverbed.moundCenter) / riverbed.moundWidth, 2));
      const height = riverbed.baseHeight + gaussian * riverbed.moundHeight;
      this._riverbedHeights[i] = height;
      this._riverbedBase[i] = height;
    }
    this._riverbedDirty = true;
  }

  _updateRiverbed() {
    if (!this._riverbedDirty || !this._riverbedStrip) return;
    const { geometry, topIndices } = this._riverbedStrip;
    const positions = geometry.attributes.position.array;
    const segments = this.params.riverbed.segments;

    for (let i = 0; i <= segments; i++) {
      const idx = topIndices[i] * 3;
      positions[idx + 1] = this._riverbedHeights[i];
    }

    geometry.attributes.position.needsUpdate = true;
    this._riverbedDirty = false;
  }

  _createSedimentSystem() {
    const { sediment, colors } = this.params;
    const max = sediment.maxParticles;

    const geometry = new THREE.BufferGeometry();
    this._particlePositions = new Float32Array(max * 3);
    this._particleAlphas = new Float32Array(max);
    geometry.setAttribute('position', new THREE.BufferAttribute(this._particlePositions, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this._particleAlphas, 1));
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    geometry.getAttribute('alpha').setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        colorA: { value: new THREE.Color(colors.sedimentParticle) },
        colorB: { value: new THREE.Color(colors.sedimentShadow) },
        size: { value: sediment.particleSize },
        minAlpha: { value: sediment.minAlpha }
      },
      vertexShader: `
        uniform float size;
        attribute float alpha;
        varying float vAlpha;
        void main(){
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size;
        }
      `,
      fragmentShader: `
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform float minAlpha;
        varying float vAlpha;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = dot(uv, uv);
          if (r > 1.0) discard;
          float shade = smoothstep(1.0, 0.0, r);
          vec3 col = mix(colorB, colorA, shade);
          float alpha = max(minAlpha, vAlpha) * shade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      uniformsNeedUpdate: true
    });

    this._particlesGeometry = geometry;
    this._particlesPoints = new THREE.Points(geometry, material);
    this._particlesPoints.renderOrder = 3;
    this.scene.add(this._particlesPoints);
    this._updateParticleSize(this.app?.root?.clientWidth || 1, this.app?.root?.clientHeight || 1);

    this._particles = new Array(max).fill(null).map(() => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      medium: 'air'
    }));
    this._activeParticles = 0;
  }

  _updateSediment(dt) {
    if (!this._particles.length) return;
    const { sediment } = this.params;
    const max = this._particles.length;
    const positions = this._particlePositions;
    const alphas = this._particleAlphas;

    let dirty = false;
    for (let i = 0; i < max; i++) {
      const p = this._particles[i];
      const idx = i * 3;
      if (!p.active) {
        if (positions[idx] !== 0 || positions[idx + 1] !== 0 || positions[idx + 2] !== 0 || alphas[i] !== 0) {
          positions[idx] = positions[idx + 1] = positions[idx + 2] = 0;
          alphas[i] = 0;
          dirty = true;
        }
        continue;
      }

      p.age += dt;

      if (p.medium === 'air') {
        p.vy += sediment.gravityAir * dt;
      } else {
        p.vx = lerp(p.vx, sediment.current, 0.4 * dt);
        p.vy += sediment.gravityWater * dt;
        p.vx *= Math.pow(sediment.dragWater, dt * 3);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const waterHeight = this._heightAt(this._waterHeights, this.params.water.surfaceSegments, p.x);
      if (p.medium === 'air' && p.y <= waterHeight) {
        this._deactivateParticle(p, i);
        dirty = true;
        continue;
      }

      const bedHeight = this._heightAt(this._riverbedHeights, this.params.riverbed.segments, p.x);
      if (p.y <= bedHeight) {
        if (this._isWithinCentralThird(p.x)) {
          this._raiseRiverbed(p.x, sediment.depositAmount);
        }
        this._deactivateParticle(p, i);
        dirty = true;
        continue;
      }

      if (p.x > this.worldWidth + 0.05 || p.x < -0.05) {
        this._deactivateParticle(p, i);
        dirty = true;
        continue;
      }

      if (p.medium === 'water' && p.y > waterHeight + 0.05) {
        p.medium = 'air';
      }

      positions[idx + 0] = p.x;
      positions[idx + 1] = p.y;
      positions[idx + 2] = 0.02;

      const normalizedAge = saturate(p.age * sediment.dissolveSpeed);
      alphas[i] = saturate(1 - normalizedAge);
      dirty = true;
      if (alphas[i] <= 0.02) {
        this._deactivateParticle(p, i);
      }
    }

    if (dirty && this._particlesGeometry) {
      this._particlesGeometry.attributes.position.needsUpdate = true;
      this._particlesGeometry.attributes.alpha.needsUpdate = true;
    }
  }

  _deactivateParticle(p, index) {
    if (!p?.active) return;
    p.active = false;
    const base = index * 3;
    this._particlePositions[base] = 0;
    this._particlePositions[base + 1] = 0;
    this._particlePositions[base + 2] = 0;
    this._particleAlphas[index] = 0;
    p.vx = 0;
    p.vy = 0;
    p.age = 0;
    this._activeParticles = Math.max(0, this._activeParticles - 1);
  }

  _isWithinCentralThird(x) {
    const lower = this.worldWidth / 3;
    const upper = this.worldWidth * (2 / 3);
    return x >= lower && x <= upper;
  }

  _raiseRiverbed(x, amount) {
    const { sediment, riverbed } = this.params;
    const segments = riverbed.segments;
    const radius = sediment.depositRadius * this.worldWidth;
    const center = clamp(x, 0, this.worldWidth);

    let changed = false;
    for (let i = 0; i <= segments; i++) {
      const px = this.worldWidth * (i / segments);
      const dist = Math.abs(px - center);
      if (dist > radius) continue;
      const weight = Math.cos((dist / radius) * Math.PI * 0.5);
      const delta = amount * weight * weight;
      const next = clamp(this._riverbedHeights[i] + delta, riverbed.bottom, riverbed.maxHeight);
      if (next !== this._riverbedHeights[i]) {
        this._riverbedHeights[i] = next;
        changed = true;
      }
    }
    if (changed) {
      this._riverbedDirty = true;
      this._checkEmergence();
    }
  }

  _heightAt(array, segments, x) {
    const t = clamp(x / this.worldWidth, 0, 1);
    const exact = t * segments;
    const i0 = Math.floor(exact);
    const i1 = clamp(i0 + 1, 0, segments);
    const frac = exact - i0;
    const h0 = array[i0] ?? 0;
    const h1 = array[i1] ?? h0;
    return lerp(h0, h1, frac);
  }

  _checkEmergence() {
    if (this._emergenceShown) return;
    const heights = this._riverbedHeights;
    if (!heights?.length) return;
    const { progress } = this.params;
    const threshold = Math.max(0, progress?.emergenceCoverage ?? 0.1);
    const level = this._waterLevels.medium;
    if (threshold === 0) {
      this._emergenceShown = true;
      this._showEmergenceMessage();
      return;
    }
    let elevated = 0;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] >= level) elevated += 1;
    }
    const coverage = elevated / heights.length;
    if (coverage >= threshold) {
      this._emergenceShown = true;
      this._showEmergenceMessage();
    }
  }

  _showEmergenceMessage() {
    if (!this.app?.root) return;
    const { colors, ui, progress } = this.params;
    if (!this._emergenceEl) {
      const el = document.createElement('div');
      el.textContent = progress?.emergenceMessage || 'La Isla emerge de las aguas del Delta...';
      el.style.position = 'absolute';
      el.style.left = '50%';
      el.style.top = '12vh';
      el.style.transform = 'translate(-50%, -3vh)';
      el.style.padding = '1.6vh 3vw';
      el.style.background = colors.uiBackgroundActive;
      el.style.borderRadius = `${(ui.borderRadius * 120).toFixed(3)}vmin`;
      el.style.boxShadow = `0 0 ${(ui.gap * 220).toFixed(3)}vh rgba(0,0,0,${ui.shadowOpacity})`;
      el.style.color = colors.uiText;
      el.style.fontSize = `${(ui.fontScale * 150).toFixed(3)}vmin`;
      el.style.fontWeight = '600';
      el.style.textAlign = 'center';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      el.style.zIndex = '10';
      this.app.root.appendChild(el);
      this._emergenceEl = el;
      requestAnimationFrame(() => {
        if (!this._emergenceEl) return;
        this._emergenceEl.style.opacity = '1';
        this._emergenceEl.style.transform = 'translate(-50%, 0)';
      });
    } else {
      this._emergenceEl.style.opacity = '1';
      this._emergenceEl.style.transform = 'translate(-50%, 0)';
    }
  }

  _emitSediment(worldX, worldY) {
    if (this._activeParticles > 0) return;
    const { sediment } = this.params;
    const count = sediment.emissionPerClick;
    const segments = this.params.water.surfaceSegments;
    const bedHeightAtClick = this._heightAt(this._riverbedHeights, this.params.riverbed.segments, worldX);
    if (worldY <= bedHeightAtClick + 0.003) return;

    for (let i = 0; i < count; i++) {
      const slot = this._acquireParticle();
      if (!slot) break;
      const { particle } = slot;

      const jitterX = (Math.random() - 0.5) * sediment.spawnJitter * this.worldWidth;
      const jitterY = (Math.random() - 0.5) * sediment.spawnJitter * this.worldHeight;
      particle.x = clamp(worldX + jitterX, 0, this.worldWidth);
      particle.y = worldY + jitterY;

      const waterHeight = this._heightAt(this._waterHeights, segments, particle.x);
      const belowWater = particle.y <= waterHeight;

      if (belowWater) {
        const speed = lerp(sediment.waterSpeedMin, sediment.waterSpeedMax, Math.random());
        const dir = 0.5 + Math.random() * 0.5;
        particle.vx = speed * dir;
        particle.vy = -speed * 0.9;
        particle.medium = 'water';
      } else {
        const speed = lerp(sediment.airSpeedMin, sediment.airSpeedMax, Math.random());
        particle.vx = (Math.random() - 0.5) * sediment.airLateralJitter;
        particle.vy = -speed;
        particle.medium = 'air';
      }

      particle.age = 0;
    }
  }

  _acquireParticle() {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) {
        const idx = i * 3;
        this._particlePositions[idx] = this._particlePositions[idx + 1] = this._particlePositions[idx + 2] = 0;
        this._particleAlphas[i] = 1;
        p.active = true;
        p.age = 0;
        this._activeParticles += 1;
        return { particle: p, index: i };
      }
    }
    return null;
  }

  _createUI() {
    const { ui, colors } = this.params;
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';

    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.left = `${ui.panelLeft * 100}vw`;
    panel.style.top = `${ui.panelTop * 100}vh`;
    panel.style.width = `${ui.panelWidth * 100}vw`;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = `${ui.gap * 100}vh`;
    panel.style.padding = `${ui.gap * 75}vh`;
    panel.style.background = colors.uiBackground;
    panel.style.borderRadius = `${ui.borderRadius * 100}vmin`;
    panel.style.backdropFilter = 'blur(0.8vmin)';
    panel.style.boxShadow = `0 0 ${ui.gap * 160}vh rgba(0,0,0,${ui.shadowOpacity})`;
    panel.style.pointerEvents = 'auto';

    const makeButton = (label) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.width = '100%';
      btn.style.fontFamily = 'inherit';
      btn.style.fontSize = `${ui.fontScale * 100}vmin`;
      btn.style.padding = `${ui.gap * 70}vh`;
      btn.style.border = 'none';
      btn.style.borderRadius = `${ui.borderRadius * 80}vmin`;
      btn.style.cursor = 'pointer';
      btn.style.color = colors.uiText;
      btn.style.background = colors.uiBackground;
      btn.style.transition = 'background 0.2s ease, transform 0.2s ease';
      btn.onmouseenter = () => {
        btn.style.transform = 'translateY(-0.4vh)';
        if (!btn.dataset.lockedColor) btn.style.background = colors.uiBackgroundActive;
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'translateY(0)';
        if (!btn.dataset.lockedColor) btn.style.background = colors.uiBackground;
      };
      return btn;
    };

    const btnWaterUp = makeButton('Subir agua');
    const btnWaterDown = makeButton('Bajar agua');
    const btnSediment = makeButton('Sedimento');

    btnWaterUp.addEventListener('click', (e) => {
      e.preventDefault();
      this._setWaterLevel(this._waterLevelIndex + 1);
    });
    btnWaterDown.addEventListener('click', (e) => {
      e.preventDefault();
      this._setWaterLevel(this._waterLevelIndex - 1);
    });
    btnSediment.addEventListener('click', (e) => {
      e.preventDefault();
      this._sedimentMode = !this._sedimentMode;
      this._syncSedimentButton();
    });

    panel.append(btnWaterUp, btnWaterDown, btnSediment);
    root.appendChild(panel);

    this.app.root.appendChild(root);
    this._uiRoot = root;
    this._buttons = {
      panel,
      waterUp: btnWaterUp,
      waterDown: btnWaterDown,
      sediment: btnSediment
    };

    this._syncWaterButtons();
    this._syncSedimentButton();
  }

  _updateUILayout(width, height) {
    if (!this._buttons.panel) return;
    const { ui } = this.params;
    this._buttons.panel.style.left = `${ui.panelLeft * 100}vw`;
    this._buttons.panel.style.top = `${ui.panelTop * 100}vh`;
    this._buttons.panel.style.width = `${ui.panelWidth * 100}vw`;
  }

  _updateParticleSize(width, height) {
    if (!this._particlesPoints || !this._particlesPoints.material?.uniforms?.size) return;
    const minSide = Math.max(1, Math.min(width, height));
    this._particlesPoints.material.uniforms.size.value = Math.max(2, minSide * this.params.sediment.particleSize);
  }

  _syncWaterButtons() {
    if (!this._buttons.waterUp) return;
    this._buttons.waterUp.disabled = this._waterLevelIndex >= 2;
    this._buttons.waterDown.disabled = this._waterLevelIndex <= 0;
    this._buttons.waterUp.style.opacity = this._buttons.waterUp.disabled ? '0.45' : '1';
    this._buttons.waterDown.style.opacity = this._buttons.waterDown.disabled ? '0.45' : '1';
  }

  _syncSedimentButton() {
    if (!this._buttons.sediment) return;
    const { colors } = this.params;
    const btn = this._buttons.sediment;
    if (this._sedimentMode) {
      btn.dataset.lockedColor = '1';
      btn.style.background = colors.uiBackgroundActive;
    } else {
      delete btn.dataset.lockedColor;
      btn.style.background = colors.uiBackground;
    }
    if (!this._sedimentMode) this._pointerDown = false;
    if (this.app?.canvas) {
      this.app.canvas.style.cursor = this._sedimentMode ? 'crosshair' : 'default';
    }
  }

  _destroyUI() {
    if (this._uiRoot && this._uiRoot.parentElement) {
      this._uiRoot.parentElement.removeChild(this._uiRoot);
    }
    this._uiRoot = null;
    this._buttons = {};
    if (this._emergenceEl && this._emergenceEl.parentElement) {
      this._emergenceEl.parentElement.removeChild(this._emergenceEl);
    }
    this._emergenceEl = null;
    this._emergenceShown = false;
  }

  _setWaterLevel(index) {
    const clamped = clamp(index, 0, 2);
    this._waterLevelIndex = clamped;
    this._targetWaterLevel = [this._waterLevels.low, this._waterLevels.medium, this._waterLevels.high][clamped];
    this._syncWaterButtons();
  }

  _bindEvents() {
    const canvas = this.app.canvas;
    canvas.addEventListener('pointerdown', this._boundOnPointerDown);
    canvas.addEventListener('pointermove', this._boundOnPointerMove);
    window.addEventListener('pointerup', this._boundOnPointerUp);
  }

  _unbindEvents() {
    const canvas = this.app.canvas;
    canvas.removeEventListener('pointerdown', this._boundOnPointerDown);
    canvas.removeEventListener('pointermove', this._boundOnPointerMove);
    window.removeEventListener('pointerup', this._boundOnPointerUp);
  }

  _handlePointerDown(event) {
    if (!this._sedimentMode || event.button !== 0) return;
    this._pointerDown = true;
    const point = this._getWorldPointer(event);
    if (!point) return;
    this._emitSediment(point.x, point.y);
  }

  _handlePointerMove(event) {
    if (!this._pointerDown || !this._sedimentMode || event.buttons === 0) return;
    const point = this._getWorldPointer(event);
    if (!point) return;
    this._emitSediment(point.x, point.y);
  }

  _getWorldPointer(event) {
    const rect = this.app.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const x = clamp(nx * this.worldWidth, 0, this.worldWidth);
    const y = this.worldBottom + (1 - ny) * this.worldHeight;
    return { x, y };
  }

  _disposeObjects() {
    const disposeMesh = (mesh) => {
      if (!mesh) return;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose?.());
        else mesh.material.dispose?.();
      }
      this.scene.remove(mesh);
    };

    disposeMesh(this._background);
    disposeMesh(this._distantBank);
    disposeMesh(this._waterStrip?.mesh);
    disposeMesh(this._riverbedStrip?.mesh);
    disposeMesh(this._averageLine);
    disposeMesh(this._particlesPoints);

    this._background = null;
    this._distantBank = null;
    this._waterStrip = null;
    this._riverbedStrip = null;
    this._averageLine = null;
    this._particlesPoints = null;
    this._particlesGeometry = null;
    this._particles = [];
    this._activeParticles = 0;
  }

  _buildStripGeometry(segments) {
    const vertexCount = (segments + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint16Array(segments * 6);
    const topIndices = new Array(segments + 1);
    const bottomIndices = new Array(segments + 1);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const topIdx = i * 2;
      const bottomIdx = topIdx + 1;
      topIndices[i] = topIdx;
      bottomIndices[i] = bottomIdx;

      uvs[topIdx * 2] = t;
      uvs[topIdx * 2 + 1] = 0;
      uvs[bottomIdx * 2] = t;
      uvs[bottomIdx * 2 + 1] = 1;
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      const idx = i * 6;
      indices[idx + 0] = a;
      indices[idx + 1] = b;
      indices[idx + 2] = c;
      indices[idx + 3] = b;
      indices[idx + 4] = d;
      indices[idx + 5] = c;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return { geometry, topIndices, bottomIndices };
  }
}
