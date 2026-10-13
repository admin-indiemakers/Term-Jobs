export async function uploadParts(count, upload, onProgress = () => {}, concurrency = 3) {
  let next = 0;
  let completed = 0;
  let failed = false;
  onProgress({ uploaded: 0, total: count, phase: 'uploading' });
  async function worker() {
    while (!failed && next < count) {
      const index = next++;
      try { await upload(index); }
      catch (error) { failed = true; throw error; }
      completed++;
      onProgress({ uploaded: completed, total: count, phase: 'uploading' });
    }
  }
  const results = await Promise.allSettled(Array.from({ length: Math.min(count, concurrency) }, worker));
  const error = results.find(result => result.status === 'rejected');
  if (error) throw error.reason;
}
