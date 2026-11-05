import { useState, useRef, useCallback, useEffect } from "react";
import { getUserAiConfig, recordAiRequest } from "./useUserAiConfig";

/**
 * Custom React Hook managing Server-Sent Events (SSE) streaming communication
 * with the Aura AI Assistant FastAPI backend (/api/v2/hm-agent).
 * Integrates directly with TermJobs AuthContext, personal AI configs, and
 * read-only legacy conversation history.
 */
export function useHiringManagerChat({
  apiBaseUrl = "",
  token = null,
  user = null,
  initialConversationId = null
} = {}) {
  const userId = user?.id || "guest";
  const auraStorageKey = `termjobs_aura_conversations_${userId}`;
  const legacyStorageKey = `termjobs_hm_conversations_${userId}`;

  // 1. Load active Aura conversations
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(auraStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: initialConversationId || `conv_aura_${Date.now()}`,
        title: "Hiring Operations Desk",
        updatedAt: new Date().toISOString(),
        messages: []
      }
    ];
  });

  // 2. Load legacy conversations (read-only)
  const [legacyConversations, setLegacyConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(legacyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (c) => c && typeof c.id === "string" && Array.isArray(c.messages)
          ).map((c) => ({
            ...c,
            isLegacy: true,
            title: c.title || (c.messages[0]?.text?.slice(0, 32) || "Legacy Chat")
          }));
        }
      }
    } catch {}
    return [];
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    return initialConversationId || conversations[0]?.id || `conv_aura_${Date.now()}`;
  });

  const activeConversation = [...conversations, ...legacyConversations].find(
    (c) => c.id === activeConversationId
  );
  const isLegacyActive = Boolean(activeConversation?.isLegacy);

  // Messages for active conversation
  const [messages, setMessages] = useState(() => {
    const active = [...conversations, ...legacyConversations].find(
      (c) => c.id === (initialConversationId || conversations[0]?.id)
    );
    if (active?.isLegacy && Array.isArray(active.messages)) {
      return active.messages.map((m) => ({
        id: m.id || `legacy_${Math.random()}`,
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text || m.content || "",
        timestamp: m.timestamp || new Date().toISOString(),
        toolCalls: [],
        toolResults: [],
        uiCards: [],
        isLegacy: true
      }));
    }
    return active?.messages || [];
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const lastUserPromptRef = useRef("");

  // Persist Aura conversations to localStorage
  useEffect(() => {
    try {
      if (userId && userId !== "guest") {
        localStorage.setItem(auraStorageKey, JSON.stringify(conversations));
      }
    } catch {}
  }, [conversations, auraStorageKey, userId]);

  // Switch conversation messages
  const handleSelectConversation = useCallback(
    (convId) => {
      setActiveConversationId(convId);
      const target = [...conversations, ...legacyConversations].find((c) => c.id === convId);
      if (target?.isLegacy && Array.isArray(target.messages)) {
        setMessages(
          target.messages.map((m) => ({
            id: m.id || `legacy_${Math.random()}`,
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text || m.content || "",
            timestamp: m.timestamp || new Date().toISOString(),
            toolCalls: [],
            toolResults: [],
            uiCards: [],
            isLegacy: true
          }))
        );
      } else {
        setMessages(target?.messages || []);
      }
    },
    [conversations, legacyConversations]
  );

  /**
   * Create a new Aura conversation
   */
  const createNewConversation = useCallback(() => {
    const newId = `conv_aura_${Date.now()}`;
    const newConv = {
      id: newId,
      title: "New Operation",
      updatedAt: new Date().toISOString(),
      messages: []
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Delete an Aura conversation
   */
  const deleteConversation = useCallback((convId) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId);
      if (filtered.length === 0) {
        const fresh = {
          id: `conv_aura_${Date.now()}`,
          title: "Hiring Operations Desk",
          updatedAt: new Date().toISOString(),
          messages: []
        };
        setActiveConversationId(fresh.id);
        setMessages([]);
        return [fresh];
      }
      return filtered;
    });
  }, []);

  /**
   * Send user prompt and stream the multi-step assistant turn.
   */
  const sendMessage = useCallback(
    async (text) => {
      if (!text || !text.trim() || isStreaming) return;

      // If active conversation is legacy, branch into a new Aura conversation
      let targetConvId = activeConversationId;
      if (isLegacyActive) {
        targetConvId = `conv_aura_${Date.now()}`;
        const newConv = {
          id: targetConvId,
          title: text.trim().slice(0, 32),
          updatedAt: new Date().toISOString(),
          messages: []
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(targetConvId);
      }

      lastUserPromptRef.current = text.trim();
      setError(null);

      recordAiRequest();

      const userMessageId = `usr_${Date.now()}`;
      const assistantMessageId = `ast_${Date.now()}`;

      const userMsg = {
        id: userMessageId,
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString()
      };

      const initialAssistantMsg = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        toolCalls: [],
        toolResults: [],
        uiCards: [],
        thinking: [],
        isStreaming: true,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = isLegacyActive ? [userMsg, initialAssistantMsg] : [...messages, userMsg, initialAssistantMsg];
      setMessages(updatedMessages);
      setIsStreaming(true);

      abortControllerRef.current = new AbortController();

      const userAiConfig = getUserAiConfig();
      const authToken = token || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";

      const headers = {
        "Content-Type": "application/json"
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      if (userAiConfig?.apiKey) {
        headers["x-user-ai-key"] = userAiConfig.apiKey;
      }
      const effectiveModel = userAiConfig?.model || userAiConfig?.selectedModel || null;
      if (effectiveModel) {
        headers["x-user-ai-model"] = effectiveModel;
      }

      try {
        const chatUrl = `${apiBaseUrl}/api/v2/hm-agent/chat`.replace(/([^:]\/)\/+/g, "$1");
        const response = await fetch(chatUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: text.trim(),
            conversation_id: targetConvId,
            user_api_key: userAiConfig?.apiKey || null,
            user_model: effectiveModel,
            user_provider: userAiConfig?.provider || null
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          const errBody = await response.text();
          let detail = "Chat request failed";
          try {
            const parsed = JSON.parse(errBody);
            detail = parsed.detail || parsed.error || detail;
          } catch {
            detail = errBody || detail;
          }
          throw new Error(`[HTTP ${response.status}] ${detail}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;
            const lines = rawEvent.split("\n");
            let eventType = "message";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6);
              }
            }

            if (!dataStr) continue;

            let data;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            setMessages((prevMsgs) => {
              const copy = [...prevMsgs];
              const idx = copy.findIndex((m) => m.id === assistantMessageId);
              if (idx === -1) return prevMsgs;

              const target = { ...copy[idx] };

              switch (eventType) {
                case "thinking":
                  target.thinking = [...(target.thinking || []), data.content || data.thinking || ""];
                  break;

                case "assistant_delta":
                case "token": {
                  let newChunk = data.content || data.delta || "";
                  if (!newChunk) break;

                  // Strip raw inline tool call tags if leaked by open models
                  newChunk = newChunk.replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/g, "");
                  newChunk = newChunk.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");

                  const current = target.content || "";

                  // 1. Cumulative stream chunk (starts with current content)
                  if (current && newChunk.startsWith(current)) {
                    target.content = newChunk;
                  }
                  // 2. Trailing duplicate chunk
                  else if (current.endsWith(newChunk)) {
                    // Ignore duplicate
                  }
                  // 3. Overlapping window chunk
                  else {
                    let overlapLen = 0;
                    const maxOverlap = Math.min(current.length, newChunk.length, 80);
                    for (let len = maxOverlap; len > 0; len--) {
                      if (current.endsWith(newChunk.slice(0, len))) {
                        overlapLen = len;
                        break;
                      }
                    }
                    if (overlapLen > 0) {
                      target.content = current + newChunk.slice(overlapLen);
                    } else {
                      target.content = current + newChunk;
                    }
                  }
                  break;
                }

                case "tool_call":
                  // Move any preliminary preamble text into thinking so final answer starts clean without repeats
                  if (target.content && target.content.trim()) {
                    target.thinking = [...(target.thinking || []), target.content.trim()];
                    target.content = "";
                  }
                  target.toolCalls = [
                    ...(target.toolCalls || []),
                    {
                      name: data.tool || data.name,
                      parameters: data.arguments || data.parameters,
                      step: data.step,
                      requiresConfirmation: data.requires_confirmation
                    }
                  ];
                  break;

                case "proposal_created":
                  target.uiCards = [
                    ...(target.uiCards || []),
                    {
                      proposalId: data.proposal_id,
                      action: data.tool,
                      parameters: data.parameters,
                      cardType: data.ui_card || "proposal_confirmation_card",
                      type: "proposal"
                    }
                  ];
                  break;

                case "tool_result":
                  target.toolResults = [
                    ...(target.toolResults || []),
                    {
                      tool: data.tool,
                      result: data.result,
                      uiCard: data.ui_card,
                      step: data.step
                    }
                  ];
                  if (data.ui_card) {
                    target.uiCards = [
                      ...(target.uiCards || []),
                      {
                        tool: data.tool,
                        resultData: data.result,
                        cardType: data.ui_card,
                        type: "result"
                      }
                    ];
                  }
                  break;

                case "message_complete":
                case "done":
                  target.isStreaming = false;
                  break;

                case "error":
                  target.isStreaming = false;
                  target.error = data.message || data.error;
                  target.content = target.content || `⚠️ ${data.message || data.error || "An error occurred"}`;
                  break;

                default:
                  break;
              }

              copy[idx] = target;
              return copy;
            });
          }
        }

        // Finalize streaming
        setMessages((prevMsgs) => {
          const finalized = prevMsgs.map((m) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m));
          // Update conversation title and messages
          setConversations((prevConvs) =>
            prevConvs.map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    title: c.title === "New Operation" ? text.trim().slice(0, 32) : c.title,
                    updatedAt: new Date().toISOString(),
                    messages: finalized
                  }
                : c
            )
          );
          return finalized;
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to stream chat turn.");
          setMessages((prevMsgs) =>
            prevMsgs.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    isStreaming: false,
                    content: m.content || `⚠️ Error: ${err.message || "Unable to reach Aura assistant"}`
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiBaseUrl, token, activeConversationId, isLegacyActive, isStreaming, messages]
  );

  const retryLastMessage = useCallback(() => {
    if (lastUserPromptRef.current) {
      sendMessage(lastUserPromptRef.current);
    }
  }, [sendMessage]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const confirmProposal = useCallback(
    async (proposalId) => {
      const authToken = token || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
      const url = `${apiBaseUrl}/api/v2/hm-agent/proposals/${proposalId}/confirm`.replace(/([^:]\/)\/+/g, "$1");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Failed to confirm proposal (${res.status})`);
      }
      return await res.json();
    },
    [apiBaseUrl, token]
  );

  const rejectProposal = useCallback(
    async (proposalId, rejectionReason) => {
      const authToken = token || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
      const url = `${apiBaseUrl}/api/v2/hm-agent/proposals/${proposalId}/reject`.replace(/([^:]\/)\/+/g, "$1");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ rejection_reason: rejectionReason || "Rejected by user" })
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Failed to reject proposal (${res.status})`);
      }
      return await res.json();
    },
    [apiBaseUrl, token]
  );

  return {
    conversations,
    legacyConversations,
    activeConversationId,
    activeConversation,
    isLegacyActive,
    setActiveConversationId: handleSelectConversation,
    createNewConversation,
    deleteConversation,
    messages,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    confirmProposal,
    rejectProposal,
    isStreaming,
    error
  };
}
