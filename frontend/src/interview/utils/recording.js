export async function finalizeRecording(recorder, chunks) {
  if (!recorder) throw new Error('Video recording is unavailable. Camera recording is required.');
  if (recorder.state !== 'inactive') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video is still finalizing. Please retry submission.')), 15000);
      recorder.onstop = () => { clearTimeout(timer); resolve(); };
      try { recorder.stop(); } catch (error) { clearTimeout(timer); reject(error); }
    });
  }
  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  if (!blob.size) throw new Error('No camera recording was captured.');
  return blob;
}
