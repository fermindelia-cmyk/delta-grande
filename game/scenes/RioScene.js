import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { BaseScene } from '../core/BaseScene.js';
import { AssetLoader } from '../core/AssetLoader.js';
import {
  autoRigTwoBoneFishMesh,
  findTailBoneFromSkeleton,
  findTailBoneDirectional,
  findHeadBoneDirectional
} from '../utils/autoRigFish.js';


/**
 * =============================================================
 * RioScene — geometry + behavior aligned to explicit world params
 * =============================================================
 *
 * What’s new / key guarantees
 * ---------------------------
 * • A single, explicit set of world-space parameters drives *everything*:
 *   - surfaceLevel  : y of the water surface plane, fog toggle, swimbox Y max,
 *                     and camera Y max (via cameraSurfaceMargin).
 *   - floorLevel    : y of the riverbed; also camera Y min and swimbox Y min.
 *   - shoreLevel    : x of the shoreline; also swimbox X min.
 *   - cameraLevel   : camera’s current x (distance from shore); also swimbox X max.
 *   - leftLimit     : z min for both swimbox and camera movement.
 *   - rightLimit    : z max for both swimbox and camera movement.
 *
 * • No hidden offsets or derived magic: the above parameters are used directly.
 *   (The only deliberate offset is cameraSurfaceMargin so the camera can go
 *    slightly above the water surface for comfort; it’s an explicit param.)
 *
 * • Fish biasing keeps Gaussian behavior but default σ = 0 for X and Y
 *   (shore/camera and high/low directions) to simplify debugging.
 *   You can tune both σ and the means per stratum/shoring easily in params.
 *
 * • Gameplay Update: A fish-catching deck UI is now overlaid on the scene.
 *   - Players can cycle through fish species using arrow keys.
 *   - Clicking a fish in the water while the matching species is selected
 *     "catches" it, revealing its model in the deck and incrementing a counter.
 */

/* -------------------------------------------------------------
 * Utility functions
 * ------------------------------------------------------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

// Standard normal noise (Box–Muller). mean=0, sigma=1
const randn = () => {
  let u = 1 - Math.random();
  let v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/* -------------------------------------------------------------
 * Spatial hash (O(n) neighborhood queries)
 * ------------------------------------------------------------- */
class SpatialHash {
  constructor(cellSize = 3.0) {
    this.s = cellSize;   // tune ~ separationRadius
    this.map = new Map();
  }
  _key(v) {
    const s = this.s;
    return `${Math.floor(v.x/s)},${Math.floor(v.y/s)},${Math.floor(v.z/s)}`;
  }
  rebuild(agents) {
    this.map.clear();
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const k = this._key(a.pos);
      let bin = this.map.get(k);
      if (!bin) { bin = []; this.map.set(k, bin); }
      bin.push(a);
    }
  }
  neighbors(p) {
    const res = [];
    const s = this.s;
    const cx = Math.floor(p.x/s), cy = Math.floor(p.y/s), cz = Math.floor(p.z/s);
    for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) for (let dz=-1; dz<=1; dz++) {
      const bin = this.map.get(`${cx+dx},${cy+dy},${cz+dz}`);
      if (bin) res.push(...bin);
    }
    return res;
  }
}


/* -------------------------------------------------------------
 * Param scales and species configuration
 * ------------------------------------------------------------- */
const SizeScale       = { small: 1.0,  medium: 1.5,  large: 2.0 };
const SpeedScale      = { slow: 0.3,   medium: 0.8,  fast: 1.5 };
const AbundanceCount  = { scarce: 5,   usual: 20,    veryCommon: 50 };

/**
 * Species water-column / shore mapping keys:
 *   - water: 'surface' | 'midwater' | 'bottom'
 *   - shore: 'near'    | 'mid'      | 'deep'
 *
 * If a GLB fails to load, a colored prism is used as fallback.
 * `flips` may invert local axes so the auto-detected long axis
 * points “forward” correctly per model.
 */

const default_wiggle = {
  mode: 'lr',                   // 'lr' (left/right) or 'ud' (up/down)
  moving: 'tail',               // 'tail' (default) or 'head'
  periodSec: 0.7,               // wiggle period
  amplitudeDeg: 18,             // rotation amplitude
  softness: 0.12                // head–tail blend width (0..0.5)
}

const SPECIES = [
  {
    key: 'dorado',
    displayName: 'Dorado (Salminus brasiliensis)',
    glb: '/game-assets/sub/fish/dorado.glb',
    fallbackColor: 0xF3C623,
    flips: { x: false, y: false, z: false },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: 9,
      softness: 0
    },
    size: 'large', abundance: 'usual', speed: 'fast', water: 'midwater', shore: 'mid'
  },
  {
    key: 'sabalo',
    displayName: 'Sábalo (Prochilodus lineatus)',
    glb: '/game-assets/sub/fish/sabalo.glb',
    fallbackColor: 0x9FB2BF,
    flips: { x: false, y: false, z: true },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'medium', abundance: 'veryCommon', speed: 'medium', water: 'bottom', shore: 'near'
  },
  {
    key: 'pacu',
    displayName: 'Pacú (Piaractus mesopotamicus)',
    glb: '/game-assets/sub/fish/pacu.glb',
    fallbackColor: 0xA14A2E,
    flips: { x: false, y: false, z: true },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'medium', abundance: 'usual', speed: 'medium', water: 'surface', shore: 'mid'
  },
  {
    key: 'armado_chancho',
    displayName: 'Armado chancho (Pterodoras granulosus)',
    glb: '/game-assets/sub/fish/armado_chancho.glb',
    fallbackColor: 0x6D5D4B,
    flips: { x: false, y: false, z: false },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: 9,
      softness: default_wiggle.softness
    },
    size: 'medium', abundance: 'usual', speed: 'slow', water: 'bottom', shore: 'deep'
  },
  {
    key: 'palometa_brava',
    displayName: 'Palometa brava (Serrasalmus maculatus)',
    glb: '/game-assets/sub/fish/palometa_brava.glb',
    fallbackColor: 0xD04F4F,
    flips: { x: false, y: false, z: false },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'small', abundance: 'veryCommon', speed: 'fast', water: 'surface', shore: 'near'
  },
  {
    key: 'vieja_del_agua',
    displayName: 'Vieja del agua (Hypostomus commersoni)',
    glb: '/game-assets/sub/fish/vieja_del_agua.glb',
    fallbackColor: 0x556B2F,
    flips: { x: false, y: false, z: false },
    wiggle: {
      enabled: false,
      mode: 'ud',
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'medium', abundance: 'veryCommon', speed: 'slow', water: 'bottom', shore: 'mid'
  },
  {
    key: 'surubi_pintado',
    displayName: 'Surubí pintado (Pseudoplatystoma corruscans)',
    glb: '/game-assets/sub/fish/surubi_pintado.glb',
    fallbackColor: 0xC0C0C0,
    flips: { x: false, y: false, z: true },
    wiggle: {
      enabled: true,
      mode: default_wiggle.mode,
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'large', abundance: 'scarce', speed: 'medium', water: 'midwater', shore: 'deep'
  },
  {
    key: 'raya_negra',
    displayName: 'Raya negra (Potamotrygon spp.)',
    glb: '/game-assets/sub/fish/raya_negra.glb',
    fallbackColor: 0x222222,
    flips: { x: false, y: true, z: false },
    wiggle: {
      enabled: false,
      mode: 'ud',
      moving: default_wiggle.moving,
      periodSec: default_wiggle.periodSec,
      amplitudeDeg: default_wiggle.amplitudeDeg,
      softness: default_wiggle.softness
    },
    size: 'medium', abundance: 'usual', speed: 'slow', water: 'bottom', shore: 'near'
  }
];

/* -------------------------------------------------------------
 * Single source of truth: explicit world & behavior parameters
 * Place any tunables here; everything else reads from this block.
 * ------------------------------------------------------------- */
const DEFAULT_PARAMS = {
  /** Camera pose (initial) & world orientation */
  start: { x: 80.0, y: -6.542, z: 4.291, yawDeg: -90 },

  /** World hard limits (explicit, non-derived) */
  surfaceLevel: 5.722,   // y of the water surface plane
  floorLevel:  -15.05,   // y of riverbed (camera min Y and swimbox min Y)
  shoreLevel:  40.0,     // x of shoreline (swimbox min X)
  leftLimit:   -60.0,    // z min for both camera and swimbox
  rightLimit:   60.0,    // z max for both camera and swimbox

  /** Camera constraints aligned to world limits */
  cameraSurfaceMargin: 0.5,   // how much camera may go above surfaceLevel
  cameraFloorMargin:  4.0,    // how much camera must stay above floorLevel
  cameraLeftMargin:   40.0,    // how far from leftLimit (Z min) the camera is kept
  cameraRightMargin:  40.0,    // how far from rightLimit (Z max) the camera is kept
  cameraXBounds: [-300, 300], // x soft bounds; shoreLevel still acts as hard min

  /** Mouse-driven camera motion (x = shore↔deep, y = up↔down) */
  speeds: { x: 8.0, y: 10.0 },
  wheelStepX: 1.0,
  responseCurve: { x: 1.0, y: 1.35 },
  deadzone: 0.08,
  damping: 0.15,

  /** Visuals */
  skyColor: 0xF6B26B,
  waterColor: 0x1b1a16,
  waterSurfaceOpacity: 1.0,

  /** Fog (enabled when camera is UNDER the surfaceLevel) */
  fogNear: 1.0,   // distance where fog starts (no hidden derivation)
  fogFar:  50.0,  // distance where fog fully obscures

  /** Base model scale and tiling (floor/walls GLB) */
  overrideScale: 129.36780721031408, // explicit scale; if null, scale to modelLongestTarget
  modelLongestTarget: 129.368,
  tiling: { countEachSide: 5, gap: -20.0 },

  /** Fish baseline behavior (species modify around these) */
  fish: {
    renderDistance: 50.0,
    speedMin: 2.0,
    speedMax: 4.0,
    accel: 8.0,
    separationRadius: 2.0,
    separationStrength: 1.2,
    targetReachDist: 1.5,
    retargetTime: [4.0, 8.0], // [min, max] seconds
    fallbackDims: { x: 1.6, y: 0.4, z: 0.5 },
  },

  fishPositionBias: {
    meansX: { near: 0.15,  mid: 0.50, deep: 0.85 },
    sigmaX: { near: 0.20,  mid: 0.20, deep: 0.20 }, // set >0 later (e.g., 0.10)
    meansY: { surface: 0.92, midwater: 0.50, bottom: 0.05 },
    sigmaY: { surface: 0.20, midwater: 0.20, bottom: 0.20 }, // set >0 later (e.g., 0.12)
  },

  debug: {
    tiles: true,       // floor/walls tiling
    water: true,       // water surface plane
    fog: true,         // underwater fog
    fish: true,        // spawn + render fish
    fishUpdate: true,  // per-frame fish simulation
    deck: true,        // create deck UI
    deckRender: true   // per-frame deck mini-canvas renders
  },

  /** Audio */
  audio: {
    volumes: {
      surface: 0.7,         // volumen del loop “Salida a tomar aire…”
      underwater: 0.7,      // volumen del loop “Juego delta - Bajo el agua…”
      music: 0.0,           // volumen base del tema “Músicos Entrerios…”
      sfxCatch: 0.9,        // volumen SFX “Pez agarrado.mp3”
      sfxWrong: 0.9         // volumen SFX “Pez equivocado.mp3”
    },
    eq: {
      // Frecuencias objetivo (ajustables)
      aboveHz: 12000,       // al estar SOBRE la superficie (10–12 kHz)
      surfaceUnderHz: 300,  // justo DEBAJO de la superficie
      bottomHz: 20,         // en el fondo

      // Tiempos de rampa (segundos)
      rampEnterSec: 0.15,   // al ENTRAR al agua: rápido 10–12 kHz -> 300 Hz
      rampExitSec: 0.30,    // al SALIR del agua: rápido 300 Hz -> 10–12 kHz
      rampWhileSec: 0.10,   // mientras se mueve dentro del agua (interpolación frame a frame)

      // Curva de profundidad (‘exp’ o ‘lin’)
      depthCurve: 'exp'
    },
    musicDepth: {
      maxVol: 0.2,          // arriba/superficie
      minVolBottom: 0.05    // “prácticamente apagado” en el fondo
    },
    surfaceHysteresis: 0.03, // margen en metros para evitar “flapping” del cruce
    start: {
      // Cómo arranca el tema continuo ANTES de la intro (apenas se habilita el audio)
      forceOpenAboveHz: true,  // si true y estás sobre la superficie, abre a aboveHz instantáneamente
      forceAudibleVol: 0.5     // volumen mínimo inicial para oír la banda al habilitar audio
    },
    offsets: {
      surface: {
        onTransitionEnterSec: 0.9,  // abajo→arriba
        defaultStartSec: 2.5,       // inicio ya arriba / reinicio
        loopStartSec: 2.5
      },
      underwater: {
        onTransitionEnterSec: 0.0,  // arriba→abajo
        defaultStartSec: 2.5,       // inicio ya abajo / reinicio
        loopStartSec: 2.5
      }
    }
  },

  /** Intro sequence (camera & overlay text) */
  intro: {
    enabled: true,
    text: "Hay muchas especies en los ríos del Delta del Paraná...\n¿Podrás encontrarlas todas?",
    /** seconds */
    preHold: 3.0,         // wait before starting the downward move
    moveDuration: 6.0,     // time to go from highest Y to start.y
    postHold: 2.0,        // wait after arriving before intro ends
    fadeIn: 3.0,           // overlay text fade-in time
    fadeOut: 1.5           // overlay text fade-out time
  },
};

/* ========================================================================== */
/* Fish species & agent implementation (unchanged behavior, clearer mapping)  */
/* ========================================================================== */

class FishSpecies {
  constructor(def, scene, baseFishParams, positionBias) {
    this.def = def;
    this.scene = scene;
    this.base = baseFishParams;

    this.sizeScale  = SizeScale[def.size] || 1;
    this.speedScale = SpeedScale[def.speed] || 1;
    this.count      = AbundanceCount[def.abundance] || 10;

    this.biasXMean  = positionBias.meansX[def.shore];
    this.biasXSigma = positionBias.sigmaX[def.shore];
    this.biasYMean  = positionBias.meansY[def.water];
    this.biasYSigma = positionBias.sigmaY[def.water];

    this.template = null;
    this.usesFallback = false;

    this.wiggle = Object.assign({
      enabled: true,
      mode: 'lr',        // 'lr' (left/right, default) or 'ud' (up/down)
      moving: 'tail',     // NEW: 'tail' (default) or 'head'
      periodSec: 0.8,    // seconds
      amplitudeDeg: 16,  // degrees
      softness: 0.12     // blend width head↔tail (0..0.5)
    }, def.wiggle || {});
  }

  async ensureTemplate() {
    if (this.template) return this.template;
    try {
      const gltf = await AssetLoader.gltf(this.def.glb);
      // Keep a reference to animations for agent mixers
      this.animations = Array.isArray(gltf.animations) ? gltf.animations : [];
      const root = (gltf.scene || gltf.scenes?.[0]);
      if (root) {
        // IMPORTANT: do NOT auto-rig here — keep the template pristine for the deck.
        this.template = root;
        this.usesFallback = false;
        return this.template;
      }
    } catch (_) { /* fall through to fallback */ }

    // Fallback: colored prism (no animations)
    this.animations = [];
    const dims = this.base.fallbackDims;
    const geo = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
    const mat = new THREE.MeshStandardMaterial({
      color: this.def.fallbackColor,
      metalness: 0.1,
      roughness: 0.6
    });
    this.template = new THREE.Mesh(geo, mat);
    this.usesFallback = true;
    return this.template;
  }



  /** Create a fully initialized agent for this species */
  async createAgent(swimBox) {
    await this.ensureTemplate();

    // Deep-clone the template to preserve skinning/rig
    const mesh = this.usesFallback
      ? this.template.clone(true)
      : SkeletonUtils.clone(this.template);

    // Ensure a unique name for raycasting + tag species key
    mesh.name = `fish_${this.def.key}_${Math.random().toString(36).substr(2, 9)}`;
    mesh.userData.speciesKey = this.def.key;

    // Scale by species size
    mesh.scale.multiplyScalar(this.sizeScale);

    // --- Auto-rig only this agent clone if the template had no skin and wiggle is enabled ---
    let hasSkinAlready = false;
    mesh.traverse(o => { if (o.isSkinnedMesh) hasSkinAlready = true; });

    if (!hasSkinAlready && this.wiggle.enabled) {
      // Find the biggest mesh on the CLONE
      let biggestMesh = null; let biggest = -1;
      mesh.traverse(o => {
        if (o.isMesh && o.geometry) {
          const tri = o.geometry.index ? o.geometry.index.count / 3
                                      : (o.geometry.attributes.position?.count || 0) / 3;
          if (tri > biggest) { biggest = tri; biggestMesh = o; }
        }
      });
      if (biggestMesh) {
        // Approximate forward from bbox (on the clone)
        const box = new THREE.Box3().setFromObject(biggestMesh);
        const size = new THREE.Vector3(); box.getSize(size);
        const axes = [
          { v: new THREE.Vector3(1,0,0), len: size.x },
          { v: new THREE.Vector3(0,1,0), len: size.y },
          { v: new THREE.Vector3(0,0,1), len: size.z },
        ].sort((a,b)=>b.len-a.len);
        const forwardLocal = axes[0].v.clone().normalize();

        const { skinned, bones } = autoRigTwoBoneFishMesh(biggestMesh, {
          forwardLocal,
          softness: this.wiggle.softness
        });
        if (skinned) {
          const parent = biggestMesh.parent;
          const idx = parent.children.indexOf(biggestMesh);
          if (idx >= 0) { parent.children[idx] = skinned; skinned.parent = parent; }
          else { parent.add(skinned); }
          biggestMesh.removeFromParent();
          skinned.userData._autoTailBone = bones.tail;
        }
      }
    }


    // Initial kinematics
    const pos = this.randBiasedPoint(swimBox);
    const speedMin = this.base.speedMin * this.speedScale;
    const speedMax = this.base.speedMax * this.speedScale;
    const vel = new THREE.Vector3()
      .randomDirection()
      .multiplyScalar(lerp(speedMin, speedMax, Math.random()));
    const target = this.randBiasedPoint(swimBox);
    const now = performance.now() * 0.001;
    const ret = this.base.retargetTime;
    const nextRetargetAt = now + lerp(ret[0], ret[1], Math.random());

    // Agent
    const agent = new FishAgent({
      mesh, pos, vel, target, nextRetargetAt,
      speedMin, speedMax, species: this
    });

    // --- Pick which end moves ('tail' default, or 'head'), directionally robust ---
    let firstSkinned = null;
    mesh.traverse(o => { if (!firstSkinned && o.isSkinnedMesh) firstSkinned = o; });

    let chosenBone = null;
    if (firstSkinned) {
      // Derive local forward (toward head) from bbox, then apply species flips
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3(); box.getSize(size);
      const axes = [
        { v: new THREE.Vector3(1,0,0), len: size.x },
        { v: new THREE.Vector3(0,1,0), len: size.y },
        { v: new THREE.Vector3(0,0,1), len: size.z },
      ].sort((a,b)=>b.len-a.len);
      let forwardLocal = axes[0].v.clone().normalize();

      const { x: fx, y: fy, z: fz } = (this.def.flips || {x:false,y:false,z:false});
      if (fx) forwardLocal.x *= -1;
      if (fy) forwardLocal.y *= -1;
      if (fz) forwardLocal.z *= -1;

      // Choose which end we want to animate
      if ((this.wiggle.moving || 'tail') === 'head') {
        chosenBone = findHeadBoneDirectional(firstSkinned, { ownerMesh: mesh, forwardLocal });
      } else {
        chosenBone = findTailBoneDirectional(firstSkinned, { ownerMesh: mesh, forwardLocal });
      }

      // Fallback if directional fails
      if (!chosenBone) chosenBone = findTailBoneFromSkeleton(firstSkinned);
    }

    // Stash wiggle settings on the agent
    agent.wiggleBone  = chosenBone || null;   // <-- renamed from tailBone to generic wiggleBone
    agent.wiggle      = Object.assign({}, this.wiggle);
    agent.wigglePhase = Math.random() * Math.PI * 2;


    // Animation mixer (if the species has clips)
    agent.mixer = null;
    if (!this.usesFallback && this.animations && this.animations.length) {
      agent.mixer = new THREE.AnimationMixer(mesh);
      const clip = this.animations[0];
      const action = agent.mixer.clipAction(clip);
      action.play();
    }

    agent.applyOrientation();
    mesh.position.copy(pos);
    return agent;
  }


  /**
   * Generate a biased random point within the swimBox.
   * - X is biased between shoreLevel (minX) and cameraLevel (maxX)
   * - Y is biased between floorLevel (minY) and surfaceLevel (maxY)
   * - Z has uniform distribution across [minZ, maxZ]
   * Gaussian noise uses sigma fractions of the axis span (σ=0 => no spread).
   */
  randBiasedPoint(swimBox) {
    const min = swimBox.min, max = swimBox.max;

    // X (shore ↔ camera)
    const xSpan = max.x - min.x;
    const xMean = min.x + clamp(this.biasXMean, 0, 1) * xSpan;
    const xSigma = this.biasXSigma * xSpan;
    let x = xMean + (xSigma > 0 ? randn() * xSigma : 0);

    // Y (floor ↔ surface)
    const ySpan = max.y - min.y;
    const yMean = min.y + clamp(this.biasYMean, 0, 1) * ySpan;
    const ySigma = this.biasYSigma * ySpan;
    let y = yMean + (ySigma > 0 ? randn() * ySigma : 0);

    // Z uniform
    let z = lerp(min.z, max.z, Math.random());

    // Clamp to swimBox
    x = clamp(x, min.x, max.x);
    y = clamp(y, min.y, max.y);
    z = clamp(z, min.z, max.z);

    return new THREE.Vector3(x, y, z);
  }
}

class FishAgent {
  constructor({ mesh, pos, vel, target, nextRetargetAt, speedMin, speedMax, species }) {
    this.mesh = mesh;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.target = target.clone();
    this.nextRetargetAt = nextRetargetAt;
    this.speedMin = speedMin;
    this.speedMax = speedMax;
    this.species = species;

    this._localForward = null; // cached local-space forward axis
  }

  /** Detect the longest local axis of the mesh as "forward", honoring species flips. */
  _detectLocalForward() {
    if (this._localForward) return this._localForward.clone();

    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const axes = [
      { v: new THREE.Vector3(1,0,0), len: size.x },
      { v: new THREE.Vector3(0,1,0), len: size.y },
      { v: new THREE.Vector3(0,0,1), len: size.z },
    ];
    axes.sort((a, b) => b.len - a.len);
    let f = axes[0].v.clone();

    // Apply declared flips
    const { x, y, z } = this.species.def.flips;
    if (x) f.x *= -1; if (y) f.y *= -1; if (z) f.z *= -1;

    this._localForward = f.normalize();
    return this._localForward.clone();
  }

    /** Orient to face velocity but with NO ROLL: left/right stays horizontal. */
  _quatNoRollTowardVelocity() {
    const v = this.vel.clone();
    if (v.lengthSq() < 1e-10) return this.mesh.quaternion.clone();
    v.normalize();

    // 1) Align local forward to velocity (might include roll)
    const localFwd = this._detectLocalForward();
    const qAlign = new THREE.Quaternion().setFromUnitVectors(localFwd, v);

    // 2) Build a *local-space* up that’s orthogonal to localFwd (robust even if Y≈fwd)
    const seed = Math.abs(localFwd.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const localRight = new THREE.Vector3().crossVectors(localFwd, seed).normalize();
    const localUp    = new THREE.Vector3().crossVectors(localRight, localFwd).normalize();

    // 3) Where does that up land in world after qAlign?
    const worldUpNow = localUp.clone().applyQuaternion(qAlign).normalize();
    const worldUp    = new THREE.Vector3(0, 1, 0);

    // 4) Twist around the forward axis so that up -> +worldUp (upright, no roll)
    // Signed angle between current-up and worldUp, around v (the forward dir)
    const dot = THREE.MathUtils.clamp(worldUpNow.dot(worldUp), -1, 1);
    let angle = Math.acos(dot);
    const cross = new THREE.Vector3().crossVectors(worldUpNow, worldUp);
    if (cross.dot(v) < 0) angle = -angle;

    const qFix = new THREE.Quaternion().setFromAxisAngle(v, angle);
    return qFix.multiply(qAlign);
  }


  applyOrientation() {
    if (this.vel.lengthSq() < 1e-10) return;
    this.mesh.quaternion.copy(this._quatNoRollTowardVelocity());
  }
}

/* ========================================================================== */
/* Deck UI for fish catching gameplay                                         */
/* ========================================================================== */
class Deck {
  constructor(speciesList, speciesObjs) {
    this.cardSeparation = 220;
    this.modelScaleMultiplier = 2.5;
    this.startIndex = 3;
    this.speciesList = speciesList;
    this.speciesObjs = speciesObjs;
    this.cards = [];
    this.currentIndex = Math.max(0, Math.min(this.startIndex, this.speciesList.length - 1));
    this.isAnimating = false;

    this.container = document.createElement('div');
    this.container.id = 'deck-container';
    document.body.appendChild(this.container);

    this.silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.silhouetteSkinned  = new THREE.MeshBasicMaterial({ color: 0x000000, skinning: true });

    // Discovery HUD (global)
    this.discoveredCount = 0; // number of species with at least 1 found
    this.discoveryEl = document.createElement('div');
    this.discoveryEl.id = 'species-discovery';
    this.discoveryEl.textContent = `0/${this.speciesList.length} especies descubiertas`;
    document.body.appendChild(this.discoveryEl);
  }

  async build() {
    for (let i = 0; i < this.speciesList.length; i++) {
      const speciesDef = this.speciesList[i];
      const speciesObj = this.speciesObjs.find(s => s.def.key === speciesDef.key);

      const cardEl = document.createElement('div');
      cardEl.className = 'deck-card';
      cardEl.dataset.speciesKey = speciesDef.key;

      const canvasEl = document.createElement('canvas');
      cardEl.appendChild(canvasEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'species-name';
      nameEl.textContent = speciesDef.displayName;
      cardEl.appendChild(nameEl);

      const counterEl = document.createElement('div');
      counterEl.className = 'catch-counter';
      const totalForThisSpecies = speciesObj.count ?? 0;
      counterEl.textContent = `Encontrados: 0/${totalForThisSpecies}`;
      cardEl.appendChild(counterEl);

      this.container.appendChild(cardEl);

      // Click a card to make it the current selection
      cardEl.addEventListener('click', () => {
        this.currentIndex = i;
        this.updateCarousel();
      });

      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(150, 100, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
      camera.position.z = 3;

      const light = new THREE.AmbientLight(0xffffff, 2);
      scene.add(light);
      const dirLight = new THREE.DirectionalLight(0xffffff, 3);
      dirLight.position.set(2, 5, 3);
      scene.add(dirLight);

      await speciesObj.ensureTemplate();
      // Deep clone with skeleton so deck preview is self-contained
      const model = SkeletonUtils.clone(speciesObj.template);

      // Ensure world matrices are current before computing bounds
      scene.add(model);
      scene.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      model.scale.multiplyScalar(this.modelScaleMultiplier / maxDim);

      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      scene.add(model);

      this.cards.push({
        key: speciesDef.key,
        element: cardEl,
        renderer,
        scene,
        camera,
        model,
        counterEl,
        nameEl,
        revealed: false,
        completed: false,
        count: 0,
        totalCount: totalForThisSpecies,
        originalMaterials: this.cloneMaterials(model)
      });
      
      this.setSilhouette(i);
    }
    this.updateCarousel();
    this.container.style.opacity = 1;
  }

  cloneMaterials(model) {
    const map = new Map();
    model.traverse(o => {
      if (!o.isMesh) return;
      // Clone material(s) so deck never mutates shared materials
      if (Array.isArray(o.material)) {
        const arr = o.material.map(m => {
          const c = m.clone();
          // keep skinning flag if skinned
          if (o.isSkinnedMesh && 'skinning' in c) c.skinning = true;
          return c;
        });
        map.set(o, arr);
      } else if (o.material) {
        const c = o.material.clone();
        if (o.isSkinnedMesh && 'skinning' in c) c.skinning = true;
        map.set(o, c);
      }
    });
    return map;
  }


  setSilhouette(cardIndex) {
    const card = this.cards[cardIndex];
    card.model.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.isSkinnedMesh ? this.silhouetteSkinned : this.silhouetteMaterial;
    });
  }


  setRevealed(cardIndex) {
    const card = this.cards[cardIndex];

    // If this is the first time we reveal this species, bump discovered counter
    if (!card.revealed) {
      this.discoveredCount = Math.min(this.speciesList.length, this.discoveredCount + 1);
      if (this.discoveryEl) {
        this.discoveryEl.textContent = `${this.discoveredCount}/${this.speciesList.length} especies descubiertas`;
      }
    }

    card.revealed = true;

    // Restore original materials (remove silhouette)
    card.model.traverse(o => {
      if (o.isMesh) {
        o.material = card.originalMaterials.get(o);
      }
    });
  }

  cycle(direction) {
    if (this.isAnimating) return;
    this.currentIndex = (this.currentIndex + direction + this.cards.length) % this.cards.length;
    this.updateCarousel();
  }

  updateCarousel() {
    this.isAnimating = true;
    this.cards.forEach((card, i) => {
      const offset = i - this.currentIndex;
      const isCenter = (offset === 0);

      card.element.style.transform = `translateX(${offset * this.cardSeparation}px) scale(${isCenter ? 1.2 : 0.8})`;
      card.element.style.opacity = isCenter ? '1' : '0.6';
      card.element.style.zIndex = this.cards.length - Math.abs(offset);
    });
    setTimeout(() => { this.isAnimating = false }, 300); // Animation duration
  }
  
  checkMatch(speciesKey) {
    const currentCard = this.cards[this.currentIndex];
    if (currentCard.key === speciesKey) {
      if (!currentCard.revealed) {
        this.setRevealed(this.currentIndex);
      }

      // Clamp to total and update UI
      const newCount = Math.min(currentCard.totalCount, currentCard.count + 1);
      currentCard.count = newCount;
      currentCard.counterEl.textContent = `Encontrados: ${currentCard.count}/${currentCard.totalCount}`;

      // Completed?
      if (currentCard.count >= currentCard.totalCount && !currentCard.completed) {
        currentCard.completed = true;
        currentCard.element.classList.add('completed'); // permanent green style
      }

      this.flashBorder(currentCard.element, 'green');
      return true; // Match!
    } else {
      this.flashBorder(currentCard.element, 'red');
      return false; // No match
    }
  }

  flashBorder(element, color) {
      element.classList.add(`flash-${color}`);
      setTimeout(() => element.classList.remove(`flash-${color}`), 1000);
  }

  update(dt) {
    this.cards.forEach(card => {
      card.model.rotation.y += 0.5 * dt;
      card.renderer.render(card.scene, card.camera);
    });
  }
  
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.discoveryEl && this.discoveryEl.parentNode) {
      this.discoveryEl.parentNode.removeChild(this.discoveryEl);
    }
  }
}


/* ========================================================================== */
/* RioScene                                                                   */
/* ========================================================================== */

export class RioScene extends BaseScene {
  constructor(app) {
    super(app);
    this.name = 'rio';

    // Deep clone DEFAULT_PARAMS so runtime edits won’t mutate the constant.
    this.params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));

    // Input state (mouse axes normalized -1..+1)
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.vel = new THREE.Vector2(0, 0);
    this.forward = new THREE.Vector3(0, 0, -1);
    
    // Raycasting for fish clicks
    this.raycaster = new THREE.Raycaster();
    this.clickMouse = new THREE.Vector2();

    // Reusables
    this.tmpRight = new THREE.Vector3();
    this.tmpUp = new THREE.Vector3(0, 1, 0);
    this.tmpDelta = new THREE.Vector3();

    // Scene content
    this.model = null;
    this.tilesGroup = new THREE.Group();
    this.scene.add(this.tilesGroup);

    // Water
    this.waterSurface = null;

    // SwimBox (world-aligned, explicit bounds)
    this.swimBox = new THREE.Box3();

    // Fish containers
    this.fish = [];
    this.speciesObjs = [];
    
    // Deck UI
    this.deck = null;

    // Spatial hash + throttled steering
    this._hash = new SpatialHash(3.0); // will be reset to separationRadius later
    this._sepAccum = 0;
    this._sepHz = 30;

    // (Optional) keep a non-instanced group; may stay empty now
    this.fishGroup = new THREE.Group();
    this.fishGroup.name = 'fish-group';
    this.scene.add(this.fishGroup);

    // --- Audio ---
    this.audioListener = null;
    this.sounds = {};
    this.lowpassFilter = null;
    this.audioState = {
      ambientUnder: undefined,   // estado previo para cambiar loops (arriba/abajo)
      eqUnderPrev: undefined,    // estado previo para detectar toggles del EQ (rampas rápidas)
      started: false             // si ya hicimos bootstrap de audio
    };

    // respect debug visibility
    this.tilesGroup.visible    = this.params.debug.tiles;
    this.fishGroup.visible     = this.params.debug.fish;

    // --- Intro state & control gating ---
    this.controlsEnabled = true; // will be disabled if intro.enabled
    this.introState = {
      active: false,
      phase: 'idle', // 'idle' | 'pre' | 'move' | 'post' | 'done'
      t0: 0,         // phase start time (seconds, perf.now based)
      startY: 0,     // camera top Y
      targetY: 0,    // camera start.y
      overlayEl: null
    };
  }

  /* --------------------------------- Lifecycle --------------------------------- */

  async mount() {
    // Background + lights
    this.scene.background = new THREE.Color(this.params.skyColor);
    const hemi = new THREE.HemisphereLight(0xFFD1A6, 0x4A2F1B, 1.5);
    const dir = new THREE.DirectionalLight(0xFF9E5E, 1.2);
    dir.position.set(8, 12, 6);
    dir.castShadow = false;
    this.scene.add(hemi, dir);

    
    // Load environment model (floor/walls)
    try {
      const gltf = await AssetLoader.gltf('/game-assets/sub/sub_floor.glb');
      this.model = gltf.scene || gltf.scenes?.[0];
      if (this.model) {
        this.model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
        this.scene.add(this.model);
        this.recenterToFloor(this.model);

        if (Number.isFinite(this.params.overrideScale)) {
          this.model.scale.setScalar(this.params.overrideScale);
        } else {
          this.scaleModelToLongest(this.model, this.params.modelLongestTarget);
        }
      }
    } catch (err) {
      console.error('Error loading sub_floor.glb', err);
    }

    // Camera pose & yaw
    const { x, y, z, yawDeg } = this.params.start;
    this.camera.position.set(x, y, z);
    this.setYaw(yawDeg);
    this.params.swimBoxMaxX = this.params.start.x;
    this.camera.lookAt(this.camera.position.clone().add(this.forward));

    // --- Intro initialization ---
    if (this.params.intro?.enabled) {
      this.controlsEnabled = false;

      const yMax = this.params.surfaceLevel + this.params.cameraSurfaceMargin;
      this.introState.targetY = this.params.start.y;
      this.introState.startY  = yMax;

      // Cámara arriba del agua lista para la caída
      this.camera.position.set(this.params.start.x, yMax, this.params.start.z);
      this.camera.lookAt(this.camera.position.clone().add(this.forward));

      // Overlay de intro: arranca como “Cargando...”
      this._createIntroOverlay();
      this._setIntroOverlayText('Cargando...');
    }


    this.camera.near = 0.1;
    this.camera.far  = 70;   // try 80–150; lower = faster
    this.camera.updateProjectionMatrix();

    // Build tiling & water after model is in the scene
    if (this.model) {
      this.scene.updateMatrixWorld(true);
      if (this.params.debug.tiles) this.rebuildTiles();
      if (this.params.debug.water) this.buildOrUpdateWaterSurface();
    }

    // Initialize explicit swimBox using the world parameters directly
    this.initSwimBoxFromParams();

    // Prepare species objects (use explicit bias block)
    this.speciesObjs = SPECIES.map(def =>
      new FishSpecies(def, this.scene, this.params.fish, this.params.fishPositionBias)
    );
    
    // Build the Deck UI (hidden until intro ends)
    if (this.params.debug.deck) {
      this.deck = new Deck(SPECIES, this.speciesObjs);
      await this.deck.build();
      // hide the deck during intro
      this.deck.container.style.opacity = 0;
      this.deck.container.style.pointerEvents = 'none';
    }
    // Spawn fish by abundance
    if (this.params.debug.fish) {
      await this.spawnFishBySpecies();
    }
    // Ensure all agents are inside the initial swimBox
    for (const a of this.fish) {
      this.projectInsideSwimBox(a.pos);
      if (!this.swimBox.containsPoint(a.target)) {
        a.target = a.species.randBiasedPoint(this.swimBox);
      }
      a.mesh.position.copy(a.pos);
    }

    // Inputs
    this._onMouseMove  = (e) => this.onMouseMove(e);
    this._onMouseLeave = () => this.mouseNDC.set(0, 0);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onKeyDown = (e) => this.onKeyDown(e);
    
    this.app.canvas.addEventListener('mousemove', this._onMouseMove);
    this.app.canvas.addEventListener('mouseleave', this._onMouseLeave);
    this.app.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('keydown', this._onKeyDown);

    this._onWheel = (e) => this.onWheel(e);
    this.app.canvas.addEventListener('wheel', this._onWheel, { passive: false });

    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);

    const soundPaths = {
      surface: '/game-assets/sub/sonido/Salida a tomar aire juego delta v2.mp3',
      underwater: '/game-assets/sub/sonido/Juego delta - Bajo el agua v3.mp3',
      music: '/game-assets/sub/sonido/Músicos Entrerios full a la distancia.mp3',
      sfxCatch: '/game-assets/sub/sonido/Pez agarrado.mp3',
      sfxWrong: '/game-assets/sub/sonido/Pez equivocado.mp3'
    };

    const audioBuffers = {
      surface: await AssetLoader.audioBuffer(soundPaths.surface),
      underwater: await AssetLoader.audioBuffer(soundPaths.underwater),
      music: await AssetLoader.audioBuffer(soundPaths.music),
      sfxCatch: await AssetLoader.audioBuffer(soundPaths.sfxCatch),
      sfxWrong: await AssetLoader.audioBuffer(soundPaths.sfxWrong)
    };

    // Ambientes (loops)
    this.sounds.surface = new THREE.Audio(this.audioListener);
    this.sounds.surface.setBuffer(audioBuffers.surface);
    this.sounds.surface.setLoop(true);
    this.sounds.surface.setVolume(this.params.audio.volumes.surface);

    this.sounds.underwater = new THREE.Audio(this.audioListener);
    this.sounds.underwater.setBuffer(audioBuffers.underwater);
    this.sounds.underwater.setLoop(true);
    this.sounds.underwater.setVolume(this.params.audio.volumes.underwater);

    // Musical continuo
    this.sounds.music = new THREE.Audio(this.audioListener);
    this.sounds.music.setBuffer(audioBuffers.music);
    this.sounds.music.setLoop(true);
    this.sounds.music.setVolume(this.params.audio.volumes.music);

    // Filtro lowpass para el tema continuo
    const audioContext = this.audioListener.context;
    this.lowpassFilter = audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    // arranca totalmente abierto (fuera del agua)
    this.lowpassFilter.frequency.setValueAtTime(this.params.audio.eq.aboveHz, audioContext.currentTime);
    this.sounds.music.setFilter(this.lowpassFilter);

    // SFX (no loop)
    this.sounds.sfxCatch = new THREE.Audio(this.audioListener);
    this.sounds.sfxCatch.setBuffer(audioBuffers.sfxCatch);
    this.sounds.sfxCatch.setLoop(false);
    this.sounds.sfxCatch.setVolume(this.params.audio.volumes.sfxCatch);

    this.sounds.sfxWrong = new THREE.Audio(this.audioListener);
    this.sounds.sfxWrong.setBuffer(audioBuffers.sfxWrong);
    this.sounds.sfxWrong.setLoop(false);
    this.sounds.sfxWrong.setVolume(this.params.audio.volumes.sfxWrong);

    this.audioState.ambientUnder = undefined;
    this.audioState.eqUnderPrev  = undefined;

    // === Todo cargado: cambiar overlay a texto real y arrancar intro + audio ===
    if (this.params.intro?.enabled) {
      // Texto final de intro
      const P = this.params.intro;
      this._setIntroOverlayText(P.text || '');

      // Activar intro (pre → move → post)
      this.introState.active = true;
      this.introState.phase = 'pre';
      this.introState.t0 = performance.now() * 0.001;
    }

    // Iniciar audio de forma automática (sin exigir click)
    // Música siempre en loop
    if (!this.sounds.music.isPlaying) this.sounds.music.play();

    // Poner el filtro/vol acorde a la posición actual
    this._updateAmbient(true); // arranca el loop correcto (arriba/abajo) con offsets adecuados
    this._updateAudio(0);      // fija EQ/vol iniciales

  }

  async unmount() {

    for (const key in this.sounds) {
      if (this.sounds[key] && this.sounds[key].isPlaying) {
        this.sounds[key].stop();
      }
    }

    this.app.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.app.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    this.app.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('keydown', this._onKeyDown);
    this.app.canvas.removeEventListener('wheel', this._onWheel);
    if (this.deck) this.deck.destroy();
    this._destroyIntroOverlay();
    this._destroyAudioGateOverlay();
  }

  /* ------------------------------- Model helpers ------------------------------- */

  recenterToFloor(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    obj.position.y -= box.min.y - obj.position.y;
  }

  scaleModelToLongest(obj, target) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (longest > 0) obj.scale.multiplyScalar(target / longest);
  }

  widthAlongDirectionWorld(obj, dir) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return 0;
    const min = box.min, max = box.max;
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z), new THREE.Vector3(max.x, max.y, max.z),
    ];
    let a = +Infinity, b = -Infinity;
    for (const c of corners) { const p = c.dot(dir); if (p < a) a = p; if (p > b) b = p; }
    return (b - a);
  }

  /* ------------------------------------ Tiling ------------------------------------ */

  rebuildTiles() {
    if (!this.model) return;
    for (let i = this.tilesGroup.children.length - 1; i >= 0; i--) {
      this.tilesGroup.remove(this.tilesGroup.children[i]);
    }
    this.scene.updateMatrixWorld(true);

    const right = this.tmpRight.copy(this.forward).cross(this.tmpUp).normalize();
    const baseWidth = this.widthAlongDirectionWorld(this.model, right);
    const tileStep = baseWidth + this.params.tiling.gap;

    const anchor = this.model.getWorldPosition(new THREE.Vector3());
    const n = this.params.tiling.countEachSide;
    for (let i = 1; i <= n; i++) {
      const offsetR = right.clone().multiplyScalar(+i * tileStep);
      const offsetL = right.clone().multiplyScalar(-i * tileStep);
      const r = this.model.clone(true); r.position.copy(anchor).add(offsetR); this.tilesGroup.add(r);
      const l = this.model.clone(true); l.position.copy(anchor).add(offsetL); this.tilesGroup.add(l);
    }
  }

  /* ------------------------------------- Water ------------------------------------ */

  buildOrUpdateWaterSurface() {
    const y = this.params.surfaceLevel;

    // Decide how wide the surface plane should be (cover visible area comfortably).
    // We extend across the tiled width (right-left) and forward span of the base model.
    const right = this.tmpRight.copy(this.forward).cross(this.tmpUp).normalize();
    const baseWidthRight = this.widthAlongDirectionWorld(this.model || new THREE.Object3D(), right);
    const n = this.params.tiling.countEachSide;
    const tileStep = baseWidthRight + this.params.tiling.gap;
    const totalRightSpan = Math.max(0.01, baseWidthRight + 2 * n * tileStep);

    const fwd = this.forward.clone().normalize();
    const baseWidthForward = Math.max(0.01, this.widthAlongDirectionWorld(this.model || new THREE.Object3D(), fwd));

    const sx = totalRightSpan * 1.1;
    const sz = baseWidthForward * 2.0;

    if (!this.waterSurface) {
      const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
      const mat = new THREE.MeshPhysicalMaterial({
        color: this.params.waterColor,
        transparent: true,
        opacity: this.params.waterSurfaceOpacity,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.waterSurface = new THREE.Mesh(geo, mat);
      this.waterSurface.rotation.x = -Math.PI / 2;
      this.scene.add(this.waterSurface);
    }
    this.waterSurface.position.set(100, y, 0);
    this.waterSurface.scale.set(sx, sz, 1);
  }

  updateFog() {
    // Fog is enabled only when camera is below the explicit surfaceLevel.
    const isUnder = (this.camera.position.y < this.params.surfaceLevel);
    if (isUnder) {
      if (!this.scene.fog) {
        this.scene.fog = new THREE.Fog(this.params.waterColor, this.params.fogNear, this.params.fogFar);
      } else {
        this.scene.fog.color.set(this.params.waterColor);
        this.scene.fog.near = this.params.fogNear;
        this.scene.fog.far  = this.params.fogFar;
      }
    } else {
      this.scene.fog = null;
    }
  }

  _createIntroOverlay() {
    const P = this.params.intro;
    const el = document.createElement('div');
    el.id = 'intro-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      left: 0, top: 0, right: 0, bottom: 0,
      display: 'flex',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      msUserSelect: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontWeight: '600',
      fontSize: '28px',
      lineHeight: '1.35',
      color: 'white',
      textShadow: '0 2px 16px rgba(0,0,0,0.6)',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.1))',
      opacity: '0',
      // importante: declarar explícitamente las partes de transition
      transitionProperty: 'opacity',
      transitionTimingFunction: 'ease',
      transitionDuration: `${P.fadeIn}s`,
      willChange: 'opacity'
    });
    el.textContent = P.text || 'Cargando...';
    document.body.appendChild(el);
    this.introState.overlayEl = el;

    // ---- Disparo de fade-in a prueba de WebKit/Chrome ----
    // 1) Forzar reflow para que el estado "opacity:0" se fije realmente
    // eslint-disable-next-line no-unused-expressions
    el.getBoundingClientRect();

    // 2) Usar doble rAF para garantizar que el transition esté armado
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
      });
    });
  }

  _setIntroOverlayText(msg) {
    if (this.introState.overlayEl) {
      this.introState.overlayEl.textContent = msg;
    }
  }

  _fadeOutIntroOverlay() {
    const el = this.introState.overlayEl;
    if (!el) return;
    const P = this.params.intro;
    el.style.transition = `opacity ${P.fadeOut}s ease`;
    el.style.opacity = '0';
  }

  _destroyIntroOverlay() {
    const el = this.introState.overlayEl;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    this.introState.overlayEl = null;
  }



  /* ----------------------------------- SwimBox ----------------------------------- */

  /**
   * Initialize the swimBox using the explicit world parameters — no offsets:
   *   X: [shoreLevel, cameraLevel]  (cameraLevel = current camera x)
   *   Y: [floorLevel, surfaceLevel]
   *   Z: [leftLimit, rightLimit]
   */
  initSwimBoxFromParams() {
    const maxX = (this.params.swimBoxMaxX ?? this.params.start.x);
    this.swimBox.min.set(
      this.params.shoreLevel,
      this.params.floorLevel,
      this.params.leftLimit
    );
    this.swimBox.max.set(
      Math.max(this.params.shoreLevel + 0.001, maxX),
      Math.max(this.params.floorLevel + 0.001, this.params.surfaceLevel),
      this.params.rightLimit
    );
  }

  /**
   * Keep swimBox aligned as the camera moves:
   * maxX must follow the current cameraLevel (camera.position.x).
   */
  updateSwimBoxDynamic() {
    const maxX = (this.params.swimBoxMaxX ?? this.params.start.x);

    // X stays frozen
    this.swimBox.min.x = this.params.shoreLevel;
    this.swimBox.max.x = Math.max(this.params.shoreLevel + 0.001, maxX);

    // Y, Z reflect explicit params (in case you tweak them live)
    this.swimBox.min.y = this.params.floorLevel;
    this.swimBox.max.y = Math.max(this.params.floorLevel + 0.001, this.params.surfaceLevel);

    this.swimBox.min.z = this.params.leftLimit;
    this.swimBox.max.z = this.params.rightLimit;
  }

  /** Project a point inside current swimBox (simple clamping). */
  projectInsideSwimBox(p) {
    p.x = clamp(p.x, this.swimBox.min.x, this.swimBox.max.x);
    p.y = clamp(p.y, this.swimBox.min.y, this.swimBox.max.y);
    p.z = clamp(p.z, this.swimBox.min.z, this.swimBox.max.z);
  }

  /* ----------------------------------- Fish ----------------------------------- */

  async spawnFishBySpecies() {
    this.fish.length = 0;

    for (const sp of this.speciesObjs) {
      await sp.ensureTemplate();

      for (let i = 0; i < sp.count; i++) {
        const agent = await sp.createAgent(this.swimBox);
        this.fish.push(agent);
        this.fishGroup.add(agent.mesh);
      }
    }
  }

  /* --------------------------------- Input & UX --------------------------------- */
  onKeyDown(e) {
    if (!this.controlsEnabled) return;
      if (e.key === 'ArrowRight') {
          this.deck.cycle(1);
      } else if (e.key === 'ArrowLeft') {
          this.deck.cycle(-1);
      }
  }

    onWheel(e) {
      if (!this.controlsEnabled) { e.preventDefault(); return; }
      // Scroll up (deltaY < 0) => decrease X; scroll down => increase X.
      // Limits: min = swimBox.min.x (shore), max = starting camera X.
      e.preventDefault();

      const step = this.params.wheelStepX ?? 2.0;
      const dir = Math.sign(e.deltaY); // +1 when scrolling down, -1 up

      // compute new X
      const minX = (this.swimBox?.min?.x ?? this.params.shoreLevel);
      const maxX = this.params.start.x;
      let newX = this.camera.position.x + (dir > 0 ? +step : -step);

      // clamp and apply
      newX = clamp(newX, minX, maxX);
      this.camera.position.x = newX;

      // keep systems in sync
      this.updateSwimBoxDynamic();
      this.camera.lookAt(this.camera.position.clone().add(this.forward));
    }


  onMouseDown(e) {
    if (!this.controlsEnabled) return;
    const rect = this.app.canvas.getBoundingClientRect();
    this.clickMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.clickMouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.clickMouse, this.camera);

    const raycastTargets = [
      ...this.fishGroup.children // Only non-instanced meshes
    ];
    const intersects = this.raycaster.intersectObjects(raycastTargets, true);

    for (const intersect of intersects) {
      let obj = intersect.object;
      // Walk up to find a mesh tagged with speciesKey
      while (obj) {
        if (obj.userData && obj.userData.speciesKey) {
          const isMatch = this.deck.checkMatch(obj.userData.speciesKey);
          if (isMatch) {
            this.playSfx('catch');
            this.catchFish(obj); // pass the Mesh
          } else {
            this.playSfx('wrong');
          }
          return;
        }
        obj = obj.parent;
      }
    }
  }


  catchFish(target) {
    if (!target) return;

    // Helper: is `obj` a descendant of `root`?
    const isDescendant = (root, obj) => {
      let p = obj;
      while (p) {
        if (p === root) return true;
        p = p.parent;
      }
      return false;
    };

    // Find the agent whose root mesh either IS the target or CONTAINS the target
    const agentIndex = this.fish.findIndex(a => (a.mesh === target) || isDescendant(a.mesh, target));
    if (agentIndex === -1) return;

    const agent = this.fish[agentIndex];
    const root = agent.mesh; // always remove the agent's root

    // Remove from arrays/groups
    this.fish.splice(agentIndex, 1);
    if (root.parent === this.fishGroup) {
      this.fishGroup.remove(root);
    } else if (root.parent) {
      root.parent.remove(root);
    }

    // Dispose geometries/materials in the subtree
    root.traverse(node => {
      if (node.isMesh) {
        if (node.geometry) node.geometry.dispose?.();
        const mat = node.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m && m.dispose?.());
        } else if (mat) {
          mat.dispose?.();
        }
      }
    });

    // Clean up mixer reference
    if (agent.mixer) {
      agent.mixer.stopAllAction();
      agent.mixer.uncacheRoot(agent.mesh);
      agent.mixer = null;
    }
  }





  onMouseMove(e) {
    if (!this.controlsEnabled) return;
    const rect = this.app.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  axis(a, deadzone, expo = 1) {
    if (Math.abs(a) <= deadzone) return 0;
    const t = (Math.abs(a) - deadzone) / (1 - deadzone);
    const s = Math.min(Math.max(t, 0), 1);
    const curved = Math.pow(s, expo);
    return Math.sign(a) * (curved * curved * (3 - 2 * curved));
  }

  setYaw(deg) {
    const yaw = THREE.MathUtils.degToRad(deg);
    this.forward.set(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  }

  /* ----------------------------------- Update ----------------------------------- */

  update(dt) {
    const { deadzone, damping, speeds, responseCurve } = this.params;

        // --- Intro phases (pre -> move -> post -> done) ---
    let didIntroCameraStep = false;
    if (this.introState.active) {
      const now = performance.now() * 0.001;
      const t   = now - this.introState.t0;
      const P   = this.params.intro;

      if (this.introState.phase === 'pre') {
        if (t >= P.preHold) {
          this.introState.phase = 'move';
          this.introState.t0 = now;
        }
      } else if (this.introState.phase === 'move') {
        const u = Math.min(1, t / Math.max(0.0001, P.moveDuration));
        const s = u * u * (3 - 2 * u); // smoothstep
        const y = THREE.MathUtils.lerp(this.introState.startY, this.introState.targetY, s);

        // Maintain x,z from start; glide y
        this.camera.position.set(this.params.start.x, y, this.params.start.z);
        this.camera.lookAt(this.camera.position.clone().add(this.forward));
        didIntroCameraStep = true;

        if (u >= 1) {
          this.introState.phase = 'post';
          this.introState.t0 = now;
          this._fadeOutIntroOverlay();
        }
      } else if (this.introState.phase === 'post') {
        if (t >= P.postHold) {
          this.introState.phase = 'done';
          this.introState.active = false;

          // Finalize camera & enable controls
          this.camera.position.set(this.params.start.x, this.params.start.y, this.params.start.z);
          this.camera.lookAt(this.camera.position.clone().add(this.forward));

          if (this.deck) {
            this.deck.container.style.opacity = 1;
            this.deck.container.style.pointerEvents = 'auto';
          }
          this.controlsEnabled = true;
          this._destroyIntroOverlay();
        }
      }

      // Keep deck mini-canvases spinning during intro (optional)
      if (this.deck && this.params.debug.deckRender) this.deck.update(dt);
    }


    if (this.controlsEnabled && !didIntroCameraStep) {
      // Mouse-driven camera velocity in local right/up axes
      const ax = this.axis(this.mouseNDC.x, deadzone, responseCurve.x);
      const ay = this.axis(this.mouseNDC.y, deadzone, responseCurve.y);
      const targetVx = ax * speeds.x;
      const targetVy = ay * speeds.y;
      this.vel.x += (targetVx - this.vel.x) * damping;
      this.vel.y += (targetVy - this.vel.y) * damping;

      // Move camera along right (x) and up (y)
      this.tmpRight.copy(this.forward).cross(this.tmpUp).normalize();
      const deltaX = this.tmpDelta.copy(this.tmpRight).multiplyScalar(this.vel.x * dt);
      const deltaY = this.tmpUp.clone().multiplyScalar(this.vel.y * dt);

      const p = this.camera.position.clone().add(deltaX);
      const xMinSoft = this.params.cameraXBounds[0];
      const xMaxSoft = this.params.cameraXBounds[1];

      // Hard alignment to shoreLevel for min X (shore can never be crossed)
      const xMinHard = this.params.shoreLevel;

      // Apply X clamps: first soft bounds, then ensure ≥ shoreLevel
      p.x = clamp(p.x, xMinSoft, xMaxSoft);
      p.x = Math.max(p.x, xMinHard);

      // Z clamp with camera margins (does NOT affect swimBox limits)
      {
        const zMin = this.params.leftLimit  + this.params.cameraLeftMargin;
        const zMax = this.params.rightLimit - this.params.cameraRightMargin;
        const safeMin = Math.min(zMin, zMax - 0.001);
        const safeMax = Math.max(zMax, zMin + 0.001);
        p.z = clamp(p.z, safeMin, safeMax);
      }

      // Y limits: (floorLevel + cameraFloorMargin) ≤ Y ≤ (surfaceLevel + cameraSurfaceMargin)
      const yMin = this.params.floorLevel + this.params.cameraFloorMargin;
      const yMax = this.params.surfaceLevel + this.params.cameraSurfaceMargin;
      const newY = clamp(this.camera.position.y + deltaY.y, yMin, yMax);

      // Apply camera transform
      this.camera.position.set(p.x, newY, p.z);
      this.camera.lookAt(this.camera.position.clone().add(this.forward));
    }


    // Update swimBox to follow the cameraLevel in X
    this.updateSwimBoxDynamic();

    // Update fish
    if (this.params.debug.fishUpdate && this.fish.length) this.updateFish(dt);

    // Update fog with explicit rules
    if (this.params.debug.fog) this.updateFog(); else this.scene.fog = null;
    
    // Update the deck UI
    if (this.deck && this.params.debug.deckRender) this.deck.update(dt);

    this._updateAudio(dt);
  }

  updateFish(dt) {
    const pf = this.params.fish;
    const now = performance.now() * 0.001;

    this._sepAccum += dt;
    const doSeparationTick = (this._sepAccum >= (1 / this._sepHz));
    if (doSeparationTick) {
      this._sepAccum = 0;
      this._hash.s = Math.max(1e-3, pf.separationRadius); // cell ~= radius
      this._hash.rebuild(this.fish);
    }

    const renderDistSq = pf.renderDistance * pf.renderDistance;

    for (const a of this.fish) {
      // Retarget if reached, timed out, or target left the box (due to camera X change)
      const toTarget = a.target.clone().sub(a.pos);
      if (toTarget.length() < pf.targetReachDist || now >= a.nextRetargetAt || !this.swimBox.containsPoint(a.target)) {
        a.target = a.species.randBiasedPoint(this.swimBox);
        const ret = pf.retargetTime; a.nextRetargetAt = now + lerp(ret[0], ret[1], Math.random());
      }

      // Steering forces
      const fSeek = this.steerSeek(a, a.target, 1.0);
      if (!a._sepForce) a._sepForce = new THREE.Vector3();
      if (doSeparationTick) {
        const local = this._hash.neighbors(a.pos); // nearby fish only
        const fSepNow = this.steerSeparation(a, local, pf.separationRadius, pf.separationStrength);
        a._sepForce.copy(fSepNow);
      }
      const fSep = a._sepForce;
      const fBox = this.steerContain(a).multiplyScalar(6.0); // push back inside

      // Sum and clamp by max accel
      const force = new THREE.Vector3().add(fSeek).add(fSep).add(fBox);
      if (force.length() > pf.accel) force.setLength(pf.accel);

      // Integrate velocity and clamp speed per species
      a.vel.addScaledVector(force, dt);
      const spd = a.vel.length();
      const max = a.speedMax, min = Math.min(a.speedMin, max * 0.9);
      if (spd > max) a.vel.setLength(max);
      else if (spd < min) a.vel.setLength(min);

      // Integrate position and clamp to swimBox
      a.pos.addScaledVector(a.vel, dt);
      this.projectInsideSwimBox(a.pos);

      // Visibility + transform
      const distSq = this.camera.position.distanceToSquared(a.pos);
      const isVisible = distSq <= renderDistSq;

      a.mesh.visible = isVisible;
      if (isVisible) {
        // Advance animation
        if (a.mixer) a.mixer.update(dt);

        // --- Procedural wiggle (robust + self-healing), supports head or tail ---
        if (a.wiggle?.enabled) {
          const needsRecover =
            !a.wiggleBone ||
            !a.wiggleBone.rotation ||
            typeof a.wiggleBone.rotation.set !== 'function';

          if (needsRecover) {
            // Try to reacquire from the clone's skeleton, honoring 'moving'
            let sk = null;
            a.mesh.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o; });

            if (sk) {
              // Recompute local forward from current mesh bbox + flips
              const box = new THREE.Box3().setFromObject(a.mesh);
              const size = new THREE.Vector3(); box.getSize(size);
              const axes = [
                { v: new THREE.Vector3(1,0,0), len: size.x },
                { v: new THREE.Vector3(0,1,0), len: size.y },
                { v: new THREE.Vector3(0,0,1), len: size.z },
              ].sort((aa,bb)=>bb.len-aa.len);
              let forwardLocal = axes[0].v.clone().normalize();

              const flips = (a.species?.def?.flips) || {x:false,y:false,z:false};
              if (flips.x) forwardLocal.x *= -1;
              if (flips.y) forwardLocal.y *= -1;
              if (flips.z) forwardLocal.z *= -1;

              if ((a.wiggle.moving || 'tail') === 'head') {
                a.wiggleBone = findHeadBoneDirectional(sk, { ownerMesh: a.mesh, forwardLocal }) ||
                                findTailBoneFromSkeleton(sk);
              } else {
                a.wiggleBone = findTailBoneDirectional(sk, { ownerMesh: a.mesh, forwardLocal }) ||
                                findTailBoneFromSkeleton(sk);
              }
            }
          }

          if (a.wiggleBone && a.wiggleBone.rotation && typeof a.wiggleBone.rotation.set === 'function') {
            const T   = a.wiggle.periodSec || 0.8;
            const Amp = THREE.MathUtils.degToRad(a.wiggle.amplitudeDeg || 16);
            const speedFactor = THREE.MathUtils.clamp(a.vel.length() / Math.max(1e-4, a.speedMax), 0.4, 1.2);
            a.wigglePhase += (dt / Math.max(0.05, T)) * 2 * Math.PI * speedFactor;

            const ang = Amp * Math.sin(a.wigglePhase);
            a.wiggleBone.rotation.set(0, 0, 0);
            if ((a.wiggle.mode || 'lr') === 'ud') {
              a.wiggleBone.rotation.x = ang;
            } else {
              a.wiggleBone.rotation.y = ang; // default left/right
            }
          }
        }


        // Orient and place
        a.applyOrientation();
        a.mesh.position.copy(a.pos);


      }
    }
  }

  _updateAmbient(force = false) {
    if (!this.sounds.surface || !this.sounds.underwater) return;

    const isUnderwater = this.isUnderwaterStable();
    const prev = this.audioState.ambientUnder;

    // Sin cambio y sin force → nada
    if (!force && prev === isUnderwater) return;

    const { offsets } = this.params.audio;

    if (isUnderwater) {
      // Vamos a loop submarino
      this._stopAudioSafely(this.sounds.surface);

      // Motivo: transición (arriba→abajo) si prev === false
      const offset = (prev === false) ? offsets.underwater.onTransitionEnterSec
                                      : offsets.underwater.defaultStartSec;
      const loopStart = offsets.underwater.loopStartSec;

      this._playLoopWithOffset(this.sounds.underwater, offset, loopStart);
      this.sounds.underwater.setVolume(this.params.audio.volumes.underwater);
    } else {
      // Vamos a loop de superficie
      this._stopAudioSafely(this.sounds.underwater);

      // Motivo: transición (abajo→arriba) si prev === true
      const offset = (prev === true) ? offsets.surface.onTransitionEnterSec
                                     : offsets.surface.defaultStartSec;
      const loopStart = offsets.surface.loopStartSec;

      this._playLoopWithOffset(this.sounds.surface, offset, loopStart);
      this.sounds.surface.setVolume(this.params.audio.volumes.surface);
    }

    // Guardar estado
    this.audioState.ambientUnder = isUnderwater;
  }


  _playLoopWithOffset(audio, offsetSec = 0, loopStartSec = 0) {
    if (!audio || !audio.buffer) return;

    // Si estaba sonando, paramos
    if (audio.isPlaying) {
      try { audio.stop(); } catch (_) {}
    }

    const ctx = this.audioListener.context;
    const source = ctx.createBufferSource();
    source.buffer = audio.buffer;
    source.loop = true;
    source.loopStart = Math.max(0, loopStartSec);  // desde dónde relupa
    // loopEnd opcional; si querés el final del buffer entero, no lo toques

    // Conectar la nueva source a la salida del THREE.Audio
    source.connect(audio.getOutput());
    // Guardar la source en el THREE.Audio para que .stop() funcione
    audio.source = source;
    audio.isPlaying = true;

    // Arrancar con offset (segundo parámetro es offset en el buffer)
    const now = ctx.currentTime;
    source.start(now, Math.max(0, offsetSec));
  }

  _stopAudioSafely(audio) {
    if (!audio) return;
    try { if (audio.isPlaying) audio.stop(); } catch (_) {}
  }


  isUnderwaterStable() {
    const eps = this.params.audio.surfaceHysteresis || 0;
    // Cuando ya estábamos bajo agua, pedimos un poco más por encima para salir (histeresis)
    const y = this.camera.position.y;
    const s = this.params.surfaceLevel;
    const prevUnder = this.audioState.ambientUnder; // puede ser undefined al inicio
    if (prevUnder === true) {
      return y < (s + eps); // exigimos pasar un poquito por encima para “salir”
    } else if (prevUnder === false) {
      return y < (s - eps); // exigimos bajar un poquito para “entrar”
    }
    // sin estado previo, decisión directa sin margen
    return y < s;
  }


  playSfx(kind) {
    if (kind === 'catch' && this.sounds.sfxCatch) {
      this.sounds.sfxCatch.stop(); // reinicia si se pisa
      this.sounds.sfxCatch.play();
    } else if (kind === 'wrong' && this.sounds.sfxWrong) {
      this.sounds.sfxWrong.stop();
      this.sounds.sfxWrong.play();
    }
  }


  /* ------------------------------- Steering helpers ------------------------------ */

  steerSeek(agent, target, intensity = 1) {
    const desired = target.clone().sub(agent.pos);
    const d = desired.length();
    if (d < 1e-5) return new THREE.Vector3();
    desired.normalize().multiplyScalar(agent.speedMax);
    return desired.sub(agent.vel).multiplyScalar(intensity);
  }

  steerSeparation(agent, neighbors, radius, strength) {
    const force = new THREE.Vector3(); let count = 0;
    const r2 = radius * radius;
    for (const other of neighbors) {
      if (other === agent) continue;
      const diff = agent.pos.clone().sub(other.pos);
      const d2 = diff.lengthSq();
      if (d2 > 0 && d2 < r2) {
        diff.normalize().multiplyScalar(1.0 / d2);
        force.add(diff); count++;
      }
    }
    if (count > 0) force.multiplyScalar(strength);
    return force;
  }

  steerContain(agent) {
    // Simple inward push when at/near the box faces (zero margin => only when outside)
    const f = new THREE.Vector3();
    const p = agent.pos;
    const b = this.swimBox;

    let d = p.x - b.min.x; if (d < 0) f.x += -d;
    d = b.max.x - p.x;     if (d < 0) f.x -= -d;

    d = p.y - b.min.y;     if (d < 0) f.y += -d;
    d = b.max.y - p.y;     if (d < 0) f.y -= -d;

    d = p.z - b.min.z;     if (d < 0) f.z += -d;
    d = b.max.z - p.z;     if (d < 0) f.z -= -d;

    return f;
  }

  /* ---------------------------------- Resize ---------------------------------- */

  onResize(w, h) {
    super.onResize(w, h);
    this.camera.lookAt(this.camera.position.clone().add(this.forward));
    if (this.model) {
      this.scene.updateMatrixWorld(true);
      if (this.params.debug.tiles) this.rebuildTiles();
      if (this.params.debug.water) this.buildOrUpdateWaterSurface();
      // Keep swimBox aligned to explicit params and current cameraLevel
      this.updateSwimBoxDynamic();
    }
  }

  _updateAudio(dt) {
    if (!this.lowpassFilter || !this.sounds.music) return;

    const { surfaceLevel, floorLevel, audio } = this.params;
    const { aboveHz, surfaceUnderHz, bottomHz, rampEnterSec, rampExitSec, rampWhileSec, depthCurve } = audio.eq;
    const { maxVol, minVolBottom } = audio.musicDepth;

    const camY = this.camera.position.y;
    const isUnderwater = this.isUnderwaterStable();

    // 1) Detectar toggle de EQ (antes de tocar loops)
    const prevEq = this.audioState.eqUnderPrev;
    const justToggled = (prevEq !== undefined && isUnderwater !== prevEq);

    // 2) Luego sí, actualizar loops (arriba/abajo)
    this._updateAmbient(false);

    // 3) Automatización del EQ + volumen del tema continuo
    const audioContext = this.audioListener.context;
    const now = audioContext.currentTime;

    // Normalizamos profundidad sólo si está bajo la superficie
    const totalDepth = Math.max(1e-6, surfaceLevel - floorLevel);
    const depth = isUnderwater ? (surfaceLevel - camY) : 0;
    let depthT = THREE.MathUtils.clamp(depth / totalDepth, 0, 1);

    // Curva de profundidad
    if (depthCurve === 'exp') {
      const k = 2.2; // ajustable
      depthT = Math.pow(depthT, k);
    }

    // Frecuencia objetivo
    let targetHz;
    if (isUnderwater) {
      targetHz = THREE.MathUtils.lerp(surfaceUnderHz, bottomHz, depthT);
    } else {
      targetHz = aboveHz;
    }

    // Tiempo de rampa
    const rampSec = justToggled
      ? (isUnderwater ? rampEnterSec : rampExitSec)
      : rampWhileSec;

    try {
      this.lowpassFilter.frequency.cancelScheduledValues(now);
    } catch (_) {}
    this.lowpassFilter.frequency.setValueAtTime(this.lowpassFilter.frequency.value, now);
    this.lowpassFilter.frequency.linearRampToValueAtTime(targetHz, now + Math.max(0.01, rampSec));

    // Volumen del tema continuo vs. profundidad
    let vol = isUnderwater
      ? (maxVol - (maxVol - minVolBottom) * depthT)
      : maxVol;

    this.sounds.music.setVolume(vol);

    // 4) Guardar estado del EQ para el próximo frame
    this.audioState.eqUnderPrev = isUnderwater;
  }


}