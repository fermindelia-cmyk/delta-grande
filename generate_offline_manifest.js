#!/usr/bin/env node
/**
 * Generate offline-manifest.json for service worker caching.
 * Includes all assets needed for offline functionality.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extensions to include in the offline manifest
const ASSET_EXTENSIONS = new Set([
    '.webm', '.webp', '.ogg', '.mp3', '.png', '.jpg', '.jpeg',
    '.js', '.css', '.html', '.glb', '.ply', '.json'
]);

// Directories to exclude
const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', '__pycache__', 'dist',
    '.antigravity', 'tools', 'bak', '_backup',
    'old', 'originals', 'hd', '_old_data_files'
]);

// Patterns to exclude from paths
const EXCLUDE_PATTERNS = [
    '_old', '/dist/', '/.git/', '/node_modules/',
    '/bak/', '/_backup/', '/old/', '/originals/',
    '/hd/', '_old_data_files'
];

function shouldExclude(pathStr) {
    return EXCLUDE_PATTERNS.some(pattern => pathStr.includes(pattern));
}

function collectAssets(dir, baseDir = dir, assets = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry.name)) {
                continue;
            }
            collectAssets(fullPath, baseDir, assets);
        } else {
            // Check if file has a relevant extension
            const ext = path.extname(entry.name).toLowerCase();
            if (ASSET_EXTENSIONS.has(ext)) {
                // Get relative path from base directory
                const relPath = path.relative(baseDir, fullPath);
                let urlPath = '/' + relPath.replace(/\\/g, '/');

                // Skip excluded patterns
                if (shouldExclude(urlPath)) {
                    continue;
                }

                // URL encode special characters (spaces, etc.) but keep slashes
                const parts = urlPath.split('/');
                const encodedParts = parts.map(part => encodeURIComponent(part));
                const encodedUrl = encodedParts.join('/');

                assets.push(encodedUrl);
            }
        }
    }

    return assets;
}

function generateManifest() {
    const rootDir = __dirname;
    const outputFile = path.join(rootDir, 'offline-manifest.json');

    // Core files that must be included
    const coreFiles = [
        '/',
        '/index.html',
        '/game/index.html',
        '/game/',
        '/game/main.js',
        '/game/styles/sub/deck-style.css',
    ];

    console.log('Collecting assets...');
    const assets = collectAssets(rootDir);

    // Combine core files with assets
    let allFiles = [...coreFiles, ...assets];

    // Remove duplicates and sort
    allFiles = [...new Set(allFiles)].sort();

    // Filter out excluded patterns one more time
    allFiles = allFiles.filter(f => !shouldExclude(f));

    // Write to JSON file
    fs.writeFileSync(outputFile, JSON.stringify(allFiles, null, 2), 'utf-8');

    console.log(`✓ Generated ${outputFile}`);
    console.log(`✓ Total files: ${allFiles.length}`);

    // Print summary by extension
    const extensions = {};
    for (const file of allFiles) {
        const ext = path.extname(file).toLowerCase() || 'no-ext';
        extensions[ext] = (extensions[ext] || 0) + 1;
    }

    console.log('\nFiles by type:');
    Object.entries(extensions)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([ext, count]) => {
            console.log(`  ${ext}: ${count}`);
        });
}

generateManifest();
