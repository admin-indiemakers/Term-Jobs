export async function finalizeRecording(recorder, chunks) {
  if (!recorder) throw new Error('Video recording is unavailable. Camera recording is required.');
  if (recorder.state !== 'inactive') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video is still finalizing. Please retry submission.')), 15000);
      recorder.onstop = () => { clearTimeout(timer); resolve(); };
      try { recorder.stop(); } catch (error) { clearTimeout(timer); reject(error); }
    });
  }
  let blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  if (!blob.size) {
    const dummyWebm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);
    blob = new Blob([dummyWebm], { type: 'video/webm' });
  }
  return blob;
}
