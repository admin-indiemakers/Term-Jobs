import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the hook against a controlled browser recognition service and fake timers.
function capture({ supported = true, muted = false } = {}) {
  const states = [];
  const effects = [];
  const timers = new Map();
  const engines = [];
  let nextTimer = 0;
  class Recognition {
    constructor() { engines.push(this); }
    start() { this.onstart?.(); }
    abort() { this.onend?.(); }
    stop() { this.onend?.(); }
  }
  const context = vm.createContext({
    window: supported ? { SpeechRecognition: Recognition } : {},
    Date, Math, console,
    useState(initial) {
      const index = states.length;
      states.push(initial);
      return [initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: current => ({ current }),
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    setInterval: () => 0, clearInterval: () => {},
  });
  const source = readFileSync(new URL('../src/interview/hooks/useSpeechTranscription.js', import.meta.url), 'utf8')
    .replace(/^import .*?;\n/, '').replace('export function', 'function');
  vm.runInContext(`${source}\nglobalThis.hook = useSpeechTranscription;`, context);
  const hook = context.hook({ isMicMuted: muted });
  const cleanups = effects.map(effect => effect()).filter(value => typeof value === 'function');
  return { states, engines, timers, hook, cleanup: () => cleanups.forEach(fn => fn()), runTimers() {
    const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn());
  } };
}

test('unsupported browsers provide a fallback message', () => {
  const c = capture({ supported: false });
  assert.match(c.states[2], /unavailable.*type your answer/);
  assert.equal(c.engines.length, 0);
});

test('permission denial stops automatic retry and supports explicit retry', () => {
  const c = capture();
  c.engines[0].onerror({ error: 'not-allowed' });
  c.engines[0].onend();
  assert.equal(c.states[1], false);
  assert.match(c.states[2], /permission was denied/);
  c.runTimers();
  assert.equal(c.engines.length, 1);
  c.hook.startListening();
  assert.equal(c.engines.length, 2);
  assert.equal(c.states[1], true);
});

test('network failure retries are bounded', () => {
  const c = capture();
  for (let i = 0; i < 3; i++) {
    c.engines[i].onerror({ error: 'network' });
    c.engines[i].onend();
    c.runTimers();
  }
  assert.equal(c.engines.length, 3);
  assert.match(c.states[2], /lost its connection/);
});

test('final speech is preserved and cleanup cancels scheduled restart', () => {
  const c = capture();
  const result = [{ transcript: 'My answer about Kubernetes' }];
  result.isFinal = true;
  c.engines[0].onresult({ resultIndex: 0, results: [result] });
  assert.equal(c.states[4][0].text, 'My answer about Kubernetes');
  c.engines[0].onend();
  c.cleanup(); c.runTimers();
  assert.equal(c.engines.length, 1);
});

test('muted microphone never starts recognition', () => {
  const c = capture({ muted: true });
  c.hook.startListening();
  assert.equal(c.engines.length, 0);
});
