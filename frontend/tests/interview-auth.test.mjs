import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/interview/services/interviewApi.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/export (function|const) /g, '$1 ');

function client(search, accountToken = null) {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams, window: { location: { search } },
    localStorage: { getItem: () => accountToken },
    apiRequest: async (path, options) => { calls.push({ path, options }); return { questions: [] }; },
    API_BASE_URL: '',
  });
  vm.runInContext(source + '\nglobalThis.api = interviewApi;', context);
  return { api: context.api, calls };
}

test('question preparation uses URL invitation after round detail omits credentials', async () => {
  const { api, calls } = client('?token=personal-invitation');
  await api.getAssessmentQuestions('round-a');
  assert.equal(calls[0].path, '/api/interviews/rounds/round-a/questions?token=personal-invitation');
});

test('question preparation retains explicit invitation credentials', async () => {
  const { api, calls } = client('');
  await api.getAssessmentQuestions('round-a', 'explicit-invitation');
  assert.equal(calls[0].path, '/api/interviews/rounds/round-a/questions?token=explicit-invitation');
});

test('signed-in staff can prepare questions without an invitation query', async () => {
  const { api, calls } = client('', 'account-credential');
  await api.getAssessmentQuestions('round-a');
  assert.equal(calls[0].path, '/api/interviews/rounds/round-a/questions');
  assert.equal(calls[0].options.token, 'account-credential');
});
