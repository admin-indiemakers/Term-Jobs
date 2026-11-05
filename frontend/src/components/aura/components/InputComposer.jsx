import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Square,
  Mic,
  MicOff,
  ChevronDown,
  Languages,
  Check
} from "lucide-react";
import { AiLimitCircle } from "./AiLimitCircle";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

/**
 * Bottom docked InputComposer for active chat session matching NEXUS AI Workspace.
 */
export function InputComposer({
  onSend,
  onSendMessage,
  onStop,
  isStreaming,
  placeholder = "Ask anything about your requisitions, candidates, or team..."
}) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [scope, setScope] = useState("all");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const textareaRef = useRef(null);

  // Auto-resize textarea up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [text]);

  // Listen for custom aura_fill_composer events dispatched by interactive chips/buttons
  useEffect(() => {
    const handleFill = (e) => {
      const fillText = e.detail?.text;
      if (fillText) {
        setText((prev) => {
          const trimmedPrev = prev.trim();
          if (!trimmedPrev) return fillText;
          if (fillText.length > 25) {
            return fillText;
          }
          if (trimmedPrev.toLowerCase().includes(fillText.toLowerCase())) {
            return trimmedPrev;
          }
          return `${trimmedPrev}, ${fillText}`;
        });
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };
    window.addEventListener("aura_fill_composer", handleFill);
    return () => window.removeEventListener("aura_fill_composer", handleFill);
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isStreaming) return;
    const sendHandler = onSend || onSendMessage;
    if (typeof sendHandler === "function") {
      sendHandler(text.trim());
    }
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      setIsListening(false);
    } else {
      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
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
    <div className="px-4 pt-1 pb-4 bg-white shrink-0 z-10">
      <div className="max-w-3xl mx-auto">
        {/* Floating Composer Container matching NEXUS Composer */}
        <div className="w-full rounded-2xl border border-[#EAEAEA] bg-white hover:border-[#D0D0D0] focus-within:border-[#111111] focus-within:shadow-[0_2px_14px_rgba(0,0,0,0.04)] transition-all px-3.5 py-2.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-transparent resize-none border-0 p-0 text-sm text-[#111111] placeholder:text-[#999999] focus:outline-none focus:ring-0 min-h-[34px] max-h-36 leading-relaxed py-0.5"
          />

          <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5] mt-1">
            {/* Left: AI Limit Circle & Scope Selector */}
            <div className="flex items-center gap-2 relative">
              <AiLimitCircle />

              {/* Scope Selector dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setScopeOpen(!scopeOpen)}
                  className="h-6 rounded-md bg-[#F4F4F5] hover:bg-[#EBEBEF] text-[#444444] hover:text-[#111111] text-[11px] font-medium px-2.5 py-0 border-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>{scopeLabels[scope]}</span>
                  <ChevronDown className="size-3 text-[#777777]" />
                </button>

                {scopeOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setScopeOpen(false)}
                    />
                    <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border border-[#EAEAEA] shadow-lg rounded-xl z-40 p-1 text-xs">
                      {Object.entries(scopeLabels).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setScope(key);
                            setScopeOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            scope === key
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

            {/* Right: Languages + Mic + Send / Stop Button */}
            <div className="flex items-center gap-1.5">
              {/* Spoken Language Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangOpen(!langOpen)}
                  className="p-1.5 text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] rounded-full transition-colors cursor-pointer"
                  title="Spoken Language"
                >
                  <Languages className="size-3.5 stroke-[1.8]" />
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

              {/* Mic Dictation */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]"
                }`}
                title={isListening ? "Listening... click to stop" : "Voice dictation"}
              >
                {isListening ? (
                  <MicOff className="size-3.5" />
                ) : (
                  <Mic className="size-3.5" />
                )}
              </button>

              {/* Circular Send or Stop Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="size-7 rounded-full bg-[#111111] text-white hover:bg-black flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Stop generating"
                >
                  <Square className="size-3 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className={`size-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    text.trim()
                      ? "bg-[#111111] text-white hover:bg-black scale-100 shadow-xs active:scale-95"
                      : "bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed"
                  }`}
                  title="Send message (Enter)"
                >
                  <ArrowUp className="size-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subtle AI accuracy disclaimer below composer */}
        <p className="text-center text-[11px] text-[#777777] mt-2 select-none">
          TermJobs AI can make mistakes. Please verify important workspace actions.
        </p>
      </div>
    </div>
  );
}

export default InputComposer;
