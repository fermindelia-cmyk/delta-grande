// Cache busting script - automatically clears caches on new deployments
const APP_VERSION = '__BUILD_VERSION__';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const storedVersion = localStorage.getItem('app_version');
            
            if (storedVersion && storedVersion !== APP_VERSION) {
                console.log('[App] Version changed, clearing caches...');
                
                // Unregister all service workers
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                
                // Clear all caches
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                
                localStorage.clear();
                sessionStorage.clear();
                localStorage.setItem('app_version', APP_VERSION);
                window.location.reload(true);
                return;
            }
            
            localStorage.setItem('app_version', APP_VERSION);
            
            // Register service worker
            const registration = await navigator.serviceWorker.register(
                `/service-worker.js?v=${APP_VERSION}`, 
                { scope: '/' }
            );
            
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[App] New service worker available');
                    }
                });
            });
            
            registration.update();
        } catch (err) {
            console.warn('[App] ServiceWorker error:', err);
        }
    });
}
