import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/pages/HiringManagerDashboard.jsx', import.meta.url), 'utf8');
const effect = source.slice(source.indexOf('  // Reveal the start of each new message'), source.indexOf('  // Reset conversation'));

function render(count, previousCount, messageTop = 250) {
  const calls = [];
  const context = {
    messages: Array(count), scrolledMessageCountRef: { current: previousCount },
    latestMessageRef: { current: { getBoundingClientRect: () => ({ top: messageTop }) } },
    chatContainerRef: { current: {
      scrollTop: 400, scrollHeight: 5000, clientTop: 1,
      getBoundingClientRect: () => ({ top: 100 }),
      scrollTo: options => calls.push(options),
    } },
    useLayoutEffect: callback => callback(),
  };
  vm.runInNewContext(effect, context);
  return { calls, count: context.scrolledMessageCountRef.current };
}

test('new long reply anchors its beginning instead of scrollHeight', () => {
  const { calls } = render(2, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].top, 541);
  assert.equal(calls[0].behavior, 'instant');
});

test('editing a card preserves the reading position', () => {
  assert.equal(render(2, 2).calls.length, 0);
});

test('clearing chat resets tracking without scrolling', () => {
  const result = render(0, 4);
  assert.equal(result.calls.length, 0);
  assert.equal(result.count, 0);
});

test('first message cannot scroll above the container', () => {
  assert.equal(render(1, 0, -400).calls[0].top, 0);
});
