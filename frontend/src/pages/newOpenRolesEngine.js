// TermJobs New Open Roles Interactive Engine
// Bundled from TermJobs openroles page.html
import { mapLiveOpenRoles } from '../utils/loadOpenRoles';

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

  function updateAllAvatars(photoUrl, name) {
    var initial = ((name || 'Candidate').charAt(0) || 'C').toUpperCase();
    var els = document.querySelectorAll('#me-av, #drawer-av, #d-me-av, .av:not(.profile-avatar-initial)');
    [].slice.call(els).forEach(function (el) {
      if (photoUrl) {
        var safeUrl = String(photoUrl).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
        el.innerHTML = '<img src="' + safeUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
      } else {
        el.textContent = initial;
      }
    });
  }

    function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var COMPANY_LOGOS = {
    "software-engineer-inntot-technologies-pv-e5e8b62a": "/companies/inntot.png",
    "odoo-developer-nurture-spark-digital-951f75b9": "/companies/nurture-spark.png",
    "python-developer-vivantify-technology-so-4ea1af55": "/companies/vivantify.png",
    "python-developer-bot-development-vbots-35155b56": "/companies/vbots.png",
    "flutter-developer-intern-hancod-98802267": "/companies/hancod.png",
    "devops-engineer-acura-solutions-ltd-bb711af2": "/companies/acura.png",
    "software-engineer-mailercloud-87b3c036": "/companies/mailercloud.png"
  };

  function getCompanyLogo(slug, companyName) {
    if (slug && COMPANY_LOGOS[slug]) return COMPANY_LOGOS[slug];
    var c = (companyName || '').toLowerCase();
    if (c.indexOf('inntot') !== -1) return '/companies/inntot.png';
    if (c.indexOf('nurture') !== -1) return '/companies/nurture-spark.png';
    if (c.indexOf('vivantify') !== -1) return '/companies/vivantify.png';
    if (c.indexOf('vbot') !== -1) return '/companies/vbots.png';
    if (c.indexOf('hancod') !== -1) return '/companies/hancod.png';
    if (c.indexOf('acura') !== -1) return '/companies/acura.png';
    if (c.indexOf('mailercloud') !== -1) return '/companies/mailercloud.png';
    return '';
  }

  function renderLogo(j, extraClass) {
    var cls = extraClass ? 'logo ' + extraClass : 'logo';
    var logoSrc = (j && j.logo) ? j.logo : getCompanyLogo(j ? j.slug : '', j ? j.company : '');
    var tone = (j && j.tone) || '#2563eb';
    var ink = (j && j.ink) || '#ffffff';
    var initial = (j && j.initial) || ((j && j.company) ? j.company.charAt(0).toUpperCase() : 'T');
    if (logoSrc) {
      return '<div class="' + cls + ' logo-has-img" style="background:#fff;" aria-hidden="true">' +
        '<img src="' + esc(logoSrc) + '" alt="' + esc(j ? j.company : '') + '" class="company-logo-img" onerror="this.style.display=\'none\';this.parentElement.style.background=\'' + tone + '\';this.parentElement.style.color=\'' + ink + '\';this.parentElement.textContent=\'' + esc(initial) + '\';" />' +
      '</div>';
    }
    return '<div class="' + cls + '" style="background:' + tone + ';color:' + ink + '" aria-hidden="true">' + esc(initial) + '</div>';
  }
  window.TJ_renderLogo = renderLogo;

  var toastTimer = null;
  function showToast(m, dur) {
    var t = document.getElementById('dtoast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, dur || 4000);
  }
  window.TJ_showToast = showToast;

  // 1. Script 3: Job data & detailed route
  (function () {
    var JOBS = [
      {
        slug: "software-engineer-inntot-technologies-pv-e5e8b62a",
        title: "Software Engineer",
        company: "Inntot Technologies Pvt. Ltd.",
        mode: "On-site",
        exp: "Entry-Level (0–2 years)",
        loc: "Kochi, Kerala, India",
        skills: ["C", "C++", "Data Structures", "Algorithms", "RTOS", "Embedded Systems", "Software Debugging", "Unit Testing", "Problem Solving", "Bug Fixing", "Software Development", "Technical Documentation"],
        more: 10,
        tone: "#059669",
        ink: "#fff",
        initial: "I",
        logo: "/companies/inntot.png"
      },
      {
        slug: "odoo-developer-nurture-spark-digital-951f75b9",
        title: "Odoo Developer",
        company: "Nurture Spark Digital",
        mode: "On-site",
        exp: "FRESHER",
        loc: "Payyannur, Kerala, India",
        skills: ["Python", "Odoo ERP", "Odoo ORM", "Odoo Studio", "Odoo 16", "Odoo 17", "Odoo 18", "PostgreSQL", "XML", "QWeb", "JavaScript", "OWL", "REST API", "XML-RPC", "JSON-RPC", "Git", "Odoo.sh", "Docker", "Linux"],
        more: 17,
        tone: "#2563eb",
        ink: "#fff",
        initial: "N",
        logo: "/companies/nurture-spark.png"
      },
      {
        slug: "python-developer-vivantify-technology-so-4ea1af55",
        title: "Python Developer",
        company: "Vivantify Technology Solutions India Pvt. Ltd.",
        mode: "On-site",
        exp: "Mid-Level (3–5 years)",
        loc: "CHENNAI",
        skills: ["Python", "SQL", "React.js", "Backend Development", "REST API Development", "SQL Query Optimization", "Stored Procedures", "Database Indexing", "Git", "Debugging", "Troubleshooting", "Performance Optimization"],
        more: 10,
        tone: "#7c3aed",
        ink: "#fff",
        initial: "V",
        logo: "/companies/vivantify.png"
      },
      {
        slug: "python-developer-bot-development-vbots-35155b56",
        title: "Python Developer – Bot Development",
        company: "vBots",
        mode: "On-site",
        exp: "Mid-Level (2–4 years)",
        loc: "Coimbatore, Tamil Nadu",
        skills: ["Python", "Selenium", "Pandas", "Openpyxl", "Automation Frameworks", "REST API Integration", "OCR", "NLP", "Tesseract", "spaCy", "OpenCV", "Bot Development", "Debugging", "Unit Testing"],
        more: 12,
        tone: "#d97706",
        ink: "#fff",
        initial: "V",
        logo: "/companies/vbots.png"
      },
      {
        slug: "flutter-developer-intern-hancod-98802267",
        title: "Flutter Developer Intern",
        company: "Hancod",
        mode: "On-site",
        exp: "Fresher (Basic Flutter knowledge)",
        loc: "Perintalmanna, Kerala",
        skills: ["Flutter", "Dart", "Riverpod", "State Management", "Clean Architecture", "SQL", "Supabase", "Firebase", "REST API Integration", "Database Management", "MySQL", "FlutterFlow"],
        more: 10,
        tone: "#0891b2",
        ink: "#fff",
        initial: "H",
        logo: "/companies/hancod.png"
      },
      {
        slug: "devops-engineer-acura-solutions-ltd-bb711af2",
        title: "DevOps Engineer",
        company: "ACURA SOLUTIONS LTD",
        mode: "On-site",
        exp: "FRESHER",
        loc: "Malappuram, Kerala",
        skills: ["Kubernetes", "Docker", "CI/CD Pipelines", "Cloud Platforms", "Infrastructure as Code (IaC)", "Container Orchestration", "DevOps Practices", "System Monitoring", "Troubleshooting", "Banking Domain Knowledge"],
        more: 8,
        tone: "#dc2626",
        ink: "#fff",
        initial: "A",
        logo: "/companies/acura.png"
      },
      {
        slug: "software-engineer-mailercloud-87b3c036",
        title: "Software Engineer",
        company: "mailercloud",
        mode: "On-site",
        exp: "3 – 6 years",
        loc: "KOZHIKODE",
        skills: ["Go", "PHP", "Vue.js", "React.js", "MySQL", "REST APIs", "GraphQL", "Microservices", "Linux", "CI/CD", "Docker", "RabbitMQ", "ClickHouse", "AI Agents"],
        more: 25,
        tone: "#4f46e5",
        ink: "#fff",
        initial: "M",
        logo: "/companies/mailercloud.png"
      }
    ];
    var APPLY_URL = "";
    var PIN = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/></svg>";
    var CAP = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5\"/></svg>";
    var ARROW = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg>";
    var BACK = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M19 12H5M11 6l-6 6 6 6\"/></svg>";
    var LOGO = "<img src=\"/logo.png\" alt=\"TermJobs Logo\" class=\"brand-logo-img\" style=\"width:34px;height:34px;object-fit:contain;border-radius:8px;flex-shrink:0;\" />";
    window.TJ_JOBS = JOBS;
    var TJ_DESC = window.TJ_DESC = {
      "software-engineer-inntot-technologies-pv-e5e8b62a": "We are looking for talented and motivated Software Engineers with strong programming skills in C/C++ to join our development team. Candidates should have a good understanding of Data Structures, Algorithms, and RTOS concepts, along with strong debugging and problem-solving abilities.",
      "odoo-developer-nurture-spark-digital-951f75b9": "We are looking for a skilled and motivated Odoo Developer to join our team. The ideal candidate should have hands-on experience in Odoo development, customization, module implementation, and integration. You will be responsible for developing, customizing, maintaining, and supporting Odoo ERP solutions based on business requirements.",
      "python-developer-vivantify-technology-so-4ea1af55": "We are looking for an experienced Python Developer to enhance and optimize enterprise applications. The role focuses on Python development, SQL optimization, backend services, API development, debugging, and application performance. The ideal candidate will work with existing codebases to implement enhancements and deliver scalable, maintainable, and high-performance solutions.",
      "python-developer-bot-development-vbots-35155b56": "We are looking for a skilled Python Developer to design, develop, and deploy intelligent bots that automate business processes and improve operational efficiency. The ideal candidate will have experience with Python development, automation frameworks, APIs, and AI/ML libraries to build scalable solutions that integrate with enterprise applications.",
      "flutter-developer-intern-hancod-98802267": "We are looking for motivated Flutter Developer Interns, including freshers with a basic understanding of Flutter development, to join our development team. You will contribute to building and maintaining ERP modules for web and mobile platforms.",
      "devops-engineer-acura-solutions-ltd-bb711af2": "We are seeking a skilled DevOps Engineer to join our dynamic team in Kerala. The ideal candidate should have a strong understanding of DevOps practices, particularly within the banking domain, and experience implementing and managing CI/CD pipelines and Kubernetes environments.",
      "software-engineer-mailercloud-87b3c036": "We are looking for an experienced Software Engineer with 3 to 6 years of hands-on experience building scalable applications, distributed systems, and modern web architectures. You will work across Go, PHP, Vue.js, React, and MySQL, with exposure to microservices, containerization, and AI-driven automation."
    };
    var tt;

    function findJob(slug) {
      if (!slug) return null;
      var cleanSlug = String(slug).replace(/^#job-/, '').trim();
      var found = JOBS.filter(function (x) { return x.slug === cleanSlug || x.slug === slug; })[0];
      if (found) return found;

      // Dynamic fallback: extract metadata from DOM if a card exists
      var card = (container && container.querySelector('[data-slug="' + cleanSlug + '"], a.card[href*="' + cleanSlug + '"]')) ||
                 document.querySelector('[data-slug="' + cleanSlug + '"], a.card[href*="' + cleanSlug + '"]');
      if (card) {
        var h3 = card.querySelector('h3');
        var co = card.querySelector('.co, .co2');
        var logoEl = card.querySelector('.logo, .lt');
        var blurbEl = card.querySelector('.blurb');
        var modeChip = card.querySelector('.chips .mode');
        var allChips = [].slice.call(card.querySelectorAll('.chips .chip, .chips > span'));
        var title = h3 ? h3.textContent.trim() : 'Open Role';
        var company = co ? co.textContent.trim() : 'Partner Enterprise';
        var initial = logoEl ? logoEl.textContent.trim() : (title ? title.charAt(0).toUpperCase() : 'T');
        var tone = (logoEl && (logoEl.style.backgroundColor || logoEl.style.background)) || '#2563eb';
        var ink = (logoEl && logoEl.style.color) || '#ffffff';
        var mode = card.dataset.mode || (modeChip ? modeChip.textContent.trim() : 'On-site');
        var loc = card.dataset.city || (allChips[2] ? allChips[2].textContent.trim() : 'India');
        var exp = card.dataset.level || (allChips[1] ? allChips[1].textContent.trim() : 'Experienced');
        var blurb = blurbEl ? blurbEl.textContent.trim() : '';

        var skills = [];
        [].slice.call(card.querySelectorAll('.skills .skill, .sk .skill')).forEach(function (sk) {
          var text = sk.textContent.trim();
          if (text && !text.startsWith('+')) skills.push(text);
        });

        var dynamicJob = {
          slug: cleanSlug,
          title: title,
          company: company,
          mode: mode,
          exp: exp,
          loc: loc,
          skills: skills.length ? skills : ['Technical Skills'],
          more: Math.max(0, 10 - skills.length),
          tone: tone,
          ink: ink,
          initial: initial
        };
        JOBS.push(dynamicJob);
        if (blurb && !TJ_DESC[cleanSlug]) {
          TJ_DESC[cleanSlug] = blurb;
        }
        window.TJ_JOBS = JOBS;
        window.TJ_DESC = TJ_DESC;
        return dynamicJob;
      }
      return null;
    }
    function getList() { return container.querySelector('#list') || document.getElementById('list'); }
    function getDet() { return container.querySelector('#detail') || document.getElementById('detail'); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function toast(m, dur) { showToast(m, dur); }
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

      var hasApplied = false;
      try {
        var appList = JSON.parse(localStorage.getItem('tj-apply') || '[]');
        if (Array.isArray(appList) && appList.indexOf(j.slug) > -1) hasApplied = true;
      } catch (_) {}
      if (window.TJ && window.TJ.inApply && window.TJ.inApply(j.slug)) hasApplied = true;

      var applySideBtnText = hasApplied
        ? '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview ' + ARROW
        : 'Apply now ' + ARROW;

      var applyBarBtnText = hasApplied
        ? '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview'
        : 'Apply now';

      var tag = APPLY_URL ? 'a' : 'button';
      var ap = APPLY_URL ? 'href="' + esc(APPLY_URL.replace('{slug}', j.slug)) + '" target="_blank" rel="noopener"' : 'type="button" data-apply data-applied="' + (hasApplied ? 'true' : 'false') + '"';
      var logo = renderLogo(j);

      target.innerHTML = '<header class="top"><a class="brand" href="#" aria-label="All TermJobs roles">' + LOGO + '<div><b>TERMJOBS</b><span>Contract workforce platform</span></div></a><div class="top-actions"><button class="btn" type="button" data-signin>Sign in</button><div class="me" id="d-me" style="display:none"><button type="button" class="av-btn" id="d-av-trigger" aria-label="Open profile menu"><span class="av" id="d-me-av" aria-hidden="true">M</span></button></div></div></header>'
          + '<a class="crumb" href="#" aria-label="Back to all open roles">' + BACK + ' All open roles</a>'
          + '<section class="d-head"><div class="d-top">' + logo + '<div class="co" style="font-size:16px">' + esc(j.company) + '</div></div><h1>' + esc(j.title) + '</h1>'
          + '<div class="chips"><span class="chip mode">' + esc(j.mode) + '</span><span class="chip">' + CAP + esc(j.exp) + '</span><span class="chip">' + PIN + esc(j.loc) + '</span></div></section>'
          + '<div class="d-layout"><div class="stack">'
          + (TJ_DESC[j.slug] ? '<section class="panel"><h2>About the role</h2><p style="margin:0;color:var(--muted)">' + esc(TJ_DESC[j.slug]) + '</p></section>' : '')
          + '<section class="panel"><h2>At a glance</h2><dl class="facts"><div><dt>Company</dt><dd>' + esc(j.company) + '</dd></div><div><dt>Work mode</dt><dd>' + esc(j.mode) + '</dd></div><div><dt>Experience</dt><dd>' + esc(j.exp) + '</dd></div><div><dt>Location</dt><dd>' + esc(j.loc) + '</dd></div></dl></section>'
          + '<section class="panel"><h2>Skills</h2><div class="skills">' + sk + '</div></section>'
          + '<section class="panel"><h2>How applying works</h2><p style="margin:0;color:var(--muted)">Apply directly with your resume. Your profile is matched against the skills above and reviewed within 48 hours.</p></section></div>'
          + '<aside class="panel apply side"><h2>Interested in this role?</h2><' + tag + ' class="btn primary block' + (hasApplied ? ' applied-attend-btn' : '') + '" ' + ap + '>' + applySideBtnText + '</' + tag + '><button class="btn block" type="button" data-share>Copy link to share</button><small><i></i>Reviewed within 48 hours</small></aside></div>'
          + '<div class="bar"><button class="btn share" type="button" data-share aria-label="Copy link">Share</button><' + tag + ' class="btn primary' + (hasApplied ? ' applied-attend-btn' : '') + '" ' + ap + '>' + applyBarBtnText + '</' + tag + '></div>';

        [].slice.call(target.querySelectorAll('[data-share]')).forEach(function (b) { b.addEventListener('click', share); });
        [].slice.call(target.querySelectorAll('[data-apply]')).forEach(function (b) {
          b.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev._applyHandled) return;
            ev._applyHandled = true;
            if (b.dataset.applying === 'true') return;

            var T = window.TJ || {};
            var candUser = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) || (T.profile ? T.profile() : null);
            var isAuth = Boolean(candUser && (candUser.candidate_email || candUser.email || candUser.name));
            if (!isAuth) {
              if (options.onOpenAuth) options.onOpenAuth({ slug: j.slug, title: j.title, company: j.company });
              else toast('Please sign in to apply');
              return;
            }

            var isAlreadyApplied = b.getAttribute('data-applied') === 'true' || b.classList.contains('applied-attend-btn');

            if (isAlreadyApplied) {
              if (options.onStartAiInterview) {
                options.onStartAiInterview({ slug: j.slug, title: j.title, company: j.company });
              }
              return;
            }

            b.dataset.applying = 'true';
            setTimeout(function () { delete b.dataset.applying; }, 800);

            if (T.addApply) T.addApply(j.slug);

            var cEmail = candUser.candidate_email || candUser.email || '';
            var cName = candUser.candidate_name || candUser.name || 'Candidate';
            if (cEmail) {
              fetch('/api/interviews/candidate/attend-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cEmail, name: cName, slug: j.slug, title: j.title, company: j.company }),
              }).then(function (r) { return r.json(); }).then(function (res) {
                if (res && res.round_id) {
                  if (!window.TJ_ROUNDS) window.TJ_ROUNDS = [];
                  if (!window.TJ_ROUNDS.some(function (r) { return r.id === res.round_id; })) {
                    window.TJ_ROUNDS.unshift({
                      id: res.round_id,
                      round_name: j.title,
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

            [].slice.call(target.querySelectorAll('[data-apply]')).forEach(function (btn) {
              btn.setAttribute('data-applied', 'true');
              btn.classList.add('applied-attend-btn');
              if (btn.classList.contains('block')) {
                btn.innerHTML = '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview ' + ARROW;
              } else {
                btn.innerHTML = '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview';
              }
            });

            toast('Applied successfully! Please attend your AI Interview for validation to fast-track your profile.', 4000);
          });
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
        var dMeName = target.querySelector('#d-me-name');
        var dMeAv = target.querySelector('#d-me-av');
        var dSignout = target.querySelector('#d-signout');

        var currentProfile = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) || (window.TJ && window.TJ.profile ? window.TJ.profile() : null);
        var isAuth = Boolean(currentProfile && (currentProfile.candidate_name || currentProfile.name));
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
          var displayName = currentProfile.candidate_name || currentProfile.name || 'Candidate';
          var pic = currentProfile.picture || currentProfile.avatar_url;
          if (dMeAv) {
            if (pic) dMeAv.innerHTML = '<img src="' + esc(pic) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
            else dMeAv.textContent = displayName.charAt(0).toUpperCase();
          }
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
        var pic = cand.picture || cand.avatar_url;
        if (av) {
          if (pic) av.innerHTML = '<img src="' + esc(pic) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
          else av.textContent = (name.charAt(0) || 'C').toUpperCase();
        }
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
        var p = (window.TJ && window.TJ.profile ? window.TJ.profile() : null) || {};
        var cand = {};
        try { cand = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}

        var details = cand.details || {};
        var name = cand.candidate_name || cand.name || p.name || 'Mohammed Hashil';
        var title = cand.candidate_title || cand.title || 'AI Engineer | Python Backend Developer';
        var email = cand.candidate_email || cand.email || p.email || 'mohammedhashil2018@gmail.com';
        var phone = cand.candidate_phone || cand.phone || details.candidate_phone || '8590955632';
        var initial = (name.charAt(0) || 'M').toUpperCase();
        var photoUrl = cand.picture || cand.avatar_url || '';

        var mode = p.mode || cand.mode || details.preferred_mode || details.mode || 'Hybrid';
        var city = p.city || cand.city || details.city || 'Kozhikode, Kerala';
        var level = p.level || cand.experience_level || details.experience_level || 'Junior (1–2 years)';
        var summary = cand.summary || details.summary || 'AI Engineer and Python Backend Developer with hands-on experience building AI agents, LLM-powered applications, RAG systems, and scalable backend services. Currently developing agentic AI workflows and AI-integrated applications using Python, FastAPI, LangGraph, and MCP. Experienced in prompt engineering, tool calling, LLM evaluation, and building production-ready AI solutions.';
        var linkedinUrl = details.linkedin_url || cand.linkedin_url || 'https://linkedin.com/in/mohammed-hashil-nk';
        var githubUrl = details.github_url || cand.github_url || 'https://github.com/HASHILnk';
        var resumeFilename = cand.filename || 'Mohammed_Hashil_N_K_Resume (3).pdf';

        // Skills
        var skillsList = [];
        if (Array.isArray(details.skills) && details.skills.length) {
          skillsList = details.skills;
        } else if (p.skills) {
          skillsList = p.skills.split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        } else if (cand.skills) {
          skillsList = (Array.isArray(cand.skills) ? cand.skills : String(cand.skills).split(/[,;\n]+/)).map(function (s) { return String(s).trim(); }).filter(Boolean);
        }
        if (!skillsList.length) {
          skillsList = ['Python', 'FastAPI', 'LangGraph', 'LangChain', 'AI Agents', 'MCP', 'RAG', 'Prompt Engineering', 'LLM Evaluation', 'PostgreSQL', 'Docker', 'SQL', 'Git', 'GitHub', 'Flask', 'REST APIs'];
        }
        var skHtml = skillsList.map(function (s) { return '<span class="skill">' + esc(s) + '</span>'; }).join('');

        // Experience
        var experiences = (Array.isArray(details.experience) && details.experience.length) ? details.experience : [
          { title: 'AI Engineer', company: 'Asimov X Technologies AB', duration: '04/2026 – Present', location: 'Kozhikode', description: 'Developed AI-powered applications and agentic AI workflows using Python and FastAPI. Designed LLM-integrated features using prompt engineering and tool calling.' },
          { title: 'AI Engineering Intern', company: 'Codely AI', duration: '01/2026 – 07/2026', location: 'Kozhikode', description: 'Built AI-powered applications and backend services using Python and FastAPI. Developed AI agents, multilingual voice applications, and LLM-powered workflows.' },
          { title: 'Junior Data Scientist Intern', company: 'Codeme Hub International', duration: '06/2025 – 08/2025', location: 'Kozhikode', description: 'Analyzed and visualized business data using Power BI, Excel, SQL, and Python.' }
        ];
        var expHtml = experiences.map(function (exp) {
          return '<div class="profile-entry-card">' +
            '<div class="entry-header">' +
              '<div>' +
                '<h3 class="entry-title">' + esc(exp.title || 'Role') + '</h3>' +
                '<div class="entry-sub"><strong>' + esc(exp.company || 'Company') + '</strong>' + (exp.location ? ' · ' + esc(exp.location) : '') + '</div>' +
              '</div>' +
              (exp.duration ? '<span class="entry-date">' + esc(exp.duration) + '</span>' : '') +
            '</div>' +
            (exp.description ? '<p class="entry-desc">' + esc(exp.description) + '</p>' : '') +
          '</div>';
        }).join('');

        // Projects
        var projects = (Array.isArray(details.projects) && details.projects.length) ? details.projects : [
          { title: 'AI Voice Hotel Booking Agent', technologies: ['STT', 'LLMs', 'TTS', 'RAG', 'VAD', 'Python'], description: 'Built a multilingual voice AI agent with RAG for hotel search and policy retrieval, prompt engineering, conversation memory, and low-latency voice detection.' },
          { title: 'LoopFlow – Event-Driven AI Agent Platform', technologies: ['Python', 'FastAPI', 'LangGraph', 'MCP', 'Docker'], description: 'Developed an event-driven AI agent platform for repository analysis and autonomous tool-calling workflows.' }
        ];
        var projHtml = projects.map(function (proj) {
          var tech = Array.isArray(proj.technologies) ? proj.technologies : (proj.technologies ? String(proj.technologies).split(',') : []);
          var techHtml = tech.map(function (t) { return '<span class="proj-tag">' + esc(String(t).trim()) + '</span>'; }).join('');
          return '<div class="profile-entry-card">' +
            '<div class="entry-header">' +
              '<h3 class="entry-title">' + esc(proj.title || 'Project') + '</h3>' +
            '</div>' +
            (techHtml ? '<div class="proj-tags">' + techHtml + '</div>' : '') +
            (proj.description ? '<p class="entry-desc">' + esc(proj.description) + '</p>' : '') +
          '</div>';
        }).join('');

        // Education
        var educations = (Array.isArray(details.education) && details.education.length) ? details.education : [
          { degree: 'B.Tech in Computer Science and Engineering', institution: 'AWH Engineering College', score: 'CGPA: 8.32/10', duration: '11/2022 – 05/2026', location: 'Kozhikode' }
        ];
        var eduHtml = educations.map(function (edu) {
          return '<div class="profile-entry-card">' +
            '<div class="entry-header">' +
              '<div>' +
                '<h3 class="entry-title">' + esc(edu.degree || 'Degree') + '</h3>' +
                '<div class="entry-sub"><strong>' + esc(edu.institution || 'Institution') + '</strong>' + (edu.location ? ' · ' + esc(edu.location) : '') + '</div>' +
              '</div>' +
              (edu.duration ? '<span class="entry-date">' + esc(edu.duration) + '</span>' : '') +
            '</div>' +
            (edu.score ? '<div class="entry-score"><span class="chip-score">' + esc(edu.score) + '</span></div>' : '') +
          '</div>';
        }).join('');

        // Certifications
        var certifications = (Array.isArray(details.certifications) && details.certifications.length) ? details.certifications : [
          'Python Developer (Sololearn)', 'Data analytics (Deloitte)', 'FastAPI (CodeSignal)'
        ];
        var certHtml = certifications.map(function (c) {
          return '<li class="cert-item"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:8px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>' + esc(c) + '</li>';
        }).join('');

        var applied = [];
        try { applied = JSON.parse(localStorage.getItem('tj-apply') || '[]'); } catch (_) {}

        profEl.innerHTML =
          '<header class="top">' +
            '<a class="brand" href="#" aria-label="All TermJobs roles">' +
              LOGO +
              '<div><b>TERMJOBS</b><span>Contract workforce platform</span></div>' +
            '</a>' +
            '<div class="top-actions">' +
              '<div class="me">' +
                '<button type="button" class="av-btn profile-trigger-btn" aria-label="Open profile menu">' +
                  (photoUrl ? '<span class="av"><img src="' + esc(photoUrl) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" /></span>' : '<span class="av">' + esc(initial) + '</span>') +
                '</button>' +
              '</div>' +
            '</div>' +
          '</header>' +
          '<a class="crumb" href="#" id="profile-back-link" aria-label="Back to all open roles">' + BACK + ' All open roles</a>' +
          '<section class="d-head profile-head">' +
            '<div class="profile-hero-content">' +
              '<div class="profile-avatar-wrap" id="profile-avatar-trigger" title="Click to upload profile photo">' +
                (photoUrl ? '<img src="' + esc(photoUrl) + '" class="profile-avatar-img" alt="' + esc(name) + '" />' : '<span class="profile-avatar-initial">' + esc(initial) + '</span>') +
                '<button type="button" class="avatar-photo-btn" id="btn-change-photo" title="Upload profile photo" aria-label="Upload profile photo">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
                '</button>' +
                '<input type="file" id="profile-photo-file-input" accept="image/*" style="display:none;" />' +
              '</div>' +
              '<div class="profile-hero-text">' +
                '<div class="co" style="font-size:14px;color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Candidate Profile · Verified</div>' +
                '<h1>' + esc(name) + '</h1>' +
                '<div class="profile-title-text">' + esc(title) + '</div>' +
                '<div class="chips">' +
                  '<span class="chip mode">' + esc(mode) + '</span>' +
                  '<span class="chip">' + PIN + esc(city) + '</span>' +
                  '<span class="chip">' + CAP + esc(level) + '</span>' +
                  (phone ? '<span class="chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' + esc(phone) + '</span>' : '') +
                  '<span class="chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' + esc(email) + '</span>' +
                  (linkedinUrl ? '<a href="' + esc(linkedinUrl) + '" target="_blank" rel="noopener noreferrer" class="chip chip-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:4px;"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45c-.96 0-1.74.78-1.74 1.74s.78 1.74 1.74 1.74 1.74-.78 1.74-1.74-.78-1.74-1.74-1.74z"/></svg>LinkedIn</a>' : '') +
                  (githubUrl ? '<a href="' + esc(githubUrl) + '" target="_blank" rel="noopener noreferrer" class="chip chip-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:4px;"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>GitHub</a>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="profile-hero-actions">' +
              '<button type="button" class="btn" id="profile-hero-edit-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Edit profile</button>' +
              '<button type="button" class="btn primary" id="profile-hero-edit-pref-btn">Edit preferences &rarr;</button>' +
            '</div>' +
          '</section>' +
          '<div class="d-layout">' +
            '<div class="stack">' +
              '<section class="panel profile-resume-section">' +
                '<div class="profile-resume-card">' +
                  '<div class="resume-icon-wrap">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
                  '</div>' +
                  '<div class="resume-meta">' +
                    '<div class="resume-name">' + esc(resumeFilename) + '</div>' +
                    '<div class="resume-sub">Verified resume on file · Parsed with AI & synced to candidate profile</div>' +
                  '</div>' +
                  '<div class="resume-actions">' +
                    '<button type="button" class="btn btn-sm" id="btn-download-resume">Download</button>' +
                    '<button type="button" class="btn btn-sm primary" id="btn-upload-resume">Upload new</button>' +
                    '<input type="file" id="profile-resume-file-input" accept=".pdf,.docx" style="display:none;" />' +
                  '</div>' +
                '</div>' +
              '</section>' +
              '<section class="panel">' +
                '<div class="panel-head-row">' +
                  '<h2>About you</h2>' +
                  '<button type="button" class="btn-text-edit" id="btn-edit-about">Edit summary</button>' +
                '</div>' +
                '<p style="margin:0;color:var(--muted);line-height:1.7;white-space:pre-line;">' + esc(summary) + '</p>' +
              '</section>' +
              '<section class="panel">' +
                '<h2>Work Experience</h2>' +
                expHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Featured Projects</h2>' +
                projHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Education</h2>' +
                eduHtml +
              '</section>' +
              '<section class="panel">' +
                '<h2>Skills &amp; Match Profile</h2>' +
                '<div class="skills">' + skHtml + '</div>' +
                (certHtml ? '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.08);"><h3 style="font-size:14px;font-weight:600;margin:0 0 10px;color:var(--fg);">Verified Certifications</h3><ul class="cert-list" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;">' + certHtml + '</ul></div>' : '') +
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
              '<button class="btn block" type="button" id="profile-side-edit-profile">Edit profile</button>' +
              '<button class="btn block" type="button" id="profile-side-logout">Sign out</button>' +
              '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:16px 0;" />' +
              '<div style="font-weight:600;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">At a glance</div>' +
              '<dl class="facts">' +
                '<div><dt>Name</dt><dd>' + esc(name) + '</dd></div>' +
                '<div><dt>Title</dt><dd>' + esc(title) + '</dd></div>' +
                '<div><dt>Mode</dt><dd>' + esc(mode) + '</dd></div>' +
                '<div><dt>Location</dt><dd>' + esc(city) + '</dd></div>' +
                '<div><dt>Experience</dt><dd>' + esc(level) + '</dd></div>' +
                (phone ? '<div><dt>Phone</dt><dd>' + esc(phone) + '</dd></div>' : '') +
                '<div><dt>Email</dt><dd style="word-break:break-all;">' + esc(email) + '</dd></div>' +
                '<div><dt>Applications</dt><dd>' + applied.length + ' applied</dd></div>' +
              '</dl>' +
              '<small><i></i>Auto-matches with 18 open partner roles</small>' +
            '</aside>' +
          '</div>' +
          '<div class="bar">' +
            '<button class="btn" type="button" id="profile-bar-edit">Edit preferences</button>' +
            '<button class="btn primary" type="button" id="profile-bar-logout">Sign out</button>' +
          '</div>' +

          '<!-- Edit Preferences Modal -->' +
          '<div class="profile-modal-overlay" id="profile-pref-modal-overlay" style="display:none;" hidden>' +
            '<div class="profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="pref-modal-title">' +
              '<div class="profile-modal-header">' +
                '<h3 id="pref-modal-title">Edit Work Preferences</h3>' +
                '<button type="button" class="profile-modal-close" id="pref-modal-close" aria-label="Close">&times;</button>' +
              '</div>' +
              '<form id="profile-pref-form">' +
                '<div class="profile-modal-body">' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-pref-mode">Preferred Work Mode</label>' +
                    '<select id="edit-pref-mode">' +
                      '<option value="Any mode">Any mode</option>' +
                      '<option value="Remote">Remote</option>' +
                      '<option value="Hybrid">Hybrid</option>' +
                      '<option value="On-site">On-site</option>' +
                    '</select>' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-pref-city">Preferred Location / City</label>' +
                    '<input type="text" id="edit-pref-city" placeholder="e.g. Kozhikode, Kerala or Across India" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-pref-level">Experience Level</label>' +
                    '<select id="edit-pref-level">' +
                      '<option value="Fresher / Entry-Level (0–2 years)">Fresher / Entry-Level (0–2 years)</option>' +
                      '<option value="Junior (1–2 years)">Junior (1–2 years)</option>' +
                      '<option value="Mid-Level (2–4 years)">Mid-Level (2–4 years)</option>' +
                      '<option value="Senior (5+ years)">Senior (5+ years)</option>' +
                    '</select>' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-pref-skills">Target Match Skills (comma-separated)</label>' +
                    '<textarea id="edit-pref-skills" rows="3" placeholder="e.g. Python, FastAPI, LangGraph, AI Agents, Docker"></textarea>' +
                  '</div>' +
                '</div>' +
                '<div class="profile-modal-footer">' +
                  '<button type="button" class="btn" id="pref-modal-cancel">Cancel</button>' +
                  '<button type="submit" class="btn primary">Save preferences</button>' +
                '</div>' +
              '</form>' +
            '</div>' +
          '</div>' +

          '<!-- Edit Profile Modal -->' +
          '<div class="profile-modal-overlay" id="profile-edit-modal-overlay" style="display:none;" hidden>' +
            '<div class="profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">' +
              '<div class="profile-modal-header">' +
                '<h3 id="edit-profile-title">Edit Candidate Profile</h3>' +
                '<button type="button" class="profile-modal-close" id="edit-profile-close" aria-label="Close">&times;</button>' +
              '</div>' +
              '<form id="profile-edit-form">' +
                '<div class="profile-modal-body">' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-name">Full Name</label>' +
                    '<input type="text" id="edit-prof-name" required />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-title">Professional Title</label>' +
                    '<input type="text" id="edit-prof-title" placeholder="e.g. AI Engineer | Python Backend Developer" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-phone">Phone Number</label>' +
                    '<input type="tel" id="edit-prof-phone" placeholder="e.g. +91 8590955632" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-city">Location / City</label>' +
                    '<input type="text" id="edit-prof-city" placeholder="e.g. Kozhikode, Kerala" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-linkedin">LinkedIn URL</label>' +
                    '<input type="url" id="edit-prof-linkedin" placeholder="https://linkedin.com/in/username" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-github">GitHub URL</label>' +
                    '<input type="url" id="edit-prof-github" placeholder="https://github.com/username" />' +
                  '</div>' +
                  '<div class="profile-form-group">' +
                    '<label for="edit-prof-summary">About you / Summary</label>' +
                    '<textarea id="edit-prof-summary" rows="4" placeholder="Brief summary of your background, technical expertise, and career goals..."></textarea>' +
                  '</div>' +
                '</div>' +
                '<div class="profile-modal-footer">' +
                  '<button type="button" class="btn" id="edit-profile-cancel">Cancel</button>' +
                  '<button type="submit" class="btn primary">Save profile</button>' +
                '</div>' +
              '</form>' +
            '</div>' +
          '</div>';

        var backBtn = profEl.querySelector('#profile-back-link');
        if (backBtn) backBtn.addEventListener('click', function (e) { e.preventDefault(); closeProfilePage(); });
        var brandBtn = profEl.querySelector('header .brand');
        if (brandBtn) brandBtn.addEventListener('click', function (e) { e.preventDefault(); closeProfilePage(); });
        var trig = profEl.querySelector('.profile-trigger-btn');
        if (trig) trig.addEventListener('click', toggleDrawer);

        // Photo Upload Handlers
        var photoInput = profEl.querySelector('#profile-photo-file-input');
        var avatarWrap = profEl.querySelector('#profile-avatar-trigger');
        var btnPhoto = profEl.querySelector('#btn-change-photo');
        var onTriggerPhoto = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (photoInput) photoInput.click();
        };
        if (avatarWrap) avatarWrap.addEventListener('click', onTriggerPhoto);
        if (btnPhoto) btnPhoto.addEventListener('click', onTriggerPhoto);
        if (photoInput) {
          photoInput.addEventListener('change', function () {
            var file = photoInput.files && photoInput.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              snk('Please select an image smaller than 5MB');
              return;
            }
            var reader = new FileReader();
            reader.onload = function (evt) {
              var dataUrl = evt.target.result;
              cand.picture = dataUrl;
              cand.avatar_url = dataUrl;
              localStorage.setItem('candidate_profile_user', JSON.stringify(cand));
              updateAllAvatars(dataUrl, name);
              renderProfileContent(profEl);
              snk('Profile photo updated successfully!');

              var token = localStorage.getItem('candidate_profile_token') || cand.token || cand.candidate_token;
              if (token) {
                fetch('/api/candidate-profile/me', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                  body: JSON.stringify({ picture: dataUrl, avatar_url: dataUrl }),
                }).then(function (r) { return r.json(); }).then(function (res) {
                  if (res && res.candidate) {
                    localStorage.setItem('candidate_profile_user', JSON.stringify(res.candidate));
                  }
                }).catch(function (err) {
                  console.warn('Avatar sync error:', err);
                });
              }
            };
            reader.readAsDataURL(file);
          });
        }

        // Resume Download & Upload Handlers
        var btnDlResume = profEl.querySelector('#btn-download-resume');
        if (btnDlResume) {
          btnDlResume.addEventListener('click', function (e) {
            e.preventDefault();
            var token = localStorage.getItem('candidate_profile_token') || cand.token || cand.candidate_token;
            var dlUrl = '/api/candidate-profile/resume' + (token ? '?token=' + encodeURIComponent(token) : '');
            window.open(dlUrl, '_blank');
          });
        }

        var btnUpResume = profEl.querySelector('#btn-upload-resume');
        var resumeInput = profEl.querySelector('#profile-resume-file-input');
        if (btnUpResume && resumeInput) {
          btnUpResume.addEventListener('click', function (e) {
            e.preventDefault();
            resumeInput.click();
          });
          resumeInput.addEventListener('change', function () {
            var file = resumeInput.files && resumeInput.files[0];
            if (!file) return;
            snk('Uploading and parsing resume with AI...');
            var fd = new FormData();
            fd.append('resume', file);
            var token = localStorage.getItem('candidate_profile_token') || cand.token || cand.candidate_token;
            fetch('/api/candidate-profile/upload-resume', {
              method: 'POST',
              headers: token ? { 'Authorization': 'Bearer ' + token } : {},
              body: fd,
            }).then(function (r) { return r.json(); }).then(function (res) {
              if (res && res.candidate) {
                localStorage.setItem('candidate_profile_user', JSON.stringify(res.candidate));
                renderProfileContent(profEl);
                snk('Resume uploaded & profile updated successfully!');
              } else {
                snk(res.detail || 'Resume uploaded.');
              }
            }).catch(function (err) {
              console.warn('Resume upload err:', err);
              snk('Failed to upload resume. Please try again.');
            });
          });
        }

        // Preferences Modal Handlers
        var prefOverlay = profEl.querySelector('#profile-pref-modal-overlay');
        var prefForm = profEl.querySelector('#profile-pref-form');
        var prefClose = profEl.querySelector('#pref-modal-close');
        var prefCancel = profEl.querySelector('#pref-modal-cancel');

        function openPrefModal() {
          if (!prefOverlay) return;
          var m = profEl.querySelector('#edit-pref-mode');
          var c = profEl.querySelector('#edit-pref-city');
          var l = profEl.querySelector('#edit-pref-level');
          var s = profEl.querySelector('#edit-pref-skills');
          if (m) m.value = mode || 'Hybrid';
          if (c) c.value = city || 'Kozhikode, Kerala';
          if (l) l.value = level || 'Junior (1–2 years)';
          if (s) s.value = skillsList.join(', ');
          prefOverlay.hidden = false;
          prefOverlay.style.display = 'flex';
        }
        function closePrefModal() {
          if (!prefOverlay) return;
          prefOverlay.hidden = true;
          prefOverlay.style.display = 'none';
        }

        if (prefClose) prefClose.addEventListener('click', closePrefModal);
        if (prefCancel) prefCancel.addEventListener('click', closePrefModal);
        if (prefOverlay) prefOverlay.addEventListener('click', function (e) {
          if (e.target === prefOverlay) closePrefModal();
        });

        var editPrefBtns = profEl.querySelectorAll('#profile-side-edit, #profile-bar-edit, #profile-hero-edit-pref-btn');
        [].slice.call(editPrefBtns).forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.preventDefault();
            openPrefModal();
          });
        });

        if (prefForm) {
          prefForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var m = profEl.querySelector('#edit-pref-mode');
            var c = profEl.querySelector('#edit-pref-city');
            var l = profEl.querySelector('#edit-pref-level');
            var s = profEl.querySelector('#edit-pref-skills');

            var newMode = m ? m.value : mode;
            var newCity = c ? c.value.trim() : city;
            var newLevel = l ? l.value : level;
            var newSkills = s ? s.value.split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean) : skillsList;

            cand.mode = newMode;
            cand.city = newCity;
            cand.experience_level = newLevel;
            cand.skills = newSkills;
            if (!cand.details) cand.details = {};
            cand.details.preferred_mode = newMode;
            cand.details.city = newCity;
            cand.details.experience_level = newLevel;
            cand.details.skills = newSkills;
            localStorage.setItem('candidate_profile_user', JSON.stringify(cand));

            var tjProf = JSON.parse(localStorage.getItem('tj-profile') || '{}');
            tjProf.mode = newMode;
            tjProf.city = newCity;
            tjProf.level = newLevel;
            tjProf.skills = newSkills.join(', ');
            localStorage.setItem('tj-profile', JSON.stringify(tjProf));

            var token = localStorage.getItem('candidate_profile_token') || cand.token || cand.candidate_token;
            if (token) {
              fetch('/api/candidate-profile/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ mode: newMode, city: newCity, experience_level: newLevel, skills: newSkills }),
              }).catch(function (err) { console.warn('Sync error:', err); });
            }

            setAuth(tjProf);
            closePrefModal();
            renderProfileContent(profEl);
            snk('Preferences updated successfully!');
          });
        }

        // Edit Profile Modal Handlers
        var editProfOverlay = profEl.querySelector('#profile-edit-modal-overlay');
        var editProfForm = profEl.querySelector('#profile-edit-form');
        var editProfClose = profEl.querySelector('#edit-profile-close');
        var editProfCancel = profEl.querySelector('#edit-profile-cancel');

        function openEditProfModal() {
          if (!editProfOverlay) return;
          var inName = profEl.querySelector('#edit-prof-name');
          var inTitle = profEl.querySelector('#edit-prof-title');
          var inPhone = profEl.querySelector('#edit-prof-phone');
          var inCity = profEl.querySelector('#edit-prof-city');
          var inLi = profEl.querySelector('#edit-prof-linkedin');
          var inGh = profEl.querySelector('#edit-prof-github');
          var inSum = profEl.querySelector('#edit-prof-summary');

          if (inName) inName.value = name || '';
          if (inTitle) inTitle.value = title || '';
          if (inPhone) inPhone.value = phone || '';
          if (inCity) inCity.value = city || '';
          if (inLi) inLi.value = linkedinUrl || '';
          if (inGh) inGh.value = githubUrl || '';
          if (inSum) inSum.value = summary || '';

          editProfOverlay.hidden = false;
          editProfOverlay.style.display = 'flex';
        }
        function closeEditProfModal() {
          if (!editProfOverlay) return;
          editProfOverlay.hidden = true;
          editProfOverlay.style.display = 'none';
        }

        if (editProfClose) editProfClose.addEventListener('click', closeEditProfModal);
        if (editProfCancel) editProfCancel.addEventListener('click', closeEditProfModal);
        if (editProfOverlay) editProfOverlay.addEventListener('click', function (e) {
          if (e.target === editProfOverlay) closeEditProfModal();
        });

        var editProfTriggers = profEl.querySelectorAll('#profile-hero-edit-btn, #profile-side-edit-profile, #btn-edit-about');
        [].slice.call(editProfTriggers).forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.preventDefault();
            openEditProfModal();
          });
        });

        if (editProfForm) {
          editProfForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var inName = profEl.querySelector('#edit-prof-name');
            var inTitle = profEl.querySelector('#edit-prof-title');
            var inPhone = profEl.querySelector('#edit-prof-phone');
            var inCity = profEl.querySelector('#edit-prof-city');
            var inLi = profEl.querySelector('#edit-prof-linkedin');
            var inGh = profEl.querySelector('#edit-prof-github');
            var inSum = profEl.querySelector('#edit-prof-summary');

            var updatedName = inName ? inName.value.trim() : name;
            var updatedTitle = inTitle ? inTitle.value.trim() : title;
            var updatedPhone = inPhone ? inPhone.value.trim() : phone;
            var updatedCity = inCity ? inCity.value.trim() : city;
            var updatedLi = inLi ? inLi.value.trim() : linkedinUrl;
            var updatedGh = inGh ? inGh.value.trim() : githubUrl;
            var updatedSum = inSum ? inSum.value.trim() : summary;

            cand.candidate_name = updatedName;
            cand.name = updatedName;
            cand.candidate_title = updatedTitle;
            cand.candidate_phone = updatedPhone;
            cand.city = updatedCity;
            cand.summary = updatedSum;
            if (!cand.details) cand.details = {};
            cand.details.city = updatedCity;
            cand.details.linkedin_url = updatedLi;
            cand.details.github_url = updatedGh;
            cand.details.candidate_phone = updatedPhone;
            cand.details.summary = updatedSum;
            localStorage.setItem('candidate_profile_user', JSON.stringify(cand));

            var tjProf = JSON.parse(localStorage.getItem('tj-profile') || '{}');
            tjProf.name = updatedName;
            tjProf.city = updatedCity;
            localStorage.setItem('tj-profile', JSON.stringify(tjProf));

            updateAllAvatars(cand.picture || cand.avatar_url, updatedName);
            var meName = $('me-name'); if (meName) meName.textContent = updatedName;
            var dNm = $('drawer-name'); if (dNm) dNm.textContent = updatedName;

            var token = localStorage.getItem('candidate_profile_token') || cand.token || cand.candidate_token;
            if (token) {
              fetch('/api/candidate-profile/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                  candidate_name: updatedName,
                  candidate_title: updatedTitle,
                  candidate_phone: updatedPhone,
                  city: updatedCity,
                  linkedin_url: updatedLi,
                  github_url: updatedGh,
                  summary: updatedSum,
                }),
              }).catch(function (err) { console.warn('Profile sync error:', err); });
            }

            closeEditProfModal();
            renderProfileContent(profEl);
            snk('Profile updated successfully!');
          });
        }

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
        var j = findJob(slug); if (!j) return;
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
        var m = location.hash.match(/^#job-([a-z0-9-]+)$/), j = m && findJob(m[1]);
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
      window.TJ.findJob = findJob;
      window.TJ.openDetail = openDetail;
      window.TJ.closeDetail = closeDetail;
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
        if (window.TJ && window.TJ.setAuth) window.TJ.setAuth(null);
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
      if (location.hash === '#profile' || (!options.loadRoles && /^#job-([a-z0-9-]+)$/.test(location.hash))) { route(); }
    // 2. Script 1: Search & pagination
    (function () {
      const query = selector => container.querySelector(selector);
      const grid = query('#open-roles-grid');
      var PER = (function (w) { return w >= 1200 ? 8 : w >= 900 ? 9 : 6; })(window.innerWidth),
        page = 1, cards = [...grid.querySelectorAll('.card')], q = query('#q'),
        fm = query('#f-mode'), fc = query('#f-city'), fl = query('#f-level'),
        count = query('#count'), empty = query('#empty'), r2 = query('#reset2'),
        pager = query('#pager'), toolbar = query('.toolbar');
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
      query('#reset').addEventListener('click', reset); r2.addEventListener('click', reset);
      if (options.loadRoles) {
        let active = true;
        let pending = false;
        let firstLoad = true;
        let previousLiveIds = new Set();

        function configureFilter(select, values) {
          const selected = select.value;
          const fallback = select.options[0].cloneNode(true);
          select.replaceChildren(fallback, ...Array.from(new Set(values.filter(Boolean)))
            .sort((left, right) => left.localeCompare(right))
            .map(value => new Option(value, value)));
          select.value = [...select.options].some(option => option.value === selected) ? selected : '';
        }

        function showJobs(rows) {
          const jobs = mapLiveOpenRoles(rows);
          const liveIds = new Set(jobs.map(job => job.slug));
          JOBS = [...jobs, ...JOBS.filter(job => !previousLiveIds.has(job.slug) && !liveIds.has(job.slug))];
          previousLiveIds.forEach(id => { delete TJ_DESC[id]; });
          previousLiveIds = liveIds;
          window.TJ_JOBS = JOBS;

          const fragment = document.createDocumentFragment();
          cards = jobs.map(job => {
            TJ_DESC[job.slug] = job.description;
            const card = document.createElement('a');
            card.className = 'card';
            card.href = '#job-' + job.slug;
            Object.assign(card.dataset, {
              slug: job.slug, mode: job.mode, city: job.loc, level: job.exp,
              q: [job.title, job.company, job.mode, job.loc, ...job.skills].join(' ').toLowerCase(),
            });
            const summary = job.description.slice(0, 180);
            card.innerHTML = '<div class="card-head">' + renderLogo(job)
              + '<div style="min-width:0"><h3>' + esc(job.title) + '</h3><div class="co">' + esc(job.company) + '</div></div></div>'
              + '<div class="chips"><span class="chip mode">' + esc(job.mode) + '</span><span class="chip">' + CAP + esc(job.exp)
              + '</span><span class="chip">' + PIN + esc(job.loc) + '</span></div>'
              + (summary ? '<p class="blurb">' + esc(summary) + (summary.length < job.description.length ? '…' : '') + '</p>' : '')
              + '<div class="card-foot"><span>View details</span>' + ARROW + '</div>';
            fragment.append(card);
            return card;
          });
          grid.replaceChildren(fragment, empty);
          query('#open-roles-total').textContent = jobs.length;
          query('#open-roles-partners').textContent = new Set(jobs.map(job => job.company.trim().toLowerCase())).size;
          const tabCount = query('#tab-n');
          if (tabCount) tabCount.textContent = jobs.length;
          configureFilter(fm, jobs.map(job => job.mode));
          configureFilter(fc, jobs.map(job => job.loc));
          configureFilter(fl, jobs.map(job => job.exp));
          empty.textContent = 'No roles match these filters. Try clearing one.';
          run();
          if (window.TJ?.drawSaved) window.TJ.drawSaved();
          if (firstLoad && /^#job-[a-z0-9-]+$/.test(location.hash)) {
            window.dispatchEvent(new Event('hashchange'));
          }
          firstLoad = false;
        }

        async function refreshJobs() {
          if (pending || document.visibilityState === 'hidden') return;
          pending = true;
          try {
            const rows = await options.loadRoles();
            if (active) showJobs(rows);
          } catch {
            if (active) {
              count.textContent = 'Could not refresh open roles.';
              if (!cards.length) {
                empty.hidden = false;
                empty.textContent = 'Could not load open roles. Please refresh the page to try again.';
              }
            }
          } finally {
            pending = false;
            if (active) grid.removeAttribute('aria-busy');
          }
        }

        // Check for cached roles to render immediately in 0ms without showing loading state
        const preCached = (() => {
          try {
            const raw = sessionStorage.getItem('tj_cached_open_roles');
            return raw ? JSON.parse(raw) : null;
          } catch (_) { return null; }
        })();
        if (preCached && Array.isArray(preCached) && preCached.length > 0) {
          showJobs(preCached);
        } else {
          grid.replaceChildren(empty);
          grid.setAttribute('aria-busy', 'true');
          cards = [];
          empty.hidden = true;
          pager.hidden = true;
          count.textContent = 'Loading open roles…';
        }
        refreshJobs();
        addDocListener('visibilitychange', refreshJobs);
        addWinListener('tj-requisitions-updated', refreshJobs);
        cleanups.push(() => { active = false; });
      } else {
        run();
      }
      document.body.classList.add('ready');
    })();

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
      function paintApplyBtns() {
        cards.forEach(function (c) {
          var sl = c.dataset.slug;
          var isApplied = applyList.indexOf(sl) > -1 || (window.TJ && window.TJ.inApply && window.TJ.inApply(sl));
          var btn = c.querySelector('[data-apply], .s-apply');
          if (btn) {
            if (isApplied) {
              btn.setAttribute('data-applied', 'true');
              btn.classList.add('applied-attend-btn');
              btn.innerHTML = '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview';
            } else {
              btn.setAttribute('data-applied', 'false');
              btn.classList.remove('applied-attend-btn');
              btn.innerHTML = 'Apply now';
            }
          }
        });
      }
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
        if (deckCtl) deckCtl.hidden = true;
        if (deckEmpty) deckEmpty.hidden = true;
        var dhGrid = $('deck-hint');
        if (dhGrid) dhGrid.hidden = true;
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
        q.forEach(function (c, i) {
          var cntEl = c.querySelector('.cnt');
          if (cntEl) cntEl.textContent = (done + i + 1) + ' of ' + total;
        });
        track.dataset.n = Math.min(3, q.length);
        if (deckCtl) deckCtl.hidden = !q.length;
        var dh = $('deck-hint');
        if (dh) dh.hidden = !q.length;
        if (deckEmpty) deckEmpty.hidden = !!q.length;
        track.hidden = !q.length;
        if (!q.length) { $('de-t').textContent = total ? "You're all caught up" : 'No roles for this filter'; $('de-p').textContent = total ? 'You have been through every suggestion. Review the roles you picked, or start again.' : 'Try another work mode.'; $('de-restart').hidden = !total; }
      }
      function render() {
        if (!profile) return;
        var deck = mq.matches; track.classList.toggle('deck', deck); track.hidden = false;
        if (deck) { renderDeck(); startHint(); } else renderGrid();
        updApply(); paintBm(); paintApplyBtns();
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
        var curTabs = $('tabs');
        if (curTabs) { curTabs.hidden = !on; curTabs.style.display = on ? '' : 'none'; }
        if (curSec) { curSec.hidden = !on; curSec.style.display = on ? '' : 'none'; }
        if (curSignin) { curSignin.hidden = on; curSignin.style.display = on ? 'none' : ''; }
        if (curMe) { curMe.hidden = !on; curMe.style.display = on ? 'inline-flex' : 'none'; }
        document.body.classList.toggle('has-sug', on);
        if (!on) {
          document.body.classList.remove('show-roles', 'show-saved', 'show-interview');
        }
        if (on) {
          var candU = {};
          try { candU = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}
          var photo = candU.picture || candU.avatar_url;
          var displayName = profile.name || candU.candidate_name || 'Candidate';
          var meName = $('me-name'); if (meName) meName.textContent = displayName;
          updateAllAvatars(photo, displayName);
          var dNm = $('drawer-name'); if (dNm) dNm.textContent = displayName;
          var dEm = $('drawer-email'); if (dEm) dEm.textContent = profile.email || candU.candidate_email || '';
          var bits = [profile.mode || 'Any mode', profile.city === 'Across India' ? 'Remote across India' : (profile.city || 'Anywhere'), profile.level || 'Any level'];
          var sugSum = $('sug-sum'); if (sugSum) sugSum.textContent = 'Based on: ' + bits.join(' · ');
          rank();
          start = 0;
          render();
        } else {
          var dAv0 = $('drawer-av'); if (dAv0) dAv0.textContent = 'C';
          var dNm0 = $('drawer-name'); if (dNm0) dNm0.textContent = 'Candidate';
          var dEm0 = $('drawer-email'); if (dEm0) dEm0.textContent = '';
          var curTabs0 = $('tabs'); if (curTabs0) { curTabs0.hidden = true; curTabs0.style.display = 'none'; }
          document.body.classList.remove('show-roles', 'show-saved', 'show-interview');
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
          if (dir === 'apply') {
            if (applyList.indexOf(slug) < 0) {
              applyList.push(slug);
              store('tj-apply', applyList);
            }
            var candUser = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) || (window.TJ && window.TJ.profile ? window.TJ.profile() : null);
            var cEmail = candUser ? (candUser.candidate_email || candUser.email || '') : '';
            var cName = candUser ? (candUser.candidate_name || candUser.name || 'Candidate') : '';
            var j = (window.TJ_JOBS || []).find(function (x) { return x.slug === slug; });
            if (cEmail && j) {
              fetch('/api/interviews/candidate/attend-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cEmail, name: cName, slug: j.slug, title: j.title, company: j.company }),
              }).then(function (r) { return r.json(); }).then(function (res) {
                if (res && res.round_id && window.TJ_ROUNDS) {
                  if (!window.TJ_ROUNDS.some(function (r) { return r.id === res.round_id; })) {
                    window.TJ_ROUNDS.unshift({
                      id: res.round_id,
                      round_name: j.title,
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
            showToast('Applied successfully! Please attend your AI Interview for validation to fast-track your profile.', 4000);
          }
          if (dir === 'save' && saved.indexOf(slug) < 0) { saved.push(slug); store('tj-saved', saved); }
          last = { slug: slug, dir: dir }; renderDeck(); updApply(); paintBm(); paintApplyBtns();
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
        decided[slug] = 'apply'; stopHint(); last = { slug: slug, dir: 'apply' }; render(); snk('Applied! AI Interview ready in Interviews tab', true);
        if (window.TJ && window.TJ.drawInterviews) window.TJ.drawInterviews();
        // Provision AI interview round in background
        var candUser = null;
        try { candUser = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) {}
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
                  round_name: j.title,
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
        g.innerHTML = list.map(function (j) { return '<div class="sw"><a class="card" href="#job-' + e(j.slug) + '" data-slug="' + e(j.slug) + '"><div class="card-head">' + renderLogo(j) + '<div style="min-width:0"><h3>' + e(j.title) + '</h3><div class="co">' + e(j.company) + '</div></div></div><div class="chips"><span class="chip mode">' + e(j.mode) + '</span><span class="chip">' + CAPI + e(j.exp) + '</span><span class="chip">' + PINI + e(j.loc) + '</span></div>' + (D[j.slug] ? '<p class="blurb">' + e(D[j.slug]) + '</p>' : '') + '<div class="card-foot"><span>View details</span><span>&rarr;</span></div></a><button type="button" class="un" data-un="' + e(j.slug) + '" aria-label="Remove from saved"><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button></div>'; }).join('');
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
                var roundTitles = res.rounds.map(function (r) {
                  return (r.job_title || r.round_name || '').toLowerCase().trim();
                }).filter(Boolean);
                // Synchronize local applyList with actual DB rounds for this candidate
                applyList = applyList.filter(function (sl) {
                  var j = (window.TJ_JOBS || []).find(function (x) { return x.slug === sl; });
                  return j && roundTitles.some(function (t) {
                    return t.indexOf(j.title.toLowerCase().trim()) > -1 || j.title.toLowerCase().trim().indexOf(t) > -1;
                  });
                });
                store('tj-apply', applyList);
                if (res.rounds.length === 0) {
                  try {
                    localStorage.removeItem('tj-apply');
                    localStorage.removeItem('tj_completed_round_ids');
                    localStorage.removeItem('tj_completed_titles');
                  } catch (_) {}
                }
                paintApplyBtns();
                paintBm();
                var detApplyBtns = document.querySelectorAll('#detail [data-apply]');
                if (detApplyBtns.length && res.rounds.length === 0) {
                  detApplyBtns.forEach(function (btn) {
                    btn.setAttribute('data-applied', 'false');
                    btn.classList.remove('applied-attend-btn');
                    if (btn.classList.contains('block')) {
                      btn.innerHTML = 'Apply now ' + ARROW;
                    } else {
                      btn.innerHTML = 'Apply now';
                    }
                  });
                }
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

          var rawTitle = r.job_title || r.requisition_title || matchingJob.title || r.title || r.round_name || 'Interview';
          var title = String(rawTitle).replace(/^AI\s+(Technical\s+)?Interview\s*[-–:]\s*/i, '').trim() || rawTitle;
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
                  renderLogo(matchingJob ? matchingJob : { company: company, tone: tone, ink: ink, initial: initial }) +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(title) + '</h3>' +
                    '<div class="co">' + e(company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="iv-badge status-completed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Interview Completed</span>' +
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
                  renderLogo(matchingJob ? matchingJob : { company: company, tone: tone, ink: ink, initial: initial }) +
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
                  '<button type="button" class="btn primary iv-act-btn iv-attend-ai" data-round="' + e(roomId) + '" data-token="' + e(r.candidate_token || '') + '" data-slug="' + e(matchingJob.slug || '') + '" data-title="' + e(title) + '" data-company="' + e(company) + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Attend AI Interview</span></button>' +
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
                  renderLogo(j) +
                  '<div style="min-width:0;flex:1">' +
                    '<h3>' + e(j.title) + '</h3>' +
                    '<div class="co">' + e(j.company) + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="iv-status-row">' +
                  '<span class="iv-badge status-completed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Interview Completed</span>' +
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
                  renderLogo(j) +
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
      function toast(m, dur) { showToast(m, dur); }
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
          dApply.addEventListener('click', function (ev) {
            if (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              if (ev._applyHandled) return;
              ev._applyHandled = true;
            }
            if (dApply.dataset.applying === 'true') return;
            var T = window.TJ || {}, sc = cur && document.querySelector('.sc[data-slug="' + cur.slug + '"]');
            if (!cur) {
              toast('Apply link is not connected yet');
              return;
            }
            var candUser = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) || (T.profile ? T.profile() : null);
            var isAuth = Boolean(candUser && (candUser.candidate_email || candUser.email || candUser.name));
            if (!isAuth) {
              if (options.onOpenAuth) options.onOpenAuth({ slug: cur.slug, title: cur.title, company: cur.company });
              else toast('Please sign in to apply');
              return;
            }

            var isAlreadyApplied = dApply.getAttribute('data-applied') === 'true' || dApply.classList.contains('iv-attend-mode');

            if (isAlreadyApplied) {
              closeAnim(function () {
                if (options.onStartAiInterview) {
                  options.onStartAiInterview({ slug: cur.slug, title: cur.title, company: cur.company });
                }
              });
              return;
            }

            var sl = cur.slug;
            if (T.addApply) T.addApply(sl);

            var cEmail = candUser.candidate_email || candUser.email || '';
            var cName = candUser.candidate_name || candUser.name || 'Candidate';
            if (cEmail) {
              fetch('/api/interviews/candidate/attend-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cEmail, name: cName, slug: cur.slug, title: cur.title, company: cur.company }),
              }).catch(function () {});
            }

            dApply.setAttribute('data-applied', 'true');
            dApply.classList.add('iv-attend-mode');
            dApply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg>Attend AI Interview';

            toast('Applied successfully! Please attend your AI Interview for validation to fast-track your profile.', 4000);
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
        var j = (window.TJ && window.TJ.findJob ? window.TJ.findJob(slug) : null) || (window.TJ_JOBS || JOBS).filter(function (x) { return x.slug === slug; })[0]; if (!j) return;
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
            + '<div class="dh">' + renderLogo(j) + '<div><div class="dco">' + esc(j.company) + '</div>' + match + '</div></div>'
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
          if (window.TJ && window.TJ.inApply(slug)) {
            dApply.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg>Attend AI Interview';
            dApply.classList.add('iv-attend-mode');
          } else {
            dApply.textContent = 'Apply now';
            dApply.classList.remove('iv-attend-mode');
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
      var onTrackClick = function (e) {
        var applyBtn = e.target.closest('[data-apply], .s-apply');
        if (applyBtn) {
          e.preventDefault();
          e.stopPropagation();
          if (e._applyHandled) return;
          e._applyHandled = true;
          if (applyBtn.dataset.applying === 'true') return;

          var c = applyBtn.closest('.sc, [data-slug]');
          var slug = c ? c.dataset.slug : null;
          var j = slug ? (window.TJ_JOBS || []).find(function (x) { return x.slug === slug; }) : null;
          var T = window.TJ || {};
          var candUser = (options.getCandidateUser ? options.getCandidateUser() : options.candidateUser) || (T.profile ? T.profile() : null);
          var isAuth = Boolean(candUser && (candUser.candidate_email || candUser.email || candUser.name));
          if (!isAuth) {
            if (options.onOpenAuth) options.onOpenAuth(j ? { slug: j.slug, title: j.title, company: j.company } : null);
            else showToast('Please sign in to apply');
            return;
          }

          var isAlreadyApplied = applyBtn.getAttribute('data-applied') === 'true' || applyBtn.classList.contains('applied-attend-btn');

          if (isAlreadyApplied) {
            if (options.onStartAiInterview && j) {
              options.onStartAiInterview({ slug: j.slug, title: j.title, company: j.company });
            }
            return;
          }

          applyBtn.dataset.applying = 'true';
          setTimeout(function () { delete applyBtn.dataset.applying; }, 800);

          applyBtn.setAttribute('data-applied', 'true');
          applyBtn.classList.add('applied-attend-btn');
          applyBtn.innerHTML = '<span class="iv-ai-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-2px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Attend AI Interview';

          if (slug && j) {
            if (T.addApply) T.addApply(slug);
            showToast('Applied successfully! Please attend your AI Interview for validation to fast-track your profile.', 4000);
          }
          return;
        }

        var c = e.target.closest('.sc'); if (!c) return;
        var a = e.target.closest('a'); if (e.target.closest('button')) return;
        if (a && a.classList.contains('primary')) return;
        var deck = track.classList.contains('deck');
        if (deck && !a) return;
        e.preventDefault();
        e.stopPropagation();
        open(c.dataset.slug, deck ? 'deck' : 'list');
      };
      if (track) {
        track.addEventListener('click', onTrackClick);
        cleanups.push(function () { track.removeEventListener('click', onTrackClick); });
      }

      /* mobile pages: For you / All roles / Saved / Interviews */
      var tn = $('tab-n'); if (tn) tn.textContent = container.querySelectorAll('#open-roles-grid > .card').length;
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
