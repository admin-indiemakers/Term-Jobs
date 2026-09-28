import { useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  Copy,
  Check,
  Printer,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Shield,
  Award,
  Calendar,
  FileText,
  Sparkles,
  Building2,
  DollarSign,
  Laptop,
  CheckCircle2,
  FileCode,
  Layers
} from 'lucide-react';

function fmtLpa(n) {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  const lakhs = num >= 100000 ? num / 100000 : num >= 100 ? num / 100 : num;
  return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L p.a.`;
}

export default function JdPreview({ markdown, role, rawJd }) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' | 'markdown'

  const structured = role || {};

  // Extract core fields
  const title = structured.title || 'Untitled Role Specification';
  const department = structured.job_family || structured.department || 'Engineering & Technology';
  const seniority = structured.seniority || 'Senior';
  const experienceBand = structured.experience_band || '3-5 yrs';
  const headcount = structured.headcount || 1;
  const workMode = structured.work_mode || 'Remote';
  const location = structured.primary_location || 'India (Pan-India / Remote)';
  const engagementType = structured.engagement_type || 'Contract';
  const duration = structured.duration || '6 Months';
  const shiftHours = structured.shift_hours || 'Standard Business Hours (IST)';
  const equipment = structured.equipment_provided || 'Company-provided';
  const bgv = structured.bgv_required || 'Yes (Mandatory)';
  const contract = structured.contract_template || 'Consultancy agreement';
  const submissionDeadline = structured.submission_deadline || '';
  const targetStartDate = structured.target_start_date || '';

  // Commercial ceiling
  const minRate = structured.range_vendors_see?.[0];
  const maxRate = structured.range_vendors_see?.[1] ?? structured.ceiling_internal;
  const rateDisplay = useMemo(() => {
    if (minRate && maxRate) return `${fmtLpa(minRate) || minRate} – ${fmtLpa(maxRate) || maxRate}`;
    if (maxRate) return `${fmtLpa(maxRate) || maxRate} max ceiling`;
    return 'Competitive / As per SOW budget';
  }, [minRate, maxRate]);

  // Skills & qualifications
  const mustHaveSkills = Array.isArray(structured.must_have_skills)
    ? structured.must_have_skills.filter(Boolean)
    : [];
  const niceToHaveSkills = Array.isArray(structured.nice_to_have_skills)
    ? structured.nice_to_have_skills.filter(Boolean)
    : [];
  const certifications = Array.isArray(structured.certifications)
    ? structured.certifications.filter(Boolean)
    : [];

  // Plain text / Markdown compilation for copying or raw view
  const fullDocumentText = useMemo(() => {
    if (markdown && markdown.trim()) return markdown;
    if (rawJd && rawJd.trim()) return rawJd;

    return `# ${title}
**Department:** ${department}
**Seniority:** ${seniority} (${experienceBand})
**Headcount:** ${headcount} Opening(s)
**Location & Work Mode:** ${workMode} — ${location}
**Engagement:** ${engagementType} (${duration})
**Commercial Rate Band:** ${rateDisplay}

---

## Role Summary
We are seeking an experienced **${title}** to join our team on a **${duration} ${engagementType.toLowerCase()}** engagement. The selected specialist will drive critical technical execution and collaborate directly with senior engineering leadership.

## Required Skills (Must-Have)
${mustHaveSkills.map((s) => `- ${s}`).join('\n') || '- Relevant production domain experience'}

${niceToHaveSkills.length ? `## Preferred Skills (Nice-to-Have)\n${niceToHaveSkills.map((s) => `- ${s}`).join('\n')}\n` : ''}
${certifications.length ? `## Certifications\n${certifications.map((c) => `- ${c}`).join('\n')}\n` : ''}
## Engagement Parameters & Compliance
- **Schedule / Shift:** ${shiftHours}
- **Equipment Provision:** ${equipment}
- **Background Verification:** ${bgv}
- **Contract Agreement:** ${contract}
${submissionDeadline ? `- **Submission Deadline:** ${submissionDeadline}` : ''}
${targetStartDate ? `- **Target Start Date:** ${targetStartDate}` : ''}

---
*Job description generated and managed via TermJobs AI Orchestration Engine.*`;
  }, [markdown, rawJd, title, department, seniority, experienceBand, headcount, workMode, location, engagementType, duration, rateDisplay, mustHaveSkills, niceToHaveSkills, certifications, shiftHours, equipment, bgv, contract, submissionDeadline, targetStartDate]);

  // Parsed markdown HTML for custom narrative content
  const customMarkdownHtml = useMemo(() => {
    if (!markdown || !markdown.trim()) return '';
    try {
      return marked.parse(markdown, { gfm: true, breaks: true });
    } catch {
      return '';
    }
  }, [markdown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullDocumentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const hasData = Boolean(title || mustHaveSkills.length || markdown || rawJd);

  if (!hasData) {
    return (
      <div className="p-12 text-center text-xs text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
        No job description generated yet. Configure role parameters or structured criteria to preview.
      </div>
    );
  }

  return (
    <div className="w-full text-left font-sans space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
            <FileText size={13} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900">Job Description Specification</span>
            <span className="text-[10px] text-gray-400 block leading-tight">Live Contract Pipeline Preview</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Mode Toggle if custom markdown exists */}
          {Boolean(markdown || rawJd) && (
            <div className="flex items-center p-0.5 bg-gray-100 rounded-lg mr-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'formatted'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Executive Card
              </button>
              <button
                type="button"
                onClick={() => setViewMode('markdown')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'markdown'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Raw Text
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black hover:border-gray-300'
            }`}
            title="Copy entire job description to clipboard"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy JD'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-black hover:border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Print or save as PDF"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      {viewMode === 'markdown' ? (
        <div className="bg-gray-950 text-gray-100 rounded-2xl p-5 border border-gray-800 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap select-all">
          {fullDocumentText}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
          {/* Executive Header Banner */}
          <div className="p-6 bg-gradient-to-b from-gray-50/90 via-white to-white border-b border-gray-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-black text-white text-[10px] font-extrabold tracking-wider uppercase">
                  CONTRACT SPECIFICATION
                </span>
                <span className="text-[11px] text-gray-400 font-semibold tracking-wide uppercase">
                  {department}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                <Sparkles size={12} className="text-gray-400" />
                <span>TermJobs AI Orchestration Engine</span>
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug">
                {title}
              </h2>
            </div>

            {/* Quick Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100/90 border border-gray-200/70 text-gray-800 text-xs font-bold">
                <Briefcase size={13} className="text-gray-500" />
                <span>{seniority} ({experienceBand})</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100/90 border border-gray-200/70 text-gray-800 text-xs font-bold">
                <Clock size={13} className="text-gray-500" />
                <span>{duration} ({engagementType})</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100/90 border border-gray-200/70 text-gray-800 text-xs font-bold">
                <MapPin size={13} className="text-gray-500" />
                <span>{workMode} • {location}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100/90 border border-gray-200/70 text-gray-800 text-xs font-bold">
                <Users size={13} className="text-gray-500" />
                <span>{headcount} {headcount === 1 ? 'Opening' : 'Openings'}</span>
              </span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 text-xs text-gray-800">
            {/* Commercial Highlights Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50/80 border border-gray-200/70">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Rate Band / Commercial Ceiling
                </div>
                <div className="text-xs font-extrabold text-gray-900">
                  {rateDisplay}
                </div>
              </div>

              {submissionDeadline && (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Submission Deadline
                  </div>
                  <div className="text-xs font-extrabold text-gray-900">
                    {submissionDeadline}
                  </div>
                </div>
              )}

              {targetStartDate && (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Target Start Date
                  </div>
                  <div className="text-xs font-extrabold text-gray-900">
                    {targetStartDate}
                  </div>
                </div>
              )}
            </div>

            {/* Role Overview */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-gray-400" />
                <span>Role Overview & Scope</span>
              </div>
              <div className="p-4 rounded-xl bg-white border border-gray-200/80 text-gray-700 leading-relaxed font-normal space-y-2 text-xs">
                <p>
                  We are seeking an accomplished <strong className="text-gray-900 font-bold">{title}</strong> to join our {department} team on a <strong className="text-gray-900 font-bold">{duration} {engagementType.toLowerCase()}</strong> assignment.
                </p>
                <p className="text-gray-600">
                  In this role, the contractor will contribute directly to architecture, sprint execution, code review standards, and reliable platform delivery under the guidance of technical leads.
                </p>
              </div>
            </div>

            {/* Core Required Skills (Must-Have) */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Required Core Skills (Must-Have)</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Mandatory Match
                </span>
              </div>

              {mustHaveSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mustHaveSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold shadow-2xs hover:bg-black transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">No must-have skills specified.</div>
              )}
            </div>

            {/* Nice to Have Skills */}
            {niceToHaveSkills.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-gray-400" />
                  <span>Preferred / Nice-to-Have Skills</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {niceToHaveSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs font-semibold hover:border-gray-300 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={13} className="text-amber-600" />
                  <span>Certifications & Accreditations</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {certifications.map((cert, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-bold shadow-2xs"
                    >
                      <Shield size={12} className="text-amber-600 shrink-0" />
                      <span>{cert}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Parameters & Commercials Grid */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={12} className="text-gray-400" />
                <span>Engagement Parameters & Compliance Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-600 shadow-2xs">
                    <Clock size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Schedule & Shift</div>
                    <div className="text-xs font-bold text-gray-900 mt-0.5">{shiftHours}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-600 shadow-2xs">
                    <Laptop size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Equipment Provision</div>
                    <div className="text-xs font-bold text-gray-900 mt-0.5">{equipment}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-600 shadow-2xs">
                    <Shield size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Background Verification</div>
                    <div className="text-xs font-bold text-gray-900 mt-0.5">{bgv}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-600 shadow-2xs">
                    <FileText size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contract Agreement Model</div>
                    <div className="text-xs font-bold text-gray-900 mt-0.5">{contract}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Narrative Markdown (If user provided extra detailed body) */}
            {Boolean(customMarkdownHtml) && (
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Detailed Scope & Responsibilities
                </div>
                <div
                  className="p-5 rounded-xl bg-gray-50/60 border border-gray-200/70 leading-relaxed text-gray-800 prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
                  dangerouslySetInnerHTML={{ __html: customMarkdownHtml }}
                />
              </div>
            )}
          </div>

          {/* Document Watermark Footer */}
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-gray-400">
            <span>TermJobs Platform Specification • Verified Contract Pipeline</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Direct Vendor Distribution Ready</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
