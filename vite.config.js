import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: '.', // Set root to the project directory
  base: './', // Use relative paths so `dist/` can be opened or hosted anywhere
  publicDir: 'assets', // Serve assets from the 'assets' folder
  plugins: [
    // Copy additional static folders (game-assets, game/styles) into `dist/`.
    // `game-assets` will be available at `dist/game-assets/...` at runtime.
    viteStaticCopy({
      targets: [
        { src: 'game-assets', dest: '.' },
        { src: 'game/styles', dest: 'game/styles' }
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
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
