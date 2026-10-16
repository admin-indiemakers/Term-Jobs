import assert from 'node:assert/strict';
import test from 'node:test';
import { hiringConversationStorageKey, loadHiringConversations } from '../src/utils/hiringConversations.js';

const realChat = { id: 'conv-123', messages: [{ sender: 'user', text: 'My requisitions' }] };
const seededChat = { id: 'conv-seeded-1', messages: [{ sender: 'user', text: 'Demo' }] };

test('new accounts cannot load another manager or shared default history', () => {
  const storage = new Map([
    [hiringConversationStorageKey('existing-hm'), JSON.stringify([realChat])],
    ['termjobs_hm_conversations_default', JSON.stringify([seededChat])],
  ]);
  const browserStorage = { getItem: key => storage.get(key) ?? null };
  assert.deepEqual(loadHiringConversations(browserStorage, 'new-hm'), []);
  assert.deepEqual(loadHiringConversations(browserStorage, 'existing-hm'), [realChat]);
  assert.deepEqual(loadHiringConversations(browserStorage, null), []);
});

test('reload removes persisted demo conversations and preserves real chat messages', () => {
  const storage = { getItem: () => JSON.stringify([seededChat, realChat, null, {}]) };
  assert.deepEqual(loadHiringConversations(storage, 'hm'), [realChat]);
});

test('empty, invalid, or unavailable browser storage starts with no history', () => {
  for (const value of [null, '[]', '{', '{}']) {
    assert.deepEqual(loadHiringConversations({ getItem: () => value }, 'hm'), []);
  }
  assert.deepEqual(loadHiringConversations({ getItem() { throw new Error('Unavailable'); } }, 'hm'), []);
});
