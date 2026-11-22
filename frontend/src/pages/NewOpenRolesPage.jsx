import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { NEW_OPEN_ROLES_HTML } from './newOpenRolesMarkup';
import { mountOpenRolesEngine } from './newOpenRolesEngine';
import SEOHead from '../components/SEOHead';
import { Backdrop } from '../components/landing/Backdrop';
import CandidateAuthModal from '../components/CandidateAuthModal';
import './NewOpenRolesPage.css';

export default function NewOpenRolesPage({ enabled = true }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const candidateAuth = useCandidateAuth();
  const candidateUser = candidateAuth?.candidateUser;
  const candidateAuthRef = useRef(candidateAuth);
  candidateAuthRef.current = candidateAuth;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const markup = useMemo(() => ({ __html: NEW_OPEN_ROLES_HTML }), []);

  const formatSkills = (sk, fallback = '') => {
    if (Array.isArray(sk)) return sk.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ');
    if (typeof sk === 'string') return sk;
    return fallback;
  };

  const syncCandidateProfileToLocal = useCallback((candidate) => {
    if (!candidate) return;
    try {
      const existing = JSON.parse(localStorage.getItem('tj-profile') || '{}');
      const details = candidate.details || {};
      const projects = details.projects || candidate.projects || existing.projects || [];
      const projectSkills = projects.flatMap(p => (Array.isArray(p.technologies) ? p.technologies : [p.technologies || '']));
      const githubEvidence = details.github_evidence || candidate.github_evidence || existing.github_evidence || null;
      const githubUrl = details.github_url || candidate.github_url || existing.github_url || '';
      const githubSkills = (githubEvidence?.top_repos || []).flatMap(r => r.languages || []);

      const rawSkills = formatSkills(candidate.skills, candidate.title || existing.skills || '');
      const allSkills = Array.from(new Set([
        ...rawSkills.split(/[,;\n]+/).map(s => s.trim()),
        ...projectSkills.map(s => String(s).trim()),
        ...githubSkills.map(s => String(s).trim()),
        candidate.candidate_title || candidate.title || '',
      ])).filter(Boolean);

      const updated = {
        ...existing,
        name:
          candidate.candidate_name ||
          candidate.name ||
          (candidate.candidate_email ? candidate.candidate_email.split('@')[0] : 'Candidate'),
        email: candidate.candidate_email || candidate.email || existing.email || '',
        title: candidate.candidate_title || candidate.title || details.title || existing.title || 'AI Engineer | Python Backend Developer',
        summary: candidate.summary || details.summary || existing.summary || '',
        skills: allSkills.join(', '),
        skillsList: allSkills,
        projects,
        experience: details.experience || candidate.experience || existing.experience || [],
        education: details.education || candidate.education || existing.education || [],
        certifications: details.certifications || candidate.certifications || existing.certifications || [],
        picture: candidate.picture || existing.picture || '',
        phone: candidate.candidate_phone || candidate.phone || existing.phone || '',
        github_url: githubUrl,
        linkedin_url: details.linkedin_url || candidate.linkedin_url || existing.linkedin_url || '',
        github_evidence: githubEvidence,
        mode: details.preferred_mode || candidate.preferred_mode || existing.mode || 'Hybrid',
        city: details.city || candidate.location || existing.city || 'Kozhikode, Kerala',
        level: details.experience_level || candidate.experience_level || existing.level || 'Junior (1–2 years)',
      };
      localStorage.setItem('tj-profile', JSON.stringify(updated));
    } catch (e) {}
  }, []);

  const updateHeaderAuthDOM = useCallback((user) => {
    const signinEl = containerRef.current ? containerRef.current.querySelector('#signin') : document.getElementById('signin');
    const meEl = containerRef.current ? containerRef.current.querySelector('#me') : document.getElementById('me');
    const meNameEl = containerRef.current ? containerRef.current.querySelector('#me-name') : document.getElementById('me-name');
    const meAvEl = containerRef.current ? containerRef.current.querySelector('#me-av') : document.getElementById('me-av');
    const drawerAvEl = containerRef.current ? containerRef.current.querySelector('#drawer-av') : document.getElementById('drawer-av');
    const drawerNameEl = containerRef.current ? containerRef.current.querySelector('#drawer-name') : document.getElementById('drawer-name');
    const drawerEmailEl = containerRef.current ? containerRef.current.querySelector('#drawer-email') : document.getElementById('drawer-email');
    const secEl = containerRef.current ? containerRef.current.querySelector('#sug') : document.getElementById('sug');

    if (user) {
      if (signinEl) { signinEl.hidden = true; signinEl.style.display = 'none'; }
      if (meEl) { meEl.hidden = false; meEl.style.display = 'inline-flex'; }
      const displayName = user.candidate_name || user.name || (user.candidate_email ? user.candidate_email.split('@')[0] : 'Candidate');
      const email = user.candidate_email || user.email || '';
      const initial = (displayName.charAt(0) || 'C').toUpperCase();
      if (meNameEl) meNameEl.textContent = displayName;
      if (meAvEl) meAvEl.textContent = initial;
      if (drawerAvEl) drawerAvEl.textContent = initial;
      if (drawerNameEl) drawerNameEl.textContent = displayName;
      if (drawerEmailEl) drawerEmailEl.textContent = email;
      if (secEl) { secEl.hidden = false; secEl.style.display = ''; }
      document.body.classList.add('has-sug');
    } else {
      if (signinEl) { signinEl.hidden = false; signinEl.style.display = ''; }
      if (meEl) { meEl.hidden = true; meEl.style.display = 'none'; }
      if (secEl) { secEl.hidden = true; secEl.style.display = 'none'; }
      if (drawerAvEl) drawerAvEl.textContent = 'C';
      if (drawerNameEl) drawerNameEl.textContent = 'Candidate';
      if (drawerEmailEl) drawerEmailEl.textContent = '';
      document.body.classList.remove('has-sug');
    }
  }, []);

  const handleCandidateAuthSuccess = useCallback((candidate) => {
    if (!candidate) return;
    syncCandidateProfileToLocal(candidate);
    try {
      const stored = JSON.parse(localStorage.getItem('tj-profile') || '{}');
      if (window.TJ && window.TJ.setAuth) {
        window.TJ.setAuth(stored);
      }
      updateHeaderAuthDOM(candidate);
    } catch (e) {}
  }, [syncCandidateProfileToLocal, updateHeaderAuthDOM]);

  // Mount engine once
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    document.body.classList.add('new-open-roles-active');

    const handleStartAiInterview = async ({ slug, title, company, roundId }) => {
      const cand = candidateAuthRef.current?.candidateUser || (() => {
        try { return JSON.parse(localStorage.getItem('candidate_profile_user') || '{}'); } catch (_) { return {}; }
      })();
      const candProfile = (() => {
        try { return JSON.parse(localStorage.getItem('tj-profile') || '{}'); } catch (_) { return {}; }
      })();

      const email = cand.candidate_email || cand.email || candProfile.email || 'candidate@termjobs.in';
      const name = cand.candidate_name || cand.name || candProfile.name || 'Candidate';

      if (roundId) {
        navigate(`/interview/ai/${roundId}?role=candidate&name=${encodeURIComponent(name)}`);
        return;
      }

      try {
        const res = await fetch('/api/interviews/candidate/attend-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, slug, title, company }),
        });
        const data = await res.json();
        if (data && data.meeting_link) {
          navigate(data.meeting_link);
        } else if (data && data.round_id) {
          navigate(`/interview/ai/${data.round_id}?role=candidate&name=${encodeURIComponent(name)}&token=${encodeURIComponent(data.candidate_token || '')}`);
        } else {
          navigate('/interview/candidate');
        }
      } catch (err) {
        console.error('Failed to start AI interview:', err);
        navigate('/interview/candidate');
      }
    };

    const unmountEngine = mountOpenRolesEngine(containerRef.current, {
      getCandidateUser: () => candidateAuthRef.current?.candidateUser,
      onOpenAuth: () => setShowAuthModal(true),
      onHomeClick: () => navigate('/'),
      onStartAiInterview: handleStartAiInterview,
      onLogout: () => {
        try {
          if (candidateAuthRef.current?.logout) candidateAuthRef.current.logout();
        } catch (e) {}
        try {
          localStorage.removeItem('tj-profile');
          localStorage.removeItem('candidate_profile_user');
          localStorage.removeItem('candidate_profile_token');
        } catch (e) {}
        if (window.TJ && window.TJ.setAuth) {
          window.TJ.setAuth(null);
        }
        updateHeaderAuthDOM(null);
      },
    });

    const handleInterceptClick = (e) => {
      const signinBtn = e.target.closest('#signin, [data-signin]');
      if (signinBtn) {
        e.preventDefault();
        setShowAuthModal(true);
        return;
      }
      const avBtn = e.target.closest('#av-trigger, #d-av-trigger, .profile-trigger-btn, .av-btn');
      if (avBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (window.TJ && window.TJ.toggleDrawer) window.TJ.toggleDrawer(avBtn);
        else if (window.TJ && window.TJ.openDrawer) window.TJ.openDrawer(avBtn);
        return;
      }
      const drawerCloseBtn = e.target.closest('#drawer-close, #profile-drawer-backdrop');
      if (drawerCloseBtn) {
        e.preventDefault();
        if (window.TJ && window.TJ.closeDrawer) window.TJ.closeDrawer();
        return;
      }
      const drawerViewProfile = e.target.closest('#drawer-view-profile');
      if (drawerViewProfile) {
        e.preventDefault();
        if (window.TJ && window.TJ.openProfile) window.TJ.openProfile();
        return;
      }
      const drawerEditPref = e.target.closest('#drawer-edit-pref');
      if (drawerEditPref) {
        e.preventDefault();
        if (window.TJ && window.TJ.closeDrawer) window.TJ.closeDrawer();
        if (window.TJ && window.TJ.openModal) window.TJ.openModal();
        return;
      }
      const drawerIvNav = e.target.closest('#drawer-interviews-nav');
      if (drawerIvNav) {
        e.preventDefault();
        if (window.TJ && window.TJ.closeDrawer) window.TJ.closeDrawer();
        const tab = document.querySelector('.tab[data-v="interview"]');
        if (tab) tab.click();
        return;
      }
      const signoutBtn = e.target.closest('#signout, #d-signout, #drawer-signout, #profile-side-logout, #profile-bar-logout');
      if (signoutBtn) {
        e.preventDefault();
        if (window.TJ && window.TJ.closeDrawer) window.TJ.closeDrawer();
        if (window.TJ && window.TJ.closeProfile) window.TJ.closeProfile();
        try {
          if (candidateAuthRef.current?.logout) candidateAuthRef.current.logout();
        } catch (e) {}
        try {
          localStorage.removeItem('tj-profile');
          localStorage.removeItem('candidate_profile_user');
          localStorage.removeItem('candidate_profile_token');
        } catch (e) {}
        if (window.TJ && window.TJ.setAuth) {
          window.TJ.setAuth(null);
        }
        updateHeaderAuthDOM(null);
        return;
      }
      const brandLink = e.target.closest('a.brand');
      if (brandLink) {
        if (brandLink.closest('#detail, #profile-page')) return;
        e.preventDefault();
        navigate('/');
        return;
      }
      const ivLink = e.target.closest('a[href^="/interview"]');
      if (ivLink) {
        e.preventDefault();
        const href = ivLink.getAttribute('href');
        if (href) navigate(href);
        return;
      }
      const aiBtn = e.target.closest('.iv-attend-ai, [data-start-ai]');
      if (aiBtn) {
        e.preventDefault();
        const slug = aiBtn.dataset.slug || '';
        const title = aiBtn.dataset.title || '';
        const company = aiBtn.dataset.company || '';
        const roundId = aiBtn.dataset.round || '';
        handleStartAiInterview({ slug, title, company, roundId });
        return;
      }
      const jumpRoles = e.target.closest('[data-jump="open-roles"]');
      if (jumpRoles) {
        e.preventDefault();
        document.body.classList.remove('show-saved', 'show-interview');
        document.body.classList.add('show-roles');
        const t = document.getElementById('open-roles');
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handleInterceptClick);
    }

    return () => {
      document.body.classList.remove(
        'new-open-roles-active',
        'has-sug',
        'show-roles',
        'show-saved',
        'show-interview',
        'sv-none',
        'iv-none',
        'detail',
        'on-profile'
      );
      if (container) {
        container.removeEventListener('click', handleInterceptClick);
      }
      if (typeof unmountEngine === 'function') {
        unmountEngine();
      }
    };
  }, [enabled, navigate, updateHeaderAuthDOM]);

  // Synchronize candidate user state changes with DOM & Engine
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    if (candidateUser) {
      syncCandidateProfileToLocal(candidateUser);
      try {
        const stored = JSON.parse(localStorage.getItem('tj-profile') || '{}');
        if (window.TJ && window.TJ.setAuth) {
          window.TJ.setAuth(stored);
        }
        if (window.TJ && window.TJ.drawInterviews) {
          window.TJ.drawInterviews();
        }
      } catch (e) {}
      updateHeaderAuthDOM(candidateUser);
    } else {
      const hasToken = Boolean(localStorage.getItem('candidate_profile_token'));
      if (!hasToken) {
        try {
          localStorage.removeItem('tj-profile');
          localStorage.removeItem('candidate_profile_user');
        } catch (e) {}
        if (window.TJ && window.TJ.setAuth) {
          window.TJ.setAuth(null);
        }
        updateHeaderAuthDOM(null);
      }
    }
  }, [candidateUser, enabled, syncCandidateProfileToLocal, updateHeaderAuthDOM]);

  return (
    <div className="new-open-roles-page min-h-screen relative overflow-x-hidden bg-paper text-ink">
      {/* Landing page background backdrop system */}
      <Backdrop active={enabled} fixed={false} />

      {enabled && (
        <SEOHead
          title="Open Roles – TermJobs"
          description="Explore high-impact contract and permanent opportunities on TermJobs. Match your skills, save roles, and apply directly."
          canonicalUrl="https://www.termjobs.in/open-roles"
        />
      )}

      <div
        ref={containerRef}
        className="new-open-roles-inner relative z-10"
        dangerouslySetInnerHTML={markup}
      />

      {/* Candidate Sign-In / Create Profile Authentication Modal */}
      <CandidateAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleCandidateAuthSuccess}
      />
    </div>
  );
}
