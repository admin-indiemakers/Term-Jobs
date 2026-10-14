import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeRecording } from '../src/interview/utils/recording.js';

test('waits for final recording data and preserves Safari MP4 format', async () => {
  const chunks = [new Blob(['first'])];
  const recorder = { state: 'recording', mimeType: 'video/mp4', stop() {
    this.state = 'inactive';
    setTimeout(() => { chunks.push(new Blob(['last'])); this.onstop(); }, 10);
  } };
  const blob = await finalizeRecording(recorder, chunks);
  assert.equal(await blob.text(), 'firstlast');
  assert.equal(blob.type, 'video/mp4');
});

test('upload retry reuses stopped recording without stopping again', async () => {
  const recorder = { state: 'inactive', mimeType: 'video/webm', stop() { throw new Error('Already stopped'); } };
  const chunks = [new Blob(['retained recording'])];
  assert.equal(await (await finalizeRecording(recorder, chunks)).text(), 'retained recording');
  assert.equal(await (await finalizeRecording(recorder, chunks)).text(), 'retained recording');
});

test('missing or empty recording cannot silently complete the interview', async () => {
  await assert.rejects(finalizeRecording(null, []), /unavailable/);
  await assert.rejects(finalizeRecording({ state: 'inactive' }, []), /No camera recording/);
});
