import React from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  Briefcase,
  Users,
  Clock,
  CheckSquare,
  History,
  Archive,
  ArrowRight,
  ExternalLink
} from "lucide-react";

export function ChatSidebar({
  conversations = [],
  legacyConversations = [],
  activeId,
  onSelectConversation,
  onNewChat,
  onQuickPrompt,
  isOpen = true
}) {
  if (!isOpen) return null;

  const quickCategories = [
    { label: "Check Open Requisitions", prompt: "Show all my open requisitions", icon: Briefcase },
    { label: "Pending Timesheets", prompt: "What contractor timesheets are awaiting approval?", icon: Clock },
    { label: "Review Top Candidates", prompt: "Find the top shortlisted candidates and compare them", icon: Users },
    { label: "Contractor Expiry Alerts", prompt: "Are there any contractor contracts expiring within 30 days?", icon: CheckSquare }
  ];

  return (
    <aside className="w-68 border-r border-[#EAEAEA] bg-[#FAFAF8] p-3.5 flex flex-col justify-between hidden md:flex shrink-0 select-none animate-in slide-in-from-left duration-200">
      <div className="space-y-4 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-black active:scale-95 transition cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Operation</span>
        </button>

        {/* 1. Aura Active Conversations */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
              Aura Conversations
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              Live AI
            </span>
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectConversation(c.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                  c.id === activeId
                    ? "bg-white text-[#111111] font-semibold shadow-xs border border-[#EAEAEA]"
                    : "text-[#555555] hover:bg-white/80 hover:text-[#111111]"
                }`}
              >
                <MessageSquare className="size-3.5 text-[#888888] flex-shrink-0" />
                <span className="truncate">{c.title || "Untitled Operation"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Legacy Assistant Read-Only History */}
        {legacyConversations.length > 0 && (
          <div className="border-t border-[#EAEAEA] pt-3">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <History className="size-3" />
                Legacy History
              </span>
              <span className="text-[9px] text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-medium">
                Read-Only
              </span>
            </div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {legacyConversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectConversation(c.id)}
                  title="Archived conversation from legacy assistant (read-only)"
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                    c.id === activeId
                      ? "bg-amber-50/80 text-amber-950 font-semibold shadow-xs border border-amber-200"
                      : "text-slate-600 hover:bg-amber-50/40 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Archive className="size-3 text-amber-600 flex-shrink-0" />
                    <span className="truncate">{c.title || "Legacy Chat"}</span>
                  </div>
                  <span className="text-[9px] text-amber-600 bg-amber-100/60 px-1 py-0.2 rounded shrink-0">
                    Legacy
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Hiring Operations Shortcuts */}
        <div className="border-t border-[#EAEAEA] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#888888] px-2 mb-1.5">
            Hiring Shortcuts
          </div>
          <div className="space-y-0.5">
            {quickCategories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onQuickPrompt(cat.prompt)}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#555555] hover:bg-white hover:text-[#111111] hover:border hover:border-[#EAEAEA] transition cursor-pointer"
                >
                  <Icon className="size-3.5 text-[#888888] flex-shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer with Legacy Assistant Link */}
      <div className="border-t border-[#EAEAEA] pt-3 text-[11px] text-[#888888] flex flex-col gap-2">
        <Link
          to="/dashboard/hiring-manager/legacy"
          className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
        >
          <span className="flex items-center gap-1.5">
            <History className="size-3.5 text-slate-500" />
            Legacy Assistant
          </span>
          <ArrowRight className="size-3 text-slate-400" />
        </Link>
        <div className="flex items-center justify-between px-1">
          <span>Portal: <span className="font-medium text-[#111111]">TermJobs</span></span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200">
            HM Portal
          </span>
        </div>
      </div>
    </aside>
  );
}

export default ChatSidebar;
