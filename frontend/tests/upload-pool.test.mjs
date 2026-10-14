import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadParts } from '../src/interview/utils/uploadPool.js';

test('upload runs at most three workers and reports completed parts', async () => {
  let active = 0;
  let peak = 0;
  const indices = [];
  const progress = [];
  await uploadParts(8, async index => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    indices.push(index); active--;
  }, result => progress.push(result));
  assert.equal(peak, 3);
  assert.deepEqual(indices.sort((a, b) => a - b), [0,1,2,3,4,5,6,7]);
  assert.equal(progress.at(-1).uploaded, 8);
});

test('failed uploads stop scheduling remaining parts and reject completion', async () => {
  let started = 0;
  await assert.rejects(uploadParts(20, async index => {
    started++;
    if (index === 0) throw new Error('network failure');
    await new Promise(resolve => setTimeout(resolve, 2));
  }), /network failure/);
  assert.ok(started <= 3);
});
