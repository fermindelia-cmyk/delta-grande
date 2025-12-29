# Optimization Report for Delta Grande

## Summary of Changes
We have performed a comprehensive optimization of `index.html` to improve performance, load times, and maintainability.

### 1. Code Structure & Maintainability
- **Extracted Inline Scripts**: All inline JavaScript code (approx. 1000 lines) has been moved to `landing-ui.js`. This allows the browser to cache the script and keeps the HTML clean.
- **Extracted Inline Styles**: The large CSS block has been moved to `landing-style.css`.
- **Service Worker Registration**: Moved to `sw-register.js`.

### 2. Performance Optimizations
- **Lazy Loading Iframes**: Added `loading="lazy"` to the `isla_splat.html` iframe and the YouTube iframe. This prevents them from blocking the initial page load.
- **Lazy Loading Videos**: 
  - Heavy videos (`mapa_gigante.webm`, `logo_naranja_alpha.webm`) now have `preload="none"` and `autoplay` removed.
  - A new "Lazy Video" observer in `landing-ui.js` automatically plays these videos only when they scroll into view.
  - This significantly reduces initial bandwidth usage and memory footprint.

## Recommendations for Further Optimization

### 1. Asset Compression
The following assets are very large and should be compressed:
- **`assets/delta-web-ambiente.mp3` (17.9 MB)**: This is extremely large for a web audio file.
  - **Action**: Convert to **AAC (m4a)** or **Ogg Vorbis** at a lower bitrate (e.g., 96kbps or 128kbps). It could likely be reduced to < 5MB.
- **`assets/web_musica.ogg` (4.9 MB)**: Can likely be compressed further.
- **`assets/map.png` (3.3 MB)**: 
  - **Action**: Convert to **WebP** or **AVIF**. This could reduce the size to < 1MB with no visible loss.
- **`assets/mapa_gigante.webm` (2.2 MB)** & **`assets/birds.webm` (2.2 MB)**:
  - **Action**: Re-encode with a lower bitrate or use a more efficient codec (AV1 if supported, or optimized VP9).

### 2. `isla_splat.html` Optimization
- The file is 3.4 MB. If it contains embedded data (like base64 splats), consider separating the data into a binary file (`.splat` or `.ply`) and loading it via fetch. This allows the HTML to parse faster.
- Ensure the server serves this file with **Gzip** or **Brotli** compression.

### 3. Service Worker Strategy
- The current service worker caches `/game-assets/` aggressively. With large assets, this can fill up the user's cache storage quickly.
- **Recommendation**: Consider a "Network First" strategy for very large media files, or exclude them from the service worker cache if they are not essential for offline gameplay.

### 4. Image Formats
- Convert all PNG/JPG assets in `assets/` to **WebP** or **AVIF** for better compression.

## How to Verify
1. Open `index.html` in a browser.
2. Open Developer Tools (F12) -> Network tab.
3. Reload the page.
4. Verify that `landing-ui.js` and `landing-style.css` are loaded.
5. Verify that `mapa_gigante.webm` does NOT load immediately, but starts loading/playing when you scroll down to it.
