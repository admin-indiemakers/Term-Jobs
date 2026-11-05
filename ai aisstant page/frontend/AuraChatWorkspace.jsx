import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  Mic,
  MicOff,
  ChevronDown,
  PhoneCall,
  Languages,
  Check,
  X
} from "lucide-react";
import { useHiringManagerChat } from "./hooks/useHiringManagerChat";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { InputComposer } from "./components/InputComposer";
import { AiLimitCircle } from "./components/AiLimitCircle";
import { AiConfigDialog } from "./components/AiConfigDialog";

const SUGGESTIONS = [
  {
    id: "requisition-insights",
    title: "Requisition Insights",
    desc: "Summarize open requisitions, candidate pipeline, and identify SLA blockers.",
    prompt: "Summarize all open job requisitions, candidate pipeline progress, and identify any candidates breaching the 48-hour hiring SLA.",
  },
  {
    id: "candidate-pipeline",
    title: "Candidate Pipeline",
    desc: "Find unreviewed submissions, interview schedules, and workload gaps.",
    prompt: "Show me all unreviewed candidate submissions across open requisitions and upcoming interview schedules for this week.",
  },
  {
    id: "task-planning",
    title: "Task Planning",
    desc: "Create and assign hiring requisitions from natural-language instructions.",
    prompt: "Help me draft a new job requisition with job description, required skills, interview stages, and budget.",
  },
];

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

export function AuraChatWorkspace({ apiBaseUrl = "", token = null, user = null }) {
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [emptyInput, setEmptyInput] = useState("");
  const [emptyScope, setEmptyScope] = useState("all");
  const [emptyScopeOpen, setEmptyScopeOpen] = useState(false);
  const [emptyListening, setEmptyListening] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const emptyTextareaRef = useRef(null);

  const {
    conversations,
    legacyConversations,
    activeConversationId,
    activeConversation,
    isLegacyActive,
    setActiveConversationId,
    createNewConversation,
    deleteConversation,
    messages,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    confirmProposal,
    rejectProposal,
    isStreaming
  } = useHiringManagerChat({ apiBaseUrl, token, user });

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!hasMessages && emptyTextareaRef.current) {
      emptyTextareaRef.current.focus();
    }
  }, [hasMessages]);

  const handleEmptySend = (promptToSend) => {
    const text = (promptToSend || emptyInput).trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setEmptyInput("");
  };

  const handleEmptyKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEmptySend();
    }
  };

  const toggleEmptyListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (emptyListening) {
      setEmptyListening(false);
    } else {
      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setEmptyInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setEmptyListening(false);
        };
        recognition.onerror = () => setEmptyListening(false);
        recognition.onend = () => setEmptyListening(false);
        recognition.start();
        setEmptyListening(true);
      } catch {
        setEmptyListening(false);
      }
    }
  };

  const scopeLabels = {
    all: "Entire workspace",
    requisitions: "Open Requisitions",
    candidates: "Candidate Pipeline",
    timesheets: "Timesheet Approvals",
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-white relative overflow-hidden select-text font-sans antialiased">
      {/* Workspace Top Bar matching NEXUS exactly */}
      <ChatHeader
        onNewChat={createNewConversation}
        isStreaming={isStreaming}
        conversations={conversations}
        legacyConversations={legacyConversations}
        activeConversationId={activeConversationId}
        isLegacyActive={isLegacyActive}
        onSelectConversation={setActiveConversationId}
        onDeleteConversation={deleteConversation}
        onStartVoiceCall={() => setVoiceModalOpen(true)}
      />

      {/* Main Workspace Chat Canvas */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-white">
        {!hasMessages ? (
          /* ==================================================================
             INITIAL EMPTY STATE (MATCHING NEXUS AI WORKSPACE SCREENSHOT 1:1)
             ================================================================== */
          <div className="flex-1 flex flex-col justify-center items-center px-4 max-w-3xl mx-auto w-full -mt-6 sm:-mt-10">
            {/* Large elegant serif headline matching NEXUS screenshot */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-normal text-[#111111] tracking-tight text-center mb-8 select-none">
              Where should we begin?
            </h1>

            {/* Wide rounded prompt composer */}
            <div className="w-full rounded-3xl border border-[#EAEAEA] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.03)] hover:border-[#D0D0D0] focus-within:border-[#111111] focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all p-3.5 sm:p-4.5">
              {/* Prompt input textarea */}
              <textarea
                ref={emptyTextareaRef}
                value={emptyInput}
                onChange={(e) => setEmptyInput(e.target.value)}
                onKeyDown={handleEmptyKeyDown}
                placeholder="Ask anything about your requisitions, candidates, or team..."
                rows={2}
                className="w-full bg-transparent resize-none border-0 p-0 text-base text-[#111111] placeholder:text-[#999999] focus:outline-none focus:ring-0 min-h-[58px] max-h-40 leading-relaxed"
              />

              {/* Bottom controls bar: limit circle & scope dropdown at left, languages, mic & circular send at right */}
              <div className="flex items-center justify-between pt-2.5 border-t border-[#F5F5F5] mt-1">
                <div className="flex items-center gap-2">
                  <AiLimitCircle />

                  {/* Scope Selector Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmptyScopeOpen(!emptyScopeOpen)}
                      className="h-6 rounded-md bg-[#F4F4F5] hover:bg-[#EBEBEF] text-[#444444] hover:text-[#111111] text-[11px] font-medium px-2.5 py-0 border-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span>{scopeLabels[emptyScope]}</span>
                      <ChevronDown className="size-3 text-[#777777]" />
                    </button>

                    {emptyScopeOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setEmptyScopeOpen(false)}
                        />
                        <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border border-[#EAEAEA] shadow-lg rounded-xl z-40 p-1 text-xs">
                          {Object.entries(scopeLabels).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setEmptyScope(key);
                                setEmptyScopeOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                                emptyScope === key
                                  ? "bg-[#F4F4F5] font-semibold text-[#111111]"
                                  : "text-[#555555] hover:bg-[#FAFAFA] hover:text-[#111111]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Spoken Language Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLangOpen(!langOpen)}
                      className="p-2 text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] rounded-full transition-colors cursor-pointer"
                      title="Spoken Language"
                    >
                      <Languages className="size-4 stroke-[1.8]" />
                    </button>

                    {langOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
                        <div className="absolute right-0 bottom-full mb-1 w-36 bg-white border border-[#EAEAEA] shadow-lg rounded-xl z-40 p-1 text-xs">
                          <div className="text-[10px] text-[#777777] px-2 py-1 font-semibold uppercase tracking-wider">
                            Language
                          </div>
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <button
                              key={l.code}
                              type="button"
                              onClick={() => {
                                setSelectedLang(l.code);
                                setLangOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                                selectedLang === l.code
                                  ? "bg-[#F4F4F5] font-semibold text-[#111111]"
                                  : "text-[#555555] hover:bg-[#FAFAFA] hover:text-[#111111]"
                              }`}
                            >
                              <span>{l.name}</span>
                              {selectedLang === l.code && <Check className="size-3 text-emerald-600" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Microphone Voice Button */}
                  <button
                    type="button"
                    onClick={toggleEmptyListening}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      emptyListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]"
                    }`}
                    title={emptyListening ? "Listening... click to stop" : "Voice dictation"}
                  >
                    {emptyListening ? <MicOff className="size-4" /> : <Mic className="size-4 stroke-[1.8]" />}
                  </button>

                  {/* Circular Send Button */}
                  <button
                    type="button"
                    onClick={() => handleEmptySend()}
                    disabled={!emptyInput.trim() || isStreaming}
                    className={`size-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      emptyInput.trim() && !isStreaming
                        ? "bg-[#111111] text-white hover:bg-black scale-100 shadow-xs"
                        : "bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed"
                    }`}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="size-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Subtle AI accuracy disclaimer below composer */}
            <p className="text-center text-xs text-[#777777] mt-3 select-none">
              TermJobs AI can make mistakes. Please verify important workspace actions.
            </p>

            {/* Three equally sized suggestion cards in one horizontal row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-6">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleEmptySend(item.prompt)}
                  className="group rounded-xl border border-[#EAEAEA] bg-white p-3.5 text-left hover:border-[#111111] hover:bg-[#FAFAFA] transition-all cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#111111] group-hover:text-black">
                        {item.title}
                      </span>
                      <ArrowUpRight className="size-3.5 text-[#999999] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-[#777777] leading-relaxed">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ==================================================================
             ACTIVE CONVERSATION STATE
             ================================================================== */
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-white">
            <MessageList
              messages={messages}
              onConfirmProposal={confirmProposal}
              onRejectProposal={rejectProposal}
              isStreaming={isStreaming}
              onRetry={retryLastMessage}
            />

            {/* Bottom Active Input Composer */}
            {isLegacyActive ? (
              <div className="p-3 text-center bg-[#FAFAFA] border-t border-[#EAEAEA] text-xs text-[#555555] flex items-center justify-center gap-3 shrink-0">
                <span>This legacy conversation is read-only.</span>
                <button
                  type="button"
                  onClick={createNewConversation}
                  className="px-3 py-1.5 rounded-full bg-[#111111] text-white text-xs font-medium hover:bg-black transition cursor-pointer"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              <InputComposer
                onSend={sendMessage}
                onSendMessage={sendMessage}
                onStop={stopStreaming}
                isStreaming={isStreaming}
              />
            )}
          </div>
        )}
      </div>

      {/* Modal Dialog for Configuring API Keys & Models */}
      <AiConfigDialog />

      {/* Voice Call Modal */}
      {voiceModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center relative animate-in zoom-in-95 border border-[#EAEAEA]">
            <button
              type="button"
              onClick={() => setVoiceModalOpen(false)}
              className="absolute top-4 right-4 text-[#777777] hover:text-[#111111] cursor-pointer"
            >
              <X className="size-4" />
            </button>
            <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse border border-emerald-100">
              <PhoneCall className="size-7" />
            </div>
            <h3 className="text-base font-semibold text-[#111111] mb-1 font-serif">
              Conversational Voice Agent
            </h3>
            <p className="text-xs text-[#777777] mb-6 leading-relaxed">
              Full duplex voice briefing session active. Speak directly to query open requisitions, candidate pipeline, or review SLA status.
            </p>
            <button
              type="button"
              onClick={() => setVoiceModalOpen(false)}
              className="w-full py-2.5 rounded-full bg-[#111111] hover:bg-black text-white text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              End Voice Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuraChatWorkspace;
