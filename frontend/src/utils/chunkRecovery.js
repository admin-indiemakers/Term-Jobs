const recoveringTargets = new WeakSet();

export function isChunkRecoveryInProgress(target = window) {
  return recoveringTargets.has(target);
}

// Keep Suspense visible while a replacement document is loading.
export function loadRoute(importer, target = window) {
  return importer().catch(error => {
    if (isChunkRecoveryInProgress(target)) return new Promise(() => {});
    throw error;
  });
}

// A stale tab can reference chunks removed by a deployment. Reload once per
// entry bundle, retaining the current route and authentication. A persistent
// failure must reach the error boundary instead of causing a reload loop.
import { lazy } from 'react';

export function installChunkRecovery(target, storage, bundleId) {
  const key = `termjobs:chunk-recovery:${bundleId}`;
  const recover = (event) => {
    try {
      if (storage.getItem(key)) return;
      storage.setItem(key, '1');
    } catch {
      return;
    }
    recoveringTargets.add(target);
    target.location.reload();
  };

  target.addEventListener('vite:preloadError', recover);

  // Catch dynamic import errors that escape as unhandled promise rejections
  const handleUnhandledRejection = (event) => {
    const error = event?.reason;
    const isChunkLoadError =
      error?.message &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
       error.message.includes('Importing a module script failed') ||
       error.message.includes('error loading dynamically imported module') ||
       error.message.includes('Loading chunk') ||
       error.name === 'ChunkLoadError');

    if (isChunkLoadError) {
      recover(event);
    }
  };

  target.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    target.removeEventListener('vite:preloadError', recover);
    target.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}

export function lazyWithRetry(componentImport, retriesLeft = 2, interval = 800) {
  return lazy(() =>
    new Promise((resolve, reject) => {
      const attempt = (remaining) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            const isChunkLoadError =
              error?.message &&
              (error.message.includes('Failed to fetch dynamically imported module') ||
               error.message.includes('Importing a module script failed') ||
               error.message.includes('error loading dynamically imported module') ||
               error.message.includes('Loading chunk') ||
               error.name === 'ChunkLoadError');

            if (remaining > 0 && isChunkLoadError) {
              setTimeout(() => {
                attempt(remaining - 1);
              }, interval);
              return;
            }

            if (isChunkLoadError && typeof window !== 'undefined') {
              const reloadKey = 'tj_last_chunk_reload';
              const lastReload = window.sessionStorage?.getItem(reloadKey);
              const now = Date.now();
              if (!lastReload || now - Number(lastReload) > 30000) {
                try {
                  window.sessionStorage?.setItem(reloadKey, String(now));
                } catch {}
                window.location.reload();
                return;
              }
            }

            reject(error);
          });
      };
      attempt(retriesLeft);
    })
  );
}
