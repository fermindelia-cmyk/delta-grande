const MODULE_URL = import.meta.url;
const CORE_DIR = new URL('.', MODULE_URL);
const GAME_ROOT = new URL('../', CORE_DIR);
const SITE_ROOT = new URL('../', GAME_ROOT);

/**
 * Resolve a path that might be written with a leading slash so it works
 * when the site is hosted under a subdirectory. Returns an absolute URL.
 */
export function resolvePublicPath(path) {
  if (typeof path !== 'string') {
    return path;
  }
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return path;
  }
  if (/^(data:|blob:|https?:|\w+:)/i.test(trimmed)) {
    return path;
  }
  if (!trimmed.startsWith('/')) {
    return path;
  }
  return new URL(trimmed.slice(1), SITE_ROOT).href;
}

/**
 * Walk an object/array and normalize any string values with leading slashes.
 */
export function normalizeAssetPaths(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeAssetPaths);
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, val] of Object.entries(value)) {
      next[key] = normalizeAssetPaths(val);
    }
    return next;
  }
  if (typeof value === 'string' && value.startsWith('/')) {
    return resolvePublicPath(value);
  }
  return value;
}
