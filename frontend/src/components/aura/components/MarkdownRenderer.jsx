import React, { useMemo } from "react";
import { Marked } from "marked";

/**
 * Pre-processes markdown text before parsing to convert unstructured text patterns
 * into compact, modern executive list components:
 * 1. Role Specification Questionnaire (compact horizontal list with inline chips)
 * 2. Inferred Role Defaults (compact horizontal pills)
 * 3. Suggested Next Actions (compact inline action buttons)
 * 4. Executive Status Headers (compact status banners)
 */
function preProcessMarkdown(text) {
  if (!text) return "";
  // Auto-repair malformed markdown tables where delimiter row column count does not match header
  text = text.replace(/(\|.+?\n)\s*(\|[\s\-:|]+?\n)/g, (match, headerLine, delimLine) => {
    const headerCols = headerLine.split('|').map(c => c.trim()).filter(Boolean);
    const delimCols = delimLine.split('|').map(c => c.trim()).filter(Boolean);

    if (headerCols.length > 0 && delimCols.length !== headerCols.length) {
      const fixedDelim = '| ' + headerCols.map(() => '---').join(' | ') + ' |\n';
      return headerLine + fixedDelim;
    }
    return match;
  });


  // 1. Executive Status Headers (e.g., 🟢 Published & Active (4), 🔴 Closed (4), ⏳ Pending (8))
  text = text.replace(/^(🟢|🔴|⏳|⚠️|✅)\s*(\*\*)?([^\n]+?)(\*\*)?$/gm, (match, icon, b1, title, b2) => {
    let color = "emerald";
    let dotAnim = "animate-pulse";
    if (icon === "🔴") { color = "rose"; dotAnim = ""; }
    else if (icon === "⏳" || icon === "⚠️") { color = "amber"; dotAnim = ""; }
    else if (icon === "✅") { color = "emerald"; dotAnim = ""; }

    return `\n\n<div class="mt-2.5 mb-1.5 px-3 py-1.5 rounded-lg bg-${color}-50/80 border border-${color}-200/80 text-${color}-900 flex items-center justify-between text-xs font-semibold shadow-2xs">` +
      `<div class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-${color}-500 ${dotAnim}"></span><span>${title.trim()}</span></div>` +
      `<span class="text-[10px] font-medium text-${color}-700 bg-${color}-100/70 px-1.5 py-0.5 rounded">Status</span>` +
      `</div>\n\n`;
  });

  // 2. Role Specification Questions Block -> STREAMLINED COMPACT LIST
  const questionsRegex =
    /(?:^|\n)((?:\*\*)?(?:Quick Questions|Questions Before|Intake Questions|A few questions)[^\n:]*:(?:\*\*)?)([\s\S]*?)(?=(?:^|\n)(?:\*\*)?(?:What I Know|Would you like|Typically Use|Next steps)|\n\n[A-Z]|$)/i;

  text = text.replace(questionsRegex, (match, header, body) => {
    const lines = body.trim().split("\n").filter((l) => l.trim());
    const rowItems = lines
      .map((line) => {
        let clean = line.replace(/^[-*•]\s*|^\d+[\.)]\s*/, "").trim();
        const parts = clean.split(/:\s*(.+)/);
        if (parts.length >= 2) {
          const fieldName = parts[0].replace(/\*\*/g, "").trim();
          const fieldQuery = parts[1].replace(/\*\*/g, "").trim();

          let optionsHtml = "";
          // Look for options in parens like (e.g., INR, USD, EUR)
          const parenMatch = fieldQuery.match(/\((?:e\.g\.?,?\s*)?([A-Z0-9,\s\/\-]+)\)/i);
          if (parenMatch) {
            const rawOpts = parenMatch[1]
              .split(/,|\/|\bor\b/i)
              .map((o) => o.trim())
              .filter(
                (o) =>
                  o.length >= 2 &&
                  o.length <= 12 &&
                  !["matching", "your", "previous", "role", "flutter"].includes(o.toLowerCase())
              );
            if (rawOpts.length >= 2) {
              optionsHtml =
                '<div class="flex items-center gap-1 flex-wrap shrink-0 mt-1 sm:mt-0">' +
                rawOpts
                  .map(
                    (opt) =>
                      `<button type="button" data-prompt="${opt}" class="inline-flex items-center text-[11px] font-medium text-[#1C1A17] bg-[#F4F1EA] hover:bg-[#1C1A17] hover:text-white border border-[#E8E4DC] px-2 py-0.5 rounded-md cursor-pointer transition-all shadow-2xs active:scale-95">${opt}</button>`
                  )
                  .join("") +
                "</div>";
            }
          }

          // Look for "X, Y, or Z" or "X or Y" or "X/Y"
          if (!optionsHtml) {
            const orMatch =
              fieldQuery.match(/be\s+([^?]+)\?/i) ||
              fieldQuery.match(
                /([A-Za-z0-9_\-\s]+(?:\s*,\s*[A-Za-z0-9_\-\s]+)*\s+or\s+[A-Za-z0-9_\-\s]+)\??/i
              ) ||
              fieldQuery.match(/([A-Za-z0-9_\-]+)\s*\/\s*([A-Za-z0-9_\-]+)/i);
            if (orMatch) {
              const rawOpts = (
                orMatch[1] && orMatch[2] && !orMatch[0].includes("or")
                  ? [orMatch[1], orMatch[2]]
                  : (orMatch[1] || orMatch[0]).split(/,|\/|\bor\b/i)
              )
                .map((o) => o.trim())
                .filter(
                  (o) =>
                    o.length >= 2 &&
                    !["should", "this", "have", "mind", "be"].includes(o.toLowerCase())
                );
              if (rawOpts.length >= 2) {
                optionsHtml =
                  '<div class="flex items-center gap-1 flex-wrap shrink-0 mt-1 sm:mt-0">' +
                  rawOpts
                    .map(
                      (opt) =>
                        `<button type="button" data-prompt="${opt}" class="inline-flex items-center text-[11px] font-medium text-[#1C1A17] bg-[#F4F1EA] hover:bg-[#1C1A17] hover:text-white border border-[#E8E4DC] px-2 py-0.5 rounded-md cursor-pointer transition-all shadow-2xs active:scale-95">${opt}</button>`
                    )
                    .join("") +
                  "</div>";
              }
            }
          }

          // Smart fallbacks for dates/timing if no options were listed
          if (!optionsHtml && /start date|when do you need/i.test(fieldName + " " + fieldQuery)) {
            const dateOpts = ["Immediately", "Within 2 weeks", "Next month"];
            optionsHtml =
              '<div class="flex items-center gap-1 flex-wrap shrink-0 mt-1 sm:mt-0">' +
              dateOpts
                .map(
                  (opt) =>
                    `<button type="button" data-prompt="${opt}" class="inline-flex items-center text-[11px] font-medium text-[#1C1A17] bg-[#F4F1EA] hover:bg-[#1C1A17] hover:text-white border border-[#E8E4DC] px-2 py-0.5 rounded-md cursor-pointer transition-all shadow-2xs active:scale-95">${opt}</button>`
                )
                .join("") +
              "</div>";
          }

          return `<div class="px-3 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 hover:bg-[#FAF8F5]/70 transition-colors">` +
            `<div class="flex items-baseline gap-2 min-w-0">` +
            `<span class="text-xs font-semibold text-[#1C1A17] shrink-0">${fieldName}:</span>` +
            `<span class="text-xs text-[#7A7369] truncate" title="${fieldQuery}">${fieldQuery}</span>` +
            `</div>` +
            `${optionsHtml}` +
            `</div>`;
        }
        return `<div class="px-3 py-1 text-xs text-slate-700">${clean}</div>`;
      })
      .join("");

    return `\n\n<div class="my-2.5 rounded-xl border border-[#E8E4DC] bg-white shadow-2xs overflow-hidden">` +
      `<div class="px-3 py-1.5 bg-[#FAF8F5] border-b border-[#E8E4DC] flex items-center justify-between text-xs font-semibold text-[#1C1A17]">` +
      `<div class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-[#1C1A17]"></span><span>Role Intake Requirements</span></div>` +
      `<span class="text-[10px] text-[#8C8478] font-normal">Click options to autofill</span>` +
      `</div>` +
      `<div class="divide-y divide-[#F2EFE9]">` +
      `${rowItems}` +
      `</div>` +
      `</div>\n\n`;
  });

  // 3. Inferred Role Defaults Block -> COMPACT HORIZONTAL PILL BAR
  const defaultsRegex =
    /(?:^|\n)((?:\*\*)?(?:What I Know[^\n:]*|Typically Use[^\n:]*|System Defaults[^\n:]*)[^\n:]*:(?:\*\*)?)([\s\S]*?)(?=(?:^|\n)(?:\*\*)?(?:Would you like|Next steps|Options)|\n\n[A-Z]|$)/i;
  text = text.replace(defaultsRegex, (match, header, body) => {
    const pills = body
      .trim()
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const clean = line
          .replace(/^[-*•]\s*|^\d+[\.)]\s*/, "")
          .replace(/\*\*/g, "")
          .trim();
        return `<span class="inline-flex items-center gap-1 text-[11px] bg-white border border-[#DDD6C8] text-[#48433C] px-2 py-0.5 rounded-md font-medium shadow-2xs">` +
          `<span class="text-[#2C2926] font-bold">✓</span>${clean}</span>`;
      })
      .join("");

    return `\n\n<div class="my-2 px-3 py-1.5 rounded-xl bg-[#F7F4EE] border border-[#E0D9CC] text-xs">` +
      `<div class="flex items-center gap-1.5 font-semibold text-[#2C2926] text-[11px] mb-1">` +
      `<span class="size-3.5 rounded-full bg-[#1C1A17] text-[#FAF8F5] flex items-center justify-center text-[9px] font-bold">⚡</span>` +
      `<span>Inferred Defaults (from past requisitions):</span>` +
      `</div>` +
      `<div class="flex items-center gap-1.5 flex-wrap">` +
      `${pills}` +
      `</div>` +
      `</div>\n\n`;
  });

  // 4. Suggested Next Actions Block -> COMPACT INLINE ACTION CHIPS
  const actionRegex =
    /(?:^|\n)((?:\*\*)?(?:Would you like(?: me to)?|Next (?:Steps|Actions)|Suggested Actions)[^\n:]*:(?:\*\*)?)([\s\S]*?)(?=\n(?:Let me know|Please let me|\*\*|#)|\n\n|$)/i;
  text = text.replace(actionRegex, (match, header, body) => {
    const buttons = body
      .trim()
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const clean = line
          .replace(/^[-*•]\s*|^\d+[\.)]\s*/, "")
          .replace(/\*\*/g, "")
          .trim();
        let shortLabel = clean;
        if (/create a draft requisition/i.test(clean)) {
          shortLabel = "⚡ Create draft requisition";
        } else if (/search existing candidates/i.test(clean)) {
          shortLabel = "🔍 Search existing candidates first";
        }
        return `<button type="button" data-prompt="${clean.replace(/"/g, '&quot;')}" class="inline-flex items-center gap-1 text-[11px] font-medium text-[#1C1A17] bg-white hover:bg-[#1C1A17] hover:text-white border border-[#E8E4DC] px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95" title="${clean}">` +
          `<span>${shortLabel}</span>` +
          `</button>`;
      })
      .join("");

    if (!buttons || !buttons.trim()) return match;
    return `\n\n<div class="my-2 flex items-center gap-1.5 flex-wrap text-xs">` +
      `<span class="text-[11px] font-medium text-[#7A7369] mr-1">Suggested:</span>` +
      `${buttons}` +
      `</div>\n\n`;
  });

    // 5. Executive Callout Banner for Important note / Note
  text = text.replace(/(?:^|\n)(\*\*)?(Important note|Note|Notice):(\*\*)?\s*([^\n]+(?:\n[A-Za-z][^\n#*|]+)?)/gi, (match, b1, label, b2, bodyText) => {
    return `\n\n<div class="my-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 flex items-start gap-2.5 text-xs shadow-2xs">` +
      `<span class="font-semibold text-amber-800 shrink-0">?? ${label}:</span>` +
      `<span class="text-amber-900/90 leading-relaxed">${bodyText.trim()}</span>` +
      `</div>\n\n`;
  });

  // 6. Clean up any dangling trailing "Suggested:" or "Next Actions:" labels that have no action items
  text = text.replace(/(?:^|\n)\s*(?:\*\*)?(?:Suggested|Next (?:Steps|Actions))[^\n:]*:(?:\*\*)?\s*$/i, '');

  return text;
}

/**
 * Post-processes HTML to transform raw tokens into sleek badges and chips
 */
function beautifyHtml(html) {
  // Do not perform regex replacements on standard prose to avoid corrupting text like "statuses" or "status,"
  return html || "";
}

export function MarkdownRenderer({ content }) {
  if (!content) return null;

  const html = useMemo(() => {
    const preprocessed = preProcessMarkdown(content);
    const markedInstance = new Marked();

    markedInstance.setOptions({
      breaks: true,
      gfm: true
    });

    markedInstance.use({
      renderer: {
        table(token) {
          const headers = token.header.map((c) => (c.text || "").replace(/\*\*/g, "").trim());

          let headerHtml = '<thead><tr class="border-b border-[#E8E4DC] bg-[#F3EFE7] text-[11px] font-semibold uppercase tracking-wider text-[#3D3A34] select-none">';
          headers.forEach((h, colIdx) => {
            const hLower = h.toLowerCase();
            let alignClass = "text-left";
            let widthClass = "";
            const isId = /\bid\b/i.test(hLower) || hLower.includes("uuid");
            const isCand = hLower.includes("shortlist") || hLower.includes("candidate") || hLower.includes("applicant") || hLower.includes("count");

            if (isId) {
              widthClass = "w-24";
            } else if (hLower.includes("status")) {
              widthClass = "w-24 text-center";
              alignClass = "text-center";
            } else if (isCand) {
              widthClass = "w-40 text-center";
              alignClass = "text-center";
            } else if (hLower.includes("title") || hLower.includes("requisition") || hLower.includes("role")) {
              widthClass = "min-w-[130px]";
            }
            headerHtml += `<th class="px-3.5 py-2.5 ${alignClass} ${widthClass} font-semibold">${h}</th>`;
          });
          headerHtml += '</tr></thead>';

          let bodyHtml = '<tbody class="divide-y divide-[#EBE7DF] bg-white text-xs">';
          for (let i = 0; i < token.rows.length; i++) {
            const row = token.rows[i];
            bodyHtml += `<tr class="hover:bg-[#F7F4EE] transition-colors ${i % 2 === 1 ? 'bg-[#FCFBF9]' : 'bg-white'}">`;

            row.forEach((cell, colIdx) => {
              const rawText = cell.text || "";
              const cleanText = rawText.replace(/\*\*/g, "").trim();
              const lower = cleanText.toLowerCase();
              const colHeader = (headers[colIdx] || "").toLowerCase();

              let cellContent = cleanText;
              let alignClass = "text-left";

              const isIdCol = /\bid\b/i.test(colHeader) || colHeader.includes("uuid");
              const isCandCol = colHeader.includes("shortlist") || colHeader.includes("candidate") || colHeader.includes("applicant") || colHeader.includes("count");

              // 1. Status Column Pills (Only green if necessary; otherwise neutral cream/monochrome)
              if (
                colHeader.includes("status") ||
                ["published", "open", "active", "approved"].includes(lower) ||
                ["closed", "archived", "filled", "inactive"].includes(lower) ||
                ["structuring", "pending approval", "draft", "pending"].includes(lower) ||
                ["rejected", "cancelled"].includes(lower)
              ) {
                alignClass = "text-center";
                if (["published", "open", "active", "approved"].some((s) => lower.includes(s))) {
                  // Green allowed for published / active
                  cellContent = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"><span class="size-1.5 rounded-full bg-emerald-500"></span>${cleanText}</span>`;
                } else {
                  // Clean neutral cream / black / slate for all other statuses (NO blue, NO yellow, NO orange, NO red)
                  cellContent = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F2EFE9] text-[#2C2A26] border border-[#DDD8CE] shadow-2xs"><span class="size-1.5 rounded-full bg-[#787570]"></span>${cleanText}</span>`;
                }
              }
              // 2. Shortlist / Candidates Column
              else if (isCandCol || /^\d+(\s*\(.*\))?$/.test(cleanText)) {
                alignClass = "text-center";
                const numMatch = cleanText.match(/^(\d+)(.*)$/);
                if (numMatch) {
                  const num = parseInt(numMatch[1], 10);
                  const note = numMatch[2] ? numMatch[2].trim().replace(/^\(|\)$/g, "").trim() : "";
                  const badge = num > 0
                    ? `<span class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">${num}</span>`
                    : '<span class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full font-medium text-xs bg-[#F2EFE9] text-[#4A453E] border border-[#DDD8CE]">0</span>';

                  cellContent = note
                    ? `<div class="flex flex-col items-center gap-0.5 py-0.5"><div class="flex items-center gap-1.5">${badge}</div><span class="text-[10px] text-[#555] font-normal leading-tight text-center max-w-[150px]" title="${note}">${note}</span></div>`
                    : badge;
                }
              }
              // 3. Requisition ID / UUID Column (Compact Cream Mono Pill)
              else if (
                isIdCol ||
                /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cleanText) ||
                /^draft-\d+/i.test(cleanText) ||
                cleanText.startsWith("...")
              ) {
                if (cleanText.startsWith("...") || cleanText.includes("other")) {
                  cellContent = '<span class="text-[#777] text-[11px] italic">Other requisitions</span>';
                } else {
                  const match = cleanText.match(/([0-9a-f]{8})-[0-9a-f]{0,4}-?[0-9a-f]{0,4}-?[0-9a-f]{0,4}-?[0-9a-f]{0,12}/i);
                  const draftMatch = cleanText.match(/draft-(\d+)/i);
                  let displayId = cleanText;
                  if (match) {
                    displayId = `#${match[1].toUpperCase()}`;
                  } else if (draftMatch) {
                    displayId = `#DRAFT-${draftMatch[1].slice(-4)}`;
                  } else if (cleanText.length > 12) {
                    displayId = `#${cleanText.slice(0, 8).toUpperCase()}`;
                  }
                  cellContent = `<code class="font-mono text-[10.5px] bg-[#F4F1EA] text-[#1C1A17] font-semibold px-2 py-0.5 rounded-md border border-[#DCD6C9] hover:bg-[#EAE5DC] transition-colors select-all cursor-pointer inline-block whitespace-nowrap" title="${cleanText}">${displayId}</code>`;
                }
              }
              // 4. Job Title
              else if (colHeader.includes("title") || colHeader.includes("role") || colHeader.includes("requisition")) {
                cellContent = `<span class="font-semibold text-[#111111]">${cleanText}</span>`;
              }
              // 5. Empty placeholder
              else if (cleanText === "-" || cleanText === "\u2014") {
                cellContent = '<span class="text-[#888] font-mono text-center block">\u2014</span>';
              }

              bodyHtml += `<td class="px-3.5 py-2.5 text-xs text-[#222] align-middle ${alignClass}">${cellContent}</td>`;
            });
            bodyHtml += '</tr>';
          }
          bodyHtml += '</tbody>';

          return `<div class="w-full overflow-x-auto my-3 rounded-xl border border-[#E8E4DC] shadow-2xs bg-[#FAF8F5]"><table class="w-full border-collapse text-left text-xs bg-[#FAF8F5]">${headerHtml}${bodyHtml}</table></div>`;
        }
      }
    });

    const parsed = markedInstance.parse(preprocessed);
    return beautifyHtml(parsed);
  }, [content]);

  const handleClick = (e) => {
    const target = e.target.closest("[data-prompt]");
    if (target) {
      const promptText = target.getAttribute("data-prompt");
      if (promptText) {
        window.dispatchEvent(
          new CustomEvent("aura_fill_composer", { detail: { text: promptText } })
        );
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className="prose prose-sm max-w-none text-[#2D2A26] leading-relaxed
                 prose-p:my-1.5 prose-p:leading-relaxed
                 prose-headings:my-2 prose-headings:font-bold prose-headings:text-[#1C1A17]
                 prose-ul:my-1.5 prose-li:my-0.5
                 prose-strong:font-semibold prose-strong:text-[#1C1A17]
                 prose-code:rounded-md prose-code:bg-[#F4F1EA] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:text-[#1C1A17] prose-code:border prose-code:border-[#E8E4DC] prose-code:font-mono
                 prose-pre:bg-[#242220] prose-pre:text-[#FAF8F5] prose-pre:p-3 prose-pre:rounded-xl prose-pre:shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownRenderer;
