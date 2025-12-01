(() => {
  const defaultConfig = {
    space: {
      heightVh: 1.0,
      marginLeftVh: 0.0,
      marginTopVh: 0.0,
      marginRightVh: 0.0,
      marginBottomVh: 0.0,
      designHeightPx: 1080,
      designWidthPx: 1920,
      widthToHeight: null,
      scaleMultiplier: 1.0
    },
    speciesName: {
      position: { xPct: 0.15, yPct: 0.18 },
      widthPct: 0.2
    },
    speciesImage: {
      offsetPct: { x: 0.08, y: 0.015 },
      widthPct: 0.26
    },
    speciesInfo: {
      offsetPct: { x: 0.28, y: 0.25 },
      widthPct: 0.2,
      textBox: { xPct: 0.17, yPct: 0.14, wPct: 0.7, hPct: 0.72 }
    }
  };

  const els = {
    viewportWidth: document.getElementById('viewportWidth'),
    viewportHeight: document.getElementById('viewportHeight'),
    nameAspect: document.getElementById('nameAspect'),
    imageAspect: document.getElementById('imageAspect'),
    infoAspect: document.getElementById('infoAspect'),
    configInput: document.getElementById('configInput'),
    status: document.getElementById('statusLine'),
    previewScale: document.getElementById('previewScale'),
    viewportWrapper: document.getElementById('viewportWrapper'),
    viewport: document.getElementById('viewport'),
    spaceLayer: document.getElementById('spaceLayer'),
    nameBox: document.getElementById('nameBox'),
    imageBox: document.getElementById('imageBox'),
    infoBox: document.getElementById('infoBox'),
    infoTextBox: document.getElementById('infoTextBox'),
    metricsOutput: document.getElementById('metricsOutput')
  };

  const state = {
    viewportWidth: 1920,
    viewportHeight: 1080,
    aspects: {
      name: 2.4,
      image: 1.3,
      info: 0.65
    },
    config: defaultConfig
  };

  els.configInput.value = JSON.stringify(defaultConfig, null, 2);

  els.viewportWidth.addEventListener('input', () => {
    state.viewportWidth = clampNumber(parseFloat(els.viewportWidth.value) || 1920, 320, 6400);
    els.viewportWidth.value = state.viewportWidth;
    render();
  });

  els.viewportHeight.addEventListener('input', () => {
    state.viewportHeight = clampNumber(parseFloat(els.viewportHeight.value) || 1080, 320, 3600);
    els.viewportHeight.value = state.viewportHeight;
    render();
  });

  els.nameAspect.addEventListener('input', () => {
    state.aspects.name = clampNumber(parseFloat(els.nameAspect.value) || 1, 0.2, 8);
    els.nameAspect.value = state.aspects.name;
    render();
  });

  els.imageAspect.addEventListener('input', () => {
    state.aspects.image = clampNumber(parseFloat(els.imageAspect.value) || 1, 0.2, 8);
    els.imageAspect.value = state.aspects.image;
    render();
  });

  els.infoAspect.addEventListener('input', () => {
    state.aspects.info = clampNumber(parseFloat(els.infoAspect.value) || 1, 0.2, 8);
    els.infoAspect.value = state.aspects.info;
    render();
  });

  let configDebounce;
  els.configInput.addEventListener('input', () => {
    clearTimeout(configDebounce);
    configDebounce = setTimeout(() => {
      try {
        const parsed = JSON.parse(els.configInput.value);
        state.config = parsed;
        els.configInput.classList.remove('error');
        els.status.textContent = 'Config parsed.';
        els.status.classList.remove('error');
        render();
      } catch (err) {
        els.configInput.classList.add('error');
        els.status.textContent = `JSON error: ${err.message}`;
        els.status.classList.add('error');
      }
    }, 200);
  });

  function render() {
    let layout;
    try {
      layout = computeLayout(state.config, state.viewportWidth, state.viewportHeight, state.aspects);
      updatePreview(layout);
      updateMetrics(layout);
      els.status.textContent = 'Ready.';
      els.status.classList.remove('error');
    } catch (err) {
      els.status.textContent = `Layout error: ${err.message}`;
      els.status.classList.add('error');
    }
  }

  function computeLayout(config, viewportWidth, viewportHeight, aspects) {
    if (!config || !config.space) throw new Error('Missing space configuration');
    const vh = Math.max(1, viewportHeight);
    const vw = Math.max(1, viewportWidth);
    const spaceCfg = config.space;

    const marginLeft = Math.max(0, (spaceCfg.marginLeftVh ?? 0) * vh);
    const marginRight = Math.max(0, (spaceCfg.marginRightVh ?? 0) * vh);
    const marginTop = Math.max(0, (spaceCfg.marginTopVh ?? 0) * vh);
    const marginBottom = Math.max(0, (spaceCfg.marginBottomVh ?? 0) * vh);

    const availableHeight = Math.max(1, vh - marginTop - marginBottom);
    const availableWidth = Math.max(1, vw - marginLeft - marginRight);

    const designHeight = spaceCfg.designHeightPx || 1080;
    let designWidth = spaceCfg.designWidthPx;
    if (!Number.isFinite(designWidth) || designWidth <= 0) {
      let ratio = spaceCfg.widthToHeight;
      if (!Number.isFinite(ratio) || ratio <= 0) ratio = 0.62;
      designWidth = designHeight * ratio;
    }

    const targetHeight = Math.min(availableHeight, Math.max(1, (spaceCfg.heightVh ?? 1) * vh));
    let baseScale = targetHeight / designHeight;
    if (!Number.isFinite(baseScale) || baseScale <= 0) baseScale = 1;

    let scaleMultiplier = spaceCfg.scaleMultiplier;
    if (!Number.isFinite(scaleMultiplier) || scaleMultiplier <= 0) scaleMultiplier = 1;
    const layoutScale = baseScale * scaleMultiplier;

    const scaledWidth = designWidth * layoutScale;
    const scaledHeight = designHeight * layoutScale;
    const spaceLeft = marginLeft;
    const spaceTop = marginTop;

    const metrics = {
      designWidth,
      designHeight,
      left: spaceLeft,
      top: spaceTop,
      scale: layoutScale,
      scaledWidth,
      scaledHeight
    };

    const nameDesign = computeNameRect(config.speciesName || {}, designWidth, designHeight, aspects.name || 1);
    const imageDesign = computeImageRect(config.speciesImage || {}, designWidth, designHeight, nameDesign, aspects.image || 1);
    const infoDesign = computeInfoRect(config.speciesInfo || {}, designWidth, designHeight, nameDesign, aspects.info || 1);

    return {
      viewport: { width: vw, height: vh },
      space: metrics,
      components: {
        name: decorateRect(nameDesign, metrics),
        image: decorateRect(imageDesign, metrics),
        info: decorateRect(infoDesign, metrics)
      }
    };
  }

  function computeNameRect(cfg, designWidth, designHeight, aspect) {
    const width = Math.max(1, (cfg.widthPct ?? 0.3) * designWidth);
    const height = Math.max(1, width / Math.max(0.01, aspect));
    const left = (cfg.position?.xPct ?? 0) * designWidth;
    const top = (cfg.position?.yPct ?? 0) * designHeight;
    return { left, top, width, height };
  }

  function computeImageRect(cfg, designWidth, designHeight, nameRect, aspect) {
    const base = nameRect || { left: 0, top: 0 };
    const width = Math.max(1, (cfg.widthPct ?? 0.24) * designWidth);
    const height = Math.max(1, width / Math.max(0.01, aspect));
    const left = base.left + (cfg.offsetPct?.x ?? 0) * designWidth;
    const top = base.top + (cfg.offsetPct?.y ?? 0) * designHeight;
    return { left, top, width, height };
  }

  function computeInfoRect(cfg, designWidth, designHeight, nameRect, aspect) {
    const base = nameRect || { left: 0, top: 0 };
    const width = Math.max(1, (cfg.widthPct ?? 0.3) * designWidth);
    const height = Math.max(1, width / Math.max(0.01, aspect));
    const left = base.left + (cfg.offsetPct?.x ?? 0) * designWidth;
    const top = base.top + (cfg.offsetPct?.y ?? 0) * designHeight;
    const textBox = cfg.textBox || { xPct: 0.1, yPct: 0.2, wPct: 0.8, hPct: 0.7 };
    const textRect = {
      left: left + textBox.xPct * width,
      top: top + textBox.yPct * height,
      width: Math.max(1, textBox.wPct * width),
      height: Math.max(1, textBox.hPct * height)
    };
    return { left, top, width, height, textRect };
  }

  function decorateRect(designRect, metrics) {
    const scale = metrics.scale;
    const screenRect = {
      left: metrics.left + designRect.left * scale,
      top: metrics.top + designRect.top * scale,
      width: designRect.width * scale,
      height: designRect.height * scale
    };
    const textRect = designRect.textRect
      ? {
          left: designRect.textRect.left * scale,
          top: designRect.textRect.top * scale,
          width: designRect.textRect.width * scale,
          height: designRect.textRect.height * scale
        }
      : null;
    return {
      design: designRect,
      screen: screenRect,
      textRect: textRect
    };
  }

  function updatePreview(layout) {
    const maxWidth = els.viewportWrapper.clientWidth;
    const maxHeight = els.viewportWrapper.clientHeight;
    const scale = Math.min(1, maxWidth / layout.viewport.width, maxHeight / layout.viewport.height);

    els.viewport.style.width = `${layout.viewport.width}px`;
    els.viewport.style.height = `${layout.viewport.height}px`;
    els.viewport.style.transform = `scale(${scale})`;
    els.previewScale.textContent = `Preview scale: ${(scale * 100).toFixed(0)}%`;

    setBox(els.spaceLayer, {
      left: layout.space.left,
      top: layout.space.top,
      width: layout.space.scaledWidth,
      height: layout.space.scaledHeight
    });

    setBox(els.nameBox, layout.components.name.screen);
    setBox(els.imageBox, layout.components.image.screen);
    setBox(els.infoBox, layout.components.info.screen);

    const textRect = layout.components.info.design.textRect;
    if (textRect) {
      setBox(els.infoTextBox, {
        left: textRect.left * layout.space.scale,
        top: textRect.top * layout.space.scale,
        width: textRect.width * layout.space.scale,
        height: textRect.height * layout.space.scale
      });
    }
  }

  function updateMetrics(layout) {
    const lines = [];
    lines.push(`Viewport: ${layout.viewport.width} × ${layout.viewport.height}`);
    lines.push(`Space: left=${layout.space.left.toFixed(1)} top=${layout.space.top.toFixed(1)} width=${layout.space.scaledWidth.toFixed(1)} height=${layout.space.scaledHeight.toFixed(1)} scale=${layout.space.scale.toFixed(3)}`);
    const components = layout.components;
    ['name', 'image', 'info'].forEach((key) => {
      const rect = components[key]?.screen;
      if (!rect) return;
      lines.push(`${key}: left=${rect.left.toFixed(1)} top=${rect.top.toFixed(1)} width=${rect.width.toFixed(1)} height=${rect.height.toFixed(1)}`);
    });
    const textRect = components.info?.design?.textRect;
    if (textRect) {
      lines.push(`info.textBox (design): left=${textRect.left.toFixed(1)} top=${textRect.top.toFixed(1)} width=${textRect.width.toFixed(1)} height=${textRect.height.toFixed(1)}`);
    }
    els.metricsOutput.textContent = lines.join('\n');
  }

  function setBox(el, rect) {
    if (!el || !rect) return;
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  render();
})();
