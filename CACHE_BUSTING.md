# Cache Busting System

## Overview

This project implements automatic cache busting that completely resets user caches on every deployment. This ensures users always get the latest version without manual cache clearing.

## How It Works

### 1. Build-Time Version Injection

- During build (`npm run build`), a unique version is generated based on timestamp + random hash
- The version is injected into:
  - `service-worker.js` - updates the cache name
  - `game/index.html` - used for version checking on page load
  - `index.html` - main page version tracking

### 2. Service Worker Versioning

- **Old cache name**: `delta-grande-v1` (static)
- **New cache name**: `delta-grande-v1234567890-abc123` (unique per build)
- On activation, the new service worker deletes ALL old caches automatically
- Service worker file is served with `Cache-Control: no-store` headers to prevent browser caching

### 3. Client-Side Version Checking

When the page loads:

1. Checks stored version in localStorage against current `APP_VERSION`
2. If versions differ:
   - Unregisters all service workers
   - Clears all caches (Cache API)
   - Clears localStorage and sessionStorage
   - Reloads the page to get fresh content
3. If versions match, registers service worker normally

### 4. Service Worker Registration

- Service worker URL includes version query parameter: `service-worker.js?v=1234567890`
- Forces browser to fetch new worker on version change
- `registration.update()` called on every page load to check for updates

## Files Modified

### Core Files
- **service-worker.js** - Added `BUILD_VERSION` variable and cache name versioning
- **game/index.html** - Added aggressive cache clearing on version change
- **inject-version.js** - New build script that injects unique versions
- **package.json** - Updated build script to run version injection
- **vite.config.js** - Copies service-worker.js to dist, adds no-cache headers

### Deployment Configs
- **vercel.json** - Added headers to prevent service worker caching
- **netlify.toml** - Updated to use npm build, added no-cache headers

## Deployment

### Vercel
```bash
git push
# Vercel automatically runs: npm run build
# inject-version.js runs after vite build completes
```

### Netlify
```bash
git push
# Netlify runs: npm run build (configured in netlify.toml)
# inject-version.js runs after vite build completes
```

### Manual Build
```bash
npm run build
# This runs:
# 1. vite build (creates dist/)
# 2. node inject-version.js (injects unique version)
```

## Testing Cache Busting

1. **Build and deploy**:
   ```bash
   npm run build
   ```

2. **Check the version in dist files**:
   ```bash
   # Windows PowerShell
   Select-String -Path "dist/service-worker.js" -Pattern "BUILD_VERSION"
   Select-String -Path "dist/game/index.html" -Pattern "APP_VERSION"
   ```

3. **Deploy and test**:
   - Visit your site
   - Open DevTools → Application → Service Workers
   - Note the cache name includes unique version
   - Make a change and redeploy
   - Reload the page - should see console logs about version change
   - Old caches should be cleared automatically

## Console Logs to Monitor

When version changes, you'll see:
```
[App] Version changed from v1234567890-abc123 to v1234567891-def456
[App] Clearing all caches and unregistering service workers...
[App] All caches cleared. Reloading...
[SW] Activating with version: v1234567891-def456
[SW] Deleting old caches: ["delta-grande-v1234567890-abc123"]
```

## Fallback Safety

- If version checking fails, app continues with normal service worker registration
- Service worker activation still deletes old caches
- Users get updates on next full page reload at minimum

## Troubleshooting

### Caches not clearing?
- Check browser DevTools → Application → Cache Storage
- Manually clear and hard reload (Ctrl+Shift+R)
- Check that service-worker.js has `Cache-Control: no-store` header

### Version not injecting?
- Verify `inject-version.js` runs after build
- Check that `__BUILD_VERSION__` placeholders exist in source files
- Look for build output showing version injection

### Service worker not updating?
- Ensure service worker URL has version query parameter
- Check Network tab - service-worker.js should not return 304 (cached)
- Try closing all tabs and reopening

## Performance Impact

- First load: Service worker downloads and caches precache assets
- Updates: Old caches cleared, new assets fetched on-demand
- Network-first for HTML, cache-first for game assets
- Minimal impact - cache clearing happens in background during activation
