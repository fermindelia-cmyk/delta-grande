import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { BaseScene } from '../core/BaseScene.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const saturate = (v) => clamp(v, 0, 1);
const smoothstep = (edge0, edge1, x) => {
  const width = Math.max(1e-5, edge1 - edge0);
  const t = saturate((x - edge0) / width);
  return t * t * (3 - 2 * t);
};

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
    bottom: -0.4,
    smoothing: 2.2,
    opacity: 0.77,
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
    highBaseline: 0.08,
    bottom: -0.38,
    maxHeight: 0.82,
    plateauStart: 0.15,
    plateauEnd: 0.85,
    transitionWidth: 0.12,
    noise: Object.freeze({
      lowAmplitude: 0.008,
      lowFrequency: 6.0,
      highAmplitude: 0.02,
      highFrequency: 11.0,
      seed: 37.42
    }),
    smoothing: 1.1
  }),
  sediment: Object.freeze({
    maxParticles: 55,
    emissionPerClick: 55,
    spawnOffset: 0.08,
    spawnJitterX: 0.04,
    bandSurfaceOffset: 0.05,
    bandDepth: 0.22,
    bandBaseJitter: 0.4,
    horizontalSpeed: 0.42,
    horizontalSpeedJitter: 0.25,
    verticalJitterAmplitude: 0.35,
    verticalJitterFrequencyMin: 0.7,
    verticalJitterFrequencyMax: 1.6,
    approachWindow: 0.12,
    approachLead: 0.22,
    arrivalThreshold: 0.008,
    dissolveSpeed: 0.3,
    depositRadius: 0.12,
    depositAmount: 0.002,
    particleSize: 0.015,
    minAlpha: 0.35
  }),
  seeds: Object.freeze({
    particlesPerPlant: 10,
    gravity: 0.9,
    burstHorizontalSpeed: 0.55,
    burstVerticalSpeed: 1.2,
    particleSize: 0.02,
    particleColor: '#4d3018',
    colonizers: Object.freeze([
      Object.freeze({ id: 'CS1', label: 'CS 1', color: '#7dbf5d', width: 0.04, height: 0.18, growthRate: 0.55 }),
      Object.freeze({ id: 'CS2', label: 'CS 2', color: '#6eb48f', width: 0.038, height: 0.16, growthRate: 0.6 }),
      Object.freeze({ id: 'CS3', label: 'CS 3', color: '#5d9d6d', width: 0.035, height: 0.14, growthRate: 0.5 })
    ]),
    nonColonizers: Object.freeze([
      Object.freeze({ id: 'NCS1', label: 'NCS 1', color: '#b58b5a', width: 0.05, height: 0.22, growthRate: 0.45 }),
      Object.freeze({ id: 'NCS2', label: 'NCS 2', color: '#a8733d', width: 0.048, height: 0.2, growthRate: 0.52 })
    ])
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
    messageDuration: 5.5,
    messageFadeDuration: 0.6,
    messageGap: 1.2,
    stages: Object.freeze([
      Object.freeze({
        id: 'formation',
        name: 'Formación del banco de arena',
        introMessage: 'Formá el nuevo banco de arena depositando sedimentos.',
        completionMessage: 'La isla emergió sobre el agua: ¡nuevo hábitat disponible!',
        goal: Object.freeze({
          type: 'riverbedCoverage',
          coverage: 0.5,
          minElevationAboveWater: 0.0
        }),
        allowedSeedGroups: Object.freeze([])
      }),
      Object.freeze({
        id: 'colonization',
        name: 'Colonización inicial',
        introMessage: 'Plantá las semillas colonizadoras para estabilizar el banco.',
        completionMessage: 'Las plantas colonizadoras echaron raíces y fijaron el suelo.',
        goal: Object.freeze({
          type: 'plantCounts',
          species: Object.freeze({
            CS1: 3,
            CS2: 3,
            CS3: 2
          })
        }),
        allowedSeedGroups: Object.freeze(['colonizers'])
      }),
      Object.freeze({
        id: 'expansion',
        name: 'Expansión ecológica',
        introMessage: 'Incorporá nuevas especies para completar la comunidad.',
        completionMessage: 'La isla floreció con especies diversas: ecosistema en equilibrio.',
        goal: Object.freeze({
          type: 'plantCounts',
          species: Object.freeze({
            NCS1: 3,
            NCS2: 3
          })
        }),
        allowedSeedGroups: Object.freeze(['colonizers', 'nonColonizers'])
      })
    ])
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

    this._seedEffectMaterial = null;
    this._seedEffectGroup = null;

    this._uiRoot = null;
    this._buttons = {};
  this._seedPanelWidth = null;
    this._seedButtons = {};
    this._activeTool = null;
    this._pointerDown = false;

    this._availableSeedIds = new Set();
    this._seedCatalog = new Map();
    this._seedGeometryCache = new Map();
    this._seedMaterialCache = new Map();

    this._seedBursts = [];

    this._plants = [];
    this._plantCounts = {};

    this._messageEl = null;
    this._messageTimer = null;
    this._messageHideTimer = null;
    this._stageAdvanceTimer = null;

    this._stages = this.params.progress.stages;
    this._currentStageIndex = 0;
    this._stageComplete = false;

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
    this._createSeedEffectSystem();
    this._createUI();
    this._initProgression();
    this._bindEvents();

    this.onResize(this.app.root.clientWidth, this.app.root.clientHeight);
  }

  async unmount() {
    this._unbindEvents();
    this._destroyUI();
    this._clearMessageTimer();
    this._clearStageAdvanceTimer();
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
    this._updateSeedBursts(dt);
    this._updatePlants(dt);
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
    this._updateSeedEffectSize(width, height);
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
    const plateauStartRaw = clamp(riverbed.plateauStart ?? 0.2, 0, 1);
    const plateauEndRaw = clamp(riverbed.plateauEnd ?? 0.8, 0, 1);
    const plateauStart = Math.min(plateauStartRaw, plateauEndRaw);
    const plateauEnd = Math.max(plateauStartRaw, plateauEndRaw);
    const transitionWidth = Math.max(0.0001, riverbed.transitionWidth ?? 0.1);
    const halfTransition = transitionWidth * 0.5;
    const riseStart = clamp(plateauStart - halfTransition, 0, 1);
    const riseEnd = clamp(plateauStart + halfTransition, 0, 1);
    const fallStart = clamp(plateauEnd - halfTransition, 0, 1);
    const fallEnd = clamp(plateauEnd + halfTransition, 0, 1);

    const lowBaseline = riverbed.baseHeight ?? 0;
    const highBaseline = typeof riverbed.highBaseline === 'number'
      ? riverbed.highBaseline
      : lowBaseline + (riverbed.moundHeight ?? 0);
    const noise = riverbed.noise ?? {};
    const lowAmp = noise.lowAmplitude ?? 0;
    const lowFreq = noise.lowFrequency ?? 1;
    const highAmp = noise.highAmplitude ?? 0;
    const highFreq = noise.highFrequency ?? 1;
    const seed = noise.seed ?? 0;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const lowNoise = this._noise2D(t * lowFreq, seed) * lowAmp;
      const highNoise = this._noise2D(t * highFreq, seed + 100) * highAmp;

      let blend = 0;
      if (t <= riseStart) {
        blend = 0;
      } else if (t < riseEnd) {
        blend = smoothstep(riseStart, riseEnd, t);
      } else if (t <= fallStart) {
        blend = 1;
      } else if (t < fallEnd) {
        blend = 1 - smoothstep(fallStart, fallEnd, t);
      }

      const targetHeight = lerp(lowBaseline, highBaseline, blend);
      const noiseMix = lerp(lowNoise, highNoise, blend);
      const height = clamp(targetHeight + noiseMix, riverbed.bottom, riverbed.maxHeight);
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
  this._particlesPoints.position.z = -0.02;
  this._particlesPoints.renderOrder = 0;
    this.scene.add(this._particlesPoints);
    this._updateParticleSize(this.app?.root?.clientWidth || 1, this.app?.root?.clientHeight || 1);

    this._particles = new Array(max).fill(null).map(() => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      bandBase: 0,
      jitterPhase: 0,
      jitterSpeed: 0,
      jitterAmplitude: 0,
      horizontalSpeed: 0,
      targetX: 0,
      targetY: 0,
      approachStartX: 0,
      approachSpan: 1
    }));
    this._activeParticles = 0;
  }

  _createSeedEffectSystem() {
    if (this._seedEffectGroup) return;
    const { seeds } = this.params;
    this._seedEffectGroup = new THREE.Group();
    this._seedEffectGroup.position.z = 0.06;
    this.scene.add(this._seedEffectGroup);

    this._seedEffectMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        size: { value: 6 },
        color: { value: new THREE.Color(seeds.particleColor || '#4d3018') }
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
        uniform vec3 color;
        varying float vAlpha;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = dot(uv, uv);
          if (r > 1.0) discard;
          float shade = smoothstep(1.0, 0.0, r);
          gl_FragColor = vec4(color, vAlpha * shade);
        }
      `
    });
  }

  _emitSeedBurst(x, y) {
    if (!this._seedEffectMaterial || !this._seedEffectGroup) return;
    const { seeds } = this.params;
    const count = Math.max(1, Math.floor(seeds.particlesPerPlant));
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const velocities = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx + 0] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = 0.06;
      alphas[i] = 1;

      const dir = (Math.random() * Math.PI * 2);
      const speed = seeds.burstHorizontalSpeed * (0.4 + Math.random() * 0.9);
      velocities[i * 2 + 0] = Math.cos(dir) * speed;
      velocities[i * 2 + 1] = seeds.burstVerticalSpeed * (0.6 + Math.random() * 0.4);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    geometry.getAttribute('alpha').setUsage(THREE.DynamicDrawUsage);

    const points = new THREE.Points(geometry, this._seedEffectMaterial);
    this._seedEffectGroup.add(points);

    this._seedBursts.push({
      points,
      geometry,
      positions,
      alphas,
      velocities,
      life: 0,
      aliveCount: count
    });
  }

  _updateSeedBursts(dt) {
    if (!this._seedBursts.length) return;
    const { seeds } = this.params;
    const gravity = seeds.gravity;
    const segmentsRiverbed = this.params.riverbed.segments;
    const segmentsWater = this.params.water.surfaceSegments;
    const toRemove = [];

    for (let i = 0; i < this._seedBursts.length; i++) {
      const burst = this._seedBursts[i];
      burst.life += dt;
      let anyAlive = false;

      for (let j = 0; j < burst.alphas.length; j++) {
        if (burst.alphas[j] <= 0) continue;
        const posIdx = j * 3;
        const velIdx = j * 2;

        const vx = burst.velocities[velIdx + 0];
        let vy = burst.velocities[velIdx + 1];
        vy -= gravity * dt;
        burst.velocities[velIdx + 1] = vy;

        const nx = burst.positions[posIdx + 0] + vx * dt;
        const ny = burst.positions[posIdx + 1] + vy * dt;

        const waterHeight = this._heightAt(this._waterHeights, segmentsWater, nx);
        const riverbedHeight = this._heightAt(this._riverbedHeights, segmentsRiverbed, nx);
        const barrier = Math.max(riverbedHeight, waterHeight);

        if (ny <= barrier) {
          burst.alphas[j] = 0;
          burst.positions[posIdx + 0] = nx;
          burst.positions[posIdx + 1] = barrier;
          burst.positions[posIdx + 2] = 0.04;
          burst.aliveCount -= 1;
        } else {
          burst.positions[posIdx + 0] = nx;
          burst.positions[posIdx + 1] = ny;
          anyAlive = true;
        }
      }

      burst.geometry.attributes.position.needsUpdate = true;
      burst.geometry.attributes.alpha.needsUpdate = true;

      if (!anyAlive || burst.aliveCount <= 0 || burst.life >= 4) {
        toRemove.push(i);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const burst = this._seedBursts[idx];
      this._seedEffectGroup.remove(burst.points);
      burst.geometry.dispose();
      this._seedBursts.splice(idx, 1);
    }
  }

  _updateSeedEffectSize(width, height) {
    if (!this._seedEffectMaterial) return;
    const { seeds } = this.params;
    const minSide = Math.max(1, Math.min(width || 1, height || 1));
    this._seedEffectMaterial.uniforms.size.value = Math.max(2, minSide * (seeds.particleSize || 0.02));
  }

  _handlePlantingAction(toolId, worldX, worldY) {
    if (!this._availableSeedIds.has(toolId)) return;
    const seed = this._seedCatalog.get(toolId);
    if (!seed) return;

    const clampedX = clamp(worldX, 0, this.worldWidth);
    const waterHeight = this._heightAt(this._waterHeights, this.params.water.surfaceSegments, clampedX);
    if (worldY <= waterHeight) return;

    this._emitSeedBurst(clampedX, worldY);

    const riverbedHeight = this._heightAt(this._riverbedHeights, this.params.riverbed.segments, clampedX);
    if (riverbedHeight <= waterHeight) return;

    this._spawnPlant(seed, clampedX, riverbedHeight);
  }

  _spawnPlant(seed, x, baseY) {
    const geometry = this._getSeedGeometry(seed);
    const material = this._getSeedMaterial(seed);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, baseY + seed.height * 0.5 * 0.1, 0.15);
    mesh.scale.set(1, 0.1, 1);
    mesh.renderOrder = 3;
    this.scene.add(mesh);

    const plant = {
      id: `${seed.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      seed,
      mesh,
      baseY,
      growth: 0
    };
    this._plants.push(plant);
    this._incrementPlantCount(seed.id);
    this._checkStageGoal();
  }

  _getSeedGeometry(seed) {
    if (this._seedGeometryCache.has(seed.id)) {
      return this._seedGeometryCache.get(seed.id);
    }
    const geometry = new THREE.PlaneGeometry(seed.width, seed.height);
    this._seedGeometryCache.set(seed.id, geometry);
    return geometry;
  }

  _getSeedMaterial(seed) {
    if (this._seedMaterialCache.has(seed.id)) {
      return this._seedMaterialCache.get(seed.id);
    }
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(seed.color || '#7dbf5d'),
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide
    });
    this._seedMaterialCache.set(seed.id, material);
    return material;
  }

  _incrementPlantCount(seedId) {
    this._plantCounts[seedId] = (this._plantCounts[seedId] || 0) + 1;
  }

  _updatePlants(dt) {
    if (!this._plants.length) return;
    for (let i = 0; i < this._plants.length; i++) {
      const plant = this._plants[i];
      const rate = Math.max(0.05, plant.seed.growthRate || 0.4);
      plant.growth = Math.min(1, plant.growth + dt * rate * 0.25);
      const scaleY = Math.max(0.1, plant.growth);
      plant.mesh.scale.y = scaleY;
      plant.mesh.position.y = plant.baseY + (plant.seed.height * 0.5) * scaleY;
    }
  }

  _checkStageGoal() {
    const stage = this._stages[this._currentStageIndex];
    if (!stage || this._stageComplete) return;
    const goal = stage.goal;
    if (!goal) return;
    if (goal.type === 'plantCounts') {
      const species = goal.species || {};
      const ids = Object.keys(species);
      if (!ids.length) return;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if ((this._plantCounts[id] || 0) < species[id]) {
          return;
        }
      }
      this._onStageGoalReached();
    }
  }

  _onStageGoalReached() {
    if (this._stageComplete) return;
    this._stageComplete = true;
    const stage = this._stages[this._currentStageIndex];
    if (!stage) return;

    this._showMessage(stage.completionMessage || 'Etapa completada.', {
      onComplete: () => this._scheduleStageAdvance()
    });
  }

  _scheduleStageAdvance() {
    this._clearStageAdvanceTimer();
    if (this._currentStageIndex >= this._stages.length - 1) return;
    const gap = Math.max(0, (this.params.progress?.messageGap ?? 1.0) * 1000);
    this._stageAdvanceTimer = setTimeout(() => {
      this._stageAdvanceTimer = null;
      this._advanceStage();
    }, gap);
  }

  _advanceStage() {
    this._clearStageAdvanceTimer();
    if (this._currentStageIndex >= this._stages.length - 1) return;
    this._currentStageIndex += 1;
    this._stageComplete = false;
    this._configureStageTools();
    this._showStageIntro();
  }

  _initProgression() {
    this._clearStageAdvanceTimer();
    this._clearMessageTimer();
    this._plantCounts = {};
    this._stageComplete = false;
    this._currentStageIndex = 0;
    this._configureStageTools();
    this._showStageIntro();
  }

  _configureStageTools() {
    this._availableSeedIds.clear();
    const stage = this._stages[this._currentStageIndex];
    if (stage?.allowedSeedGroups?.length) {
      stage.allowedSeedGroups.forEach((groupName) => {
        const list = this.params.seeds[groupName];
        if (!Array.isArray(list)) return;
        list.forEach((seed) => {
          this._availableSeedIds.add(seed.id);
        });
      });
    }
    if (this._activeTool && this._activeTool !== 'sediment' && !this._availableSeedIds.has(this._activeTool)) {
      this._activeTool = null;
    }
    if (!this._activeTool) {
      this._activeTool = 'sediment';
    }
    this._syncToolButtons();
  }

  _showStageIntro() {
    const stage = this._stages[this._currentStageIndex];
    if (!stage) return;
    const title = stage.name ? `${stage.name}` : 'Nueva etapa';
    const message = stage.introMessage ? `${stage.introMessage}` : '';
    const text = message ? `${title}: ${message}` : title;
    this._showMessage(text);
  }

  _showMessage(text, options = {}) {
    if (!this.app?.root) return;
    const { colors, ui, progress } = this.params;
    const duration = Math.max(0.1, options.duration ?? (progress?.messageDuration ?? 5));
    const fadeDuration = Math.max(0.1, progress?.messageFadeDuration ?? 0.6);

    if (!this._messageEl) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '50%';
      el.style.top = '12vh';
      el.style.transform = 'translate(-50%, -4vh)';
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
      el.style.transition = `opacity ${fadeDuration}s ease, transform ${fadeDuration}s ease`;
      el.style.zIndex = '12';
      this.app.root.appendChild(el);
      this._messageEl = el;
    }

    this._messageEl.textContent = text;
    this._messageEl.style.opacity = '0';
    this._messageEl.style.transform = 'translate(-50%, -4vh)';

    this._clearMessageTimer();

    requestAnimationFrame(() => {
      if (!this._messageEl) return;
      this._messageEl.style.opacity = '1';
      this._messageEl.style.transform = 'translate(-50%, 0)';
    });

    this._messageTimer = setTimeout(() => {
      this._messageTimer = null;
      this._hideMessage(options.onComplete);
    }, duration * 1000);
  }

  _hideMessage(onHidden) {
    if (!this._messageEl) {
      if (onHidden) onHidden();
      return;
    }
    const fadeDuration = Math.max(0.1, this.params.progress?.messageFadeDuration ?? 0.6);
    this._messageEl.style.opacity = '0';
    this._messageEl.style.transform = 'translate(-50%, -3vh)';

    this._messageHideTimer = setTimeout(() => {
      this._removeMessageEl();
      if (onHidden) onHidden();
      this._messageHideTimer = null;
    }, fadeDuration * 1000);
  }

  _removeMessageEl() {
    if (this._messageEl && this._messageEl.parentElement) {
      this._messageEl.parentElement.removeChild(this._messageEl);
    }
    this._messageEl = null;
  }

  _clearMessageTimer() {
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    if (this._messageHideTimer) {
      clearTimeout(this._messageHideTimer);
      this._messageHideTimer = null;
    }
  }

  _clearStageAdvanceTimer() {
    if (this._stageAdvanceTimer) {
      clearTimeout(this._stageAdvanceTimer);
      this._stageAdvanceTimer = null;
    }
  }

  _updateSediment(dt) {
    if (!this._particles.length) return;
    const { sediment } = this.params;
    const max = this._particles.length;
    const positions = this._particlePositions;
    const alphas = this._particleAlphas;
    const waterSegments = this.params.water.surfaceSegments;
    const arrivalThresholdWorld = Math.max(1e-4, sediment.arrivalThreshold) * this.worldWidth;

    let positionsDirty = false;
    let alphaDirty = false;

    for (let i = 0; i < max; i++) {
      const p = this._particles[i];
      const idx = i * 3;

      if (!p.active) {
        if (positions[idx] !== 0 || positions[idx + 1] !== 0 || positions[idx + 2] !== 0 || alphas[i] !== 0) {
          positions[idx] = positions[idx + 1] = positions[idx + 2] = 0;
          alphas[i] = 0;
          positionsDirty = true;
          alphaDirty = true;
        }
        continue;
      }

    p.age += dt;

    // Drift the particle left from the spawn edge at a fixed horizontal speed.
    const nextX = Math.max(p.targetX, p.x - p.horizontalSpeed * dt);
      p.x = nextX;

      const waterHeight = this._heightAt(this._waterHeights, waterSegments, p.x);
      const bandTop = waterHeight - sediment.bandSurfaceOffset * this.worldHeight;
      const bandDepthWorld = Math.max(1e-5, sediment.bandDepth * this.worldHeight);
      const bandBottom = bandTop - bandDepthWorld;
      const bandRange = Math.max(1e-5, bandTop - bandBottom);

    // Stay inside the vertical band that tracks the water surface, adding gentle jitter.
    const jitter = Math.sin(this._elapsed * p.jitterSpeed + p.jitterPhase) * p.jitterAmplitude;
      const base = saturate(p.bandBase + jitter);
      let desiredY = bandBottom + base * bandRange;

      if (p.x <= p.approachStartX) {
        const span = Math.max(1e-5, p.approachSpan);
        const progress = saturate((p.approachStartX - p.x) / span);
        desiredY = lerp(desiredY, p.targetY, progress);
      }

      p.y = desiredY;

      if (p.x <= p.targetX + arrivalThresholdWorld) {
        p.x = p.targetX;
        p.y = p.targetY;
        this._raiseRiverbed(p.x, sediment.depositAmount);
        this._deactivateParticle(p, i);
        positionsDirty = true;
        alphaDirty = true;
        continue;
      }

  positions[idx + 0] = p.x;
  positions[idx + 1] = p.y;
  positions[idx + 2] = -0.02;
      positionsDirty = true;

      alphas[i] = 1;
      alphaDirty = true;
    }

    if (positionsDirty && this._particlesGeometry) {
      this._particlesGeometry.attributes.position.needsUpdate = true;
    }
    if (alphaDirty && this._particlesGeometry) {
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
    p.age = 0;
    p.bandBase = 0;
    p.jitterPhase = 0;
    p.jitterSpeed = 0;
    p.jitterAmplitude = 0;
    p.horizontalSpeed = 0;
    p.targetX = 0;
    p.targetY = 0;
    p.approachStartX = 0;
    p.approachSpan = 1;
    this._activeParticles = Math.max(0, this._activeParticles - 1);
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
    const heights = this._riverbedHeights;
    if (!heights?.length) return;
    const stage = this._stages[this._currentStageIndex];
    if (!stage || this._stageComplete) return;
    const goal = stage.goal;
    if (!goal || goal.type !== 'riverbedCoverage') return;
    const threshold = Math.max(0, goal.coverage ?? 0.1);
    const level = this._waterLevels.medium;
    if (threshold === 0) {
      this._onStageGoalReached();
      return;
    }
    let elevated = 0;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] >= level + (goal.minElevationAboveWater || 0)) elevated += 1;
    }
    const coverage = elevated / heights.length;
    if (coverage >= threshold) {
      this._onStageGoalReached();
    }
  }

  _emitSediment(worldX, worldY) {
    const { sediment } = this.params;
    const waterSegments = this.params.water.surfaceSegments;
    const bedSegments = this.params.riverbed.segments;
    if (!this._waterHeights.length) return;

    const waterHeightAtClick = this._heightAt(this._waterHeights, waterSegments, worldX);
    if (worldY >= waterHeightAtClick) return;

    const spawnBase = this.worldWidth + sediment.spawnOffset * this.worldWidth;
    const spawnJitterX = sediment.spawnJitterX * this.worldWidth;
    const approachWindow = sediment.approachWindow * this.worldWidth;
    const arrivalThreshold = Math.max(1e-4, sediment.arrivalThreshold) * this.worldWidth;
    const approachLeadBase = Math.max(0, sediment.approachLead * this.worldWidth);

    const bandDepthWorld = Math.max(1e-5, sediment.bandDepth * this.worldHeight);
    const bandSurfaceOffset = sediment.bandSurfaceOffset * this.worldHeight;

    const count = sediment.emissionPerClick;
    let emitted = 0;

    for (let i = 0; i < count; i++) {
      const slot = this._acquireParticle();
      if (!slot) break;
      const { particle, index } = slot;

      const targetX = clamp(
        worldX + (Math.random() * 2 - 1) * approachWindow,
        0,
        this.worldWidth
      );
      const targetY = this._heightAt(this._riverbedHeights, bedSegments, targetX);

      const leadFactor = 0.7 + Math.random() * 0.6;
      const desiredApproachLead = approachLeadBase * leadFactor;

      let spawnX = spawnBase + (Math.random() - 0.5) * spawnJitterX;
      const minSpawnX = this.worldWidth + 0.02 * this.worldWidth;
      spawnX = Math.max(spawnX, minSpawnX, targetX + desiredApproachLead + arrivalThreshold);

      let approachStartX = Math.min(spawnX - arrivalThreshold, targetX + desiredApproachLead);
      if (approachStartX <= targetX + arrivalThreshold) {
        approachStartX = targetX + arrivalThreshold;
      }

      const waterHeightAtSpawn = this._heightAt(this._waterHeights, waterSegments, this.worldWidth);
      const bandTop = waterHeightAtSpawn - bandSurfaceOffset;
      const bandBottom = bandTop - bandDepthWorld;
      const bandRange = Math.max(1e-5, bandTop - bandBottom);

      const baseSample = Math.random();
      const baseOffset = (Math.random() - 0.5) * sediment.bandBaseJitter;
      const bandBase = clamp(baseSample + baseOffset, 0.05, 0.95);
      const initialY = bandBottom + bandBase * bandRange;

      const speedVariation = lerp(1 - sediment.horizontalSpeedJitter, 1 + sediment.horizontalSpeedJitter, Math.random());

      particle.x = spawnX;
      particle.y = initialY;
      particle.age = 0;
      particle.bandBase = bandBase;
      particle.jitterPhase = Math.random() * Math.PI * 2;
      particle.jitterSpeed = lerp(
        sediment.verticalJitterFrequencyMin,
        sediment.verticalJitterFrequencyMax,
        Math.random()
      );
      particle.jitterAmplitude = sediment.verticalJitterAmplitude * (0.5 + Math.random() * 0.5);
      particle.horizontalSpeed = Math.max(1e-3, this.worldWidth * sediment.horizontalSpeed * speedVariation);
      particle.targetX = targetX;
      particle.targetY = targetY;
      particle.approachStartX = approachStartX;
      particle.approachSpan = Math.max(arrivalThreshold, particle.approachStartX - targetX);

      const posIdx = index * 3;
  this._particlePositions[posIdx + 0] = particle.x;
  this._particlePositions[posIdx + 1] = particle.y;
  this._particlePositions[posIdx + 2] = -0.02;

      this._particleAlphas[index] = 1;

      emitted += 1;
    }

    if (emitted > 0 && this._particlesGeometry) {
      this._particlesGeometry.attributes.position.needsUpdate = true;
      this._particlesGeometry.attributes.alpha.needsUpdate = true;
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

  const seedPanel = document.createElement('div');
  const seedPanelWidth = ui.panelWidth * 0.75;
  seedPanel.style.position = 'absolute';
  seedPanel.style.left = 'auto';
  seedPanel.style.right = `${ui.panelLeft * 100}vw`;
    seedPanel.style.top = `${ui.panelTop * 100}vh`;
  seedPanel.style.width = `${seedPanelWidth * 100}vw`;
    seedPanel.style.display = 'flex';
    seedPanel.style.flexDirection = 'column';
    seedPanel.style.gap = `${ui.gap * 100}vh`;
    seedPanel.style.padding = `${ui.gap * 75}vh`;
    seedPanel.style.background = colors.uiBackground;
    seedPanel.style.borderRadius = `${ui.borderRadius * 100}vmin`;
    seedPanel.style.backdropFilter = 'blur(0.8vmin)';
    seedPanel.style.boxShadow = `0 0 ${ui.gap * 160}vh rgba(0,0,0,${ui.shadowOpacity})`;
    seedPanel.style.pointerEvents = 'auto';

    const seedTitle = document.createElement('div');
    seedTitle.textContent = 'Semillas';
    seedTitle.style.fontSize = `${ui.fontScale * 110}vmin`;
    seedTitle.style.fontWeight = '600';
    seedTitle.style.color = colors.uiText;
    seedTitle.style.marginBottom = `${ui.gap * 60}vh`;

    const colonizerGroup = document.createElement('div');
    colonizerGroup.style.display = 'flex';
    colonizerGroup.style.flexDirection = 'column';
    colonizerGroup.style.gap = `${ui.gap * 70}vh`;

    const colonizerLabel = document.createElement('div');
    colonizerLabel.textContent = 'Colonizadoras';
    colonizerLabel.style.fontSize = `${ui.fontScale * 90}vmin`;
    colonizerLabel.style.color = colors.uiText;
    colonizerLabel.style.opacity = '0.85';

    const nonColonizerGroup = document.createElement('div');
    nonColonizerGroup.style.display = 'flex';
    nonColonizerGroup.style.flexDirection = 'column';
    nonColonizerGroup.style.gap = `${ui.gap * 70}vh`;

    const nonColonizerLabel = document.createElement('div');
    nonColonizerLabel.textContent = 'No colonizadoras';
    nonColonizerLabel.style.fontSize = `${ui.fontScale * 90}vmin`;
    nonColonizerLabel.style.color = colors.uiText;
    nonColonizerLabel.style.opacity = '0.85';

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

    const registerToolButton = (type, id, button) => {
      this._seedButtons[id] = { button, type, id };
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this._toggleTool(id);
      });
    };

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
      this._toggleTool('sediment');
    });

    panel.append(btnWaterUp, btnWaterDown, btnSediment);
    seedPanel.appendChild(seedTitle);
    seedPanel.appendChild(colonizerLabel);
    seedPanel.appendChild(colonizerGroup);
    seedPanel.appendChild(nonColonizerLabel);
    seedPanel.appendChild(nonColonizerGroup);

    root.appendChild(panel);
    root.appendChild(seedPanel);

    this.app.root.appendChild(root);
    this._uiRoot = root;
    this._seedPanelWidth = seedPanelWidth;
    this._buttons = {
      panel,
      seedPanel,
      waterUp: btnWaterUp,
      waterDown: btnWaterDown,
      sediment: btnSediment
    };

    this._seedButtons = {};
    const { seeds } = this.params;
    const registerSeedGroup = (group, container, type) => {
      group.forEach((seed) => {
        const btn = makeButton(seed.label);
        btn.dataset.seedId = seed.id;
        container.appendChild(btn);
        this._seedCatalog.set(seed.id, seed);
        registerToolButton(type, seed.id, btn);
      });
    };

    registerSeedGroup(seeds.colonizers || [], colonizerGroup, 'seed');
    registerSeedGroup(seeds.nonColonizers || [], nonColonizerGroup, 'seed');

    this._syncWaterButtons();
    this._syncToolButtons();
  }

  _updateUILayout(width, height) {
    if (!this._buttons.panel) return;
    const { ui } = this.params;
    this._buttons.panel.style.left = `${ui.panelLeft * 100}vw`;
    this._buttons.panel.style.top = `${ui.panelTop * 100}vh`;
    this._buttons.panel.style.width = `${ui.panelWidth * 100}vw`;
    if (this._buttons.seedPanel) {
      const seedPanelWidth = this._seedPanelWidth ?? ui.panelWidth;
      this._buttons.seedPanel.style.left = 'auto';
      this._buttons.seedPanel.style.right = `${ui.panelLeft * 100}vw`;
      this._buttons.seedPanel.style.top = `${ui.panelTop * 100}vh`;
      this._buttons.seedPanel.style.width = `${seedPanelWidth * 100}vw`;
    }
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

  _syncToolButtons() {
    const { colors, ui } = this.params;
    const activeId = this._activeTool;
    const applyButtonStyles = (btn, isActive) => {
      if (!btn) return;
      if (isActive) {
        btn.dataset.lockedColor = '1';
        btn.style.background = colors.uiAccent;
        btn.style.color = '#0a223d';
        btn.style.boxShadow = `0 0 ${(ui.gap * 200).toFixed(3)}vh rgba(255, 209, 102, 0.55)`;
      } else {
        delete btn.dataset.lockedColor;
        btn.style.background = colors.uiBackground;
        btn.style.color = colors.uiText;
        btn.style.boxShadow = `0 0 ${(ui.gap * 120).toFixed(3)}vh rgba(0,0,0,${ui.shadowOpacity * 0.6})`;
      }
    };

    applyButtonStyles(this._buttons.sediment, activeId === 'sediment');

    Object.values(this._seedButtons).forEach(({ button, id }) => {
      const available = this._availableSeedIds.has(id);
      button.disabled = !available;
      button.style.opacity = available ? '1' : '0.35';
      applyButtonStyles(button, activeId === id);
    });

    if (this.app?.canvas) {
      const cursor = activeId && activeId !== 'sediment' ? 'copy' : activeId === 'sediment' ? 'crosshair' : 'default';
      this.app.canvas.style.cursor = cursor;
    }
    if (activeId !== 'sediment') {
      this._pointerDown = false;
    }
  }

  _toggleTool(toolId) {
    if (toolId === this._activeTool) {
      this._activeTool = null;
    } else {
      if (toolId === 'sediment' || this._availableSeedIds.has(toolId)) {
        this._activeTool = toolId;
      }
    }
    this._syncToolButtons();
  }

  _destroyUI() {
    if (this._uiRoot && this._uiRoot.parentElement) {
      this._uiRoot.parentElement.removeChild(this._uiRoot);
    }
    this._uiRoot = null;
    this._buttons = {};
    this._seedPanelWidth = null;
    this._seedButtons = {};
    this._activeTool = null;
    this._removeMessageEl();
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
    if (event.button !== 0) return;
    const tool = this._activeTool;
    if (!tool) return;
    const point = this._getWorldPointer(event);
    if (!point) return;
    if (tool === 'sediment') {
      this._pointerDown = true;
      this._emitSediment(point.x, point.y);
    } else {
      this._handlePlantingAction(tool, point.x, point.y);
    }
  }

  _handlePointerMove(event) {
    if (!this._pointerDown || this._activeTool !== 'sediment' || event.buttons === 0) return;
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

    if (this._seedEffectGroup) {
      for (let i = 0; i < this._seedEffectGroup.children.length; i++) {
        const child = this._seedEffectGroup.children[i];
        if (child.geometry) child.geometry.dispose?.();
      }
      this.scene.remove(this._seedEffectGroup);
    }
    if (this._seedEffectMaterial) {
      this._seedEffectMaterial.dispose?.();
    }

    for (let i = 0; i < this._plants.length; i++) {
      const plant = this._plants[i];
      if (plant.mesh) {
        this.scene.remove(plant.mesh);
      }
    }

    this._seedGeometryCache.forEach((geo) => geo.dispose?.());
    this._seedMaterialCache.forEach((mat) => mat.dispose?.());
    this._seedGeometryCache.clear();
    this._seedMaterialCache.clear();
  this._seedCatalog.clear();

    this._seedBursts = [];
    this._seedEffectGroup = null;
    this._seedEffectMaterial = null;
    this._plants = [];
    this._plantCounts = {};
    this._availableSeedIds.clear();

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
