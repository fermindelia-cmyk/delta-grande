// inject-version.js
// Build script that injects a unique BUILD_VERSION into service worker and HTML files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate unique version based on timestamp + random
const BUILD_VERSION = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

console.log(`\n🔄 Injecting BUILD_VERSION: ${BUILD_VERSION}\n`);

const filesToProcess = [
  { path: 'dist/service-worker.js', name: 'Service Worker' },
  { path: 'dist/game/index.html', name: 'Game HTML' },
  { path: 'dist/index.html', name: 'Main HTML' }
];

let processedCount = 0;
let errorCount = 0;

for (const file of filesToProcess) {
  const filePath = path.join(__dirname, file.path);
  
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Replace all occurrences of __BUILD_VERSION__ with actual version
      content = content.replace(/__BUILD_VERSION__/g, BUILD_VERSION);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${file.name}: ${file.path}`);
        processedCount++;
      } else {
        console.log(`⚠️  ${file.name}: No __BUILD_VERSION__ placeholder found in ${file.path}`);
      }
    } else {
      console.log(`⚠️  ${file.name}: File not found at ${file.path}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file.name}:`, error.message);
    errorCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Processed: ${processedCount} files`);
console.log(`   Errors: ${errorCount}`);
console.log(`   Version: ${BUILD_VERSION}\n`);

if (errorCount > 0) {
  process.exit(1);
}
