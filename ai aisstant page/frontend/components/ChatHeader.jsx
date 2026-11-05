import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  History,
  PhoneCall,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  MessageSquare,
  Trash2,
  Search,
  ChevronRight,
  Clock
} from "lucide-react";
import { useUserAiConfig, openAiConfigDialog } from "../hooks/useUserAiConfig";

/**
 * Workspace Header matching NEXUS AI Workspace 1:1.
 * Controls:
 * Left: [Toggle Sidebar Icon] Nexus AI Workspace
 * Right: [● OpenRouter Free Router] [Call Agent] [+] [History]
 */
export function ChatHeader({
  onNewChat,
  isStreaming,
  conversations = [],
  legacyConversations = [],
  activeConversationId,
  isLegacyActive = false,
  onSelectConversation,
  onDeleteConversation,
  onStartVoiceCall
}) {
  const { stats } = useUserAiConfig();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
    window.dispatchEvent(new CustomEvent("toggle_nexus_sidebar"));
  };

  const handleOpenMobileNav = () => {
    window.dispatchEvent(new CustomEvent("open_nexus_mobile_nav"));
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLegacy = legacyConversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const modelRaw = stats?.selectedModel || "";
  const modelDisplayName = modelRaw.includes("free")
    ? "OpenRouter Free Router"
    : modelRaw
    ? modelRaw.split("/").pop()
    : "OpenRouter Free Router";

  return (
    <>
      <header className="h-14 border-b border-[#EAEAEA] pl-4 sm:pl-6 pr-3 sm:pr-4 flex items-center justify-between shrink-0 bg-white z-20 select-none">
        {/* Left Side: Sidebar Toggle & Title */}
        <div className="flex items-center gap-2">
          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={handleOpenMobileNav}
            className="md:hidden size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] flex items-center justify-center transition-colors cursor-pointer"
            title="Open navigation"
          >
            <Menu className="size-4" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="hidden md:flex size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] items-center justify-center transition-colors cursor-pointer"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>

          <span className="text-xs font-medium text-[#777777]">TermJobs AI Workspace</span>

          {isLegacyActive && (
            <span className="ml-2 rounded-full bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[10px] font-semibold border border-amber-200">
              Legacy Read-Only
            </span>
          )}
        </div>

        {/* Right Side Controls: [● OpenRouter Free Router] [Call Agent] [+] [History] */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Model & Limit Badge */}
          <button
            type="button"
            onClick={openAiConfigDialog}
            className="h-7 px-3 rounded-full border border-[#E8E3D8] bg-white hover:bg-[#F4F1EA] text-[#48433C] text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Configure AI model and API keys"
          >
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-[11px] sm:text-xs truncate max-w-[140px]">
              {modelDisplayName}
            </span>
          </button>

          {/* Live Voice Call Agent Button */}
          <button
            type="button"
            onClick={onStartVoiceCall}
            className="h-7 gap-1.5 px-3 rounded-full text-xs font-semibold border border-[#E8E3D8] bg-white hover:bg-[#F4F1EA] text-[#111111] flex items-center transition cursor-pointer shadow-2xs"
            title="Start voice call with conversational AI agent"
          >
            <PhoneCall className="size-3 text-emerald-600" />
            <span>Call Agent</span>
          </button>

          {/* New Chat Icon Button (+) */}
          <button
            type="button"
            onClick={onNewChat}
            className="size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] flex items-center justify-center transition-colors cursor-pointer"
            title="Start new conversation"
          >
            <Plus className="size-4 stroke-[2]" />
          </button>

          {/* Conversation History Icon Button (Clock/History) */}
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              historyOpen
                ? "bg-[#111111] text-white"
                : "text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]"
            }`}
            title="Conversation history"
          >
            <History className="size-4 stroke-[1.8]" />
          </button>
        </div>
      </header>

      {/* Slide-over Drawer for History */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setHistoryOpen(false)}
          />

          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-50 border-l border-[#EAEAEA] animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#EAEAEA] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <History className="size-4 text-[#111111]" />
                <div>
                  <h3 className="text-xs font-semibold text-[#111111]">
                    Conversation History
                  </h3>
                  <p className="text-[11px] text-[#777777]">
                    {conversations.length} active sessions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onNewChat();
                    setHistoryOpen(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#111111] hover:bg-black text-white text-[11px] font-medium transition cursor-pointer"
                  title="New conversation"
                >
                  <Plus className="size-3" />
                  <span>New</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="p-1 rounded-md text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-[#EAEAEA] bg-white">
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search past conversations..."
                  className="w-full bg-[#F5F5F5] border border-[#EAEAEA] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#111111] placeholder:text-[#999999] focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            {/* Conversation Lists Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777777] px-2 py-1 flex items-center justify-between">
                  <span>Conversations</span>
                  <span className="font-mono text-[#111111]">{filteredConversations.length}</span>
                </div>

                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <p className="text-xs text-[#999999]">No matching conversations found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredConversations.map((c) => {
                      const isActive = c.id === activeConversationId;
                      return (
                        <div
                          key={c.id}
                          className={`group flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer ${
                            isActive
                              ? "bg-[#F4F4F5] text-[#111111] font-medium"
                              : "text-[#444444] hover:bg-[#FAFAFA] hover:text-[#111111]"
                          }`}
                          onClick={() => {
                            onSelectConversation(c.id);
                            setHistoryOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <MessageSquare className="size-3.5 shrink-0 text-[#888888] group-hover:text-[#111111]" />
                            <div className="truncate text-xs leading-snug">
                              {c.title || "Untitled Session"}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onDeleteConversation && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteConversation(c.id);
                                }}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition hover:text-rose-600 text-[#999999] cursor-pointer"
                                title="Delete conversation"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                            <ChevronRight className="size-3.5 opacity-40" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Legacy Conversations Section */}
              {legacyConversations.length > 0 && (
                <div className="pt-2 border-t border-[#F0F0F0]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 px-2 py-1 flex items-center justify-between">
                    <span>Legacy History</span>
                    <span className="font-mono">{filteredLegacy.length}</span>
                  </div>

                  <div className="space-y-1">
                    {filteredLegacy.map((c) => {
                      const isActive = c.id === activeConversationId;
                      return (
                        <div
                          key={c.id}
                          className={`group flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer ${
                            isActive
                              ? "bg-amber-50 text-amber-950 font-medium border border-amber-200"
                              : "hover:bg-amber-50/50 text-[#555555]"
                          }`}
                          onClick={() => {
                            onSelectConversation(c.id);
                            setHistoryOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <Clock className="size-3.5 text-amber-700 shrink-0" />
                            <div className="truncate text-xs leading-snug">
                              {c.title || "Legacy Session"}
                            </div>
                          </div>
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono shrink-0">
                            Legacy
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-[#EAEAEA] bg-[#FAFAFA] text-center">
              <p className="text-[11px] text-[#777777]">
                Click any session to review full interaction log.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatHeader;
