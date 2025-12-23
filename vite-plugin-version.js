// vite-plugin-version.js
// Vite plugin to inject BUILD_VERSION during both dev and build

import fs from 'fs';
import path from 'path';

export function versionInjectionPlugin() {
  // Generate version once when plugin is created
  const BUILD_VERSION = process.env.NODE_ENV === 'production' 
    ? `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    : 'dev-mode';

  console.log(`[Version Plugin] Mode: ${process.env.NODE_ENV || 'development'}, Version: ${BUILD_VERSION}`);

  return {
    name: 'version-injection',
    
    // Transform source code during serve (dev) and build
    transform(code, id) {
      // Only process HTML and JS files that contain the placeholder
      if ((id.endsWith('.html') || id.endsWith('.js')) && code.includes('__BUILD_VERSION__')) {
        // Replace all occurrences of __BUILD_VERSION__ with actual version
        const transformed = code.replace(/__BUILD_VERSION__/g, BUILD_VERSION);
        return {
          code: transformed,
          map: null
        };
      }
      return null;
    },
    
    // Also handle the service worker file which is copied, not transformed
    transformIndexHtml(html) {
      return html.replace(/__BUILD_VERSION__/g, BUILD_VERSION);
    },
    
    // Handle service worker after vite-plugin-static-copy runs
    closeBundle() {
      const swPath = path.resolve('dist/service-worker.js');
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf8');
        if (content.includes('__BUILD_VERSION__')) {
          content = content.replace(/__BUILD_VERSION__/g, BUILD_VERSION);
          fs.writeFileSync(swPath, content, 'utf8');
          console.log(`[Version Plugin] Injected ${BUILD_VERSION} into service-worker.js`);
        }
      }
    }
  };
}
