import * as THREE from 'three';
import { BaseScene } from '../core/BaseScene.js';
import { AssetLoader } from '../core/AssetLoader.js';
import { State } from '../core/State.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


export class RecorridoScene extends BaseScene {
  constructor(app) {
    super(app); this.name = 'recorrido';
    this.current = 0; this.stages = [];
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.velLon = 0; this.velLat = 0; this.isAutoLook = false;
    this.use3DInventory = false; // 👈 switch inicial
    this.inventoryModel = null;
    this.inventoryOverlay = null;

    this.lon = 0; this.lat = 0; // grados

    this.config = {
      deadzone: 0.12,
      maxSpeed: { yaw: 80, pitch: 50 },
      damping: 0.12
    };
  }

  // --- ADD: campos nuevos en la clase
  overlayScene = new THREE.Scene();
  overlayCam = null;
  viz = { nodes: [], links: [], group: null, lines: null, radial: null, handV: 0, handPrev: new THREE.Vector2() };
  screenSize = new THREE.Vector2();


  async mount() {
    // Fondo transparente; esfera 360
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(500, 64, 48).scale(-1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    this.scene.add(this.sphere);

    // Anchor + marker
    this.anchor = new THREE.Object3D();
    this.scene.add(this.anchor);
    const uniforms = this.uniforms = { uTexture: { value: null }, uTime: { value: 0 }, uGlitch: { value: 1 } };
    this.marker = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.ShaderMaterial({
        uniforms, transparent: true, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          uniform sampler2D uTexture; uniform float uTime; uniform float uGlitch; varying vec2 vUv;
          float rand(vec2 co){ return fract(sin(dot(co.xy,vec2(12.9898,78.233)))*43758.5453); }
          void main(){
            vec2 uv=vUv; vec4 tex=texture2D(uTexture,uv);
            float line=floor(uv.y*200.0); float offset=rand(vec2(line,floor(uTime*30.0)))-0.5;
            vec2 guv=uv; guv.x+=offset*0.3; vec4 t2=texture2D(uTexture,guv);
            float gray=dot(t2.rgb,vec3(0.3,0.59,0.11)); vec3 green=vec3(0.0,gray,0.0);
            float scan=sin(uv.y*800.0+uTime*20.0)*0.1; green+=vec3(0.0,scan,0.0);
            vec4 glitchColor=vec4(green,t2.a); gl_FragColor=mix(tex,glitchColor,uGlitch);
          }`
      })
    );
    this.anchor.add(this.marker);

    // Cámara
    this.camera.fov = 75; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0.1);

    // Input
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onLeave = () => this.mouseNDC.set(0, 0);
    this._onClick = (e) => this.onClick(e);
    this.app.canvas.addEventListener('mousemove', this._onMouseMove);
    this.app.canvas.addEventListener('mouseleave', this._onLeave);
    this.app.canvas.addEventListener('click', this._onClick);

    // 👇 MUY IMPORTANTE: inicializar overlay antes de usar buildVizForStage
    this.setupOverlay();

    // Cargar config JSON
    const conf = await fetch('./data/recorrido.json', { cache: 'no-store' }).then(r => r.json());
    this.stages = conf.stages || [];
    await this.loadStage(0);

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

    this.initInventoryCanvas();


  }

  initInventoryCanvas() {
    this.inventoryCanvas = document.getElementById("inventoryCanvas");
    if (!this.inventoryCanvas) return;
    this.inventoryCtx = this.inventoryCanvas.getContext("2d");

    this.resizeInventoryCanvas();
    window.addEventListener("resize", () => this.resizeInventoryCanvas());

    // 👇 preload your PNG here
    this.inventoryImg = new Image();
    this.inventoryImg.src = "/game-assets/recorrido/paneles/paneles_vacio.png";
  }

  resizeInventoryCanvas() {
    this.inventoryCanvas.width = window.innerWidth;
    this.inventoryCanvas.height = window.innerHeight;
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

  addVenetianBlinds(mat) {
    mat.onBeforeCompile = (shader) => {
      // uniforms on JS side
      shader.uniforms.uStripeDensityX = { value: 90.0 };
      shader.uniforms.uStripeDensityY = { value: 90.0 };
      shader.uniforms.uStripeThickness = { value: 0.7 };

      // --- VERTEX: add varying & pass uv ---
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `
      varying vec2 vCustomUv;
      void main() {
        vCustomUv = uv;
      `
      );

      // --- FRAGMENT: add varyings + uniforms ---
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `
      varying vec2 vCustomUv;
      uniform float uStripeDensityX;
      uniform float uStripeDensityY;
      uniform float uStripeThickness;
      void main() {
      `
      );

      // --- FRAGMENT: inject Venetian blinds after map is applied ---
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
      #include <map_fragment>

      float stripeH = step(fract(vCustomUv.y * uStripeDensityY), uStripeThickness);
      float stripeV = step(fract(vCustomUv.x * uStripeDensityX), uStripeThickness);
      float grid = max(stripeH, stripeV);

      vec3 overlay = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.0), grid);
      diffuseColor.rgb = mix(diffuseColor.rgb, overlay, 0.1);
      `
      );

      mat.userData.shader = shader;
    };

    mat.needsUpdate = true;


  }

  loadInventory3D() {
    const loader = new GLTFLoader();
    loader.load(
      '/game-assets/recorrido/paneles/inventario.glb',
      (gltf) => {
        const model = gltf.scene;
        console.log('Inventario GLB loaded:', model);

        model.scale.set(2, 2, 2);
        model.position.set(0, -0.7, -1.2);
        model.rotation.set(1.6, 0, 0);

        model.traverse((child) => {
          if (child.isMesh && child.material && child.material.name === "criatura_panel") {
            this.addVenetianBlinds(child.material);
          }
        });

        this.camera.add(model);
        this.inventoryModel = model;
      },
      undefined,
      (err) => console.error('Error loading GLB:', err)
    );
  }

  async loadInventoryCanvas() {
    // crear canvas y agregarlo al DOM si no existe
    let canvas = document.getElementById("inventoryCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "inventoryCanvas";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none"; // no bloquea clicks en la escena 3D
      document.body.appendChild(canvas);
    }

    this.inventoryCanvas = canvas;
    this.inventoryCtx = canvas.getContext("2d");

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

    // grupo base
    this.viz.group = new THREE.Group();
    this.overlayScene.add(this.viz.group);

    // maya radial (shader quad)
    const geo = new THREE.PlaneGeometry(420, 420);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0 } // 0..1
      },
      vertexShader: `
      varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
      fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uSpeed;
      // polar grid
      void main(){
        vec2 uv = vUv*2.0-1.0;
        float r = length(uv);
        float a = atan(uv.y, uv.x);
        // anillos
        float rings = smoothstep(0.0,0.02, abs(fract(r*20.0)-0.5)-0.48);
        // radiales
        float spokes = smoothstep(0.0,0.015, abs(fract((a/3.14159+1.0)*8.0)-0.5)-0.48);
        // puntos de “velocidad”
        float pulses = step(0.98, fract( r*30.0 - uTime*3.0*(0.3+uSpeed*2.0) ));
        float grid = max(rings, spokes);
        float v = max(grid, pulses*0.6);
        float fade = smoothstep(1.0, 0.6, r); // desvanece borde
        gl_FragColor = vec4(vec3(v*fade), v*0.26); // fino y blanco
      }
    `
    });
    this.viz.radial = new THREE.Mesh(geo, mat);
    this.viz.radial.renderOrder = 1;
    this.viz.radial.position.set(this.screenSize.x - 260, 160, 0); // “arriba-atrás”
    this.viz.group.add(this.viz.radial);

    // líneas (dynamic)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: 0.7, depthTest: false });
    this.viz.lines = new THREE.LineSegments(lineGeo, lineMat);
    this.viz.lines.renderOrder = 2;
    this.viz.group.add(this.viz.lines);


    window.addEventListener('resize', () => this.onResizeOverlay());
  }

  onResizeOverlay() {
    this.app.renderer.getSize(this.screenSize);
    const w = this.screenSize.x, h = this.screenSize.y;
    this.overlayCam.left = 0; this.overlayCam.right = w; this.overlayCam.bottom = h; this.overlayCam.top = 0;
    this.overlayCam.updateProjectionMatrix();
    this.viz.radial.position.set(w - 260, 160, 0);
  }

  // convierte yaw/pitch (°) de la esfera en pixel de pantalla (overlay)
  yawPitchToScreen(yawDeg, pitchDeg) {
    const r = 500;
    const phi = THREE.MathUtils.degToRad(90 - pitchDeg); // latitude
    const theta = THREE.MathUtils.degToRad(yawDeg);      // longitude

    const p = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );

    p.project(this.camera);

    const x = (p.x * 0.5 + 0.5) * this.screenSize.x;
    const y = (-p.y * 0.5 + 0.5) * this.screenSize.y;
    return new THREE.Vector2(x, y);
  }

  // --- ADD: crea nodos/links del overlay
  buildVizForStage(st) {
    if (!this.viz.group) {
      console.warn("Viz group not initialized yet");
      return;
    }
    // limpiar prev
    this.viz.nodes.forEach(n => { this.viz.group.remove(n.mesh); n.label?.remove(); });
    this.viz.nodes = [];
    this.viz.links = [];
    // nodes
    (st.viz?.nodes || []).forEach(spec => {
      const rect = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10), // tamaño fijo grande
        new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.9, transparent: true, depthTest: false })
      );
      rect.position.z = 1; // adelante
      rect.renderOrder = 3;
      this.viz.group.add(rect);

      // label DOM “monoespacial” (opcional)
      const el = document.createElement('div');
      el.className = 'threelabel';
      el.textContent = spec.label ?? '';
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);

      this.viz.nodes.push({ id: spec.id, yaw: spec.yaw, pitch: spec.pitch, w: spec.w, h: spec.h, mesh: rect, label: el, screen: new THREE.Vector2() });
    });

    // links
    (st.viz?.links || []).forEach(([a, b]) => {
      const na = this.viz.nodes.find(n => n.id === a);
      const nb = this.viz.nodes.find(n => n.id === b);
      if (na && nb) this.viz.links.push([na, nb]);
    });
  }






  initHUDVideo() {
    this.hudVideo = document.getElementById("hudVideo");
    this.hudCanvas = document.getElementById("hudCanvas");
    this.hudCtx = this.hudCanvas.getContext("2d");

    this.hudCanvas.width = window.innerWidth;
    this.hudCanvas.height = window.innerHeight;
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
    this.app.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.app.canvas.removeEventListener('mouseleave', this._onLeave);
    this.app.canvas.removeEventListener('click', this._onClick);
    if (this.audio) { this.audio.pause(); this.audio = null; }
  }

  async loadStage(i) {
    this.current = i;
    const st = this.stages[i]; if (!st) return;

    // Panorama
    const tex = await AssetLoader.texture(st.photo);
    this.sphere.material.map = tex; this.sphere.material.needsUpdate = true;

    // Marker
    this.marker.scale.set(1, 1, 1);
    this.marker.geometry.dispose(); this.marker.geometry = new THREE.PlaneGeometry(...st.marker.scale);
    this.uniforms.uTexture.value = await AssetLoader.texture(st.marker.src);

    const theta = THREE.MathUtils.degToRad(90 - st.marker.pitch);
    const phi = THREE.MathUtils.degToRad(st.marker.yaw);
    const r = 400;
    this.anchor.position.set(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi)
    );
    this.faceInwardNoRoll(this.anchor);

    // Glitch activo al comienzo
    this.uniforms.uGlitch.value = 1.0;

    // Orientación inicial
    if (st.forward) { this.lon = st.forward.yaw; this.lat = st.forward.pitch; }

    // Audio
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (st.audio) { this.audio = AssetLoader.audio(st.audio); this.audio.loop = true; this.audio.volume = 0.5; this.audio.play().catch(() => { }); }

    // --- cambia stage: llama después de setear marker/forward
    // en loadStage(...) al final añade:
    this.buildVizForStage(st);
  }

  faceInwardNoRoll(obj) { obj.up.set(0, 1, 0); obj.lookAt(0, 0, 0); obj.rotateY(Math.PI); }

  onMouseMove(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  onClick(e) {
    const ndc = new THREE.Vector2();
    const rect = this.app.canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.marker, true);
    if (!hits.length) return;

    // 👉 reproducir overlay

    // 👉 reproducir HUD overlay video
    this.playHUDVideo();

    this.glitchOffThenLook(() => this.playTransition(() => this.nextStage()));
  }

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.app.renderer.setSize(w, h);
    this.onResizeOverlay();
  }

  glitchOffThenLook(onDone) {
    const start = performance.now(); const duration = 1500; const s0 = this.uniforms.uGlitch.value;
    const anim1 = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      this.uniforms.uGlitch.value = THREE.MathUtils.lerp(s0, 0, t);
      if (t < 1) requestAnimationFrame(anim1); else this.smoothLookForward(onDone);
    }; anim1();
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
        immersive: true,   // intenta fullscreen nativo cuando pueda
        onended: () => { onEnded?.(); }
      });
    });

    // Recompensa (inventario) al iniciar la transición
    if (st.reward) { State.addItem(st.reward); }
  }

  nextStage() {
    const next = (this.current + 1) % this.stages.length;
    this.loadStage(next);
  }

  update(dt) {
    this.uniforms.uTime.value = performance.now() * 0.001;

    if (!this.isAutoLook) {
      const { deadzone, maxSpeed, damping } = this.config;
      const ax = this.axis(this.mouseNDC.x, deadzone);
      const ay = this.axis(this.mouseNDC.y, deadzone);
      const vx = ax * maxSpeed.yaw, vy = ay * maxSpeed.pitch;
      this.velLon += (vx - this.velLon) * damping;
      this.velLat += (vy - this.velLat) * damping;
      this.lon += this.velLon * dt;
      this.lat += this.velLat * dt;
      this.lat = Math.max(-85, Math.min(85, this.lat));
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

    // --- ADD dentro de update(dt), tras tu cámara.lookAt(...):
    this.updateViz(dt);

    this.updateInventoryCanvas();


  }

  axis(a, deadzone) {
    if (Math.abs(a) <= deadzone) return 0;
    const t = (Math.abs(a) - deadzone) / (1 - deadzone);
    const s = Math.min(Math.max(t, 0), 1); const smooth = s * s * (3 - 2 * s);
    return Math.sign(a) * smooth;
  }

  // --- implementación
  updateViz(dt) {
    // velocidad “mano” (proxy: delta mouse en píxeles)
    const mousePx = new THREE.Vector2(
      (this.mouseNDC.x * 0.5 + 0.5) * this.screenSize.x,
      (this.mouseNDC.y * 0.5 + 0.5) * this.screenSize.y
    );
    const dv = mousePx.clone().sub(this.viz.handPrev).length();
    this.viz.handPrev.copy(mousePx);
    // suavizado + normalizado
    const k = 0.1;
    this.viz.handV = THREE.MathUtils.lerp(this.viz.handV, Math.min(dv / 30, 1), k);
    this.viz.radial.material.uniforms.uSpeed.value = this.viz.handV * 3.0;
    if (this.viz.radial) {
      const t = performance.now() * 0.001;
      this.viz.radial.material.uniforms.uSpeed.value =
        0.5 * this.viz.handV + 0.5 * Math.sin(t * 0.5) * 0.5;
      this.viz.radial.material.uniforms.uTime.value = t;
    }

    // “follaje”: jitter micro con ruido temporal (puedes trocar por señal real)
    const jitter = (t) => (Math.sin(t * 3.7) * 0.6 + Math.cos(t * 2.3) * 0.4) * (2.0 * this.viz.handV);

    // posicionar nodos + labels
    const t = performance.now() * 0.002; // más rápido
    this.viz.nodes.forEach((n, i) => {
      const base = this.yawPitchToScreen(n.yaw, n.pitch);

      // jitter caótico en X/Y
      const jitterX = Math.sin(t * 5 + i) * 8.0 * (0.5 + this.viz.handV);
      const jitterY = Math.cos(t * 4.3 + i * 1.7) * 8.0 * (0.5 + this.viz.handV);

      n.screen.set(base.x + jitterX, base.y + jitterY);
      n.mesh.position.set(n.screen.x, n.screen.y, 0);

      // escala pulsante con mano + senoides
      const pulse = 0.4 * Math.sin(t * 1.1 + i);
      const s = (1.0 + this.viz.handV * 0.1);
      n.mesh.scale.set(s, s, 1);

      n.mesh.material.color.set(0xffffff);


      // label: vibración también
      if (n.label) {
        n.label.style.left = (n.screen.x + n.w * 0.6) + 'px';
        n.label.style.top = (n.screen.y - n.h * 0.6) + 'px';
        n.label.style.opacity = (0.6 + 0.4 * Math.abs(Math.sin(t * 6 + i))).toFixed(2);
      }
    });


    // líneas

    const positions = [];
    this.viz.links.forEach(([a, b], i) => {
      const dx = (Math.random() - 0.5) * 6.0;
      const dy = (Math.random() - 0.5) * 6.0;
      positions.push(a.screen.x, a.screen.y, 0,
        b.screen.x + dx, b.screen.y + dy, 0);
    });
    this.viz.lines.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    this.viz.lines.material.color.setHSL(
      (0.6 + 0.4 * Math.sin(performance.now() * 0.005)) % 1.0,
      1.0,
      0.6
    );

    const posAttr = new THREE.Float32BufferAttribute(positions, 3);
    this.viz.lines.geometry.setAttribute('position', posAttr);
    this.viz.lines.material.opacity = 0.4 + 0.3 * Math.sin(performance.now() * 0.003);

    this.viz.lines.material.vertexColors = true;
  }

  updateInventoryCanvas() {
    if (!this.inventoryCtx) return;
    const ctx = this.inventoryCtx;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (this.inventoryImg && this.inventoryImg.complete) {
      const w = this.inventoryImg.width;   // 1595
      const h = this.inventoryImg.height;  // 200

      // centrado en X, alineado abajo en Y
      const x = (ctx.canvas.width - w) / 2;
      const y = ctx.canvas.height - h;

      ctx.drawImage(this.inventoryImg, x, y, w, h);
    }


    // Example: draw text
    ctx.fillStyle = "yellow";
    ctx.font = "20px monospace";
    ctx.fillText("Inventory HUD Active", 20, 40);
  }
}