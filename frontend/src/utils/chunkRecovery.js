// A stale tab can reference chunks removed by a deployment. Reload once per
// entry bundle, retaining the current route and authentication. A persistent
// failure must reach the error boundary instead of causing a reload loop.
export function installChunkRecovery(target, storage, bundleId) {
  const key = `termjobs:chunk-recovery:${bundleId}`;
  const recover = (event) => {
    try {
      if (storage.getItem(key)) return;
      storage.setItem(key, '1');
    } catch {
      return;
    }
    event.preventDefault();
    target.location.reload();
  };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
}
