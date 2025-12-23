# Testing Cache Busting

## Quick Verification Steps

### 1. After Building

Run these commands to verify version injection:

```powershell
# Check service worker
Select-String -Path "dist/service-worker.js" -Pattern "BUILD_VERSION" | Select-Object -First 2

# Check game HTML
Select-String -Path "dist/game/index.html" -Pattern "APP_VERSION" | Select-Object -First 1

# Check main HTML
Select-String -Path "dist/index.html" -Pattern "APP_VERSION" | Select-Object -First 1
```

All three should show the SAME version like: `v1766255831861-ni4vv7i`

### 2. In Browser DevTools

#### Before Deployment
1. Open DevTools (F12)
2. Go to **Application** tab → **Service Workers**
3. Note the current cache name (e.g., `delta-grande-v1766255831861-ni4vv7i`)
4. Go to **Cache Storage**
5. See the current caches

#### After New Deployment
1. Reload the page
2. Check Console for logs:
   ```
   [App] Version changed from v1766255831861-ni4vv7i to v1766256000000-abc1234
   [App] Clearing caches and unregistering service workers...
   [App] All caches cleared. Reloading...
   ```
3. After reload, check Application → Service Workers
4. New cache name should match new version
5. Check Application → Cache Storage
6. Old caches should be gone

### 3. Network Tab Testing

#### Service Worker File
1. Open DevTools → **Network** tab
2. Reload page
3. Find `service-worker.js` request
4. Should have query parameter: `service-worker.js?v=1766256000000-abc1234`
5. Status should be **200** (not 304 - not from cache)
6. Response headers should include:
   ```
   Cache-Control: no-store, no-cache, must-revalidate, max-age=0
   ```

### 4. Simulating Deployment Locally

```powershell
# First deployment
npm run build
npm run preview
# Note the version in console

# Make a code change (or just rebuild)
npm run build
# New version will be generated

# Reload browser - should see cache clearing logs
```

### 5. Testing on Vercel/Netlify

#### Deploy and Test
```bash
# Push to trigger deployment
git add .
git commit -m "Testing cache busting"
git push

# After deployment completes:
# 1. Open your deployed site
# 2. Open DevTools Console
# 3. Note the version logged
# 4. Check Application → Cache Storage for cache names
# 5. Push another commit
# 6. Reload the site
# 7. Should see version change logs and cache clearing
```

#### Check Headers
```powershell
# Test service worker headers
curl -I https://your-site.vercel.app/service-worker.js

# Should include:
# Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

### 6. Edge Cases to Test

#### Multiple Tabs
1. Open site in 2+ tabs
2. Deploy new version
3. Reload one tab - should clear caches
4. Reload other tabs - should get fresh content

#### Offline Mode
1. Open site and let it cache
2. Go offline (DevTools → Network → Offline)
3. Reload - should work from cache
4. Go online
5. Deploy new version
6. Reload - should detect version change and update

#### Force Refresh
- Ctrl+Shift+R should bypass service worker
- Normal reload (F5) should use service worker
- Either way, version checking still happens

## Troubleshooting

### Version Not Changing?
```powershell
# Check if inject-version.js ran
npm run build | Select-String -Pattern "Injecting"

# Verify placeholders exist in source
Select-String -Path "service-worker.js" -Pattern "__BUILD_VERSION__"
Select-String -Path "game/index.html" -Pattern "__BUILD_VERSION__"
Select-String -Path "index.html" -Pattern "__BUILD_VERSION__"
```

### Service Worker Not Updating?
1. Unregister manually:
   - DevTools → Application → Service Workers
   - Click "Unregister" for each worker
2. Clear all caches:
   - Application → Cache Storage
   - Right-click each cache → Delete
3. Hard reload: Ctrl+Shift+R

### Headers Not Applied?
**Vercel:**
- Check `vercel.json` is in root
- Verify headers in Vercel dashboard

**Netlify:**
- Check `netlify.toml` is in root  
- Check deploy logs for header configuration

## Expected Console Output

### On Fresh Install
```
[App] ServiceWorker registered with version: v1766256000000-abc1234
```

### On Version Change
```
[App] Version changed from v1766255831861-ni4vv7i to v1766256000000-abc1234
[App] Clearing all caches and unregistering service workers...
[App] All caches cleared. Reloading...
[SW] Activating with version: v1766256000000-abc1234
[SW] Deleting old caches: ["delta-grande-v1766255831861-ni4vv7i"]
```

### On Service Worker Activation
```
[SW] Activating with version: v1766256000000-abc1234
[SW] Deleting old caches: []
```
