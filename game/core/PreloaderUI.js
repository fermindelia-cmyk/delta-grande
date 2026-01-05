import { AudioManager } from './AudioManager.js';

export class PreloaderUI {
    constructor() {
        this.createPreloaderDOM();
        this.totalAssets = 0;
        this.loadedAssets = 0;
    }

    createPreloaderDOM() {
        // Crear contenedor principal
        this.container = document.createElement('div');
        this.container.className = 'preloader-container';
        this.container.innerHTML = `
            <div class="preloader-content">
                <div class="preloader-logo">
                    <h1>DELTA+</h1>
                    <p>Cargando experiencia interactiva...</p>
                </div>
                
                <div class="preloader-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <div class="progress-text">
                        <span id="progress-percentage">0%</span>
                        <span id="progress-status">Preparando...</span>
                    </div>
                </div>
                
                <div class="preloader-details">
                    <span id="current-file">Iniciando carga de assets...</span>
                </div>

            </div>
        `;

        // Agregar estilos
        this.addStyles();
        
        // Agregar al DOM
        document.body.appendChild(this.container);

            // Note: audio enable button moved to index.html (global). Preloader no longer provides it.
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .preloader-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                height: 100dvh;
                background: linear-gradient(135deg, #0d0f12 0%, #1a1f26 100%);
                color: #eef2f6;
                font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 1;
                transition: opacity 0.5s ease;
            }

            .preloader-content {
                text-align: center;
                max-width: 600px;
                padding: 2rem;
            }

            .preloader-logo h1 {
                font-size: 4rem;
                font-weight: bold;
                color: #35c9a5;
                margin: 0 0 1rem 0;
                text-shadow: 0 0 20px rgba(53, 201, 165, 0.3);
                animation: pulse 2s ease-in-out infinite;
            }

            .preloader-logo p {
                font-size: 1.2rem;
                color: #94a3b8;
                margin: 0 0 3rem 0;
            }

            .progress-bar-container {
                width: 100%;
                height: 6px;
                background: rgba(148, 163, 184, 0.2);
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 1rem;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #35c9a5, #4ade80);
                border-radius: 3px;
                width: 0%;
                transition: width 0.3s ease;
                box-shadow: 0 0 10px rgba(53, 201, 165, 0.5);
            }

            .progress-text {
                display: flex;
                justify-content: space-between;
                font-size: 1rem;
                margin-bottom: 2rem;
            }

            #progress-percentage {
                color: #35c9a5;
                font-weight: bold;
            }

            #progress-status {
                color: #94a3b8;
            }

            .preloader-details {
                font-size: 0.9rem;
                color: #64748b;
                opacity: 0.8;
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.05); opacity: 0.9; }
            }

            .preloader-container.fade-out {
                opacity: 0;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    setTotalAssets(total) {
        this.totalAssets = total;
    }

    updateProgress(loadedCount, currentFile = '') {
        this.loadedAssets = loadedCount;
        const percentage = Math.round((this.loadedAssets / this.totalAssets) * 100);
        
        // Actualizar barra de progreso
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');
        const currentFileElement = document.getElementById('current-file');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
        if (currentFileElement) currentFileElement.textContent = currentFile;

        // Actualizar estado
        if (progressStatus) {
            if (percentage < 30) {
                progressStatus.textContent = 'Cargando modelos 3D...';
            } else if (percentage < 60) {
                progressStatus.textContent = 'Cargando videos...';
            } else if (percentage < 90) {
                progressStatus.textContent = 'Cargando audio...';
            } else if (percentage < 100) {
                progressStatus.textContent = 'Finalizando...';
            } else {
                progressStatus.textContent = '¡Listo para jugar!';
            }
        }
    }

    hide() {
        return new Promise((resolve) => {
            this.container.classList.add('fade-out');
            setTimeout(() => {
                if (this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                resolve();
            }, 500);
        });
    }
}