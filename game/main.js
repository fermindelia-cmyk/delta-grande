import { App } from './core/App.js';
import { Router } from './core/Router.js';
import { SceneManager } from './core/SceneManager.js';
import { EventBus } from './core/EventBus.js';
import { State } from './core/State.js';
import { UI } from './core/UI.js';


import { MenuScene } from './scenes/MenuScene.js';
import { LabScene } from './scenes/LabScene.js';
import { InstruccionesTransitionScene } from './scenes/InstruccionesTransitionScene.js';
import { RecorridoTransitionScene } from './scenes/RecorridoTransitionScene.js';
import { SubacuaticoTransitionScene } from './scenes/SubacuaticoTransitionScene.js';
import { RecorridoScene } from './scenes/RecorridoScene.js';
import { SimuladorScene } from './scenes/SimuladorScene.js';
import { RioScene } from './scenes/RioScene.js';


// App singleton
const app = new App('#app');


// UI overlays (hud)
UI.init({
  app,
  videoOverlayEl: document.getElementById('videoOverlay'),
  videoEl: document.getElementById('labVideo')
});


// Global router + scenes
const scenes = {
menu: () => new MenuScene(app),
lab: () => new LabScene(app),
'instrucciones-transition': () => new InstruccionesTransitionScene(app),
'recorrido-transition': () => new RecorridoTransitionScene(app),
'subacuatico-transition': () => new SubacuaticoTransitionScene(app),
recorrido: () => new RecorridoScene(app),
simulador: () => new SimuladorScene(app),
rio: () => new RioScene(app)
};


const sceneManager = new SceneManager(app, scenes);
const router = new Router({
onRoute: (route) => {
const name = route.replace(/^#/, '') || 'menu';
sceneManager.goTo(name);
}
});


// Topbar buttons navigation
for (const btn of document.querySelectorAll('[data-nav]')) {
btn.addEventListener('click', () => router.navigate(btn.dataset.nav));
}

// Menu button navigation
const menuButton = document.getElementById('menuButton');
if (menuButton) {
  menuButton.addEventListener('click', () => {
    router.navigate('#menu');
  });
}


const pauseOverlay = document.getElementById('pauseOverlay');
const mainMenuOverlay = document.getElementById('mainMenuOverlay');

const pauseButtons = {
resume: pauseOverlay?.querySelector('[data-action="resume"]'),
restart: pauseOverlay?.querySelector('[data-action="restart"]'),
exit: pauseOverlay?.querySelector('[data-action="exit"]')
};

const mainButtons = {
continue: mainMenuOverlay?.querySelector('[data-action="continue"]'),
new: mainMenuOverlay?.querySelector('[data-action="new"]'),
options: mainMenuOverlay?.querySelector('[data-action="options"]'),
quit: mainMenuOverlay?.querySelector('[data-action="quit"]')
};

const setOverlayVisible = (overlay, visible) => {
if (!overlay) return;
overlay.classList.toggle('is-visible', visible);
overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
};

const updateContinueAvailability = () => {
if (!mainButtons.continue) return;
const canContinue = !!sceneManager.currentName;
mainButtons.continue.disabled = !canContinue;
mainButtons.continue.setAttribute('aria-disabled', canContinue ? 'false' : 'true');
};

const showPauseMenu = () => {
if (!pauseOverlay || !mainMenuOverlay) return;
if (mainMenuOverlay.classList.contains('is-visible')) return;
setOverlayVisible(pauseOverlay, true);
app.pause();
};

const hidePauseMenu = ({ keepPaused = false } = {}) => {
if (!pauseOverlay) return;
setOverlayVisible(pauseOverlay, false);
if (!keepPaused && !mainMenuOverlay?.classList.contains('is-visible')) {
app.resume();
}
};

const showMainMenu = () => {
if (!mainMenuOverlay) return;
setOverlayVisible(pauseOverlay, false);
setOverlayVisible(mainMenuOverlay, true);
app.pause();
updateContinueAvailability();
};

const hideMainMenu = () => {
if (!mainMenuOverlay) return;
setOverlayVisible(mainMenuOverlay, false);
if (!pauseOverlay?.classList.contains('is-visible')) {
app.resume();
}
};

pauseButtons.resume?.addEventListener('click', () => hidePauseMenu());

pauseButtons.restart?.addEventListener('click', async () => {
  if (!sceneManager.currentName) return;
  
  // Si estamos en RecorridoScene, reiniciar la ronda actual
  if (sceneManager.currentName === 'recorrido') {
    const recorridoScene = sceneManager.instance;
    if (recorridoScene && recorridoScene.speciesManager) {
      console.log('🔄 Reiniciando ronda actual...');
      
      // Borrar progreso de la ronda actual (especies encontradas)
      recorridoScene.speciesManager.clearCurrentRoundProgress();
      
      // Calcular el índice de escena para el ambiente 1 de la ronda actual
      // Las 6 escenas se reciclan: Ronda 1 = escenas 0-5, Ronda 2 = escenas 0-5, etc.
      const sceneIndex = 0; // Ambiente 1 siempre es escena 0 (dentro de cualquier ronda)
      
      // Recargar la escena 0 (ambiente 1)
      await recorridoScene.loadStage(sceneIndex);
      
      console.log('✅ Reinicio completado - Volviendo al inicio de la ronda');
    }
  } else {
    // Para otras escenas, simplemente recargar
    await sceneManager.goTo(sceneManager.currentName);
  }
  
  hidePauseMenu();
});

pauseButtons.exit?.addEventListener('click', () => {
  hidePauseMenu({ keepPaused: false });
  router.navigate('#menu');
});

mainButtons.continue?.addEventListener('click', () => {
if (!sceneManager.currentName) return;
hideMainMenu();
});

mainButtons.new?.addEventListener('click', async () => {
  if (confirm('¿Estás seguro de que quieres comenzar de nuevo? Se borrará todo tu progreso.')) {
    // Clear SpeciesManager progress
    localStorage.removeItem('deltaPlus.speciesProgress.v1');
    
    // Reset game state but keep hasSeenIntro=true (skip full intro, show only logo)
    State.resetProgress();
    
    console.log('✅ Progreso borrado. Iniciando nuevo juego...');
    
    // Navigate to MenuScene (solo logo-naranja.webm)
    hideMainMenu();
    router.navigate('#menu');
    
    // Reload to ensure clean state
    setTimeout(() => location.reload(), 100);
  }
});

mainButtons.options?.addEventListener('click', () => {
alert('Opciones disponibles próximamente.');
});

mainButtons.quit?.addEventListener('click', () => {
window.location.href = '../index.html';
});

addEventListener('keydown', (event) => {
if (event.key !== 'Escape') return;
if (UI.videoOverlayEl && UI.videoOverlayEl.style.display !== 'none') return;
if (!pauseOverlay || !mainMenuOverlay) return;
if (mainMenuOverlay.classList.contains('is-visible')) return;
if (pauseOverlay.classList.contains('is-visible')) {
hidePauseMenu();
} else {
showPauseMenu();
}
});


// Initialize everything
async function startApp() {
  // Start the application
  app.start();
  router.boot(); // reads current hash and triggers first scene

  // 🎬 Ir a menu principal si no hay hash especificado
  if (!location.hash || location.hash === '#') {
    location.hash = '#menu';
  }

  EventBus.on('scene:changed', updateContinueAvailability);
}

// Start the application
startApp();


// 🔄 Global functions for resetting game progress
window.resetearProgreso = () => {
  if (confirm('¿Estás seguro de que quieres borrar todo el progreso y volver al inicio? Esta acción no se puede deshacer.')) {
    // Clear all localStorage data
    State.resetAll();
    
    // Clear SpeciesManager progress
    localStorage.removeItem('deltaPlus.speciesProgress.v1');
    
    console.log('✅ Progreso borrado. Recargando página...');
    
    // Reload page to start fresh
    location.hash = '#menu';
    location.reload();
  }
};

window.volverAlInicio = () => {
  console.log('🔄 Volviendo al menú inicial...');
  location.hash = '#menu';
};

console.log('═══════════════════════════════════════════════════');
console.log('🎮 COMANDOS GLOBALES DISPONIBLES:');
console.log('═══════════════════════════════════════════════════');
console.log('  resetearProgreso() - Borrar TODO el progreso y volver al inicio');
console.log('  volverAlInicio() - Ir al menú inicial (sin borrar progreso)');
console.log('═══════════════════════════════════════════════════');
