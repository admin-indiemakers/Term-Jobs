import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Execute the dashboard's actual handler with state and API boundaries stubbed.
const source = readFileSync(new URL('../src/pages/HiringManagerDashboard.jsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleSendPrompt ='), source.indexOf('  const userInitials ='));

async function send(text, response, initial = [], requisitions = []) {
  let messages = initial;
  let typing = false;
  const context = vm.createContext({
    prompt: () => { throw new Error('Browser prompt must not be used'); },
    promptInput: '', isAiTyping: false, messages: initial,
    setPromptInput() {}, setMessages: update => { messages = update(messages); },
    setIsAiTyping: value => { typing = value; },
    request: async () => { if (response instanceof Error) throw response; return response; },
    token: 'test', userName: 'Manager', user: { id: 'hm', tenant_id: 'tenant' },
    shortlistedCandidates: [], allCandidates: [], acceptedCandidates: [], requisitions,
    setTimeout() {}, console: { error() {} },
  });
  vm.runInContext(`${handler}\nglobalThis.send = handleSendPrompt;`, context);
  await context.send(text);
  assert.equal(typing, false);
  return messages.at(-1);
}

for (const text of ['can you create a new urequsition', 'hey can u create a new requisition']) {
  test(`role selection survives response processing: ${text}`, async () => {
    const roles = [{ title: 'Backend Engineer' }];
    const message = await send(text, {
      reply: 'Which role would you like?',
      executed_actions: [{ tool: 'show_role_selection_dropdown', result: { roles } }],
    });
    assert.equal(message.isError, undefined);
    assert.equal(message.roleOptions, roles);
    assert.equal(message.requisitionDraft, null);
  });
}

test('draft response produces a card with requested openings', async () => {
  const message = await send('draft Backend Engineer with openings to 3', {
    reply: 'Review the draft details below',
    executed_actions: [{ tool: 'draft_hiring_requisition', result: {
      title: 'Backend Engineer', skills: 'Python, Docker', openings: 1,
    } }],
  });
  assert.equal(message.isError, undefined);
  assert.equal(message.requisitionDraft.title, 'Backend Engineer');
  assert.equal(message.requisitionDraft.openings, 3);
});

for (const [text, field, expected] of [
  ['change skills to Python and React only', 'skills', ['Python', 'React']],
  ['change role summary to Build APIs', 'summary', 'Build APIs'],
]) {
  test(`draft edit uses submitted text: ${field}`, async () => {
    const message = await send(text, { reply: 'Updated', executed_actions: [] }, [{
      sender: 'ai', requisitionDraft: { title: 'Backend Engineer', openings: 1, skills: ['Java'], summary: 'Old' },
    }]);
    assert.equal(message.isError, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(message.requisitionDraft[field])), expected);
  });
}

test('API failure displays an error instead of generic hiring guidance', async () => {
  const message = await send('create a new requisition', new Error('Network error'));
  assert.equal(message.isError, true);
  assert.match(message.text, /couldn’t complete your request/);
  assert.equal(message.requisitionDraft, undefined);
});

for (const rows of [[], [{ id: 'closed-1', title: 'Closed Role', status: 'Closed' }]]) {
  test(`closed query preserves backend results (${rows.length}) despite cached active roles`, async () => {
    const message = await send('can u show me closed requsition', {
      reply: rows.length ? 'Closed requisitions' : 'No closed requisitions',
      executed_actions: [{ tool: 'list_hiring_requisitions', result: rows }],
    }, [], [{ id: 'live-1', title: 'DevOps Engineer', status: 'Published' }]);
    assert.equal(message.isError, undefined);
    assert.equal(message.requisitionsList, rows);
  });
}

test('closed query filters cached fallback by status', async () => {
  const message = await send('show closed requisitions', { reply: 'Closed requisitions' }, [], [
    { id: 'live-1', status: 'Published' }, { id: 'closed-1', status: 'Closed' },
    { id: 'filled-1', status: 'Filled' },
  ]);
  assert.equal(message.isError, undefined);
  assert.deepEqual(Array.from(message.requisitionsList, r => r.id), ['closed-1', 'filled-1']);
});
