export function hiringConversationStorageKey(userId) {
  return userId ? `termjobs_hm_conversations_${userId}` : null;
}

export function loadHiringConversations(storage, userId) {
  const key = hiringConversationStorageKey(userId);
  if (!key) return [];
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (!Array.isArray(saved)) return [];
    // Older versions persisted screenshot demo conversations alongside real chats.
    return saved.filter((conversation) =>
      conversation && typeof conversation.id === 'string' &&
      !conversation.id.startsWith('conv-seeded-') &&
      Array.isArray(conversation.messages)
    );
  } catch {
    return [];
  }
}
