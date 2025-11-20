export const UI = new class{
  init({ app, videoOverlayEl, videoEl }){
    this.app = app;
    this.videoOverlayEl = videoOverlayEl;
    this.videoEl = videoEl;

    // Cerrar overlay al click “afuera” o con ESC
    this.videoOverlayEl.addEventListener('click', (e)=>{
      if (e.target === this.videoOverlayEl) this.hideVideo();
    });
    addEventListener('keydown', (e)=>{ if (e.key === 'Escape') this.hideVideo(); });
  }

  /**
   * Reproduce un video en overlay full-screen “cover”.
   * opts: { src, controls=false, muted=true, immersive=true, playbackRate=1, onended }
   */
  showVideo(opts = {}){
    const { src, controls=false, muted=true, immersive=true, playbackRate=1, onended } = opts;

    // Atributos y estilo para que no muestre controles y cubra pantalla
    this.videoEl.src = src || '';
    this.videoEl.controls = !!controls;
    this.videoEl.muted = !!muted;
    this.videoEl.playsInline = true;

    this.videoOverlayEl.style.display = 'block';
    this.videoEl.playbackRate = playbackRate || 1;

    const done = () => {
      this.videoEl.onended = null;
      try { this.videoEl.pause(); } catch {}

      let awaitable = null;
      if (typeof onended === 'function') {
        try {
          awaitable = onended({ video: this.videoEl, overlay: this.videoOverlayEl });
        } catch { awaitable = null; }
      }

      const finalize = () => { this.hideVideo(); };

      if (awaitable && typeof awaitable.then === 'function') {
        return awaitable.catch(()=>{}).finally(finalize);
      }

      finalize();
      return undefined;
    };

    this.videoEl.onended = () => {
      const res = done();
      if (res && typeof res.then === 'function') {
        res.catch(()=>{});
      }
    };

    const playbackReady = new Promise((resolve) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const cleanup = () => {
        this.videoEl.removeEventListener('playing', onReady);
        this.videoEl.removeEventListener('canplay', onReady);
        if (fallbackTimer !== null) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };

      let fallbackTimer = setTimeout(() => {
        cleanup();
        resolve();
      }, 500);

      if (!this.videoEl.paused && this.videoEl.readyState >= 2) {
        cleanup();
        resolve();
        return;
      }

      this.videoEl.addEventListener('playing', onReady, { once: true });
      this.videoEl.addEventListener('canplay', onReady, { once: true });
    });

    let playPromise = this.videoEl.play();
    if (!(playPromise && typeof playPromise.then === 'function')) {
      playPromise = Promise.resolve();
    } else {
      playPromise = playPromise.catch(()=>{});
    }

    // Intento opcional de fullscreen nativo (ignora si falla/iOS)
    if (immersive && this.videoOverlayEl.requestFullscreen) {
      this.videoOverlayEl.requestFullscreen().catch(()=>{});
    }

    return Promise.all([playPromise, playbackReady]).then(() => this.videoEl);
  }

  hideVideo(){
    try { this.videoEl.pause(); } catch {}
    // restaurar playbackRate por si se modificó
    try { this.videoEl.playbackRate = 1; } catch {}
    this.videoOverlayEl.style.display = 'none';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(()=>{});
    }
  }
}();
