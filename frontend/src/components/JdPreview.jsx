import { useMemo } from 'react';
import { marked } from 'marked';

export default function JdPreview({ markdown, role, rawJd }) {
  const renderedContent = useMemo(() => {
    if (markdown && markdown.trim()) {
      return markdown;
    }

    if (rawJd && rawJd.trim()) {
      return rawJd;
    }

    // Compile live structured JD if LLM generation is pending or in progress
    if (role && (role.title || (role.must_have_skills && role.must_have_skills.length))) {
      const skills = (role.must_have_skills || []).map((s) => `- **${s}**`).join('\n');
      const niceSkills = (role.nice_to_have_skills || []).map((s) => `- ${s}`).join('\n');
      const certs = (role.certifications || []).map((c) => `- ${c}`).join('\n');

      return `## ${role.title || 'Role Requirement'}

**Department / Family:** ${role.job_family || role.department || 'Engineering'}  
**Seniority Level:** ${role.seniority || 'Senior'} (${role.experience_band || '3-5 yrs'})  
**Headcount:** ${role.headcount || 1} opening(s)  
**Location & Work Mode:** ${role.work_mode || 'Remote'} — ${role.primary_location || 'Bangalore, India'}  
**Engagement Type:** ${role.engagement_type || 'Contract'} (${role.duration || '6 months'})  

---

### Role Overview
We are looking for a skilled **${role.title || 'Professional'}** to join our team on a ${role.duration || 'contract'} engagement. The candidate will work closely with department leads to execute critical technical deliverables.

### Required Skills & Qualifications (Must-Have)
${skills || '- Strong domain experience and relevant project execution track record.'}

${niceSkills ? `### Preferred Skills (Nice-to-Have)\n${niceSkills}\n` : ''}
${certs ? `### Certifications\n${certs}\n` : ''}

### Engagement Parameters & Commercials
- **Schedule / Shift:** ${role.shift_hours || 'Standard Business Hours (IST)'}
- **Equipment Provision:** ${role.equipment_provided || 'Company-provided'}
- **Background Verification:** ${role.bgv_required || 'Yes'} (Mandatory)
- **Contract Agreement:** ${role.contract_template || 'Consultancy agreement'}

---
*Job description generated and managed via TermJobs AI Orchestration Engine.*`;
    }

    return null;
  }, [markdown, role, rawJd]);

  const html = useMemo(() => {
    if (!renderedContent) return '';
    return marked.parse(renderedContent, { gfm: true, breaks: true });
  }, [renderedContent]);

  if (!renderedContent) {
    return (
      <div className="p-8 text-center text-xs text-gray-400">
        No job description generated yet. Fill in role details or answer AI intake questions.
      </div>
    );
  }

  return (
    <div className="jd-preview bg-gray-50/70 border border-gray-200/80 rounded-xl p-5 text-left text-xs leading-relaxed text-gray-900 space-y-3 prose max-w-none">
      <div className="jd-preview-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
