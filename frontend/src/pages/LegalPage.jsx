import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import './LegalPage.css';

export const legalPages = {
  privacy: {
    path: '/privacy-policy', title: 'Privacy Policy',
    intro: 'How TermJobs handles information across recruitment, interviews, and contract workforce management.',
    sections: [
      ['Information we collect', 'We process information you or your organization provide: names, contact details, account roles, company information, résumés, work history, applications, and recruitment communications. Depending on the features used, this includes interview responses, recordings and transcripts, assessments, onboarding documents, timesheets, expenses, and billing records. Joining the waiting list or talent pool provides us with the details submitted in that form.'],
      ['How information is used', 'We use information to operate accounts, match candidates with opportunities, support screening and interviews, manage onboarding and workforce workflows, send service messages, respond to requests, and maintain the security and reliability of the platform. Waiting list details are used for TermJobs updates; talent pool details are used to contact you about relevant opportunities.'],
      ['Recruitment and AI features', 'Recruitment information may be processed by AI services to extract résumé details, assist matching, conduct supported interviews, and generate assessments or summaries. These outputs may be inaccurate and require human review. Employers and recruiters are responsible for their hiring decisions. Interview organizers must explain any recording or transcription and obtain required permissions before it begins.'],
      ['Google Calendar connection', 'Connecting Google Calendar is optional. With your authorization, TermJobs accesses your Google account email, calendar list and timezone, and calendar events to check availability and create or update interview invitations. OAuth access and refresh tokens are stored to maintain the connection. Calendar event information may be shared with invited interview participants as part of scheduling. You can revoke TermJobs access in your Google Account permissions; revocation stops future authorized access but does not automatically remove previously created events or stored recruitment records.'],
      ['Sharing and service providers', 'Information is shared with authorized people involved in the relevant recruitment or workforce workflow, such as hiring teams, recruiters, staffing partners, and interview participants. Providers supporting hosting, storage, communications, AI processing, and connected integrations may process information to deliver those features. Information may also be disclosed where required by law or necessary to investigate abuse and protect users. Third-party services have their own privacy terms.'],
      ['Google user data', 'Google data is used for the connected calendar features described above. It must not be sold, used for advertising, or used to train general-purpose AI models. Use and transfer of information received from Google APIs must comply with the Google API Services User Data Policy and the Google Workspace user data and developer policy, including their Limited Use requirements.'],
      ['Browser storage and analytics', 'The platform uses browser storage to maintain sign-in and application preferences. Hosting and analytics services may process technical information such as page visits, device and browser information, and diagnostic events. You can manage browser storage in your browser settings; clearing it may sign you out.'],
      ['Retention and security', 'Information is retained for the relevant recruitment or workforce purpose and any applicable contractual, accounting, dispute-resolution, or legal obligations. Retention can depend on the organization managing the records. Access controls and other safeguards reduce risk, but no system can guarantee absolute security.'],
      ['Your choices and requests', 'You can update available profile information and revoke connected-service permissions. To request access, correction, deletion, or withdrawal from the waiting list or talent pool, contact the TermJobs team through the communication channel used to onboard you or contact your organization’s administrator. Requests involving employer-managed records may need to be handled by that employer and may be subject to applicable retention obligations.'],
      ['Updates and questions', 'Updates to this policy will appear on this page with a revised date. For privacy questions, contact your organization’s administrator or reply to the TermJobs communication through which you joined the service.'],
    ],
  },
  terms: {
    path: '/terms-and-conditions', title: 'Terms and Conditions',
    intro: 'The terms for using TermJobs as a candidate, employer, recruiter, or staffing partner.',
    sections: [
      ['Using TermJobs', 'By using TermJobs, you agree to these terms and the Platform Rules. Use the service only if you can enter a binding agreement under applicable law or have the required authorization from your organization. If you do not agree, do not use the platform.'],
      ['Accounts and authority', 'Provide accurate account information, keep credentials private, and use only permissions assigned to you. You must have authority to act for any organization you represent. Report suspected unauthorized access promptly through your organization’s administrator.'],
      ['Platform role', 'TermJobs provides tools for recruitment, interviews, onboarding, and contract workforce administration. A listing, match, assessment, or interview does not guarantee employment, a placement, payment, or a particular outcome. Employment, staffing, and commercial obligations are governed by the relevant agreements between the parties.'],
      ['Your content and permissions', 'You retain rights to content you submit. You authorize TermJobs and its service providers to process it as needed to provide the features you use. Submit only information you are entitled to share, obtain required candidate permissions, and respect confidentiality and intellectual property rights.'],
      ['Hiring and AI-assisted assessments', 'Employers and recruiters must check information and AI-generated outputs before relying on them. Hiring decisions must follow applicable employment and anti-discrimination requirements. Do not use platform assessments as the sole basis for decisions with significant consequences for a candidate.'],
      ['Interviews and integrations', 'Use calendar, messaging, video, and other connected services only with appropriate authorization. Organizers are responsible for notifying participants about recording, transcription, or AI assistance and obtaining required permissions. Third-party availability and terms may affect these features.'],
      ['Fees, timesheets, and payments', 'Any fees, payment schedules, refunds, staffing rates, and billing obligations must be set out in the applicable order, work order, or separate agreement. Submit accurate timesheets and expenses and resolve approval disputes with the responsible organization. These terms do not introduce a fee or promise payment.'],
      ['Acceptable use and access restrictions', 'Follow the Platform Rules. Access may be restricted or suspended for misuse, security threats, unauthorized access, or material breaches. Where appropriate, an organization’s administrator or the TermJobs team may request clarification or corrective action.'],
      ['Availability and responsibility', 'Features may change, be interrupted, or be unavailable. You are responsible for checking critical schedules, approvals, and records. To the extent permitted by applicable law, TermJobs does not guarantee uninterrupted service or the accuracy of third-party content or AI output. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.'],
      ['Ending use and resolving concerns', 'You may stop using the service and request account closure through your organization’s administrator or established TermJobs contact. Closure does not cancel separate employment or commercial obligations, and some records may need to be retained. Raise concerns through that same channel so the parties can seek a resolution; applicable statutory rights remain unaffected.'],
      ['Changes to these terms', 'Revised terms will be published on this page with an updated date. Review material changes before continuing to use the service. A separate signed agreement may set additional or controlling terms for the services it covers.'],
    ],
  },
  rules: {
    path: '/platform-rules', title: 'Platform Rules',
    intro: 'Clear expectations for fair hiring, trustworthy information, and respectful collaboration.',
    sections: [
      ['Be truthful', 'Use your real identity and authorized organization details. Keep job descriptions, qualifications, experience, availability, rates, and documents accurate. Do not impersonate another person, fabricate credentials, or submit duplicate profiles to mislead hiring teams.'],
      ['Recruit fairly', 'Evaluate people on relevant skills and legitimate role requirements. Do not discriminate, harass, threaten, or publish abusive content. Describe working arrangements and selection requirements honestly.'],
      ['Protect candidates', 'Obtain permission before submitting someone’s profile or sharing their documents. Do not post fraudulent jobs, request account passwords or verification codes, or demand payments in exchange for a guaranteed job or interview.'],
      ['Respect privacy and confidentiality', 'Access only records needed for your assigned work. Do not scrape, sell, export, or disclose candidate or company data without authorization. Do not share interview recordings, transcripts, or confidential assessments outside the authorized hiring process.'],
      ['Keep interviews honest', 'Attend on time or communicate changes promptly. Do not impersonate a candidate, provide undisclosed outside assistance, or record participants without required notice and permission. Follow any assessment-specific instructions and disclose permitted AI assistance when asked.'],
      ['Use AI responsibly', 'Review generated messages, summaries, matches, and scores before acting on them. Correct errors and allow candidates to raise concerns about inaccurate information. Do not use AI to invent candidate evidence or make discriminatory hiring decisions.'],
      ['Keep workforce records accurate', 'Record actual work and legitimate expenses. Do not falsify attendance, timesheets, invoices, approvals, or payment details. Respect your organization’s approval process and report discrepancies to the responsible administrator.'],
      ['Protect the service', 'Do not share accounts, bypass permissions, upload malware, spam users, attempt unauthorized access, or disrupt the platform. Report security issues privately through your established TermJobs contact rather than exposing personal data.'],
      ['Report concerns and resolve violations', 'Report suspected fraud, harassment, privacy issues, or inaccurate records to your organization’s administrator or established TermJobs contact. Include relevant context without unnecessarily sharing personal data. Violations may lead to content removal, access restrictions, suspension, or termination. If you believe action was taken in error, request a review through the same channel.'],
    ],
  },
};

export default function LegalPage({ type }) {
  const page = legalPages[type];
  useEffect(() => { window.scrollTo(0, 0); }, [type]);
  return (
    <div className="legal-page">
      <SEOHead title={`${page.title} — TermJobs`} description={page.intro} canonicalUrl={`https://termjobs.in${page.path}`} />
      <header className="legal-header"><Link to="/" className="legal-brand">TERMJOBS</Link><Link to="/">← Back to home</Link></header>
      <main className="legal-content">
        <p className="legal-eyebrow">TRUST & TRANSPARENCY</p>
        <h1>{page.title}</h1><p className="legal-intro">{page.intro}</p>
        <p className="legal-date">Last updated: 19 October 2026</p>
        <nav className="legal-tabs" aria-label="Policies">{Object.entries(legalPages).map(([key, item]) => <Link key={key} to={item.path} aria-current={type === key ? 'page' : undefined}>{item.title}</Link>)}</nav>
        <nav className="legal-contents" aria-label="On this page"><strong>On this page</strong>{page.sections.map(([heading], index) => <a key={heading} href={`#section-${index + 1}`}>{index + 1}. {heading}</a>)}</nav>
        <article>{page.sections.map(([heading, body], index) => <section key={heading} id={`section-${index + 1}`}><h2>{index + 1}. {heading}</h2><p>{body}</p>{type === 'privacy' && heading === 'Google user data' && <p>Read the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a> and <a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy">Google Workspace user data and developer policy</a>.</p>}</section>)}</article>
      </main>
      <footer className="legal-footer"><span>© {new Date().getFullYear()} TermJobs</span><Link to="/">Back to home ↑</Link></footer>
    </div>
  );
}
