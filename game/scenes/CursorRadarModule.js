export class CursorRadarModule {
  constructor(params = {}) {
    this.params = {
      cursor: {
        src: '/game-assets/recorrido/interfaz/cursor.png',
        scale: 0.15,
        zIndex: 999999, // 👈 Very high z-index to stay above everything
        enabled: true,
        // anim: {
        //   dir: '/game-assets/recorrido/interfaz/cursor_animation',
        //   prefix: 'D+pre CURSOR_click_',
        //   pad: 5,
        //   startIndex: 163,
        //   maxFramesProbe: 1200
        // }
      },
      radar: {
        enabled: false, // Disabled - animations removed
        zIndex: 1000000,
        scale: 0.22,
        // anim: {
        //   dir: '/game-assets/recorrido/interfaz/radar_animation',
        //   prefix: 'D+_subacuatico_pre RADAR_V1_',
        //   pad: 5,
        //   startIndex: 1,
        //   maxFramesProbe: 1200
        // }
      },
      ...params
    };

    // Cursor state
    this.cursorEl = null;
    this._cursorAnim = {
      frames: [],
      playing: false,
      idx: 0
    };

    // Radar state  
    this._radarFrames = [];
    this._radars = []; // active radar instances
  }

  async init() {
    await this._createCursorOverlay();
    await this._preloadAnimations();
    this._bindEvents();
  }

  async _createCursorOverlay() {
    if (this.cursorEl) return;
    const C = this.params.cursor;

    // 👇 Hide system cursor globally
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';

    const img = document.createElement('img');
    img.id = 'cursor-overlay';
    img.src = C.src;
    Object.assign(img.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      transform: `translate(-50%, -50%) scale(${C.scale ?? 1.0})`,
      transformOrigin: '50% 50%',
      pointerEvents: 'none',
      zIndex: String(C.zIndex ?? 100000),
      userSelect: 'none',
      WebkitUserSelect: 'none',
      msUserSelect: 'none'
    });
    document.body.appendChild(img);
    this.cursorEl = img;

    // 👇 Add small white circle in center
    const dot = document.createElement('div');
    dot.id = 'cursor-center-dot';
    Object.assign(dot.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      backgroundColor: 'white',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: String((C.zIndex ?? 100000) + 1),
      userSelect: 'none',
      WebkitUserSelect: 'none',
      msUserSelect: 'none',
      boxShadow: '0 0 2px rgba(0,0,0,0.5)'
    });
    document.body.appendChild(dot);
    this.cursorDot = dot;
  }

  async _preloadAnimations() {
    const C = this.params.cursor?.anim;
    const R = this.params.radar?.anim;

    if (C) {
      this._cursorAnim.frames = await this._preloadFrameSequence(
        C.dir, C.prefix, C.pad, C.startIndex, C.maxFramesProbe
      );
    }

    if (this.params.radar?.enabled && R) {
      this._radarFrames = await this._preloadFrameSequence(
        R.dir, R.prefix, R.pad, R.startIndex, R.maxFramesProbe
      );
    }
  }

  async _preloadFrameSequence(dir, prefix, pad, startIndex, maxProbe = 1200) {
    const frames = [];
    const zeroPad = (n, w = 0) => String(n).padStart(Math.max(0, w), '0');
    const batchSize = 8;
    const firstIndex = Number.isFinite(startIndex) ? startIndex : 0;
    const maxAttempts = Math.max(0, maxProbe | 0);

    let nextIndex = firstIndex;
    let attempts = 0;
    let keepLoading = true;

    const loadSingle = (idx) => new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve({ ok: true, img: im, index: idx });
      im.onerror = () => resolve({ ok: false, index: idx });
      im.src = `${dir}/${prefix}${zeroPad(idx, pad)}.png`;
    });

    while (keepLoading && attempts < maxAttempts) {
      const batch = [];
      for (let b = 0; b < batchSize && attempts < maxAttempts; b++, attempts++) {
        batch.push(nextIndex++);
      }
      if (!batch.length) break;

      const results = await Promise.all(batch.map(loadSingle));
      for (const res of results) {
        if (res.ok) {
          frames.push(res.img);
        } else {
          keepLoading = false;
          if (frames.length === 0) {
            frames.length = 0;
          }
          break;
        }
      }

      if (!keepLoading) break;
    }

    return frames;
  }

  _bindEvents() {
    this._onMouseMove = (e) => {
      if (this.cursorEl) {
        this.cursorEl.style.left = `${e.clientX}px`;
        this.cursorEl.style.top = `${e.clientY}px`;
      }
      if (this.cursorDot) {
        this.cursorDot.style.left = `${e.clientX}px`;
        this.cursorDot.style.top = `${e.clientY}px`;
      }
    };

    document.addEventListener('mousemove', this._onMouseMove);
  }

  // Public API
  startCursorClick(clientX, clientY) {
    if (!this.cursorEl || !this._cursorAnim.frames?.length) return;

    this.cursorEl.style.left = `${clientX}px`;
    this.cursorEl.style.top = `${clientY}px`;

    if (this.cursorDot) {
      this.cursorDot.style.left = `${clientX}px`;
      this.cursorDot.style.top = `${clientY}px`;
    }

    this._cursorAnim.playing = true;
    this._cursorAnim.idx = 0;

    const frame0 = this._cursorAnim.frames[0];
    this.cursorEl.src = frame0.src;
  }

  playRadarAt(clientX, clientY) {
    if (!this.params.radar?.enabled) return;
    if (!this._radarFrames?.length) return;

    const el = this._createRadarElement(clientX, clientY);
    this._radars.push({
      frames: this._radarFrames,
      idx: 0,
      x: clientX,
      y: clientY,
      el
    });

    el.src = this._radarFrames[0].src;
  }

  _createRadarElement(x, y) {
    const R = this.params.radar;
    const el = document.createElement('img');
    el.src = (this._radarFrames && this._radarFrames[0]) ? this._radarFrames[0].src : '';
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      transform: `translate(-50%, -50%) scale(${R.scale ?? 1.0})`,
      transformOrigin: '50% 50%',
      pointerEvents: 'none',
      zIndex: String(R.zIndex ?? 100001),
      userSelect: 'none'
    });
    document.body.appendChild(el);
    return el;
  }

  update() {
    this._updateCursorAnim();
    this._updateRadars();
  }

  _updateCursorAnim() {
    const C = this.params.cursor;
    if (!this.cursorEl || !this._cursorAnim.playing) return;

    const frames = this._cursorAnim.frames;
    if (!frames?.length) {
      this._cursorAnim.playing = false;
      return;
    }

    this._cursorAnim.idx += 1;

    if (this._cursorAnim.idx >= frames.length) {
      this._cursorAnim.playing = false;
      this.cursorEl.src = C.src;
      return;
    }

    const im = frames[this._cursorAnim.idx];
    if (im) {
      this.cursorEl.src = im.src;
    }
  }

  _updateRadars() {
    if (!this._radars?.length) return;
    for (let i = this._radars.length - 1; i >= 0; i--) {
      const r = this._radars[i];
      r.idx += 1;
      if (r.idx >= r.frames.length) {
        r.el?.parentNode?.removeChild(r.el);
        this._radars.splice(i, 1);
        continue;
      }
      const im = r.frames[r.idx];
      if (im) r.el.src = im.src;
    }
  }

  destroy() {
    if (this._onMouseMove) {
      document.removeEventListener('mousemove', this._onMouseMove);
    }

    // 👇 Restore system cursor
    document.documentElement.style.cursor = '';
    document.body.style.cursor = '';

    if (this.cursorEl && this.cursorEl.parentNode) {
      this.cursorEl.parentNode.removeChild(this.cursorEl);
    }
    this.cursorEl = null;

    if (this.cursorDot && this.cursorDot.parentNode) {
      this.cursorDot.parentNode.removeChild(this.cursorDot);
    }
    this.cursorDot = null;

    this._radars.forEach(r => {
      if (r.el && r.el.parentNode) {
        r.el.parentNode.removeChild(r.el);
      }
    });
    this._radars.length = 0;
  }
}
