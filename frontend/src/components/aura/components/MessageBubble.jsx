import React, { useState, useMemo } from "react";
import {
  Sparkles,
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThinkingAccordion } from "./ThinkingAccordion";
import { CardHost } from "../cards/CardHost";
import { CandidateComparisonCard } from "../cards/CandidateComparisonCard";

/**
 * Helper to parse candidates formatted as markdown tables or bullet points into structured list items
 */
function parseCandidatesFromText(text) {
  if (!text) return { cands: null, introText: text, outroText: "" };

  // 1. Check for markdown table of candidates
  // Tables with "Requisition" or "Job Title" are requisition tables, not candidate lists.
  const isRequisitionTable = /\|[^\r\n]*(?:Requisition|Job Title)[^\r\n]*\|/i.test(text);
  if (!isRequisitionTable) {
    const tableRegex = new RegExp(
      "\\|[^\\r\\n]*(?:Candidate(?:\\s+Name|\\s+ID)?|Applicant|Full\\s*Name)[^\\r\\n]*\\|\\r?\\n\\s*\\|[\\s\\-:|]+\\|\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\r?\\n|\\r?\\n[A-Za-z]|$)",
      "i"
    );
    const match = text.match(tableRegex);
    if (match) {
      const fullTable = match[0];
      const lines = fullTable.trim().split(/\r?\n/);
      if (lines.length >= 3) {
        const headerCells = lines[0].split('|').map(c => c.trim().toLowerCase()).filter(Boolean);
        const rows = lines.slice(2);
        const cands = [];

        for (const row of rows) {
          if (!row.includes('|')) continue;
          const cells = row.split('|').map(c => c.trim());
          if (cells.length > 0 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          if (cells.length === 0) continue;

          const cand = {};
          headerCells.forEach((h, idx) => {
            const val = (cells[idx] || '').replace(/\*\*/g, '').trim();
            if ((h.includes('name') || h === 'candidate' || h === 'applicant') && !h.includes('company')) {
              cand.candidate_name = val;
            } else if (/\b(?:cnd|candidate\s*id)\b/i.test(h) || (/\bid\b/i.test(h) && val.toUpperCase().startsWith('CND-'))) {
              cand.candidate_id = val;
            } else if (h.includes('status')) {
              cand.status = val;
            } else if (h.includes('note') || h.includes('role')) {
              cand.role = val;
            }
          });

          // Only treat as candidate if an actual name or CND- ID was provided
          if (cand.candidate_name || (cand.candidate_id && cand.candidate_id.toUpperCase().startsWith('CND-'))) {
            cands.push(cand);
          }
        }

        if (cands.length > 0) {
          const tableIndex = text.indexOf(fullTable);
          const intro = text.slice(0, tableIndex).trim();
          const outro = text.slice(tableIndex + fullTable.length).trim();
          return { cands, introText: intro, outroText: outro };
        }
      }
    }
  }

  // 2. Fallback to bullet point candidates
  const hasCandidateBullets = new RegExp(
    "\\b1\\.\\s+[A-Za-z].*?\\n\\s*[�\\-*]\\s*(?:Role|Email|Status|Match):",
    "i"
  ).test(text);

  if (!hasCandidateBullets) {
    return { cands: null, introText: text, outroText: "" };
  }

  // Extract intro text before the first candidate item or header
  const parts = text.split(/(?:Candidates List|\b1\.\s+[A-Z])/i);
  const introText = parts[0]?.trim() || "";

  // Split into individual numbered candidate blocks
  const blocks = text.split(/\n(?=\d+\.\s+)/);
  const cands = [];

  for (const b of blocks) {
    const match = b.trim().match(/^(\d+)\.\s+([^\n]+)/);
    if (!match) continue;

    const name = match[2].trim();
    const cand = { candidate_name: name };

    for (const line of b.split("\n")) {
      const cleanLine = line.trim().replace(/^[�\-*]\s*/, "").trim();
      if (cleanLine.includes(":")) {
        const idx = cleanLine.indexOf(":");
        const k = cleanLine.slice(0, idx).trim().toLowerCase();
        const v = cleanLine.slice(idx + 1).trim();

        if (k.includes("role") || k.includes("position")) {
          cand.role = v;
        } else if (k.includes("email")) {
          cand.email = v;
        } else if (k.includes("phone")) {
          cand.phone = v;
        } else if (k.includes("status")) {
          cand.status = v;
        } else if (k.includes("match score") || k.includes("score")) {
          cand.match_score = v.replace(/[^\d.]/g, "");
        } else if (k.includes("skill")) {
          cand.matched_skills = v.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    cands.push(cand);
  }

  return { cands: cands.length > 0 ? cands : null, introText, outroText: "" };
}

export function MessageBubble({
  message,
  onConfirmProposal,
  onRejectProposal,
  isLast = false,
  isStreaming = false,
  onRetry
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isUser = message.role === "user";

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="group/user flex items-start justify-end gap-2.5 w-full mb-6 animate-in fade-in duration-200">
        <div className="relative flex flex-col items-end max-w-[85%] sm:max-w-[78%]">
          <div className="rounded-2xl rounded-tr-xs bg-[#111111] text-white px-4.5 py-3 text-sm leading-relaxed shadow-xs font-normal selection:bg-white/20 w-fit min-w-[3rem] max-w-full break-words">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="opacity-0 group-hover/user:opacity-100 transition-opacity mt-1 flex items-center gap-1.5 text-[11px] text-[#888888] px-1">
            <button
              type="button"
              onClick={() => handleCopy(message.content)}
              className="hover:text-[#111111] p-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Copy prompt"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  <span className="text-[10px] text-emerald-600 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="size-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 shadow-2xs">
          <User className="size-3.5" />
        </div>
      </div>
    );
  }

  // Determine if this turn is currently generating
  const isGenerating = Boolean(message.isStreaming || (isLast && isStreaming));

  const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0);
  const hasThinking = Boolean(
    hasToolCalls || (message.thinking && message.thinking.length > 0)
  );

  // Check if an existing UI Card for candidates is already attached
  const hasCandidateCard = Boolean(
    message.uiCards &&
      message.uiCards.some(
        (c) =>
          c.cardType === "candidate_comparison_table" ||
          c.cardType === "candidate_search_results_card" ||
          c.cardType === "candidate_dossier_card"
      )
  );

  // Parse or de-duplicate candidate details so they are never presented twice
  const { introContent, outroContent, inlineCandidates, displayContent } = useMemo(() => {
    const rawContent = message.content || "";
    return {
      introContent: rawContent,
      outroContent: "",
      inlineCandidates: null,
      displayContent: rawContent
    };
  }, [message.content]);

  return (
    <div className="group/assistant w-full space-y-2.5 mb-7 animate-in fade-in duration-200">
      {/* Assistant Header matching NEXUS AI 1:1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="TermJobs AI"
              className={`size-7 object-contain ${isGenerating ? "animate-pulse" : ""}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#111111] tracking-tight">
              TermJobs AI
            </span>
            <span className="text-[10px] text-[#666666] font-medium bg-[#F4F4F5] px-2 py-0.5 rounded-full border border-[#EAEAEA]">
              Workspace Assistant
            </span>

            {isGenerating && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium ml-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                Thinking…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Body: Clean canvas layout with NO BORDER, matching NEXUS AI 1:1 */}
      <div className="pl-9 space-y-3">
        {/* Tool execution accordion hidden per user preference */}

        {/* Clean concise intro/markdown text (without redundant duplicate bullets) */}
        {introContent ? (
          <div className="text-sm text-[#1A1A1A] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-[#111111] [&_code]:rounded-md [&_code]:bg-[#F3F4F6] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_pre]:my-3.5 [&_pre]:rounded-xl [&_pre]:bg-[#18181B] [&_pre]:p-4 [&_pre]:text-white [&_table]:my-3.5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#E5E7EB] [&_th]:bg-[#F9FAFB] [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-[#E5E7EB] [&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3.5 [&_blockquote]:italic [&_blockquote]:text-[#666666]">
            <MarkdownRenderer content={introContent} />
          </div>
        ) : null}

        {/* Single Sleek List UI Response (Rendered once cleanly in-place) */}
        {inlineCandidates && inlineCandidates.length > 0 && (
          <CandidateComparisonCard data={{ candidates: inlineCandidates }} />
        )}

        {/* Outro text (e.g. important notes, summary, suggested actions) */}
        {outroContent ? (
          <div className="text-sm text-[#1A1A1A] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-[#111111] [&_code]:rounded-md [&_code]:bg-[#F3F4F6] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_pre]:my-3.5 [&_pre]:rounded-xl [&_pre]:bg-[#18181B] [&_pre]:p-4 [&_pre]:text-white [&_table]:my-3.5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#E5E7EB] [&_th]:bg-[#F9FAFB] [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-[#E5E7EB] [&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3.5 [&_blockquote]:italic [&_blockquote]:text-[#666666]">
            <MarkdownRenderer content={outroContent} />
          </div>
        ) : null}

        {/* UI Cards (Proposal Confirmations, Tool Results) */}
        {message.uiCards && message.uiCards.some((c) => c && c.cardType === "proposal_confirmation_card") && (
          <div className="space-y-2.5 pt-1">
            {message.uiCards
              .filter((c) => c && c.cardType === "proposal_confirmation_card")
              .map((card, idx) => (
                <CardHost
                  key={idx}
                  card={card}
                  onConfirm={onConfirmProposal}
                  onReject={onRejectProposal}
                />
              ))}
          </div>
        )}

        {/* NEXUS Inline Analyzing Indicator with 3 Bouncing Emerald Dots */}
        {isGenerating && (
          <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3.5 py-2 text-xs text-[#666666] flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] animate-in fade-in duration-200">
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
        )}

        {/* Action Toolbar: Only shown once response finishes generating */}
        {!isGenerating && (introContent || outroContent || inlineCandidates || (message.uiCards && message.uiCards.length > 0)) && (
          <div className="pt-2 flex items-center justify-between border-t border-[#F5F5F5] mt-2 select-none">
            <div className="flex items-center gap-1">
              {/* Copy Button */}
              <button
                type="button"
                onClick={() => handleCopy(message.content)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[#666666] hover:bg-[#F4F4F5] hover:text-[#111111] transition-colors cursor-pointer"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span className="text-[11px] font-medium text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>

              {/* Thumbs Up Helpful Button */}
              <button
                type="button"
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  feedback === "up"
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-[#888888] hover:bg-[#F4F4F5] hover:text-[#111111]"
                }`}
                title="Helpful"
              >
                <ThumbsUp className={`size-3.5 ${feedback === "up" ? "fill-emerald-600" : ""}`} />
              </button>

              {/* Thumbs Down Unhelpful Button */}
              <button
                type="button"
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  feedback === "down"
                    ? "bg-amber-50 text-amber-600"
                    : "text-[#888888] hover:bg-[#F4F4F5] hover:text-[#111111]"
                }`}
                title="Not helpful"
              >
                <ThumbsDown className={`size-3.5 ${feedback === "down" ? "fill-amber-600" : ""}`} />
              </button>

              {/* Retry Button on Last Message */}
              {isLast && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[#666666] hover:bg-[#F4F4F5] hover:text-[#111111] transition-colors cursor-pointer ml-1"
                  title="Regenerate answer"
                >
                  <RotateCcw className="size-3" />
                  <span className="text-[11px]">Retry</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
