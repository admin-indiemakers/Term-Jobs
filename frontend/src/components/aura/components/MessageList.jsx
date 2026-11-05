import React, { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";

export function MessageList({
  messages,
  onConfirmProposal,
  onRejectProposal,
  isStreaming,
  onRetry
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const lastMessage = messages[messages.length - 1];
  // Only show the standalone placeholder when waiting for the server to append the initial assistant message.
  // Once the assistant message is in the array, MessageBubble handles the thinking indicator itself.
  const isWaitingInitialResponse = Boolean(
    isStreaming && (!lastMessage || lastMessage.role === "user")
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-6 sm:px-6 scroll-smooth bg-white">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg, index) => {
          const isLast = index === messages.length - 1;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              onConfirmProposal={onConfirmProposal}
              onRejectProposal={onRejectProposal}
              isLast={isLast}
              isStreaming={isStreaming}
              onRetry={onRetry}
            />
          );
        })}

        {/* Standalone NEXUS Thinking indicator before assistant response has arrived */}
        {isWaitingInitialResponse && (
          <div className="flex items-start gap-2.5 pl-0 py-2 animate-in fade-in duration-300">
            <div className="size-7 flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="TermJobs AI"
                className="size-7 object-contain animate-pulse"
              />
            </div>
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#111111]">TermJobs AI</span>
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Thinking…
                </span>
              </div>
              <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3.5 py-2 text-xs text-[#666666] flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex space-x-1">
                  <div
                    className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-[12px] text-[#555555]">
                  Analyzing hiring data & drafting response…
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default MessageList;
