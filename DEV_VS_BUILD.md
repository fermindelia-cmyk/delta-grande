# Cache Busting: Dev vs Build Modes

## How It Works Now

### ✅ Development Mode (`npm run dev`)
- **Version**: `dev-mode` (constant)
- **Cache name**: `delta-grande-dev-mode`
- **Behavior**: 
  - No cache clearing on reload
  - Consistent cache for faster development
  - Service worker still works for offline testing
  - Version stays constant during dev session

### ✅ Production Build (`npm run build`)
- **Version**: `v1766256002125-ihsx8ww` (unique per build)
- **Cache name**: `delta-grande-v1766256002125-ihsx8ww`
- **Behavior**:
  - New version on every build
  - Automatic cache clearing on deployment
  - Forces users to get fresh content

## Implementation Details

### Vite Plugin (vite-plugin-version.js)
The custom Vite plugin handles version injection for **both** dev and build:

```javascript
const BUILD_VERSION = process.env.NODE_ENV === 'production' 
  ? `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  : 'dev-mode';
```

**During Development:**
- Plugin transforms code in real-time as you browse
- Replaces `__BUILD_VERSION__` → `dev-mode`
- Service worker gets consistent version
- No cache churn

**During Build:**
- Plugin generates unique version
- Transforms all files during bundling
- Handles service-worker.js after it's copied
- Logs version for verification

### What Gets Transformed

1. **game/index.html**
   - `const APP_VERSION = '__BUILD_VERSION__'` → `const APP_VERSION = 'dev-mode'`

2. **index.html**
   - `const APP_VERSION = '__BUILD_VERSION__'` → `const APP_VERSION = 'dev-mode'`

3. **service-worker.js**
   - `const BUILD_VERSION = '__BUILD_VERSION__'` → `const BUILD_VERSION = 'dev-mode'`
   - Cache name becomes: `delta-grande-dev-mode`

## Testing

### In Development
```bash
npm run dev
# Opens http://localhost:5173
# Check console: [Version Plugin] Mode: development, Version: dev-mode
# Service worker cache: delta-grande-dev-mode
```

### Building for Production
```bash
npm run build
# Check console: [Version Plugin] Mode: production, Version: v1766256002125-ihsx8ww
# Check files:
Select-String -Path "dist/service-worker.js" -Pattern "BUILD_VERSION"
Select-String -Path "dist/game/index.html" -Pattern "APP_VERSION"
```

## Benefits

### Development Benefits
✅ Fast HMR (Hot Module Replacement)  
✅ Consistent cache during dev session  
✅ No unexpected cache clearing  
✅ Can still test service worker functionality  
✅ Console shows `dev-mode` for clarity

### Production Benefits
✅ Unique version on every deployment  
✅ Automatic cache busting  
✅ Users always get latest version  
✅ Old caches automatically deleted  
✅ No manual intervention needed

## Console Output

### Dev Mode
```
[Version Plugin] Mode: development, Version: dev-mode
[App] ServiceWorker registered with version: dev-mode
```

### Production (First Load)
```
[Version Plugin] Mode: production, Version: v1766256002125-ihsx8ww
[App] ServiceWorker registered with version: v1766256002125-ihsx8ww
```

### Production (After Update)
```
[App] Version changed from v1766256002125-ihsx8ww to v1766256100000-abc1234
[App] Clearing all caches and unregistering service workers...
[App] All caches cleared. Reloading...
[SW] Activating with version: v1766256100000-abc1234
[SW] Deleting old caches: ["delta-grande-v1766256002125-ihsx8ww"]
```

## Files Modified

1. **vite-plugin-version.js** (NEW)
   - Custom Vite plugin for version injection
   - Works in both dev and build modes

2. **vite.config.js**
   - Added version injection plugin
   - Runs before all other plugins

3. **package.json**
   - Simplified: `"build": "vite build"`
   - Plugin handles everything automatically

4. **inject-version.js**
   - Now optional (kept for manual use)
   - Plugin is the primary method

## Deployment

### Vercel/Netlify
```bash
git push
# Runs: npm run build
# Plugin automatically generates unique version
# Users get fresh content on next visit
```

No additional setup needed! The plugin runs automatically during build.
