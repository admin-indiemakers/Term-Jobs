// TermJobs New Open Roles Interactive Engine
// Bundled from TermJobs openroles page.html

export function mountOpenRolesEngine(container, options = {}) {
  if (!container) return () => { };

  // Remove any stale overlay modals left over from previous mounts
  document.querySelectorAll('.ov.dov').forEach(function (el) {
    try { el.remove(); } catch (_) { }
  });

  // Track global event cleanup functions
  const cleanups = [];
  const rawWinAdd = window.addEventListener.bind(window);
  const rawDocAdd = document.addEventListener.bind(document);

  function addWinListener(type, listener, opt) {
    rawWinAdd(type, listener, opt);
    cleanups.push(() => window.removeEventListener(type, listener, opt));
  }
  function addDocListener(type, listener, opt) {
    rawDocAdd(type, listener, opt);
    cleanups.push(() => document.removeEventListener(type, listener, opt));
  }

  function getCandAuth() {
    var user = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) ||
               (window.TJ && window.TJ.profile ? window.TJ.profile() : null);
    if (user && (user.candidate_email || user.email || user.candidate_name || user.name)) return user;
    try {
      var su = JSON.parse(sessionStorage.getItem('termjobs_candidate_session') || '{}');
      if (su && (su.candidate_email || su.email || su.candidate_name || su.name)) return su;
    } catch (_) {}
    try {
      var lu = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
      if (lu && (lu.candidate_email || lu.email || lu.candidate_name || lu.name)) return lu;
    } catch (_) {}
    try {
      var pu = JSON.parse(localStorage.getItem('tj-profile') || '{}');
      if (pu && (pu.email || pu.name)) return pu;
    } catch (_) {}
    if (localStorage.getItem('candidate_email') || localStorage.getItem('candidate_profile_token')) {
      return { email: localStorage.getItem('candidate_email') || 'candidate@termjobs.in', name: 'Candidate' };
    }
    return null;
  }

  // 1. Script 3: Job data & detailed route
  (function () {
    var JOBS = [{"slug": "software-engineer-inntot-technologies-pv-e5e8b62a", "id": "e5e8b62a-e5a6-5e98-a808-0c86e8cb210d", "title": "Software Engineer", "company": "Inntot Technologies Pvt. Ltd.", "mode": "On-site", "exp": "Entry-Level (0\u20132 years)", "loc": "Kochi, Kerala, India", "skills": ["C", "C++"], "more": 10, "tone": "#059669", "ink": "#fff", "initial": "I"}, {"slug": "odoo-developer-nurture-spark-digital-951f75b9", "id": "951f75b9-7dfc-5770-9c15-1822f79ded29", "title": "Odoo Developer", "company": "Nurture Spark Digital", "mode": "On-site", "exp": "FRESHER", "loc": "Payyannur, Kerala, India", "skills": ["Python", "Odoo ERP"], "more": 17, "tone": "#2563eb", "ink": "#fff", "initial": "N"}, {"slug": "python-developer-vivantify-technology-so-4ea1af55", "id": "4ea1af55-a2df-5ce1-a9ec-306e07349a2b", "title": "Python Developer", "company": "Vivantify Technology Solutions India Pvt. Ltd.", "mode": "On-site", "exp": "Mid-Level (3\u20135 years)", "loc": "CHENNAI", "skills": ["Python", "SQL"], "more": 10, "tone": "#7c3aed", "ink": "#fff", "initial": "V"}, {"slug": "python-developer-bot-development-vbots-35155b56", "id": "35155b56-7130-5891-b553-040a78a24bb1", "title": "Python Developer \u2013 Bot Development", "company": "vBots", "mode": "On-site", "exp": "Mid-Level (2\u20134 years)", "loc": "Coimbatore, Tamil Nadu", "skills": ["Python", "Selenium"], "more": 12, "tone": "#d97706", "ink": "#fff", "initial": "V"}, {"slug": "flutter-developer-intern-hancod-98802267", "id": "98802267-2805-56be-b910-b38da07f7a18", "title": "Flutter Developer Intern", "company": "Hancod", "mode": "On-site", "exp": "Fresher (Basic Flutter knowledge)", "loc": "Perintalmanna, Kerala", "skills": ["Flutter", "Dart"], "more": 10, "tone": "#0891b2", "ink": "#fff", "initial": "H"}, {"slug": "devops-engineer-acura-solutions-ltd-bb711af2", "id": "bb711af2-b94c-5d00-87ce-050b785961ef", "title": "DevOps Engineer", "company": "ACURA SOLUTIONS LTD", "mode": "On-site", "exp": "FRESHER", "loc": "Malappuram, Kerala", "skills": ["Kubernetes", "Docker"], "more": 8, "tone": "#dc2626", "ink": "#fff", "initial": "A"}, {"slug": "software-engineer-mailercloud-87b3c036", "id": "87b3c036-09ca-5b60-afbc-2bf72a661532", "title": "Software Engineer", "company": "mailercloud", "mode": "On-site", "exp": "3 \u2013 6 years", "loc": "KOZHIKODE", "skills": ["Go", "PHP"], "more": 25, "tone": "#4f46e5", "ink": "#fff", "initial": "M"}], APPLY_URL = "", PIN = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/></svg>", CAP = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5\"/></svg>", ARROW = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg>", BACK = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M19 12H5M11 6l-6 6 6 6\"/></svg>", LOGO = "<img src=\"/logo.png\" alt=\"TermJobs Logo\" class=\"brand-logo-img\" style=\"width:34px;height:34px;object-fit:contain;border-radius:8px;flex-shrink:0;\" />";
    window.TJ_JOBS = JOBS; var TJ_DESC = window.TJ_DESC = {"software-engineer-inntot-technologies-pv-e5e8b62a": "**Job Title: Software Engineer**\n\n**Company:** Inntot Technologies Pvt. Ltd.  \n**Location:** Kochi, Kerala, India  \n**Work Mode:** On-site  \n**Employment Type:** Full-time  \n**Experience:** 0\u20132 Years\n\n### Role Overview\n\nWe are looking for talented and motivated Software Engineers with strong programming skills in C/C++ to join our development team. Candidates should have a good understanding of Data Structures, Algorithms, and RTOS concepts, along with strong debugging and problem-solving abilities.\n\nFreshers with excellent academic records and very good programming skills in C are also encouraged to apply.\n\n### Key Responsibilities\n\n- Develop and implement software programs based on project requirements.\n- Perform unit testing to ensure software quality and reliability.\n- Debug software applications and identify and fix defects.\n- Prepare technical documentation covering development techniques and software designs.\n- Experiment with new technologies and ideas to improve existing solutions.\n- Contribute to software development and continuous improvement activities.\n\n### Required Skills & Qualifications\n\n- 0\u20132 years of experience in software development.\n- Excellent programming skills in C and C++.\n- Understanding of Real-Time Operating System (RTOS) concepts.\n- Strong knowledge of Data Structures and Algorithms.\n- Good software debugging and troubleshooting skills.\n- Strong analytical and problem-solving abilities.\n- Ability to learn quickly and adapt to new technologies.\n- Proactive attitude and ability to multitask.\n\n### Educational Qualifications\n\nCandidates with any of the following qualifications are eligible:\n\n- ME / M.Tech\n- BE / B.Tech\n- MCA\n\nFreshers with excellent academic records and strong C programming skills are encouraged to apply.\n\n### Employment Details\n\n- Employment Type: Full-time\n- Work Arrangement: On-site\n- Experience Level: 0\u20132 Years", "odoo-developer-nurture-spark-digital-951f75b9": "**Job Title: Odoo Developer**\n\n**Company:** Nurture Spark Digital  \n**Location:** Payyannur, Kerala, India  \n**Work Mode:** On-site  \n**Employment Type:** Full-time\n\n### Role Overview\n\nWe are looking for a skilled and motivated Odoo Developer to join our team. The ideal candidate should have hands-on experience in Odoo development, customization, module implementation, and integration. You will be responsible for developing, customizing, maintaining, and supporting Odoo ERP solutions based on business requirements.\n\n### Key Responsibilities\n\n- Design, develop, and customize Odoo modules (Community and Enterprise editions) based on client requirements.\n- Extend models, views, wizards, and QWeb reports.\n- Configure applications using Odoo Studio, including custom fields, views, automated actions, and reports.\n- Convert Studio customizations into maintainable custom modules where required.\n- Develop frontend components using OWL and JavaScript.\n- Build and maintain third-party integrations using REST APIs, XML-RPC, and JSON-RPC.\n- Handle data migration, version upgrades, and deployments on Odoo.sh and on-premise environments.\n- Troubleshoot issues, optimize performance, and provide technical support for live implementations.\n- Collaborate with functional consultants to translate business requirements into technical solutions.\n\n### Required Skills & Qualifications\n\n- Bachelor's degree in Computer Science, Information Technology, or a related field.\n- Strong proficiency in Python and the Odoo ORM framework.\n- Hands-on experience with Odoo versions 16, 17, and 18.\n- Practical experience with Odoo Studio and custom module development.\n- Knowledge of PostgreSQL, XML, QWeb, and JavaScript (OWL).\n- Working knowledge of Git and Odoo.sh.\n- Understanding of core business modules, including Accounting, Sales, Purchase, Inventory, CRM, and HR/Payroll.\n- Strong analytical, problem-solving, and communication skills.\n\n### Preferred Qualifications\n\n- Experience with UAE/GCC localization, including VAT and WPS payroll.\n- Familiarity with Linux server administration and Docker.\n- Odoo certification.\n\n### Benefits\n\n- Opportunity to work on implementation projects for clients across the UAE and GCC.\n- Exposure to industries including trading, contracting, fleet, and manufacturing.\n- Collaborative work environment with opportunities for professional growth.\n- Competitive compensation package.", "python-developer-vivantify-technology-so-4ea1af55": "**Job Title: Python Developer**\n\n**Company:** Vivantify Technology Solutions India Pvt. Ltd.  \n**Location:** PAN India  \n**Experience:** 3\u20135 Years  \n**Employment Type:** Full-time / Contractor\n\n**Role Overview**\n\nWe are looking for an experienced Python Developer to enhance and optimize enterprise applications. The role focuses on Python development, SQL optimization, backend services, API development, debugging, and application performance. The ideal candidate will work with existing codebases to implement enhancements and deliver scalable, maintainable, and high-performance solutions.\n\n**Key Responsibilities**\n\n- Develop and implement application features based on business and technical requirements.\n- Enhance existing codebases to improve scalability, maintainability, and code quality.\n- Optimize application, backend, and database performance.\n- Develop and maintain backend services, APIs, and database integrations.\n- Write and optimize SQL queries, stored procedures, joins, and indexing.\n- Troubleshoot defects and perform root cause analysis.\n- Participate in code reviews and maintain engineering standards.\n- Contribute to technical documentation, knowledge sharing, and process improvements.\n\n**Required Skills & Qualifications**\n\n- Strong hands-on experience in Python development.\n- Strong proficiency in SQL, including query optimization, joins, stored procedures, indexing, and performance tuning.\n- Experience developing and maintaining APIs and backend systems.\n- Strong debugging, troubleshooting, and root cause analysis skills.\n- Experience working with existing applications and implementing enhancements.\n- Knowledge of Git and version control systems.\n- Strong analytical and problem-solving abilities.\n\n**Preferred Skills**\n\n- Exposure to React.js.\n- Knowledge of Power BI.\n- Understanding of Large Language Models (LLMs) and AI integrations.\n\n**Mandatory Skills**\n\n- Python\n- React.js\n\n**What We Offer**\n\n- Competitive salary and benefits package.\n- Opportunities for professional growth and development.\n- Collaborative and inclusive work environment.\n- Opportunities to work on challenging projects with leading clients.", "python-developer-bot-development-vbots-35155b56": "**Job Title: Python Developer \u2013 Bot Development**\n\n**Company:** vBots  \n**Location:** Coimbatore, Tamil Nadu, India  \n**Work Mode:** On-site  \n**Employment Type:** Full-time  \n**Experience:** 2\u20134 Years\n\n**Role Overview**\n\nWe are looking for a skilled Python Developer to design, develop, and deploy intelligent bots that automate business processes and improve operational efficiency. The ideal candidate will have experience with Python development, automation frameworks, APIs, and AI/ML libraries to build scalable solutions that integrate with enterprise applications.\n\n**Key Responsibilities**\n\n- Design, develop, and maintain bots using Python and automation frameworks.\n- Write clean, efficient, reusable code for automation requirements.\n- Integrate bots with third-party applications.\n- Collaborate with project coordinators and business analysts to understand business requirements.\n- Develop custom automation logic, including OCR, NLP, and AI-based components.\n- Conduct unit testing and support QA/UAT teams during validation.\n- Monitor and troubleshoot production bots, implementing timely fixes and enhancements.\n- Maintain technical documentation, coding standards, and development best practices.\n\n**Required Skills & Qualifications**\n\n- BE (CSE) or B.Tech (IT, CSE, AIML, CSBS, AI & DS).\n- 2\u20134 years of experience in Python development.\n- Familiarity with automation libraries such as Selenium, Pandas, and OpenPyXL.\n- Knowledge of OCR/NLP libraries such as Tesseract, spaCy, and OpenCV is an advantage.\n- Strong debugging, problem-solving, and analytical skills.\n\n**Good to Have**\n\n- Exposure to RPA platforms such as UiPath, Automation Anywhere, or Microsoft Power Automate.\n\n**Employment Type:** Full-time  \n**Work Arrangement:** On-site", "flutter-developer-intern-hancod-98802267": "**Flutter Developer Intern**\n\n**Company:** Hancod  \n**Product:** Duxbe \u2013 AI-powered ERP & POS System  \n**Location:** Perintalmanna, Kerala, India  \n**Work Mode:** On-site  \n**Employment Type:** Internship (Unpaid)\n\n**About Hancod**\n\nAt Hancod, we're building Duxbe, an AI-powered ERP and POS system designed for small businesses across India and beyond. We focus on clean user interfaces, fast development, and building practical features that solve real-world business problems.\n\n**Role Overview**\n\nWe are looking for motivated Flutter Developer Interns, including freshers with a basic understanding of Flutter development, to join our development team. You will contribute to building and maintaining ERP modules for web and mobile platforms.\n\n**Key Responsibilities**\n\n- Build and maintain ERP modules, including inventory, accounting, GST, sales, and reports.\n- Develop responsive Flutter applications for web and mobile.\n- Implement Clean Architecture and Riverpod for state management.\n- Create reusable widgets and efficient offline/local data logic.\n- Integrate Supabase, Firebase, and REST APIs.\n- Work closely with backend, QA, and product teams in development sprints.\n\n**Required Skills & Qualifications**\n\n- Basic knowledge of Flutter and Dart.\n- Understanding of Riverpod and state management.\n- Basic understanding of Clean Architecture.\n- Familiarity with Supabase or similar backend platforms.\n- Knowledge of API integration and database concepts.\n- Interest in ERP and accounting features such as invoicing, ledgers, and taxation.\n- Good problem-solving skills and an interest in writing clean code.\n\n**Good to Have**\n\n- FlutterFlow experience.\n- Supabase SQL and Edge Functions.\n- Published applications on Play Store or App Store.\n\n**Internship Details**\n\n- Internship Type: Unpaid.\n- Work Arrangement: On-site.\n- Experience Level: Freshers welcome.\n- Duration: Not specified in the original posting.", "devops-engineer-acura-solutions-ltd-bb711af2": "**Job Title: DevOps Engineer**\n\n**Company:** ACURA SOLUTIONS LTD  \n**Location:** Malappuram, Kerala, India  \n**Work Mode:** On-site  \n**Employment Type:** Full-time\n\n**Role Overview**\n\nWe are seeking a skilled DevOps Engineer to join our dynamic team in Kerala. The ideal candidate should have a strong understanding of DevOps practices, particularly within the banking domain, and experience implementing and managing CI/CD pipelines and Kubernetes environments.\n\n**Key Responsibilities**\n\n- Design, implement, and manage CI/CD pipelines to automate software delivery.\n- Deploy and manage containerized applications using Kubernetes.\n- Collaborate with development and operations teams to establish DevOps best practices.\n- Monitor system performance and troubleshoot infrastructure issues.\n- Improve deployment processes, infrastructure reliability, and automation.\n- Stay updated with emerging DevOps technologies and cloud computing trends.\n\n**Required Skills & Qualifications**\n\n- Strong experience with Kubernetes and container orchestration.\n- Proficiency in CI/CD tools and practices.\n- Familiarity with cloud platforms and Infrastructure as Code (IaC).\n- Understanding of banking domain requirements.\n- Excellent problem-solving and troubleshooting abilities.\n- Ability to work effectively in a fast-paced environment.\n\n**Employment Type:** Full-time  \n**Work Arrangement:** On-site", "software-engineer-mailercloud-87b3c036": "**About Mailercloud**\n\nMailercloud is a product-based company offering an email marketing platform used by businesses across 100+ countries, delivering billions of emails annually.\n\nWe are looking for an experienced Full Stack Engineer with 3\u20136 years of professional experience to join our engineering team at our Kozhikode office.\n\n**Key Responsibilities**\n\n**1. Product Development**\n- Design, develop, and maintain backend APIs and microservices using Go and PHP.\n- Build and maintain frontend applications using Vue.js 2/3 or React.\n- Develop responsive, high-performance interfaces based on Figma designs.\n- Own features throughout the development lifecycle, from requirements and implementation to testing, deployment, and monitoring.\n- Develop integrations with e-commerce, CRM, and third-party platforms using REST APIs, GraphQL, and webhooks.\n\n**2. Infrastructure & DevOps**\n- Work with Linux-based bare-metal server infrastructure, particularly Rocky Linux 9.\n- Manage and improve CI/CD pipelines, automated testing, linting, and deployment processes.\n- Optimize ClickHouse database schemas and queries for large-scale analytics.\n- Support MySQL operations, including schema migrations, indexing, query optimization, and partition management.\n- Assist with RabbitMQ infrastructure and HAProxy configuration.\n\n**3. AI Agents & Developer Tooling**\n- Build and maintain AI-powered agents for QA, code reviews, and SRE operations.\n- Work with MCP-first architecture and Claude through the Anthropic API.\n- Develop and maintain CLAUDE.md configurations, sprint SOPs, and developer tooling.\n- Contribute to the Mailercloud MCP connector and technical documentation.\n\n**4. Code Quality & Collaboration**\n- Participate in code reviews, sprint planning, and retrospectives.\n- Write clean, scalable, maintainable, and well-tested code.\n- Follow established coding standards and branching strategies.\n- Identify technical debt and recommend practical improvements.\n- Collaborate with engineering teams to improve product performance and reliability.\n\n**Required Qualifications & Skills**\n- 3\u20136 years of professional software development experience, preferably in a product-based company.\n- Strong proficiency in Go (preferred) or PHP.\n- Frontend development experience with Vue.js 2/3 or React.\n- Good understanding of MySQL, database design, indexing, and query optimization.\n- Experience working with Linux environments such as CentOS, RHEL, or Rocky Linux.\n- Familiarity with CI/CD tools such as GitHub Actions or GitLab CI.\n- Strong understanding of data structures, algorithms, and system design.\n- Ability to understand infrastructure-as-code and deployment scripts.\n- Knowledge of REST APIs, GraphQL, microservices, and webhooks.\n- Good written English and technical documentation skills.\n\n**Preferred Skills**\n- Experience with ClickHouse, RabbitMQ, and HAProxy.\n- Knowledge of AI agents, MCP architecture, and Anthropic API.\n- Experience building and maintaining large-scale SaaS products.\n\n**Employment Details**\n- Employment Type: Full-time\n- Work Location: Kozhikode, Kerala\n- Work Mode: On-site\n- Experience: 3\u20136 years\n\nWe are looking for an engineer who enjoys building production-grade software, solving complex technical challenges, and contributing to scalable product development."};
    var tt;
    function getList() { return container.querySelector('#list') || document.getElementById('list'); }
    function getDet() { return container.querySelector('#detail') || document.getElementById('detail'); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function toast(m, dur) {
      var t = document.getElementById('dtoast');
      if (!t) return;
      t.textContent = m;
      t.classList.add('on');
      clearTimeout(tt);
      tt = setTimeout(function () { t.classList.remove('on'); }, dur || 4000);
    }
    function fallback() { var i = document.createElement('input'); i.value = location.href; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('Link copied'); } catch (e) { toast('Copy the address from your browser bar'); } i.remove(); }
    function share() { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(location.href).then(function () { toast('Link copied'); }, fallback); } else fallback(); }

    function getScrollParent() { return container.closest('.overflow-y-auto') || container.parentElement || null; }
    function getScrollPos() { var p = getScrollParent(); return p ? p.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || 0); }
    function setScrollPos(y) { var p = getScrollParent(); if (p) { p.scrollTop = y; } else { window.scrollTo(0, y); } }

    function render(j, detEl) {
      var target = detEl || getDet();
      if (!target) return;
      var sk = (Array.isArray(j.skills) ? j.skills : []).map(function (s) { return '<span class="skill">' + esc(s) + '</span>'; }).join('') + (j.more ? '<span class="skill">+' + j.more + ' more skills</span>' : '');
      if (!sk) sk = '<span class="skill">Open to all skills</span>';

      var isApplied = !!(window.TJ && window.TJ.inApply && window.TJ.inApply(j.slug));
      if (!isApplied) {
        var appList = [];
        try { appList = JSON.parse(localStorage.getItem('tj-apply') || '[]'); } catch (_) {}
        isApplied = appList.indexOf(j.slug) > -1;
      }
      var compTitles = [];
      try { compTitles = JSON.parse(localStorage.getItem('tj_completed_titles') || '[]'); } catch (_) {}
      var isCompleted = compTitles.indexOf(j.title.toLowerCase()) > -1;

      var applySideBtnHtml = '';
      var barApplyBtnHtml = '';
      if (isCompleted) {
        applySideBtnHtml = '<button class="btn block iv-completed-btn" type="button" disabled style="display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>Interview Completed</span></button>';
        barApplyBtnHtml = '<button class="btn iv-completed-btn" type="button" disabled style="display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>Interview Completed</span></button>';
      } else if (isApplied) {
        applySideBtnHtml = '<button class="btn primary block iv-attend-ai-btn" type="button" data-attend-ai style="display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span></button>';
        barApplyBtnHtml = '<button class="btn primary iv-attend-ai-btn" type="button" data-attend-ai style="display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span></button>';
      } else {
        applySideBtnHtml = '<button class="btn primary block" type="button" data-apply>Apply now ' + ARROW + '</button>';
        barApplyBtnHtml = '<button class="btn primary" type="button" data-apply>Apply now</button>';
      }

      var logo = '<div class="logo" style="background:' + j.tone + ';color:' + j.ink + '" aria-hidden="true">' + esc(j.initial) + '</div>';
      target.innerHTML = '<header class="top"><a class="brand" href="#" aria-label="All TermJobs roles">' + LOGO + '<div><b>TERMJOBS</b><span>Contract workforce platform</span></div></a><div class="top-actions"><button class="btn" type="button" data-signin>Sign in</button><div class="me" id="d-me" style="display:none"><button type="button" class="av-btn" id="d-av-trigger" aria-label="Open profile menu"><span class="av" id="d-me-av" aria-hidden="true">M</span></button></div></div></header>'
          + '<a class="crumb" href="#" aria-label="Back to all open roles">' + BACK + ' All open roles</a>'
          + '<section class="d-head"><div class="d-top">' + logo + '<div class="co" style="font-size:16px">' + esc(j.company) + '</div></div><h1>' + esc(j.title) + '</h1>'
          + '<div class="chips"><span class="chip mode">' + esc(j.mode) + '</span><span class="chip">' + CAP + esc(j.exp) + '</span><span class="chip">' + PIN + esc(j.loc) + '</span></div></section>'
          + '<div class="d-layout"><div class="stack">'
          + (TJ_DESC[j.slug] ? '<section class="panel"><h2>About the role</h2><p style="margin:0;color:var(--muted)">' + esc(TJ_DESC[j.slug]) + '</p></section>' : '')
          + '<section class="panel"><h2>At a glance</h2><dl class="facts"><div><dt>Company</dt><dd>' + esc(j.company) + '</dd></div><div><dt>Work mode</dt><dd>' + esc(j.mode) + '</dd></div><div><dt>Experience</dt><dd>' + esc(j.exp) + '</dd></div><div><dt>Location</dt><dd>' + esc(j.loc) + '</dd></div></dl></section>'
          + '<section class="panel"><h2>Skills</h2><div class="skills">' + sk + '</div></section>'
          + '<section class="panel"><h2>How applying works</h2><p style="margin:0;color:var(--muted)">Apply directly with your resume. Your profile is matched against the skills above and reviewed within 48 hours.</p></section></div>'
          + '<aside class="panel apply side"><h2>Interested in this role?</h2>' + applySideBtnHtml + '<button class="btn block" type="button" data-share>Copy link to share</button><small><i></i>Reviewed within 48 hours</small></aside></div>'
          + '<div class="bar"><button class="btn share" type="button" data-share aria-label="Copy link">Share</button>' + barApplyBtnHtml + '</div>';

      [].slice.call(target.querySelectorAll('[data-share]')).forEach(function (b) { b.addEventListener('click', share); });

      function handleStartAi() {
        if (options.onStartAiInterview) {
          options.onStartAiInterview({ slug: j.slug, title: j.title, company: j.company });
        } else {
          window.location.href = '/interview/candidate';
        }
      }

      function updateButtonsToAttendAi() {
        var applyBtns = target.querySelectorAll('[data-apply]');
        [].slice.call(applyBtns).forEach(function (btn) {
          btn.removeAttribute('data-apply');
          btn.setAttribute('data-attend-ai', 'true');
          btn.classList.add('iv-attend-mode');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span>';
        });
      }

      target.addEventListener('click', function (ev) {
        var attendBtn = ev.target.closest('[data-attend-ai]');
        if (attendBtn) {
          ev.preventDefault();
          handleStartAi();
          return;
        }
        var applyBtn = ev.target.closest('[data-apply]');
        if (applyBtn) {
          ev.preventDefault();
          var candAuth = getCandAuth();
          if (candAuth) {
            if (window.TJ && window.TJ.addApply) {
              window.TJ.addApply(j.slug);
            } else {
              var al = [];
              try { al = JSON.parse(localStorage.getItem('tj-apply') || '[]'); } catch (_) {}
              if (al.indexOf(j.slug) < 0) {
                al.push(j.slug);
                try { localStorage.setItem('tj-apply', JSON.stringify(al)); } catch (_) {}
              }
            }
            updateButtonsToAttendAi();
            toast('Application submitted successfully! Attend your AI Interview for review and validation.', 4500);
          } else {
            if (options.onOpenAuth) options.onOpenAuth();
            else toast('Please sign in to apply');
          }
          return;
        }
      });

      var crumbBtn = target.querySelector('.crumb');
      if (crumbBtn) {
        crumbBtn.addEventListener('click', function (e) {
          e.preventDefault();
          closeDetail();
        });
      }
      var brandBtn = target.querySelector('header .brand');
      if (brandBtn) {
        brandBtn.addEventListener('click', function (e) {
          e.preventDefault();
          closeDetail();
        });
      }
      var signinBtn = target.querySelector('[data-signin]');
      var dMe = target.querySelector('#d-me');
      var dMeAv = target.querySelector('#d-me-av');

      var currentProfile = getCandAuth();
      var isAuth = Boolean(currentProfile);
      if (signinBtn) {
        signinBtn.hidden = isAuth;
        signinBtn.style.display = isAuth ? 'none' : '';
        signinBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (options.onOpenAuth) options.onOpenAuth();
        });
      }
      if (dMe) {
        dMe.hidden = !isAuth;
        dMe.style.display = isAuth ? 'inline-flex' : 'none';
      }
      if (isAuth) {
        var displayName = (currentProfile && (currentProfile.candidate_name || currentProfile.name)) || 'Candidate';
        if (dMeAv) dMeAv.textContent = displayName.charAt(0).toUpperCase();
      }
      var dAv = target.querySelector('#d-av-trigger');
      if (dAv) dAv.addEventListener('click', toggleDrawer);
    }

      function getProf() { return container.querySelector('#profile-page') || document.getElementById('profile-page'); }

      function openDrawer() {
        var wrap = document.getElementById('profile-drawer-wrap');
        if (!wrap) return;
        wrap.hidden = false;
        setTimeout(function () { wrap.classList.add('open'); }, 10);

        var p = (window.TJ && window.TJ.profile ? window.TJ.profile() : null) || {};
        var cand = {};
        try { cand = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}
        var name = cand.candidate_name || cand.name || p.name || 'Candidate';
        var email = cand.candidate_email || cand.email || p.email || '';
        var av = document.getElementById('drawer-av');
        var nm = document.getElementById('drawer-name');
        var em = document.getElementById('drawer-email');
        if (av) av.textContent = (name.charAt(0) || 'C').toUpperCase();
        if (nm) nm.textContent = name;
        if (em) em.textContent = email;
      }

      function closeDrawer() {
        var wrap = document.getElementById('profile-drawer-wrap');
        if (!wrap) return;
        wrap.classList.remove('open');
        setTimeout(function () { wrap.hidden = true; }, 260);
      }

      function toggleDrawer() {
        var wrap = document.getElementById('profile-drawer-wrap');
        if (wrap && wrap.classList.contains('open') && !wrap.hidden) {
          closeDrawer();
        } else {
          openDrawer();
        }
      }

      function renderProfileContent(profEl) {
        if (!profEl) return;
        var p = {};
        try { p = JSON.parse(localStorage.getItem('tj-profile') || '{}'); } catch (_) {}
        var cand = {};
        try { cand = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}
        var details = cand.details || p.details || {};

        var name = p.name || cand.candidate_name || cand.name || 'Mohammed Hashil';
        var title = p.title || cand.candidate_title || cand.title || details.title || 'AI Engineer | Python Backend Developer';
        var email = cand.candidate_email || cand.email || p.email || 'mohammedhashil2018@gmail.com';
        var phone = p.phone || cand.candidate_phone || cand.phone || details.phone || '8590955632';
        var initial = (name.charAt(0) || 'M').toUpperCase();
        var mode = p.mode || details.preferred_mode || cand.preferred_mode || 'Hybrid';
        var city = p.city || details.city || cand.location || 'Kozhikode, Kerala';
        var level = p.level || details.experience_level || cand.experience_level || 'Junior (1–2 years)';
        var photo = localStorage.getItem('candidate_photo') || cand.picture || p.picture || 'https://lh3.googleusercontent.com/a/ACg8ocJgmlA0pkgUg3Z75WHh2MwKpX42S9GTTdeV_2aI6HkM_ENmvC34=s96-c';

        var summary = p.summary || details.summary || cand.summary ||
          'AI Engineer and Python Backend Developer with hands-on experience building AI agents, LLM-powered applications, RAG systems, and scalable backend services. Currently developing agentic AI workflows and AI-integrated applications using Python, FastAPI, LangGraph, and MCP. Experienced in prompt engineering, tool calling, LLM evaluation, and building production-ready AI solutions.';

        var github = details.github_url || cand.github_url || p.github_url || 'https://github.com/HASHILnk';
        var linkedin = details.linkedin_url || cand.linkedin_url || p.linkedin_url || 'https://linkedin.com/in/mohammed-hashil-nk';

        var skillsList = [];
        if (p.skillsList && Array.isArray(p.skillsList) && p.skillsList.length) {
          skillsList = p.skillsList;
        } else if (p.skills) {
          skillsList = p.skills.split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        } else if (cand.skills && Array.isArray(cand.skills)) {
          skillsList = cand.skills;
        } else if (cand.skills) {
          skillsList = String(cand.skills).split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        } else if (details.skills && Array.isArray(details.skills)) {
          skillsList = details.skills;
        }
        if (!skillsList.length) {
          skillsList = [
            'Python', 'FastAPI', 'LangGraph', 'LangChain', 'AI Agents', 'MCP',
            'RAG', 'Prompt Engineering', 'LLM Evaluation', 'PostgreSQL',
            'Docker', 'SQL', 'Git', 'GitHub', 'Flask', 'REST APIs'
          ];
        }
        var skHtml = skillsList.map(function (s) { return '<span class="skill">' + esc(s) + '</span>'; }).join('');

        var experience = p.experience || details.experience || cand.experience || [
          {
            title: 'AI Engineer',
            company: 'Asimov X Technologies AB',
            duration: '04/2026 – Present',
            location: 'Kozhikode',
            description: 'Developed AI-powered applications and agentic AI workflows using Python and FastAPI. Designed LLM-integrated features using prompt engineering and tool calling.'
          },
          {
            title: 'AI Engineering Intern',
            company: 'Codely AI',
            duration: '01/2026 – 07/2026',
            location: 'Kozhikode',
            description: 'Built AI-powered applications and backend services using Python and FastAPI. Developed AI agents, multilingual voice applications, and LLM-powered workflows.'
          },
          {
            title: 'Junior Data Scientist Intern',
            company: 'Codeme Hub International',
            duration: '06/2025 – 08/2025',
            location: 'Kozhikode',
            description: 'Analyzed and visualized business data using Power BI, Excel, SQL, and Python.'
          }
        ];

        var expHtml = '<div class="prof-timeline">';
        experience.forEach(function (exp) {
          expHtml +=
            '<div class="prof-timeline-item">' +
              '<div class="prof-timeline-dot"></div>' +
              '<div class="prof-timeline-header">' +
                '<span class="prof-timeline-title">' + esc(exp.title || '') + '</span>' +
                '<span class="prof-timeline-company">' + esc(exp.company || '') + '</span>' +
              '</div>' +
              '<div class="prof-timeline-meta">' +
                '<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:-1px;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + esc(exp.duration || '') + '</span>' +
                (exp.location ? '<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:-1px;margin-right:3px"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>' + esc(exp.location) + '</span>' : '') +
              '</div>' +
              '<p class="prof-timeline-desc">' + esc(exp.description || '') + '</p>' +
            '</div>';
        });
        expHtml += '</div>';

        var education = p.education || details.education || cand.education || [
          {
            degree: 'B.Tech in Computer Science and Engineering',
            institution: 'AWH Engineering College',
            score: 'CGPA: 8.32/10',
            duration: '11/2022 – 05/2026',
            location: 'Kozhikode'
          }
        ];

        var eduHtml = '';
        education.forEach(function (edu) {
          eduHtml +=
            '<div class="prof-edu-item">' +
              '<div>' +
                '<div class="prof-edu-degree">' + esc(edu.degree || '') + '</div>' +
                '<div class="prof-edu-inst">' + esc(edu.institution || '') + '</div>' +
                (edu.score ? '<span class="prof-edu-score">' + esc(edu.score) + '</span>' : '') +
              '</div>' +
              '<div class="prof-edu-date">' + esc(edu.duration || '') + '</div>' +
            '</div>';
        });

        var projects = p.projects || details.projects || cand.projects || [
          {
            title: 'AI Voice Hotel Booking Agent',
            technologies: ['STT', 'LLMs', 'TTS', 'RAG', 'VAD', 'Python'],
            description: 'Built a multilingual voice AI agent with RAG for hotel search and policy retrieval, prompt engineering, conversation memory, and low-latency voice detection.'
          },
          {
            title: 'LoopFlow – Event-Driven AI Agent Platform',
            technologies: ['Python', 'FastAPI', 'LangGraph', 'MCP', 'Docker'],
            description: 'Developed an event-driven AI agent platform for repository analysis and autonomous tool-calling workflows.'
          }
        ];

        var projHtml = '<div class="prof-projects-grid">';
        projects.forEach(function (proj) {
          var techChips = '';
          if (Array.isArray(proj.technologies)) {
            techChips = proj.technologies.map(function (t) { return '<span class="prof-project-tag">' + esc(t) + '</span>'; }).join('');
          }
          projHtml +=
            '<div class="prof-project-card">' +
              '<div class="prof-project-title">' + esc(proj.title || '') + '</div>' +
              (techChips ? '<div class="prof-project-tags">' + techChips + '</div>' : '') +
              '<p class="prof-project-desc">' + esc(proj.description || '') + '</p>' +
            '</div>';
        });
        projHtml += '</div>';

        var applied = [];
        try { applied = JSON.parse(localStorage.getItem('tj-apply') || '[]'); } catch (_) {}

        var avatarHtml = '';
        if (photo) {
          avatarHtml =
            '<div class="prof-avatar-wrap" id="prof-avatar-trigger" title="Click to upload/change photo">' +
              '<img src="' + esc(photo) + '" alt="' + esc(name) + '" class="prof-avatar-img" />' +
              '<div class="prof-photo-upload-badge" title="Change photo">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '</div>' +
            '</div>';
        } else {
          avatarHtml =
            '<div class="prof-avatar-wrap" id="prof-avatar-trigger" title="Click to upload photo">' +
              '<div class="prof-avatar-fallback">' + esc(initial) + '</div>' +
              '<div class="prof-photo-upload-badge" title="Upload photo">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '</div>' +
            '</div>';
        }

        var headerAvatarHtml = photo ?
          '<img src="' + esc(photo) + '" alt="' + esc(name) + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #e4e4e7" />' :
          '<span class="av">' + esc(initial) + '</span>';

        profEl.innerHTML =
          '<header class="top">' +
            '<a class="brand" href="#" aria-label="All TermJobs roles">' +
              LOGO +
              '<div><b>TERMJOBS</b><span>Contract workforce platform</span></div>' +
            '</a>' +
            '<div class="top-actions">' +
              '<div class="me">' +
                '<button type="button" class="av-btn profile-trigger-btn" aria-label="Open profile menu">' +
                  headerAvatarHtml +
                '</button>' +
              '</div>' +
            '</div>' +
          '</header>' +
          '<a class="crumb" href="#" id="profile-back-link" aria-label="Back to all open roles">' + BACK + ' All open roles</a>' +
          '<section class="d-head">' +
            '<div class="d-top" style="align-items:center;gap:18px">' +
              avatarHtml +
              '<input type="file" id="prof-direct-avatar-input" accept="image/*" style="display:none" />' +
              '<div>' +
                '<div class="co" style="font-size:15px;display:flex;align-items:center;gap:6px">' +
                  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
                  '<span>Candidate Profile &middot; <b style="color:#059669">Verified</b></span>' +
                '</div>' +
                '<h1 style="margin:2px 0 6px">' + esc(name) + '</h1>' +
                '<div class="prof-headline">' + esc(title) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="chips">' +
              '<span class="chip mode">' + esc(mode) + '</span>' +
              '<span class="chip">' + PIN + esc(city) + '</span>' +
              '<span class="chip">' + CAP + esc(level) + '</span>' +
              '<span class="chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' + esc(email) + '</span>' +
              (phone ? '<span class="chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>+91 ' + esc(phone.replace(/^\+91/, '').trim()) + '</span>' : '') +
              (github ? '<a href="' + esc(github) + '" target="_blank" rel="noopener noreferrer" class="chip link-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>GitHub</a>' : '') +
              (linkedin ? '<a href="' + esc(linkedin) + '" target="_blank" rel="noopener noreferrer" class="chip link-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>LinkedIn</a>' : '') +
            '</div>' +
          '</section>' +
          '<div class="d-layout">' +
            '<div class="stack">' +
              '<section class="panel">' +
                '<h2>About you</h2>' +
                '<p style="margin:0;color:#374151;line-height:1.65;font-size:14.5px">' +
                  esc(summary) +
                '</p>' +
              '</section>' +
              '<section class="panel">' +
                '<h2>Work Experience</h2>' +
                expHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Key Projects</h2>' +
                projHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Education</h2>' +
                eduHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Skills &amp; Match Profile</h2>' +
                '<div class="skills">' + skHtml + '</div>' +
              '</section>' +
              '<section class="panel">' +
                '<h2>At a glance</h2>' +
                '<dl class="facts">' +
                  '<div><dt>Candidate</dt><dd>' + esc(name) + '</dd></div>' +
                  '<div><dt>Headline</dt><dd>' + esc(title) + '</dd></div>' +
                  '<div><dt>Preferred mode</dt><dd>' + esc(mode) + '</dd></div>' +
                  '<div><dt>Location</dt><dd>' + esc(city) + '</dd></div>' +
                  '<div><dt>Experience</dt><dd>' + esc(level) + '</dd></div>' +
                  '<div><dt>Email</dt><dd>' + esc(email) + '</dd></div>' +
                  '<div><dt>Applications</dt><dd>' + applied.length + ' applied</dd></div>' +
                '</dl>' +
              '</section>' +
              '<section class="panel">' +
                '<h2>Application &amp; AI Interview Status</h2>' +
                '<p style="margin:0 0 12px;color:var(--muted);line-height:1.5">You have applied to ' + applied.length + ' role(s). On-demand autonomous AI technical interviews are ready to attend.</p>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
                  '<span class="chip" style="background:#f4f4f5;color:#18181b;border:1px solid rgba(0,0,0,0.1);font-weight:600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg> AI Interviews Active (' + applied.length + ')</span>' +
                  '<button type="button" class="chip mode" style="cursor:pointer;border:none" id="profile-jump-interviews">View Interviews &rarr;</button>' +
                '</div>' +
              '</section>' +
            '</div>' +
            '<aside class="panel apply side">' +
              '<h2>Candidate Account</h2>' +
              '<button class="btn primary block" type="button" id="profile-side-edit">Edit preferences ' + ARROW + '</button>' +
              '<button class="btn block" type="button" id="profile-side-logout">Sign out</button>' +
              '<small><i></i>Auto-matches with 18 open partner roles</small>' +
            '</aside>' +
          '</div>' +
          '<div class="bar">' +
            '<button class="btn" type="button" id="profile-bar-edit">Edit preferences</button>' +
            '<button class="btn primary" type="button" id="profile-bar-logout">Sign out</button>' +
          '</div>';

        var backBtn = profEl.querySelector('#profile-back-link');
        if (backBtn) backBtn.addEventListener('click', function (e) { e.preventDefault(); closeProfilePage(); });
        var brandBtn = profEl.querySelector('header .brand');
        if (brandBtn) brandBtn.addEventListener('click', function (e) { e.preventDefault(); closeProfilePage(); });
        var trig = profEl.querySelector('.profile-trigger-btn');
        if (trig) trig.addEventListener('click', toggleDrawer);

        // Direct photo upload trigger on profile avatar
        var avTrigger = profEl.querySelector('#prof-avatar-trigger');
        var avFileInput = profEl.querySelector('#prof-direct-avatar-input');
        if (avTrigger && avFileInput) {
          avTrigger.addEventListener('click', function (e) {
            e.preventDefault();
            avFileInput.click();
          });
          avFileInput.addEventListener('change', function () {
            if (avFileInput.files && avFileInput.files[0]) {
              var reader = new FileReader();
              reader.onload = function (ev) {
                var newPhotoUrl = ev.target.result;
                try {
                  localStorage.setItem('candidate_photo', newPhotoUrl);
                  var pObj = JSON.parse(localStorage.getItem('tj-profile') || '{}');
                  pObj.picture = newPhotoUrl;
                  localStorage.setItem('tj-profile', JSON.stringify(pObj));

                  var cObj = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
                  cObj.picture = newPhotoUrl;
                  localStorage.setItem('candidate_profile_user', JSON.stringify(cObj));

                  // Async server update
                  var token = localStorage.getItem('candidate_profile_token');
                  if (token) {
                    fetch('/api/candidate-profile/me', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                      },
                      body: JSON.stringify({ picture: newPhotoUrl })
                    }).catch(function () {});
                  }
                } catch (_) {}
                renderProfileContent(profEl);
                toast('Profile photo updated successfully!', 3500);
              };
              reader.readAsDataURL(avFileInput.files[0]);
            }
          });
        }

        // In-place "Edit preferences" / Edit Profile modal
        function openProfileEditModal() {
          var pCurrent = {};
          try { pCurrent = JSON.parse(localStorage.getItem('tj-profile') || '{}'); } catch (_) {}
          var cCurrent = {};
          try { cCurrent = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}
          var detCurrent = cCurrent.details || pCurrent.details || {};

          var curName = pCurrent.name || cCurrent.candidate_name || cCurrent.name || 'Mohammed Hashil';
          var curTitle = pCurrent.title || cCurrent.candidate_title || cCurrent.title || detCurrent.title || 'AI Engineer | Python Backend Developer';
          var curMode = pCurrent.mode || detCurrent.preferred_mode || cCurrent.preferred_mode || 'Hybrid';
          var curCity = pCurrent.city || detCurrent.city || cCurrent.location || 'Kozhikode, Kerala';
          var curLevel = pCurrent.level || detCurrent.experience_level || cCurrent.experience_level || 'Junior (1–2 years)';
          var curSkills = pCurrent.skills || (Array.isArray(cCurrent.skills) ? cCurrent.skills.join(', ') : cCurrent.skills) || '';
          var curSummary = pCurrent.summary || detCurrent.summary || cCurrent.summary || '';
          var curPhone = pCurrent.phone || cCurrent.candidate_phone || cCurrent.phone || detCurrent.phone || '8590955632';
          var curGithub = detCurrent.github_url || cCurrent.github_url || pCurrent.github_url || 'https://github.com/HASHILnk';
          var curLinkedin = detCurrent.linkedin_url || cCurrent.linkedin_url || pCurrent.linkedin_url || 'https://linkedin.com/in/mohammed-hashil-nk';
          var curPhoto = localStorage.getItem('candidate_photo') || cCurrent.picture || pCurrent.picture || '';

          // Remove any existing edit modal
          var existingModal = document.getElementById('prof-edit-modal-wrap');
          if (existingModal) existingModal.remove();

          var modalWrap = document.createElement('div');
          modalWrap.className = 'prof-edit-modal-wrap';
          modalWrap.id = 'prof-edit-modal-wrap';

          var previewAvatarHtml = curPhoto ?
            '<img src="' + esc(curPhoto) + '" alt="' + esc(curName) + '" class="prof-edit-photo-preview" id="modal-photo-img" />' :
            '<div class="prof-edit-photo-preview" id="modal-photo-img">' + esc((curName.charAt(0) || 'M').toUpperCase()) + '</div>';

          modalWrap.innerHTML =
            '<div class="prof-edit-modal-card" role="dialog" aria-modal="true" aria-label="Edit Profile & Preferences">' +
              '<div class="prof-edit-modal-head">' +
                '<h3>Edit Profile &amp; Preferences</h3>' +
                '<button type="button" class="prof-edit-modal-close" id="modal-edit-close" aria-label="Close modal">&times;</button>' +
              '</div>' +
              '<form id="prof-edit-form" class="prof-edit-modal-body">' +
                '<div class="prof-edit-photo-row">' +
                  previewAvatarHtml +
                  '<div style="display:flex;flex-direction:column;gap:6px">' +
                    '<span style="font-weight:600;font-size:14px">Profile Photo</span>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                      '<button type="button" class="btn" style="padding:6px 12px;font-size:12.5px" id="modal-upload-btn">Upload new photo</button>' +
                      (curPhoto ? '<button type="button" class="btn" style="padding:6px 12px;font-size:12.5px;color:#d93025" id="modal-remove-photo-btn">Remove</button>' : '') +
                    '</div>' +
                    '<input type="file" id="modal-photo-input" accept="image/*" style="display:none" />' +
                  '</div>' +
                '</div>' +
                '<div class="prof-edit-grid-2">' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-name">Full Name</label>' +
                    '<input type="text" id="ep-name" value="' + esc(curName) + '" required />' +
                  '</div>' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-title">Professional Title</label>' +
                    '<input type="text" id="ep-title" value="' + esc(curTitle) + '" placeholder="e.g. AI Engineer | Python Developer" required />' +
                  '</div>' +
                '</div>' +
                '<div class="prof-edit-grid-2">' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-mode">Preferred Work Mode</label>' +
                    '<select id="ep-mode">' +
                      '<option value="Any mode"' + (curMode === 'Any mode' ? ' selected' : '') + '>Any mode</option>' +
                      '<option value="Hybrid"' + (curMode === 'Hybrid' ? ' selected' : '') + '>Hybrid</option>' +
                      '<option value="Remote"' + (curMode === 'Remote' ? ' selected' : '') + '>Remote</option>' +
                      '<option value="On-site"' + (curMode === 'On-site' ? ' selected' : '') + '>On-site</option>' +
                    '</select>' +
                  '</div>' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-city">Location / City</label>' +
                    '<input type="text" id="ep-city" value="' + esc(curCity) + '" placeholder="e.g. Kozhikode, Kerala" />' +
                  '</div>' +
                '</div>' +
                '<div class="prof-edit-grid-2">' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-level">Experience Level</label>' +
                    '<select id="ep-level">' +
                      '<option value="Fresher"' + (curLevel === 'Fresher' ? ' selected' : '') + '>Fresher</option>' +
                      '<option value="Junior (1–2 years)"' + (curLevel.indexOf('Junior') > -1 || curLevel.indexOf('1') > -1 ? ' selected' : '') + '>Junior (1–2 years)</option>' +
                      '<option value="Mid-level (2–4 years)"' + (curLevel.indexOf('Mid') > -1 ? ' selected' : '') + '>Mid-level (2–4 years)</option>' +
                      '<option value="Experienced (3+ years)"' + (curLevel.indexOf('Experienced') > -1 || curLevel.indexOf('Senior') > -1 ? ' selected' : '') + '>Experienced (3+ years)</option>' +
                    '</select>' +
                  '</div>' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-phone">Phone Number</label>' +
                    '<input type="tel" id="ep-phone" value="' + esc(phone) + '" placeholder="e.g. 8590955632" />' +
                  '</div>' +
                '</div>' +
                '<div class="prof-edit-field">' +
                  '<label for="ep-skills">Skills (Comma-separated)</label>' +
                  '<input type="text" id="ep-skills" value="' + esc(skillsList.join(', ')) + '" placeholder="e.g. Python, FastAPI, LangGraph, Docker" />' +
                '</div>' +
                '<div class="prof-edit-field">' +
                  '<label for="ep-summary">About you / Profile Statement</label>' +
                  '<textarea id="ep-summary" rows="4">' + esc(summary) + '</textarea>' +
                '</div>' +
                '<div class="prof-edit-grid-2">' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-github">GitHub Profile URL</label>' +
                    '<input type="url" id="ep-github" value="' + esc(github) + '" placeholder="https://github.com/username" />' +
                  '</div>' +
                  '<div class="prof-edit-field">' +
                    '<label for="ep-linkedin">LinkedIn Profile URL</label>' +
                    '<input type="url" id="ep-linkedin" value="' + esc(linkedin) + '" placeholder="https://linkedin.com/in/username" />' +
                  '</div>' +
                '</div>' +
              '</form>' +
              '<div class="prof-edit-modal-foot">' +
                '<button type="button" class="btn" id="modal-edit-cancel">Cancel</button>' +
                '<button type="button" class="btn primary" id="modal-edit-save">Save changes</button>' +
              '</div>' +
            '</div>';

          document.body.appendChild(modalWrap);

          var closeModal = function () {
            if (modalWrap) modalWrap.remove();
          };

          var closeBtn = modalWrap.querySelector('#modal-edit-close');
          if (closeBtn) closeBtn.addEventListener('click', closeModal);
          var cancelBtn = modalWrap.querySelector('#modal-edit-cancel');
          if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

          modalWrap.addEventListener('click', function (e) {
            if (e.target === modalWrap) closeModal();
          });

          // Upload photo inside modal
          var modalUploadBtn = modalWrap.querySelector('#modal-upload-btn');
          var modalPhotoInput = modalWrap.querySelector('#modal-photo-input');
          var modalRemovePhotoBtn = modalWrap.querySelector('#modal-remove-photo-btn');
          var pendingPhotoUrl = curPhoto;

          if (modalUploadBtn && modalPhotoInput) {
            modalUploadBtn.addEventListener('click', function () {
              modalPhotoInput.click();
            });
            modalPhotoInput.addEventListener('change', function () {
              if (modalPhotoInput.files && modalPhotoInput.files[0]) {
                var reader = new FileReader();
                reader.onload = function (ev) {
                  pendingPhotoUrl = ev.target.result;
                  var imgContainer = modalWrap.querySelector('#modal-photo-img');
                  if (imgContainer) {
                    var newImg = document.createElement('img');
                    newImg.src = pendingPhotoUrl;
                    newImg.className = 'prof-edit-photo-preview';
                    newImg.id = 'modal-photo-img';
                    imgContainer.replaceWith(newImg);
                  }
                };
                reader.readAsDataURL(modalPhotoInput.files[0]);
              }
            });
          }

          if (modalRemovePhotoBtn) {
            modalRemovePhotoBtn.addEventListener('click', function () {
              pendingPhotoUrl = '';
              var imgContainer = modalWrap.querySelector('#modal-photo-img');
              if (imgContainer) {
                var initialDiv = document.createElement('div');
                initialDiv.className = 'prof-edit-photo-preview';
                initialDiv.id = 'modal-photo-img';
                initialDiv.textContent = (curName.charAt(0) || 'M').toUpperCase();
                imgContainer.replaceWith(initialDiv);
              }
            });
          }

          // Save changes inside modal
          var saveBtn = modalWrap.querySelector('#modal-edit-save');
          if (saveBtn) {
            saveBtn.addEventListener('click', function (e) {
              e.preventDefault();
              var newName = (modalWrap.querySelector('#ep-name') ? modalWrap.querySelector('#ep-name').value.trim() : '') || curName;
              var newTitle = (modalWrap.querySelector('#ep-title') ? modalWrap.querySelector('#ep-title').value.trim() : '') || curTitle;
              var newMode = modalWrap.querySelector('#ep-mode') ? modalWrap.querySelector('#ep-mode').value : curMode;
              var newCity = (modalWrap.querySelector('#ep-city') ? modalWrap.querySelector('#ep-city').value.trim() : '') || curCity;
              var newLevel = modalWrap.querySelector('#ep-level') ? modalWrap.querySelector('#ep-level').value : curLevel;
              var newSkillsStr = modalWrap.querySelector('#ep-skills') ? modalWrap.querySelector('#ep-skills').value.trim() : '';
              var newSummary = (modalWrap.querySelector('#ep-summary') ? modalWrap.querySelector('#ep-summary').value.trim() : '') || curSummary;
              var newPhone = (modalWrap.querySelector('#ep-phone') ? modalWrap.querySelector('#ep-phone').value.trim() : '') || curPhone;
              var newGithub = (modalWrap.querySelector('#ep-github') ? modalWrap.querySelector('#ep-github').value.trim() : '') || curGithub;
              var newLinkedin = (modalWrap.querySelector('#ep-linkedin') ? modalWrap.querySelector('#ep-linkedin').value.trim() : '') || curLinkedin;

              var newSkillsArr = newSkillsStr.split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);

              // Update localStorage
              try {
                if (pendingPhotoUrl) {
                  localStorage.setItem('candidate_photo', pendingPhotoUrl);
                } else if (pendingPhotoUrl === '') {
                  localStorage.removeItem('candidate_photo');
                }

                var updatedTj = {
                  ...pCurrent,
                  name: newName,
                  title: newTitle,
                  mode: newMode,
                  city: newCity,
                  level: newLevel,
                  skills: newSkillsArr.join(', '),
                  skillsList: newSkillsArr,
                  summary: newSummary,
                  phone: newPhone,
                  picture: pendingPhotoUrl,
                  github_url: newGithub,
                  linkedin_url: newLinkedin
                };
                localStorage.setItem('tj-profile', JSON.stringify(updatedTj));

                var updatedCand = {
                  ...cCurrent,
                  candidate_name: newName,
                  name: newName,
                  candidate_title: newTitle,
                  title: newTitle,
                  candidate_phone: newPhone,
                  skills: newSkillsArr,
                  summary: newSummary,
                  picture: pendingPhotoUrl,
                  details: {
                    ...(cCurrent.details || {}),
                    preferred_mode: newMode,
                    city: newCity,
                    experience_level: newLevel,
                    github_url: newGithub,
                    linkedin_url: newLinkedin,
                    skills: newSkillsArr,
                    summary: newSummary
                  }
                };
                localStorage.setItem('candidate_profile_user', JSON.stringify(updatedCand));

                // Async backend PUT
                var token = localStorage.getItem('candidate_profile_token');
                if (token) {
                  fetch('/api/candidate-profile/me', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                      candidate_name: newName,
                      candidate_title: newTitle,
                      candidate_phone: newPhone,
                      skills: newSkillsArr,
                      summary: newSummary,
                      preferred_mode: newMode,
                      city: newCity,
                      experience_level: newLevel,
                      github_url: newGithub,
                      linkedin_url: newLinkedin,
                      picture: pendingPhotoUrl
                    })
                  }).catch(function () {});
                }

                // Update header DOM
                var meName = document.getElementById('me-name');
                var dName = document.getElementById('drawer-name');
                if (meName) meName.textContent = newName;
                if (dName) dName.textContent = newName;
              } catch (_) {}

              closeModal();
              renderProfileContent(profEl);
              toast('Profile & preferences updated successfully!', 4000);
            });
          }
        }

        var editBtns = profEl.querySelectorAll('#profile-side-edit, #profile-bar-edit');
        [].slice.call(editBtns).forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.preventDefault();
            openProfileEditModal();
          });
        });

        var logoutBtns = profEl.querySelectorAll('#profile-side-logout, #profile-bar-logout');
        [].slice.call(logoutBtns).forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.preventDefault();
            closeProfilePage();
            if (options.onLogout) options.onLogout();
          });
        });

        var jumpIv = profEl.querySelector('#profile-jump-interviews');
        if (jumpIv) {
          jumpIv.addEventListener('click', function () {
            closeProfilePage();
            var b = document.querySelector('.tab[data-v="interview"]');
            if (b) b.click();
          });
        }
      }

      function openProfilePage() {
        closeDrawer();
        closeDetail();
        var list = getList(), det = getDet(), prof = getProf();
        if (!prof) return;
        window.__tjY = getScrollPos();
        if (list) { list.hidden = true; list.style.display = 'none'; }
        if (det) { det.hidden = true; det.style.display = 'none'; }
        prof.hidden = false;
        prof.style.display = 'block';
        document.body.classList.add('detail', 'on-profile');
        renderProfileContent(prof);
        document.title = 'Candidate Profile – TermJobs';
        if (window.location.hash !== '#profile') {
          try {
            history.pushState({ tjView: 'profile' }, '', window.location.pathname + window.location.search + '#profile');
          } catch (e) {
            history.replaceState(null, '', window.location.pathname + window.location.search + '#profile');
          }
        }
        setScrollPos(0);
      }

      function closeProfilePage() {
        var list = getList(), prof = getProf();
        if (!prof || prof.hidden) return;
        prof.hidden = true;
        prof.style.display = 'none';
        document.body.classList.remove('on-profile');
        if (list) {
          list.hidden = false;
          list.style.display = '';
        }
        document.body.classList.remove('detail');
        document.title = 'Open Roles – TermJobs';
        if (location.hash === '#profile') {
          try {
            history.pushState(null, '', window.location.pathname + window.location.search);
          } catch (e) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
        setScrollPos(window.__tjY || 0);
      }

      function openDetail(slug) {
        closeProfilePage();
        var list = getList(), det = getDet();
        if (!list || !det) return;
        var j = JOBS.filter(function (x) { return x.slug === slug || x.id === slug; })[0]; if (!j) return;
        if (!det.hidden && det.dataset.curSlug === slug) return;
        window.__tjY = getScrollPos();
        list.hidden = true;
        list.style.display = 'none';
        det.hidden = false;
        det.style.display = 'block';
        det.dataset.curSlug = slug;
        document.body.classList.add('detail');
        render(j, det);
        document.title = j.title + ' at ' + j.company + ' – TermJobs';
        if (window.location.hash !== '#job-' + slug) {
          try {
            history.pushState({ tjSlug: slug }, '', window.location.pathname + window.location.search + '#job-' + slug);
          } catch (e) {
            history.replaceState(null, '', window.location.pathname + window.location.search + '#job-' + slug);
          }
        }
        setScrollPos(0);
      }

      function closeDetail() {
        var list = getList(), det = getDet();
        if (!det || det.hidden) return;
        det.hidden = true;
        det.style.display = 'none';
        det.dataset.curSlug = '';
        if (list) {
          list.hidden = false;
          list.style.display = '';
        }
        document.body.classList.remove('detail');
        document.title = 'Open Roles – TermJobs';
        if (location.hash && location.hash.indexOf('#job-') === 0) {
          try {
            history.pushState(null, '', window.location.pathname + window.location.search);
          } catch (e) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
        setScrollPos(window.__tjY || 0);
      }

      function route() {
        if (location.hash === '#profile') {
          openProfilePage();
          return;
        }
        var m = location.hash.match(/^#job-([a-z0-9-]+)$/), j = m && JOBS.filter(function (x) { return x.slug === m[1] || x.id === m[1]; })[0];
        if (j) { openDetail(j.slug); }
        else {
          closeDetail();
          closeProfilePage();
        }
      }

      // Container-level click delegator for card clicks, crumb, and detail actions
      var onContainerClick = function (e) {
        var crumb = e.target.closest('.crumb, #detail a.brand');
        if (crumb) {
          e.preventDefault();
          closeDetail();
          return;
        }
        // Don't intercept cards inside suggested track (#sug-track); they are handled by suggestion modal
        if (e.target.closest('#sug-track')) {
          return;
        }
        var c = e.target.closest('a.card, [data-slug]');
        if (c && !e.target.closest('button.bm, button.un, button.dsk, button.dsv, button.dap, button.iv-attend-ai, .iv-attend-ai')) {
          var slug = c.dataset.slug;
          if (!slug) {
            var h = c.getAttribute('href') || '';
            var m = h.match(/#job-([a-z0-9-]+)/i);
            if (m) slug = m[1];
          }
          if (slug) {
            e.preventDefault();
            openDetail(slug);
            return;
          }
        }
      };
      container.addEventListener('click', onContainerClick);
      cleanups.push(function () { container.removeEventListener('click', onContainerClick); });

      window.TJ = window.TJ || {};
      window.TJ.openDrawer = openDrawer;
      window.TJ.closeDrawer = closeDrawer;
      window.TJ.toggleDrawer = toggleDrawer;
      window.TJ.openProfile = openProfilePage;
      window.TJ.closeProfile = closeProfilePage;

      var avTrigger = container.querySelector('#av-trigger') || document.getElementById('av-trigger');
      if (avTrigger) avTrigger.addEventListener('click', toggleDrawer);

      var drawerClose = container.querySelector('#drawer-close') || document.getElementById('drawer-close');
      if (drawerClose) drawerClose.addEventListener('click', closeDrawer);

      var drawerBackdrop = container.querySelector('#profile-drawer-backdrop') || document.getElementById('profile-drawer-backdrop');
      if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

      var drawerViewProf = container.querySelector('#drawer-view-profile') || document.getElementById('drawer-view-profile');
      if (drawerViewProf) drawerViewProf.addEventListener('click', function (e) {
        e.preventDefault();
        openProfilePage();
      });

      var drawerEditPref = container.querySelector('#drawer-edit-pref') || document.getElementById('drawer-edit-pref');
      if (drawerEditPref) drawerEditPref.addEventListener('click', function (e) {
        e.preventDefault();
        closeDrawer();
        if (window.TJ && window.TJ.openModal) window.TJ.openModal();
        else {
          var b = document.getElementById('edit-pref');
          if (b) b.click();
        }
      });

      var drawerIvNav = container.querySelector('#drawer-interviews-nav') || document.getElementById('drawer-interviews-nav');
      if (drawerIvNav) drawerIvNav.addEventListener('click', function (e) {
        e.preventDefault();
        closeDrawer();
        closeProfilePage();
        closeDetail();
        var ivTab = document.querySelector('.tab[data-v="interview"]');
        if (ivTab) ivTab.click();
      });

      var drawerSignout = container.querySelector('#drawer-signout') || document.getElementById('drawer-signout');
      if (drawerSignout) drawerSignout.addEventListener('click', function (e) {
        e.preventDefault();
        closeDrawer();
        closeProfilePage();
        if (options.onLogout) options.onLogout();
      });

      addDocListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var wrap = document.getElementById('profile-drawer-wrap');
          if (wrap && wrap.classList.contains('open')) {
            closeDrawer();
            return;
          }
          if (document.body.classList.contains('on-profile')) {
            closeProfilePage();
            return;
          }
        }
      });

      addDocListener('click', function (e) { if (e.target.closest('a.card')) window.__tjY = getScrollPos(); }, true);
      addWinListener('popstate', route);
      addWinListener('hashchange', route);
      if (location.hash === '#profile' || (location.hash && location.hash.match(/^#job-([a-z0-9-]+)$/))) { route(); }
    })();

    // 2. Script 1: Search & pagination
    (function () {
      var PER = (function (w) { return w >= 1200 ? 8 : w >= 900 ? 9 : 6; })(window.innerWidth), page = 1, cards = [].slice.call(document.querySelectorAll('.card')), q = document.getElementById('q'),
        fm = document.getElementById('f-mode'), fc = document.getElementById('f-city'), fl = document.getElementById('f-level'),
        count = document.getElementById('count'), empty = document.getElementById('empty'), r2 = document.getElementById('reset2'),
        pager = document.getElementById('pager'), grid = document.getElementById('grid'), toolbar = document.querySelector('.toolbar');
      var chev = function (d) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>'; };
      function match(c, t) { return (!t || c.dataset.q.indexOf(t) > -1) && (!fm.value || c.dataset.mode === fm.value) && (!fc.value || c.dataset.city === fc.value) && (!fl.value || c.dataset.level === fl.value); }
      function pageList(p, n) {
        if (n <= 7) { var a = []; for (var i = 1; i <= n; i++)a.push(i); return a; }
        var out = [1]; if (p > 3) out.push('…');
        for (var k = Math.max(2, p - 1); k <= Math.min(n - 1, p + 1); k++)out.push(k);
        if (p < n - 2) out.push('…'); out.push(n); return out;
      }
      function run(scroll) {
        var t = q.value.trim().toLowerCase(), m = cards.filter(function (c) { return match(c, t); }), n = m.length, pages = Math.max(1, Math.ceil(n / PER));
        if (page > pages) page = pages; if (page < 1) page = 1;
        var start = (page - 1) * PER, show = m.slice(start, start + PER);
        cards.forEach(function (c) { c.hidden = true; });
        show.forEach(function (c, i) { c.hidden = false; c.style.setProperty('--i', i); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; });
        count.textContent = n ? ('Showing ' + (start + 1) + '–' + (start + show.length) + ' of ' + n + ' roles') : 'No roles found';
        empty.hidden = n > 0;
        r2.hidden = !(t || fm.value || fc.value || fl.value);
        var h = '';
        if (pages > 1) {
          h += '<button class="nav" type="button" data-p="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + ' aria-label="Previous page">' + chev(-1) + '<span>Prev</span></button>';
          pageList(page, pages).forEach(function (p) { h += p === '…' ? '<span class="dots">…</span>' : '<button type="button" data-p="' + p + '" class="' + (p === page ? 'on' : '') + '"' + (p === page ? ' aria-current="page"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>'; });
          h += '<button class="nav" type="button" data-p="' + (page + 1) + '"' + (page === pages ? ' disabled' : '') + ' aria-label="Next page"><span>Next</span>' + chev(1) + '</button>';
        }
        pager.innerHTML = h; pager.hidden = pages < 2;
        if (scroll) { var y = grid.getBoundingClientRect().top + window.pageYOffset - toolbar.offsetHeight - 12; window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }
      }
      pager.addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (!b || b.disabled) return; page = +b.dataset.p; run(true); });
      function reset() { q.value = ''; fm.value = ''; fc.value = ''; fl.value = ''; page = 1; run(); }
      [q, fm, fc, fl].forEach(function (el) { el.addEventListener('input', function () { page = 1; run(); }); });
      document.getElementById('reset').addEventListener('click', reset); r2.addEventListener('click', reset);
      run(); setTimeout(function () { document.body.classList.add('ready'); }, 1200);
    })();

    // 3. Script 2: Suggestion matching, swipe deck & profile
    (function () {
      var $ = function (id) { return document.getElementById(id); };
      var sec = $('sug'), track = $('sug-track'), cards = [].slice.call(track.querySelectorAll('.sc')), pills = [].slice.call(document.querySelectorAll('.pill')),
        cnt = $('sug-count'), prev = $('sug-prev'), next = $('sug-next'), ov = $('ov'), form = $('pf'), signin = $('signin'), me = $('me'),
        snack = $('snack'), sheet = $('sheet'), sheetList = $('sheet-list'), deckCtl = $('deck-ctl'), deckEmpty = $('deck-empty'), applyBtn = $('apply-review'),
        mq = window.matchMedia('(max-width: 760px)'), LV = ['Fresher', 'Junior', 'Mid-level', 'Experienced'];
      var mode = '', start = 0, PER = 3, ranked = cards.slice(), decided = {}, last = null, snackT;
      function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
      function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } if (k === 'tj-saved' && window.TJ && window.TJ.drawSaved) window.TJ.drawSaved(); }
      var hasToken = Boolean(localStorage.getItem('candidate_profile_token'));
      var hasCandidate = Boolean(options.candidateUser);
      var profile = (hasToken || hasCandidate) ? load('tj-profile', null) : null;
      if (!hasToken && !hasCandidate) {
        try { localStorage.removeItem('tj-profile'); } catch (_) {}
      }
      if (!profile && options.candidateUser) {
        var cu = options.candidateUser;
        var cud = cu.details || {};
        var cuSkills = Array.isArray(cu.skills) ? cu.skills.join(', ') : (cu.skills || '');
        profile = {
          name: cu.candidate_name || cu.name || (cu.candidate_email ? cu.candidate_email.split('@')[0] : 'Candidate'),
          skills: cuSkills,
          skillsList: Array.isArray(cu.skills) ? cu.skills : [],
          projects: cud.projects || cu.projects || [],
          github_url: cud.github_url || cu.github_url || '',
          github_evidence: cud.github_evidence || cu.github_evidence || null,
          mode: cud.preferred_mode || cu.preferred_mode || '',
          city: cud.city || cu.location || '',
          level: cud.experience_level || cu.experience_level || '',
        };
        store('tj-profile', profile);
      }
      var applyList = load('tj-apply', []), saved = load('tj-saved', []), seen = false, hintT = null;
      if (Array.isArray(applyList)) {
        applyList.forEach(function (s) { decided[s] = 'apply'; });
      } else {
        applyList = [];
      }
      if (!Array.isArray(saved)) saved = [];
      function clamp(v) { return Math.max(0, Math.min(1, v)); }
      function toSkillsStr(sk) {
        if (Array.isArray(sk)) return sk.map(function (s) { return typeof s === 'string' ? s : (s && s.name ? s.name : ''); }).filter(Boolean).join(', ');
        if (typeof sk === 'string') return sk;
        return '';
      }
      var SYNONYMS = {
        "python": ["py", "python3", "django", "fastapi", "flask"],
        "react": ["reactjs", "react.js", "next.js", "nextjs", "redux"],
        "javascript": ["js", "node", "nodejs", "node.js", "typescript", "ts"],
        "typescript": ["ts", "javascript", "js"],
        "flutter": ["dart", "mobile", "android", "ios"],
        "dart": ["flutter"],
        "ui": ["ux", "figma", "ui/ux", "frontend", "designer"],
        "figma": ["ui", "ux", "ui/ux", "design"],
        "docker": ["kubernetes", "k8s", "devops", "aws", "ci/cd"],
        "aws": ["cloud", "docker", "devops", "ci/cd"],
        "devops": ["aws", "docker", "ci/cd", "cloud"],
        "seo": ["digital marketing", "google ads", "marketing"],
        "marketing": ["seo", "google ads", "growth"],
        "sql": ["data", "analyst", "excel", "database"],
        "sales": ["business development", "bde", "key account", "communication"]
      };

      function expandTokens(toks) {
        var set = {};
        toks.forEach(function (t) {
          if (!t) return;
          var clean = String(t).toLowerCase().trim();
          if (clean.length < 2) return;
          set[clean] = true;
          if (SYNONYMS[clean]) {
            SYNONYMS[clean].forEach(function (syn) { set[syn] = true; });
          }
          for (var key in SYNONYMS) {
            if (SYNONYMS[key].indexOf(clean) > -1) set[key] = true;
          }
        });
        return Object.keys(set);
      }

      function score(c, pr) {
        var s = 35;
        if (!pr.mode || c.dataset.mode === pr.mode) s += 15;
        if (!pr.city || c.dataset.city === pr.city) s += 10; else if (c.dataset.city === 'Across India') s += 6;
        if (!pr.level) s += 10; else { var d = Math.abs(LV.indexOf(c.dataset.level) - LV.indexOf(pr.level)); s += d === 0 ? 10 : (d === 1 ? 5 : 0); }

        var kw = (c.dataset.kw || '').toLowerCase();

        // 1. Direct skills & synonyms match (up to 20 pts)
        var rawToks = toSkillsStr(pr.skills).toLowerCase().split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 1; });
        var allToks = expandTokens(rawToks);
        if (allToks.length) {
          var h = allToks.filter(function (t) { return kw.indexOf(t) > -1; }).length;
          s += Math.round(20 * Math.min(1, h / Math.min(allToks.length, 3)));
        } else {
          s += 5;
        }

        // 2. Project Technologies Match from Resume (up to 12 pts)
        if (pr.projects && Array.isArray(pr.projects)) {
          var projMatches = 0;
          pr.projects.forEach(function (pj) {
            var tech = (Array.isArray(pj.technologies) ? pj.technologies.join(' ') : (pj.technologies || '')) + ' ' + (pj.title || '') + ' ' + (pj.description || '');
            var pToks = expandTokens(tech.toLowerCase().split(/[\s,;\n]+/));
            var matched = pToks.some(function (t) { return kw.indexOf(t) > -1; });
            if (matched) projMatches++;
          });
          if (projMatches > 0) s += Math.min(12, projMatches * 6);
        }

        // 3. Live GitHub Verified Repositories Match (up to 8 pts)
        if (pr.github_evidence && pr.github_evidence.top_repos) {
          var ghRepos = pr.github_evidence.top_repos || [];
          var ghMatches = 0;
          ghRepos.forEach(function (r) {
            var langs = (r.languages || []).concat([r.name || '', r.description || '']).join(' ').toLowerCase();
            var ghToks = expandTokens(langs.split(/[\s,;\n]+/));
            if (ghToks.some(function (t) { return kw.indexOf(t) > -1; })) ghMatches++;
          });
          if (ghMatches > 0) s += Math.min(8, ghMatches * 4);
        }

        return Math.min(99, s);
      }
      function esc2(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function expOf(c) { var m = c.querySelectorAll('.chip.mob-only'); return m.length ? m[m.length - 1].textContent : c.dataset.level; }
      function why(c) {
        var pr = profile || {}, out = [], d = c.dataset, kw = (d.kw || '').toLowerCase();

        // 1. GitHub Repos Match
        if (pr.github_evidence && pr.github_evidence.top_repos) {
          var matchedRepos = (pr.github_evidence.top_repos || []).filter(function (r) {
            var combined = ((r.languages || []).concat([r.name || ''])).join(' ').toLowerCase();
            return expandTokens(combined.split(/[\s,;\n]+/)).some(function (t) { return kw.indexOf(t) > -1; });
          });
          if (matchedRepos.length) {
            var langs = Array.from(new Set(matchedRepos.flatMap(function (r) { return r.languages || []; }))).slice(0, 3);
            out.push('Verified in GitHub repos: ' + (langs.length ? langs.join(', ') : matchedRepos[0].name));
          }
        }

        // 2. Project Match from Resume
        if (pr.projects && Array.isArray(pr.projects)) {
          var matchedProjs = pr.projects.filter(function (pj) {
            var tech = (Array.isArray(pj.technologies) ? pj.technologies.join(' ') : (pj.technologies || '')) + ' ' + (pj.title || '');
            return expandTokens(tech.toLowerCase().split(/[\s,;\n]+/)).some(function (t) { return kw.indexOf(t) > -1; });
          });
          if (matchedProjs.length) {
            out.push('Projects match role: ' + (matchedProjs[0].title || 'Relevant project'));
          }
        }

        // 3. Direct skills match
        var rawToks = toSkillsStr(pr.skills).toLowerCase().split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 1; });
        var hits = rawToks.filter(function (t) { return kw.indexOf(t) > -1; });
        if (hits.length) {
          out.push('Uses your skills: ' + hits.slice(0, 3).join(', '));
        }

        // 4. Mode & City & Level
        if (pr.mode && d.mode === pr.mode) out.push('Matches your ' + d.mode + ' preference');
        if (pr.city) {
          if (d.city === pr.city) out.push(d.city === 'Across India' ? 'Open to candidates across India' : 'Based in ' + d.city);
          else if (d.city === 'Across India') out.push('Open to candidates across India');
        }
        if (pr.level) {
          var di = Math.abs(LV.indexOf(d.level) - LV.indexOf(pr.level));
          if (di === 0) out.push('Fits your ' + pr.level + ' level');
          else if (di === 1) out.push('Close to your ' + pr.level + ' level');
        }

        if (!out.length) {
          out.push('Experience wanted: ' + expOf(c));
          out.push('Reviewed within 48 hours');
          out.push('Apply directly with your resume');
        }
        return out;
      }
      function rank() {
        var pr = profile || {};
        cards.forEach(function (c, i) { c._p = score(c, pr); c._i = i; });
        ranked = cards.slice().sort(function (a, b) { return b._p - a._p || a._i - b._i; });
        ranked.forEach(function (c, i) {
          track.appendChild(c);
          var p = c._p;
          var ringEl = c.querySelector('.match-ring') || c.querySelector('.ring');
          var arc = ringEl ? ringEl.querySelector('.arc') : c.querySelector('.arc');
          var sp = ringEl ? ringEl.querySelector('span') : null;
          var bd = c.querySelector('.badge');
          if (arc) arc.style.setProperty('--off', (119.4 * (1 - p / 100)).toFixed(1));
          if (sp) sp.textContent = p + '%';
          if (bd) bd.textContent = i === 0 ? 'Top match' : p + '% match';
          if (ringEl) ringEl.setAttribute('aria-label', p + '% match');
          var w = c.querySelector('.why');
          if (!w) { w = document.createElement('div'); w.className = 'why'; c.insertBefore(w, c.querySelector('.mob-skills')); }
          w.innerHTML = '<div class="lbl">Why it matches</div><ul class="whyl">' + why(c).slice(0, 3).map(function (r) { return '<li>' + esc2(r) + '</li>'; }).join('') + '</ul>';
        });
      }
      function list() { return ranked.filter(function (c) { return !mode || c.dataset.mode === mode; }); }
      function deckList() { return list().filter(function (c) { return !decided[c.dataset.slug]; }); }
      function reset(c) { c.style.transform = ''; var a = c.querySelector('.stamp.apply'), k = c.querySelector('.stamp.skip'); a.style.opacity = 0; k.style.opacity = 0; }
      function updApply() { applyBtn.hidden = !applyList.length; applyBtn.textContent = 'Review & apply (' + applyList.length + ')'; }
      function paintBm() { cards.forEach(function (c) { var b = c.querySelector('.bm'), on = saved.indexOf(c.dataset.slug) > -1; if (b) { b.classList.toggle('saved', on); b.setAttribute('aria-pressed', on); } }); }
      function playHint() {
        if (seen || !mq.matches || sec.hidden) return;
        var c = track.querySelector('.sc.d0'); if (!c || c.classList.contains('dragging')) return;
        c.classList.remove('demo'); void c.offsetWidth; c.classList.add('demo');
      }
      function startHint() { if (seen || hintT) return; setTimeout(playHint, 900); hintT = setInterval(playHint, 7000); }
      function stopHint() {
        seen = true;
        clearInterval(hintT); hintT = null;
        [].slice.call(track.querySelectorAll('.demo')).forEach(function (x) { x.classList.remove('demo'); });
      }
      track.addEventListener('animationend', function (e) { if (e.animationName === 'swipeDemo') e.target.classList.remove('demo'); });
      function renderGrid() {
        var m = list(), show = m;
        cards.forEach(function (c) {
          c.hidden = true;
          c.classList.remove('big', 'd0', 'd1', 'd2');
          var tb = c.querySelector('.top-badge');
          if (tb) tb.hidden = true;
          reset(c);
        });
        show.forEach(function (c, i) {
          c.hidden = false;
          c.style.setProperty('--i', i);
          c.style.animation = 'none';
          void c.offsetWidth;
          c.style.animation = '';
          var tb = c.querySelector('.top-badge');
          if (!tb) {
            tb = document.createElement('span');
            tb.className = 'top-badge';
            tb.textContent = 'Top match';
            c.insertBefore(tb, c.firstChild);
          }
          tb.hidden = (i !== 0);
        });
        track.dataset.n = show.length;
        cnt.textContent = m.length ? (m.length + ' suggestions · scroll or use the arrows') : 'No suggestions for this filter';
        track.scrollLeft = 0; setTimeout(updArrows, 60);
        deckCtl.hidden = true; deckEmpty.hidden = true; $('deck-hint').hidden = true;
      }
      function renderDeck() {
        var q = deckList(), total = list().length, done = total - q.length;
        cards.forEach(function (c) {
          c.hidden = true;
          c.classList.remove('big', 'd0', 'd1', 'd2', 'dragging');
          c.style.transition = '';
          c.style.opacity = '';
          var tb = c.querySelector('.top-badge');
          if (tb) tb.hidden = true;
          reset(c);
        });
        q.slice(0, 3).forEach(function (c, i) {
          c.hidden = false;
          c.classList.add('d' + i);
          var tb = c.querySelector('.top-badge');
          if (!tb) {
            tb = document.createElement('span');
            tb.className = 'top-badge';
            tb.textContent = 'Top match';
            c.insertBefore(tb, c.firstChild);
          }
          tb.hidden = (done + i !== 0);
        });
        q.forEach(function (c, i) { c.querySelector('.cnt').textContent = (done + i + 1) + ' of ' + total; });
        track.dataset.n = Math.min(3, q.length);
        deckCtl.hidden = !q.length; $('deck-hint').hidden = !q.length;
        deckEmpty.hidden = !!q.length; track.hidden = !q.length;
        if (!q.length) { $('de-t').textContent = total ? "You're all caught up" : 'No roles for this filter'; $('de-p').textContent = total ? 'You have been through every suggestion. Review the roles you picked, or start again.' : 'Try another work mode.'; $('de-restart').hidden = !total; }
      }
      function render() {
        if (!profile) return;
        var deck = mq.matches; track.classList.toggle('deck', deck); track.hidden = false;
        if (deck) { renderDeck(); startHint(); } else renderGrid();
        updApply(); paintBm();
      }
      function setAuth(newProfile) {
        if (newProfile !== undefined) {
          profile = newProfile;
          if (profile) store('tj-profile', profile);
          else { try { localStorage.removeItem('tj-profile'); } catch (_) {} }
        }
        var on = !!profile;
        var curSec = $('sug') || sec;
        var curSignin = $('signin') || signin;
        var curMe = $('me') || me;
        if (curSec) { curSec.hidden = !on; curSec.style.display = on ? '' : 'none'; }
        if (curSignin) { curSignin.hidden = on; curSignin.style.display = on ? 'none' : ''; }
        if (curMe) { curMe.hidden = !on; curMe.style.display = on ? 'inline-flex' : 'none'; }
        document.body.classList.toggle('has-sug', on);
        if (on) {
          var meName = $('me-name'); if (meName) meName.textContent = profile.name || 'Candidate';
          var meAv = $('me-av'); if (meAv) meAv.textContent = (profile.name || 'C').charAt(0).toUpperCase();
          var dAv = $('drawer-av'); if (dAv) dAv.textContent = (profile.name || 'C').charAt(0).toUpperCase();
          var dNm = $('drawer-name'); if (dNm) dNm.textContent = profile.name || 'Candidate';
          var dEm = $('drawer-email'); if (dEm) dEm.textContent = profile.email || '';
          var bits = [profile.mode || 'Any mode', profile.city === 'Across India' ? 'Remote across India' : (profile.city || 'Anywhere'), profile.level || 'Any level'];
          var sugSum = $('sug-sum'); if (sugSum) sugSum.textContent = 'Based on: ' + bits.join(' · ');
          rank();
          start = 0;
          render();
        } else {
          var dAv0 = $('drawer-av'); if (dAv0) dAv0.textContent = 'C';
          var dNm0 = $('drawer-name'); if (dNm0) dNm0.textContent = 'Candidate';
          var dEm0 = $('drawer-email'); if (dEm0) dEm0.textContent = '';
        }
      }
      function snk(msg, undo) {
        var st = $('snack-t'), su = $('snack-u');
        if (st) st.textContent = msg;
        if (su) su.hidden = !undo;
        if (snack) {
          snack.hidden = false;
          clearTimeout(snackT);
          snackT = setTimeout(function () { snack.hidden = true; }, 4500);
        }
      }
      function commit(dir) {
        stopHint(); var q = deckList(); if (!q.length) return; var c = q[0], slug = c.dataset.slug, w = window.innerWidth * 1.3;
        c.classList.remove('dragging'); c.style.transition = 'transform .4s cubic-bezier(.4,.1,.6,1),opacity .4s';
        c.style.transform = dir === 'save' ? 'translateY(-110%) scale(.9)' : ('translateX(' + (dir === 'skip' ? -w : w) + 'px) rotate(' + (dir === 'skip' ? -18 : 18) + 'deg)');
        c.style.opacity = '0';
        var stA = c.querySelector('.stamp.apply'), stS = c.querySelector('.stamp.skip');
        if (dir === 'apply' && stA) stA.style.opacity = 1;
        if (dir === 'skip' && stS) stS.style.opacity = 1;
        setTimeout(function () {
          decided[slug] = dir;
          if (dir === 'apply' && applyList.indexOf(slug) < 0) { applyList.push(slug); store('tj-apply', applyList); }
          if (dir === 'save' && saved.indexOf(slug) < 0) { saved.push(slug); store('tj-saved', saved); }
          last = { slug: slug, dir: dir }; renderDeck(); updApply(); paintBm();
          snk(dir === 'apply' ? 'Added to your apply list' : (dir === 'save' ? 'Saved for later' : 'Skipped'), true);
        }, 380);
      }
      var el;
      if ((el = $('snack-u'))) {
        el.addEventListener('click', function () {
          if (!last) return; delete decided[last.slug];
          if (last.dir === 'apply') { applyList = applyList.filter(function (s) { return s !== last.slug; }); store('tj-apply', applyList); }
          if (last.dir === 'save') { saved = saved.filter(function (s) { return s !== last.slug; }); store('tj-saved', saved); }
          last = null; if (snack) snack.hidden = true; render();
        });
      }
      if ((el = $('dc-skip'))) el.addEventListener('click', function () { commit('skip'); });
      if ((el = $('dc-save'))) el.addEventListener('click', function () { commit('save'); });
      if ((el = $('dc-apply'))) el.addEventListener('click', function () { commit('apply'); });
      if ((el = $('de-restart'))) el.addEventListener('click', function () { decided = {}; applyList.forEach(function (s) { decided[s] = 'apply'; }); render(); });
      if (track) {
        track.addEventListener('pointerdown', function (e) {
          if (!track.classList.contains('deck') || (e.button && e.button > 0)) return;
          var c = e.target.closest('.sc.d0'); if (!c || e.target.closest('a,button')) return; stopHint();
          var sx = e.clientX, sy = e.clientY, t0 = Date.now(), dx = 0, moved = false, lx = sx, lt = t0, vx = 0;
          c.classList.add('dragging'); try { c.setPointerCapture(e.pointerId); } catch (_) { }
          function mv(ev) {
            dx = ev.clientX - sx; var dy = ev.clientY - sy, now = Date.now();
            if (Math.abs(dx) > 6) moved = true; vx = (ev.clientX - lx) / Math.max(1, now - lt); lx = ev.clientX; lt = now;
            c.style.transform = 'translate(' + dx + 'px,' + (dy * 0.25) + 'px) rotate(' + (dx / 18) + 'deg)';
            var stA = c.querySelector('.stamp.apply'), stS = c.querySelector('.stamp.skip');
            if (stA) stA.style.opacity = clamp(dx / 90);
            if (stS) stS.style.opacity = clamp(-dx / 90);
          }
          function off() { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', cx); }
          function up() {
            off(); c.classList.remove('dragging');
            if (!moved && Date.now() - t0 < 400) { reset(c); if (window.TJ && TJ.open) TJ.open(c.dataset.slug, 'deck'); return; }
            if (dx > 110 || (dx > 40 && vx > 0.6)) commit('apply'); else if (dx < -110 || (dx < -40 && vx < -0.6)) commit('skip'); else reset(c);
          }
          function cx() { off(); c.classList.remove('dragging'); reset(c); }
          c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', cx);
        });
      }
      if (pills) {
        pills.forEach(function (p) { p.addEventListener('click', function () { mode = p.dataset.m; start = 0; pills.forEach(function (x) { x.classList.toggle('on', x === p); }); render(); }); });
      }
      function updArrows() {
        if (!track || !prev || !next || mq.matches) return;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      }
      if (track) track.addEventListener('scroll', updArrows);
      addWinListener('resize', updArrows);
      if (prev) prev.addEventListener('click', function () { if (track) track.scrollBy({ left: -track.clientWidth * .9, behavior: 'smooth' }); });
      if (next) next.addEventListener('click', function () { if (track) track.scrollBy({ left: track.clientWidth * .9, behavior: 'smooth' }); });
      if (mq.addEventListener) mq.addEventListener('change', function () { start = 0; render(); });
      if (cards) {
        cards.forEach(function (c) {
          var b = c.querySelector('.bm'), id = c.dataset.slug;
          if (b) b.addEventListener('click', function (ev) { ev.preventDefault(); var k = saved.indexOf(id); if (k > -1) saved.splice(k, 1); else saved.push(id); store('tj-saved', saved); paintBm(); });
        });
      }
      function openModal() {
        var p = profile || {};
        var fn = $('pf-name'), fm = $('pf-mode'), fc = $('pf-city'), fl = $('pf-level'), fs = $('pf-skills');
        if (fn) fn.value = p.name || '';
        if (fm) fm.value = p.mode || '';
        if (fc) fc.value = p.city || '';
        if (fl) fl.value = p.level || '';
        if (fs) fs.value = toSkillsStr(p.skills);
        var mt = $('m-t'); if (mt) mt.textContent = profile ? 'Edit your preferences' : 'Sign in to see your matches';
        if (ov) { ov.hidden = false; setTimeout(function () { if (fn) fn.focus(); }, 50); }
      }
      if (signin) {
        signin.addEventListener('click', function (e) {
          e.preventDefault();
          if (options.onOpenAuth) options.onOpenAuth();
          else openModal();
        });
      }
      if ((el = $('edit-pref'))) el.addEventListener('click', openModal);
      if ((el = $('pf-cancel'))) el.addEventListener('click', function () { if (ov) ov.hidden = true; });
      if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) ov.hidden = true; });
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          profile = { name: ($('pf-name') ? $('pf-name').value.trim() : ''), mode: ($('pf-mode') ? $('pf-mode').value : ''), city: ($('pf-city') ? $('pf-city').value : ''), level: ($('pf-level') ? $('pf-level').value : ''), skills: ($('pf-skills') ? $('pf-skills').value.trim() : '') };
          store('tj-profile', profile); if (ov) ov.hidden = true; decided = {}; applyList.forEach(function (s) { decided[s] = 'apply'; }); setAuth();
          setTimeout(function () { if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
        });
      }
      if ((el = $('signout'))) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          profile = null;
          try { localStorage.removeItem('tj-profile'); } catch (_) {}
          setAuth(null);
          if (options.onLogout) options.onLogout();
        });
      }
      function drawSheet() {
        if (!sheetList) return;
        sheetList.innerHTML = '';
        if (!applyList.length) { sheetList.innerHTML = '<p style="margin:0;color:var(--muted)">Nothing here yet. Swipe right on a role to add it.</p>'; return; }
        applyList.forEach(function (slug) {
          var c = cards.filter(function (x) { return x.dataset.slug === slug; })[0]; if (!c) return;
          var row = document.createElement('div'); row.className = 'srow';
          var d = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
          var h3 = c.querySelector('h3'), co2 = c.querySelector('.co2');
          b.textContent = h3 ? h3.textContent : slug; s.textContent = co2 ? co2.textContent.split(' · ')[0] : ''; d.appendChild(b); d.appendChild(s);
          var a = document.createElement('a'); a.className = 'btn primary'; a.textContent = 'Apply'; a.href = '#job-' + slug; a.target = '_blank'; a.rel = 'noopener';
          var x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.setAttribute('aria-label', 'Remove'); x.textContent = '×';
          x.addEventListener('click', function () { applyList = applyList.filter(function (v) { return v !== slug; }); delete decided[slug]; store('tj-apply', applyList); drawSheet(); render(); });
          row.appendChild(d); row.appendChild(a); row.appendChild(x); sheetList.appendChild(row);
        });
      }
      if (applyBtn) applyBtn.addEventListener('click', function () { drawSheet(); if (sheet) sheet.hidden = false; });
      if ((el = $('sheet-close'))) el.addEventListener('click', function () { if (sheet) sheet.hidden = true; });
      if (sheet) sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.hidden = true; });
      addDocListener('keydown', function (e) { if (e.key === 'Escape') { if (ov) ov.hidden = true; if (sheet) sheet.hidden = true; } });
      setAuth();
      function addApply(slug) {
        if (applyList.indexOf(slug) < 0) { applyList.push(slug); store('tj-apply', applyList); }
        decided[slug] = 'apply'; stopHint(); last = { slug: slug, dir: 'apply' }; render();
        toast('Application submitted successfully! Attend your AI Interview for review and validation.', 4500);
        if (window.TJ && window.TJ.drawInterviews) window.TJ.drawInterviews();
        // Provision AI interview round in background
        var candUser = getCandAuth();
        var candEmail = (candUser && (candUser.candidate_email || candUser.email)) || '';
        var candName = (candUser && (candUser.candidate_name || candUser.name)) || 'Candidate';
        var j = (window.TJ_JOBS || []).find(function (x) { return x.slug === slug; });
        if (j) {
          fetch('/api/interviews/candidate/attend-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: candEmail, name: candName, slug: slug, title: j.title, company: j.company }),
          }).then(function (r) { return r.json(); }).then(function (res) {
            if (res && res.round_id) {
              if (!window.TJ_ROUNDS) window.TJ_ROUNDS = [];
              if (!window.TJ_ROUNDS.some(function (r) { return r.id === res.round_id; })) {
                window.TJ_ROUNDS.unshift({
                  id: res.round_id,
                  round_name: 'AI Technical Interview - ' + j.title,
                  round_type: 'AI',
                  job_title: j.title,
                  company_name: j.company,
                  candidate_token: res.candidate_token,
                  status: 'Scheduled',
                  is_ai: true,
                });
                if (window.TJ && window.TJ.drawInterviews) window.TJ.drawInterviews();
              }
            }
          }).catch(function () {});
        }
      }
      function drawSaved() {
        var J = window.TJ_JOBS || [], D = window.TJ_DESC || {}, g = document.getElementById('saved-grid'); if (!g) return;
        var CAPI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/></svg>', PINI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
        function e(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
        var list = saved.map(function (sl) { return J.filter(function (j) { return j.slug === sl; })[0]; }).filter(Boolean).reverse();
        g.innerHTML = list.map(function (j) { return '<div class="sw"><a class="card" href="#job-' + e(j.slug) + '" data-slug="' + e(j.slug) + '"><div class="card-head"><div class="logo" style="background:' + j.tone + ';color:' + j.ink + '" aria-hidden="true">' + e(j.initial) + '</div><div style="min-width:0"><h3>' + e(j.title) + '</h3><div class="co">' + e(j.company) + '</div></div></div><div class="chips"><span class="chip mode">' + e(j.mode) + '</span><span class="chip">' + CAPI + e(j.exp) + '</span><span class="chip">' + PINI + e(j.loc) + '</span></div>' + (D[j.slug] ? '<p class="blurb">' + e(D[j.slug]) + '</p>' : '') + '<div class="card-foot"><span>View details</span><span>&rarr;</span></div></a><button type="button" class="un" data-un="' + e(j.slug) + '" aria-label="Remove from saved"><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button></div>'; }).join('');
        var b = document.body; b.classList.toggle('has-saved', list.length > 0); b.classList.toggle('sv-none', list.length === 0);
        var n = document.getElementById('tab-s'), n2 = document.getElementById('sv-n'); if (n) n.textContent = list.length || ''; if (n2) n2.textContent = list.length ? '(' + list.length + ')' : '';
        paintBm();
        drawInterviews();
      }
      var allIvItems = [];

      function filterAndRenderInterviews() {
        var g = document.getElementById('interview-grid');
        var ivQ = document.getElementById('iv-q');
        var ivSort = document.getElementById('iv-sort');
        var ivMode = document.getElementById('iv-mode');
        var ivStage = document.getElementById('iv-stage');
        var ivCount = document.getElementById('iv-count');
        var ivReset2 = document.getElementById('iv-reset2');
        var ivFilterEmpty = document.getElementById('iv-filter-empty');
        if (!g) return;

        var q = ivQ ? ivQ.value.trim().toLowerCase() : '';
        var sort = ivSort ? ivSort.value : 'latest';
        var mode = ivMode ? ivMode.value : '';
        var stage = ivStage ? ivStage.value : '';

        var isFiltered = !!(q || mode || stage || sort !== 'latest');
        if (ivReset2) ivReset2.hidden = !isFiltered;

        var filtered = allIvItems.filter(function (it) {
          if (q && it.searchStr.indexOf(q) === -1) return false;
          if (mode && (it.mode || '').toLowerCase() !== mode.toLowerCase()) return false;
          if (stage) {
            if (stage === 'ai' && it.stage !== 'ai') return false;
            if (stage === 'scheduled' && it.stage !== 'scheduled') return false;
            if (stage === 'applied' && it.stage !== 'applied') return false;
            if (stage === 'completed' && it.stage !== 'completed') return false;
          }
          return true;
        });

        filtered.sort(function (a, b) {
          if (sort === 'oldest') {
            return (a.created || 0) - (b.created || 0);
          } else if (sort === 'title-asc') {
            return a.title.localeCompare(b.title);
          } else if (sort === 'company-asc') {
            return a.company.localeCompare(b.company);
          } else {
            return (b.created || 0) - (a.created || 0);
          }
        });

        if (filtered.length > 0) {
          g.innerHTML = filtered.map(function (it) { return it.html; }).join('');
          g.style.display = '';
          if (ivFilterEmpty) ivFilterEmpty.hidden = true;
        } else {
          g.innerHTML = '';
          g.style.display = 'none';
          if (ivFilterEmpty) ivFilterEmpty.hidden = false;
        }

        if (ivCount) {
          if (isFiltered) {
            ivCount.textContent = 'Showing ' + filtered.length + ' of ' + allIvItems.length + ' interview' + (allIvItems.length === 1 ? '' : 's');
          } else {
            ivCount.textContent = allIvItems.length ? 'Showing all ' + allIvItems.length + ' interview' + (allIvItems.length === 1 ? '' : 's') : '';
          }
        }
      }

      function setupIvFilterEvents() {
        var ivQ = document.getElementById('iv-q');
        var ivSort = document.getElementById('iv-sort');
        var ivMode = document.getElementById('iv-mode');
        var ivStage = document.getElementById('iv-stage');
        var ivReset = document.getElementById('iv-reset');
        var ivReset2 = document.getElementById('iv-reset2');

        if (ivQ && !ivQ._bound) {
          ivQ._bound = true;
          ivQ.addEventListener('input', filterAndRenderInterviews);
        }
        if (ivSort && !ivSort._bound) {
          ivSort._bound = true;
          ivSort.addEventListener('change', filterAndRenderInterviews);
        }
        if (ivMode && !ivMode._bound) {
          ivMode._bound = true;
          ivMode.addEventListener('change', filterAndRenderInterviews);
        }
        if (ivStage && !ivStage._bound) {
          ivStage._bound = true;
          ivStage.addEventListener('change', filterAndRenderInterviews);
        }
        function resetIv() {
          if (ivQ) ivQ.value = '';
          if (ivSort) ivSort.value = 'latest';
          if (ivMode) ivMode.value = '';
          if (ivStage) ivStage.value = '';
          filterAndRenderInterviews();
        }
        if (ivReset && !ivReset._bound) {
          ivReset._bound = true;
          ivReset.addEventListener('click', resetIv);
        }
        if (ivReset2 && !ivReset2._bound) {
          ivReset2._bound = true;
          ivReset2.addEventListener('click', resetIv);
        }
      }

      function drawInterviews() {
        var g = document.getElementById('interview-grid');
        var emp = document.getElementById('interview-empty');
        var tabI = document.getElementById('tab-i');
        var ivN = document.getElementById('iv-n');
        var ivToolbar = document.getElementById('iv-toolbar');
        var ivCountBar = document.getElementById('iv-count-bar');
        var ivFilterEmpty = document.getElementById('iv-filter-empty');
        if (!g) return;

        function e(t) {
          return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
          });
        }

        var CAPI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/></svg>';
        var PINI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

        var J = window.TJ_JOBS || [];
        var appliedSlugs = load('tj-apply', []) || [];
        var rounds = window.TJ_ROUNDS || [];

        var candEmail = '';
        var candToken = '';
        try {
          var su = JSON.parse(sessionStorage.getItem('termjobs_candidate_session') || '{}');
          var lu = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
          var pu = JSON.parse(localStorage.getItem('tj-profile') || '{}');
          candEmail = su.candidate_email || lu.candidate_email || lu.email || pu.email || '';
          candToken = su.candidate_token || lu.candidate_token || lu.token || '';
        } catch (_) {}

        if ((candEmail || candToken) && (!window._lastRoundFetch || Date.now() - window._lastRoundFetch > 2500)) {
          window._lastRoundFetch = Date.now();
          window.TJ_FETCHED_ROUNDS = true;
          var q = new URLSearchParams();
          if (candEmail) q.append('email', candEmail);
          if (candToken) q.append('token', candToken);
          fetch('/api/interviews/candidate/portal?' + q.toString())
            .then(function (r) { return r.json(); })
            .then(function (res) {
              if (res && res.rounds && Array.isArray(res.rounds)) {
                window.TJ_ROUNDS = res.rounds;
                drawInterviews();
              }
            })
            .catch(function () {});
        }

        var compIds = [];
        var compTitles = [];
        try {
          compIds = JSON.parse(localStorage.getItem('tj_completed_round_ids') || '[]');
          compTitles = JSON.parse(localStorage.getItem('tj_completed_titles') || '[]');
        } catch (_) {}

        allIvItems = [];

        rounds.forEach(function (r, idx) {
          var matchingJob = J.filter(function (j) {
            return (r.job_title && j.title.toLowerCase().indexOf(r.job_title.toLowerCase()) > -1) ||
                   (r.requisition_title && j.title.toLowerCase().indexOf(r.requisition_title.toLowerCase()) > -1) ||
                   (r.round_name && r.round_name.toLowerCase().indexOf(j.title.toLowerCase()) > -1);
          })[0] || {};

          var title = r.title || r.round_name || r.round_type || matchingJob.title || 'AI Technical Interview';
          var company = r.company_name || matchingJob.company || 'Hiring Partner';
          var initial = (company.charAt(0) || 'T').toUpperCase();
          var tone = matchingJob.tone || '#2a2f3a';
          var ink = matchingJob.ink || '#fff';
          var roomId = r.id || r.round_id;
          var isAi = !!(r.is_ai || (r.round_type && r.round_type.toLowerCase() === 'ai') || (r.round_name && r.round_name.toLowerCase().indexOf('ai') > -1));

          var statusRaw = String(r.status || '').trim().toLowerCase();
          var isCompleted = statusRaw === 'completed' || statusRaw === 'evaluated' ||
            (roomId && compIds.indexOf(roomId) > -1) ||
            compTitles.indexOf(title.toLowerCase()) > -1 ||
            (r.requisition_title && compTitles.indexOf(r.requisition_title.toLowerCase()) > -1) ||
            (matchingJob.title && compTitles.indexOf(matchingJob.title.toLowerCase()) > -1);

          var stage = isCompleted ? 'completed' : (isAi ? 'ai' : (statusRaw || 'scheduled'));

          var cardHtml = '';
          if (isCompleted) {
            cardHtml = (
              '<div class="card iv-card completed is-completed" data-mode="' + e(matchingJob.mode || '') + '">' +
                '<div class="card-head">' +
                  '<div class="logo" style="background:' + tone + ';color:' + ink + '" aria-hidden="true">' + e(initial) + '</div>' +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(title) + '</h3>' +
                    '<div class="co">' + e(company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="chip chip-completed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Under Evaluation</span>' +
                '</div>' +
                '<div class="chips">' +
                  (matchingJob.mode ? '<span class="chip mode">' + e(matchingJob.mode) + '</span>' : '') +
                  (matchingJob.loc ? '<span class="chip">' + PINI + e(matchingJob.loc) + '</span>' : '') +
                  (matchingJob.exp ? '<span class="chip">' + CAPI + e(matchingJob.exp) + '</span>' : '') +
                '</div>' +
                '<p class="blurb iv-ai-desc">Your AI interview has been completed and submitted. Results and evaluation report are under review by the hiring team.</p>' +
                '<div class="iv-card-acts">' +
                  '<button type="button" class="btn iv-act-btn iv-completed-btn" disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>Completed</span></button>' +
                  '<a href="' + (matchingJob.slug ? '#job-' + e(matchingJob.slug) : '/interview/candidate') + '" ' + (matchingJob.slug ? 'data-slug="' + e(matchingJob.slug) + '"' : '') + ' class="btn secondary iv-act-btn"><span>View Details</span></a>' +
                '</div>' +
              '</div>'
            );
          } else {
            cardHtml = (
              '<div class="card iv-card scheduled ai-ready" data-mode="' + e(matchingJob.mode || '') + '">' +
                '<div class="card-head">' +
                  '<div class="logo" style="background:' + tone + ';color:' + ink + '" aria-hidden="true">' + e(initial) + '</div>' +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(title) + '</h3>' +
                    '<div class="co">' + e(company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="chip chip-ai"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>15m On-Demand AI</span>' +
                '</div>' +
                '<div class="chips">' +
                  (matchingJob.mode ? '<span class="chip mode">' + e(matchingJob.mode) + '</span>' : '') +
                  (matchingJob.loc ? '<span class="chip">' + PINI + e(matchingJob.loc) + '</span>' : '') +
                  (matchingJob.exp ? '<span class="chip">' + CAPI + e(matchingJob.exp) + '</span>' : '') +
                '</div>' +
                '<p class="blurb iv-ai-desc">Your autonomous AI Interview is prepared. Complete it on-demand with camera &amp; mic.</p>' +
                '<div class="iv-card-acts">' +
                  '<button type="button" class="btn primary iv-act-btn iv-attend-ai" data-round="' + e(roomId) + '" data-slug="' + e(matchingJob.slug || '') + '" data-title="' + e(title) + '" data-company="' + e(company) + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span></button>' +
                  '<a href="' + (matchingJob.slug ? '#job-' + e(matchingJob.slug) : '/interview/candidate') + '" ' + (matchingJob.slug ? 'data-slug="' + e(matchingJob.slug) + '"' : '') + ' class="btn secondary iv-act-btn"><span>View Details</span></a>' +
                '</div>' +
              '</div>'
            );
          }

          allIvItems.push({
            id: roomId,
            title: title,
            company: company,
            mode: matchingJob.mode || '',
            stage: stage,
            created: r.created_at ? new Date(r.created_at).getTime() : (Date.now() - (idx * 10000)),
            searchStr: (title + ' ' + company + ' ' + (matchingJob.mode || '') + ' ' + (matchingJob.loc || '') + ' ' + (matchingJob.exp || '')).toLowerCase(),
            html: cardHtml
          });
        });

        appliedSlugs.forEach(function (sl, idx) {
          var j = J.filter(function (item) { return item.slug === sl; })[0];
          if (!j) return;
          var alreadyHasRound = rounds.some(function (r) {
            return (r.job_title && r.job_title.toLowerCase().indexOf(j.title.toLowerCase()) > -1) ||
                   (r.requisition_title && r.requisition_title.toLowerCase().indexOf(j.title.toLowerCase()) > -1) ||
                   (r.round_name && r.round_name.toLowerCase().indexOf(j.title.toLowerCase()) > -1);
          });
          if (alreadyHasRound) return;

          var isComp = compTitles.indexOf(j.title.toLowerCase()) > -1;
          var stage = isComp ? 'completed' : 'applied';

          var cardHtml = '';
          if (isComp) {
            cardHtml = (
              '<div class="card iv-card completed is-completed" data-mode="' + e(j.mode || '') + '">' +
                '<div class="card-head">' +
                  '<div class="logo" style="background:' + j.tone + ';color:' + j.ink + '" aria-hidden="true">' + e(j.initial) + '</div>' +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(j.title) + '</h3>' +
                    '<div class="co">' + e(j.company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="chip chip-completed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Under Evaluation</span>' +
                '</div>' +
                '<div class="chips">' +
                  '<span class="chip mode">' + e(j.mode) + '</span>' +
                  (j.loc ? '<span class="chip">' + PINI + e(j.loc) + '</span>' : '') +
                  (j.exp ? '<span class="chip">' + CAPI + e(j.exp) + '</span>' : '') +
                '</div>' +
                '<p class="blurb iv-ai-desc">Your AI interview has been completed and submitted. Results and evaluation report are under review by the hiring team.</p>' +
                '<div class="iv-card-acts">' +
                  '<button type="button" class="btn iv-act-btn iv-completed-btn" disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>Completed</span></button>' +
                  '<a href="#job-' + e(j.slug) + '" data-slug="' + e(j.slug) + '" class="btn secondary iv-act-btn"><span>View Details</span></a>' +
                '</div>' +
              '</div>'
            );
          } else {
            cardHtml = (
              '<div class="card iv-card applied ai-ready" data-mode="' + e(j.mode || '') + '">' +
                '<div class="card-head">' +
                  '<div class="logo" style="background:' + j.tone + ';color:' + j.ink + '" aria-hidden="true">' + e(j.initial) + '</div>' +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(j.title) + '</h3>' +
                    '<div class="co">' + e(j.company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="chip chip-ai"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>15m On-Demand AI</span>' +
                '</div>' +
                '<div class="chips">' +
                  '<span class="chip mode">' + e(j.mode) + '</span>' +
                  (j.loc ? '<span class="chip">' + PINI + e(j.loc) + '</span>' : '') +
                  (j.exp ? '<span class="chip">' + CAPI + e(j.exp) + '</span>' : '') +
                '</div>' +
                '<p class="blurb iv-ai-desc">Your autonomous AI Interview is prepared. Complete it on-demand with camera &amp; mic.</p>' +
                '<div class="iv-card-acts">' +
                  '<button type="button" class="btn primary iv-act-btn iv-attend-ai" data-slug="' + e(j.slug) + '" data-title="' + e(j.title) + '" data-company="' + e(j.company) + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span></button>' +
                  '<a href="#job-' + e(j.slug) + '" data-slug="' + e(j.slug) + '" class="btn secondary iv-act-btn"><span>View Details</span></a>' +
                '</div>' +
              '</div>'
            );
          }

          allIvItems.push({
            id: 'apply-' + j.slug,
            title: j.title,
            company: j.company,
            mode: j.mode || '',
            stage: stage,
            created: Date.now() - (100000 + (idx * 10000)),
            searchStr: (j.title + ' ' + j.company + ' ' + (j.mode || '') + ' ' + (j.loc || '') + ' ' + (j.exp || '')).toLowerCase(),
            html: cardHtml
          });
        });

        var count = allIvItems.length;
        if (tabI) tabI.textContent = count ? count : '';
        if (ivN) ivN.textContent = count ? '(' + count + ')' : '';

        if (count > 0) {
          if (ivToolbar) ivToolbar.style.display = '';
          if (ivCountBar) ivCountBar.style.display = '';
          if (emp) emp.style.display = 'none';
          document.body.classList.add('has-interviews');
          document.body.classList.remove('iv-none');
          setupIvFilterEvents();
          filterAndRenderInterviews();
        } else {
          g.innerHTML = '';
          g.style.display = 'none';
          if (ivToolbar) ivToolbar.style.display = 'none';
          if (ivCountBar) ivCountBar.style.display = 'none';
          if (ivFilterEmpty) ivFilterEmpty.hidden = true;
          if (emp) emp.style.display = 'block';
          document.body.classList.remove('has-interviews');
          document.body.classList.add('iv-none');
        }
      }
      var sg = document.getElementById('saved-grid');
      if (sg) {
        sg.addEventListener('click', function (ev) {
          var u = ev.target.closest('button[data-un]');
          if (u) { var k = saved.indexOf(u.dataset.un); if (k > -1) { saved.splice(k, 1); store('tj-saved', saved); snk('Removed from saved', false); } return; }
        });
      }
      window.TJ = Object.assign(window.TJ || {}, {
        setAuth: setAuth,
        drawSaved: drawSaved,
        drawInterviews: drawInterviews,
        why: why,
        profile: function () { return profile; },
        addApply: addApply,
        commit: commit,
        inApply: function (sl) { return applyList.indexOf(sl) > -1; },
        openModal: openModal,
        open: null,
        hint: function () { setTimeout(function () { if (!seen) playHint(); }, 450); }
      });
      [].slice.call(document.querySelectorAll('[data-jump]')).forEach(function (b) { b.addEventListener('click', function () { var t = $('open-roles'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
    })();

    // 4. Script 4: Modal & sheet interactions
    (function () {
      var $ = function (id) { return document.getElementById(id); };
      var JOBS = window.TJ_JOBS || [], ov = null, dm = null, cur = null, from = 'list', lastF = null, tt, mqm = window.matchMedia('(max-width: 760px)');
      var SV = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true"';
      var CAP = '<svg width="14" height="14" viewBox="0 0 24 24" ' + SV + '><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/></svg>';
      var PIN = '<svg width="14" height="14" viewBox="0 0 24 24" ' + SV + '><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
      var OUT = '<svg width="16" height="16" viewBox="0 0 24 24" ' + SV + '><path d="M7 17L17 7M8 7h9v9"/></svg>';
      var CHEV = '<svg class="chev" width="22" height="22" viewBox="0 0 24 24" ' + SV + '><path d="M6 9l6 6 6-6"/></svg>';
      function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
      function toast(m) { var t = $('dtoast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2200); }
      function inset(r, rad) { return 'inset(' + r.top + 'px ' + (window.innerWidth - r.right) + 'px ' + (window.innerHeight - r.bottom) + 'px ' + r.left + 'px round ' + rad + 'px)'; }
      function deckMode() { return from === 'deck' && mqm.matches; }
      function originCard() { return document.querySelector('#sug-track .sc.d0'); }
      function build() {
        // Remove any existing overlay in DOM before building
        var existing = document.querySelectorAll('.ov.dov');
        existing.forEach(function (el) { try { el.remove(); } catch (_) { } });

        ov = document.createElement('div'); ov.className = 'ov dov'; ov.hidden = true;
        ov.innerHTML = '<div class="dm" role="dialog" aria-modal="true" aria-labelledby="dm-t">'
          + '<a class="dnew" id="d-new2" target="_blank" rel="noopener">Open in new tab ' + OUT + '</a>'
          + '<button class="dclose" type="button" aria-label="Close"><span class="x">&times;</span>' + CHEV + '</button>'
          + '<div class="dbody" id="dbody"></div>'
          + '<div class="dact"><button class="dsk" type="button" aria-label="Skip"><svg width="26" height="26" viewBox="0 0 24 24" ' + SV + '><path d="M6 6l12 12M18 6L6 18"/></svg></button><button class="dsv" type="button" aria-label="Save for later"><svg width="20" height="20" viewBox="0 0 24 24" ' + SV + '><path d="M6 4h12v17l-6-4-6 4z"/></svg></button><button class="dap" type="button" aria-label="Apply"><svg width="30" height="30" viewBox="0 0 24 24" ' + SV + '><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>'
          + '<div class="dbar"><a class="btn" id="d-new" target="_blank" rel="noopener">Open in new tab ' + OUT + '</a><button class="btn primary" type="button" id="d-apply">Apply now</button></div></div>';
        document.body.appendChild(ov); dm = ov.querySelector('.dm');
        ov.addEventListener('click', function (e) { if (e.target === ov) closeAnim(); });
        var closeBtn = ov.querySelector('.dclose');
        if (closeBtn) closeBtn.addEventListener('click', function () { closeAnim(); });
        function act(dir) { closeAnim(function () { var T = window.TJ; if (T && T.commit) T.commit(dir); }); }
        var skBtn = ov.querySelector('.dsk'); if (skBtn) skBtn.addEventListener('click', function () { act('skip'); });
        var svBtn = ov.querySelector('.dsv'); if (svBtn) svBtn.addEventListener('click', function () { act('save'); });
        var apBtn = ov.querySelector('.dap'); if (apBtn) apBtn.addEventListener('click', function () { act('apply'); });

        var dNew = ov.querySelector('#d-new');
        var dNew2 = ov.querySelector('#d-new2');
        var handleOpenNew = function (e) {
          if (cur) {
            e.preventDefault();
            var targetSlug = cur.slug;
            closeAnim(function () {
              openDetail(targetSlug);
            });
          }
        };
        if (dNew) dNew.addEventListener('click', handleOpenNew);
        if (dNew2) dNew2.addEventListener('click', handleOpenNew);

        var dApply = ov.querySelector('#d-apply');
        if (dApply) {
          dApply.addEventListener('click', function () {
            var T = window.TJ || {};
            if (cur) {
              if (T.inApply(cur.slug) || dApply.classList.contains('iv-attend-mode')) {
                closeAnim(function () {
                  if (options.onStartAiInterview) {
                    options.onStartAiInterview({ slug: cur.slug, title: cur.title, company: cur.company });
                  }
                });
                return;
              }
              var candUser = getCandAuth();
              if (candUser) {
                var sl = cur.slug;
                if (T.addApply) T.addApply(sl);
                toast('Application submitted successfully! Attend your AI Interview for review and validation.', 4500);
                dApply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg>Attend AI Interview';
                dApply.classList.add('iv-attend-mode');
              } else {
                if (options.onOpenAuth) options.onOpenAuth();
                else toast('Please sign in to apply');
              }
            } else toast('Apply link is not connected yet');
          });
        }
      }
      function hide() {
        if (ov) { ov.hidden = true; }
        document.body.style.overflow = '';
        if (lastF && lastF.focus && document.body.contains(lastF)) try { lastF.focus({ preventScroll: true }); } catch (_) { }
      }
      function closeAnim(cb) {
        if (!ov || ov.hidden) { if (cb) cb(); return; }
        var c = deckMode() ? originCard() : null;
        if (c && dm && dm.animate) {
          var an = dm.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: inset(c.getBoundingClientRect(), 24) }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
          an.onfinish = function () { hide(); an.cancel(); if (cb) cb(); };
        } else { hide(); if (cb) cb(); }
      }
      function open(slug, f) {
        var j = JOBS.filter(function (x) { return x.slug === slug || x.id === slug; })[0]; if (!j) return;
        if (!ov || !document.body.contains(ov)) build();
        cur = j; from = f || 'list'; lastF = document.activeElement;
        var T = window.TJ || {}, pr = T.profile && T.profile(), sc = document.querySelector('.sc[data-slug="' + slug + '"]'), p = sc && sc._p;
        var rs = (pr && sc && T.why) ? T.why(sc) : [];
        var sk = j.skills.map(function (x) { return '<span class="skill">' + esc(x) + '</span>'; }).join('') + (j.more ? '<span class="skill">+' + j.more + ' more skills</span>' : '');
        if (!sk) sk = '<span class="skill">Open to all skills</span>';
        var match = (pr && p) ? '<span class="dmatch">' + p + '% match</span>' : '';
        var dbodyEl = ov.querySelector('#dbody');
        if (dbodyEl) {
          dbodyEl.innerHTML =
            '<div class="dhero" style="background:' + j.tone + ';color:' + j.ink + '"><span class="big" aria-hidden="true">' + esc(j.initial) + '</span><div class="hc">' + esc(j.company) + '</div><h2>' + esc(j.title) + '</h2>' + match + '</div>'
            + '<div class="dh"><div class="logo" style="background:' + j.tone + ';color:' + j.ink + '" aria-hidden="true">' + esc(j.initial) + '</div><div><div class="dco">' + esc(j.company) + '</div>' + match + '</div></div>'
            + '<h2 class="dtd" id="dm-t">' + esc(j.title) + '</h2>'
            + '<div class="chips"><span class="chip mode">' + esc(j.mode) + '</span><span class="chip">' + CAP + esc(j.exp) + '</span><span class="chip">' + PIN + esc(j.loc) + '</span></div>'
            + (rs.length ? '<section><h3 class="sh">Why it matches</h3><ul class="whyl">' + rs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></section>' : '')
            + '<section><h3 class="sh">At a glance</h3><dl class="facts"><div><dt>Company</dt><dd>' + esc(j.company) + '</dd></div><div><dt>Work mode</dt><dd>' + esc(j.mode) + '</dd></div><div><dt>Experience</dt><dd>' + esc(j.exp) + '</dd></div><div><dt>Location</dt><dd>' + esc(j.loc) + '</dd></div></dl></section>'
            + '<section><h3 class="sh">Skills</h3><div class="skills">' + sk + '</div></section>'
            + '<section><h3 class="sh">How applying works</h3><p>Apply directly with your resume. Your profile is matched against the skills above and reviewed within 48 hours.</p><div class="rev"><i></i>Reviewed within 48 hours</div></section>';
        }
        var dNew = ov.querySelector('#d-new');
        var dNew2 = ov.querySelector('#d-new2');
        if (dNew) dNew.href = '#job-' + slug;
        if (dNew2) dNew2.href = '#job-' + slug;
        var dApply = ov.querySelector('#d-apply');
        if (dApply) {
          var isApp = window.TJ && window.TJ.inApply && window.TJ.inApply(slug);
          if (!isApp) {
            try { var al = JSON.parse(localStorage.getItem('tj-apply') || '[]'); isApp = al.indexOf(slug) > -1; } catch (_) {}
          }
          var compTitles = [];
          try { compTitles = JSON.parse(localStorage.getItem('tj_completed_titles') || '[]'); } catch (_) {}
          var isComp = compTitles.indexOf(j.title.toLowerCase()) > -1;

          if (isComp) {
            dApply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>Interview Completed';
            dApply.disabled = true;
            dApply.className = 'btn iv-completed-btn';
          } else if (isApp) {
            dApply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg>Attend AI Interview';
            dApply.disabled = false;
            dApply.className = 'btn primary iv-attend-mode';
          } else {
            dApply.textContent = 'Apply now';
            dApply.disabled = false;
            dApply.className = 'btn primary';
          }
        }
        dm.classList.toggle('deckmode', deckMode());
        ov.hidden = false; document.body.style.overflow = 'hidden';
        if (dbodyEl) dbodyEl.scrollTop = 0;
        var c = deckMode() ? originCard() : null;
        if (c && dm.animate) dm.animate([{ clipPath: inset(c.getBoundingClientRect(), 24) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
        setTimeout(function () { var x = ov.querySelector('.dclose'); if (x) x.focus({ preventScroll: true }); }, 60);
      }
      if (window.TJ) window.TJ.open = open; else window.TJ = { open: open };
      addDocListener('keydown', function (e) { if (e.key === 'Escape') closeAnim(); });
      var track = $('sug-track'), grid = $('grid');
      if (track) {
        track.addEventListener('click', function (e) {
          var c = e.target.closest('.sc'); if (!c) return;
          var a = e.target.closest('a'); if (e.target.closest('button')) return;
          if (a && a.classList.contains('primary')) return;
          var deck = track.classList.contains('deck');
          if (deck && !a) return;
          e.preventDefault();
          e.stopPropagation();
          open(c.dataset.slug, deck ? 'deck' : 'list');
        });
      }

      /* mobile pages: For you / All roles / Saved / Interviews */
      var tn = $('tab-n'); if (tn) tn.textContent = document.querySelectorAll('#grid .card').length;

      // Dynamically sync roles with backend DB (QA and Main)
      function syncBackendRoles() {
        fetch('/api/public/requisitions')
          .then(function (r) { return r.json(); })
          .then(function (reqs) {
            if (!Array.isArray(reqs) || !reqs.length) return;
            var valid = reqs.filter(function (r) { return r && (r.title || (r.structured_role && r.structured_role.title)); });
            if (!valid.length) return;

            var BRAND_COLORS = [
              ['#059669', '#fff'],
              ['#2563eb', '#fff'],
              ['#7c3aed', '#fff'],
              ['#d97706', '#fff'],
              ['#0891b2', '#fff'],
              ['#dc2626', '#fff'],
              ['#4f46e5', '#fff']
            ];

            var newJobs = [];
            var newDesc = window.TJ_DESC || {};

            valid.forEach(function (r, i) {
              var sr = r.structured_role || {};
              var title = r.title || sr.title || 'Open Position';
              var company = r.company_name || 'Partner Enterprise';
              var mode = sr.work_mode || r.work_mode || 'On-site';
              var exp = sr.experience || r.experience_level || '1–3 years';
              var loc = sr.location || r.company_location || 'India';
              if (Array.isArray(loc)) loc = loc[0] || 'India';
              var skills = sr.must_have_skills || r.skills || [];
              var color = BRAND_COLORS[i % BRAND_COLORS.length];
              var slug = r.id;
              var desc = r.generated_jd_markdown || sr.job_description || '';

              newJobs.push({
                slug: slug,
                id: r.id,
                title: title,
                company: company,
                mode: mode,
                exp: exp,
                loc: String(loc),
                skills: skills.slice(0, 2),
                more: Math.max(0, skills.length - 2),
                tone: color[0],
                ink: color[1],
                initial: (company.charAt(0) || 'T').toUpperCase()
              });
              newDesc[slug] = desc;
            });

            window.TJ_JOBS = newJobs;
            window.TJ_DESC = newDesc;

            var tabN = $('tab-n');
            if (tabN) tabN.textContent = newJobs.length;
            var heroRolesB = document.querySelector('.hero-r .st:first-child b');
            if (heroRolesB) heroRolesB.textContent = newJobs.length;
            var heroCoB = document.querySelector('.hero-r .st:nth-child(2) b');
            if (heroCoB) heroCoB.textContent = newJobs.length;
          })
          .catch(function () {});
      }
      syncBackendRoles();

      [].slice.call(document.querySelectorAll('#tabs .tab')).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.v;
          document.body.classList.toggle('show-roles', v === 'roles');
          document.body.classList.toggle('show-saved', v === 'saved');
          document.body.classList.toggle('show-interview', v === 'interview');
          if (window.TJ && TJ.drawSaved) TJ.drawSaved();
          if (window.TJ && TJ.drawInterviews) TJ.drawInterviews();
          window.scrollTo({ top: 0 });
          if (v === 'for' && window.TJ && TJ.hint) TJ.hint();
        });
      });
      if (window.TJ && TJ.drawSaved) TJ.drawSaved();
      if (window.TJ && TJ.drawInterviews) TJ.drawInterviews();
    })();

    // Return unmount cleanup
    return function unmount() {
      cleanups.forEach(fn => {
        try { fn(); } catch (e) { }
      });
      // Remove detail overlay modal if present
      const ovs = document.querySelectorAll('.ov.dov');
      ovs.forEach(el => {
        try { el.remove(); } catch (e) { }
      });
      document.body.classList.remove('has-sug', 'show-roles', 'show-saved', 'show-interview', 'sv-none', 'iv-none', 'detail', 'new-open-roles-active');
    };
  }
