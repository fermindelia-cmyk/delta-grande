import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { AssetLoader } from '../core/AssetLoader.js';
import { State } from '../core/State.js';
import { UI } from '../core/UI.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { SpeciesManager } from '../core/SpeciesManager.js';
import { CursorRadarModule } from './CursorRadarModule.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GamerLUTPass } from '../core/GamerLUTPass.js';

// 👇 Control the starting scene here (0=escena01, 1=escena02, 2=escena03, etc.)
// Ronda 1, Ambiente 1 = escena 0
const STARTING_SCENE = 0;

const _orbitCenter = new THREE.Vector3();
const _orbitPos = new THREE.Vector3();
const _orbitLook = new THREE.Vector3();
const _orbitHelper = new THREE.Vector3();
const _orbitAhead = new THREE.Vector3();
const _orbitVel = new THREE.Vector3();

const EFEDRA_OVERLAY_THEME = {
  fontKitHref: 'https://use.typekit.net/vmy8ypx.css',
  fonts: {
    family: `"new-science-mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`,
    speciesMaxPx: 20,
    numbersMaxPx: 22
  },
  colors: {
    speciesText: '#FFC96A',
    numbersTotalFill: '#FFC96A',
    numbersFoundStroke: '#FFC96A',
    silhouetteDefault: '#2B6CB0',
    silhouetteSelected: '#FFD400'
  }
};

const EFEDRA_FONT_LINK_ID = 'efedra-font-kit';
const EFEDRA_STYLE_ID = 'efedra-text-overlay-style';

function ensureEfedraOverlayAssets() {
  if (!document.getElementById(EFEDRA_FONT_LINK_ID)) {
    const link = document.createElement('link');
    link.id = EFEDRA_FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = EFEDRA_OVERLAY_THEME.fontKitHref;
    document.head.appendChild(link);
  }

  if (!document.getElementById(EFEDRA_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = EFEDRA_STYLE_ID;
    style.textContent = `
      #efedra-text-overlay {
        font-family: ${EFEDRA_OVERLAY_THEME.fonts.family};
        color: ${EFEDRA_OVERLAY_THEME.colors.speciesText};
        font-variant-numeric: tabular-nums lining-nums;
        text-transform: none;
        letter-spacing: 0.015em;
        scrollbar-width: thin;
        scrollbar-color: ${EFEDRA_OVERLAY_THEME.colors.speciesText} rgba(11, 18, 28, 0.45);
      }

      #efedra-text-overlay::-webkit-scrollbar {
        width: 12px;
        background: transparent;
      }

      #efedra-text-overlay::-webkit-scrollbar-track {
        background: rgba(11, 18, 28, 0.38);
        border-radius: 999px;
        box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.45);
      }

      #efedra-text-overlay::-webkit-scrollbar-thumb {
        background: ${EFEDRA_OVERLAY_THEME.colors.speciesText};
        border-radius: 999px;
        box-shadow: 0 0 18px rgba(255, 201, 106, 0.55);
        border: 2px solid rgba(14, 22, 33, 0.65);
      }

      #efedra-text-overlay::-webkit-scrollbar-thumb:hover {
        background: #ffe394;
      }
    `;
    document.head.appendChild(style);
  }
}


export class RecorridoScene extends BaseScene {
  constructor(app) {
    super(app); this.name = 'recorrido';
    this.current = STARTING_SCENE; this.stages = [];
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.velLon = 0; this.velLat = 0; this.isAutoLook = false;
    this.cameraLocked = true; // 👈 Restringe la cámara al eje horizontal hasta descubrir especie
    this.use3DInventory = false; // 👈 switch inicial
    this.inventoryModel = null;
    this.inventoryOverlay = null;
    this.overlayRoot = app?.root || document.body;

    this.metadataOverlayAudio = null;

    // 👇 Initialize CursorRadarModule
    this.cursorRadar = new CursorRadarModule({
      cursor: {
        src: '/game-assets/recorrido/interfaz/cursor.png',
        scale: 0.15
      },
      radar: {
        enabled: true,
        scale: 0.22
      }
    });
    this.metadataCloseAudio = null;
    this.transitionAudio = null;
    this.sceneStartAudio = null;

    // 🎨 Post-processing
    this.composer = null;
    this.gamerLUTPass = null;
    this.useGamerLUT = true; // Toggle para activar/desactivar
    this.isLUTReady = false;
    this.lutLoadingOverlay = null;
    this.fadeOverlay = null;
    this._lutReadyRaf = null;
    this._lutOverlayTimeout = null;
    this._fadeOverlayTimeout = null;
    this._tempClearColor = new THREE.Color(); this.lon = 0; this.lat = 0; // grados

    this.gltfLoader = new GLTFLoader();
    this.stageModel = null;
    this.gltfAnimations = [];

    // 👇 NEW: Species management system
    this.speciesManager = new SpeciesManager();
    this.currentSpecies = null;

    this.raycaster = new THREE.Raycaster();
    this.glitchObject = null;
    this.rastroObject = null;
    this.flechaObject = null;
    this.flechaAnimationMixer = null;
    this.flechaAnimationAction = null;
    this.flechaMasterMixer = null;
    this.flechaClicked = false; // 👈 Previene clicks dobles
    this.speciesClickDisabled = false; // 👈 Desactiva clicks en especies por 3s después de descubrir

    // 🐟 Carpa mesh and animation
    this.carpaObject = null;
    this.carpaAnimationMixer = null;
    this.carpaAnimationAction = null;

    // 🐟 Carpa3D hover and rotation animation
    this.carpa3dObject = null;
    this.carpa3dHover = {
      enabled: false,
      time: 0,
      amplitude: 0.08,      // Altura del movimiento (muy sutil)
      frequency: 1.2,       // Velocidad del hover
      baseY: 0              // Posición Y inicial
    };
    this.carpa3dRotation = {
      enabled: false,
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
      noiseOffsetZ: Math.random() * 1000,
      amplitude: 0.02,      // Amplitud de rotación (muy sutil, ~1 grado)
      speed: 0.5            // Velocidad del noise
    };

    // 🎬 Animation mixer for stage model (handles all glitch/rastro animations)
    this.stageAnimationMixer = null;
    this.glitchAnimationAction = null;
    this.rastroAnimationAction = null;
    this.videoElement = null;
    this.currentVideoTexture = null; // For cleanup
    this.sunObject = null;
    this.lensflare = null;
    this.sunLight = null;
    this.lensflareTextures = [];
    this._flareDebug = { created: false, frameLogged: false };
    this.butterfly = null;
    this.butterflyMixer = null;
    this.butterflyAction = null;
    this.butterflyOrbit = {
      angle: 15,
      radius: 2.55,
      height: 0.35,
      verticalAmp: 0.08,
      speed: 0.9,
      lookAhead: 0.35,
      wave: {
        amplitude: 0.52,
        frequency: 4.1,
        phase: 0
      }
    };

    this.glitchFlashState = null;

    // 🔊 Spatial audio system for species
    this.speciesAudio = null; // Audio element for current species
    this.audioContext = null; // Web Audio API context
    this.audioSource = null; // Audio source node
    this.stereoPanner = null; // Stereo panner for left/right positioning
    this.gainNode = null; // Gain node for volume control
    this.spatialAudioConfig = {
      maxDistance: 100, // Maximum distance for audio falloff
      minVolume: 0.1,   // Minimum volume when far
      maxVolume: 2.0,   // Maximum volume when close
      fovAngle: 60      // Field of view angle in degrees (±60° = 120° total FOV)
    };

    this.config = {
      deadzone: 0.12,
      maxSpeed: { yaw: 80, pitch: 50 },
      damping: 0.12
    };

    // Zoom controls
    this.zoom = {
      currentFOV: 75,
      minFOV: 35,        // Maximum zoom in
      maxFOV: 85,        // Maximum zoom out  
      baseFOV: 75,       // Default FOV
      zoomSpeed: 1.2,    // Very slow zoom sensitivity
      lerpSpeed: 3.5,    // Smooth interpolation speed
      dampening: 0.75    // Strong dampening for very smooth zooming
    };

    // 🎯 Camera debug overlay
    this.cameraDebugOverlay = null;
    this.shaderMaterials = new Set();
  }

  // --- ADD: campos nuevos en la clase
  overlayScene = new THREE.Scene();
  overlayCam = null;
  screenSize = new THREE.Vector2();


  async mount() {
    // 👇 Limpiar cualquier overlay del menú que haya quedado abierto
    const menuOverlays = document.querySelectorAll('body > div');
    menuOverlays.forEach(overlay => {
      const zIndex = window.getComputedStyle(overlay).zIndex;
      if (zIndex === '10000') {
        console.log('[RecorridoScene] Removing leftover menu overlay');
        overlay.remove();
      }
    });

    // 👇 Ocultar el videoOverlay al inicio para evitar que bloquee clicks/cámara
    UI.hideVideo();
    console.log('[RecorridoScene] Video overlay hidden on mount');

    // 👇 Hide system cursor immediately
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';

    // 👇 Mostrar elementos específicos de RecorridoScene (inventoryCanvas y zócalo)
    const inventoryCanvas = document.getElementById('inventoryCanvas');
    const zocaloVideo = document.getElementById('zocaloVideo');
    if (inventoryCanvas) inventoryCanvas.style.display = 'block';
    if (zocaloVideo) zocaloVideo.style.display = 'block';

    // Mostrar overlays de recorrido (mapa y metadata)
    const mapOverlay = document.querySelector('.map-overlay');
    const metadataOverlay = document.querySelector('.metadata-overlay');
    if (mapOverlay) mapOverlay.style.display = 'block';
    if (metadataOverlay) metadataOverlay.style.display = 'block';

    this.isLUTReady = false;
    this.showLUTLoadingOverlay();

    // 🎬 Fade desde negro al inicio
    this.showFadeOverlay();

    // Cámara
    this.camera.fov = 75; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0.1);

    // Input
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onLeave = () => this.mouseNDC.set(0, 0);
    this._onClick = (e) => this.onClick(e);
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    this._onWheel = (e) => this.onWheel(e);
    this.app.canvas.addEventListener('mousemove', this._onMouseMove);
    this.app.canvas.addEventListener('mouseleave', this._onLeave);
    this.app.canvas.addEventListener('click', this._onClick);
    this.app.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.setupOverlay();

    // 👇 Initialize CursorRadarModule
    await this.cursorRadar.init();

    // 👇 Load species data
    await this.speciesManager.load();
    console.log('[RecorridoScene] Species data loaded:', this.speciesManager.getProgress());

    // 🎮 DEBUGGING: Exponer funciones globales para cambiar ronda/ambiente desde la consola
    window.setRonda = (round, stage) => {
      if (this.speciesManager.setRoundAndStage(round, stage)) {
        // Las 6 escenas se reciclan para todas las rondas, así que usamos módulo 6
        const sceneIndex = (stage - 1) % 6;
        console.log(`🎬 Cambiando a Ronda ${round}, Ambiente ${stage} (escena ${sceneIndex})`);
        this.loadStage(sceneIndex);
      }
    };

    window.verRonda = () => {
      const progress = this.speciesManager.getProgress();
    };


    // Cargar config JSON
    const conf = await fetch('./data/recorrido.json', { cache: 'no-store' }).then(r => r.json());
    this.stages = conf.stages || [];

    this.initInventoryCanvas();

    // 👇 Calcular el índice de escena correcto basado en el progreso del SpeciesManager
    // Las 6 escenas se reciclan para todas las rondas, así que usamos módulo 6
    const progress = this.speciesManager.getProgress();
    // Calculate scene index: stage 1-6 within any round maps to scene 0-5
    const sceneIndex = (progress.stage - 1) % 6;
    console.log(`[RecorridoScene] Montando escena - Round ${progress.round}, Stage ${progress.stage} (índice de escena ${sceneIndex})`);

    // Load the stage - loadStage will recalculate round/stage from sceneIndex
    // But we need to ensure SpeciesManager is already at the correct round/stage
    await this.loadStage(sceneIndex);

    // 🔊 Reproducir sonido de inicio de escenario (escena inicial)
    this.sceneStartAudio = new Audio('/game-assets/recorrido/sonido/Transicion inicio de escenarios.mp3');
    this.sceneStartAudio.volume = 0.2;
    this.sceneStartAudio.play().catch(e => console.error("Scene start audio play failed:", e));

    // 🎬 Reproducir zócalo de la escena inicial
    this.playZocalo();

    // Cámara
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0.1);

    // 👇 MUY IMPORTANTE: meter la cámara en la escena
    this.scene.add(this.camera);


    // directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 10, 90);
    this.scene.add(dirLight);

    // ambient light
    const ambLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambLight);


    this.setupNoiseOverlay();

    // 🎵 Background music - plays continuously at 30% volume
    this.backgroundMusic = AssetLoader.audio('/game-assets/recorrido/musica.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.08;
    this.backgroundMusic.play().catch(err => {
      console.warn('[RecorridoScene] Background music autoplay prevented. Will play on first user interaction.', err);
      // Retry on first user click/tap
      const startMusic = () => {
        this.backgroundMusic.play().catch(() => { });
        document.removeEventListener('click', startMusic);
        document.removeEventListener('touchstart', startMusic);
      };
      document.addEventListener('click', startMusic, { once: true });
      document.addEventListener('touchstart', startMusic, { once: true });
    });

    // 🎨 Setup post-processing
    this.setupPostProcessing();
  }

  setupPostProcessing() {
    if (!this.app?.renderer) {
      console.warn('[RecorridoScene] Cannot setup post-processing: renderer not available');
      this.isLUTReady = true;
      this.hideLUTLoadingOverlay({ immediate: true });
      return;
    }

    console.log('[RecorridoScene] Setting up post-processing...');

    this.isLUTReady = false;
    if (this._lutReadyRaf) {
      cancelAnimationFrame(this._lutReadyRaf);
      this._lutReadyRaf = null;
    }

    // Crear composer
    this.composer = new EffectComposer(this.app.renderer);
    console.log('[RecorridoScene] EffectComposer created');

    // Pass principal de renderizado
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    console.log('[RecorridoScene] RenderPass added');

    // GamerLUTPass con valores sutiles para el Delta (al final para que pueda renderizar a pantalla)
    this.gamerLUTPass = new GamerLUTPass({
      intensity: 0.0,        // Intensidad muy reducida
      saturation: 0,       // Saturación mínima
      contrast: 1.02,         // Contraste muy sutil
      brightness: 1.01,       // Brillo casi neutro
      vignetteStrength: 0.1   // Viñeta muy suave
    });
    this.gamerLUTPass.enabled = false; // Deshabilitado por defecto (se activa con tecla L)
    this.gamerLUTPass.renderToScreen = true;
    //this.composer.addPass(this.gamerLUTPass);

    console.log('[RecorridoScene] Post-processing setup complete.');
    console.log('  - GamerLUTPass: Press "L" to toggle');

    // 🔍 Debug function para verificar estado del post-processing
    window.debugPostProcessing = () => {
      console.log('═══════════════════════════════════════════════════');
      console.log('🎨 POST-PROCESSING DEBUG');
      console.log('═══════════════════════════════════════════════════');
      console.log('Composer exists:', !!this.composer);
      console.log('DiscoveryFilterPass exists:', !!this.discoveryFilterPass);
      console.log('GamerLUTPass exists:', !!this.gamerLUTPass);
      if (this.discoveryFilterPass) {
        console.log('DiscoveryFilterPass enabled:', this.discoveryFilterPass.enabled);
        console.log('DiscoveryFilterPass renderToScreen:', this.discoveryFilterPass.renderToScreen);
        console.log('DiscoveryFilterPass progress:', this.discoveryFilterPass.discoveryProgress);
      }
      if (this.gamerLUTPass) {
        console.log('GamerLUTPass enabled:', this.gamerLUTPass.enabled);
        console.log('GamerLUTPass renderToScreen:', this.gamerLUTPass.renderToScreen);
      }
      console.log('useGamerLUT:', this.useGamerLUT);
      console.log('═══════════════════════════════════════════════════');
    };

    // Exponer funciones globales para debugging y control del LUT
    window.toggleGamerLUT = () => {
      this.useGamerLUT = !this.useGamerLUT;
      console.log(`🎨 Gamer LUT: ${this.useGamerLUT ? 'ON ✅' : 'OFF ❌'}`);
    };

    window.setLUTIntensity = (value) => {
      if (this.gamerLUTPass) {
        this.gamerLUTPass.setIntensity(value);
        console.log(`🎨 LUT Intensity: ${value}`);
      }
    };

    window.lutPresetCyberpunk = () => {
      if (this.gamerLUTPass) {
        this.gamerLUTPass.presetCyberpunk();
        console.log('🎨 LUT Preset: Cyberpunk 🌃');
      }
    };

    window.lutPresetCompetitive = () => {
      if (this.gamerLUTPass) {
        this.gamerLUTPass.presetCompetitive();
        console.log('🎨 LUT Preset: Competitive 🎯');
      }
    };

    window.lutPresetCinematic = () => {
      if (this.gamerLUTPass) {
        this.gamerLUTPass.presetCinematic();
        console.log('🎨 LUT Preset: Cinematic 🎬');
      }
    };

    window.lutReset = () => {
      if (this.gamerLUTPass) {
        this.gamerLUTPass.reset();
        console.log('🎨 LUT Reset: Default values restored ↩️');
      }
    };

    this.queueLUTReady();
  }



  initInventoryCanvas() {
    this.inventoryCanvas = document.getElementById("inventoryCanvas");
    if (!this.inventoryCanvas) return;
    this.inventoryCtx = this.inventoryCanvas.getContext("2d");

    this.resizeInventoryCanvas();
    window.addEventListener("resize", () => this.resizeInventoryCanvas());

    // Se crea el objeto imagen, pero su 'src' se asignará dinámicamente
    this.inventoryImg = new Image();
  }

  setInventoryImage() {
    if (!this.inventoryImg) return;
    // 👇 Use SpeciesManager for panel paths
    const panelPath = this.speciesManager.getPanelPath();
    console.log('[RecorridoScene] Setting inventory image:', panelPath);
    this.inventoryImg.src = panelPath;

    // 👇 Force redraw when image loads
    this.inventoryImg.onload = () => {
      console.log('[RecorridoScene] Panel image loaded:', {
        path: panelPath,
        naturalWidth: this.inventoryImg.naturalWidth,
        naturalHeight: this.inventoryImg.naturalHeight
      });
    };
  }


  resizeInventoryCanvas() {
    if (!this.inventoryCanvas) return;
    const w = this.app?.BASE_WIDTH ?? window.innerWidth;
    const h = this.app?.BASE_HEIGHT ?? window.innerHeight;
    this.inventoryCanvas.width = w;
    this.inventoryCanvas.height = h;
  }

  showOverlayVideo(src) {
    const overlay = document.getElementById("videoOverlay");
    const video = document.getElementById("labVideo");

    video.src = src;
    overlay.style.display = "block";
    video.currentTime = 0;
    video.play();

    // ocultar cuando termine
    video.onended = () => {
      overlay.style.display = "none";
      video.pause();
      video.src = "";
    };
  }




  async loadInventoryCanvas() {
    // crear canvas y agregarlo al DOM si no existe
    const parent = this.overlayRoot || document.body;
    let canvas = parent.querySelector ? parent.querySelector('#inventoryCanvas') : document.getElementById("inventoryCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "inventoryCanvas";
      const w = this.app?.BASE_WIDTH ?? window.innerWidth;
      const h = this.app?.BASE_HEIGHT ?? window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none"; // no bloquea clicks en la escena 3D
      parent.appendChild(canvas);
    }
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";

    this.inventoryCanvas = canvas;
    this.inventoryCtx = canvas.getContext("2d");
    this.resizeInventoryCanvas();

    // dibujar contenido inicial
    const img = new Image();
    img.src = "/game-assets/recorrido/paneles/paneles_entero.png";
    img.onload = () => {
      this.inventoryCtx.clearRect(0, 0, canvas.width, canvas.height);
      // ejemplo: centrarlo en la parte baja de la pantalla
      const w = 400, h = 200;
      const x = (canvas.width - w) / 2;
      const y = canvas.height - h - 40;
      this.inventoryCtx.drawImage(img, x, y, w, h);
    };
  }

  // limpiar/remover
  removeInventoryCanvas() {
    if (this.inventoryCanvas) {
      this.inventoryCanvas.remove();
      this.inventoryCanvas = null;
      this.inventoryCtx = null;
    }
  }

  applyHuePingPongShader(mat) {
    mat.onBeforeCompile = (shader) => {
      // Guardamos la referencia para poder actualizar el tiempo después
      mat.userData.shader = shader;
      this.shaderMaterials?.add(mat);

      // Agregamos el uniform para el tiempo
      shader.uniforms.uTime = { value: 0.0 };

      // Inyectamos la función de conversión de color y el uniform al fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `
        uniform float uTime;

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
        `
      );

      // Inyectamos la lógica del ping-pong justo después de que se calcule el color emisivo del video
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>

        // --- LÓGICA DEL PING-PONG ---
        // 1. Onda sinusoidal para la oscilación suave (controla la velocidad con el multiplicador)
        float sineWave = sin(uTime * 30.8);

        // 2. Mapeamos de [-1, 1] a [0, 1]
        float pingPongT = (sineWave + 1.0) * 0.5;

        // 3. Calculamos el HUE actual. Puedes cambiar 0.0 y 0.33 para otros rangos de color.
        float currentHue = mix(0.2, 0.30, pingPongT);
        
        // 4. Convertimos a RGB
        vec3 pingPongColor = hsv2rgb(vec3(currentHue, 1.0, 1.0));

        // 5. Mezclamos el color original del video (totalEmissiveRadiance) con nuestro color animado.
        //    El último valor (0.7) controla la intensidad de la mezcla. 1.0 sería reemplazarlo por completo.
        totalEmissiveRadiance = mix(totalEmissiveRadiance, pingPongColor, 0.7);
        `
      );
    };
    mat.needsUpdate = true;
  }


  // toggle
  toggleInventory(useCanvas) {
    if (useCanvas) {
      this.loadInventoryCanvas();
    } else {
      this.removeInventoryCanvas();
    }
  }

  // --- ADD: helpers
  setupOverlay() {
    // cámara ortográfica en píxeles de pantalla
    this.app.renderer.getSize(this.screenSize);
    const w = this.screenSize.x, h = this.screenSize.y;
    this.overlayCam = new THREE.OrthographicCamera(0, w, h, 0, -10, 10);
    this.overlayCam.position.z = 5;

    window.addEventListener('resize', () => this.onResizeOverlay());

    // 🎯 Create camera debug overlay
    //this.setupCameraDebugOverlay();
  }

  queueLUTReady() {
    if (this._lutReadyRaf) {
      cancelAnimationFrame(this._lutReadyRaf);
    }
    this._lutReadyRaf = requestAnimationFrame(() => {
      this._lutReadyRaf = null;
      this.isLUTReady = true;
      this.hideLUTLoadingOverlay();
      // 🎬 Iniciar fade desde negro cuando todo esté listo
      this.hideFadeOverlay();
    });
  }

  collectShaderMaterials(root) {
    if (!root) return;
    const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
    root.traverse((child) => {
      const materials = toArray(child.material);
      for (const mat of materials) {
        const shader = mat?.userData?.shader;
        if (shader?.uniforms?.uTime) {
          this.shaderMaterials.add(mat);
        }
      }
    });
  }

  showLUTLoadingOverlay() {
    if (this.lutLoadingOverlay || !this.overlayRoot) return;

    const overlay = document.createElement('div');
    overlay.className = 'lut-loading-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: #000;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.45s ease;
      z-index: 9999;
    `;

    this.overlayRoot.appendChild(overlay);
    this.lutLoadingOverlay = overlay;

    if (this._lutOverlayTimeout) {
      clearTimeout(this._lutOverlayTimeout);
      this._lutOverlayTimeout = null;
    }
  }

  showFadeOverlay() {
    if (this.fadeOverlay || !this.overlayRoot) return;

    const overlay = document.createElement('div');
    overlay.className = 'fade-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: #000;
      pointer-events: none;
      opacity: 1;
      transition: opacity 1.2s ease-out;
      z-index: 10000;
    `;

    this.overlayRoot.appendChild(overlay);
    this.fadeOverlay = overlay;

    // Iniciar fade out después de que todos los recursos estén cargados
    // Se llamará desde queueLUTReady() cuando todo esté listo
  }

  hideFadeOverlay({ immediate = false } = {}) {
    const overlay = this.fadeOverlay;
    if (!overlay) return;

    if (this._fadeOverlayTimeout) {
      clearTimeout(this._fadeOverlayTimeout);
      this._fadeOverlayTimeout = null;
    }

    const cleanup = () => {
      overlay.removeEventListener('transitionend', cleanup);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (this.fadeOverlay === overlay) {
        this.fadeOverlay = null;
      }
    };

    if (immediate) {
      cleanup();
      return;
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
    });

    overlay.addEventListener('transitionend', cleanup, { once: true });
    this._fadeOverlayTimeout = setTimeout(cleanup, 1400);
  }

  hideLUTLoadingOverlay({ immediate = false } = {}) {
    const overlay = this.lutLoadingOverlay;
    if (!overlay) return;

    if (this._lutOverlayTimeout) {
      clearTimeout(this._lutOverlayTimeout);
      this._lutOverlayTimeout = null;
    }

    const cleanup = () => {
      overlay.removeEventListener('transitionend', cleanup);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (this.lutLoadingOverlay === overlay) {
        this.lutLoadingOverlay = null;
      }
    };

    if (immediate) {
      cleanup();
      return;
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
    });

    overlay.addEventListener('transitionend', cleanup, { once: true });
    this._lutOverlayTimeout = setTimeout(cleanup, 700);
  }

  setupCameraDebugOverlay() {
    // Create HTML overlay element
    this.cameraDebugOverlay = document.createElement('div');
    this.cameraDebugOverlay.id = 'camera-debug-overlay';
    this.cameraDebugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      border: 1px solid #00ff00;
      border-radius: 4px;
      z-index: 10000;
      pointer-events: none;
      min-width: 200px;
    `;
    document.body.appendChild(this.cameraDebugOverlay);
  }

  onResizeOverlay() {
    this.app.renderer.getSize(this.screenSize);
    const w = this.screenSize.x, h = this.screenSize.y;
    this.overlayCam.left = 0; this.overlayCam.right = w; this.overlayCam.bottom = h; this.overlayCam.top = 0;
    this.overlayCam.updateProjectionMatrix();
  }

  initHUDVideo() {
    this.hudVideo = document.getElementById("hudVideo");
    this.hudCanvas = document.getElementById("hudCanvas");
    this.hudCtx = this.hudCanvas.getContext("2d");

    const w = this.app?.BASE_WIDTH ?? window.innerWidth;
    const h = this.app?.BASE_HEIGHT ?? window.innerHeight;
    this.hudCanvas.width = w;
    this.hudCanvas.height = h;
  }

  playHUDVideo() {
    if (!this.hudVideo) this.initHUDVideo();
    this.hudVideo.currentTime = 0;
    this.hudVideo.play();

    const draw = () => {
      if (this.hudVideo.paused || this.hudVideo.ended) return;

      this.hudCtx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
      this.hudCtx.drawImage(this.hudVideo, 0, 0, this.hudCanvas.width, this.hudCanvas.height);

      // key out blacks
      const frame = this.hudCtx.getImageData(0, 0, this.hudCanvas.width, this.hudCanvas.height);
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = (r + g + b) / 3; // brillo promedio

        // umbrales
        const low = 2;   // todo más oscuro que esto = 100% transparente
        const high = 80;  // todo más brillante que esto = 100% opaco

        // alpha suavizado (0..255)
        let alpha;
        if (luma <= low) alpha = 0;
        else if (luma >= high) alpha = 255;
        else {
          const t = (luma - low) / (high - low); // 0..1
          alpha = Math.floor(t * 255);
        }

        data[i + 3] = alpha;
      }
      this.hudCtx.putImageData(frame, 0, 0);

      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  stopHUDVideo() {
    if (!this.hudVideo) return;

    this.hudVideo.pause();
    this.hudVideo.currentTime = 0;
    // limpiar canvas
    if (this.hudCtx && this.hudCanvas) {
      this.hudCtx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
    }
  }



  async unmount() {
    console.log('[RecorridoScene] Starting unmount...');
    // 👇 Ocultar elementos específicos de RecorridoScene (inventoryCanvas y zócalo)
    const inventoryCanvas = document.getElementById('inventoryCanvas');
    const zocaloVideo = document.getElementById('zocaloVideo');
    if (inventoryCanvas) inventoryCanvas.style.display = 'none';
    if (zocaloVideo) {
      zocaloVideo.style.display = 'none';
      zocaloVideo.style.opacity = '0';
      zocaloVideo.pause();
      zocaloVideo.src = '';
    }

    // Ocultar video overlay si está visible
    const videoOverlay = document.getElementById('videoOverlay');
    if (videoOverlay) {
      videoOverlay.style.display = 'none';
      // Pausar el video si está reproduciéndose
      const labVideo = document.getElementById('labVideo');
      if (labVideo) {
        labVideo.pause();
        labVideo.currentTime = 0;
      }
    }

    // Ocultar overlays de recorrido (mapa y metadata)
    const mapOverlay = document.querySelector('.map-overlay');
    const metadataOverlay = document.querySelector('.metadata-overlay');
    if (mapOverlay) mapOverlay.style.display = 'none';
    if (metadataOverlay) metadataOverlay.style.display = 'none';

    if (this._lutReadyRaf) {
      cancelAnimationFrame(this._lutReadyRaf);
      this._lutReadyRaf = null;
    }
    if (this._lutOverlayTimeout) {
      clearTimeout(this._lutOverlayTimeout);
      this._lutOverlayTimeout = null;
    }
    if (this._fadeOverlayTimeout) {
      clearTimeout(this._fadeOverlayTimeout);
      this._fadeOverlayTimeout = null;
    }
    this.hideLUTLoadingOverlay({ immediate: true });
    this.hideFadeOverlay({ immediate: true });
    this.isLUTReady = false;

    this.app.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.app.canvas.removeEventListener('mouseleave', this._onLeave);
    this.app.canvas.removeEventListener('click', this._onClick);
    this.app.canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);

    // 👇 Destroy CursorRadarModule
    if (this.cursorRadar) {
      this.cursorRadar.destroy();
    }

    // 🎯 Remove camera debug overlay
    if (this.cameraDebugOverlay) {
      this.cameraDebugOverlay.remove();
      this.cameraDebugOverlay = null;
    }

    // Stop scene-specific audio
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }

    // Stop background music
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
      this.backgroundMusic = null;
    }

    // Stop transition audio
    if (this.transitionAudio) {
      this.transitionAudio.pause();
      this.transitionAudio.currentTime = 0;
      this.transitionAudio = null;
    }

    // Stop scene start audio
    if (this.sceneStartAudio) {
      this.sceneStartAudio.pause();
      this.sceneStartAudio.currentTime = 0;
      this.sceneStartAudio = null;
    }

    // Clean up video texture
    if (this.currentVideoTexture) {
      this.currentVideoTexture.dispose();
      this.currentVideoTexture = null;
    }

    // 👇 OPTIMIZACIÓN: Limpiar caché de shaders flash
    if (this._flashShaderCache) {
      this._flashShaderCache.forEach(shader => {
        try { shader.dispose(); } catch { }
      });
      this._flashShaderCache.clear();
      this._flashShaderCache = null;
    }

    if (this.stageModel) {
      this.stageModel.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose?.();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach(mat => mat?.dispose?.());
          } else {
            material?.dispose?.();
          }
        }
      });
      this.scene.remove(this.stageModel);
      this.stageModel = null;
    }
    this.shaderMaterials.clear();

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }

    // Clean up preloaded data video
    if (this.preloadedDataVideo) {
      this.preloadedDataVideo.pause();
      this.preloadedDataVideo.src = '';
      this.preloadedDataVideo = null;
    }
    console.log('[RecorridoScene] Unmount completed');
  }

  async loadStage(i, options = {}) {
    this.current = i;
    const st = this.stages[i];
    if (!st) return;

    // 👇 NO resetear flechaClicked aquí - se resetea después de la transición completa

    // Detener audio de transición si está reproduciéndose (solo si no estamos en modo preload)
    if (this.transitionAudio && !options.keepTransitionAudio) {
      this.transitionAudio.pause();
      this.transitionAudio = null;
    }

    // 👇 Update SpeciesManager stage based on scene index
    // Scene index 0-5 always maps to stages 1-6
    // Round is preserved from SpeciesManager's current state
    const round = this.speciesManager.currentRound;
    const stage = (i % 6) + 1;

    // 👇 Bloquear cámara en ronda 1 hasta que se descubra la especie de esta escena específica
    if (round === 1) {
      this.cameraLocked = true;
      this.lat = 0;
      this.velLat = 0;
      console.log('🔒 Cámara bloqueada (Ronda 1, Ambiente ' + stage + ')');
    } else {
      this.cameraLocked = false;
      console.log('🔓 Cámara desbloqueada (Ronda ' + round + ')');
    }

    // Update SpeciesManager (this will save to localStorage)
    this.speciesManager.setRoundAndStage(round, stage);

    // 👇 Get current species from SpeciesManager
    this.currentSpecies = this.speciesManager.getCurrentSpecies();

    // 🔍 LOG: Información detallada de la escena y especie
    console.log('═══════════════════════════════════════════════════');
    console.log('🎬 CARGANDO ESCENA');
    console.log('═══════════════════════════════════════════════════');
    console.log('📍 Índice escena:', i);
    console.log('📍 Ronda:', round, `(${this.speciesManager.getRoundLetter(round)})`);
    console.log('📍 Ambiente:', stage);
    console.log('📦 GLB cargando:', st.model || 'ninguno (usando foto)');
    if (this.currentSpecies) {
      console.log('🐾 Especie a descubrir:');
      console.log('  - ID:', this.currentSpecies.id);
      console.log('  - Nombre común:', this.currentSpecies.commonName);
      console.log('  - Nombre científico:', this.currentSpecies.scientificName);
      console.log('  - Mesh glitch:', this.currentSpecies.meshNames.glitch);
      console.log('  - Mesh rastro:', this.currentSpecies.meshNames.rastro);
      console.log('  - animationSpeed:', this.currentSpecies.animationSpeed ?? 'no definido (default 1.0)');
    } else {
      console.log('⚠️ No hay especie asignada a esta escena');
    }
    console.log('═══════════════════════════════════════════════════');

    this.setInventoryImage();

    // Clean up previous stage's video and model
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
      this.videoElement = null;
    }
    if (this.stageModel) {
      this.stageModel.traverse(object => {
        if (object.isMesh) {
          object.geometry.dispose();
          if (object.material.isMaterial) {
            object.material.dispose();
          } else {
            for (const material of object.material) material.dispose();
          }
        }
      });
      this.scene.remove(this.stageModel);
      this.stageModel = null;
    }
    this.shaderMaterials.clear();

    // Clean up animation mixers
    // 👇 Limpiar todos los mixers de flechas
    if (this.flechaAnimationMixers) {
      this.flechaAnimationMixers.forEach(mixer => {
        mixer?.stopAllAction?.();
      });
      this.flechaAnimationMixers = [];
      this.flechaAnimationActions = [];
    }
    this.flechaMasterMixer = null;

    // 🐟 Clean up carpa animation mixer
    if (this.carpaAnimationMixer) {
      this.carpaAnimationMixer.stopAllAction();
      this.carpaAnimationMixer = null;
      this.carpaAnimationAction = null;
    }

    // 🐟 Clean up carpa3d references
    this.carpa3dObject = null;
    this.carpa3dHover.enabled = false;
    this.carpa3dRotation.enabled = false;

    if (this.stageAnimationMixer) {
      this.stageAnimationMixer.stopAllAction();
      this.stageAnimationMixer = null;
      this.glitchAnimationAction = null;
      this.rastroAnimationAction = null;
    }

    this.gltfAnimations = [];
    this.glitchObject = null;
    this.rastroObject = null;
    this.flechaObject = null;
    this.flechaObjects = []; // 👈 Array para múltiples flechas
    this.flechaAnimationMixers = []; // 👈 Array de mixers
    this.flechaAnimationActions = []; // 👈 Array de actions
    this.carpaObject = null; // 🐟 Limpiar referencia de carpa
    this.carpa3dObject = null; // 🐟 Limpiar referencia de carpa3d
    this.glitchFlashState = null;

    // 🔊 Clean up species audio
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.stereoPanner) {
      this.stereoPanner.disconnect();
      this.stereoPanner = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.speciesAudio) {
      this.speciesAudio.pause();
      this.speciesAudio.src = '';
      this.speciesAudio = null;
    }

    if (this.butterflyMixer) {
      try { this.butterflyMixer.stopAllAction(); } catch { }
      this.butterflyMixer = null;
      this.butterflyAction = null;
    }
    if (this.butterfly) {
      this.butterfly.parent?.remove(this.butterfly);
      this.butterfly = null;
    }
    if (this.butterflyOrbit) {
      this.butterflyOrbit.angle = 0;
    }

    // Clean up lens flare
    if (this.lensflare && this.sunLight) {
      this.sunLight.remove(this.lensflare);
    }
    this.lensflare = null;
    if (this.lensflareTextures?.length) {
      this.lensflareTextures.forEach(tex => tex.dispose?.());
    }
    this.lensflareTextures = [];
    if (this.sunLight) {
      console.debug('[RecorridoScene] Removing sun light and lens flare');
      this.scene.remove(this.sunLight);
      this.sunLight.dispose?.();
      this.sunLight = null;
    }
    this.sunObject = null;
    this._flareDebug = { created: false, frameLogged: false };

    // Load panorama: prioritize GLB, fallback to photo
    if (st.model) {
      const gltf = await this.gltfLoader.loadAsync(st.model);
      this.stageModel = gltf.scene;

      // Store animations for later use
      this.gltfAnimations = gltf.animations || [];

      // 🔍 LOG: Información del GLB cargado
      console.log('───────────────────────────────────────────────────');
      console.log('✅ GLB CARGADO EXITOSAMENTE');
      console.log('───────────────────────────────────────────────────');
      console.log('📦 Archivo:', st.model);
      console.log('🎭 Meshes encontrados en el GLB:');
      const meshList = [];
      this.stageModel.traverse(child => {
        if (child.isMesh) {
          meshList.push(child.name);
          console.log(`  - "${child.name}" (visible: ${child.visible})`);
        }
      });
      console.log('🎬 Animaciones encontradas:', this.gltfAnimations.length);
      if (this.gltfAnimations.length > 0) {
        this.gltfAnimations.forEach((anim, idx) => {
          console.log(`  ${idx + 1}. ${anim.name} (duración: ${anim.duration.toFixed(2)}s)`);
        });
      }

      // Check if expected meshes are present
      if (this.currentSpecies) {
        const expectedGlitch = this.currentSpecies.meshNames.glitch;
        const expectedRastro = this.currentSpecies.meshNames.rastro;
        const hasGlitch = meshList.includes(expectedGlitch);
        const hasRastro = meshList.includes(expectedRastro);

        console.log('🔍 Buscando meshes de especie:', this.currentSpecies.commonName);
        console.log(`  - "${expectedGlitch}": ${hasGlitch ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
        console.log(`  - "${expectedRastro}": ${hasRastro ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);

        if (!hasGlitch) {
          console.warn(`⚠️ PROBLEMA: No se encontró el mesh "${expectedGlitch}" en el GLB`);
          console.warn('   Meshes disponibles:', meshList.join(', '));
        }
      }
      console.log('───────────────────────────────────────────────────');

      this.stageModel.traverse(child => {
        if (child.isMesh) {
          // 👇 Detectar TODAS las especies en el GLB (no solo la actual del turno)
          const meshName = child.name;

          // Verificar si este mesh es un glitch o rastro de alguna especie
          const isGlitchMesh = meshName.endsWith('_glitch');
          const isRastroMesh = meshName.endsWith('_rastro');

          if (isGlitchMesh || isRastroMesh) {
            // Extraer ID de especie del nombre del mesh (ej: "yarara_glitch" -> "yarara")
            const speciesId = meshName.replace(/_glitch$|_rastro$/, '');

            // Buscar datos de esta especie en el SpeciesManager
            const speciesData = this.speciesManager.speciesData?.species?.find(s => s.id === speciesId);

            if (!speciesData) {
              console.warn(`⚠️ Especie no encontrada en datos: ${speciesId} (mesh: ${meshName})`);
              child.visible = false;
              return;
            }

            // Verificar si esta especie YA fue descubierta (en cualquier ronda anterior)
            const wasDiscovered = this.speciesManager.isSpeciesFound(speciesId);

            // ═══════════════════════════════════════════════════════
            // GLITCH MESH
            // ═══════════════════════════════════════════════════════
            if (isGlitchMesh) {
              // Solo asignar como glitchObject si es la especie ACTUAL del turno
              const isCurrentSpecies = this.currentSpecies && speciesId === this.currentSpecies.id;

              if (isCurrentSpecies) {
                this.glitchObject = child;

                console.log('🎯 MESH GLITCH DETECTADO (ESPECIE ACTUAL):', meshName);
                console.log('  - Especie:', speciesData.commonName);
                console.log('  - Video glitch:', speciesData.assets.glitchVideo);
                console.log('  - Ya descubierta:', wasDiscovered);

                if (wasDiscovered) {
                  // Ya fue descubierta -> ocultar glitch
                  child.visible = false;
                  console.log('  - Estado: YA DESCUBIERTA -> glitch oculto ❌');
                } else {
                  // No descubierta -> mostrar glitch con video
                  child.visible = true;

                  // Setup video texture
                  if (this.videoElement) {
                    this.videoElement.pause();
                    this.videoElement.src = '';
                  }

                  if (this.currentVideoTexture) {
                    this.currentVideoTexture.dispose();
                    this.currentVideoTexture = null;
                  }

                  this.videoElement = document.createElement('video');
                  this.videoElement.src = speciesData.assets.glitchVideo;
                  this.videoElement.crossOrigin = 'anonymous';
                  this.videoElement.loop = true;
                  this.videoElement.muted = true;
                  this.videoElement.playsInline = true;
                  this.videoElement.setAttribute('webkit-playsinline', 'true');
                  this.videoElement.preload = 'auto';
                  this.videoElement.playbackRate = speciesData.glitchVideoSpeed || 0.25;
                  this.videoElement.play().catch(e => console.error("Video play failed:", e));

                  const videoTexture = new THREE.VideoTexture(this.videoElement);
                  videoTexture.generateMipmaps = false;
                  videoTexture.minFilter = THREE.LinearFilter;
                  videoTexture.magFilter = THREE.LinearFilter;
                  videoTexture.format = THREE.RGBAFormat;
                  videoTexture.wrapS = THREE.ClampToEdgeWrapping;
                  videoTexture.wrapT = THREE.RepeatWrapping;
                  videoTexture.repeat.set(1, -1);
                  videoTexture.offset.set(0, 1);
                  this.currentVideoTexture = videoTexture;

                  if (child.material && child.material.emissiveMap) {
                    child.material.emissiveMap.dispose();
                  }

                  child.material.side = THREE.DoubleSide;
                  child.material.color.set(0xffffff);
                  child.material.map = videoTexture;
                  child.material.transparent = true;
                  child.material.depthWrite = false;
                  child.material.emissive.set(0x000000);
                  child.material.needsUpdate = true;

                  console.log('  - Estado: NO DESCUBIERTA -> glitch visible con video ✅');
                }
              } else {
                // NO es la especie actual del turno
                console.log('🔇 MESH GLITCH OTRAS ESPECIES:', meshName);
                console.log('  - Especie:', speciesData.commonName);
                console.log('  - Ya descubierta:', wasDiscovered);

                if (wasDiscovered) {
                  // Ya descubierta en otro turno -> ocultar glitch
                  child.visible = false;
                  console.log('  - Estado: YA DESCUBIERTA (otra ronda) -> glitch oculto ❌');
                } else {
                  // No descubierta aún -> ocultar todo (sin glitch, sin rastro, sin sonido)
                  child.visible = false;
                  console.log('  - Estado: AÚN NO DESCUBIERTA -> todo oculto 🚫');
                }
              }
            }

            // ═══════════════════════════════════════════════════════
            // RASTRO MESH
            // ═══════════════════════════════════════════════════════
            else if (isRastroMesh) {
              // Solo asignar como rastroObject si es la especie ACTUAL del turno
              const isCurrentSpecies = this.currentSpecies && speciesId === this.currentSpecies.id;

              if (isCurrentSpecies) {
                this.rastroObject = child;
                if (child.material) {
                  child.material.transparent = true;
                }
              }

              console.log('� MESH RASTRO DETECTADO:', meshName);
              console.log('  - Especie:', speciesData.commonName);
              console.log('  - Ya descubierta:', wasDiscovered);
              console.log('  - Es especie actual:', isCurrentSpecies);

              if (wasDiscovered) {
                // Ya descubierta -> mostrar rastro
                child.visible = true;
                console.log('  - Estado: YA DESCUBIERTA -> rastro visible ✅');
              } else {
                // No descubierta -> ocultar rastro
                child.visible = false;
                console.log('  - Estado: AÚN NO DESCUBIERTA -> rastro oculto ❌');
              }
            }

          } else if (child.name) {
            const lowerName = child.name.toLowerCase();

            if (lowerName === 'flecha_empty') {
              this.flechaObject = child;
              if (child.visible) {
                console.log('➡️ ROOT FLECHA DETECTADO: flecha_empty - visible antes:', child.visible);
              }
              child.visible = false;
              return;
            }

            if (lowerName === 'flecha' || lowerName.startsWith('flecha.') || lowerName.match(/^flecha\d+$/)) {
              // 👇 Detectar todas las flechas (flecha, flecha.001, flecha.002, flecha1, flecha2, flecha3, etc.)
              if (!this.flechaObject && child.parent && child.parent.name && child.parent.name.toLowerCase() === 'flecha_empty') {
                this.flechaObject = child.parent;
                this.flechaObject.visible = false;
              } else if (!this.flechaObject && child.parent && child.parent !== this.stageModel) {
                this.flechaObject = child.parent;
                this.flechaObject.visible = false;
              } else if (!this.flechaObject) {
                this.flechaObject = child;
              }

              if (child.isMesh && !this.flechaObjects.includes(child)) {
                this.flechaObjects.push(child);
              }

              // 🔍 LOG: Mesh flecha detectado
              console.log('➡️ MESH FLECHA DETECTADO:', child.name, '- Visible antes:', child.visible);
              child.visible = false;
              console.log('   Visible después:', child.visible);

              // Set up flecha animation mixer and action
              if (child.isMesh && this.gltfAnimations && this.gltfAnimations.length > 0) {
                if (!this.flechaMasterMixer && this.stageModel) {
                  this.flechaMasterMixer = new THREE.AnimationMixer(this.stageModel);
                  this.flechaAnimationMixers.push(this.flechaMasterMixer);
                }

                const childNameLower = child.name.toLowerCase();
                const parentNameLower = child.parent?.name?.toLowerCase?.() || '';
                const ancestorNameLower = child.parent?.parent?.name?.toLowerCase?.() || '';

                // Build candidate names: original + variations
                const baseNames = [childNameLower, parentNameLower, ancestorNameLower].filter(Boolean);
                const candidateNames = new Set(baseNames);

                // Add variations: flecha.001 -> flecha, flecha1
                baseNames.forEach(name => {
                  // Remove .NNN suffix -> "flecha"
                  const withoutDotSuffix = name.replace(/\.\d+$/u, '');
                  if (withoutDotSuffix !== name) {
                    candidateNames.add(withoutDotSuffix);
                  }
                  // Extract digit and create flechaN variant: flecha.001 -> flecha1
                  const digitMatch = name.match(/\.(\d+)$/);
                  if (digitMatch && withoutDotSuffix) {
                    const digitStr = parseInt(digitMatch[1], 10).toString(); // "001" -> "1"
                    candidateNames.add(`${withoutDotSuffix}${digitStr}`);
                  }
                });

                let matchedTrackNode = null;
                let flechaAnimation = null;

                // 1) Buscar por las pistas del clip: matchea el nodo que anima
                for (const anim of this.gltfAnimations) {
                  for (const track of anim.tracks) {
                    const nameStr = track.name || '';
                    // Track format: "nodeName.property" or "parent|child.property"
                    const lastDot = nameStr.lastIndexOf('.');
                    const rawNode = lastDot >= 0 ? nameStr.substring(0, lastDot) : nameStr;
                    const trackNodeName = rawNode.includes('|') ? rawNode.split('|').pop() : rawNode;
                    const trackNodeLower = trackNodeName.replace(/\\\./g, '.').toLowerCase();

                    if (candidateNames.has(trackNodeLower)) {
                      flechaAnimation = anim;
                      matchedTrackNode = trackNodeName;
                      break;
                    }
                  }
                  if (flechaAnimation) break;
                }

                // 2) Fallback: buscar por nombre del clip (Action, Action.001, etc.)
                if (!flechaAnimation) {
                  const suffixMatch = child.name.match(/(\.\d+)?$/);
                  const suffix = (suffixMatch?.[1] || '').toLowerCase();
                  const desiredAnimName = `action${suffix}`;
                  flechaAnimation = this.gltfAnimations.find(anim =>
                    (anim.name || '').toLowerCase() === desiredAnimName
                  ) || null;
                }

                // 3) Último recurso: heurística por contenido del nombre
                if (!flechaAnimation) {
                  flechaAnimation = this.gltfAnimations.find(anim => {
                    const animNameLower = anim.name?.toLowerCase?.() || '';
                    return animNameLower.includes('flecha') ||
                      animNameLower.includes('arrow') ||
                      Array.from(candidateNames).some(c => animNameLower.includes(c));
                  }) || null;
                }

                if (!flechaAnimation && this.gltfAnimations.length > 0) {
                  flechaAnimation = this.gltfAnimations[0];
                }

                if (!flechaAnimation) {
                  console.warn(`   ⚠️ No se encontró animación para ${child.name}`);
                }

                if (flechaAnimation && this.flechaMasterMixer) {
                  try {
                    const action = this.flechaMasterMixer.clipAction(flechaAnimation);
                    action.setLoop(THREE.LoopRepeat);
                    action.clampWhenFinished = false;
                    action.enabled = true;
                    action.setEffectiveWeight(1.0);
                    action.setEffectiveTimeScale(1.0);
                    action.reset();

                    // 2-frame offset per arrow, reversed order (assuming 30fps)
                    const flechaIndex = this.flechaObjects.indexOf(child);
                    if (flechaIndex >= 0) {
                      const reverseIndex = (this.flechaObjects.length - 1) - flechaIndex;
                      const frameOffset = reverseIndex * 2; // Last arrow = 0, first arrow = most offset
                      const timeOffset = frameOffset / 30; // Convert to seconds
                      action.time = timeOffset;
                    }

                    action.play();

                    this.flechaAnimationActions.push(action);
                    const logTrack = matchedTrackNode ? ` (track: ${matchedTrackNode})` : '';
                    console.log(`   ✅ Animación configurada: ${flechaAnimation.name}${logTrack}`);
                  } catch (error) {
                    console.error(`   ❌ Error al configurar animación:`, error);
                    this.flechaAnimationActions.push(null);
                  }
                } else {
                  if (!this.flechaMasterMixer) {
                    console.warn('   ⚠️ No se pudo crear flechaMasterMixer (stageModel ausente)');
                  }
                  this.flechaAnimationActions.push(null);
                }
              } else if (child.isMesh) {
                this.flechaAnimationActions.push(null);
              }
            }
          } else if (child.name === 'carpa' || child.name.toLowerCase().includes('carpa')) {
            // 🐟 Detectar mesh de la carpa
            this.carpaObject = child;
            child.visible = true; // 👈 La carpa siempre es visible

            console.log('🐟 MESH CARPA DETECTADO:', child.name);

            // 🐟 Detectar si es carpa3d para animación de hover
            const isCarpa3D = child.name === 'carpa3d';
            if (isCarpa3D) {
              this.carpa3dObject = child;
              this.carpa3dHover.baseY = child.position.y;
              this.carpa3dHover.enabled = true;
              this.carpa3dRotation.enabled = true;
              console.log('🐟✨ CARPA3D DETECTADO - Hover y rotación activados');
              console.log('   Posición inicial Y:', this.carpa3dHover.baseY);
            }

            // Set up carpa animation mixer and action
            if (this.gltfAnimations && this.gltfAnimations.length > 0) {
              this.carpaAnimationMixer = new THREE.AnimationMixer(child);

              // Buscar animación que contenga 'carpa' en el nombre
              let carpaAnimation = this.gltfAnimations.find(anim =>
                anim.name.toLowerCase().includes('carpa')
              );

              // Si no se encuentra por nombre, buscar en los tracks
              if (!carpaAnimation) {
                carpaAnimation = this.gltfAnimations.find(anim =>
                  anim.tracks.some(track =>
                    track.name.toLowerCase().includes('carpa') ||
                    track.name.includes(child.name) ||
                    track.name.includes(child.uuid)
                  )
                );
              }

              if (carpaAnimation) {
                try {
                  this.carpaAnimationAction = this.carpaAnimationMixer.clipAction(carpaAnimation);
                  this.carpaAnimationAction.setLoop(THREE.LoopRepeat); // Loop continuo
                  this.carpaAnimationAction.clampWhenFinished = false;
                  this.carpaAnimationAction.play();
                  console.log(`🐟 Animación de carpa iniciada en loop: ${carpaAnimation.name}`);
                } catch (error) {
                  console.error('🐟 Error al iniciar animación de carpa:', error);
                  this.carpaAnimationAction = null;
                }
              } else {
                console.warn('🐟 No se encontró animación para la carpa');
              }
            }
          }
        } else if (child.name === 'Sun' || child.name === 'sun') {
          this.sunObject = child;
          if (!child.parent) {
            console.warn('[RecorridoScene] Sun object has no parent in GLTF scene graph.');
          }
          const sunWorld = child.getWorldPosition(new THREE.Vector3());
          console.debug('[RecorridoScene] Sun null found', {
            localPosition: child.position.toArray(),
            worldPosition: sunWorld.toArray()
          });
        }
      });

      // 🎬 Set up animations for the entire stage model (play once and stop)
      if (this.gltfAnimations && this.gltfAnimations.length > 0 && this.stageModel) {
        console.log('🎬 Configurando animaciones del GLB...');
        console.log('  Total de animaciones:', this.gltfAnimations.length);

        // Create a single mixer for the entire stage model
        this.stageAnimationMixer = new THREE.AnimationMixer(this.stageModel);

        // Get animation speed from current species data (default: 1.0)
        const animSpeed = this.currentSpecies?.animationSpeed ?? 1.0;

        this.gltfAnimations.forEach((anim, idx) => {
          console.log(`  ${idx + 1}. "${anim.name}" (${anim.duration.toFixed(2)}s)`);

          // Check if this animation targets glitch or rastro objects
          const isGlitchAnim = anim.name.toLowerCase().includes('glitch');
          const isRastroAnim = anim.name.toLowerCase().includes('rastro');

          if (isGlitchAnim || isRastroAnim) {
            const action = this.stageAnimationMixer.clipAction(anim);
            action.setLoop(THREE.LoopOnce); // Play once
            action.clampWhenFinished = true; // Stay at last frame
            action.setEffectiveTimeScale(animSpeed); // 👈 Velocidad según especie
            action.play();

            const realDuration = anim.duration / animSpeed;
            console.log(`     ✅ Reproduciendo a ${animSpeed}x: ${anim.name} (duración real: ${realDuration.toFixed(2)}s)`);

            // Store action references
            if (isGlitchAnim) {
              this.glitchAnimationAction = action;
            }
            if (isRastroAnim) {
              this.rastroAnimationAction = action;
            }
          }
          // 🐟 Las animaciones de carpa se manejan en su propio mixer (carpaAnimationMixer)
        });

        if (!this.glitchAnimationAction && !this.rastroAnimationAction) {
          console.log('  ⚠️ No se encontraron animaciones de glitch o rastro');
          // Clean up mixer if no animations were set up
          this.stageAnimationMixer = null;
        }
      }

      // Create lens flare if Sun object was found
      if (this.sunObject) {
        await this.createLensFlare();
      } else {
        console.warn('[RecorridoScene] No Sun null found in stage model; lens flare skipped.');
      }

      this.scene.add(this.stageModel);
      this.collectShaderMaterials(this.stageModel);

      // 👇 IMPORTANTE: Asegurar que todas las flechas estén ocultas al inicio
      // Hacemos un traverse adicional para capturar cualquier flecha que se haya escapado
      this.stageModel.traverse(child => {
        if (!child.name) {
          return;
        }

        const lowerName = child.name.toLowerCase();

        if (lowerName === 'flecha_empty') {
          child.visible = false;
          if (!this.flechaObject) {
            this.flechaObject = child;
          }
          return;
        }

        if (child.isMesh && (lowerName === 'flecha' || lowerName.startsWith('flecha.') || lowerName.match(/^flecha\d+$/))) {
          const wasVisible = child.visible;
          child.visible = false;
          if (wasVisible) {
            console.log(`🚫 FORZANDO OCULTAR: ${child.name} (estaba visible: ${wasVisible})`);
          }

          // Asegurarnos de que esté en el array
          if (!this.flechaObjects.includes(child)) {
            console.warn(`⚠️ Flecha ${child.name} no estaba en flechaObjects, agregándola`);
            this.flechaObjects.push(child);
            this.flechaAnimationActions.push(null);
          }
        }
      });

      if (this.flechaObjects && this.flechaObjects.length > 0) {
        console.log(`🚫 ${this.flechaObjects.length} flechas confirmadas como ocultas`);
      }

      await this.spawnButterflyNearGlitch();
    } else if (st.photo) {
      const sphereGeo = new THREE.SphereGeometry(500, 64, 48).scale(-1, 1, 1);
      const tex = await AssetLoader.texture(st.photo);
      const sphereMat = new THREE.MeshBasicMaterial({
        map: tex,
        fog: false,
        lights: false
      });
      this.stageModel = new THREE.Mesh(sphereGeo, sphereMat);
      this.stageModel.receiveShadow = false;
      this.stageModel.castShadow = false;
      this.scene.add(this.stageModel);
      this.collectShaderMaterials(this.stageModel);
    }


    if (st.forward) {
      this.lon = st.forward.yaw;
      this.lat = st.forward.pitch;
    }

    // Stage-specific audio (different from background music)
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (st.audio) {
      this.audio = AssetLoader.audio(st.audio);
      this.audio.loop = true;
      this.audio.volume = 0.8;
      this.audio.play().catch(() => { });
    }

    // 🔊 Load species spatial audio - SOLO si la especie NO ha sido descubierta
    if (this.currentSpecies?.id) {
      const wasDiscovered = this.speciesManager.isSpeciesFound(this.currentSpecies.id);

      if (!wasDiscovered) {
        // Solo reproducir audio si la especie NO ha sido descubierta
        const audioPath = `/game-assets/recorrido/criaturas/${this.currentSpecies.id}/${this.currentSpecies.id}_sonido.mp3`;
        this.speciesAudio = new Audio(audioPath);
        this.speciesAudio.loop = true;
        this.speciesAudio.crossOrigin = 'anonymous';

        // 👇 Manejar error de carga del audio (404, formato inválido, etc) - SILENCIOSO
        this.speciesAudio.addEventListener('error', (e) => {
          // Limpiar nodos Web Audio si fueron creados
          if (this.audioSource) {
            try { this.audioSource.disconnect(); } catch { }
            this.audioSource = null;
          }
          if (this.stereoPanner) {
            try { this.stereoPanner.disconnect(); } catch { }
            this.stereoPanner = null;
          }
          if (this.gainNode) {
            try { this.gainNode.disconnect(); } catch { }
            this.gainNode = null;
          }
          this.speciesAudio = null;
          // No mostrar error - es normal que algunas especies no tengan audio espacial
        }, { once: true });

        // Create Web Audio API context and nodes for stereo panning
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // 👇 Solo crear nodos si el audio se carga exitosamente
        this.speciesAudio.addEventListener('canplaythrough', () => {
          if (!this.speciesAudio) return; // Ya fue limpiado por error

          try {
            // Create audio nodes
            this.audioSource = this.audioContext.createMediaElementSource(this.speciesAudio);
            this.stereoPanner = this.audioContext.createStereoPanner();
            this.gainNode = this.audioContext.createGain();

            // Connect: source -> panner -> gain -> destination
            this.audioSource.connect(this.stereoPanner);
            this.stereoPanner.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Start with volume at 0 (will be updated when in view)
            this.gainNode.gain.value = 0;
            this.stereoPanner.pan.value = 0;

            console.log(`🔊 Audio espacial cargado para ${this.currentSpecies.commonName}: ${audioPath}`);

            // Try to play the audio
            this.speciesAudio.play().catch((err) => {
              // Silencioso - es normal que el autoplay esté bloqueado
            });
          } catch (err) {
            console.warn(`Error configurando Web Audio API (se ignorará):`, err.message);
            this.speciesAudio = null;
          }
        }, { once: true });
      } else {
        console.log(`🔇 Audio espacial omitido (especie ya descubierta): ${this.currentSpecies.commonName}`);
      }
    }

    // 📺 Precargar video de data de la especie para evitar lag al hacer click
    if (this.currentSpecies?.assets?.dataVideo) {
      // Limpiar video anterior si existe
      if (this.preloadedDataVideo) {
        try {
          this.preloadedDataVideo.pause();
          this.preloadedDataVideo.src = '';
        } catch (e) {
          console.warn('Error limpiando video precargado:', e);
        }
        this.preloadedDataVideo = null;
      }

      // Crear nuevo video y precargarlo (modo silencioso - no bloquear si falla)
      try {
        this.preloadedDataVideo = document.createElement('video');
        this.preloadedDataVideo.src = this.currentSpecies.assets.dataVideo;
        this.preloadedDataVideo.muted = true; // Muted para permitir precarga sin interacción del usuario
        this.preloadedDataVideo.preload = 'metadata'; // Cambiar a 'metadata' en lugar de 'auto' para cargar menos datos
        this.preloadedDataVideo.playsInline = true;

        console.log('📺 Precargando video de data:', this.currentSpecies.assets.dataVideo);

        // Esperar a que se carguen los metadatos
        this.preloadedDataVideo.addEventListener('loadedmetadata', () => {
          // 👇 Verificar que el video sigue siendo válido antes de acceder a duration
          if (this.preloadedDataVideo && this.preloadedDataVideo.duration) {
            console.log('✅ Video de data precargado exitosamente (duración:', this.preloadedDataVideo.duration, 's)');
          }
        }, { once: true });

        // Manejar errores de carga - NO BLOQUEAR la funcionalidad
        this.preloadedDataVideo.addEventListener('error', (e) => {
          console.warn('⚠️ No se pudo precargar video de data (se cargará bajo demanda):', this.currentSpecies.assets.dataVideo);
          // 👇 Limpiar referencias pero NO lanzar error
          if (this.preloadedDataVideo) {
            this.preloadedDataVideo.src = '';
            this.preloadedDataVideo = null;
          }
        }, { once: true });
      } catch (e) {
        console.warn('⚠️ Error creando elemento de precarga de video (se ignorará):', e);
        this.preloadedDataVideo = null;
      }
    }

    // �🔍 LOG: Resumen de carga completada
    console.log('───────────────────────────────────────────────────');
    console.log('✅ CARGA DE ESCENA COMPLETADA');
    console.log('───────────────────────────────────────────────────');
    console.log('Estado de objetos importantes:');
    console.log('  - glitchObject:', this.glitchObject ? `✅ ${this.glitchObject.name}` : '❌ No encontrado');
    console.log('  - rastroObject:', this.rastroObject ? `✅ ${this.rastroObject.name}` : '❌ No encontrado');
    console.log('  - flechaObjects:', this.flechaObjects?.length > 0 ? `✅ ${this.flechaObjects.length} flechas (${this.flechaObjects.map(f => f.name).join(', ')})` : '❌ No encontradas');
    console.log('  - carpaObject:', this.carpaObject ? `✅ ${this.carpaObject.name}` : '❌ No encontrado');
    console.log('  - butterfly:', this.butterfly ? '✅ Spawneada' : '❌ No spawneada');
    console.log('  - sunObject:', this.sunObject ? `✅ ${this.sunObject.name}` : '❌ No encontrado');
    console.log('  - lensflare:', this.lensflare ? '✅ Creado' : '❌ No creado');
    console.log('  - preloadedDataVideo:', this.preloadedDataVideo ? '✅ Precargado' : '❌ No precargado');
    console.log('═══════════════════════════════════════════════════');
  }

  onMouseMove(e) {
    // 👇 Permitir mouse move siempre para la cámara
    const rect = this.app.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    // 👇 Detectar si el mouse está sobre el glitch para cambiar color del cursor
    if (this.glitchObject && this.cursorRadar && this.cursorRadar.cursorEl) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hits = this.raycaster.intersectObject(this.glitchObject, true);

      if (hits.length > 0) {
        // Mouse sobre el glitch - cursor verde
        this.cursorRadar.cursorEl.style.filter = 'sepia(1) saturate(5) hue-rotate(70deg) brightness(1.2)';
      } else {
        // Mouse fuera del glitch - cursor normal
        this.cursorRadar.cursorEl.style.filter = 'none';
      }
    }
  }

  onKeyDown(e) {
    // 👇 Bloquear SPACE si el data overlay está visible
    const videoOverlay = document.getElementById('videoOverlay');
    const isOverlayVisible = videoOverlay && videoOverlay.style.display === 'block';

    // 🔄 REMOVED: Space bar zoom functionality - now using scroll wheel
    // if (e.code === 'Space' && !this.zoom.isZooming && !isOverlayVisible) {
    //   e.preventDefault();
    //   this.zoom.isZooming = true;
    // }

    // 🎮 DEBUG: Atajos de teclado para cambiar de ambiente/ronda
    // Teclas 1-6: Cambiar ambiente dentro de la ronda actual
    if (e.code >= 'Digit1' && e.code <= 'Digit6') {
      e.preventDefault();
      const newStage = parseInt(e.code.replace('Digit', ''));
      const round = this.speciesManager.currentRound;
      if (this.speciesManager.setRoundAndStage(round, newStage)) {
        const sceneIndex = (newStage - 1) % 6; // Scenes 0-5 for stages 1-6
        console.log(`🎬 Atajo teclado: Cambiando a Ronda ${round}, Ambiente ${newStage}`);
        this.loadStage(sceneIndex);
      }
    }

    // Teclas Q, W, E, R, T: Cambiar ronda (mantiene el ambiente actual)
    const roundKeys = { 'KeyQ': 1, 'KeyW': 2, 'KeyE': 3, 'KeyR': 4, 'KeyT': 5 };
    if (roundKeys[e.code]) {
      e.preventDefault();
      const newRound = roundKeys[e.code];
      const stage = this.speciesManager.currentStage;
      if (this.speciesManager.setRoundAndStage(newRound, stage)) {
        const sceneIndex = (stage - 1) % 6; // Scenes 0-5 for stages 1-6
        console.log(`🎬 Atajo teclado: Cambiando a Ronda ${newRound}, Ambiente ${stage}`);
        this.loadStage(sceneIndex);
      }
    }

    // Tecla I: Mostrar info de ronda/ambiente actual
    if (e.code === 'KeyI') {
      e.preventDefault();
      window.verRonda();
    }

    // 🎨 Tecla L: Toggle Gamer LUT
    if (e.code === 'KeyL') {
      e.preventDefault();
      this.useGamerLUT = !this.useGamerLUT;
      console.log(`🎨 Gamer LUT: ${this.useGamerLUT ? 'ON ✅' : 'OFF ❌'}`);
    }
  }

  onKeyUp(e) {
    // 👇 Bloquear SPACE si el data overlay está visible
    const videoOverlay = document.getElementById('videoOverlay');
    const isOverlayVisible = videoOverlay && videoOverlay.style.display === 'block';

    // 🔄 REMOVED: Space bar zoom functionality - now using scroll wheel
    // if (e.code === 'Space' && this.zoom.isZooming && !isOverlayVisible) {
    //   e.preventDefault();
    //   this.zoom.isZooming = false;
    // }
  }

  onWheel(e) {
    // 🔍 Scroll wheel zoom functionality
    const videoOverlay = document.getElementById('videoOverlay');
    const isOverlayVisible = videoOverlay && videoOverlay.style.display === 'block';

    // Don't zoom if video overlay is visible
    if (isOverlayVisible) return;

    e.preventDefault();

    // Get wheel delta (normalized) - make it even slower
    const delta = e.deltaY > 0 ? 1 : -1;

    // Apply very small zoom change with dampening for smooth, slow zooming
    const zoomChange = delta * this.zoom.zoomSpeed * 0.8; // Extra dampening multiplier
    const targetFOV = (this.zoom.targetFOV || this.zoom.currentFOV) + zoomChange;

    // Clamp to min/max FOV values
    this.zoom.targetFOV = THREE.MathUtils.clamp(targetFOV, this.zoom.minFOV, this.zoom.maxFOV);
  }

  onClick(e) {
    // 👇 Bloquear todos los clicks durante la transición
    if (this.flechaClicked) {
      return;
    }

    // 👇 Bloquear clicks en especies durante 3s después de descubrir
    if (this.speciesClickDisabled) {
      return;
    }

    // 👇 Start cursor click animation
    if (this.cursorRadar) {
      this.cursorRadar.startCursorClick(e.clientX, e.clientY);
    }

    // 👇 Prevent clicks when video overlay is visible
    const videoOverlay = document.getElementById('videoOverlay');
    if (videoOverlay && videoOverlay.style.display === 'block') {
      return; // Don't process clicks on the 3D scene while overlay is open
    }

    // Calculate mouse position with 200px x 200px hitbox
    const rect = this.app.canvas.getBoundingClientRect();
    const hitboxSize = 200; // 200px x 200px hitbox
    const halfSize = hitboxSize / 2;

    // Test multiple points in the hitbox area (grid pattern)
    const testPoints = [];
    const gridSize = 5; // 5x5 grid = 25 test points
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const offsetX = (i / (gridSize - 1) - 0.5) * hitboxSize;
        const offsetY = (j / (gridSize - 1) - 0.5) * hitboxSize;
        const testX = e.clientX + offsetX;
        const testY = e.clientY + offsetY;

        const ndc = new THREE.Vector2();
        ndc.x = ((testX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -(((testY - rect.top) / rect.height) * 2 - 1);
        testPoints.push(ndc);
      }
    }

    // Use center point as the primary raycaster position
    const ndc = new THREE.Vector2();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(ndc, this.camera);

    // Check flecha click first (test all points in hitbox) - TODAS las flechas
    if (this.flechaObjects && this.flechaObjects.length > 0 && !this.flechaClicked) {
      for (const flechaObj of this.flechaObjects) {
        if (flechaObj.visible) {
          for (const testNDC of testPoints) {
            this.raycaster.setFromCamera(testNDC, this.camera);
            const flechaHits = this.raycaster.intersectObject(flechaObj, true);
            if (flechaHits.length > 0) {
              this.onFlechaClick();
              return;
            }
          }
        }
      }
    }

    // Check ALL rastro objects (especies ya descubiertas) - SOLO punto exacto de clic
    // 👇 BLOQUEAR clicks en rastros hasta que se descubra el glitch de la escena actual
    const currentSpeciesDiscovered = this.currentSpecies?.id ?
      this.speciesManager.isSpeciesFound(this.currentSpecies.id) : true;

    if (this.stageModel && currentSpeciesDiscovered) {
      let bestRastroHit = null;
      let bestRastroMesh = null;
      let clickedSpeciesData = null;

      // 👇 Recolectar TODOS los meshes rastro visibles una sola vez
      const rastroMeshes = [];
      this.stageModel.traverse(child => {
        if (child.isMesh && child.visible && child.name.includes('_rastro')) {
          const speciesId = child.name.replace('_rastro', '');
          const wasDiscovered = this.speciesManager.isSpeciesFound(speciesId);
          if (wasDiscovered) {
            rastroMeshes.push(child);
          }
        }
      });

      // 👇 Buscar hits SOLO en el punto exacto de clic (sin hitbox)
      this.raycaster.setFromCamera(ndc, this.camera);

      for (const rastroMesh of rastroMeshes) {
        const hits = this.raycaster.intersectObject(rastroMesh, true);

        if (hits.length > 0) {
          const hit = hits[0];

          // Guardar el hit más cercano
          if (!bestRastroHit || hit.distance < bestRastroHit.distance) {
            bestRastroHit = hit;
            bestRastroMesh = rastroMesh;
          }
        }
      }

      // 👇 Solo analizar el pixel del MEJOR hit (el más cercano)
      if (bestRastroHit && bestRastroMesh) {
        const isTransparent = this.isRastroPixelTransparent(bestRastroHit, bestRastroMesh);

        if (!isTransparent) {
          // Extraer ID de especie y buscar datos
          const speciesId = bestRastroMesh.name.replace('_rastro', '');
          clickedSpeciesData = this.speciesManager.speciesData?.species?.find(s => s.id === speciesId);
        }
      }

      if (clickedSpeciesData) {
        console.log('═══════════════════════════════════════════════════');
        console.log('👁️ CLICK EN ESPECIE YA DESCUBIERTA!');
        console.log('═══════════════════════════════════════════════════');
        console.log('🐾 Especie:', clickedSpeciesData.commonName);
        console.log('🔬 Nombre científico:', clickedSpeciesData.scientificName);
        console.log('🆔 ID:', clickedSpeciesData.id);
        console.log('═══════════════════════════════════════════════════');

        // 👇 Desactivar clicks en especies por 3 segundos
        this.speciesClickDisabled = true;
        setTimeout(() => {
          this.speciesClickDisabled = false;
        }, 3000);

        // Play radar animation at click position
        if (this.cursorRadar) {
          this.cursorRadar.playRadarAt(e.clientX, e.clientY);
        }

        // Trigger alpha flash on the rastro mesh
        this.triggerRastroAlphaFlash(clickedSpeciesData.id);

        // Guardar temporalmente la especie clickeada para mostrar su popup
        const previousSpecies = this.currentSpecies;
        this.currentSpecies = clickedSpeciesData;

        // Mostrar el popup de datos
        this.playDataOverlayVideo();

        // Restaurar la especie actual después de un frame
        setTimeout(() => {
          this.currentSpecies = previousSpecies;
        }, 100);

        return;
      }
    } else if (this.stageModel && !currentSpeciesDiscovered) {
      console.log('🔒 Clicks en rastros bloqueados hasta descubrir la especie actual:', this.currentSpecies?.commonName);
    }

    // Then check glitch object (test all points in hitbox)
    if (!this.glitchObject) {
      console.log('🔍 DEBUG CLICK: No hay glitchObject');
      return;
    }

    let bestHit = null;

    // Test all points in the hitbox area
    for (const testNDC of testPoints) {
      this.raycaster.setFromCamera(testNDC, this.camera);
      const hits = this.raycaster.intersectObject(this.glitchObject, true);

      if (hits.length > 0) {
        const hit = hits[0];

        // Keep the closest hit
        if (!bestHit || hit.distance < bestHit.distance) {
          bestHit = hit;
        }
      }
    }

    console.log('🔍 DEBUG CLICK:', {
      tieneGlitchObject: !!this.glitchObject,
      glitchVisible: this.glitchObject?.visible,
      hitboxTestPoints: testPoints.length,
      encontradoHit: !!bestHit,
      especieActual: this.currentSpecies?.commonName || 'ninguna'
    });

    if (bestHit) {
      // 👇 Desbloquear cámara para permitir movimiento libre
      this.cameraLocked = false;

      // 👇 Desactivar clicks en especies por 3 segundos
      this.speciesClickDisabled = true;
      setTimeout(() => {
        this.speciesClickDisabled = false;
      }, 3000);

      // Play radar animation at click position (lightweight)
      if (this.cursorRadar) {
        this.cursorRadar.playRadarAt(e.clientX, e.clientY);
      }

      // 👇 LOG simplificado (menos líneas = menos carga)
      if (this.currentSpecies) {
        console.log('🎉 Especie descubierta:', this.currentSpecies.commonName, '|', this.speciesManager.getProgress());
      }

      // 👇 OPTIMIZACIÓN: Ejecutar efectos visuales de forma escalonada para evitar lag
      // Primero: efectos rápidos y ligeros
      this.triggerGlitchFlash(); // Solo DOM + CSS (0.5s)

      // Segundo: marcar especie (no visual, sin lag)
      if (this.currentSpecies) {
        this.speciesManager.markSpeciesFound(this.currentSpecies.id);
        // Update panel usando requestAnimationFrame para no bloquear
        requestAnimationFrame(() => {
          if (this.inventoryImg) {
            this.inventoryImg.src = this.speciesManager.getPanelPath();
          }
        });
      }

      // Tercero: efectos pesados con delay mínimo para permitir que el primer frame se renderice
      requestAnimationFrame(() => {
        this.triggerGlobalGlitch(1500); // DOM + CSS

        // Cuarto: video overlay (lo más pesado) con un frame extra de delay
        requestAnimationFrame(() => {
          this.playDataOverlayVideo();

          // Quinto: white flash (shader intensivo) después del video para no competir
          setTimeout(() => {
            this.startGlitchWhiteFlash();
          }, 50);
        });
      });
    }
  }

  /**
   * Check if a pixel at the intersection point is transparent
   * @param {THREE.Intersection} intersection - The raycaster intersection
   * @returns {boolean} - True if transparent (alpha < threshold), false otherwise
   */
  isPixelTransparent(intersection) {
    if (!intersection.uv || !this.glitchObject || !this.glitchObject.material) {
      return false;
    }

    const material = this.glitchObject.material;
    const alphaMap = material.alphaMap || material.map;

    if (!alphaMap || !alphaMap.image) {
      return false;
    }

    // Get UV coordinates at the intersection point
    const uv = intersection.uv;

    // Create a canvas to read pixel data from the texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const image = alphaMap.image;

    // For video textures
    if (image instanceof HTMLVideoElement) {
      if (image.readyState < 2) {
        // Video not ready, ignore click (treat as transparent)
        return true;
      }
      canvas.width = image.videoWidth;
      canvas.height = image.videoHeight;
    } else {
      // For image textures
      canvas.width = image.width;
      canvas.height = image.height;
    }

    context.drawImage(image, 0, 0);

    // Calculate pixel position from UV coordinates
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height); // Flip Y coordinate

    // Get pixel data (RGBA)
    const pixelData = context.getImageData(x, y, 1, 1).data;
    const alpha = pixelData[3]; // Alpha channel

    // Consider pixels with alpha < 128 as transparent
    const alphaThreshold = 128;
    const isTransparent = alpha < alphaThreshold;

    return isTransparent;
  }

  /**
   * Check if a pixel at the intersection point on a rastro mesh is transparent
   * @param {THREE.Intersection} intersection - The raycaster intersection
   * @param {THREE.Mesh} rastroMesh - The rastro mesh object
   * @returns {boolean} - True if transparent (alpha < threshold), false otherwise
   */
  isRastroPixelTransparent(intersection, rastroMesh) {
    if (!intersection.uv || !rastroMesh || !rastroMesh.material) {
      return false;
    }

    const material = rastroMesh.material;
    const alphaMap = material.alphaMap || material.map;

    if (!alphaMap || !alphaMap.image) {
      return false;
    }

    // Get UV coordinates at the intersection point
    const uv = intersection.uv;

    // Create a canvas to read pixel data from the texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const image = alphaMap.image;

    // For video textures
    if (image instanceof HTMLVideoElement) {
      if (image.readyState < 2) {
        // Video not ready, ignore click (treat as transparent)
        return true;
      }
      canvas.width = image.videoWidth;
      canvas.height = image.videoHeight;
    } else {
      // For image textures
      canvas.width = image.width;
      canvas.height = image.height;
    }

    context.drawImage(image, 0, 0);

    // Calculate pixel position from UV coordinates
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height); // Flip Y coordinate

    // Get pixel data (RGBA)
    const pixelData = context.getImageData(x, y, 1, 1).data;
    const alpha = pixelData[3]; // Alpha channel

    // Consider pixels with alpha < 128 as transparent
    const alphaThreshold = 128;
    const isTransparent = alpha < alphaThreshold;

    return isTransparent;
  }

  /**
   * Check if a pixel at the click position on a video overlay is transparent
   * @param {HTMLVideoElement} videoElement - The video element
   * @param {MouseEvent} event - The click event
   * @returns {boolean} - True if transparent (alpha < threshold), false otherwise
   */
  isVideoPixelTransparent(videoElement, event) {
    if (!videoElement || videoElement.readyState < 2) {
      return false; // Video not ready, don't consider transparent
    }

    // Get click position relative to the video overlay
    const rect = videoElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Create canvas to read pixel data
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw current video frame
    context.drawImage(videoElement, 0, 0);

    // Calculate pixel position (scale from display size to video size)
    const scaleX = videoElement.videoWidth / rect.width;
    const scaleY = videoElement.videoHeight / rect.height;
    const pixelX = Math.floor(x * scaleX);
    const pixelY = Math.floor(y * scaleY);

    // Get pixel data (RGBA)
    const pixelData = context.getImageData(pixelX, pixelY, 1, 1).data;
    const alpha = pixelData[3]; // Alpha channel

    // Consider pixels with alpha < 128 as transparent
    const alphaThreshold = 128;
    return alpha < alphaThreshold;
  }

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // No llamar a setSize aquí - lo maneja App.js
    this.onResizeOverlay();

    // 🎨 Actualizar tamaño del composer
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  smoothLookForward(onDone) {
    const st = this.stages[this.current]; const target = st.forward || { yaw: 0, pitch: 0 };
    const startLon = this.lon, startLat = this.lat; const start = performance.now(); const duration = 2000; this.isAutoLook = true;
    const anim = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      this.lon = THREE.MathUtils.lerp(startLon, target.yaw, t);
      this.lat = THREE.MathUtils.lerp(startLat, target.pitch, t);
      if (t < 1) requestAnimationFrame(anim); else { this.isAutoLook = false; onDone?.(); }
    }; anim();
  }

  playZocalo() {
    const st = this.stages[this.current];
    const zocaloVideo = document.getElementById('zocaloVideo');

    console.log('🎬 playZocalo() llamado:', {
      tieneZocaloVideo: !!zocaloVideo,
      tieneStZocalo: !!st?.zocalo,
      zocaloPath: st?.zocalo,
      currentStage: this.current
    });

    if (zocaloVideo && st.zocalo) {
      // Primero ocultar el zócalo
      zocaloVideo.style.opacity = '0';

      // Remove any previous event listeners to avoid duplicates
      zocaloVideo.onended = null;
      zocaloVideo.ontimeupdate = null;
      zocaloVideo.onloadedmetadata = null;

      zocaloVideo.src = st.zocalo;
      zocaloVideo.currentTime = 0;

      console.log('🎬 Zócalo configurado:', {
        src: zocaloVideo.src,
        display: zocaloVideo.style.display,
        opacity: zocaloVideo.style.opacity,
        top: zocaloVideo.style.top
      });

      // 👇 Configurar playbackRate DESPUÉS de que se carguen los metadatos
      zocaloVideo.onloadedmetadata = function () {
        this.playbackRate = 1.4; // 👈 Velocidad de reproducción 1.7x
        console.log('🎬 Zócalo metadata cargada - playbackRate:', this.playbackRate);
      };

      zocaloVideo.load();

      // Play video
      zocaloVideo.play()
        .then(() => console.log('✅ Zócalo video playing'))
        .catch(e => console.warn('❌ Zócalo video autoplay prevented:', e));

      // Mostrar el zócalo con fade in después de un breve delay
      setTimeout(() => {
        zocaloVideo.style.transition = 'opacity 0.5s ease-in';
        zocaloVideo.style.opacity = '1';
        console.log('🎬 Zócalo fade-in aplicado');
      }, 100);

      // Pause at second 3 before reaching the end (ajustado por velocidad 1.7x)
      zocaloVideo.ontimeupdate = function () {
        if (this.currentTime >= 3 && !this.paused) {
          this.currentTime = 3;
          this.pause();
          console.log('⏸️ Zócalo pausado en segundo 3');
        }
      };
    } else {
      console.warn('⚠️ No se puede reproducir zócalo:', {
        elementoExiste: !!zocaloVideo,
        rutaZocalo: st?.zocalo
      });
    }
  }

  playTransition(onEnded) {
    // 👉 detener HUD overlay
    this.stopHUDVideo();
    const st = this.stages[this.current];
    if (!st || !st.transition) { onEnded?.(); return; }

    // Usamos la UI para overlay full-screen y sin controles
    import('../core/UI.js').then(({ UI }) => {
      UI.showVideo({
        src: st.transition,
        controls: false,   // sin botones
        muted: false,      // poné true si querés forzar sin sonido
        onended: () => { onEnded?.(); }
      });
    });

    // Recompensa (inventario) al iniciar la transición
    if (st.reward) { State.addItem(st.reward); }
  }

  playRoundCompletionVideo() {
    return new Promise((resolve) => {
      console.log('[RecorridoScene] Round completed, transitioning to Main Menu...');

      // 👇 NO mostrar video de la carpa, ir directo al menú principal
      location.hash = '#menu';

      resolve();
    });
  }

  nextStage(options = {}) {
    // 👇 Advance stage in SpeciesManager
    const hasMoreStages = this.speciesManager.advanceStage();

    if (!hasMoreStages) {
      // Completed round, advance to next round
      console.log('[RecorridoScene] ⭐ RONDA COMPLETADA! Avanzando a siguiente ronda...');
      const progressBefore = this.speciesManager.getProgress();
      console.log('[RecorridoScene] Progreso antes de avanzar:', progressBefore);

      const hasMoreRounds = this.speciesManager.advanceRound();

      const progressAfter = this.speciesManager.getProgress();
      console.log('[RecorridoScene] Progreso después de avanzar:', progressAfter);

      if (!hasMoreRounds) {
        console.log('[RecorridoScene] All rounds completed!');
        // TODO: Handle game completion
      }

      // 🎬 Play carpa_flota video when completing a round
      console.log('[RecorridoScene] Round completed! Playing carpa_flota video...');
      // El video se encargará de navegar al laboratorio
      // La próxima vez que se vuelva al recorrido, ya estará en el round 2
      return this.playRoundCompletionVideo();
    }

    // Cycle through stages array
    const next = (this.current + 1) % this.stages.length;
    console.log('[RecorridoScene] Progress:', this.speciesManager.getProgress());

    return this.loadStage(next, options);
  }

  update(dt) {
    // 👇 Update cursor and radar animations
    if (this.cursorRadar) {
      this.cursorRadar.update();
    }

    if (!this.isAutoLook) {
      const { deadzone, maxSpeed, damping } = this.config;
      const ax = this.axis(this.mouseNDC.x, deadzone);
      const ay = this.axis(this.mouseNDC.y, deadzone);
      const vx = ax * maxSpeed.yaw;
      const vy = this.cameraLocked ? 0 : ay * maxSpeed.pitch; // 👈 Bloquea movimiento vertical si cameraLocked
      this.velLon += (vx - this.velLon) * damping;
      this.velLat += (vy - this.velLat) * damping;
      this.lon += this.velLon * dt;
      this.lat += this.velLat * dt;
      this.lat = Math.max(-85, Math.min(85, this.lat));

      // 👇 Mantener lat en 0 si la cámara está bloqueada
      if (this.cameraLocked) {
        this.lat = 0;
      }
    } else {
      // relajar
      this.velLon += (0 - this.velLon) * this.config.damping;
      this.velLat += (0 - this.velLat) * this.config.damping;
    }

    const phi = THREE.MathUtils.degToRad(90 - this.lat);
    const theta = THREE.MathUtils.degToRad(this.lon);
    this.camera.lookAt(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    // 👇 Actualiza el tiempo para shaders registrados sin recorrer todo el modelo
    if (this.shaderMaterials?.size) {
      const time = performance.now() * 0.001;
      for (const mat of this.shaderMaterials) {
        const shader = mat?.userData?.shader;
        if (shader?.uniforms?.uTime) {
          shader.uniforms.uTime.value = time;
        }
      }
    }

    if (this.noiseOverlay && this.noiseOverlay.material.uniforms) {
      this.noiseOverlay.material.uniforms.uTime.value = performance.now() * 0.001;
    }

    // Update animation mixers - TODAS las flechas
    if (this.flechaAnimationMixers && this.flechaAnimationMixers.length > 0) {
      this.flechaAnimationMixers.forEach(mixer => {
        if (mixer && typeof mixer.update === 'function') {
          mixer.update(dt);
        }
      });
    }

    // 🐟 Update carpa animation mixer
    if (this.carpaAnimationMixer) {
      this.carpaAnimationMixer.update(dt);
    }

    if (this.stageAnimationMixer) {
      this.stageAnimationMixer.update(dt);
    }

    if (this.butterflyMixer) {
      this.butterflyMixer.update(dt);
    }

    this.updateButterflyOrbit(dt);

    // Update zoom
    this.updateZoom(dt);

    // Update lens flare light to follow the Sun object
    if (this.sunLight && this.sunObject) {
      this.sunLight.position.copy(this.sunObject.getWorldPosition(new THREE.Vector3()));
      if (!this._flareDebug.frameLogged) {
        const lightPos = this.sunLight.position.toArray();
        const camPos = this.camera.position.toArray();
        console.debug('[RecorridoScene] Lens flare update tick', {
          lightPos,
          camPos,
          distance: this.sunLight.position.distanceTo(this.camera.position)
        });
        this._flareDebug.frameLogged = true;
      }
    }

    // Update map rotation to match camera yaw
    this.updateMapRotation();

    // 🔊 Update spatial audio volume based on distance to glitch object
    this.updateSpatialAudio();

    this.updateInventoryCanvas();

    // 🐟 Update carpa3d hover and rotation
    this.updateCarpa3DHover(dt);

    // 🎨 Update post-processing
    if (this.gamerLUTPass) {
      // Enable/disable GamerLUTPass based on useGamerLUT flag
      this.gamerLUTPass.enabled = this.useGamerLUT;
      this.gamerLUTPass.update(dt);
    }

    this.updateGlitchFlash();

    // 🎯 Update camera debug overlay
    this.updateCameraDebugOverlay();
  }

  updateCameraDebugOverlay() {
    if (!this.cameraDebugOverlay) return;

    // Get camera direction vector
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    // Calculate pitch (elevation angle)
    const pitch = Math.asin(direction.y) * (180 / Math.PI);

    // Calculate yaw (azimuth angle)
    const yaw = Math.atan2(direction.x, direction.z) * (180 / Math.PI);

    // Update overlay content
    this.cameraDebugOverlay.innerHTML = `
      <div><strong>CAMERA DEBUG</strong></div>
      <div>Pitch: ${pitch.toFixed(2)}°</div>
      <div>Yaw: ${yaw.toFixed(2)}°</div>
      <div>Lat: ${this.lat.toFixed(2)}°</div>
      <div>Lon: ${this.lon.toFixed(2)}°</div>
      <div>FOV: ${this.camera.fov.toFixed(2)}°</div>
    `;
  }

  render(renderer, dt) {
    if (!this.isLUTReady) {
      const prevColor = renderer.getClearColor(this._tempClearColor);
      const prevAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.setClearColor(prevColor.getHex(), prevAlpha);
      return;
    }

    // Siempre usar composer si está disponible (incluye DiscoveryFilterPass)
    if (this.composer) {
      this.composer.render();
    } else {
      // Render normal (fallback solo si no hay composer)
      console.warn('[RecorridoScene] Composer not available, using direct render');
      renderer.render(this.scene, this.camera);
    }

    // Overlay scene (HUD, etc) - siempre renderiza después
    if (this.overlayScene && this.overlayCam) {
      renderer.clearDepth();
      renderer.render(this.overlayScene, this.overlayCam);
    }
  }

  updateZoom(dt) {
    // Initialize targetFOV if not set
    if (this.zoom.targetFOV === undefined) {
      this.zoom.targetFOV = this.zoom.baseFOV;
    }

    // Smoothly interpolate towards target FOV with dampening
    const lerpFactor = dt * this.zoom.lerpSpeed * this.zoom.dampening;
    this.zoom.currentFOV = THREE.MathUtils.lerp(this.zoom.currentFOV, this.zoom.targetFOV, lerpFactor);

    // Update camera FOV if there's a significant change
    if (Math.abs(this.zoom.currentFOV - this.camera.fov) > 0.01) {
      this.camera.fov = this.zoom.currentFOV;
      this.camera.updateProjectionMatrix();
    }
  }

  updateMapRotation() {
    const mapImg = document.querySelector('.map-overlay__map');
    if (mapImg) {
      // Use negative lon to rotate map opposite to camera view direction
      mapImg.style.transform = `rotate(${-this.lon}deg)`;
    }
  }

  updateSpatialAudio() {
    // Only update if we have species audio and glitch object
    if (!this.gainNode || !this.stereoPanner || !this.glitchObject) return;

    // Get glitch object world position
    const glitchPos = this.glitchObject.getWorldPosition(new THREE.Vector3());

    // Get camera look direction and position
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const cameraPos = this.camera.position;

    // Calculate vector from camera to glitch
    const toGlitch = new THREE.Vector3().subVectors(glitchPos, cameraPos).normalize();

    // Calculate angle between camera direction and glitch direction
    const angleToGlitch = Math.acos(cameraDirection.dot(toGlitch)) * (180 / Math.PI);

    // Check if glitch is within field of view
    const { fovAngle, maxDistance, minVolume, maxVolume } = this.spatialAudioConfig;
    const isInView = angleToGlitch <= fovAngle;

    if (!isInView) {
      // Fade out audio when not in view
      this.gainNode.gain.value = 0;
      return;
    }

    // Calculate distance from camera focal point
    const focalPoint = cameraPos.clone().add(cameraDirection.multiplyScalar(500));
    const distance = glitchPos.distanceTo(focalPoint);

    // Calculate volume based on distance (inverse relationship)
    const normalizedDistance = Math.min(distance / maxDistance, 1.0);
    const volume = THREE.MathUtils.lerp(maxVolume, minVolume, normalizedDistance);

    // Apply volume
    this.gainNode.gain.value = volume;

    // Calculate stereo panning based on horizontal angle
    // Use camera's right vector to determine left/right position
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, this.camera.up).normalize();

    // Project glitch position onto camera's horizontal plane
    const horizontalOffset = toGlitch.dot(cameraRight);

    // Pan value ranges from -1 (left) to 1 (right)
    // Normalize by FOV angle to make panning more pronounced within the view
    const panValue = THREE.MathUtils.clamp(horizontalOffset * 2, -1, 1);
    this.stereoPanner.pan.value = panValue;
  }

  // 🐟 Simple noise function for smooth random movement
  simpleNoise(x) {
    // Simple smooth noise using sine waves with different frequencies
    return Math.sin(x * 1.3) * 0.5 +
      Math.sin(x * 2.7) * 0.25 +
      Math.sin(x * 5.1) * 0.125;
  }

  updateCarpa3DHover(dt) {
    if (!this.carpa3dObject || !this.carpa3dHover.enabled) return;

    // Update hover animation (up and down movement)
    this.carpa3dHover.time += dt * this.carpa3dHover.frequency;
    const hoverOffset = Math.sin(this.carpa3dHover.time) * this.carpa3dHover.amplitude;
    this.carpa3dObject.position.y = this.carpa3dHover.baseY + hoverOffset;

    // Update rotation with smooth noise (very subtle)
    if (this.carpa3dRotation.enabled) {
      const time = performance.now() * 0.001 * this.carpa3dRotation.speed;

      // Generate smooth noise for each axis
      const noiseX = this.simpleNoise(time + this.carpa3dRotation.noiseOffsetX);
      const noiseY = this.simpleNoise(time + this.carpa3dRotation.noiseOffsetY);
      const noiseZ = this.simpleNoise(time + this.carpa3dRotation.noiseOffsetZ);

      // Apply subtle rotation
      this.carpa3dObject.rotation.x = noiseX * this.carpa3dRotation.amplitude;
      this.carpa3dObject.rotation.y = noiseY * this.carpa3dRotation.amplitude;
      this.carpa3dObject.rotation.z = noiseZ * this.carpa3dRotation.amplitude;
    }
  }

  axis(a, deadzone) {
    if (Math.abs(a) <= deadzone) return 0;
    const t = (Math.abs(a) - deadzone) / (1 - deadzone);
    const s = Math.min(Math.max(t, 0), 1); const smooth = s * s * (3 - 2 * s);
    return Math.sign(a) * smooth;
  }



  updateInventoryCanvas() {
    if (!this.inventoryCtx || !this.inventoryImg) return;
    const ctx = this.inventoryCtx;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (this.inventoryImg.complete && this.inventoryImg.naturalWidth > 0) {
      // 👇 Use naturalWidth/naturalHeight to get actual image dimensions
      const w = this.inventoryImg.naturalWidth;
      const h = this.inventoryImg.naturalHeight;

      // Scale to fit canvas while maintaining aspect ratio
      const canvasWidth = ctx.canvas.width;
      const canvasHeight = ctx.canvas.height;

      // Calculate scale to fit width (with some margin)
      const maxWidth = canvasWidth * 0.9; // Use 90% of canvas width
      const scale = Math.min(1, maxWidth / w); // Don't upscale, only downscale

      const scaledW = w * scale;
      const scaledH = h * scale;

      // centrado en X, alineado abajo en Y
      const x = (canvasWidth - scaledW) / 2;
      const y = canvasHeight - scaledH - 20; // 20px margin from bottom

      ctx.drawImage(this.inventoryImg, x, y, scaledW, scaledH);
    }
  }

  setupNoiseOverlay() {
    const w = this.app.renderer.domElement.width;
    const h = this.app.renderer.domElement.height;

    // Quad de pantalla completa
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0.0 },
        uOpacity: { value: 0.2 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;

        // hash simple
        float rand(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        void main(){
          float noise = rand(vUv * uTime * 200.0); // flickering rápido
          gl_FragColor = vec4(vec3(noise), noise * uOpacity);
        }
      `
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(w / 2, h / 2, 0); // centrar en cámara ortográfica
    this.overlayScene.add(mesh);

    this.noiseOverlay = mesh;
  }

  async createLensFlare() {
    if (!this.sunObject) return;

    const makeTexture = (radius, stops) => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };

    const mainTexture = makeTexture(256, [
      [0.0, 'rgba(255,255,255,0.85)'],
      [0.2, 'rgba(255,230,180,0.6)'],
      [0.6, 'rgba(255,160,60,0.25)'],
      [1.0, 'rgba(255,120,0,0)']
    ]);

    const streakTexture = makeTexture(256, [
      [0.0, 'rgba(255,255,255,0.6)'],
      [0.3, 'rgba(255,200,120,0.35)'],
      [1.0, 'rgba(255,120,0,0)']
    ]);

    this.lensflareTextures = [mainTexture, streakTexture];

    const sunWorld = this.sunObject.getWorldPosition(new THREE.Vector3());
    console.debug('[RecorridoScene] Creating lens flare at', sunWorld.toArray());

    this.sunLight = new THREE.PointLight(0xffffff, 1.6, 0);
    this.sunLight.castShadow = false;
    this.sunLight.position.copy(sunWorld);

    this.lensflare = new Lensflare();
    this.lensflare.addElement(new LensflareElement(mainTexture, 600, 0, new THREE.Color(0xffffff)));
    this.lensflare.addElement(new LensflareElement(streakTexture, 220, 0.35));
    this.lensflare.addElement(new LensflareElement(streakTexture, 120, 0.6));
    this.lensflare.addElement(new LensflareElement(streakTexture, 160, 1));

    this.sunLight.add(this.lensflare);
    this.scene.add(this.sunLight);

    this._flareDebug.created = true;
    this._flareDebug.frameLogged = false;
    console.debug('[RecorridoScene] Lens flare created', {
      intensity: this.sunLight.intensity,
      elementCount: Array.isArray(this.lensflare.lensFlares) ? this.lensflare.lensFlares.length : 'unknown'
    });
  }

  async spawnButterflyNearGlitch() {
    if (!this.stageModel || !this.glitchObject) return;

    try {
      const stageRef = this.stageModel;
      const glitchRef = this.glitchObject;
      const gltf = await this.gltfLoader.loadAsync('/game-assets/recorrido/butter_flying.glb');
      if (stageRef !== this.stageModel || glitchRef !== this.glitchObject || !this.stageModel) {
        return;
      }
      const butterfly = gltf.scene || new THREE.Group();
      butterfly.name = 'butter_flying';

      butterfly.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = false;
        }
      });

      butterfly.scale.setScalar(0.125);
      this.stageModel.add(butterfly);
      this.butterfly = butterfly;

      if (this.butterflyOrbit) {
        this.butterflyOrbit.angle = Math.random() * Math.PI * 2;
      }

      this.updateButterflyOrbit(0, true);

      if (gltf.animations?.length) {
        this.butterflyMixer = new THREE.AnimationMixer(butterfly);
        const clip = gltf.animations[0];
        this.butterflyAction = this.butterflyMixer.clipAction(clip);
        this.butterflyAction.setLoop(THREE.LoopRepeat);
        this.butterflyAction.clampWhenFinished = false;
        this.butterflyAction.play();
        this.butterflyAction.setEffectiveTimeScale(4);
      }

      console.debug('[RecorridoScene] Butterfly spawned', {
        position: butterfly.position.toArray(),
        hasAnimation: Boolean(this.butterflyAction)
      });
    } catch (error) {
      console.error('[RecorridoScene] Failed to load butterfly GLB', error);
    }
  }

  updateButterflyOrbit(dt = 0, snap = false) {
    if (!this.butterfly || !this.glitchObject || !this.stageModel || !this.butterflyOrbit) return;

    const orbit = this.butterflyOrbit;
    if (!snap) {
      orbit.angle = (orbit.angle + dt * orbit.speed) % (Math.PI * 2);
    } else {
      orbit.angle = orbit.angle % (Math.PI * 2);
    }

    if (orbit.wave) {
      orbit.wave.phase = (orbit.wave.phase + dt * orbit.wave.frequency) % (Math.PI * 2);
    }

    const stage = this.stageModel;
    stage.updateWorldMatrix(true, false);

    const centerWorld = this.glitchObject.getWorldPosition(_orbitCenter);

    const worldPos = _orbitPos.copy(centerWorld);
    worldPos.x += Math.cos(orbit.angle) * orbit.radius;
    worldPos.z += Math.sin(orbit.angle) * orbit.radius;
    let waveOffset = 0;
    if (orbit.wave) {
      waveOffset = Math.sin(orbit.wave.phase) * orbit.wave.amplitude;
    }

    worldPos.y += orbit.height + Math.sin(orbit.angle * 2) * orbit.verticalAmp + waveOffset;

    const localPos = _orbitHelper.copy(worldPos);
    stage.worldToLocal(localPos);
    this.butterfly.position.copy(localPos);

    const lookAhead = orbit.lookAhead ?? 0.25;
    const aheadAngle = orbit.angle + lookAhead;

    const aheadWorld = _orbitAhead.copy(centerWorld);
    aheadWorld.x += Math.cos(aheadAngle) * orbit.radius;
    aheadWorld.z += Math.sin(aheadAngle) * orbit.radius;
    const aheadWaveOffset = orbit.wave ? Math.sin(orbit.wave.phase + aheadAngle) * orbit.wave.amplitude : 0;
    aheadWorld.y += orbit.height + Math.sin(aheadAngle * 2) * orbit.verticalAmp + aheadWaveOffset;

    const lookTarget = _orbitLook.copy(aheadWorld);
    stage.worldToLocal(lookTarget);
    this.butterfly.lookAt(lookTarget);
  }

  // En lugar de un plano 3D, reproducimos el video como overlay DOM
  playDataOverlayVideo() {
    if (!this.currentSpecies) {
      console.error('[RecorridoScene] No current species to display');
      return;
    }

    // 👇 OPTIMIZACIÓN: Reutilizar audio en lugar de crear nuevo cada vez
    if (!this.metadataOverlayAudio) {
      this.metadataOverlayAudio = new Audio('/game-assets/recorrido/sonido/metadata_popup.mp3');
      this.metadataOverlayAudio.volume = 0.4;
    } else {
      this.metadataOverlayAudio.currentTime = 0;
    }
    this.metadataOverlayAudio.play().catch(e => console.error("Audio play failed:", e));

    import('../core/UI.js').then(({ UI }) => {
      const videoEl = document.getElementById('labVideo');
      const videoOverlay = document.getElementById('videoOverlay');

      // 👇 OPTIMIZACIÓN: Usar directamente el video precargado sin crear nuevo src
      if (this.preloadedDataVideo && this.preloadedDataVideo.readyState >= 2) {
        // Si el video precargado está listo, transferir su src (ya está en cache del browser)
        videoEl.src = this.preloadedDataVideo.src;
      } else if (this.preloadedDataVideo) {
        // Video existe pero no está listo, usar de todas formas
        videoEl.src = this.preloadedDataVideo.src;
      } else {
        // Fallback: cargar ahora (no debería pasar si la precarga funciona)
        videoEl.src = this.currentSpecies.assets.dataVideo;
      }

      videoEl.controls = false;
      videoEl.muted = false;
      videoEl.playsInline = true;
      videoEl.playbackRate = this.currentSpecies.dataVideoSpeed || 0.5;
      videoOverlay.style.display = 'block';

      // 🔄 Loop from second 3 when video ends
      videoEl.onended = () => {
        videoEl.currentTime = 3; // Jump to second 3
        videoEl.play().catch(e => console.error("Video loop failed:", e));
      };

      // 👇 Esperar a que el video esté completamente listo antes de reproducir
      const tryPlayVideo = () => {
        if (videoEl.readyState >= 3) { // HAVE_FUTURE_DATA or higher
          videoEl.play().catch(e => {
            console.error("Video autoplay failed:", e);
            // Si falla el autoplay, intentar de nuevo en un frame
            requestAnimationFrame(() => {
              videoEl.play().catch(err => {
                console.error("Video play retry failed:", err);
                // Como último recurso, mostrar controles para que el usuario pueda reproducir manualmente
                videoEl.controls = true;
              });
            });
          });
        } else {
          // Video no está listo, esperar un poco más
          setTimeout(tryPlayVideo, 100);
        }
      };

      // Intentar reproducir inmediatamente o esperar a que esté listo
      if (videoEl.readyState >= 3) {
        tryPlayVideo();
      } else {
        videoEl.addEventListener('canplay', tryPlayVideo, { once: true });
      }

      // 👆 Click handler para cerrar overlay al hacer click en área transparente
      const handleOverlayClick = (e) => {
        // Verificar si el click fue en un píxel transparente del video
        if (this.isVideoPixelTransparent(videoEl, e)) {
          // Reproducir sonido de cierre
          if (this.metadataOverlayAudio) {
            this.metadataOverlayAudio.pause();
            this.metadataOverlayAudio.currentTime = 0;
            this.metadataOverlayAudio = null;
          }

          if (!this.metadataCloseAudio) {
            this.metadataCloseAudio = new Audio('/game-assets/recorrido/sonido/metadata_cierre.mp3');
            this.metadataCloseAudio.volume = 0.5;
          } else {
            this.metadataCloseAudio.pause();
            this.metadataCloseAudio.currentTime = 0;
          }

          this.metadataCloseAudio.play().catch(e => console.error("Audio play failed:", e));

          // Cerrar el overlay
          this.removeTextOverlay();
          UI.hideVideo();

          // Mostrar TODAS las flechas y resetear el flag de click
          this.flechaClicked = false; // 👈 Resetear aquí cuando se muestran las flechas
          if (this.flechaObject) {
            this.flechaObject.visible = true;
          }
          if (this.flechaObjects && this.flechaObjects.length > 0) {
            this.flechaObjects.forEach((flechaObj, index) => {
              flechaObj.visible = true;
              const action = this.flechaAnimationActions[index];
              if (action) {
                action.reset();
                // 2-frame offset per arrow, reversed order (assuming 30fps)
                const reverseIndex = (this.flechaObjects.length - 1) - index;
                const frameOffset = reverseIndex * 2; // Last arrow = 0, first arrow = most offset
                const timeOffset = frameOffset / 30; // Convert to seconds
                action.time = timeOffset;
                action.play();
              }
            });
          }

          // Remover el listener
          videoOverlay.removeEventListener('click', handleOverlayClick);
        }
      };

      videoOverlay.addEventListener('click', handleOverlayClick);

      // Agregar el overlay de texto después de mostrar el video
      this.addTextOverlay();
    });
  }

  addTextOverlay() {
    ensureEfedraOverlayAssets();
    const parent = this.overlayRoot || document.body;

    const textOverlay = document.createElement('div');
    textOverlay.id = 'efedra-text-overlay';
    textOverlay.style.position = 'absolute';
    textOverlay.style.zIndex = '10000';
    textOverlay.style.overflowY = 'auto';
    textOverlay.style.overflowX = 'hidden';
    textOverlay.style.pointerEvents = 'auto';
    textOverlay.style.paddingTop = '0px';
    textOverlay.style.paddingLeft = '32px';
    textOverlay.style.paddingRight = '22px';
    textOverlay.style.paddingBottom = '0px';
    textOverlay.style.lineHeight = '1.4';
    textOverlay.style.textShadow = '0 0 18px rgba(0,0,0,0.45)';
    textOverlay.style.fontFamily = EFEDRA_OVERLAY_THEME.fonts.family;
    textOverlay.style.fontWeight = '400';
    textOverlay.style.fontVariantNumeric = 'tabular-nums lining-nums';
    textOverlay.style.letterSpacing = '0.015em';
    textOverlay.style.setProperty('scrollbar-width', 'thin');
    textOverlay.style.setProperty('-ms-overflow-style', 'auto');
    textOverlay.style.color = EFEDRA_OVERLAY_THEME.colors.speciesText;
    //textOverlay.style.background = 'linear-gradient(180deg, rgba(7,11,18,0.32), rgba(7,11,18,0.12))';
    textOverlay.style.borderRadius = '18px';

    const applyResponsiveMetrics = () => {
      textOverlay.style.left = '1168px';
      textOverlay.style.top = '167px';
      textOverlay.style.width = '340px';
      textOverlay.style.height = '320px';
      textOverlay.style.bottom = '120px';
      textOverlay.style.fontSize = `${EFEDRA_OVERLAY_THEME.fonts.speciesMaxPx}px`;
    };

    applyResponsiveMetrics();

    const textContent = document.createElement('div');
    textContent.style.minHeight = '100%';

    // 📝 Estilos para formateo HTML (párrafos y negritas)
    textContent.style.cssText = `
      min-height: 100%;
    `;

    // Agregar estilos globales para <p> y <strong> dentro del overlay
    const styleId = 'species-text-formatting';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #efedra-text-overlay p {
          margin: 0 0 0.8em 0;
          line-height: 1.5;
        }
        #efedra-text-overlay p:last-child {
          margin-bottom: 0;
        }
        #efedra-text-overlay strong {
          font-weight: 700;
          color: #D9DC77;
        }
      `;
      document.head.appendChild(style);
    }

    textOverlay.appendChild(textContent);
    parent.appendChild(textOverlay);

    // 👇 Use dynamic species text
    const fullText = this.currentSpecies?.text || "Texto no disponible";

    // Caracteres para el efecto glitch
    const glitchChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?~`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    // Función para obtener un caracter glitch aleatorio
    const getRandomGlitchChar = () => glitchChars[Math.floor(Math.random() * glitchChars.length)];

    // Función para extraer texto plano del HTML preservando estructura
    const getPlainTextLength = (html) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      return temp.textContent.length;
    };

    // Función para reconstruir HTML hasta cierto número de caracteres
    const getPartialHTML = (html, charCount) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      let count = 0;
      const walk = (node, maxChars) => {
        if (count >= maxChars) return '';

        if (node.nodeType === Node.TEXT_NODE) {
          const remaining = maxChars - count;
          const text = node.textContent.substring(0, remaining);
          count += text.length;
          return text;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          let result = `<${tagName}>`;

          for (let child of node.childNodes) {
            if (count >= maxChars) break;
            result += walk(child, maxChars);
          }

          result += `</${tagName}>`;
          return result;
        }
        return '';
      };

      let result = '';
      for (let child of temp.childNodes) {
        if (count >= charCount) break;
        result += walk(child, charCount);
      }
      return result;
    };

    // Esperar 3 segundos antes de comenzar el efecto
    setTimeout(() => {
      const totalChars = getPlainTextLength(fullText);
      let currentIndex = 0;

      const typewriterInterval = setInterval(() => {
        if (currentIndex <= totalChars) {
          // Obtener HTML parcial hasta el índice actual
          let displayText = getPartialHTML(fullText, currentIndex);

          // Agregar algunos caracteres glitch después del texto actual
          const glitchCount = Math.min(3, totalChars - currentIndex);
          for (let i = 0; i < glitchCount; i++) {
            displayText += `<span style="opacity: 0.6; animation: glitch-flicker 0.1s infinite;">${getRandomGlitchChar()}</span>`;
          }

          textContent.innerHTML = displayText;
          currentIndex++;
        } else {
          // Terminar el efecto
          textContent.innerHTML = fullText;
          clearInterval(typewriterInterval);
        }
      }, 5); // 25ms entre cada caracter (más rápido)
    }, 3000); // Esperar 3 segundos

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

    // Agregar listener para cualquier tecla para cerrar el overlay
    const handleKeyPress = () => {
      if (this.metadataOverlayAudio) {
        this.metadataOverlayAudio.pause();
        this.metadataOverlayAudio.currentTime = 0;
        this.metadataOverlayAudio = null;
      }

      if (!this.metadataCloseAudio) {
        this.metadataCloseAudio = new Audio('/game-assets/recorrido/sonido/metadata_cierre.mp3');
        this.metadataCloseAudio.volume = 0.5;
      } else {
        this.metadataCloseAudio.pause();
        this.metadataCloseAudio.currentTime = 0;
      }

      this.metadataCloseAudio.play().catch(e => console.error("Audio play failed:", e));

      this.removeTextOverlay();
      // También cerrar el video
      import('../core/UI.js').then(({ UI }) => {
        UI.hideVideo();
      });
      // Mostrar TODAS las flechas después de cerrar el overlay y resetear flag
      this.flechaClicked = false; // 👈 Resetear aquí cuando se muestran las flechas
      if (this.flechaObject) {
        this.flechaObject.visible = true;
      }
      if (this.flechaObjects && this.flechaObjects.length > 0) {
        this.flechaObjects.forEach((flechaObj, index) => {
          flechaObj.visible = true;

          // Start flecha animation if available
          const action = this.flechaAnimationActions[index];
          if (action) {
            action.reset();
            // 2-frame offset per arrow, reversed order (assuming 30fps)
            const reverseIndex = (this.flechaObjects.length - 1) - index;
            const frameOffset = reverseIndex * 2; // Last arrow = 0, first arrow = most offset
            const timeOffset = frameOffset / 30; // Convert to seconds
            action.time = timeOffset;
            action.play();
          } else if (this.gltfAnimations?.length) {
            console.info(`Flecha ${index} visible but no compatible animation clip was matched.`);
          }
        });
      }
      // Remover el listener
      document.removeEventListener('keydown', handleKeyPress);
    };

    document.addEventListener('keydown', handleKeyPress);

    // Guardar referencia al listener para limpieza
    textOverlay._keyPressHandler = handleKeyPress;

    // Manejar redimensionamiento de ventana
    const handleResize = () => applyResponsiveMetrics();

    window.addEventListener('resize', handleResize);
    textOverlay._handleResize = handleResize;
  }

  removeTextOverlay() {
    const textOverlay = document.getElementById('efedra-text-overlay');
    if (textOverlay) {
      if (this.metadataOverlayAudio) {
        this.metadataOverlayAudio.pause();
        this.metadataOverlayAudio.currentTime = 0;
        this.metadataOverlayAudio = null;
      }

      if (textOverlay._handleResize) {
        window.removeEventListener('resize', textOverlay._handleResize);
      }
      if (textOverlay._keyPressHandler) {
        document.removeEventListener('keydown', textOverlay._keyPressHandler);
      }
      textOverlay.remove();
    }
  }

  // Crea un overlay DOM con un flash "glitch" de hasta 0.5s usando la paleta dada
  triggerGlitchFlash() {
    try {
      // 👇 OPTIMIZACIÓN: Reutilizar elementos existentes en lugar de crear nuevos
      if (this._glitchFlashEl) {
        // Si ya existe, solo reiniciar animación
        this._glitchFlashEl.style.animation = 'none';
        // Force reflow para reiniciar animación
        void this._glitchFlashEl.offsetWidth;
        this._glitchFlashEl.style.animation = 'dg-glitch-flash-move 0.5s ease-out forwards';
        return;
      }

      // 👇 Crear style solo una vez y dejarlo en el DOM (es lightweight)
      if (!this._glitchFlashStyle) {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes dg-glitch-flash-move {
            0%   { opacity: 0; transform: translate3d(0,0,0) skewX(0deg); background-position: 0% 0%; }
            10%  { opacity: 1; transform: translate3d(-2px,1px,0) skewX(2deg); background-position: 100% 0%; }
            25%  { transform: translate3d(2px,-1px,0) skewX(-2deg); }
            45%  { background-position: 0% 100%; }
            70%  { transform: translate3d(-1px,0,0) skewX(1deg); }
            100% { opacity: 0; transform: translate3d(0,0,0) skewX(0deg); background-position: 100% 100%; }
          }
        `;
        document.head.appendChild(style);
        this._glitchFlashStyle = style;
      }

      const el = document.createElement('div');
      // 👇 Usar cssText para asignación en bloque (más rápido que propiedades individuales)
      el.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 10000;
        opacity: 0;
        background-image: repeating-linear-gradient(to bottom, #D9DC77 0%, #D9DC77 8%, #DBB28D 8%, #DBB28D 16%, #E4CF9D 16%, #E4CF9D 24%, #1F1F1F 24%, #1F1F1F 32%, #314B56 32%, #314B56 40%, #171930 40%, #171930 48%, #D9DC77 48%, #D9DC77 56%),
                          repeating-linear-gradient(to right, rgba(255,255,255,0.06) 0 2px, transparent 2px 4px);
        background-blend-mode: overlay, normal;
        background-size: 200% 200%, auto;
        animation: dg-glitch-flash-move 0.5s ease-out forwards;
        will-change: transform, opacity;
      `;

      document.body.appendChild(el);
      this._glitchFlashEl = el;

      // 👇 Limpiar después de animación pero mantener el style en DOM
      setTimeout(() => {
        try {
          if (this._glitchFlashEl === el) {
            el.remove();
            this._glitchFlashEl = null;
          }
        } catch { }
      }, 500);
    } catch { }
  }

  // Flash blanco en el rastro cuando se hace click
  triggerRastroAlphaFlash(speciesId) {
    if (!this.stageModel) return;

    // Buscar el mesh rastro de esta especie
    let rastroMesh = null;
    this.stageModel.traverse(child => {
      if (child.isMesh && child.name === `${speciesId}_rastro`) {
        rastroMesh = child;
      }
    });

    if (!rastroMesh || !rastroMesh.material) return;

    console.log('✨ Iniciando flash blanco total en rastro:', speciesId);

    // Guardar propiedades originales del material
    const originalMaterial = rastroMesh.material;
    const originalColor = originalMaterial.color.clone();
    const originalOpacity = originalMaterial.opacity !== undefined ? originalMaterial.opacity : 1.0;
    const originalTransparent = originalMaterial.transparent;

    // Flash instantáneo a blanco total
    originalMaterial.color.setHex(0xffffff);
    originalMaterial.opacity = 1.0;
    originalMaterial.transparent = true;
    originalMaterial.needsUpdate = true;

    // Restaurar después de 50ms
    setTimeout(() => {
      originalMaterial.color.copy(originalColor);
      originalMaterial.opacity = originalOpacity;
      originalMaterial.transparent = originalTransparent;
      originalMaterial.needsUpdate = true;
      console.log('✨ Flash blanco completado');
    }, 50);
  }

  // Glitch general sutil: cambios de color/brillo (1.5s por defecto)
  triggerGlobalGlitch(duration = 1500) {
    try {
      // 👇 OPTIMIZACIÓN: Reutilizar elementos y evitar recrear el DOM
      if (this._globalGlitchEl) {
        // Si ya existe un efecto activo, extender su duración en lugar de recrear
        return;
      }

      // 👇 Crear style solo una vez y reutilizarlo
      if (!this._globalGlitchStyle) {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes dg-global-glitch-filter {
            0%   { filter: none; }
            10%  { filter: brightness(1.08) contrast(1.06) saturate(1.04) hue-rotate(6deg); }
            25%  { filter: brightness(0.94) contrast(1.05) saturate(0.98) hue-rotate(-6deg); }
            40%  { filter: brightness(1.03) contrast(1.08) saturate(1.02) hue-rotate(3deg); }
            60%  { filter: brightness(0.96) contrast(1.04) saturate(0.97) hue-rotate(-3deg); }
            80%  { filter: brightness(1.05) contrast(1.06) saturate(1.00) hue-rotate(2deg); }
            100% { filter: none; }
          }
          .dg-global-glitch-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.09;
            mix-blend-mode: overlay;
            background-image: repeating-linear-gradient(to bottom, #D9DC77 0 3px, #DBB28D 3px 6px, #E4CF9D 6px 9px, #1F1F1F 9px 12px, #314B56 12px 15px, #171930 15px 18px),
                              repeating-linear-gradient(to right, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px);
            background-size: 200% 200%, auto;
            will-change: background-position;
          }
        `;
        document.head.appendChild(style);
        this._globalGlitchStyle = style;
      }

      // 👇 Crear overlay con clase en lugar de inline styles (más eficiente)
      const ov = document.createElement('div');
      ov.className = 'dg-global-glitch-overlay';

      // 👇 Usar Web Animations API directamente (más eficiente que CSS animations para efectos únicos)
      document.body.appendChild(ov);
      document.body.style.animation = `dg-global-glitch-filter ${duration}ms ease-in-out`;

      // Animación de fondo
      ov.animate(
        [{ backgroundPosition: '0% 0%, 0 0' }, { backgroundPosition: '100% 100%, 20px 0' }],
        { duration, easing: 'ease-in-out' }
      );

      this._globalGlitchEl = ov;

      setTimeout(() => {
        try {
          if (this._globalGlitchEl === ov) {
            ov.remove();
            this._globalGlitchEl = null;
          }
          document.body.style.animation = '';
        } catch { }
      }, duration);
    } catch { }
  }

  startGlitchWhiteFlash() {
    if (!this.glitchObject) {
      this.completeGlitchReveal();
      return Promise.resolve();
    }

    console.log('✨ Iniciando flash blanco en glitch (alpha flash usando shader)');

    const flashTargets = [];

    // Buscar todos los meshes del glitch object y crear shader materials
    this.glitchObject.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const originalMaterial = child.material;
      const alphaSource = originalMaterial.map || this.currentVideoTexture;

      if (!alphaSource) return;

      // Crear shader material blanco que respeta el alpha
      const flashMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uAlphaMap: { value: alphaSource }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uAlphaMap;
          varying vec2 vUv;
          void main() {
            vec4 tex = texture2D(uAlphaMap, vUv);
            float alpha = tex.a;
            if (alpha <= 0.0) discard;
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha); // Blanco con el alpha del texture
          }
        `
      });

      // Aplicar material flash
      child.material = flashMaterial;
      flashTargets.push({ child, originalMaterial, flashMaterial });
    });

    // Restaurar materiales originales después de 100ms
    setTimeout(() => {
      flashTargets.forEach(({ child, originalMaterial, flashMaterial }) => {
        child.material = originalMaterial;
        flashMaterial.dispose(); // Limpiar shader
      });
      console.log('✨ Flash blanco en glitch completado');

      // Completar reveal después del flash
      this.completeGlitchReveal();
    }, 100);

    return Promise.resolve();
  }

  updateGlitchFlash() {
    // Ya no es necesario - el flash ahora es instantáneo como en los rastros
  }

  finalizeGlitchFlash(state) {
    // Ya no es necesario - el flash ahora es instantáneo como en los rastros
  }

  completeGlitchReveal() {
    if (this.glitchObject) {
      this.glitchObject.visible = false;
    }

    if (this.videoElement) {
      try { this.videoElement.pause(); } catch { }
      try { this.videoElement.removeAttribute('src'); } catch { }
      try { this.videoElement.load(); } catch { }
      this.videoElement = null;
    }

    if (this.currentVideoTexture) {
      try { this.currentVideoTexture.dispose(); } catch { }
      this.currentVideoTexture = null;
    }

    if (this.rastroObject) {
      this.rastroObject.visible = true;
    }
  }

  easeInCubic(t) {
    return t * t * t;
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  onFlechaClick() {
    // 👇 Previene clicks múltiples
    if (this.flechaClicked) return;
    this.flechaClicked = true;

    // 🔊 Reproducir sonido de pez agarrado
    const flechaClickAudio = new Audio('/game-assets/recorrido/sonido/Pez agarrado.mp3');
    flechaClickAudio.volume = 0.5;
    flechaClickAudio.play().catch(e => console.error("Flecha click audio play failed:", e));

    // 🎵 Fade out del audio de la escena
    if (this.audio) {
      const fadeOutDuration = 1000; // 1 segundo
      const startVolume = this.audio.volume;
      const startTime = performance.now();

      const fadeOutAudio = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / fadeOutDuration, 1);

        // Fade out usando easeInCubic para una transición suave
        this.audio.volume = startVolume * (1 - this.easeInCubic(progress));

        if (progress < 1) {
          requestAnimationFrame(fadeOutAudio);
        } else {
          // Pausar y limpiar el audio al finalizar el fade
          this.audio.pause();
          this.audio = null;
        }
      };

      fadeOutAudio();
    }

    // 👇 Flash blanco y desaparición de la flecha
    const flechaMeshes = new Set();
    if (this.flechaObject) {
      this.flechaObject.traverse(child => {
        if (child.isMesh) {
          flechaMeshes.add(child);
        }
      });
    }
    if (flechaMeshes.size === 0 && this.flechaObjects?.length) {
      this.flechaObjects.forEach(mesh => {
        if (mesh?.isMesh) {
          flechaMeshes.add(mesh);
        }
      });
    }

    if (flechaMeshes.size > 0) {
      const flashTargets = [];
      let hasFlashTargets = false;

      flechaMeshes.forEach(mesh => {
        const originalMaterial = mesh.material;
        const originalList = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];

        let isValid = true;
        const shaderMaterials = originalList.map((mat) => {
          if (!mat) {
            isValid = false;
            return null;
          }

          const alphaSource = mat.alphaMap || mat.map;
          if (!alphaSource) {
            isValid = false;
            return null;
          }

          if (alphaSource.matrixAutoUpdate) {
            alphaSource.updateMatrix();
          }

          const shaderMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
              uOpacity: { value: 0 },
              uAlphaMap: { value: alphaSource },
              uAlphaMapMatrix: { value: alphaSource.matrix ? alphaSource.matrix.clone() : new THREE.Matrix3() }
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D uAlphaMap;
              uniform float uOpacity;
              uniform mat3 uAlphaMapMatrix;
              varying vec2 vUv;

              void main() {
                vec3 transformed = uAlphaMapMatrix * vec3(vUv, 1.0);
                vec4 tex = texture2D(uAlphaMap, transformed.xy);
                float alpha = tex.a * uOpacity;
                if (alpha <= 0.0) discard;
                gl_FragColor = vec4(vec3(1.0), alpha);
              }
            `
          });

          shaderMat.userData.alphaSource = alphaSource;
          return shaderMat;
        });

        if (!isValid || shaderMaterials.some(mat => !mat)) {
          shaderMaterials.forEach(mat => mat?.dispose?.());
          return;
        }

        hasFlashTargets = true;
        const replacement = Array.isArray(originalMaterial) ? shaderMaterials : shaderMaterials[0];
        mesh.material = replacement;
        if (Array.isArray(replacement)) {
          replacement.forEach(mat => mat && (mat.needsUpdate = true));
        } else if (replacement) {
          replacement.needsUpdate = true;
        }

        flashTargets.push({
          mesh,
          originalMaterial,
          flashMaterials: shaderMaterials
        });
      });

      const flashDuration = 200; // ms
      const startTime = performance.now();

      const animateFlash = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / flashDuration, 1);

        const opacity = 1 - progress;
        flashTargets.forEach(({ flashMaterials }) => {
          flashMaterials.forEach((mat) => {
            if (!mat?.uniforms?.uOpacity) return;
            const alphaSource = mat.userData?.alphaSource;
            if (alphaSource?.matrixAutoUpdate) {
              alphaSource.updateMatrix();
              if (alphaSource.matrix && mat.uniforms.uAlphaMapMatrix?.value instanceof THREE.Matrix3) {
                mat.uniforms.uAlphaMapMatrix.value.copy(alphaSource.matrix);
              }
            }
            mat.uniforms.uOpacity.value = opacity;
          });
        });

        if (progress < 1) {
          requestAnimationFrame(animateFlash);
        } else {
          if (this.flechaObject) {
            this.flechaObject.visible = false;
          }
          if (this.flechaObjects && this.flechaObjects.length > 0) {
            this.flechaObjects.forEach(flechaObj => {
              flechaObj.visible = false;
            });
          }

          flashTargets.forEach(({ mesh, originalMaterial, flashMaterials }) => {
            flashMaterials.forEach((mat) => {
              try { mat.dispose(); } catch { }
            });
            mesh.material = originalMaterial;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(mat => mat && (mat.needsUpdate = true));
            } else if (mesh.material) {
              mesh.material.needsUpdate = true;
            }
          });
        }
      };

      if (hasFlashTargets) {
        animateFlash();
      } else {
        if (this.flechaObject) {
          this.flechaObject.visible = false;
        }
        if (this.flechaObjects && this.flechaObjects.length > 0) {
          this.flechaObjects.forEach(flechaObj => {
            flechaObj.visible = false;
          });
        }
      }
    } else {
      if (this.flechaObject) {
        this.flechaObject.visible = false;
      }
      if (this.flechaObjects && this.flechaObjects.length > 0) {
        this.flechaObjects.forEach(flechaObj => {
          flechaObj.visible = false;
        });
      }
    }

    // New transition system with barrida.webm overlay
    return import('../core/UI.js').then(({ UI }) => {
      // 👇 Ocultar zócalo al iniciar la transición
      const zocaloVideo = document.getElementById('zocaloVideo');
      if (zocaloVideo) {
        zocaloVideo.style.opacity = '0';
      }

      // 🔊 Reproducir audio de transición al inicio (con la primera barrida)
      if (this.transitionAudio) {
        this.transitionAudio.pause();
        this.transitionAudio.currentTime = 0;
      }
      this.transitionAudio = new Audio('/game-assets/recorrido/sonido/Transicion delta mas.mp3');
      this.transitionAudio.volume = 0.5;
      this.transitionAudio.play().catch(e => console.error("Transition audio play failed:", e));

      const nextSceneIndex = this.current + 1;

      // 📝 Cargar texto de transición desde JSON basado en round y stage
      let transitionText = null;
      const progress = this.speciesManager.getProgress();

      // El SpeciesManager aún NO se ha actualizado (se actualiza en nextStage())
      // Así que progress tiene el stage ACTUAL, no el próximo
      // Necesitamos calcular manualmente hacia dónde vamos
      const currentStage = progress.stage;
      const targetStage = (currentStage % 6) + 1; // Próximo stage (1-6, ciclando)
      const targetRound = (currentStage === 6) ? progress.round + 1 : progress.round; // Si completamos stage 6, avanzamos de ronda

      console.log(`[RecorridoScene] Transition - Current scene: ${this.current}, Next scene: ${nextSceneIndex}, Current stage: ${currentStage}, Target stage: ${targetStage}, Target round: ${targetRound}`);

      fetch('/game/data/transition_texts.json')
        .then(res => res.json())
        .then(data => {
          // Buscar transición que coincida con round y stage hacia donde vamos
          const transition = data.transitions.find(t =>
            t.round === targetRound && t.stage === targetStage
          );
          if (transition) {
            transitionText = transition;
            console.log(`[RecorridoScene] Transition text loaded for Round ${targetRound}, Stage ${targetStage}:`, transition.text || transition.intro);
          } else {
            console.log(`[RecorridoScene] No transition text found for Round ${targetRound}, Stage ${targetStage}`);
          }
        })
        .catch(e => console.error('Failed to load transition texts:', e));
      const transitionVideoSrc = `/game-assets/recorrido/transiciones_escenas/transicion${String(nextSceneIndex).padStart(2, '0')}.webm`;
      const FRAME_RATE = 30; // 👈 ajustar si el clip usa otro framerate
      const BARRIDA_TRIGGER_FRAME = 19; // 👈 Iniciar video de transición al frame 19 (barrida solo dura ~44 frames)

      console.log('[RecorridoScene] Starting transition to scene', nextSceneIndex);

      // Create barrida overlay (top layer with alpha)
      const baseW = this.app?.BASE_WIDTH ?? window.innerWidth;
      const baseH = this.app?.BASE_HEIGHT ?? window.innerHeight;
      const parent = this.overlayRoot || document.body;
      const barridaOverlay = document.createElement('div');
      barridaOverlay.style.position = 'absolute';
      barridaOverlay.style.top = '0';
      barridaOverlay.style.left = '0';
      barridaOverlay.style.width = `${baseW}px`;
      barridaOverlay.style.height = `${baseH}px`;
      barridaOverlay.style.zIndex = '10002';
      barridaOverlay.style.pointerEvents = 'none';
      barridaOverlay.style.display = 'flex';
      barridaOverlay.style.alignItems = 'center';
      barridaOverlay.style.justifyContent = 'center';
      barridaOverlay.style.opacity = '1';
      barridaOverlay.style.visibility = 'visible';
      barridaOverlay.style.transition = 'opacity 140ms ease-out';

      const barridaVideo = document.createElement('video');
      barridaVideo.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      barridaVideo.src = '/game-assets/recorrido/transiciones_escenas/barrida.webm';
      barridaVideo.muted = true; // 👈 Silenciar barrida para que solo suene transitionAudio
      barridaVideo.playsInline = true;
      barridaVideo.preload = 'auto'; // 👈 Precargar el video

      // 🔍 Log cuando el video carga sus metadatos
      barridaVideo.addEventListener('loadedmetadata', () => {
        console.log('[RecorridoScene] Barrida video metadata loaded - duration:', barridaVideo.duration, 's');
      });

      barridaOverlay.appendChild(barridaVideo);
      parent.appendChild(barridaOverlay);

      const showBarridaOverlay = () => {
        barridaOverlay.style.visibility = 'visible';
        barridaOverlay.style.opacity = '1';
      };

      const hideBarridaOverlay = () => {
        barridaOverlay.style.opacity = '0';
        barridaOverlay.style.visibility = 'hidden';
      };

      let transitionVideoStarted = false;
      let secondBarridaStarted = false;
      let nextStagePromise = null;
      let textOverlayShown = false;

      // 📝 Función para mostrar el texto overlay con efecto typewriter
      const showTextOverlay = () => {
        if (textOverlayShown || !transitionText) return;
        textOverlayShown = true;

        const textOverlay = document.createElement('div');
        textOverlay.id = 'transition-text-overlay';
        textOverlay.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 420px;
          height: 240px;
          z-index: 10003;
          pointer-events: none;
          font-family: ${EFEDRA_OVERLAY_THEME.fonts.family};
          text-align: left;
          padding: 24px;
          opacity: 0;
          transition: opacity 1s ease-in;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        const textEl = document.createElement('div');
        textEl.style.cssText = `
          font-size: 20px;
          font-weight: 400;
          color: #FDFE63;
          text-shadow: 0 0 18px rgba(0,0,0,0.6);
          letter-spacing: 0.02em;
          line-height: 1.4;
        `;

        textOverlay.appendChild(textEl);
        parent.appendChild(textOverlay);

        // Fade in más lento
        setTimeout(() => {
          textOverlay.style.opacity = '1';
        }, 800); // Esperar 500ms antes de empezar el fade in

        // 🖊️ Efecto typewriter
        const fullText = transitionText.text || transitionText.intro || '';
        let currentIndex = 0;

        const typewriterInterval = setInterval(() => {
          if (currentIndex <= fullText.length) {
            textEl.textContent = fullText.substring(0, currentIndex);
            currentIndex++;
          } else {
            clearInterval(typewriterInterval);
          }
        }, 20); // 5ms entre cada caracter

        // Guardar referencia para remover luego y limpiar interval
        barridaOverlay._textOverlay = textOverlay;
        barridaOverlay._typewriterInterval = typewriterInterval;
        barridaOverlay._textShownTime = performance.now();

        // 📅 Programar desaparición después de 10 segundos (9 segundos para transición 4->5)
        const textDuration = (this.current === 3 && nextSceneIndex === 4) ? 9000 : 10000;
        setTimeout(() => {
          if (barridaOverlay._textOverlay && !barridaOverlay._textRemoved) {
            barridaOverlay._textRemoved = true;

            // Limpiar interval de typewriter si existe
            if (barridaOverlay._typewriterInterval) {
              clearInterval(barridaOverlay._typewriterInterval);
            }

            // Fade out del texto
            barridaOverlay._textOverlay.style.transition = 'opacity 0.3s ease-out';
            barridaOverlay._textOverlay.style.opacity = '0';

            setTimeout(() => {
              try {
                if (barridaOverlay._textOverlay) {
                  barridaOverlay._textOverlay.remove();
                }
              } catch (e) {
                console.error('[RecorridoScene] Failed to remove text overlay', e);
              }
            }, 300);
          }
        }, textDuration); // Desaparecer después de 10 segundos (9 para transición 4->5)
      };

      // 📺 Monitorear primera barrida para mostrar texto 2 segundos antes de que termine
      const monitorFirstBarrida = () => {
        if (barridaVideo.paused || barridaVideo.ended) return;

        const timeRemaining = barridaVideo.duration - barridaVideo.currentTime;

        // Mostrar texto 2 segundos antes de que termine la barrida
        if (!textOverlayShown && timeRemaining <= 1.0 && timeRemaining > 0) {
          console.log('[RecorridoScene] Showing text overlay 2 seconds before barrida ends');
          showTextOverlay();
        }

        if (!barridaVideo.ended) {
          requestAnimationFrame(monitorFirstBarrida);
        }
      };


      const handleFirstBarridaEnd = () => {
        console.log('[RecorridoScene] First barrida finished, revealing transition video');
        console.log('[RecorridoScene] Transition video started?', transitionVideoStarted);
        hideBarridaOverlay();

        // Si el texto aún no se mostró (por algún error de timing), mostrarlo ahora
        if (!textOverlayShown) {
          showTextOverlay();
        }
      };
      barridaVideo.addEventListener('ended', handleFirstBarridaEnd, { once: true });      // Handle second barrida end - only remove after it finishes
      const handleSecondBarridaEnd = async () => {
        console.log('[RecorridoScene] Second barrida finished, cleaning up');

        if (this._stopTransitionSequence) {
          this._stopTransitionSequence();
        }

        // 👉 Ocultar el video overlay para desbloquear clicks y cámara
        UI.hideVideo();
        console.log('[RecorridoScene] Video overlay hidden - clicks and camera unlocked');

        // � Restaurar z-index del video overlay
        const videoOverlay = document.getElementById('videoOverlay');
        if (videoOverlay) {
          videoOverlay.style.zIndex = '9999'; // Restaurar valor original
        }

        // �📝 Remover text overlay si aún existe (por si acaso no se removió antes)
        if (barridaOverlay._textOverlay && !barridaOverlay._textRemoved) {
          if (barridaOverlay._typewriterInterval) {
            clearInterval(barridaOverlay._typewriterInterval);
          }
          try {
            barridaOverlay._textOverlay.remove();
          } catch (e) {
            console.error('[RecorridoScene] Failed to remove text overlay', e);
          }
        }

        try {
          barridaOverlay.remove();
        } catch (e) {
          console.error('[RecorridoScene] Failed to remove barrida overlay', e);
        }

        // 👉 Esperar a que termine de cargar si aún no terminó
        if (nextStagePromise) {
          await nextStagePromise;
        }

        // 👉 Ahora SÍ detener el audio de transición
        if (this.transitionAudio) {
          this.transitionAudio.pause();
          this.transitionAudio = null;
        }

        console.log('[RecorridoScene] Next stage ready');

        // 🔊 Reproducir sonido de inicio de escenario (post barrida)
        if (this.sceneStartAudio) {
          this.sceneStartAudio.pause();
          this.sceneStartAudio.currentTime = 0;
        }
        this.sceneStartAudio = new Audio('/game-assets/recorrido/sonido/Transicion inicio de escenarios.mp3');
        this.sceneStartAudio.volume = 0.5;
        this.sceneStartAudio.play().catch(e => console.error("Scene start audio play failed:", e));

        // 🎬 Reproducir zócalo de la nueva escena
        this.playZocalo();

        // 👉 Resetear flechaClicked para permitir nuevos clicks
        this.flechaClicked = false;
        console.log('[RecorridoScene] flechaClicked reset to false - clicks enabled');
      };

      // Monitor barrida frames
      const checkBarridaFrame = () => {
        const currentTime = barridaVideo.currentTime;
        const currentFrame = Math.floor(currentTime * FRAME_RATE);

        console.log('[RecorridoScene] Barrida frame check:', currentFrame, 'time:', currentTime.toFixed(3));

        // At frame 50 (or when we pass it), start the transition video underneath
        if (!transitionVideoStarted && currentFrame >= BARRIDA_TRIGGER_FRAME) {
          transitionVideoStarted = true;
          console.log('[RecorridoScene] Frame', currentFrame, 'reached (>= 50), starting transition video');

          // 👇 Ajustar z-index del video overlay para que esté DEBAJO de la barrida
          const videoOverlay = document.getElementById('videoOverlay');
          if (videoOverlay) {
            videoOverlay.style.zIndex = '10000'; // Debajo de barrida (10002) pero encima del texto (10003 se usa solo para transition-text-overlay)
            console.log('[RecorridoScene] Video overlay z-index set to 10000');
          }

          if (this._stopTransitionSequence) {
            this._stopTransitionSequence();
          }

          UI.showVideo({
            src: transitionVideoSrc,
            controls: false,
            muted: false,
            immersive: false,
            onended: () => {
              console.log('[RecorridoScene] Transition video ended - hiding video overlay');
              // Ocultar el video cuando termina, la segunda barrida ya está encima
              if (this._stopTransitionSequence) {
                this._stopTransitionSequence();
              }
              UI.hideVideo();
            }
          }).then(async (transitionVideo) => {
            console.log('[RecorridoScene] Transition video element ready:', transitionVideo);
            console.log('[RecorridoScene] Video duration:', transitionVideo.duration);
            console.log('[RecorridoScene] Video display:', window.getComputedStyle(transitionVideo.parentElement).display);
            console.log('[RecorridoScene] Video z-index:', window.getComputedStyle(transitionVideo.parentElement).zIndex);

            const videoOverlayEl = document.getElementById('videoOverlay');
            if (videoOverlayEl) {
              // 🎞️ Superponer el video WebM de la secuencia sobre el video de transición
              const baseW = this.app?.BASE_WIDTH ?? window.innerWidth;
              const baseH = this.app?.BASE_HEIGHT ?? window.innerHeight;

              const sequenceOverlay = document.createElement('div');
              sequenceOverlay.style.cssText = `
                position: absolute;
                top: 0px;
                left: 0px;
                width: ${baseW}px;
                height: ${baseH}px;
                pointer-events: none;
                z-index: 10001;
              `;

              const sequenceVideo = document.createElement('video');
              sequenceVideo.src = '/game-assets/recorrido/interfaz/loading-text-box-animation.webm';
              sequenceVideo.muted = true;
              sequenceVideo.loop = false;
              sequenceVideo.playsInline = true;
              sequenceVideo.style.cssText = `
                position: absolute;
                object-fit: contain;
                display: block;
              `;

              sequenceOverlay.appendChild(sequenceVideo);
              videoOverlayEl.appendChild(sequenceOverlay);

              const targetVideoHeight = 600;
              const applyVideoLayout = () => {
                const aspect = sequenceVideo.videoWidth && sequenceVideo.videoHeight
                  ? sequenceVideo.videoWidth / sequenceVideo.videoHeight
                  : 1;
                const targetWidth = Math.round(targetVideoHeight * aspect);
                const centeredLeft = Math.max(0, Math.round((baseW - targetWidth) / 2));
                const centeredTop = Math.max(0, Math.round((baseH - targetVideoHeight) / 2));

                sequenceVideo.style.height = `${targetVideoHeight}px`;
                sequenceVideo.style.width = `${targetWidth}px`;
                sequenceVideo.style.left = `${centeredLeft}px`;
                sequenceVideo.style.top = `${centeredTop}px`;
              };

              if (sequenceVideo.readyState >= 1) {
                applyVideoLayout();
              } else {
                sequenceVideo.addEventListener('loadedmetadata', applyVideoLayout, { once: true });
              }

              // Reproducir el video overlay y mantener en el último frame al terminar
              sequenceVideo.addEventListener('ended', () => {
                // Mantener el último frame visible (ya que loop=false)
                console.log('[RecorridoScene] Transition overlay video ended, keeping last frame');
              }, { once: true });

              const playPromise = sequenceVideo.play();
              if (playPromise) {
                playPromise.catch(err => {
                  console.warn('[RecorridoScene] Transition overlay video play failed', err);
                });
              }

              const detachOverlay = () => {
                try {
                  sequenceVideo.pause();
                  sequenceVideo.removeAttribute('src');
                  sequenceVideo.load();
                } catch { }
                try {
                  sequenceOverlay.remove();
                } catch { }
              };

              let handleVideoEnded = null;
              let handleVideoPause = null;

              const cleanupListeners = () => {
                if (handleVideoEnded) {
                  transitionVideo.removeEventListener('ended', handleVideoEnded);
                  handleVideoEnded = null;
                }
                if (handleVideoPause) {
                  transitionVideo.removeEventListener('pause', handleVideoPause);
                  handleVideoPause = null;
                }
              };

              const stopSequence = () => {
                cleanupListeners();
                detachOverlay();
              };

              handleVideoEnded = () => {
                stopSequence();
                this._stopTransitionSequence = null;
              };

              handleVideoPause = () => {
                if (videoOverlayEl.style.display === 'none') {
                  stopSequence();
                  this._stopTransitionSequence = null;
                }
              };

              transitionVideo.addEventListener('ended', handleVideoEnded, { once: true });
              transitionVideo.addEventListener('pause', handleVideoPause);

              this._stopTransitionSequence = () => {
                stopSequence();
                this._stopTransitionSequence = null;
              };
            }

            // 👇 Si es la tercera sección (nextSceneIndex === 3), agregar listener para ir a InstruccionesTransitionScene
            // if (nextSceneIndex === 3) {
            //   const handleVideoClick = () => {
            //     console.log('[RecorridoScene] Click en video de tercera sección - navegando a InstruccionesTransitionScene');

            //     // Limpiar todo
            //     if (this.transitionAudio) {
            //       this.transitionAudio.pause();
            //       this.transitionAudio = null;
            //     }

            //     // Remover listeners
            //     transitionVideo.removeEventListener('click', handleVideoClick);

            //     // Limpiar overlays
            //     try {
            //       barridaOverlay.remove();
            //     } catch (e) {
            //       console.error('[RecorridoScene] Failed to remove barrida overlay', e);
            //     }

            //     // Ocultar video
            //     import('../core/UI.js').then(({ UI }) => {
            //       UI.hideVideo();
            //     });

            //     // Navegar a InstruccionesTransitionScene
            //     this.app.router.goTo('instrucciones-transition');
            //   };

            //   transitionVideo.addEventListener('click', handleVideoClick);
            //   console.log('[RecorridoScene] Click listener añadido al video de transición (tercera sección)');
            // }

            // �👉 Precargar la siguiente escena INMEDIATAMENTE (sin pausar transitionAudio)
            console.log('[RecorridoScene] Preloading next stage...');
            nextStagePromise = this.nextStage({ keepTransitionAudio: true });

            // Monitor transition video to trigger second barrida 19 frames before end
            const monitorTransition = () => {
              if (!transitionVideo || transitionVideo.paused) return;

              const timeRemaining = transitionVideo.duration - transitionVideo.currentTime;
              const framesRemaining = Math.floor(timeRemaining * FRAME_RATE);

              // 19 frames before end, play barrida again
              if (!secondBarridaStarted && framesRemaining <= BARRIDA_TRIGGER_FRAME && framesRemaining > 0) {
                secondBarridaStarted = true;
                console.log('[RecorridoScene] 19 frames before end, playing barrida again. Frames remaining:', framesRemaining);
                showBarridaOverlay();
                barridaVideo.currentTime = 0;
                console.log('[RecorridoScene] Second barrida starting');

                // Listen for second barrida end
                barridaVideo.addEventListener('ended', handleSecondBarridaEnd, { once: true });

                // 🛡️ Safety fallback: Monitor second barrida and force cleanup if needed
                const monitorSecondBarrida = () => {
                  if (!barridaVideo || barridaVideo.paused || barridaVideo.ended) {
                    return;
                  }

                  const timeLeft = barridaVideo.duration - barridaVideo.currentTime;

                  if (timeLeft > 0) {
                    requestAnimationFrame(monitorSecondBarrida);
                  } else {
                    // Forzar cleanup si el evento 'ended' no dispara
                    console.log('[RecorridoScene] Second barrida reached end (forcing cleanup)');
                    setTimeout(handleSecondBarridaEnd, 100);
                  }
                };

                const secondPlay = barridaVideo.play();
                if (secondPlay && typeof secondPlay.then === 'function') {
                  secondPlay.then(() => {
                    monitorSecondBarrida();
                  }).catch(err => {
                    console.error('[RecorridoScene] Failed to play second barrida:', err);
                    // If play fails, clean up anyway
                    handleSecondBarridaEnd();
                  });
                } else {
                  console.warn('[RecorridoScene] Second barrida play promise unavailable, continuing');
                  monitorSecondBarrida();
                }
              }

              if (timeRemaining > 0) {
                requestAnimationFrame(monitorTransition);
              }
            };

            if (transitionVideo.readyState >= 1) {
              monitorTransition();
            } else {
              transitionVideo.addEventListener('loadedmetadata', () => {
                monitorTransition();
              }, { once: true });
            }
          });
        }

        if (!barridaVideo.paused && !barridaVideo.ended && !transitionVideoStarted) {
          requestAnimationFrame(checkBarridaFrame);
        }
      };

      // Start playing barrida
      const initialPlay = barridaVideo.play();
      if (initialPlay && typeof initialPlay.then === 'function') {
        initialPlay.then(() => {
          console.log('[RecorridoScene] First barrida started playing');
          showBarridaOverlay();
          checkBarridaFrame();
          // 📺 Iniciar monitoreo para mostrar texto 1 segundo antes del final
          monitorFirstBarrida();
        }).catch(err => {
          console.error('[RecorridoScene] Failed to play barrida:', err);
          hideBarridaOverlay();
        });
      } else {
        console.warn('[RecorridoScene] Barrida play promise unavailable, continuing');
        showBarridaOverlay();
        checkBarridaFrame();
        // 📺 Iniciar monitoreo para mostrar texto 1 segundo antes del final
        monitorFirstBarrida();
      }

      // Safety: hide overlay if the barrida media fails to load
      barridaVideo.addEventListener('error', (err) => {
        console.error('[RecorridoScene] Barrida video error', err);
        hideBarridaOverlay();
      }, { once: true });
    });
  }

  triggerWipeTransition(onComplete) {
    return new Promise((resolve) => {
      try {
        // Clean up any previous wipe
        if (this._wipeElements) {
          this._wipeElements.forEach(el => el.remove());
          this._wipeElements = null;
        }
        if (this._wipeStyle) {
          this._wipeStyle.remove();
          this._wipeStyle = null;
        }

        const closeDuration = 600;
        const openDuration = 600;
        const easing = 'cubic-bezier(0.65, 0, 0.35, 1)';

        const style = document.createElement('style');
        style.textContent = `
          @keyframes dg-wipe-left-close {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(0); }
          }
          @keyframes dg-wipe-right-close {
            0%   { transform: translateX(100%); }
            100% { transform: translateX(0); }
          }
          @keyframes dg-wipe-left-open {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-100%); }
          }
          @keyframes dg-wipe-right-open {
            0%   { transform: translateX(0); }
            100% { transform: translateX(100%); }
          }
        `;
        document.head.appendChild(style);
        this._wipeStyle = style;

        const parent = this.overlayRoot || document.body;
        const leftBand = document.createElement('div');
        leftBand.style.position = 'absolute';
        leftBand.style.left = '0';
        leftBand.style.top = '0';
        leftBand.style.width = '50%';
        leftBand.style.height = '100%';
        leftBand.style.background = 'white';
        leftBand.style.zIndex = '10001';
        leftBand.style.pointerEvents = 'none';
        leftBand.style.animation = `dg-wipe-left-close ${closeDuration}ms ${easing} forwards`;

        const rightBand = document.createElement('div');
        rightBand.style.position = 'absolute';
        rightBand.style.right = '0';
        rightBand.style.top = '0';
        rightBand.style.width = '50%';
        rightBand.style.height = '100%';
        rightBand.style.background = 'white';
        rightBand.style.zIndex = '10001';
        rightBand.style.pointerEvents = 'none';
        rightBand.style.animation = `dg-wipe-right-close ${closeDuration}ms ${easing} forwards`;

        parent.appendChild(leftBand);
        parent.appendChild(rightBand);
        this._wipeElements = [leftBand, rightBand];

        let opened = false;
        let cleaned = false;

        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          try { leftBand.remove(); } catch { }
          try { rightBand.remove(); } catch { }
          try { style.remove(); } catch { }
          this._wipeElements = null;
          this._wipeStyle = null;
          resolve();
        };

        const startOpen = () => {
          if (opened) return;
          opened = true;
          const applyOpen = () => {
            leftBand.style.animation = `dg-wipe-left-open ${openDuration}ms ${easing} forwards`;
            rightBand.style.animation = `dg-wipe-right-open ${openDuration}ms ${easing} forwards`;
          };
          requestAnimationFrame(() => requestAnimationFrame(applyOpen));
        };

        const waitForContent = async () => {
          try {
            if (onComplete) {
              await Promise.resolve(onComplete());
            }
            // wait a frame so newly loaded assets can settle before revealing
            await new Promise(res => requestAnimationFrame(() => res()))
              .catch(() => { });
          } catch (error) {
            console.error('[RecorridoScene] Wipe transition content step failed', error);
          } finally {
            startOpen();
          }
        };

        const handleCloseEnd = (event) => {
          if (event.animationName !== 'dg-wipe-left-close') return;
          leftBand.removeEventListener('animationend', handleCloseEnd);
          waitForContent();
        };

        const handleOpenEnd = (event) => {
          if (event.animationName !== 'dg-wipe-left-open') return;
          leftBand.removeEventListener('animationend', handleOpenEnd);
          cleanup();
        };

        const handleRightOpenEnd = (event) => {
          if (event.animationName !== 'dg-wipe-right-open') return;
          rightBand.removeEventListener('animationend', handleRightOpenEnd);
          cleanup();
        };

        leftBand.addEventListener('animationend', handleCloseEnd);
        leftBand.addEventListener('animationend', handleOpenEnd);
        rightBand.addEventListener('animationend', handleRightOpenEnd);
      } catch {
        resolve();
      }
    });
  }


}