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

const WEATHER_PLAYBACK_SPEED = 2;

export const DEFAULT_PARAMS = Object.freeze({
  world: Object.freeze({
    top: 1,
    bottom: -0.38,
    cameraZ: 6.5,
    backgroundZ: -2,
    backgroundImage: '/game-assets/simulador/bg.png'
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
    uiText: '#f8fafc',
    cursorSediment: '#d6b17e',
    cursorSeed: '#68c08b',
    cursorRemove: '#e76f51',
    cursorDisabled: '#8a96a8'
  }),
  water: Object.freeze({
    surfaceSegments: 200,
    baseLevel: 0.35,
    levelDelta: 0.25,
    bottom: -0.4,
    smoothing: 2.2,
    opacity: 0.6,
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
    baseHeight: -0.32,
    highBaseline: -0.16,
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
    smoothing: 1.1,
    texture: Object.freeze({
      image: '/game-assets/simulador/sand.png',
      tileWidthRatio: 0.24
    })
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
    depositAmount: 0.01,
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
      Object.freeze({
        id: 'aliso',
        label: 'Aliso',
        color: '#7dbf5d',
        width: 0.04,
        height: 0.18,
        growthRate: 0.55,
        assetName: 'aliso',
        spriteWidthRatio: 0.06,
        bottomMargin: 0.15,
        spriteStageMap: Object.freeze([0, 1, 1, 1, 1]),
        spriteTransitionMap: Object.freeze({ 0: true }),
        spriteTransitionFrames: Object.freeze({ 0: 5 })
      }),
      Object.freeze({
        id: 'sauce',
        label: 'Sauce',
        color: '#6eb48f',
        width: 0.036,
        height: 0.17,
        growthRate: 0.6,
        assetName: 'sauce',
        spriteWidthRatio: 0.14,
        bottomMargin: 0.15
      }),
      Object.freeze({
        id: 'ambigua',
        label: 'Ambigua',
        color: '#5d9d6d',
        width: 0.034,
        height: 0.15,
        growthRate: 0.58,
        assetName: 'ambigua',
        spriteWidthRatio: 0.07,
        bottomMargin: 0.15
      }),
      Object.freeze({
        id: 'distichlis',
        label: 'Distichlis',
        color: '#4e7d5a',
        width: 0.03,
        height: 0.13,
        growthRate: 0.62,
        assetName: 'distichlis',
        spriteWidthRatio: 0.07,
        bottomMargin: 0.15
      })
    ]),
    nonColonizers: Object.freeze([
      Object.freeze({
        id: 'ceibo',
        label: 'Ceibo',
        color: '#b58b5a',
        width: 0.05,
        height: 0.24,
        growthRate: 0.45,
        assetName: 'ceibo',
        spriteWidthRatio: 0.1,
        bottomMargin: 0.15
      }),
      Object.freeze({
        id: 'drago',
        label: 'Drago',
        color: '#a8733d',
        width: 0.048,
        height: 0.22,
        growthRate: 0.48,
        assetName: 'drago',
        spriteWidthRatio: 0.1,
        bottomMargin: 0.15
      }),
      Object.freeze({
        id: 'acacia',
        label: 'Acacia',
        color: '#8b6a32',
        width: 0.052,
        height: 0.26,
        growthRate: 0.5,
        assetName: 'acacia',
        spriteWidthRatio: 0.1,
        bottomMargin: 0.15
      })
    ])
  }),
  interactions: Object.freeze({
    sedimentHeightEpsilon: 0.006,
    plantHeightEpsilon: 0.02,
    seedBurstHeightOffset: 0.06,
    plantSubmergeOffset: 0.0008,
    plantEmergenceOffset: 0.0008
  }),
  ui: Object.freeze({
    gap: 0.012,
    fontScale: 0.028,
    borderRadius: 0.035,
    shadowOpacity: 0.4,
    cursor: Object.freeze({
      diameterVW: 1.8,
      borderWidthVW: 0.14,
      transitionSeconds: 0.12
    }),
    goalMessage: Object.freeze({
      bottomOffsetVW: 3.6,
      fontSizeVW: 1.3,
      paddingVW: 1.1,
      maxWidthVW: 48,
      borderRadiusVW: 2.0
    }),
    elements: Object.freeze({
      basePath: '/game-assets/simulador/UI',
      logo: Object.freeze({
        image: 'logo.png',
        leftPct: 91.1373,
        topPct: 86.5553,
        widthPct: 6.3922,
        heightPct: 11.2967,
        zIndex: 9
      }),
      sedimentButton: Object.freeze({
        image: 'sediment_button.png',
        leftPct: 75.8039,
        topPct: 87.2713,
        widthPct: 6.2353,
        heightPct: 7.8759,
        zIndex: 11
      }),
      removeButton: Object.freeze({
        image: 'remove_plant.png',
        leftPct: 84.1176,
        topPct: 84.1687,
        widthPct: 3.6471,
        heightPct: 13.6834,
        zIndex: 11
      }),
      seeder: Object.freeze({
        image: 'seeder.png',
        leftPct: 92.4314,
        topPct: 24.105,
        widthPct: 3.6471,
        heightPct: 59.2681,
        segments: 7,
        zIndex: 10,
        seedOrder: Object.freeze(['aliso', 'sauce', 'ambigua', 'distichlis', 'ceibo', 'drago', 'acacia'])
      }),
      seedImages: Object.freeze({
        aliso: 'aliso.png',
        sauce: 'sauce.png',
        ambigua: 'ambigua.png',
        distichlis: 'distichlis.png',
        ceibo: 'ceibo.png',
        drago: 'drago.png',
        acacia: 'acacia.png'
      }),
      weather: Object.freeze({
        fps: 25,
        top: Object.freeze({
          folder: 'weather_top',
          framePrefix: 'weather_top_',
          frameDigits: 5,
          frameExtension: '.png',
          area: Object.freeze({
            leftPct: 87.3,
            topPct: 5,
            widthPct: 13.6157,
            heightPct: 15.5370,
            zIndex: 8
          }),
          frames: Object.freeze({
            low: 50,
            medium: 154,
            highTransitionStart: 233,
            highLoopStart: 233,
            highLoopEnd: 602
          })
        }),
        bottom: Object.freeze({
          folder: 'weather_bottom',
          framePrefix: 'weather_bottom_',
          frameDigits: 5,
          frameExtension: '.png',
          area: Object.freeze({
            leftPct: 87.3,
            topPct: 5,
            widthPct: 13.6157,
            heightPct: 15.5370,
            zIndex: 8
          }),
          frames: Object.freeze({
            low: 233,
            medium: 154,
            high: 50
          })
        })
      })
    })
  }),
  progress: Object.freeze({
    messageDuration: 5.5,
    messageFadeDuration: 0.6,
    messageGap: 1.2,
    victoryMessage: '¡Lograste equilibrar el ecosistema! Has ganado.',
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
            aliso: 3,
            sauce: 3,
            ambigua: 3,
            distichlis: 3
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
            ceibo: 3,
            drago: 3,
            acacia: 3
          })
        }),
        allowedSeedGroups: Object.freeze(['colonizers', 'nonColonizers'])
      })
    ])
  }),
  plantGrowth: Object.freeze({
    transitionDuration: 2.0,
    geometrySegments: 20,
    stageScales: Object.freeze({
      seedRadius: 0.45,
      germWidth: 0.38,
      germHeight: 0.35,
      smallWidth: 0.55,
      smallHeight: 0.55,
      mediumWidth: 0.75,
      mediumHeight: 0.78,
      largeWidth: 1.0,
      largeHeight: 1.0
    }),
    visuals: Object.freeze({
      enableSprites: true,
      basePath: '/game-assets/simulador/plants/webp_seq',
      spriteWidthRatio: 0.1,
      bottomMargin: 0.15,
      transitionFps: 12,
      stageFps: 12,
      frameDigits: 3,
      frameExtension: '.webp',
      maxFramesPerClip: 240
    })
  }),
  plantCompetition: Object.freeze({
    neighborRadius: 0.02,
    minNeighbors: 4
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
    this._currentWaterLevel = this._waterLevels.low;
    this._targetWaterLevel = this._currentWaterLevel;
    this._waterLevelIndex = 0; // 0 low, 1 medium, 2 high

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
    this._seedButtons = {};
    this._activeTool = null;
    this._pointerDown = false;
    this._cursorEl = null;
    this._lastPointerInfo = null;
    this._goalMessageEl = null;
    this._originalCanvasCursor = null;

    this._availableSeedIds = new Set();
    this._seedCatalog = new Map();
    this._plantGeometryCache = new Map();
    this._seedMaterialCache = new Map();
    this._plantSequenceCache = new Map();
    this._plantMaterialCache = new Map();

    this._background = null;
    this._backgroundTexture = null;
    this._sandTexture = null;
    this._sandTileRatio = this.params.riverbed?.texture?.tileWidthRatio ?? 0.1;

    this._seedBursts = [];

    this._plants = [];
    this._plantStages = [
      { id: 'seed', nextRequiresSubmerged: true },
      { id: 'germinated', nextRequiresSubmerged: false },
      { id: 'small', nextRequiresSubmerged: true },
      { id: 'medium', nextRequiresSubmerged: false },
      { id: 'large', nextRequiresSubmerged: null }
    ];

    this._textureLoader = new THREE.TextureLoader();
    this._unitPlantPlane = new THREE.PlaneGeometry(1, 1);

    this._messageEl = null;
    this._messageTimer = null;
    this._messageHideTimer = null;
    this._stageAdvanceTimer = null;

    this._stages = this.params.progress.stages;
    this._currentStageIndex = 0;
    this._stageComplete = false;

    this._weatherConfig = null;
    this._weatherChannels = {};
    this._weatherAnimations = {};
    this._weatherTransitionPromise = Promise.resolve();
    this._weatherState = 'low';
    this._weatherCurrentFrame = { top: null, bottom: null };
    this._uiAssetBasePath = this.params.ui?.elements?.basePath || '';

    this._boundOnPointerDown = (e) => this._handlePointerDown(e);
    this._boundOnPointerMove = (e) => this._handlePointerMove(e);
    this._boundOnPointerUp = () => { this._pointerDown = false; };
    this._boundOnPointerLeave = () => this._handlePointerLeave();
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
    this._preloadAllPlantSequences();
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
    if (this._lastPointerInfo) {
      this._refreshCursor();
    }
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
    for (let i = 0; i < this._plants.length; i++) {
      this._refreshPlantVisual(this._plants[i]);
    }
    this._updateParticleSize(width, height);
    this._updateSeedEffectSize(width, height);
  }

  _createBackground() {
    const { world, colors } = this.params;

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.skyBottom || '#ffffff'),
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false
    });

    this._background = new THREE.Mesh(geometry, material);
    this._background.renderOrder = -100;
    this._background.position.z = world.backgroundZ;
    this.scene.add(this._background);

    const imagePath = world.backgroundImage;
    if (imagePath) {
      if (!this._textureLoader) {
        this._textureLoader = new THREE.TextureLoader();
      }
      this._backgroundTexture = this._textureLoader.load(
        imagePath,
        () => {
          this._prepareTexture(this._backgroundTexture);
          if (this._background?.material) {
            this._background.material.map = this._backgroundTexture;
            this._background.material.color.setHex(0xffffff);
            this._background.material.needsUpdate = true;
          }
          this._layoutBackground();
        }
      );
    } else {
      material.map = null;
    }
  }

  _layoutBackground() {
    if (!this._background) return;
    const width = this.worldWidth;
    const height = this.worldHeight;

    let scaleX = width;
    let scaleY = height;
    const texture = this._backgroundTexture;
    const texWidth = texture?.image?.width;
    const texHeight = texture?.image?.height;
    if (texWidth && texHeight) {
      const texRatio = texWidth / texHeight;
      const viewRatio = width / height;
      if (viewRatio > texRatio) {
        scaleX = width;
        scaleY = width / texRatio;
      } else {
        scaleY = height;
        scaleX = height * texRatio;
      }
    }

    this._background.scale.set(scaleX, scaleY, 1);
    this._background.position.set(
      width * 0.5,
      (this.worldTop + this.worldBottom) * 0.5,
      this.params.world.backgroundZ
    );
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
    this._waterStrip.mesh.renderOrder = 3;
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
    this._averageLine.renderOrder = 4;
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
    const { riverbed } = this.params;
    const segments = riverbed.segments;
    const { geometry, topIndices, bottomIndices } = this._buildStripGeometry(segments);
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    this._riverbedStrip = {
      mesh: new THREE.Mesh(geometry, material),
      geometry,
      topIndices,
      bottomIndices
    };
    this._riverbedStrip.mesh.position.z = -0.05;
    this.scene.add(this._riverbedStrip.mesh);

    const texturePath = riverbed.texture?.image;
    if (texturePath) {
      if (!this._textureLoader) {
        this._textureLoader = new THREE.TextureLoader();
      }
      this._sandTexture = this._textureLoader.load(
        texturePath,
        () => {
          this._prepareTexture(this._sandTexture);
          if (this._sandTexture) {
            this._sandTexture.wrapS = THREE.RepeatWrapping;
            this._sandTexture.wrapT = THREE.RepeatWrapping;
            this._sandTexture.needsUpdate = true;
          }
          this._updateRiverbedUVs();
          if (this._riverbedStrip?.mesh?.material) {
            this._riverbedStrip.mesh.material.needsUpdate = true;
          }
        }
      );
      if (this._sandTexture) {
        this._sandTexture.wrapS = THREE.RepeatWrapping;
        this._sandTexture.wrapT = THREE.RepeatWrapping;
        this._sandTexture.needsUpdate = true;
        material.map = this._sandTexture;
        material.needsUpdate = true;
      }
    }

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
    this._updateRiverbedUVs();
  }

  _updateRiverbedUVs() {
    if (!this._riverbedStrip) return;
    const { geometry, topIndices, bottomIndices } = this._riverbedStrip;
    const uvsAttr = geometry.attributes.uv;
    if (!uvsAttr) return;
    const positions = geometry.attributes.position.array;
    const uvs = uvsAttr.array;
    const tileRatio = Math.max(1e-4, this._sandTileRatio || 0.1);
    const tileSize = Math.max(1e-4, this.worldWidth * tileRatio);
    const bedBottom = this.params.riverbed.bottom;
    const segments = this.params.riverbed.segments;

    for (let i = 0; i <= segments; i++) {
      const topIndex = topIndices[i];
      const bottomIndex = bottomIndices[i];
      const topPosIdx = topIndex * 3;
      const bottomPosIdx = bottomIndex * 3;
      const topUvIdx = topIndex * 2;
      const bottomUvIdx = bottomIndex * 2;

      const topX = positions[topPosIdx + 0];
      const topY = positions[topPosIdx + 1];
      const bottomX = positions[bottomPosIdx + 0];
      const bottomY = positions[bottomPosIdx + 1];

      uvs[topUvIdx + 0] = topX / tileSize;
      uvs[topUvIdx + 1] = (topY - bedBottom) / tileSize;
      uvs[bottomUvIdx + 0] = bottomX / tileSize;
      uvs[bottomUvIdx + 1] = (bottomY - bedBottom) / tileSize;
    }

    uvsAttr.needsUpdate = true;
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
    this._updateRiverbedUVs();
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
  this._particlesPoints.renderOrder = 1;
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
    this._seedEffectGroup.renderOrder = 5;
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

  _getPlantVisualConfig() {
    const visuals = this.params.plantGrowth?.visuals;
    if (!visuals) return null;
    if (visuals.enableSprites === false) return null;
    return visuals;
  }

  _stageIdToIndex(stageId) {
    if (!stageId) return 0;
    const idx = this._plantStages.findIndex((stage) => stage.id === stageId);
    return idx >= 0 ? idx : 0;
  }

  _resolvePlantAssetName(seed) {
    if (!seed) return null;
    if (seed.assetName) return String(seed.assetName).toLowerCase();
    return null;
  }

  _getSeedSpriteWidthRatio(seed) {
    const visuals = this.params.plantGrowth?.visuals || {};
    const ratio = typeof seed?.spriteWidthRatio === 'number'
      ? seed.spriteWidthRatio
      : visuals.spriteWidthRatio;
    return Math.max(1e-5, ratio ?? 0.005);
  }

  _getSeedBottomMargin(seed) {
    const visuals = this.params.plantGrowth?.visuals || {};
    const margin = typeof seed?.bottomMargin === 'number'
      ? seed.bottomMargin
      : visuals.bottomMargin;
    return clamp(margin ?? 0.05, 0, 1);
  }

  _computePlantDepth(centerY) {
    const frontZ = -0.02;
    const backZ = -0.045;
    const height = Math.max(1e-5, this.worldHeight);
    // Lower plants (smaller normalized) get a larger z so they render in front of higher plants.
    const normalized = clamp((centerY - this.worldBottom) / height, 0, 1);
    return backZ + (1 - normalized) * (frontZ - backZ);
  }

  _setPlantDepth(plant, centerY) {
    if (!plant?.mesh) return;
    plant.mesh.position.z = this._computePlantDepth(centerY);
  }

  _spriteStageAssetIndex(seed, stageIndex) {
    if (!seed || !Number.isInteger(stageIndex)) return null;
    const map = seed.spriteStageMap;
    if (Array.isArray(map)) {
      const clampedIndex = stageIndex < map.length ? stageIndex : map.length - 1;
      if (clampedIndex < 0) return null;
      const value = map[clampedIndex];
      if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
      if (value === null || typeof value === 'undefined') return null;
      return value;
    }
    const maxIndex = typeof seed.maxSpriteStageIndex === 'number' ? seed.maxSpriteStageIndex : null;
    if (maxIndex !== null) {
      return Math.min(stageIndex, maxIndex);
    }
    return stageIndex;
  }

  _spriteTransitionEnabled(seed, fromStageIndex) {
    if (!seed || !Number.isInteger(fromStageIndex)) return false;
    const map = seed.spriteTransitionMap;
    if (map && Object.prototype.hasOwnProperty.call(map, fromStageIndex)) {
      return !!map[fromStageIndex];
    }
    return true;
  }

  _normalizeAssetPath(basePath, filename) {
    const cleanBase = basePath ? basePath.replace(/\\/g, '/').replace(/\/+$/, '') : '';
    if (!cleanBase) return filename;
    return `${cleanBase}/${filename}`;
  }

  _loadTexture(url) {
    return new Promise((resolve, reject) => {
      if (!this._textureLoader) {
        this._textureLoader = new THREE.TextureLoader();
      }
      this._textureLoader.load(
        url,
        (texture) => resolve(texture),
        undefined,
        () => reject(new Error(`Failed to load texture: ${url}`))
      );
    });
  }

  _prepareTexture(texture) {
    if (!texture) return;
    if ('colorSpace' in texture && THREE && typeof THREE.SRGBColorSpace !== 'undefined') {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if ('encoding' in texture && THREE && typeof THREE.sRGBEncoding !== 'undefined') {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.needsUpdate = true;
  }

  _createFrameRecord(texture) {
    const frame = {
      texture,
      width: 1,
      height: 1,
      imageData: null,
      canvas: null
    };
    const image = texture?.image;
    if (image) {
      frame.width = image.width || 1;
      frame.height = image.height || 1;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, 0, 0);
          frame.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          frame.canvas = canvas;
        }
      } catch (err) {
        frame.imageData = null;
      }
    }
    return frame;
  }

  _getPlantStageSequence(seed, stageIndex) {
    const assetStage = this._spriteStageAssetIndex(seed, stageIndex);
    return this._getOrLoadSequence(seed, {
      type: 'stage',
      stageIndex,
      assetStage
    });
  }

  _getPlantTransitionSequence(seed, fromStageIndex, toStageIndex) {
    if (!this._spriteTransitionEnabled(seed, fromStageIndex)) {
      return null;
    }
    const fromAssetStage = this._spriteStageAssetIndex(seed, fromStageIndex);
    const toAssetStage = this._spriteStageAssetIndex(seed, toStageIndex);
    return this._getOrLoadSequence(seed, {
      type: 'transition',
      fromStageIndex,
      toStageIndex,
      fromAssetStage,
      toAssetStage
    });
  }

  _getOrLoadSequence(seed, options) {
    const visuals = this._getPlantVisualConfig();
    if (!visuals) return null;
    const assetName = this._resolvePlantAssetName(seed);
    if (!assetName) return null;

    const type = options.type;
    const stageIndex = options.stageIndex;
    const assetStage = options.assetStage;
    const fromStageIndex = options.fromStageIndex;
    const toStageIndex = options.toStageIndex;
    const fromAssetStage = options.fromAssetStage;
    const toAssetStage = options.toAssetStage;

    const candidates = [];
    const seen = new Set();

    const addStageCandidate = (value) => {
      if (!Number.isFinite(value)) return;
      const intValue = Math.max(0, Math.floor(value));
      const key = `stage-${intValue}`;
      if (seen.has(key)) return;
      seen.add(key);
      const folderName = `${assetName}-stage-${intValue}`;
      candidates.push({ folderName, filenamePrefix: folderName });
    };

    const addTransitionCandidate = (fromValue, toValue) => {
      if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) return;
      const fromInt = Math.max(0, Math.floor(fromValue));
      const toInt = Math.max(0, Math.floor(toValue));
      const key = `transition-${fromInt}-${toInt}`;
      if (seen.has(key)) return;
      seen.add(key);
      const folderName = `${assetName}-stage-${fromInt}-to-${toInt}`;
      candidates.push({ folderName, filenamePrefix: folderName });
    };

    if (type === 'stage') {
      addStageCandidate(stageIndex);
      if (assetStage !== null && typeof assetStage !== 'undefined') {
        addStageCandidate(assetStage);
      }
    } else {
      addTransitionCandidate(fromStageIndex, toStageIndex);
      if (fromAssetStage !== null && typeof fromAssetStage !== 'undefined' && toAssetStage !== null && typeof toAssetStage !== 'undefined') {
        addTransitionCandidate(fromAssetStage, toAssetStage);
      }
    }

    if (!candidates.length) {
      return null;
    }

    let cacheKey;
    if (type === 'stage') {
      cacheKey = `stage|${assetName}|${Math.max(0, Math.floor(stageIndex ?? 0))}`;
    } else {
      cacheKey = `transition|${assetName}|${Math.max(0, Math.floor(fromStageIndex ?? 0))}->${Math.max(0, Math.floor(toStageIndex ?? 0))}`;
    }

    let entry = this._plantSequenceCache.get(cacheKey);
    const basePath = visuals.basePath || '';
    const extension = visuals.frameExtension || '.webp';
    const frameDigits = Math.max(1, visuals.frameDigits ?? 3);
    const maxFrames = Math.max(1, visuals.maxFramesPerClip ?? 240);
    const transitionFps = Math.max(1, visuals.transitionFps ?? 12);
    const stageFps = Math.max(1, visuals.stageFps ?? transitionFps);

    const fps = type === 'transition' ? transitionFps : stageFps;
    const loop = type === 'transition' ? false : true;

    if (!entry) {
      entry = {
        key: cacheKey,
        status: 'loading',
        frames: [],
        fps,
        loop,
        type,
        callbacks: [],
        promise: null
      };
      this._plantSequenceCache.set(cacheKey, entry);
      entry.promise = this._loadPlantSequence(entry, {
        basePath,
        candidates,
        extension,
        frameDigits,
        maxFrames
      }).catch(() => {
        entry.status = 'error';
      }).finally(() => {
        entry.promise = null;
        const callbacks = entry.callbacks.splice(0);
        for (let i = 0; i < callbacks.length; i++) {
          const cb = callbacks[i];
          try {
            cb(entry);
          } catch (err) {
            // ignore callback errors
          }
        }
      });
    } else {
      entry.fps = fps;
      entry.loop = loop;
    }

    return entry;
  }

  async _loadPlantSequence(entry, descriptor) {
    const { basePath, candidates, extension, frameDigits, maxFrames } = descriptor;

    for (let c = 0; c < candidates.length; c++) {
      const candidate = candidates[c];
      const folderPath = this._normalizeAssetPath(basePath, candidate.folderName);
      const frames = [];

      for (let index = 0; index < maxFrames; index++) {
        const suffix = index.toString().padStart(frameDigits, '0');
        const filename = `${candidate.filenamePrefix}_${suffix}${extension}`;
        const url = this._normalizeAssetPath(folderPath, filename);
        try {
          const texture = await this._loadTexture(url);
          if (!texture) {
            break;
          }
          this._prepareTexture(texture);
          frames.push(this._createFrameRecord(texture));
        } catch (err) {
          if (index === 0) {
            frames.length = 0;
          }
          break;
        }
      }

      if (frames.length > 0) {
        entry.frames = frames;
        entry.status = 'ready';
        entry.activeCandidate = candidate;
        return entry;
      }
    }

    entry.frames = [];
    entry.status = 'error';
    return entry;
  }

  _addSequenceReadyCallback(entry, callback) {
    if (!entry || typeof callback !== 'function') return;
    if (entry.status === 'ready' || entry.status === 'error') {
      callback(entry);
      return;
    }
    entry.callbacks.push(callback);
  }

  _primePlantAssets(seed) {
    const visuals = this._getPlantVisualConfig();
    if (!visuals) return;
    for (let i = 0; i < this._plantStages.length; i++) {
      this._getPlantStageSequence(seed, i);
    }
    for (let i = 0; i < this._plantStages.length - 1; i++) {
      this._getPlantTransitionSequence(seed, i, i + 1);
    }
  }

  _preloadAllPlantSequences() {
    const seedsConfig = this.params.seeds || {};
    const seen = new Set();
    const enqueue = (list) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const seed = list[i];
        if (!seed || !seed.id) continue;
        if (seen.has(seed.id)) continue;
        seen.add(seed.id);
        this._primePlantAssets(seed);
      }
    };

    Object.values(seedsConfig).forEach((value) => enqueue(value));
  }

  _ensurePlantMaterial(plant) {
    if (!plant) return null;
    let material = plant.imageMaterial;
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthTest: false,
        alphaTest: 0.01
      });
      plant.imageMaterial = material;
      this._plantMaterialCache.set(plant.id, material);
    }
    return material;
  }

  _playPlantAnimation(plant, entry, options = {}) {
    if (!plant || !entry || entry.status !== 'ready' || !entry.frames.length) return;
    if (!this._unitPlantPlane) {
      this._unitPlantPlane = new THREE.PlaneGeometry(1, 1);
    }
    const fps = Math.max(1, options.fps ?? entry.fps ?? 12);
    const loop = options.loop !== undefined ? options.loop : entry.loop;
    const startFrame = clamp(options.startFrame ?? 0, 0, entry.frames.length - 1);
    plant.animation = {
      entry,
      fps,
      loop,
      frameIndex: startFrame,
      timer: 0,
      onComplete: options.onComplete || null
    };
    plant.pendingTransition = null;
    plant.visualMode = 'image';
    plant.mesh.geometry = this._unitPlantPlane;
    plant.mesh.material = this._ensurePlantMaterial(plant);
    this._applyFrameToPlant(plant, entry.frames[startFrame]);
  }

  _applyFrameToPlant(plant, frame) {
    if (!plant || !frame) return;
    const visuals = this._getPlantVisualConfig();
    if (!visuals) return;
    const material = this._ensurePlantMaterial(plant);
    if (material.map !== frame.texture) {
      material.map = frame.texture || null;
      material.needsUpdate = true;
      if (material.map) {
        material.map.needsUpdate = true;
      }
    }
    material.color.setHex(0xffffff);
    material.opacity = 1;

    const widthRatio = this._getSeedSpriteWidthRatio(plant.seed);
    const widthWorld = Math.max(1e-5, this.worldWidth * widthRatio);
    const aspect = frame.height && frame.width ? frame.height / frame.width : 1;
    const heightWorld = Math.max(1e-5, widthWorld * aspect);

    plant.mesh.geometry = this._unitPlantPlane;
    plant.mesh.material = material;
    plant.mesh.scale.set(widthWorld, heightWorld, 1);
    plant.mesh.rotation.set(0, 0, 0);
    plant.mesh.position.x = plant.x;
    const margin = this._getSeedBottomMargin(plant.seed);
    const centerY = plant.baseY + (0.5 - margin) * heightWorld;
    plant.mesh.position.y = centerY;
    this._setPlantDepth(plant, centerY);

    plant.visualMode = 'image';
    plant.visualWidth = widthWorld;
    plant.visualHeight = heightWorld;
    plant.visualMargin = margin;
    plant.currentStageHeight = heightWorld;
    plant.currentStageHalfWidth = Math.max(widthWorld * 0.5, 0.01);
    plant.activeFrame = frame;
  }

  _updatePlantAnimation(plant, dt) {
    const anim = plant?.animation;
    if (!anim || !anim.entry?.frames?.length) return;
    anim.timer += dt;
    const frameDuration = 1 / Math.max(1, anim.fps);
    let advanced = false;

    while (anim.timer >= frameDuration) {
      anim.timer -= frameDuration;
      anim.frameIndex += 1;
      advanced = true;
      if (anim.frameIndex >= anim.entry.frames.length) {
        if (anim.loop) {
          anim.frameIndex = 0;
        } else {
          const onComplete = anim.onComplete;
          plant.animation = null;
          if (onComplete) {
            onComplete();
          }
          return;
        }
      }
    }

    if (advanced) {
      const frame = anim.entry.frames[anim.frameIndex];
      if (frame) {
        this._applyFrameToPlant(plant, frame);
      }
    }
  }

  _startPlantTransition(plant, nextIndex) {
    if (!plant) return;
    if (nextIndex <= plant.stageIndex) return;
    if (nextIndex >= this._plantStages.length) return;

    const sequence = this._getPlantTransitionSequence(plant.seed, plant.stageIndex, nextIndex);
    if (!sequence || sequence.status === 'error') {
      this._completePlantStageChange(plant, nextIndex);
      return;
    }

    const startTransition = (entry) => {
      plant.waitingTransitionKey = null;
      if (entry.status !== 'ready' || !entry.frames.length) {
        this._completePlantStageChange(plant, nextIndex);
        return;
      }
      this._playPlantAnimation(plant, entry, {
        loop: false,
        fps: entry.fps,
        onComplete: () => this._completePlantStageChange(plant, nextIndex)
      });
    };

    if (sequence.status === 'ready') {
      plant.waitingTransitionKey = null;
      startTransition(sequence);
    } else if (sequence.status === 'loading') {
      const alreadyWaiting = plant.pendingTransition === nextIndex && plant.waitingTransitionKey === sequence.key;
      plant.pendingTransition = nextIndex;
      plant.waitingTransitionKey = sequence.key;
      if (!alreadyWaiting) {
        this._addSequenceReadyCallback(sequence, (entry) => {
          if (plant.pendingTransition !== nextIndex) return;
          startTransition(entry);
        });
      }
    } else {
      this._completePlantStageChange(plant, nextIndex);
    }
  }

  _completePlantStageChange(plant, nextIndex) {
    if (!plant) return;
    plant.pendingTransition = null;
    plant.waitingTransitionKey = null;
    plant.animation = null;
    if (Number.isInteger(nextIndex) && nextIndex > plant.stageIndex && nextIndex < this._plantStages.length) {
      plant.stageIndex = nextIndex;
    }
    plant.stageTimer = 0;
    this._applyPlantStageVisual(plant);
    if (this._lastPointerInfo) {
      this._refreshCursor();
    }
  }

  _refreshPlantVisual(plant) {
    if (!plant) return;
    const anim = plant.animation;
    if (anim && anim.entry?.frames?.length) {
      const frame = anim.entry.frames[clamp(anim.frameIndex, 0, anim.entry.frames.length - 1)];
      if (frame) {
        this._applyFrameToPlant(plant, frame);
        return;
      }
    }

    if (plant.pendingTransition !== null) {
      this._startPlantTransition(plant, plant.pendingTransition);
      if (plant.animation && plant.animation.entry?.frames?.length) {
        const frame = plant.animation.entry.frames[clamp(plant.animation.frameIndex, 0, plant.animation.entry.frames.length - 1)];
        if (frame) {
          this._applyFrameToPlant(plant, frame);
          return;
        }
      }
    }

    if (plant.visualMode === 'geometry') {
      this._applyPlantStageVisual(plant);
    }
  }

  _sampleFrameAlpha(frame, u, v) {
    if (!frame?.imageData) return 1;
    const data = frame.imageData;
    const width = data.width || frame.width || 1;
    const height = data.height || frame.height || 1;
    if (!width || !height) return 1;
    const uu = clamp(u, 0, 1);
    const vv = clamp(v, 0, 1);
    const px = Math.min(width - 1, Math.max(0, Math.round(uu * (width - 1))));
    const py = Math.min(height - 1, Math.max(0, Math.round((1 - vv) * (height - 1))));
    const idx = (py * width + px) * 4 + 3;
    const alpha = data.data?.[idx] ?? 255;
    return alpha / 255;
  }

  _handlePlantingAction(toolId, worldX, worldY) {
    if (!this._availableSeedIds.has(toolId)) return false;
    const seed = this._seedCatalog.get(toolId);
    if (!seed) return false;

    const clampedX = clamp(worldX, 0, this.worldWidth);
    const state = this._resolveInteractionState(clampedX, worldY);
    if (!state?.canPlant) return false;

    const interactions = this.params.interactions || {};
    const burstOffset = Math.max(0.005, interactions.seedBurstHeightOffset ?? 0.06);
    const desiredBurstY = state.riverbedHeight + burstOffset;
    const burstY = Math.min(this.worldTop, Math.max(worldY, desiredBurstY));
    this._emitSeedBurst(clampedX, burstY);

    this._spawnPlant(seed, clampedX, state.riverbedHeight);
    this._refreshCursor();
    return true;
  }

  _spawnPlant(seed, x, baseY) {
    const material = this._getSeedMaterial(seed);
    const initialStageIndex = 0;
    const stageId = this._plantStages[initialStageIndex]?.id || 'seed';
    const stageInfo = this._getPlantStageInfo(seed, stageId);
    const geometry = this._getPlantGeometry(seed, stageId, stageInfo);
    const mesh = new THREE.Mesh(geometry, material);

    const initialWidth = stageInfo?.width || (stageInfo?.radius ? stageInfo.radius * 2 : 0.02);
    const initialHeight = stageInfo?.height || (stageInfo?.radius ? stageInfo.radius * 2 : 0.02);
    const initialMargin = this._getSeedBottomMargin(seed);
    const initialCenterY = baseY + (0.5 - initialMargin) * initialHeight;
    mesh.position.set(x, initialCenterY, this._computePlantDepth(initialCenterY));
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    const plant = {
      id: `${seed.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      seed,
      mesh,
      x,
      baseY,
      stageIndex: initialStageIndex,
      stageTimer: 0,
      currentStageHeight: initialHeight,
      currentStageHalfWidth: Math.max(initialWidth * 0.5, stageInfo?.radius || 0.01),
      competitionBlocked: false,
      colorMaterial: material,
      imageMaterial: null,
      visualMode: 'geometry',
      visualWidth: initialWidth,
      visualHeight: initialHeight,
      visualMargin: initialMargin,
      activeFrame: null,
      animation: null,
      pendingTransition: null,
      waitingTransitionKey: null
    };
    this._primePlantAssets(seed);
    this._applyPlantStageVisual(plant, stageInfo);
    this._plants.push(plant);
    this._checkStageGoal();
  }

  _applyPlantStageGeometryFallback(plant, providedInfo) {
    if (!plant) return;
    const stageData = this._plantStages[plant.stageIndex];
    const stageId = stageData?.id || 'seed';
    const info = providedInfo || this._getPlantStageInfo(plant.seed, stageId);
    const geometry = this._getPlantGeometry(plant.seed, stageId, info);
    if (plant.mesh.geometry !== geometry) {
      plant.mesh.geometry = geometry;
    }
    const material = plant.colorMaterial || this._getSeedMaterial(plant.seed);
    if (plant.mesh.material !== material) {
      plant.mesh.material = material;
    }
    plant.mesh.scale.set(1, 1, 1);
    plant.mesh.rotation.set(0, 0, 0);
    plant.mesh.position.x = plant.x;
    const height = info.height || (info.radius ? info.radius * 2 : 0);
    const width = info.width || (info.radius ? info.radius * 2 : 0);
    const margin = this._getSeedBottomMargin(plant.seed);
    const centerY = plant.baseY + (0.5 - margin) * height;
    plant.mesh.position.y = centerY;
    this._setPlantDepth(plant, centerY);
    plant.currentStageHeight = height;
    plant.currentStageHalfWidth = Math.max(width * 0.5, info.radius || 0, 0.01);
    plant.visualMode = 'geometry';
    plant.visualWidth = width;
    plant.visualHeight = height;
    plant.visualMargin = margin;
    plant.activeFrame = null;
    plant.animation = null;
    plant.waitingTransitionKey = null;
    if (this._lastPointerInfo) {
      this._refreshCursor();
    }
  }

  _applyPlantStageVisual(plant, providedInfo) {
    const stageData = this._plantStages[plant.stageIndex];
    if (!stageData) return;
    const stageId = stageData.id;
    const visuals = this._getPlantVisualConfig();
    const stageIndex = plant.stageIndex;

    if (visuals) {
      const sequence = this._getPlantStageSequence(plant.seed, stageIndex);
      const tryActivate = (entry) => {
        if (entry.status === 'ready' && entry.frames.length) {
          this._playPlantAnimation(plant, entry, {
            loop: entry.loop,
            fps: entry.fps
          });
        } else {
          this._applyPlantStageGeometryFallback(plant, providedInfo);
        }
      };

      if (sequence?.status === 'ready') {
        tryActivate(sequence);
        return;
      }
      if (sequence?.status === 'loading') {
        this._addSequenceReadyCallback(sequence, tryActivate);
      } else if (!sequence || sequence.status === 'error') {
        // fall through to geometry fallback
      }
    }

    this._applyPlantStageGeometryFallback(plant, providedInfo);
  }

  _advancePlantStage(plant, nextIndex) {
    if (!plant || nextIndex <= plant.stageIndex) return;
    if (nextIndex >= this._plantStages.length) return;
    this._startPlantTransition(plant, nextIndex);
  }

  _getPlantStageInfo(seed, stageId) {
    const scales = this.params.plantGrowth?.stageScales || {};
    const baseWidth = seed.width || 0.04;
    const baseHeight = seed.height || 0.12;
    switch (stageId) {
      case 'seed': {
  const radiusSource = baseWidth || baseHeight || 0.02;
        const radius = radiusSource * (scales.seedRadius ?? 0.45);
        const diameter = radius * 2;
        return { type: 'circle', radius, width: diameter, height: diameter };
      }
      case 'germinated': {
        const width = Math.max(baseWidth * (scales.germWidth ?? 0.38), 0.01);
        const height = Math.max(baseHeight * (scales.germHeight ?? 0.35), 0.02);
        return { type: 'plane', width, height };
      }
      case 'small': {
        const width = Math.max(baseWidth * (scales.smallWidth ?? 0.55), 0.012);
        const height = Math.max(baseHeight * (scales.smallHeight ?? 0.55), 0.04);
        return { type: 'plane', width, height };
      }
      case 'medium': {
        const width = Math.max(baseWidth * (scales.mediumWidth ?? 0.75), 0.014);
        const height = Math.max(baseHeight * (scales.mediumHeight ?? 0.78), 0.06);
        return { type: 'plane', width, height };
      }
      case 'large':
      default: {
        const width = Math.max(baseWidth * (scales.largeWidth ?? 1.0), 0.016);
        const height = Math.max(baseHeight * (scales.largeHeight ?? 1.0), 0.08);
        return { type: 'plane', width, height };
      }
    }
  }

  _getPlantGeometry(seed, stageId, info) {
    const key = `${seed.id}:${stageId}`;
    if (this._plantGeometryCache.has(key)) {
      return this._plantGeometryCache.get(key);
    }
    const metrics = info || this._getPlantStageInfo(seed, stageId);
    let geometry;
    if (metrics.type === 'circle') {
      const segments = Math.max(3, Math.floor(this.params.plantGrowth?.geometrySegments ?? 20));
      geometry = new THREE.CircleGeometry(metrics.radius, segments);
    } else {
      geometry = new THREE.PlaneGeometry(metrics.width, metrics.height);
    }
    this._plantGeometryCache.set(key, geometry);
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

  _updatePlants(dt) {
    if (!this._plants.length) return;
    const transitionDuration = Math.max(0.05, this.params.plantGrowth?.transitionDuration ?? 2.0);
    const interactions = this.params.interactions || {};
    const subOffset = Math.max(0, interactions.plantSubmergeOffset ?? 0.004);
    const emerOffset = Math.max(0, interactions.plantEmergenceOffset ?? subOffset);
    const waterSegments = this.params.water.surfaceSegments;
    this._evaluatePlantCompetition();

    for (let i = 0; i < this._plants.length; i++) {
      const plant = this._plants[i];

      this._updatePlantAnimation(plant, dt);

      if (plant.animation && plant.animation.entry?.type === 'transition') {
        continue;
      }

      if (plant.pendingTransition !== null) {
        this._startPlantTransition(plant, plant.pendingTransition);
        if (plant.animation && plant.animation.entry?.type === 'transition') {
          continue;
        }
        plant.stageTimer = 0;
      }

  const waterHeight = this._heightAt(this._waterHeights, waterSegments, plant.x);
  const plantBase = plant.baseY;
  const isSubmerged = waterHeight >= plantBase + subOffset;
  const isAboveWater = waterHeight <= plantBase - emerOffset;

      const stageData = this._plantStages[plant.stageIndex];
      if (!stageData) continue;
      const requirement = stageData.nextRequiresSubmerged;
      if (requirement === null || plant.stageIndex >= this._plantStages.length - 1) {
        plant.stageTimer = 0;
        continue;
      }

      if (plant.competitionBlocked) {
        plant.stageTimer = 0;
        continue;
      }

      let conditionMet = false;
      if (requirement === true) {
        conditionMet = isSubmerged;
      } else if (requirement === false) {
        conditionMet = isAboveWater;
      }

      if (conditionMet) {
        plant.stageTimer += dt;
        if (plant.stageTimer >= transitionDuration) {
          this._advancePlantStage(plant, plant.stageIndex + 1);
        }
      } else {
        plant.stageTimer = 0;
      }
    }

    this._checkStageGoal();
  }

  _evaluatePlantCompetition() {
    const cfg = this.params.plantCompetition || {};
    const radius = Math.max(0.0001, (cfg.neighborRadius ?? 0.08)) * this.worldWidth;
    const radiusSq = radius * radius;
    const minNeighbors = Math.max(0, cfg.minNeighbors ?? 4);
    const plants = this._plants;
    for (let i = 0; i < plants.length; i++) {
      const plant = plants[i];
      let neighborCount = 0;
      let stageSum = 0;
      for (let j = 0; j < plants.length; j++) {
        if (i === j) continue;
        const other = plants[j];
        const dx = plant.x - other.x;
        const dy = (plant.baseY + (plant.currentStageHeight || 0) * 0.5) - (other.baseY + (other.currentStageHeight || 0) * 0.5);
        if (dx * dx + dy * dy > radiusSq) continue;
        neighborCount += 1;
        stageSum += other.stageIndex || 0;
      }
      if (neighborCount > minNeighbors && neighborCount > 0) {
        const meanStage = stageSum / neighborCount;
        plant.competitionBlocked = plant.stageIndex < meanStage;
      } else {
        plant.competitionBlocked = false;
      }
    }
  }

  _findPlantAt(x, y) {
    let closest = null;
    let closestDistSq = Infinity;
    for (let i = 0; i < this._plants.length; i++) {
      const plant = this._plants[i];
      if (!plant) continue;

      if (plant.visualMode === 'image' && plant.visualWidth && plant.visualHeight) {
        const halfW = plant.visualWidth * 0.5;
        const halfH = plant.visualHeight * 0.5;
        const centerX = plant.x;
        const centerY = plant.mesh?.position?.y ?? (plant.baseY + plant.visualHeight * 0.5);
        const left = centerX - halfW;
        const right = centerX + halfW;
        const bottom = centerY - halfH;
        const top = centerY + halfH;
        if (x < left || x > right || y < bottom || y > top) {
          continue;
        }
        let alpha = 1;
        const frame = plant.activeFrame;
        if (frame?.imageData) {
          const u = (x - left) / (right - left);
          const v = (y - bottom) / (top - bottom);
          alpha = this._sampleFrameAlpha(frame, u, v);
        }
        if (alpha <= 0.5) {
          continue;
        }
        const dx = x - centerX;
        const dy = y - centerY;
        const distSq = dx * dx + dy * dy;
        if (distSq < closestDistSq) {
          closest = plant;
          closestDistSq = distSq;
        }
        continue;
      }

      const height = Math.max(plant.currentStageHeight || 0, 0);
      const centerY = plant.baseY + height * 0.5;
      const dx = x - plant.x;
      const dy = y - centerY;
      const halfWidth = Math.max(plant.currentStageHalfWidth || 0.015, 0.015);
      const radius = Math.max(halfWidth, height * 0.5, 0.02);
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius && distSq < closestDistSq) {
        closest = plant;
        closestDistSq = distSq;
      }
    }
    return closest;
  }

  _removePlant(plant) {
    if (!plant) return;
    const index = this._plants.indexOf(plant);
    if (index === -1) return;
    if (plant.mesh) {
      this.scene.remove(plant.mesh);
    }
    if (plant.imageMaterial) {
      plant.imageMaterial.dispose?.();
      this._plantMaterialCache.delete(plant.id);
    }
    plant.waitingTransitionKey = null;
    this._plants.splice(index, 1);
    this._checkStageGoal();
    this._refreshCursor();
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
      const lastStageIndex = this._plantStages.length - 1;
      const counts = {};
      for (let i = 0; i < this._plants.length; i++) {
        const plant = this._plants[i];
        if (plant.stageIndex !== lastStageIndex) continue;
        const id = plant.seed?.id;
        if (!id) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if ((counts[id] || 0) < species[id]) {
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
    this._updateGoalMessage();
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
    if (this._activeTool && this._activeTool !== 'sediment' && this._activeTool !== 'remove' && !this._availableSeedIds.has(this._activeTool)) {
      this._activeTool = null;
    }
    if (!this._activeTool) {
      this._activeTool = 'sediment';
    }
    this._syncToolButtons();
    this._updateGoalMessage();
  }

  _goalMessageForStage(stage) {
    if (!stage) return '';
    const conciseById = {
      formation: 'Formá un banco de arena depositando sedimentos bajos.',
      colonization: 'Estabilizá el banco con especies colonizadoras.',
      expansion: 'Diversificá la isla con nuevas especies.'
    };
    if (stage.id && conciseById[stage.id]) {
      return conciseById[stage.id];
    }
    if (stage.introMessage) return stage.introMessage;
    if (stage.name) return stage.name;
    return '';
  }

  _updateGoalMessage() {
    if (!this._goalMessageEl) return;
    const victoryMsg = this.params.progress?.victoryMessage;
    if (this._stageComplete && this._currentStageIndex >= this._stages.length - 1) {
      if (victoryMsg) {
        this._goalMessageEl.textContent = victoryMsg;
        this._goalMessageEl.style.display = 'block';
        return;
      }
    }

    const stage = this._stages[this._currentStageIndex];
    const text = this._goalMessageForStage(stage);
    if (text) {
      this._goalMessageEl.textContent = text;
      this._goalMessageEl.style.display = 'block';
    } else {
      this._goalMessageEl.textContent = '';
      this._goalMessageEl.style.display = 'none';
    }
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
        this._refreshCursor();
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

  _sampleHeightsAt(x) {
    return {
      waterHeight: this._heightAt(this._waterHeights, this.params.water.surfaceSegments, x),
      riverbedHeight: this._heightAt(this._riverbedHeights, this.params.riverbed.segments, x)
    };
  }

  _resolveInteractionState(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    const { waterHeight, riverbedHeight } = this._sampleHeightsAt(x);
    const interaction = this.params.interactions || {};
    const sedimentGap = interaction.sedimentHeightEpsilon ?? 0.006;
    const plantGap = interaction.plantHeightEpsilon ?? 0.02;

    const canSediment = y < (waterHeight - sedimentGap)
      && y > (riverbedHeight + sedimentGap)
      && waterHeight - riverbedHeight > sedimentGap * 2;

    const canPlant = riverbedHeight > waterHeight + sedimentGap
      && y > waterHeight + sedimentGap
      && y <= riverbedHeight + plantGap;

    return { waterHeight, riverbedHeight, canSediment, canPlant };
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

  _emitSediment(worldX, worldY, stateOverride) {
    const { sediment } = this.params;
    const waterSegments = this.params.water.surfaceSegments;
    const bedSegments = this.params.riverbed.segments;
    if (!this._waterHeights.length) return;

    const state = stateOverride ?? this._resolveInteractionState(worldX, worldY);
    if (!state?.canSediment) return;
    const waterHeightAtClick = state.waterHeight;

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

    if (emitted > 0) {
      this._refreshCursor();
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
    const elements = ui.elements || {};
    const basePath = elements.basePath || '';

    this._uiAssetBasePath = basePath;
    this._weatherConfig = elements.weather || null;
    this._buttons = {};
    this._seedButtons = {};

    this._seedCatalog.clear();
    const seedGroups = this.params.seeds || {};
    ['colonizers', 'nonColonizers'].forEach((groupName) => {
      const list = seedGroups[groupName];
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const seed = list[i];
        if (seed?.id) {
          this._seedCatalog.set(seed.id, seed);
        }
      }
    });

    const resolveAsset = (file) => this._normalizeAssetPath(basePath, file);

    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '5';

    const weatherCfg = this._weatherConfig;
    let topImage = null;
    let bottomImage = null;
    let lowerBtn = null;
    let raiseBtn = null;
    let topContainer = null;
    let bottomContainer = null;

    if (weatherCfg?.top?.area) {
      topContainer = document.createElement('div');
      topContainer.style.position = 'absolute';
      this._applyViewportRect(topContainer, weatherCfg.top.area);
      topContainer.style.pointerEvents = 'none';
      topContainer.style.display = 'block';
      if (Number.isFinite(weatherCfg.top.area.zIndex)) {
        topContainer.style.zIndex = String(weatherCfg.top.area.zIndex);
      }

      topImage = document.createElement('img');
      topImage.src = this._weatherFrameToUrl('top', weatherCfg.top.frames?.low);
      topImage.style.width = '100%';
      topImage.style.height = '100%';
      topImage.style.objectFit = 'contain';
      topImage.style.pointerEvents = 'none';
      topImage.draggable = false;
  topContainer.appendChild(topImage);
    }

    if (weatherCfg?.bottom?.area) {
      bottomContainer = document.createElement('div');
      bottomContainer.style.position = 'absolute';
      this._applyViewportRect(bottomContainer, weatherCfg.bottom.area);
      bottomContainer.style.pointerEvents = 'auto';
      bottomContainer.style.display = 'block';
      bottomContainer.style.background = 'transparent';
      if (Number.isFinite(weatherCfg.bottom.area.zIndex)) {
        bottomContainer.style.zIndex = String(weatherCfg.bottom.area.zIndex);
      }

      bottomImage = document.createElement('img');
      bottomImage.src = this._weatherFrameToUrl('bottom', weatherCfg.bottom.frames?.low);
      bottomImage.style.width = '100%';
      bottomImage.style.height = '100%';
      bottomImage.style.objectFit = 'contain';
      bottomImage.style.pointerEvents = 'none';
      bottomImage.draggable = false;
      bottomContainer.appendChild(bottomImage);

      lowerBtn = document.createElement('div');
      lowerBtn.style.position = 'absolute';
      lowerBtn.style.left = '0';
      lowerBtn.style.top = '0';
      lowerBtn.style.width = '50%';
      lowerBtn.style.height = '100%';
      lowerBtn.style.pointerEvents = 'auto';
      lowerBtn.style.cursor = 'pointer';
      lowerBtn.style.background = 'transparent';
      lowerBtn.style.touchAction = 'manipulation';
      lowerBtn.addEventListener('click', (event) => {
        event.preventDefault();
        this._setWaterLevel(this._waterLevelIndex - 1);
      });
      bottomContainer.appendChild(lowerBtn);

      raiseBtn = document.createElement('div');
      raiseBtn.style.position = 'absolute';
      raiseBtn.style.left = '50%';
      raiseBtn.style.top = '0';
      raiseBtn.style.width = '50%';
      raiseBtn.style.height = '100%';
      raiseBtn.style.pointerEvents = 'auto';
      raiseBtn.style.cursor = 'pointer';
      raiseBtn.style.background = 'transparent';
      raiseBtn.style.touchAction = 'manipulation';
      raiseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        this._setWaterLevel(this._waterLevelIndex + 1);
      });
      bottomContainer.appendChild(raiseBtn);
      root.appendChild(bottomContainer);
    }

    if (topContainer) {
      root.appendChild(topContainer);
    }

    if (topImage || bottomImage) {
      this._buttons.weather = {
        topImage,
        bottomImage,
        lower: lowerBtn,
        raise: raiseBtn,
        topContainer,
        bottomContainer
      };
    }

  this._weatherChannels = {};
  this._weatherAnimations = {};
  this._weatherCurrentFrame = { top: null, bottom: null };
    if (topImage && weatherCfg?.top) {
      this._weatherChannels.top = {
        image: topImage,
        config: weatherCfg.top
      };
    }
    if (bottomImage && weatherCfg?.bottom) {
      this._weatherChannels.bottom = {
        image: bottomImage,
        config: weatherCfg.bottom
      };
    }

    if (elements.sedimentButton?.image) {
      const sedimentBtn = document.createElement('img');
      sedimentBtn.src = resolveAsset(elements.sedimentButton.image);
      sedimentBtn.style.position = 'absolute';
      this._applyViewportRect(sedimentBtn, elements.sedimentButton);
      sedimentBtn.style.pointerEvents = 'auto';
      sedimentBtn.style.cursor = 'pointer';
      sedimentBtn.style.userSelect = 'none';
      sedimentBtn.style.transition = 'transform 0.15s ease, filter 0.15s ease';
      if (Number.isFinite(elements.sedimentButton.zIndex)) {
        sedimentBtn.style.zIndex = String(elements.sedimentButton.zIndex);
      }
      sedimentBtn.draggable = false;
      sedimentBtn.addEventListener('click', (event) => {
        event.preventDefault();
        this._toggleTool('sediment');
      });
      root.appendChild(sedimentBtn);
      this._buttons.sediment = sedimentBtn;
    }

    if (elements.removeButton?.image) {
      const removeBtn = document.createElement('img');
      removeBtn.src = resolveAsset(elements.removeButton.image);
      removeBtn.style.position = 'absolute';
      this._applyViewportRect(removeBtn, elements.removeButton);
      removeBtn.style.pointerEvents = 'auto';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.userSelect = 'none';
      removeBtn.style.transition = 'transform 0.15s ease, filter 0.15s ease';
      if (Number.isFinite(elements.removeButton.zIndex)) {
        removeBtn.style.zIndex = String(elements.removeButton.zIndex);
      }
      removeBtn.draggable = false;
      removeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        this._toggleTool('remove');
      });
      root.appendChild(removeBtn);
      this._buttons.remove = removeBtn;
    }

    if (elements.seeder?.image) {
      const seederCfg = elements.seeder;
      const seederContainer = document.createElement('div');
      seederContainer.style.position = 'absolute';
      this._applyViewportRect(seederContainer, seederCfg);
      seederContainer.style.pointerEvents = 'auto';
      seederContainer.style.backgroundImage = `url(${resolveAsset(seederCfg.image)})`;
      seederContainer.style.backgroundSize = '100% 100%';
      seederContainer.style.backgroundRepeat = 'no-repeat';
      seederContainer.style.display = 'block';
      seederContainer.style.transition = 'transform 0.15s ease';
      if (Number.isFinite(seederCfg.zIndex)) {
        seederContainer.style.zIndex = String(seederCfg.zIndex);
      }
      root.appendChild(seederContainer);

      const segments = Math.max(1, seederCfg.segments || 1);
      const seedOrder = Array.isArray(seederCfg.seedOrder) ? seederCfg.seedOrder : [];
      const segmentHeight = 100 / segments;
      const seederMaskUrl = resolveAsset(seederCfg.image);

      for (let i = 0; i < segments; i++) {
        const seedId = seedOrder[i] || null;
        const seedDef = seedId ? this._seedCatalog.get(seedId) : null;
        const posPct = segments > 1 ? (i / (segments - 1)) * 100 : 0;

  const segment = document.createElement('div');
  segment.style.position = 'absolute';
        segment.style.left = '0';
        segment.style.width = '100%';
        segment.style.height = `${segmentHeight}%`;
        segment.style.top = `${i * segmentHeight}%`;
        segment.style.display = 'flex';
        segment.style.alignItems = 'center';
        segment.style.justifyContent = 'center';
        segment.style.pointerEvents = seedDef ? 'auto' : 'none';
        segment.style.cursor = seedDef ? 'pointer' : 'default';
        segment.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
  segment.style.overflow = 'hidden';
        seederContainer.appendChild(segment);

        let overlayEl = null;
        if (seedId) {
          overlayEl = document.createElement('div');
          overlayEl.style.position = 'absolute';
          overlayEl.style.left = '0';
          overlayEl.style.top = '0';
          overlayEl.style.width = '100%';
          overlayEl.style.height = '100%';
          overlayEl.style.pointerEvents = 'none';
          overlayEl.style.opacity = '0';
          overlayEl.style.transition = 'opacity 0.18s ease';
          overlayEl.style.backgroundColor = 'rgba(32, 40, 48, 0.55)';
          this._applySegmentMask(overlayEl, seederMaskUrl, segments, posPct);
          overlayEl.style.zIndex = '0';
          segment.appendChild(overlayEl);
        }

        let highlightEl = null;
        if (seedId) {
          highlightEl = document.createElement('div');
          highlightEl.style.position = 'absolute';
          highlightEl.style.left = '0';
          highlightEl.style.top = '0';
          highlightEl.style.width = '100%';
          highlightEl.style.height = '100%';
          highlightEl.style.pointerEvents = 'none';
          highlightEl.style.opacity = '0';
          highlightEl.style.transition = 'opacity 0.2s ease';
          highlightEl.style.backgroundColor = 'rgba(255, 214, 102, 0.9)';
          this._applySegmentMask(highlightEl, seederMaskUrl, segments, posPct);
          highlightEl.style.filter = 'brightness(1.35) saturate(1.2)';
          highlightEl.style.mixBlendMode = 'screen';
          highlightEl.style.transformOrigin = 'center';
          highlightEl.style.zIndex = '1';
          segment.appendChild(highlightEl);
        }

        let imageEl = null;
        if (seedId) {
          const seedImageFile = elements.seedImages?.[seedId];
          if (seedImageFile) {
            imageEl = document.createElement('img');
            imageEl.src = resolveAsset(seedImageFile);
            imageEl.style.maxWidth = '90%';
            imageEl.style.maxHeight = '90%';
            imageEl.style.objectFit = 'contain';
            imageEl.style.pointerEvents = 'none';
            imageEl.style.transition = 'transform 0.18s ease, filter 0.18s ease, opacity 0.18s ease';
            imageEl.style.zIndex = '2';
            imageEl.draggable = false;
            segment.appendChild(imageEl);
          }
        }

        if (seedDef && seedId) {
          segment.dataset.seedId = seedId;
          segment.title = seedDef.label || seedId;
          segment.addEventListener('click', (event) => {
            event.preventDefault();
            this._toggleTool(seedId);
          });
          this._seedButtons[seedId] = { segment, image: imageEl, overlay: overlayEl, highlight: highlightEl };
        }
      }

      this._buttons.seeder = seederContainer;
    }

    if (elements.logo?.image) {
      const logo = document.createElement('img');
      logo.src = resolveAsset(elements.logo.image);
      logo.style.position = 'absolute';
      this._applyViewportRect(logo, elements.logo);
      logo.style.pointerEvents = 'none';
      logo.style.objectFit = 'contain';
      if (Number.isFinite(elements.logo.zIndex)) {
        logo.style.zIndex = String(elements.logo.zIndex);
      }
      logo.draggable = false;
      root.appendChild(logo);
    }

    const goalMessage = document.createElement('div');
    const goalUi = ui.goalMessage || {};
    goalMessage.style.position = 'absolute';
    goalMessage.style.left = '50%';
    goalMessage.style.bottom = `${(goalUi.bottomOffsetVW ?? 9)}vw`;
    goalMessage.style.transform = 'translateX(-50%)';
    goalMessage.style.padding = `${(goalUi.paddingVW ?? 1.2)}vw`;
    goalMessage.style.maxWidth = `${(goalUi.maxWidthVW ?? 52)}vw`;
    goalMessage.style.fontSize = `${(goalUi.fontSizeVW ?? 1.8)}vw`;
    goalMessage.style.fontWeight = '600';
    goalMessage.style.color = colors.uiText;
    goalMessage.style.background = colors.uiBackgroundActive;
    goalMessage.style.borderRadius = `${(goalUi.borderRadiusVW ?? 2.4)}vw`;
    goalMessage.style.boxShadow = `0 0 ${(ui.gap * 140).toFixed(3)}vh rgba(0,0,0,${ui.shadowOpacity * 0.8})`;
    goalMessage.style.pointerEvents = 'none';
    goalMessage.style.textAlign = 'center';
    goalMessage.style.display = 'none';
    goalMessage.style.backdropFilter = 'blur(0.8vmin)';
    root.appendChild(goalMessage);
    this._goalMessageEl = goalMessage;

    const cursorCfg = ui.cursor || {};
    const cursorEl = document.createElement('div');
    cursorEl.style.position = 'absolute';
    cursorEl.style.left = '0';
    cursorEl.style.top = '0';
    cursorEl.style.width = `${(cursorCfg.diameterVW ?? 1.8)}vw`;
    cursorEl.style.height = `${(cursorCfg.diameterVW ?? 1.8)}vw`;
    cursorEl.style.borderRadius = '50%';
    cursorEl.style.pointerEvents = 'none';
    cursorEl.style.transform = 'translate(-50%, -50%)';
    cursorEl.style.display = 'none';
    cursorEl.style.background = colors.cursorDisabled;
    cursorEl.style.border = `${(cursorCfg.borderWidthVW ?? 0.14)}vw solid rgba(0,0,0,0.35)`;
    const cursorTransition = cursorCfg.transitionSeconds ?? 0.12;
    cursorEl.style.transition = `background ${cursorTransition}s ease, box-shadow ${cursorTransition}s ease, opacity ${cursorTransition}s ease`;
    cursorEl.style.opacity = '0';
    root.appendChild(cursorEl);
    this._cursorEl = cursorEl;

    this.app.root.appendChild(root);
    this._uiRoot = root;

    if (this.app?.canvas) {
      this._originalCanvasCursor = this.app.canvas.style.cursor;
      this.app.canvas.style.cursor = 'none';
    }

    this._syncWaterButtons();
    this._syncToolButtons();
    this._updateGoalMessage();

    const initialState = this._indexToWeatherState(this._waterLevelIndex);
    this._setWeatherVisualInstant(initialState);
  }

  _updateUILayout(width, height) {
    // Layout uses viewport-relative units, so dynamic resizing is not required here.
    void width;
    void height;
  }

  _updateParticleSize(width, height) {
    if (!this._particlesPoints || !this._particlesPoints.material?.uniforms?.size) return;
    const minSide = Math.max(1, Math.min(width, height));
    this._particlesPoints.material.uniforms.size.value = Math.max(2, minSide * this.params.sediment.particleSize);
  }

  _syncWaterButtons() {
    const weatherButtons = this._buttons.weather;
    if (!weatherButtons) return;
    const atLow = this._waterLevelIndex <= 0;
    const atHigh = this._waterLevelIndex >= 2;

    if (weatherButtons.lower) {
      weatherButtons.lower.style.pointerEvents = atLow ? 'none' : 'auto';
      weatherButtons.lower.style.opacity = atLow ? '0.45' : '1';
      weatherButtons.lower.style.cursor = atLow ? 'default' : 'pointer';
    }

    if (weatherButtons.raise) {
      weatherButtons.raise.style.pointerEvents = atHigh ? 'none' : 'auto';
      weatherButtons.raise.style.opacity = atHigh ? '0.45' : '1';
      weatherButtons.raise.style.cursor = atHigh ? 'default' : 'pointer';
    }
  }

  _applyViewportRect(element, rect) {
    if (!element || !rect) return;
    if (typeof rect.leftPct === 'number') {
      element.style.left = `${rect.leftPct}vw`;
    }
    if (typeof rect.topPct === 'number') {
      element.style.top = `${rect.topPct}vh`;
    }
    if (typeof rect.widthPct === 'number') {
      element.style.width = `${rect.widthPct}vw`;
    }
    if (typeof rect.heightPct === 'number') {
      element.style.height = `${rect.heightPct}vh`;
    }
  }

  _applySegmentMask(element, maskUrl, segments, posPct) {
    if (!element || !maskUrl) return;
    const size = `100% ${Math.max(1, segments) * 100}%`;
    const position = `center ${posPct}%`;
    element.style.maskImage = `url(${maskUrl})`;
    element.style.webkitMaskImage = `url(${maskUrl})`;
    element.style.maskSize = size;
    element.style.webkitMaskSize = size;
    element.style.maskPosition = position;
    element.style.webkitMaskPosition = position;
    element.style.maskRepeat = 'no-repeat';
    element.style.webkitMaskRepeat = 'no-repeat';
  }

  _indexToWeatherState(index) {
    if (index >= 2) return 'high';
    if (index === 1) return 'medium';
    return 'low';
  }

  _setWeatherVisualInstant(state) {
    if (!this._weatherConfig) {
      this._weatherState = state;
      return;
    }

    this._clearWeatherAnimation(null, { resolveCancelled: false });

    const topPlan = this._getWeatherPlan('top', state, state);
    const bottomPlan = this._getWeatherPlan('bottom', state, state);

    if (topPlan) {
      if (Number.isFinite(topPlan.finalFrame)) {
        this._setWeatherFrame('top', topPlan.finalFrame);
      }
      if (topPlan.loop) {
        const loopFps = topPlan.loop.fps ?? Math.max(1, this._weatherConfig.fps ?? 25);
        this._startWeatherLoop('top', topPlan.loop.start, topPlan.loop.end, loopFps);
      }
    }

    if (bottomPlan && Number.isFinite(bottomPlan.finalFrame)) {
      this._setWeatherFrame('bottom', bottomPlan.finalFrame);
    }

    this._weatherState = state;
  }

  _queueWeatherStateChange(fromState, toState) {
    if (!this._weatherConfig || (!this._weatherChannels.top && !this._weatherChannels.bottom)) {
      this._weatherState = toState;
      return;
    }
    if (!this._weatherTransitionPromise) {
      this._weatherTransitionPromise = Promise.resolve();
    }
    this._weatherTransitionPromise = this._weatherTransitionPromise
      .then(() => this._transitionWeatherState(fromState, toState))
      .catch(() => {});
  }

  async _transitionWeatherState(fromState, toState) {
    if (!this._weatherConfig || (!this._weatherChannels.top && !this._weatherChannels.bottom)) {
      this._weatherState = toState;
      return;
    }

    const transitions = [];
    const topPlan = this._getWeatherPlan('top', fromState, toState);
    if (topPlan) {
      transitions.push(this._executeWeatherPlan('top', topPlan));
    }
    const bottomPlan = this._getWeatherPlan('bottom', fromState, toState);
    if (bottomPlan) {
      transitions.push(this._executeWeatherPlan('bottom', bottomPlan));
    }

    if (transitions.length) {
      await Promise.all(transitions);
    }

    this._weatherState = toState;
  }

  _getWeatherPlan(channelKey, fromState, toState) {
    if (!this._weatherConfig) return null;
    const channelCfg = this._weatherConfig[channelKey];
    if (!channelCfg) return null;

    const normalize = (state) => {
      if (state === 'medium') return 'medium';
      if (state === 'high') return 'high';
      return 'low';
    };

    const from = normalize(fromState);
    const to = normalize(toState);
    const fpsDefault = Math.max(1, this._weatherConfig.fps ?? 25);
    const plan = { sequences: [], finalFrame: undefined, loop: null, fps: fpsDefault };
    const addSequence = (start, end) => {
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const s = Math.round(start);
      const e = Math.round(end);
      if (s === e) return;
      plan.sequences.push({ start: s, end: e, fps: fpsDefault });
    };

    if (channelKey === 'top') {
      const frames = channelCfg.frames || {};
      const low = frames.low;
      const medium = frames.medium;
      const highTransition = frames.highTransitionStart ?? frames.highLoopStart ?? medium ?? low;
      const loopStart = frames.highLoopStart ?? highTransition;
      const loopEnd = frames.highLoopEnd ?? loopStart;
      const hasLoop = Number.isFinite(loopStart) && Number.isFinite(loopEnd);

      if (!Number.isFinite(low) || !Number.isFinite(medium)) {
        return null;
      }

      if (from === to) {
        if (to === 'high' && hasLoop) {
          plan.finalFrame = Math.round(loopStart);
          plan.loop = { start: Math.round(loopStart), end: Math.round(loopEnd), fps: fpsDefault };
        } else if (to === 'medium') {
          plan.finalFrame = Math.round(medium);
        } else {
          plan.finalFrame = Math.round(low);
        }
        return plan;
      }

      let finalFrame;
      let loop = null;
      const path = `${from}->${to}`;
      switch (path) {
        case 'low->medium':
          addSequence(low, medium);
          finalFrame = medium;
          break;
        case 'medium->low':
          addSequence(medium, low);
          finalFrame = low;
          break;
        case 'medium->high':
          addSequence(medium, highTransition);
          if (hasLoop) {
            loop = { start: Math.round(loopStart), end: Math.round(loopEnd), fps: fpsDefault };
            finalFrame = loop.start;
          } else {
            finalFrame = highTransition;
          }
          break;
        case 'low->high':
          addSequence(low, medium);
          addSequence(medium, highTransition);
          if (hasLoop) {
            loop = { start: Math.round(loopStart), end: Math.round(loopEnd), fps: fpsDefault };
            finalFrame = loop.start;
          } else {
            finalFrame = highTransition;
          }
          break;
        case 'high->medium':
          addSequence(loopStart, medium);
          finalFrame = medium;
          break;
        case 'high->low':
          addSequence(loopStart, medium);
          addSequence(medium, low);
          finalFrame = low;
          break;
        default:
          finalFrame = to === 'medium' ? medium : low;
          break;
      }

      if (Number.isFinite(finalFrame)) {
        plan.finalFrame = Math.round(finalFrame);
      }
      if (loop) {
        plan.loop = loop;
      }

      if (!plan.sequences.length && !Number.isFinite(plan.finalFrame) && !plan.loop) {
        return null;
      }
      return plan;
    }

    if (channelKey === 'bottom') {
      const frames = channelCfg.frames || {};
      const low = frames.low;
      const medium = frames.medium;
      const high = frames.high;
      if (!Number.isFinite(low) || !Number.isFinite(medium) || !Number.isFinite(high)) {
        return null;
      }

      if (from === to) {
        const final = to === 'high' ? high : to === 'medium' ? medium : low;
        plan.finalFrame = Math.round(final);
        return plan;
      }

      let finalFrame;
      const path = `${from}->${to}`;
      switch (path) {
        case 'low->medium':
          addSequence(low, medium);
          finalFrame = medium;
          break;
        case 'medium->low':
          addSequence(medium, low);
          finalFrame = low;
          break;
        case 'medium->high':
          addSequence(medium, high);
          finalFrame = high;
          break;
        case 'low->high':
          addSequence(low, medium);
          addSequence(medium, high);
          finalFrame = high;
          break;
        case 'high->medium':
          addSequence(high, medium);
          finalFrame = medium;
          break;
        case 'high->low':
          addSequence(high, medium);
          addSequence(medium, low);
          finalFrame = low;
          break;
        default:
          finalFrame = to === 'high' ? high : to === 'medium' ? medium : low;
          break;
      }

      if (Number.isFinite(finalFrame)) {
        plan.finalFrame = Math.round(finalFrame);
      }

      if (!plan.sequences.length && !Number.isFinite(plan.finalFrame)) {
        return null;
      }
      return plan;
    }

    return null;
  }

  async _executeWeatherPlan(channelKey, plan) {
    if (!plan) return;
    this._clearWeatherAnimation(channelKey, { resolveCancelled: true });

    if (Array.isArray(plan.sequences) && plan.sequences.length) {
      for (let i = 0; i < plan.sequences.length; i++) {
        const seq = plan.sequences[i];
        await this._playWeatherRange(channelKey, seq.start, seq.end, seq.fps ?? plan.fps);
      }
    }

    if (Number.isFinite(plan.finalFrame)) {
      this._setWeatherFrame(channelKey, plan.finalFrame);
    }

    if (plan.loop) {
      this._startWeatherLoop(channelKey, plan.loop.start, plan.loop.end, plan.loop.fps ?? plan.fps);
    }
  }

  _playWeatherRange(channelKey, start, end, fps) {
    const channel = this._weatherChannels?.[channelKey];
    if (!channel?.image) {
      return Promise.resolve();
    }
    const s = Math.round(start ?? 0);
    const e = Math.round(end ?? s);
    if (s === e) {
      this._setWeatherFrame(channelKey, s);
      return Promise.resolve();
    }
    const step = s < e ? 1 : -1;
    const frameDuration = 1000 / (Math.max(1, fps ?? this._weatherConfig?.fps ?? 25) * WEATHER_PLAYBACK_SPEED);
    const frameJump = Math.max(1, Math.round(WEATHER_PLAYBACK_SPEED));

    return new Promise((resolve) => {
      const anim = { timerId: null, resolve, type: 'sequence' };
      let current = s;

      const tick = () => {
        this._setWeatherFrame(channelKey, current);
        if (current === e) {
          if (this._weatherAnimations[channelKey] === anim) {
            this._weatherAnimations[channelKey] = null;
          }
          if (typeof anim.resolve === 'function') {
            const done = anim.resolve;
            anim.resolve = null;
            done();
          }
          return;
        }
        if (step > 0) {
          current = Math.min(current + step * frameJump, e);
        } else {
          current = Math.max(current + step * frameJump, e);
        }
        anim.timerId = setTimeout(tick, frameDuration);
      };

      this._weatherAnimations[channelKey] = anim;
      tick();
    });
  }

  _startWeatherLoop(channelKey, start, end, fps) {
    const channel = this._weatherChannels?.[channelKey];
    if (!channel?.image) return;
    const frameDuration = 1000 / (Math.max(1, fps ?? this._weatherConfig?.fps ?? 25) * WEATHER_PLAYBACK_SPEED);
    const s = Math.round(start ?? 0);
    const e = Math.round(end ?? s);
    if (s === e) {
      this._setWeatherFrame(channelKey, s);
      return;
    }

    const step = s < e ? 1 : -1;
    let current = s;
    const anim = { timerId: null, loop: true, type: 'loop' };
    const frameJump = Math.max(1, Math.round(WEATHER_PLAYBACK_SPEED));
    const range = Math.abs(e - s) + 1;

    const tick = () => {
      this._setWeatherFrame(channelKey, current);
      if (step > 0) {
        let next = current + step * frameJump;
        if (next > e) {
          const offset = (next - s) % range;
          next = s + offset;
        }
        current = next;
      } else {
        let next = current + step * frameJump;
        if (next < e) {
          const offset = (s - next) % range;
          next = s - offset;
          if (next < e) {
            next = s;
          }
        }
        current = next;
      }
      anim.timerId = setTimeout(tick, frameDuration);
    };

    this._weatherAnimations[channelKey] = anim;
    tick();
  }

  _clearWeatherAnimation(channelKey = null, options = {}) {
    const { resolveCancelled = true } = options;
    if (!this._weatherAnimations) return;
    const keys = channelKey ? [channelKey] : Object.keys(this._weatherAnimations);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const anim = this._weatherAnimations[key];
      if (!anim) continue;
      if (anim.timerId !== null) {
        clearTimeout(anim.timerId);
        anim.timerId = null;
      }
      if (resolveCancelled && typeof anim.resolve === 'function') {
        const resolver = anim.resolve;
        anim.resolve = null;
        resolver();
      }
      this._weatherAnimations[key] = null;
    }
  }

  _weatherFrameToUrl(channelKey, frame) {
    if (!Number.isFinite(frame)) return '';
    const cfg = this._weatherChannels?.[channelKey]?.config || this._weatherConfig?.[channelKey];
    if (!cfg) return '';
    const digits = Math.max(1, cfg.frameDigits ?? 1);
    const prefix = cfg.framePrefix || '';
    const extension = cfg.frameExtension || '.png';
    const folderPath = cfg.folder
      ? this._normalizeAssetPath(this._uiAssetBasePath, cfg.folder)
      : this._uiAssetBasePath;
    const frameNumber = Math.max(0, Math.round(frame ?? 0));
    const filename = `${prefix}${frameNumber.toString().padStart(digits, '0')}${extension}`;
    return this._normalizeAssetPath(folderPath, filename);
  }

  _setWeatherFrame(channelKey, frame) {
    if (!Number.isFinite(frame)) return;
    if (!this._weatherCurrentFrame) {
      this._weatherCurrentFrame = {};
    }
    const channel = this._weatherChannels?.[channelKey];
    if (!channel?.image) return;
    const rounded = Math.round(frame);
    if (this._weatherCurrentFrame[channelKey] === rounded) {
      return;
    }
    const url = this._weatherFrameToUrl(channelKey, rounded);
    if (!url) return;
    channel.image.src = url;
    this._weatherCurrentFrame[channelKey] = rounded;
  }

  _syncToolButtons() {
    const activeId = this._activeTool;

    const highlightButton = (element, isActive) => {
      if (!element) return;
      element.style.transform = isActive ? 'scale(1.03)' : 'scale(1)';
      element.style.filter = isActive ? 'drop-shadow(0 0 1.4vw rgba(255, 209, 102, 0.85))' : 'none';
    };

    highlightButton(this._buttons.sediment, activeId === 'sediment');
    highlightButton(this._buttons.remove, activeId === 'remove');

    const unavailableFilter = 'grayscale(100%) brightness(0.65)';
    const seedIds = Object.keys(this._seedButtons);
    for (let i = 0; i < seedIds.length; i++) {
      const seedId = seedIds[i];
      const entry = this._seedButtons[seedId];
      if (!entry) continue;
      const { segment, image, overlay, highlight } = entry;
      const available = this._availableSeedIds.has(seedId);
      const isActive = activeId === seedId;

      if (segment) {
        segment.style.pointerEvents = available ? 'auto' : 'none';
        segment.style.cursor = available ? 'pointer' : 'default';
        segment.style.transform = 'scale(1)';
        segment.style.boxShadow = 'none';
        segment.style.opacity = '1';
        segment.style.filter = 'none';
      }

      if (overlay) {
        overlay.style.opacity = available ? '0' : '0.85';
      }

      if (highlight) {
        highlight.style.opacity = available && isActive ? '1' : '0';
        highlight.style.transform = available && isActive ? 'scale(1.03)' : 'scale(1)';
      }

      if (image) {
        const filters = [];
        if (!available) {
          filters.push(unavailableFilter);
        }
        if (available && isActive) {
          filters.push('saturate(1.2) brightness(1.05)');
        }
        image.style.filter = filters.length ? filters.join(' ') : 'none';
        image.style.opacity = available ? '1' : '0.6';
        image.style.transform = available && isActive ? 'scale(1.05)' : 'scale(1)';
      }
    }

    if (activeId !== 'sediment') {
      this._pointerDown = false;
    }
    this._refreshCursor();
  }

  _toggleTool(toolId) {
    if (toolId === this._activeTool) {
      this._activeTool = null;
    } else {
      if (toolId === 'sediment' || toolId === 'remove' || this._availableSeedIds.has(toolId)) {
        this._activeTool = toolId;
      }
    }
    this._syncToolButtons();
  }

  _destroyUI() {
    this._clearWeatherAnimation(null, { resolveCancelled: false });
    if (this._uiRoot && this._uiRoot.parentElement) {
      this._uiRoot.parentElement.removeChild(this._uiRoot);
    }
    this._setCursorVisible(false);
    if (this.app?.canvas && this._originalCanvasCursor !== null) {
      this.app.canvas.style.cursor = this._originalCanvasCursor;
      this._originalCanvasCursor = null;
    }
    this._uiRoot = null;
    this._buttons = {};
    this._seedButtons = {};
    this._cursorEl = null;
    this._goalMessageEl = null;
    this._lastPointerInfo = null;
    this._activeTool = null;
    this._weatherChannels = {};
    this._weatherAnimations = {};
    this._weatherCurrentFrame = { top: null, bottom: null };
    this._weatherConfig = null;
    this._weatherTransitionPromise = Promise.resolve();
    this._weatherState = 'low';
    this._uiAssetBasePath = this.params.ui?.elements?.basePath || '';
    this._removeMessageEl();
  }

  _setWaterLevel(index) {
    const clamped = clamp(index, 0, 2);
    const previousIndex = this._waterLevelIndex;
    this._waterLevelIndex = clamped;
    this._targetWaterLevel = [this._waterLevels.low, this._waterLevels.medium, this._waterLevels.high][clamped];
    this._syncWaterButtons();
    this._queueWeatherStateChange(
      this._indexToWeatherState(previousIndex),
      this._indexToWeatherState(clamped)
    );
  }

  _bindEvents() {
    const canvas = this.app.canvas;
    canvas.addEventListener('pointerdown', this._boundOnPointerDown);
    canvas.addEventListener('pointermove', this._boundOnPointerMove);
    canvas.addEventListener('pointerleave', this._boundOnPointerLeave);
    window.addEventListener('pointerup', this._boundOnPointerUp);
  }

  _unbindEvents() {
    const canvas = this.app.canvas;
    canvas.removeEventListener('pointerdown', this._boundOnPointerDown);
    canvas.removeEventListener('pointermove', this._boundOnPointerMove);
    canvas.removeEventListener('pointerleave', this._boundOnPointerLeave);
    window.removeEventListener('pointerup', this._boundOnPointerUp);
  }

  _handlePointerDown(event) {
    if (event.button !== 0) return;
    const tool = this._activeTool;
    if (!tool) return;
    const point = this._recordPointerPosition(event);
    if (!point) return;
    if (tool === 'sediment') {
      const state = this._resolveInteractionState(point.x, point.y);
      if (!state?.canSediment) return;
      this._pointerDown = true;
      this._emitSediment(point.x, point.y, state);
    } else if (tool === 'remove') {
      const plant = this._findPlantAt(point.x, point.y);
      if (plant) {
        this._removePlant(plant);
      }
    } else {
      this._handlePlantingAction(tool, point.x, point.y);
    }
  }

  _handlePointerMove(event) {
    const point = this._recordPointerPosition(event);
    if (!point) return;
    if (!this._pointerDown || this._activeTool !== 'sediment' || event.buttons === 0) {
      if (event.buttons === 0) this._pointerDown = false;
      return;
    }
    const state = this._resolveInteractionState(point.x, point.y);
    if (!state?.canSediment) {
      this._pointerDown = false;
      return;
    }
    this._emitSediment(point.x, point.y, state);
  }

  _handlePointerLeave() {
    this._pointerDown = false;
    this._lastPointerInfo = null;
    this._setCursorVisible(false);
  }

  _recordPointerPosition(event) {
    const point = this._getWorldPointer(event);
    if (!point) {
      this._lastPointerInfo = null;
      this._refreshCursor();
      return null;
    }
    this._lastPointerInfo = {
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: point.x,
      worldY: point.y
    };
    this._refreshCursor();
    return point;
  }

  _setCursorVisible(visible) {
    if (!this._cursorEl) return;
    this._cursorEl.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this._cursorEl.style.opacity = '0';
    }
  }

  _refreshCursor() {
    if (!this._cursorEl) return;
    const info = this._lastPointerInfo;
    if (!info) {
      this._cursorEl.style.opacity = '0';
      this._setCursorVisible(false);
      return;
    }

    this._cursorEl.style.left = `${info.clientX}px`;
    this._cursorEl.style.top = `${info.clientY}px`;

    const state = this._resolveInteractionState(info.worldX, info.worldY);
    const colors = this.params.colors;
    const cursorCfg = this.params.ui.cursor || {};
    const diameter = cursorCfg.diameterVW ?? 1.8;
    const borderWidth = cursorCfg.borderWidthVW ?? 0.14;
    const transitionSeconds = cursorCfg.transitionSeconds ?? 0.12;

    this._cursorEl.style.width = `${diameter}vw`;
    this._cursorEl.style.height = `${diameter}vw`;
    this._cursorEl.style.borderWidth = `${borderWidth}vw`;
    this._cursorEl.style.transition = `background ${transitionSeconds}s ease, box-shadow ${transitionSeconds}s ease, opacity ${transitionSeconds}s ease`;

    let mode = 'blocked';
    if (!this._activeTool) {
      mode = 'none';
    } else if (this._activeTool === 'sediment') {
      mode = state?.canSediment ? 'sediment' : 'blocked';
    } else if (this._activeTool === 'remove') {
      const plant = this._findPlantAt(info.worldX, info.worldY);
      mode = plant ? 'remove' : 'blocked';
    } else {
      const seedAvailable = this._availableSeedIds.has(this._activeTool);
      mode = seedAvailable && state?.canPlant ? 'seed' : 'blocked';
    }

    if (mode === 'none') {
      this._cursorEl.style.opacity = '0';
      this._setCursorVisible(false);
      return;
    }

    const palette = {
      sediment: colors.cursorSediment,
      seed: colors.cursorSeed,
      remove: colors.cursorRemove,
      blocked: colors.cursorDisabled
    };
    const color = palette[mode] || colors.cursorDisabled;
    this._cursorEl.style.background = color;
    this._cursorEl.style.opacity = mode === 'blocked' ? '0.7' : '0.95';
    this._cursorEl.style.boxShadow = mode === 'blocked'
      ? '0 0 0.6vw rgba(0,0,0,0.25)'
      : '0 0 1vw rgba(0,0,0,0.35)';
    this._setCursorVisible(true);
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

    this._plantGeometryCache.forEach((geo) => geo.dispose?.());
    this._seedMaterialCache.forEach((mat) => mat.dispose?.());
    this._plantMaterialCache.forEach((mat) => mat.dispose?.());
    this._plantSequenceCache.forEach((entry) => {
      entry?.frames?.forEach((frame) => {
        frame?.texture?.dispose?.();
        if (frame?.canvas) {
          frame.canvas.width = 0;
          frame.canvas.height = 0;
        }
      });
    });
    this._plantSequenceCache.clear();
    this._plantMaterialCache.clear();
    this._plantGeometryCache.clear();
    this._seedMaterialCache.clear();
    this._seedCatalog.clear();
    if (this._unitPlantPlane) {
      this._unitPlantPlane.dispose?.();
      this._unitPlantPlane = null;
    }

    this._seedBursts = [];
    this._seedEffectGroup = null;
    this._seedEffectMaterial = null;
    this._plants = [];
    this._availableSeedIds.clear();

    this._background = null;
    if (this._backgroundTexture) {
      this._backgroundTexture.dispose?.();
      this._backgroundTexture = null;
    }
    this._waterStrip = null;
    this._riverbedStrip = null;
    if (this._sandTexture) {
      this._sandTexture.dispose?.();
      this._sandTexture = null;
    }
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
