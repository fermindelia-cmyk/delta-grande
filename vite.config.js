import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.', // Set root to the project directory
  base: './', // Use relative paths for assets
  publicDir: 'assets', // Serve assets from the 'assets' folder
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
    open: true
  }
});
