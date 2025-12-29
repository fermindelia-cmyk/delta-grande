import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { versionInjectionPlugin } from './vite-plugin-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: '.', // Set root to the project directory
  base: './', // Use relative paths so `dist/` can be opened or hosted anywhere
  publicDir: 'assets', // Serve assets from the 'assets' folder
  plugins: [
    // Inject BUILD_VERSION into all files during dev and build
    versionInjectionPlugin(),
    // Copy additional static folders (game-assets, game/styles, service-worker) into `dist/`.
    viteStaticCopy({
      targets: [
        { src: 'game-assets', dest: '.' },
        { src: 'game/styles', dest: 'game' },
        { src: 'game/data', dest: 'game' },
        { src: 'game/core', dest: 'game' },
        { src: 'game/scenes', dest: 'game' },
        { src: 'game/ui', dest: 'game' },
        { src: 'game/utils', dest: 'game' },
        { src: 'game/main.js', dest: 'game' },
        { src: 'isla splat', dest: '.' }, // Supersplat viewer assets with space in folder name
        { src: 'service-worker.js', dest: '.' } // Copy service worker to root of dist
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        game: path.resolve(__dirname, 'game/index.html')
      }
    }
  },
  server: {
    open: true,
    headers: {
      // 'Cross-Origin-Opener-Policy': 'same-origin',
      // 'Cross-Origin-Embedder-Policy': 'require-corp',
      // Prevent caching of service worker during development
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  },
  preview: {
    headers: {
      // 'Cross-Origin-Opener-Policy': 'same-origin',
      // 'Cross-Origin-Embedder-Policy': 'require-corp',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  }
});
