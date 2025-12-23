# Offline Manifest System

## Overview
The offline functionality uses a comprehensive manifest system that automatically includes all necessary assets for the game to run completely offline.

## How It Works

### 1. **Offline Manifest Generation**
The `generate_offline_manifest.js` script scans the entire project and creates `offline-manifest.json` with all required files.

**Included file types:**
- `.webm` - Video files
- `.webp` - Image files (WebP format)
- `.ogg` - Audio files (Ogg format)
- `.mp3` - Audio files (MP3 format)
- `.png`, `.jpg`, `.jpeg` - Image files
- `.js` - JavaScript files
- `.css` - Stylesheets
- `.html` - HTML pages
- `.glb` - 3D models (GLB format)
- `.ply` - 3D models (PLY format)
- `.json` - Data files

**Excluded folders/patterns:**
- `node_modules/` - Dependencies (not needed for runtime)
- `.git/` - Version control
- `dist/` - Build output
- `tools/` - Development tools
- `bak/`, `_backup/` - Backup folders
- `old/`, `_old`, `_old_data_files/` - Old/deprecated files
- `originals/` - Original source files
- `hd/` - HD versions (if lower quality versions exist)

### 2. **Service Worker Integration**
The `service-worker.js` loads the manifest and caches files when the user clicks "Guardar Offline".

**Filtering:** The service worker applies additional filtering using the `shouldExclude()` function to ensure no backup or old files are cached.

### 3. **Current Statistics**
As of the last generation:
- **Total files:** 1,395
- **Breakdown:**
  - CSS: 1
  - GLB (3D models): 22
  - HTML: 7
  - JPG: 7
  - JS: 37
  - JSON: 141
  - MP3: 68
  - OGG: 1
  - PLY: 1
  - PNG: 843
  - WebM: 91
  - WebP: 174
  - Other: 2

## Usage

### Regenerating the Manifest
When you add new assets or modify the project structure, regenerate the manifest:

```bash
npm run generate-manifest
```

Or directly:
```bash
node generate_offline_manifest.js
```

### Checking What Will Be Downloaded
To see exactly what files will be cached for offline use:

1. Open `offline-manifest.json` in the project root
2. All listed files will be downloaded when "Guardar Offline" is clicked
3. Files matching exclusion patterns are automatically filtered out

### Verifying Offline Functionality
1. Click "Guardar Offline" button in the app
2. The service worker will download all files from the manifest
3. Progress messages are sent to the UI
4. Once complete, the app can run fully offline

## Maintenance

### Adding New Asset Types
Edit `generate_offline_manifest.js` and add the extension to `ASSET_EXTENSIONS`:

```javascript
const ASSET_EXTENSIONS = new Set([
  '.webm', '.webp', '.ogg', '.mp3', '.png', '.jpg', '.jpeg',
  '.js', '.css', '.html', '.glb', '.ply', '.json',
  '.your-new-extension'  // Add here
]);
```

### Excluding Additional Patterns
Edit both `generate_offline_manifest.js` and `service-worker.js`:

```javascript
const EXCLUDE_PATTERNS = [
  '_old', '/dist/', '/.git/', '/node_modules/',
  '/bak/', '/_backup/', '/old/', '/originals/', 
  '/hd/', '_old_data_files',
  '/your-pattern/'  // Add here
];
```

## Files Modified
- `service-worker.js` - Updated to use manifest and improved filtering
- `offline-manifest.json` - Generated list of all cacheable files
- `generate_offline_manifest.js` - Script to generate the manifest
- `package.json` - Added `generate-manifest` script
