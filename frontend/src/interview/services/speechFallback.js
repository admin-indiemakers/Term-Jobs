/** Record complete, independently decodable files; timeslice fragments are not files. */
export function startSpeechFallback({ stream, onText, onError, endpoint, canCapture, onListening }) {
  let stopped = false;
  let recorder;
  let timer;
  let pending = 0;
  const controllers = new Set();
  const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  const capture = () => {
    if (stopped) return;
    if (!canCapture()) { timer = setTimeout(capture, 250); return; }
    const chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { onError('Audio recording failed. Check your microphone or type your answer.'); stop(); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (stopped) return;
      capture();
      if (!canCapture() || blob.size < 1024) return;
      if (pending >= 2) { onError('Transcription is taking too long. Please type your answer or retry.'); return; }
      pending++;
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const data = new FormData();
        const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        data.append('file', blob, `answer.${extension}`);
        data.append('language_code', 'en-IN');
        const response = await fetch(endpoint, { method: 'POST', body: data, signal: controller.signal });
        if (!response.ok) throw new Error('Transcription service unavailable');
        const result = await response.json();
        if (!stopped && canCapture() && result.transcript?.trim()) onText(result.transcript.trim());
      } catch (_) {
        if (!stopped) { onError('Server transcription is unavailable. Retry or type your answer below.'); stop(); }
      } finally { clearTimeout(timeout); controllers.delete(controller); pending--; }
    };
    recorder.start();
    onListening();
    timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
  };
  function stop() {
    stopped = true;
    clearTimeout(timer);
    if (recorder?.state === 'recording') recorder.stop();
    controllers.forEach(controller => controller.abort());
    stream.getTracks().forEach(track => track.stop());
  }
  capture();
  return stop;
}
