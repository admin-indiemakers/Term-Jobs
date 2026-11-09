import { loadOpenRolesPage } from '../utils/loadOpenRoles';
import { trackRoleView } from '../utils/trackRoleView';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseSlotToMinutes } from '../utils/interviewSchedule';
import { isAiInterviewRound } from '../interview/utils/interviewMode';
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Calendar,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Zap,
  Users,
  Rocket,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowLeft,
  Sparkles,
  FileText,
  Layers,
  Send,
  User,
  LogOut,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Edit3,
  Check,
  LogIn,
  Home,
  Video,
  Copy,
  MoreVertical,
  Code2,
  Bell,
  Bookmark,
  ChevronLeft,
  Share2,
  Star,
  GraduationCap,
  Activity,
} from 'lucide-react';
import { API_BASE_URL, request } from '../api/client';
import { marked } from 'marked';
import { useAuth } from '../context/AuthContext';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import SEOHead from '../components/SEOHead';
import ResumePreviewModal from '../components/ResumePreviewModal';
import ResumeUploadField from '../components/ResumeUploadField';
import CandidateEmailEditor from '../components/CandidateEmailEditor';
import CandidateOnboardingModal from '../components/CandidateOnboardingModal';
import { Backdrop } from '../components/landing/Backdrop';
import logo from '../assets/termjobs-logo.png';
import { formatDueDate } from '../utils/dateUtils';
import { validatePhone } from '../utils/phoneValidation';
import { validateCandidateEmail } from '../utils/candidateEmailValidation';
import { publicJobUrl } from '../utils/jobLinks';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '215468136876-3e4icbpr6blejlb9vibvecr6ck2tfm5g.apps.googleusercontent.com';
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Termjobs_alertbot';

function GoogleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.36 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

const COMPANY_LOGOS = {
  'little known planet': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="lkpPlanet" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2334D399"/><stop offset="50%" stop-color="%23059669"/><stop offset="100%" stop-color="%23064E3B"/></linearGradient><linearGradient id="lkpRing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2367E8F9" stop-opacity="0.9"/><stop offset="50%" stop-color="%2306B6D4" stop-opacity="0.6"/><stop offset="100%" stop-color="%230891B2" stop-opacity="0.2"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="%23061A14"/><ellipse cx="50" cy="52" rx="38" ry="14" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><circle cx="50" cy="52" r="23" fill="url(%23lkpPlanet)"/><path d="M 50 29 A 23 23 0 0 1 73 52 A 23 15 0 0 1 50 67 A 23 23 0 0 1 50 29 Z" fill="%23047857" opacity="0.4"/><path d="M 16 63 A 38 14 0 0 0 78 34" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><path d="M74 22 L76 26 L80 28 L76 30 L74 34 L72 30 L68 28 L72 26 Z" fill="%23A7F3D0"/><circle cx="28" cy="32" r="1.5" fill="%236EE7B7" opacity="0.8"/></svg>',
  'little known': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="lkpPlanet" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2334D399"/><stop offset="50%" stop-color="%23059669"/><stop offset="100%" stop-color="%23064E3B"/></linearGradient><linearGradient id="lkpRing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2367E8F9" stop-opacity="0.9"/><stop offset="50%" stop-color="%2306B6D4" stop-opacity="0.6"/><stop offset="100%" stop-color="%230891B2" stop-opacity="0.2"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="%23061A14"/><ellipse cx="50" cy="52" rx="38" ry="14" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><circle cx="50" cy="52" r="23" fill="url(%23lkpPlanet)"/><path d="M 50 29 A 23 23 0 0 1 73 52 A 23 15 0 0 1 50 67 A 23 23 0 0 1 50 29 Z" fill="%23047857" opacity="0.4"/><path d="M 16 63 A 38 14 0 0 0 78 34" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><path d="M74 22 L76 26 L80 28 L76 30 L74 34 L72 30 L68 28 L72 26 Z" fill="%23A7F3D0"/><circle cx="28" cy="32" r="1.5" fill="%236EE7B7" opacity="0.8"/></svg>',
  'lkp': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="lkpPlanet" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2334D399"/><stop offset="50%" stop-color="%23059669"/><stop offset="100%" stop-color="%23064E3B"/></linearGradient><linearGradient id="lkpRing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2367E8F9" stop-opacity="0.9"/><stop offset="50%" stop-color="%2306B6D4" stop-opacity="0.6"/><stop offset="100%" stop-color="%230891B2" stop-opacity="0.2"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="%23061A14"/><ellipse cx="50" cy="52" rx="38" ry="14" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><circle cx="50" cy="52" r="23" fill="url(%23lkpPlanet)"/><path d="M 50 29 A 23 23 0 0 1 73 52 A 23 15 0 0 1 50 67 A 23 23 0 0 1 50 29 Z" fill="%23047857" opacity="0.4"/><path d="M 16 63 A 38 14 0 0 0 78 34" fill="none" stroke="url(%23lkpRing)" stroke-width="3.5" transform="rotate(-25 50 52)"/><path d="M74 22 L76 26 L80 28 L76 30 L74 34 L72 30 L68 28 L72 26 Z" fill="%23A7F3D0"/><circle cx="28" cy="32" r="1.5" fill="%236EE7B7" opacity="0.8"/></svg>',
  'sign mart': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="smGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF3B30"/><stop offset="50%" stop-color="%23FF9500"/><stop offset="100%" stop-color="%23FFCC00"/></linearGradient><linearGradient id="smDark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231F1F24"/><stop offset="100%" stop-color="%230E0E11"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23smDark)"/><rect x="8" y="8" width="84" height="84" rx="16" fill="none" stroke="%23FF5E3A" stroke-width="1.5" opacity="0.25"/><path d="M68 26 H40 C32 26 26 32 26 40 C26 48 32 52 42 54 L58 57 C68 59 74 64 74 72 C74 80 68 86 58 86 H30" fill="none" stroke="url(%23smGrad)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="68" cy="26" r="3.5" fill="%23FFF"/><circle cx="30" cy="86" r="3.5" fill="%23FFF"/></svg>',
  'signmart': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="smGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF3B30"/><stop offset="50%" stop-color="%23FF9500"/><stop offset="100%" stop-color="%23FFCC00"/></linearGradient><linearGradient id="smDark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231F1F24"/><stop offset="100%" stop-color="%230E0E11"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23smDark)"/><rect x="8" y="8" width="84" height="84" rx="16" fill="none" stroke="%23FF5E3A" stroke-width="1.5" opacity="0.25"/><path d="M68 26 H40 C32 26 26 32 26 40 C26 48 32 52 42 54 L58 57 C68 59 74 64 74 72 C74 80 68 86 58 86 H30" fill="none" stroke="url(%23smGrad)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="68" cy="26" r="3.5" fill="%23FFF"/><circle cx="30" cy="86" r="3.5" fill="%23FFF"/></svg>',
  'dignmart': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="smGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF3B30"/><stop offset="50%" stop-color="%23FF9500"/><stop offset="100%" stop-color="%23FFCC00"/></linearGradient><linearGradient id="smDark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231F1F24"/><stop offset="100%" stop-color="%230E0E11"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23smDark)"/><rect x="8" y="8" width="84" height="84" rx="16" fill="none" stroke="%23FF5E3A" stroke-width="1.5" opacity="0.25"/><path d="M68 26 H40 C32 26 26 32 26 40 C26 48 32 52 42 54 L58 57 C68 59 74 64 74 72 C74 80 68 86 58 86 H30" fill="none" stroke="url(%23smGrad)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="68" cy="26" r="3.5" fill="%23FFF"/><circle cx="30" cy="86" r="3.5" fill="%23FFF"/></svg>',
  'aethanalytica': 'https://aethanalytica.com/images/aeth_analytica.svg',
  'zensbee': 'https://www.google.com/s2/favicons?domain=zensbee.com&sz=128',
  'hivenesthq': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92"><path d="M69.54,39.28 L50.00,50.56 L30.46,39.28 L30.46,16.72 L50.00,5.44 L69.54,16.72Z" fill="%23ff6106"/><path d="M48.75,75.28 L29.22,86.56 L9.68,75.28 L9.68,52.72 L29.22,41.44 L48.75,52.72Z" fill="%23ffffff"/><path d="M90.32,75.28 L70.78,86.56 L51.25,75.28 L51.25,52.72 L70.78,41.44 L90.32,52.72Z" fill="%23ff6106"/></svg>',
  'hivenest': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92"><path d="M69.54,39.28 L50.00,50.56 L30.46,39.28 L30.46,16.72 L50.00,5.44 L69.54,16.72Z" fill="%23ff6106"/><path d="M48.75,75.28 L29.22,86.56 L9.68,75.28 L9.68,52.72 L29.22,41.44 L48.75,52.72Z" fill="%23ffffff"/><path d="M90.32,75.28 L70.78,86.56 L51.25,75.28 L51.25,52.72 L70.78,41.44 L90.32,52.72Z" fill="%23ff6106"/></svg>',
  'easy entrance': 'https://www.google.com/s2/favicons?domain=eepinnovations.com&sz=128',
  'nifama': 'https://nifama.com/wp-content/uploads/2025/05/nifama-circle.webp',
  'smart moves': 'https://smartmoves.co.in/wp-content/uploads/2026/03/smlogosm.png',
  'element 8': 'https://api.element8.ae/wp-content/uploads/2024/02/e8-logo-white.svg',
  'element8': 'https://api.element8.ae/wp-content/uploads/2024/02/e8-logo-white.svg',
  'acura': 'https://acurasolution.com/assets/frontend/img/acura/acura-logo.png',
  'kone': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 198"><path fill="%231450F5" d="M0 0h37.4v80.2L91.4 0H138l-65 92.9 69.2 105.1h-47l-46.8-74.4-10 14.7v59.7H0V0zm168.3 0h37.4v198h-37.4V0zm74.7 0h37.4v198h-37.4V0zm115.8 0c41.3 0 71.6 30.3 71.6 74.3v49.4c0 44-30.3 74.3-71.6 74.3h-53.1V0h53.1zm-15.7 34.2v129.6h15.7c22.3 0 34.2-15.1 34.2-64.8s-11.9-64.8-34.2-64.8h-15.7z"/></svg>',
  'skybook': 'https://cdn-ildbpmf.nitrocdn.com/lCVcGRMJHpdBAcriZZeZQDmoipVlbUzC/assets/images/optimized/rev-5664630/skybookglobal.com/wp-content/uploads/2025/01/skybook-global-logo.png',
  'techbrein': 'https://www.google.com/s2/favicons?domain=techbrein.com&sz=128',
  'zoobie': 'https://www.google.com/s2/favicons?domain=zoobies.com&sz=128',
  'heylearn': 'https://heylearnacademy.com/wp-content/uploads/2026/07/hey-learn-logo.png',
  'axel': 'https://axeltechnologies.com/assets/axel-logo-hero-nobg-Diakrs67.png',
  'mailercloud': 'https://www.mailercloud.com/img/brand/mailercloud-logo.svg',
  '4dots': 'https://www.google.com/s2/favicons?domain=4dots.in&sz=128',
  'asimovx': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxvZ29HcmFkaWVudCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MDMzRkY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I0Q5NDZFRjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxnIHN0cm9rZT0idXJsKCNsb2dvR3JhZGllbnQpIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSI+CiAgICAKICAgIDwhLS0gUGVyaW1ldGVyIENoZXZyb25zIC0tPgogICAgPHBhdGggZD0iTTUwLDEwIEw4NC42NCwzMCIgLz4gPCEtLSBUb3AgdG8gVG9wUmlnaHQgLS0+CiAgICA8cGF0aCBkPSJNNTAsMTAgTDE1LjM2LDMwIiAvPiA8IS0tIFRvcCB0byBUb3BMZWZ0IC0tPgogICAgPHBhdGggZD0iTTUwLDkwIEw4NC42NCw3MCIgLz4gPCEtLSBCb3QgdG8gQm90UmlnaHQgLS0+CiAgICA8cGF0aCBkPSJNNTAsOTAgTDE1LjM2LDcwIiAvPiA8IS0tIEJvdCB0byBCb3RMZWZ0IC0tPgoKICAgIDwhLS0gVmVydGljYWwgQ2VudGVyIEF4aXMgLS0+CiAgICA8cGF0aCBkPSJNNTAsMTAgTDUwLDkwIiAvPgoKICAgIDwhLS0gQ2VudGVyIFggU3Bva2VzIChDb25uZWN0aW5nIENlbnRlciB0byBDb3JuZXJzKSAtLT4KICAgIDxwYXRoIGQ9Ik01MCw1MCBMODQuNjQsMzAiIC8+IDwhLS0gQ2VudGVyIHRvIFRvcFJpZ2h0IC0tPgogICAgPHBhdGggZD0iTTUwLDUwIEwxNS4zNiwzMCIgLz4gPCEtLSBDZW50ZXIgdG8gVG9wTGVmdCAtLT4KICAgIDxwYXRoIGQ9Ik01MCw1MCBMODQuNjQsNzAiIC8+IDwhLS0gQ2VudGVyIHRvIEJvdFJpZ2h0IC0tPgogICAgPHBhdGggZD0iTTUwLDUwIEwxNS4zNiw3MCIgLz4gPCEtLSBDZW50ZXIgdG8gQm90TGVmdCAtLT4KICAgIAogICAgPCEtLSBMb25nIERpYWdvbmFscyAoUmVxdWVzdGVkIEFkZGl0aW9ucykgLS0+CiAgICA8cGF0aCBkPSJNNTAsMTAgTDE1LjM2LDcwIiAvPiA8IS0tIFRvcCB0byBCb3RMZWZ0IC0tPgogICAgPHBhdGggZD0iTTUwLDEwIEw4NC42NCw3MCIgLz4gPCEtLSBUb3AgdG8gQm90UmlnaHQgLS0+CiAgICA8cGF0aCBkPSJNNTAsOTAgTDE1LjM2LDMwIiAvPiA8IS0tIEJvdCB0byBCb3RMZWZ0IC0tPgogICAgPHBhdGggZD0iTTUwLDkwIEw4NC42NCwzMCIgLz4gPCEtLSBCb3QgdG8gQm90UmlnaHQgLS0+CgogICAgPCEtLSBOb2RlcyB3aXRoIGhvbGVzIChmaWxsZWQgYmxhY2spIC0tPgogICAgPGcgZmlsbD0iIzAwMDAwMCIgc3Ryb2tlPSJ1cmwoI2xvZ29HcmFkaWVudCIgc3Ryb2tlLXdpZHRoPSI0Ij4KICAgICAgPGNpcmNsZSBjeD0iNTAiIGN5PSIxMCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iODQuNjQiIGN5PSIzMCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iODQuNjQiIGN5PSI3MCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iNTAiIGN5PSI5MCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iMTUuMzYiIGN5PSI3MCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iMTUuMzYiIGN5PSIzMCIgcj0iNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNSIgLz4KICAgIDwvZz4KICA8L2c+Cjwvc3ZnPg=='
};

function getCompanyLogoUrl(job) {
  if (!job) return null;
  if (job.company_logo || job.logo || job.company_logo_url) {
    return job.company_logo || job.logo || job.company_logo_url;
  }
  const name = (job.company_name || job.company || '').toLowerCase().trim();
  for (const [key, url] of Object.entries(COMPANY_LOGOS)) {
    if (name.includes(key)) return url;
  }
  return null;
}

function CompanyAvatar({ job, size = 'w-8 h-8', className = '', inModal = false }) {
  const compName = (job?.company_name || job?.company || '').trim();
  const companyInitial = (compName || job?.title || 'R').slice(0, 1).toUpperCase();
  const logoUrl = getCompanyLogoUrl(job);

  return (
    <div
      className={`${size} flex items-center justify-center shrink-0 overflow-hidden ${
        inModal
          ? 'bg-neutral-100 rounded-lg p-1 border border-neutral-200'
          : 'bg-transparent p-0.5'
      } ${className}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={compName}
          className="w-full h-full object-contain filter drop-shadow-sm"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              e.currentTarget.nextElementSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span
        style={{ display: logoUrl ? 'none' : 'flex' }}
        className={`w-full h-full items-center justify-center font-extrabold text-xs select-none rounded-lg ${
          inModal ? 'text-neutral-900 bg-neutral-200' : 'text-white bg-white/10'
        }`}
      >
        {companyInitial}
      </span>
    </div>
  );
}

export function getJobDepartment(job) {
  if (!job) return 'General';
  const explicit = (job.department || job.structured_role?.department || job.dept || '').trim();
  if (explicit && explicit.toLowerCase() !== 'general' && explicit.toLowerCase() !== 'other') {
    return explicit;
  }

  const fam = (job.job_family || job.structured_role?.job_family || '').trim();
  if (fam && fam.toLowerCase() !== 'general' && fam.toLowerCase() !== 'other') {
    return fam;
  }

  const title = (job.title || '').toLowerCase();

  if (
    title.includes('research') ||
    title.includes('travel') ||
    title.includes('content discovery')
  ) {
    return 'Research & Content';
  }
  if (
    title.includes('designer') ||
    title.includes('ui/ux') ||
    title.includes('ui / ux') ||
    title.includes('ux designer') ||
    title.includes('product design')
  ) {
    return 'Design & UI/UX';
  }
  if (
    title.includes('qa') ||
    title.includes('test') ||
    title.includes('tester') ||
    title.includes('quality assurance')
  ) {
    return 'Quality Assurance';
  }
  if (
    title.includes('devops') ||
    title.includes('sre') ||
    title.includes('cloud') ||
    title.includes('infrastructure')
  ) {
    return 'DevOps & Cloud';
  }
  if (
    title.includes('sales') ||
    title.includes('business development') ||
    title.includes('business dev') ||
    title.includes('bdm') ||
    title.includes('bde') ||
    title.includes('consultant')
  ) {
    return 'Sales & BD';
  }
  if (
    title.includes('marketing') ||
    title.includes('growth') ||
    title.includes('seo') ||
    title.includes('content')
  ) {
    return 'Marketing';
  }
  if (
    title.includes('human resource') ||
    title.includes('hr ') ||
    title.startsWith('hr') ||
    title.includes('recruiter') ||
    title.includes('talent')
  ) {
    return 'Human Resources';
  }
  if (
    title.includes('service') ||
    title.includes('operations') ||
    title.includes('maintenance') ||
    title.includes('field engineer')
  ) {
    return 'Operations & Service';
  }
  if (
    title.includes('developer') ||
    title.includes('engineer') ||
    title.includes('software') ||
    title.includes('frontend') ||
    title.includes('front end') ||
    title.includes('backend') ||
    title.includes('full stack') ||
    title.includes('fullstack') ||
    title.includes('web') ||
    title.includes('mobile') ||
    title.includes('flutter')
  ) {
    return 'Engineering';
  }
  return 'General';
}

export function matchesExperience(job, selectedExp) {
  if (!selectedExp || selectedExp === 'ALL') return true;
  const role = job?.structured_role || {};
  const expStr = (role.experience || job?.experience_level || job?.experience || '').toLowerCase();
  const minExp = job?.min_experience;
  const maxExp = job?.max_experience;

  if (selectedExp === 'ENTRY') {
    if (minExp !== undefined && minExp <= 1) return true;
    return (
      expStr.includes('fresher') ||
      expStr.includes('0–1') ||
      expStr.includes('0-1') ||
      expStr.includes('0–2') ||
      expStr.includes('0-2') ||
      expStr.includes('entry') ||
      expStr.includes('junior')
    );
  }
  if (selectedExp === 'JUNIOR') {
    if (minExp !== undefined && minExp <= 3 && (maxExp === undefined || maxExp >= 1)) return true;
    return (
      expStr.includes('1+') ||
      expStr.includes('1-') ||
      expStr.includes('1–') ||
      expStr.includes('2–') ||
      expStr.includes('2-') ||
      expStr.includes('2+') ||
      expStr.includes('0–2') ||
      expStr.includes('0-2') ||
      expStr.includes('junior') ||
      expStr.includes('entry')
    );
  }
  if (selectedExp === 'MID') {
    if (minExp !== undefined && minExp >= 2 && minExp <= 5) return true;
    return (
      expStr.includes('mid') ||
      expStr.includes('2–4') ||
      expStr.includes('2-4') ||
      expStr.includes('3–5') ||
      expStr.includes('3-5') ||
      expStr.includes('3 – 6') ||
      expStr.includes('3-6') ||
      expStr.includes('3+') ||
      expStr.includes('2.5')
    );
  }
  if (selectedExp === 'SENIOR') {
    if (minExp !== undefined && minExp >= 5) return true;
    return (
      expStr.includes('senior') ||
      expStr.includes('5+') ||
      expStr.includes('5–') ||
      expStr.includes('5-') ||
      expStr.includes('6')
    );
  }
  return true;
}

export function matchesSearch(text, query) {
  if (!text || !query) return false;
  const str = String(text);
  const rawQ = query.trim();
  if (!rawQ) return false;
  const escaped = rawQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordStart = /^[a-zA-Z0-9_]/.test(rawQ) ? '\\b' : '(^|[^a-zA-Z0-9_])';
  return new RegExp(`${wordStart}${escaped}`, 'i').test(str);
}

function FilterDropdown({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  className = '',
  menuWidth = 'w-52',
  align = 'left',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : label;
  const isFiltered = value !== 'ALL';

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer select-none border ${
          isFiltered
            ? 'bg-white/10 border-white/30 text-white shadow-sm'
            : isOpen
            ? 'bg-white/[0.08] border-white/25 text-white'
            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 text-white/90'
        }`}
      >
        {Icon && (
          <Icon
            size={12}
            className={`shrink-0 ${isFiltered ? 'text-white' : 'text-neutral-400'}`}
          />
        )}
        <span className="truncate max-w-[125px]">{displayLabel}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 text-neutral-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } z-50 ${menuWidth} py-1.5 rounded-xl bg-[#0f1117]/95 backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto scrollbar-thin`}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="truncate">{opt.label}</span>
                  {typeof opt.count === 'number' && (
                    <span
                      className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-mono ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.06] text-neutral-400'
                      }`}
                    >
                      {opt.count}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={11} className="text-white shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OpenRolesPage({ enabled = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const candidateAuth = useCandidateAuth();
  const candidateUser = candidateAuth?.candidateUser;
  const applications = candidateAuth?.applications || [];
  const outreachHistory = candidateAuth?.outreachHistory || [];
  const logout = candidateAuth?.logout;
  const refreshProfile = candidateAuth?.refreshProfile;
  const setupProfile = candidateAuth?.setupProfile;
  const loginWithGoogle = candidateAuth?.loginWithGoogle;
  const login = candidateAuth?.login;
  const register = candidateAuth?.register;
  const completeOnboarding = candidateAuth?.completeOnboarding;

  const isCandidateAuthenticated = Boolean(candidateAuth?.candidateToken && candidateUser);
  const candidateEmail = (candidateUser?.candidate_email || candidateUser?.email || '').trim().toLowerCase();
  const appliedStorageKey = candidateEmail ? `tj_applied_jobs_${candidateEmail}` : null;

  // Recruiter / Admin / Staff exclusion check: never show candidate onboarding to recruiters or admins
  let internalUser = null;
  try {
    const authCtx = useAuth();
    internalUser = authCtx?.user;
  } catch {}
  if (!internalUser) {
    try {
      const saved = localStorage.getItem('auth_user');
      if (saved) internalUser = JSON.parse(saved);
    } catch {}
  }
  const isStaffOrAdmin = Boolean(
    internalUser && (
      internalUser.role === 'Admin' ||
      internalUser.role === 'Super Admin' ||
      internalUser.role === 'Hiring Manager' ||
      internalUser.role === 'Recruiter' ||
      internalUser.role === 'HR'
    )
  );

  // Candidate Onboarding State
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingAutoApplyJob, setPendingAutoApplyJob] = useState(null);
  const [dismissedSessionOnboarding, setDismissedSessionOnboarding] = useState(false);

  // Candidate in-app outreach & interview notifications
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [respondingOutreachToken, setRespondingOutreachToken] = useState(null);
  const [outreachActionStatus, setOutreachActionStatus] = useState({});

  const handleOutreachRsvp = useCallback(async (token, action = 'interested') => {
    if (!token) return;
    setRespondingOutreachToken(token);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/outreach/${token}/respond?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setOutreachActionStatus((prev) => ({
          ...prev,
          [token]: {
            action,
            meeting_link: data.meeting_link,
            passcode: data.candidate_passcode || 'TJ-FAST-TRACK',
            success: true,
          },
        }));
        if (refreshProfile) refreshProfile();
        if (typeof loadCandidateInterviews === 'function') loadCandidateInterviews();
      } else {
        setOutreachActionStatus((prev) => ({
          ...prev,
          [token]: { error: data.error || 'Failed to record response.' },
        }));
      }
    } catch (err) {
      console.error('Error submitting outreach RSVP:', err);
      setOutreachActionStatus((prev) => ({
        ...prev,
        [token]: { error: 'Network error submitting response.' },
      }));
    } finally {
      setRespondingOutreachToken(null);
    }
  }, [refreshProfile]);

  // Jobs must come from the current backend, never an unverified legacy cache.
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkMode, setSelectedWorkMode] = useState('ALL');
  const [selectedFamily, setSelectedFamily] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedExperience, setSelectedExperience] = useState('ALL');
  const [selectedOpportunityCategory, setSelectedOpportunityCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [rolePage, setRolePage] = useState({ total: 0, total_pages: 1, filtered_total: 0, categories: [], filters: { families: [], locations: [] }, stats: { roles: 0, companies: 0 } });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const rolesPrefetch = useRef(undefined);
  useEffect(() => {
    if (searchQuery.trim() === debouncedSearch) return;
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery.trim()); setCurrentPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);
  const [savedJobIds, setSavedJobIds] = useState(() => {
    try {
      const saved = localStorage.getItem('tj_saved_jobs');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (_) {
      return new Set();
    }
  });

  const toggleSaveJob = useCallback((jobId, e) => {
    if (e) e.stopPropagation();
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      const key = String(jobId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('tj_saved_jobs', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  }, []);

  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const sharedRoleOpened = useRef(false);
  const viewedJobId = selectedJob?.id;
  const viewerToken = candidateAuth?.candidateToken;
  useEffect(() => {
    if (!viewedJobId) return;
    // Analytics failure must not prevent reading or applying to a role.
    trackRoleView(API_BASE_URL, viewedJobId, viewerToken).catch(() => {});
  }, [viewedJobId, viewerToken]);
  const [modalActiveTab, setModalActiveTab] = useState('job_details');
  const [expandedSections, setExpandedSections] = useState({
    company: false,
    role: true,
    responsibilities: false,
    qualifications: false,
    skills: false,
    employment: false,
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMyAppsModal, setShowMyAppsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showGeneralPoolModal, setShowGeneralPoolModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('home');

  // Candidate agreements & offer letter state
  const [candidateAgreements, setCandidateAgreements] = useState([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [signingAgreement, setSigningAgreement] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureAgreed, setSignatureAgreed] = useState(false);
  const [signSuccessMessage, setSignSuccessMessage] = useState('');
  const [agreementLookupEmail, setAgreementLookupEmail] = useState('');

  const loadCandidateAgreements = useCallback(async (customEmail = null) => {
    setLoadingAgreements(true);
    try {
      let email = (customEmail || agreementLookupEmail || candidateUser?.candidate_email || candidateUser?.email || '').trim();
      if (!email) {
        try {
          const storedUser = JSON.parse(localStorage.getItem('candidate_profile_user') || '{}');
          email = (storedUser?.candidate_email || storedUser?.email || localStorage.getItem('candidate_email') || '').trim();
        } catch (_) { }
      }
      if (!email) {
        const urlParams = new URLSearchParams(window.location.search);
        email = (urlParams.get('email') || '').trim();
      }
      if (!email) {
        setCandidateAgreements([]);
        setLoadingAgreements(false);
        return;
      }
      if (email && !agreementLookupEmail) {
        setAgreementLookupEmail(email);
      }
      const cid = candidateUser?.id || candidateUser?.candidate_id || '';
      const token = candidateAuth?.candidateToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (cid) params.append('candidate_id', cid);
      const res = await fetch(`${API_BASE_URL}/api/candidate-profile/agreements?${params.toString()}`, { headers });
      const data = await res.json();
      if (Array.isArray(data.agreements) && data.agreements.length > 0) {
        setCandidateAgreements(data.agreements);
      } else {
        setCandidateAgreements([]);
      }
    } catch (err) {
      console.error('Failed to load candidate agreements:', err);
      setCandidateAgreements([]);
    } finally {
      setLoadingAgreements(false);
    }
  }, [candidateUser, candidateAuth, agreementLookupEmail]);

  useEffect(() => {
    if (showAgreementModal) {
      loadCandidateAgreements();
    }
  }, [showAgreementModal]);

  // Candidate scheduled interviews state
  const [candidateInterviews, setCandidateInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState(null);
  const [emailSentStatus, setEmailSentStatus] = useState({});
  const [copiedRoundId, setCopiedRoundId] = useState(null);
  const [activeMenuRoundId, setActiveMenuRoundId] = useState(null);
  const [selectedDetailRound, setSelectedDetailRound] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.interview-card-menu')) {
        setActiveMenuRoundId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyMeetingLink = (round) => {
    if (!round) return;
    const name = encodeURIComponent(
      candidateUser?.candidate_name || round.candidate_name || 'Candidate'
    );
    const isAi = round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai'));
    const path = isAi ? 'ai' : 'room';
    const link = round.meeting_link || `${window.location.origin}/interview/${path}/${round.id}?role=candidate&name=${name}&token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedRoundId(round.id);
    setTimeout(() => setCopiedRoundId(null), 2500);
  };

  const handleAddToCalendar = (round) => {
    if (!round) return;
    if (round.calendar_sync?.event_url) {
      window.open(round.calendar_sync.event_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const title = encodeURIComponent(`${round.round_name || 'Interview'} - ${round.company_name || 'Bearitt'} (${round.requisition_title || 'Position'})`);
    const details = encodeURIComponent(
      `Interview with ${round.company_name || 'Bearitt'} for ${round.requisition_title || 'Position'}.\nRound: ${round.round_name || 'Interview Round'}\nMeeting link: ${round.meeting_link || window.location.origin + '/interview/room/' + round.id}\nPasscode: ${round.candidate_passcode || ''}`
    );
    const dateStr = round.scheduled_date ? round.scheduled_date.replace(/-/g, '') : '';
    const timeMatch = round.scheduled_time?.match(/^(\d{1,2}):(\d{2})/);
    let datesParam = '';
    if (dateStr && timeMatch) {
      const hh = timeMatch[1].padStart(2, '0');
      const mm = timeMatch[2];
      const startIso = `${dateStr}T${hh}${mm}00`;
      const dur = Number(round.duration_minutes) || 45;
      const endMinutesTotal = parseInt(hh, 10) * 60 + parseInt(mm, 10) + dur;
      const endHh = String(Math.floor(endMinutesTotal / 60) % 24).padStart(2, '0');
      const endMm = String(endMinutesTotal % 60).padStart(2, '0');
      const endIso = `${dateStr}T${endHh}${endMm}00`;
      datesParam = `&dates=${startIso}/${endIso}`;
    }
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}${datesParam}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const loadCandidateInterviews = useCallback(async (customEmail = null) => {
    try {
      if (!candidateUser && !customEmail) {
        setCandidateInterviews([]);
        return;
      }
      const email = (
        customEmail ||
        candidateUser?.candidate_email ||
        candidateUser?.email ||
        candidateUser?.details?.candidate_email ||
        ''
      ).trim().toLowerCase();

      if (!email) {
        setCandidateInterviews([]);
        return;
      }
      setLoadingInterviews(true);
      const token = candidateAuth?.candidateToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/interviews/candidate/portal?email=${encodeURIComponent(email)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const rounds = Array.isArray(data.rounds) ? data.rounds : [];
        const candId = (candidateUser?.id || candidateUser?.candidate_id || '').toLowerCase();
        // Strictly isolate interviews to this candidate's account only
        const userRounds = rounds.filter((r) => {
          const rEmail = (r.candidate_email || r.email || '').trim().toLowerCase();
          const rCandId = (r.candidate_id || '').trim().toLowerCase();
          if (rEmail && rEmail === email) return true;
          if (candId && rCandId && rCandId === candId) return true;
          return !rEmail && !rCandId;
        });
        setCandidateInterviews(userRounds);
      } else {
        setCandidateInterviews([]);
      }
    } catch (err) {
      console.error('Failed to load candidate interviews:', err);
      setCandidateInterviews([]);
    } finally {
      setLoadingInterviews(false);
    }
  }, [candidateUser, candidateAuth]);

  useEffect(() => {
    if (candidateUser) {
      loadCandidateInterviews();
    } else {
      setCandidateInterviews([]);
    }
  }, [candidateUser, loadCandidateInterviews]);

  const [isInterviewViewOpen, setIsInterviewViewOpen] = useState(false);
  const [showCandidateMenu, setShowCandidateMenu] = useState(false);
  const [interviewFilterTab, setInterviewFilterTab] = useState('all');
  const [interviewSearch, setInterviewSearch] = useState('');
  const [interviewSortAsc, setInterviewSortAsc] = useState(true);

  useEffect(() => {
    if (isInterviewViewOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (candidateUser && typeof loadCandidateInterviews === 'function') {
        loadCandidateInterviews();
      }
    }
  }, [isInterviewViewOpen, candidateUser, loadCandidateInterviews]);

  // Parse date helper for cards badge (e.g. OCT 16 THU)
  const parseInterviewDateBadge = (dateStr) => {
    if (!dateStr) return { month: 'OCT', day: '16', dayOfWeek: 'THU' };
    try {
      const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) {
        const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = d.getDate().toString().padStart(2, '0');
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        return { month, day, dayOfWeek };
      }
    } catch (_) {}
    return { month: 'OCT', day: '16', dayOfWeek: 'THU' };
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(normalized);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diffTime = d.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (_) {
      return 0;
    }
  };

  // Helper to parse interview start and end Date objects accurately
  const getInterviewWindow = (scheduledDate, scheduledTime, duration = 45) => {
    if (!scheduledDate) return null;
    try {
      const normalized = scheduledDate.includes('T') ? scheduledDate.split('T')[0] : scheduledDate;
      const startMin = parseSlotToMinutes(scheduledTime) ?? 540;
      const durMins = Number(duration) || 45;

      const [y, m, d] = normalized.split('-').map(Number);
      if (!y || !m || !d) return null;

      const startDate = new Date(y, m - 1, d, Math.floor(startMin / 60), startMin % 60, 0);
      const endDate = new Date(startDate.getTime() + durMins * 60 * 1000);

      return { startDate, endDate, durMins };
    } catch (_) {
      return null;
    }
  };

  // Parse time details into separate range and duration strings
  const parseTimeDetails = (timeStr, duration = 45) => {
    const durMins = Number(duration) || 45;
    if (!timeStr) {
      return { range: '09:30 AM – 10:15 AM', duration: `${durMins} minutes` };
    }
    if (timeStr.toLowerCase().includes('immediate') || timeStr.toLowerCase().includes('demand')) {
      return { range: 'Immediate / On-Demand', duration: `${durMins} minutes` };
    }
    const startMinutes = parseSlotToMinutes(timeStr);
    if (startMinutes !== null) {
      const startH = Math.floor(startMinutes / 60) % 24;
      const startM = startMinutes % 60;
      const startPeriod = startH >= 12 ? 'PM' : 'AM';
      const displayStartH = startH % 12 === 0 ? 12 : startH % 12;
      const startFormatted = `${String(displayStartH).padStart(2, '0')}:${String(startM).padStart(2, '0')} ${startPeriod}`;

      const totalMinutes = startMinutes + durMins;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const endPeriod = endH >= 12 ? 'PM' : 'AM';
      const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
      const endFormatted = `${String(displayEndH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endPeriod}`;

      return {
        range: `${startFormatted} – ${endFormatted}`,
        duration: `${durMins} minutes`,
      };
    }
    return {
      range: timeStr,
      duration: `${durMins} minutes`,
    };
  };

  const getRoundTypeConfig = (roundName = '', roundNumber = 1) => {
    const nameLower = (roundName || '').toLowerCase();
    if (nameLower.includes('hr')) {
      return {
        category: 'HR Interview',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#15253b] text-[#38bdf8] border-[#38bdf8]/30',
        iconBoxStyle: 'bg-[#132d4b] text-[#38bdf8] border-[#38bdf8]/20',
        icon: Users,
      };
    }
    if (nameLower.includes('tech') || nameLower.includes('screen') || nameLower.includes('code')) {
      return {
        category: 'Technical',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#251838] text-[#c084fc] border-[#c084fc]/30',
        iconBoxStyle: 'bg-[#28153d] text-[#c084fc] border-[#c084fc]/20',
        icon: Code2,
      };
    }
    if (nameLower.includes('manager') || nameLower.includes('lead') || nameLower.includes('director')) {
      return {
        category: 'Managerial',
        roundPill: `Round ${roundNumber}`,
        pillStyle: 'bg-[#2c1d0f] text-[#fbbf24] border-[#fbbf24]/30',
        iconBoxStyle: 'bg-[#33200b] text-[#fbbf24] border-[#fbbf24]/20',
        icon: ShieldCheck,
      };
    }
    return {
      category: 'AI Assessment',
      roundPill: `Round ${roundNumber}`,
      pillStyle: 'bg-[#0d272b] text-[#2dd4bf] border-[#2dd4bf]/30',
      iconBoxStyle: 'bg-[#0e2a2f] text-[#2dd4bf] border-[#2dd4bf]/20',
      icon: Sparkles,
    };
  };

  const getStatusBadgeInfo = (round, windowInfo, isLiveNow, isCompleted, isCancelled, isAiOnDemand) => {
    if (isCancelled) {
      return {
        text: 'Cancelled',
        icon: '✕',
        style: 'text-rose-400 bg-rose-950/40 border-rose-500/30',
      };
    }
    if (isCompleted) {
      return {
        text: 'Completed',
        icon: '✓',
        style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
      };
    }
    if (isLiveNow) {
      return {
        text: 'Live Now',
        icon: '✦',
        style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40 animate-pulse',
      };
    }
    if (isAiOnDemand) {
      return {
        text: 'Available Now',
        icon: '✦',
        style: 'text-teal-400 bg-teal-950/50 border-teal-500/40',
      };
    }
    if (windowInfo?.endDate && new Date() > windowInfo.endDate) {
      return {
        text: 'Window ended',
        icon: '◷',
        style: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
      };
    }
    if (windowInfo?.startDate) {
      const now = new Date();
      const diffMs = windowInfo.startDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes <= 15) {
        return {
          text: diffMinutes > 0 ? `Starts in ${diffMinutes} mins` : 'Starting soon',
          icon: '✦',
          style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40 animate-pulse',
        };
      }
      if (diffMinutes < 60) {
        return {
          text: `Starts in ${diffMinutes} mins`,
          icon: '✦',
          style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40',
        };
      }
      if (diffHours < 24) {
        const remMins = diffMinutes % 60;
        let timeText = `Starts in ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
        if (diffHours < 4 && remMins > 0) {
          timeText = `Starts in ${diffHours}h ${remMins}m`;
        } else if (diffHours >= 4 && remMins >= 30) {
          timeText = `Starts in ${diffHours + 1} hours`;
        }
        return {
          text: timeText,
          icon: '✦',
          style: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/40',
        };
      }
      if (diffDays === 1 || (diffHours < 48 && windowInfo.startDate.getDate() === now.getDate() + 1)) {
        return {
          text: 'Tomorrow',
          icon: '✦',
          style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
        };
      }
      return {
        text: `In ${diffDays} days`,
        icon: '✦',
        style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
      };
    }
    return {
      text: 'Scheduled',
      icon: '✦',
      style: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
    };
  };

  // Check URL params for ?tab=interview
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'interview') {
      setIsInterviewViewOpen(true);
      setActiveNavTab('interview');
      const emailParam = params.get('email');
      if (emailParam) {
        loadCandidateInterviews(emailParam);
      }
    }
  }, [location.search, loadCandidateInterviews]);

  // Pure real candidate interview rounds from backend API
  const allCandidateInterviewRounds = useMemo(() => {
    const list = Array.isArray(candidateInterviews) ? candidateInterviews : [];
    if (list.length === 0) return [];

    const now = new Date();

    return list.map((round) => {
      const isCancelled = round.status === 'Cancelled' || round.status === 'Rejected';
      const isExplicitCompleted = round.status === 'Completed' || round.status === 'Evaluated';
      const isAiOnDemand = isAiInterviewRound(round);
      const isManualLive = round.status === 'In Progress' || round.status === 'Live';

      const windowInfo = getInterviewWindow(round.scheduled_date, round.scheduled_time, round.duration_minutes || 45);
      const startDate = windowInfo?.startDate;
      const endDate = windowInfo?.endDate;

      // Is interview currently live?
      const isLiveNow = !isCancelled && !isExplicitCompleted && (
        isManualLive ||
        (startDate && endDate && now.getTime() >= (startDate.getTime() - 10 * 60 * 1000) && now.getTime() <= endDate.getTime())
      );

      // Final status category: Cancelled, Completed, or Upcoming
      let finalStatus = 'Upcoming';
      if (isCancelled) {
        finalStatus = 'Cancelled';
      } else if (isExplicitCompleted) {
        finalStatus = 'Completed';
      } else {
        finalStatus = 'Upcoming';
      }

      const isCompleted = finalStatus === 'Completed';

      // Can candidate enter right now?
      // - AI on demand: always ready unless completed
      // - Live interviews: ready within 15 mins before start until end
      const canEnter = !isCancelled && !isCompleted && (
        isAiOnDemand ||
        isLiveNow ||
        (startDate && endDate && now.getTime() >= (startDate.getTime() - 15 * 60 * 1000) && now.getTime() <= endDate.getTime())
      );

      const statusBadge = getStatusBadgeInfo(round, windowInfo, isLiveNow, isCompleted, isCancelled, isAiOnDemand);
      const badge = parseInterviewDateBadge(round.scheduled_date);

      // Match requisition for company name and info if not already in round
      const matchingReq = Array.isArray(requisitions)
        ? requisitions.find((rq) => rq.id === round.requisition_id || (rq.title && round.requisition_title && rq.title.toLowerCase() === round.requisition_title.toLowerCase()))
        : null;

      const companyName = round.company_name || matchingReq?.company_name || 'Bearitt';
      const companyLogoLetter = (companyName || 'B').slice(0, 1).toUpperCase();

      const normalizedDate = round.scheduled_date?.includes('T') ? round.scheduled_date : `${round.scheduled_date}T00:00:00`;
      const dateObj = new Date(normalizedDate);
      const scheduledDateDisplay = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : (round.scheduled_date || 'Date TBD');

      let reqIdDisplay = 'REQ #8302CO';
      if (round.requisition_id) {
        reqIdDisplay = round.requisition_id.startsWith('REQ #')
          ? round.requisition_id
          : `REQ #${String(round.requisition_id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
      } else if (matchingReq?.id) {
        reqIdDisplay = `REQ #${String(matchingReq.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
      }

      const interviewerName = round.interviewer_name
        ? round.interviewer_name
        : (round.round_name && round.round_name.toLowerCase().includes('ai'))
        ? 'AI Interviewer'
        : 'Lead Interviewer';

      const interviewerRole = round.interviewer_role
        ? round.interviewer_role
        : (round.round_name && round.round_name.toLowerCase().includes('ai'))
        ? 'Automated Assessment Panel'
        : 'Engineering Team';

      const timeDetails = parseTimeDetails(round.scheduled_time, round.duration_minutes || 45);

      return {
        ...round,
        company_name: companyName,
        company_logo_letter: companyLogoLetter,
        requisition_title: round.requisition_title || matchingReq?.title || 'backend Developer',
        requisition_id: reqIdDisplay,
        round_number: round.round_number || 1,
        round_name: round.round_name || 'Technical Interview',
        scheduled_date: round.scheduled_date || '',
        scheduled_date_display: scheduledDateDisplay,
        date_badge: badge,
        time_range: timeDetails.range,
        time_duration: timeDetails.duration,
        scheduled_time: `${timeDetails.range} (${timeDetails.duration})`,
        status: finalStatus,
        status_info: statusBadge,
        can_enter: canEnter,
        is_live_now: isLiveNow,
        interviewer_name: interviewerName,
        interviewer_role: interviewerRole,
        interviewer_avatar: round.interviewer_avatar || '',
        mode: 'Online (Term Jobs Panel)',
        is_ready: canEnter,
        days_until: startDate ? Math.max(0, Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0,
      };
    });
  }, [candidateInterviews, requisitions]);

  const upcomingCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Upcoming').length;
  }, [allCandidateInterviewRounds]);

  const completedCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Completed').length;
  }, [allCandidateInterviewRounds]);

  const cancelledCount = useMemo(() => {
    return allCandidateInterviewRounds.filter((r) => r.status === 'Cancelled').length;
  }, [allCandidateInterviewRounds]);

  const allCount = allCandidateInterviewRounds.length;

  const hasInterviewAccess = allCandidateInterviewRounds.length > 0;

  const filteredInterviews = useMemo(() => {
    let result = allCandidateInterviewRounds;

    if (interviewFilterTab === 'upcoming') {
      result = result.filter((r) => r.status === 'Upcoming');
    } else if (interviewFilterTab === 'completed') {
      result = result.filter((r) => r.status === 'Completed');
    } else if (interviewFilterTab === 'cancelled') {
      result = result.filter((r) => r.status === 'Cancelled');
    }

    if (interviewSearch.trim()) {
      const q = interviewSearch.toLowerCase();
      result = result.filter((r) =>
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.requisition_title || '').toLowerCase().includes(q) ||
        (r.requisition_id || '').toLowerCase().includes(q) ||
        (r.interviewer_name || '').toLowerCase().includes(q) ||
        (r.round_name || '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const dateA = new Date(a.scheduled_date || 0).getTime();
      const dateB = new Date(b.scheduled_date || 0).getTime();
      return interviewSortAsc ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [allCandidateInterviewRounds, interviewFilterTab, interviewSearch, interviewSortAsc]);

  const scheduledInterviews = useMemo(() => {
    return allCandidateInterviewRounds.filter(
      (r) => r.status === 'Upcoming'
    );
  }, [allCandidateInterviewRounds]);

  const handleSendInterviewEmail = async (round) => {
    if (!round?.id) return;
    const email = candidateUser?.candidate_email || candidateUser?.email || round.candidate_email;
    if (!email) return;
    setResendingEmailId(round.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/interviews/rounds/${round.id}/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'sent' }));
      } else {
        setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'error' }));
      }
    } catch (err) {
      console.error('Error sending interview invitation email:', err);
      setEmailSentStatus((prev) => ({ ...prev, [round.id]: 'error' }));
    } finally {
      setResendingEmailId(null);
      setTimeout(() => {
        setEmailSentStatus((prev) => {
          const next = { ...prev };
          delete next[round.id];
          return next;
        });
      }, 4000);
    }
  };

  const handleSignAgreement = async (agrId) => {
    if (!signatureAgreed) return;
    setSigningAgreement(true);
    setSignSuccessMessage('');
    try {
      const token = candidateAuth?.candidateToken;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const signName = signatureName.trim() || candidateUser?.candidate_name || selectedAgreement?.candidate_name || 'Candidate';
      const email = candidateUser?.candidate_email || selectedAgreement?.candidate_email || '';
      const res = await fetch(`${API_BASE_URL}/api/candidate-profile/agreements/${agrId}/sign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signature_name: signName,
          email,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSignSuccessMessage('✓ Employment Agreement digitally signed and executed successfully! Your onboarding is now officially underway.');
        setSelectedAgreement((prev) => ({
          ...prev,
          status: 'Accepted & Signed',
          agreement_status: 'Accepted & Signed',
          candidate_accepted: true,
          signature_name: signName,
          signed_at: new Date().toISOString(),
        }));
        loadCandidateAgreements();
        if (refreshProfile) refreshProfile();
      } else {
        alert(data?.detail || 'Failed to sign agreement. Please try again.');
      }
    } catch (err) {
      console.error('Sign agreement error:', err);
    } finally {
      setSigningAgreement(false);
    }
  };

  // Application form state
  const [applyForm, setApplyForm] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [useCustomResume, setUseCustomResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Candidate setup/edit profile form
  const [setupForm, setSetupForm] = useState({
    name: '',
    phone: '',
    title: '',
    skills: '',
    linkedin_url: '',
    github_url: '',
    summary: '',
  });
  const [setupResumeFile, setSetupResumeFile] = useState(null);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const setupFileInputRef = useRef(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // General talent pool form
  const [poolForm, setPoolForm] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    github_url: '',
    cover_note: '',
  });
  const [poolResume, setPoolResume] = useState(null);
  const [poolIsDragging, setPoolIsDragging] = useState(false);
  const [poolUseCustomResume, setPoolUseCustomResume] = useState(false);
  const poolFileInputRef = useRef(null);
  const [poolSubmitting, setPoolSubmitting] = useState(false);
  const [poolSuccess, setPoolSuccess] = useState(null);
  const [poolError, setPoolError] = useState(null);

  // Candidate Auth Modal state (Google & Email)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regSkills, setRegSkills] = useState('');
  const [regResume, setRegResume] = useState(null);
  const [googleResumeRequired, setGoogleResumeRequired] = useState(false);
  const [pendingGooglePayload, setPendingGooglePayload] = useState(null);

  // Load Google Identity Services SDK only when auth modal is open
  useEffect(() => {
    if (!showAuthModal) return;
    if (document.getElementById('google-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [showAuthModal]);

  // Helper to ensure Google SDK is ready when user clicks Google Sign-In
  const ensureGoogleSdk = useCallback(() => {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) return resolve(true);
      let script = document.getElementById('google-jssdk');
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-jssdk';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
      script.addEventListener('load', () => resolve(true), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve(true);
        } else if (tries > 40) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }, []);

  // Listen for query params, hash, or candidate path opening candidate auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.toLowerCase();
    if (params.get('join') === 'talent-pool') {
      if (isCandidateAuthenticated) {
        setShowAuthModal(false);
        setShowGeneralPoolModal(true);
      } else {
        setShowAuthModal(true);
      }
      return;
    }
    if (
      params.get('auth') ||
      params.get('login') ||
      window.location.hash === '#login' ||
      window.location.hash === '#candidate-login' ||
      path.includes('/candidate')
    ) {
      setShowAuthModal(true);
      if (params.get('auth') === 'register' || window.location.hash === '#register') {
        setAuthModalTab('register');
      }
    }
  }, [location.search, isCandidateAuthenticated]);

  // Trigger Google OAuth popup
  const handleGoogleSignIn = async (onSuccess) => {
    setAuthError(null);

    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google OAuth Client ID is not configured.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setAuthLoading(true);
      const loaded = await ensureGoogleSdk();
      setAuthLoading(false);
      if (!loaded || !window.google?.accounts?.oauth2) {
        setAuthError('Google Sign-In SDK is loading. Please try again in a few moments.');
        return;
      }
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setAuthError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            setAuthError(null);
            setAuthLoading(true);
            try {
              let userInfo = {};
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (userRes.ok) {
                  userInfo = await userRes.json();
                }
              } catch (userErr) {
                console.warn('Could not fetch userinfo directly from Google:', userErr);
              }

              let resumeFields = {};
              if (regResume) {
                if (!regResume.size || regResume.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(regResume.name)) {
                  throw new Error('Upload a non-empty PDF or DOCX resume up to 10 MB.');
                }
                const encoded = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(regResume);
                });
                resumeFields = { resume_base64: encoded, resume_filename: regResume.name };
              }
              const data = await loginWithGoogle({
                ...resumeFields,
                access_token: tokenResponse.access_token,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub,
              });

              if (data?.status === 'resume_required') {
                setPendingGooglePayload({
                  access_token: tokenResponse.access_token,
                  email: userInfo.email,
                  name: userInfo.name,
                  picture: userInfo.picture,
                  sub: userInfo.sub,
                });
                setGoogleResumeRequired(true);
                setAuthError(null);
                return;
              }
              setGoogleResumeRequired(false);
              setPendingGooglePayload(null);
              setAuthError(null);
              setAuthSuccessMsg('Signed in with Google successfully!');
              setTimeout(() => {
                handleCandidateAuthSuccess(data?.candidate || userInfo);
              }, 600);

              if (onSuccess && typeof onSuccess === 'function') {
                onSuccess(data?.candidate || userInfo);
              }
            } catch (err) {
              setAuthError(err.message || 'Google authentication failed.');
            } finally {
              setAuthLoading(false);
            }
          }
        },
        error_callback: (err) => {
          console.warn('Google OAuth token client error:', err);
          if (err?.type === 'popup_closed') {
            return;
          }
          if (err?.type === 'popup_failed_to_open') {
            setAuthError('Popup was blocked by your browser. Please allow popups for Google Sign-In.');
            return;
          }
          if (err?.type === 'origin_mismatch') {
            const currentOrigin = window.location.origin;
            setAuthError(
              `Google OAuth Error: "${currentOrigin}" is not registered in Google Cloud Console. Please add "${currentOrigin}" to Authorized JavaScript origins.`
            );
            return;
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('Google OAuth trigger error:', err);
      setAuthError('Could not open Google Sign-In popup. Please check your browser popup blocker.');
    }
  };

  // Complete Google signup with uploaded resume without reopening Google popup
  const handleCompleteGoogleRegistration = async () => {
    if (!regResume) {
      setAuthError('Please upload your resume file (PDF or DOCX) to complete your profile.');
      return;
    }
    if (!regResume.size || regResume.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(regResume.name)) {
      setAuthError('Upload a non-empty PDF or DOCX resume up to 10 MB.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(regResume);
      });

      const payload = {
        ...(pendingGooglePayload || {}),
        resume_base64: encoded,
        resume_filename: regResume.name,
      };

      const data = await loginWithGoogle(payload);
      setGoogleResumeRequired(false);
      setPendingGooglePayload(null);
      setAuthError(null);
      setAuthSuccessMsg('Profile created! Signed in successfully.');
      setTimeout(() => {
        handleCandidateAuthSuccess(data?.candidate);
      }, 600);
    } catch (err) {
      setAuthError(err.message || 'Could not complete profile registration.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Candidate Email Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Please enter your email and password.');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await login(authEmail.trim(), authPassword);
      setAuthSuccessMsg('Welcome back! Loading candidate profile...');
      setTimeout(() => {
        handleCandidateAuthSuccess(data?.candidate);
      }, 600);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Candidate Profile Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setAuthError('Full name, email, and password (min 6 chars) are required.');
      return;
    }
    const emailErr = validateCandidateEmail(regEmail);
    if (emailErr) {
      setAuthError(emailErr);
      return;
    }
    if (!regResume || regResume.size === 0) {
      setAuthError('Please upload a non-empty resume file to create your profile.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (regPhone.trim()) {
      const regPhoneErr = validatePhone(regPhone, { required: false });
      if (regPhoneErr) {
        setAuthError(regPhoneErr);
        return;
      }
    }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', regName.trim());
      formData.append('email', regEmail.trim().toLowerCase());
      formData.append('password', regPassword);
      formData.append('phone', regPhone.trim());
      formData.append('title', regTitle.trim());
      formData.append('skills', regSkills.trim());
      if (regResume) {
        formData.append('resume', regResume);
      }
      const data = await register(formData);
      setAuthSuccessMsg('Candidate Profile created successfully!');
      setTimeout(() => {
        handleCandidateAuthSuccess(data?.candidate);
      }, 600);
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Derive candidate profile state
  const hasResume = Boolean(
    candidateAuth?.hasResume &&
    (candidateAuth?.resumeFilename || candidateUser?.filename || candidateUser?.has_resume)
  );
  const hasPhone = Boolean(
    candidateUser?.candidate_phone ||
    candidateUser?.details?.candidate_phone
  );
  const isProfileComplete = Boolean(
    (candidateAuth?.profileCompleted || candidateUser?.profile_completed || (hasResume && hasPhone)) &&
    hasResume
  );
  const currentResumeName = candidateAuth?.resumeFilename || candidateUser?.filename || 'profile_resume.pdf';

  // Persistent tracking of jobs applied by the CURRENT authenticated candidate
  const [justAppliedJobIds, setJustAppliedJobIds] = useState(() => {
    try {
      const set = new Set();
      if (appliedStorageKey) {
        const saved = localStorage.getItem(appliedStorageKey);
        if (saved) JSON.parse(saved).forEach((id) => set.add(String(id)));
      }
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('tj_applied_jobs')) {
          const val = localStorage.getItem(k);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) parsed.forEach((id) => set.add(String(id)));
            } catch (_) {}
          }
        }
      });
      return set;
    } catch {
      return new Set();
    }
  });

  // Keep justAppliedJobIds strictly synchronized with authentication state
  useEffect(() => {
    try {
      const set = new Set();
      if (appliedStorageKey) {
        const saved = localStorage.getItem(appliedStorageKey);
        if (saved) JSON.parse(saved).forEach((id) => set.add(String(id)));
      }
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('tj_applied_jobs')) {
          const val = localStorage.getItem(k);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) parsed.forEach((id) => set.add(String(id)));
            } catch (_) {}
          }
        }
      });
      setJustAppliedJobIds(set);
    } catch {
      setJustAppliedJobIds(new Set());
    }
  }, [isCandidateAuthenticated, appliedStorageKey]);

  // Dedicated candidate logout handler that cleanly purges device applied jobs tracking
  const handleCandidateLogout = useCallback(() => {
    try {
      localStorage.removeItem('tj_applied_jobs');
      if (appliedStorageKey) {
        localStorage.removeItem(appliedStorageKey);
      }
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('tj_applied_jobs')) {
          localStorage.removeItem(key);
        }
      });
    } catch (_) {}
    setJustAppliedJobIds(new Set());
    if (typeof logout === 'function') {
      logout();
    }
  }, [logout, appliedStorageKey]);

  // Automatically sync applied jobs from candidate profile history into candidate-scoped storage
  useEffect(() => {
    if (!isCandidateAuthenticated || !appliedStorageKey) {
      setJustAppliedJobIds(new Set());
      return;
    }
    if (Array.isArray(applications) && applications.length > 0) {
      setJustAppliedJobIds((prev) => {
        const next = new Set(prev);
        applications.forEach((app) => {
          if (app.requisition_id) next.add(String(app.requisition_id));
          if (app.id) next.add(String(app.id));
        });
        try {
          localStorage.setItem(appliedStorageKey, JSON.stringify(Array.from(next)));
        } catch (_) { }
        return next;
      });
    }
  }, [applications, isCandidateAuthenticated, appliedStorageKey]);

  // Consolidated list of applications: merges server-fetched applications with locally-confirmed applied jobs
  const displayedApplications = useMemo(() => {
    const list = Array.isArray(applications) ? applications.map((a) => ({ ...a })) : [];
    const knownReqIds = new Set(
      list.map((a) => String(a.requisition_id || a.id || a.submission_id || ''))
    );

    // Also check all candidate submissions/applications from candidateUser if present
    if (Array.isArray(candidateUser?.applications)) {
      candidateUser.applications.forEach((ca) => {
        const idKey = String(ca.requisition_id || ca.id || ca.submission_id || '');
        if (idKey && !knownReqIds.has(idKey)) {
          list.push({ ...ca });
          knownReqIds.add(idKey);
        }
      });
    }

    // Ensure any job applied in this session or stored in localStorage appears in Applications
    if (justAppliedJobIds && justAppliedJobIds.size > 0) {
      justAppliedJobIds.forEach((jid) => {
        if (!knownReqIds.has(String(jid))) {
          const matchingJob = requisitions.find(
            (r) => String(r.id) === String(jid) || String(r._id) === String(jid)
          );
          if (matchingJob) {
            list.push({
              submission_id: `APP-${jid}`,
              requisition_id: matchingJob.id || jid,
              requisition_title: matchingJob.title || 'Role Application',
              company_name: matchingJob.company_name || matchingJob.company || 'Enterprise Partner',
              status: 'Submitted',
              match_score: 88,
              recommendation: 'Strong Match',
              created_at: 'Applied recently',
              interview_status: null,
            });
            knownReqIds.add(String(jid));
          }
        }
      });
    }

    // Enrich missing or generic titles & company names from active requisitions
    list.forEach((app) => {
      const matched = requisitions.find(
        (r) => String(r.id) === String(app.requisition_id) || String(r._id) === String(app.requisition_id)
      );
      if (matched) {
        if (!app.requisition_title || app.requisition_title === 'Open Requisition' || app.requisition_title === 'Contract Position') {
          app.requisition_title = matched.title || app.requisition_title;
        }
        if (!app.company_name || app.company_name === 'Enterprise Partner' || app.company_name === 'Enterprise Client') {
          app.company_name = matched.company_name || matched.company || app.company_name;
        }
      }
    });

    return list;
  }, [applications, candidateUser?.applications, justAppliedJobIds, requisitions]);

  // Map of candidate's submitted applications for O(1) matching - strictly for authenticated candidate
  const appliedMap = useMemo(() => {
    const map = new Map();
    if (!isCandidateAuthenticated || !Array.isArray(displayedApplications)) return map;
    displayedApplications.forEach((app) => {
      if (app.requisition_id) {
        map.set(String(app.requisition_id), app);
      }
      if (app.id) {
        map.set(String(app.id), app);
      }
      if (app.requisition_title) {
        map.set(app.requisition_title.toLowerCase().trim(), app);
      }
    });
    return map;
  }, [displayedApplications, isCandidateAuthenticated]);

  const getJobApplication = useCallback((job) => {
    if (!job || !isCandidateAuthenticated) return null;
    return (
      appliedMap.get(String(job.id)) ||
      (job._id && appliedMap.get(String(job._id))) ||
      (job.title && appliedMap.get(job.title.toLowerCase().trim())) ||
      null
    );
  }, [appliedMap, isCandidateAuthenticated]);

  // Filtered outreach & interview items for notification drawer:
  // Exclude redundant outreach questions ("Are you interested?") for positions the candidate has ALREADY applied for.
  const activeNotificationItems = useMemo(() => {
    if (!Array.isArray(outreachHistory)) return [];
    return outreachHistory.filter((item) => {
      const token = item.token || item._id;
      const actionState = outreachActionStatus[token];
      const isInterested = (actionState && actionState.action === 'interested') || item.status === 'interested';
      const reqId = String(item.requisition_id || '');
      const reqTitleLower = (item.requisition_title || '').trim().toLowerCase();

      // Check if candidate already applied for this requisition
      const isApplied = Boolean(
        (reqId && justAppliedJobIds.has(reqId)) ||
        (displayedApplications || []).some(
          (app) => (reqId && String(app.requisition_id) === reqId) ||
                   (reqTitleLower && app.requisition_title && app.requisition_title.trim().toLowerCase() === reqTitleLower)
        )
      );

      // If already applied and not yet confirmed as interested / completed, hide the redundant outreach question
      if (isApplied && !isInterested && item.status !== 'completed' && item.interview_status !== 'Completed') {
        return false;
      }

      return true;
    });
  }, [outreachHistory, outreachActionStatus, justAppliedJobIds, displayedApplications]);

  const unreadNotificationCount = useMemo(() => {
    return activeNotificationItems.filter((o) => {
      const token = o.token || o._id;
      const localAct = outreachActionStatus[token];
      if (localAct) return false;
      return o.status === 'pending' || o.status === 'sent';
    }).length;
  }, [activeNotificationItems, outreachActionStatus]);

  // Auto-submit application helper for unauthenticated candidates who apply and then sign in
  const autoSubmitApplication = async (jobToApply, candidateDoc) => {
    if (!jobToApply || !candidateDoc) return;
    setSubmitting(true);
    try {
      const applicantName = (candidateDoc?.candidate_name || applyForm.name || candidateDoc?.name || '').trim();
      const applicantEmail = (candidateDoc?.candidate_email || applyForm.email || candidateDoc?.email || '').trim();
      const applicantPhone = (candidateDoc?.candidate_phone || applyForm.phone || candidateDoc?.details?.candidate_phone || '').trim();

      const formData = new FormData();
      formData.append('name', applicantName);
      formData.append('email', applicantEmail);
      formData.append('phone', applicantPhone);
      formData.append('linkedin_url', (applyForm.linkedin_url || candidateDoc?.details?.linkedin_url || '').trim());
      formData.append('github_url', (applyForm.github_url || candidateDoc?.details?.github_url || '').trim());
      formData.append('cover_note', applyForm.cover_note ? applyForm.cover_note.trim() : '');
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/public/requisitions/${jobToApply.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const jid = String(jobToApply.id);
        setJustAppliedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jid);
          if (jobToApply._id) next.add(String(jobToApply._id));
          if (appliedStorageKey) {
            try {
              localStorage.setItem(appliedStorageKey, JSON.stringify(Array.from(next)));
            } catch (_) {}
          }
          return next;
        });
        if (refreshProfile) {
          refreshProfile();
        }
      }
    } catch (err) {
      console.warn('[AutoApply] Failed to submit application:', err);
    } finally {
      setSubmitting(false);
      // Immediately open candidate onboarding modal
      if (!isStaffOrAdmin) {
        setShowOnboardingModal(true);
      }
    }
  };

  const handleCandidateAuthSuccess = async (candidateDoc) => {
    setShowAuthModal(false);
    setAuthSuccessMsg('');
    if (pendingAutoApplyJob) {
      const job = pendingAutoApplyJob;
      setPendingAutoApplyJob(null);
      await autoSubmitApplication(job, candidateDoc);
    } else if (!candidateDoc?.onboarding_completed && !isStaffOrAdmin) {
      const localKey = `tj_onboarding_done_${candidateDoc?.id || candidateDoc?.candidate_email}`;
      if (!localStorage.getItem(localKey)) {
        setShowOnboardingModal(true);
      }
    }
  };

  // Automatically trigger onboarding modal on first sign-in if not completed yet and not staff
  useEffect(() => {
    if (
      isCandidateAuthenticated &&
      candidateUser &&
      !isStaffOrAdmin &&
      !candidateUser.onboarding_completed &&
      !dismissedSessionOnboarding &&
      !pendingAutoApplyJob &&
      !showAuthModal
    ) {
      const localKey = `tj_onboarding_done_${candidateUser.id || candidateUser.candidate_email}`;
      if (!localStorage.getItem(localKey)) {
        setShowOnboardingModal(true);
      }
    }
  }, [
    isCandidateAuthenticated,
    candidateUser,
    isStaffOrAdmin,
    dismissedSessionOnboarding,
    pendingAutoApplyJob,
    showAuthModal,
  ]);

  const handleOnboardingComplete = async () => {
    setShowOnboardingModal(false);
    setDismissedSessionOnboarding(true);
    if (candidateUser) {
      const localKey = `tj_onboarding_done_${candidateUser.id || candidateUser.candidate_email}`;
      try {
        localStorage.setItem(localKey, 'true');
      } catch {}
    }
    if (completeOnboarding) {
      await completeOnboarding();
    }
  };

  // Auto-populate candidate details
  useEffect(() => {
    if (candidateUser) {
      setApplyForm((prev) => ({
        ...prev,
        name: candidateUser.candidate_name || prev.name,
        email: candidateUser.candidate_email || prev.email,
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || prev.phone,
        linkedin_url: candidateUser.details?.linkedin_url || prev.linkedin_url,
        github_url: candidateUser.details?.github_url || prev.github_url,
      }));
      setSetupForm({
        name: candidateUser.candidate_name || '',
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || '',
        title: candidateUser.candidate_title || '',
        skills: Array.isArray(candidateUser.skills) ? candidateUser.skills.join(', ') : '',
        linkedin_url: candidateUser.details?.linkedin_url || '',
        github_url: candidateUser.details?.github_url || '',
        summary: candidateUser.summary || '',
      });
      setPoolForm((prev) => ({
        ...prev,
        name: candidateUser.candidate_name || prev.name,
        email: candidateUser.candidate_email || prev.email,
        phone: candidateUser.candidate_phone || candidateUser.details?.candidate_phone || prev.phone,
        title: candidateUser.candidate_title || prev.title,
        linkedin_url: candidateUser.details?.linkedin_url || prev.linkedin_url,
        github_url: candidateUser.details?.github_url || prev.github_url,
      }));
    }
  }, [candidateUser, selectedJob]);

  // Fetch current-environment roles and show failures instead of stale rows.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Only trigger full loading spinner on initial load when requisitions are empty
    if (requisitions.length === 0) {
      setLoading(true);
    }
    setError(null);
    try { sessionStorage.removeItem('tj_cached_requisitions'); } catch {}
    if (rolesPrefetch.current === undefined) {
      rolesPrefetch.current = window.__PREFETCHED_REQUISITIONS__ || null;
      window.__PREFETCHED_REQUISITIONS__ = null;
    }
    const prefetched = rolesPrefetch.current;
    loadOpenRolesPage(request, { page: currentPage, pageSize: 7, q: debouncedSearch, workMode: selectedWorkMode, family: selectedFamily, location: selectedLocation, category: selectedOpportunityCategory }, prefetched)
      .then((data) => {
        if (cancelled) return;
        setRolePage(data);
        setRequisitions(data.items);
        if (selectedOpportunityCategory !== 'ALL' && !data.categories.some(item => item.id === selectedOpportunityCategory)) {
          setSelectedOpportunityCategory('ALL');
          setCurrentPage(1);
          return;
        }
        if (currentPage > data.total_pages) setCurrentPage(data.total_pages);
      })
      .catch((err) => {
        if (!cancelled) {
          setRequisitions([]);
          setError(err.message || 'Could not load open roles.');
        }
      })
      .finally(() => { rolesPrefetch.current = null; if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, currentPage, debouncedSearch, selectedWorkMode, selectedFamily, selectedLocation, selectedOpportunityCategory]);

  // Options and counts describe the full result set, not just the current page.
  const availableFamilies = rolePage.filters.families;
  const availableLocations = rolePage.filters.locations;

  const workModeCounts = useMemo(() => {
    const counts = { Remote: 0, Hybrid: 0, Onsite: 0 };
    requisitions.forEach((j) => {
      const role = j.structured_role || {};
      const rawMode = (role.work_mode || j.work_mode || '').toLowerCase();
      if (rawMode.includes('remote')) counts.Remote++;
      else if (rawMode.includes('hybrid')) counts.Hybrid++;
      else counts.Onsite++;
    });
    return counts;
  }, [requisitions]);

  const workModeOptions = useMemo(() => [
    { value: 'ALL', label: 'All Modes' },
    { value: 'Remote', label: 'Remote', count: workModeCounts.Remote },
    { value: 'Hybrid', label: 'Hybrid', count: workModeCounts.Hybrid },
    { value: 'Onsite', label: 'Onsite', count: workModeCounts.Onsite },
  ], [workModeCounts]);

  const departmentOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'All Depts' }];
    const deptMap = new Map();

    // 1. Families from backend filters
    if (Array.isArray(availableFamilies)) {
      availableFamilies.forEach((d) => {
        if (d && d !== 'General' && d !== 'ALL' && d !== 'Other') {
          deptMap.set(d.toLowerCase(), d);
        }
      });
    }

    // 2. Categories from rolePage
    if (Array.isArray(rolePage?.categories)) {
      rolePage.categories.forEach((c) => {
        const id = c.id || c.label;
        if (id && id !== 'General' && id !== 'ALL' && id !== 'Other') {
          if (!deptMap.has(id.toLowerCase())) {
            deptMap.set(id.toLowerCase(), id);
          }
        }
      });
    }

    // 3. Derived from loaded requisitions
    if (Array.isArray(requisitions)) {
      requisitions.forEach((j) => {
        const d = getJobDepartment(j);
        if (d && d !== 'General' && d !== 'ALL' && d !== 'Other') {
          if (!deptMap.has(d.toLowerCase())) {
            deptMap.set(d.toLowerCase(), d);
          }
        }
      });
    }

    // 4. Standard known departments
    const STANDARD_DEPTS = [
      'Engineering',
      'Sales & BD',
      'Marketing',
      'Design & UI/UX',
      'Quality Assurance',
      'DevOps & Cloud',
      'Human Resources',
      'Research & Content',
      'Operations & Service',
    ];
    STANDARD_DEPTS.forEach((d) => {
      if (!deptMap.has(d.toLowerCase())) {
        deptMap.set(d.toLowerCase(), d);
      }
    });

    deptMap.forEach((label, valKey) => {
      const catMatch = rolePage?.categories?.find((c) => (c.id || c.label || '').toLowerCase() === valKey);
      const count = catMatch ? catMatch.count : requisitions.filter((j) => getJobDepartment(j).toLowerCase() === valKey).length;
      opts.push({ value: label, label, count: count > 0 ? count : undefined });
    });

    return opts;
  }, [availableFamilies, rolePage, requisitions]);

  const locationOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'All Locations' }];
    availableLocations.forEach((loc) => {
      const count = requisitions.filter((j) => {
        const role = j.structured_role || {};
        const locVal = Array.isArray(role.location)
          ? role.location.join(' ')
          : (role.location || j.location || j.company_location || '');
        return locVal.toLowerCase().includes(loc.toLowerCase());
      }).length;
      opts.push({ value: loc, label: loc, count });
    });
    return opts;
  }, [availableLocations, requisitions]);

  const experienceOptions = useMemo(() => {
    const entryCount = requisitions.filter((j) => matchesExperience(j, 'ENTRY')).length;
    const juniorCount = requisitions.filter((j) => matchesExperience(j, 'JUNIOR')).length;
    const midCount = requisitions.filter((j) => matchesExperience(j, 'MID')).length;
    const seniorCount = requisitions.filter((j) => matchesExperience(j, 'SENIOR')).length;

    return [
      { value: 'ALL', label: 'All Experience' },
      { value: 'ENTRY', label: 'Fresher / Entry (0–1 yr)', count: entryCount },
      { value: 'JUNIOR', label: 'Junior (1–3 yrs)', count: juniorCount },
      { value: 'MID', label: 'Mid-Level (3–5 yrs)', count: midCount },
      { value: 'SENIOR', label: 'Senior (5+ yrs)', count: seniorCount },
    ];
  }, [requisitions]);

  // Guard: if selectedLocation ever holds a work mode, reset it to 'ALL'
  useEffect(() => {
    const WORK_MODES = new Set(['remote', 'hybrid', 'onsite', 'on-site', 'in-office']);
    if (WORK_MODES.has(selectedLocation.toLowerCase())) {
      setSelectedLocation('ALL');
    }
  }, [selectedLocation]);

  const getLocationDisplay = (job) => {
    const role = job.structured_role || {};
    const WORK_MODES = new Set(['remote', 'hybrid', 'onsite', 'on-site', 'in-office']);

    const candidates = [];
    if (Array.isArray(role.location)) {
      candidates.push(...role.location);
    } else if (role.location && typeof role.location === 'string') {
      candidates.push(role.location);
    }
    if (job.location) candidates.push(job.location);
    if (job.company_location) candidates.push(job.company_location);

    const geoMatch = candidates.find((c) => c && typeof c === 'string' && !WORK_MODES.has(c.trim().toLowerCase()));
    if (geoMatch) {
      return geoMatch.trim();
    }

    const mode = (role.work_mode || 'To be confirmed').trim();
    return mode.toLowerCase() === 'remote' ? 'Remote' : mode;
  };

  const getExperienceDisplay = useCallback((job) => {
    const role = job.structured_role || {};
    if (role.experience && typeof role.experience === 'string' && role.experience.trim()) {
      return role.experience.trim();
    }
    if (job.experience_level && typeof job.experience_level === 'string' && job.experience_level.trim()) {
      return job.experience_level.trim();
    }
    if (job.min_experience !== undefined && job.max_experience !== undefined) {
      if (job.min_experience === 0 && job.max_experience <= 1) return '0–1 year';
      return `${job.min_experience}–${job.max_experience} years`;
    }
    if (job.experience && typeof job.experience === 'string' && job.experience.trim()) {
      return job.experience.trim();
    }
    return '';
  }, []);

  const categoryTabs = [{ id: 'ALL', label: 'All Roles', count: rolePage.filtered_total }, ...rolePage.categories];
  const ROLES_PER_PAGE = 7;
  const totalPages = rolePage.total_pages;
  const activePage = currentPage;
  const paginatedJobs = useMemo(() => {
    let items = requisitions || [];
    const q = searchQuery.trim();
    if (q) {
      items = items.filter((j) => {
        const title = j.title || j.structured_role?.title || '';
        const comp = j.company_name || j.company || '';
        const role = j.structured_role || {};
        const skills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []);
        const desc = j.generated_jd_markdown || role.job_description || role.role_summary || '';
        const loc = typeof role.location === 'string' ? role.location : Array.isArray(role.location) ? role.location.join(' ') : '';
        const descMatches = q.length >= 2 && matchesSearch(desc, q);
        return (
          matchesSearch(title, q) ||
          matchesSearch(comp, q) ||
          skills.some((s) => matchesSearch(String(s), q)) ||
          descMatches ||
          matchesSearch(loc, q)
        );
      });
      items.sort((a, b) => {
        const aTitle = matchesSearch(a.title || a.structured_role?.title || '', q) ? 10 : 0;
        const bTitle = matchesSearch(b.title || b.structured_role?.title || '', q) ? 10 : 0;
        if (aTitle !== bTitle) return bTitle - aTitle;
        const aSkills = (a.structured_role?.must_have_skills || []).concat(a.structured_role?.nice_to_have_skills || []).some((s) => matchesSearch(String(s), q)) ? 5 : 0;
        const bSkills = (b.structured_role?.must_have_skills || []).concat(b.structured_role?.nice_to_have_skills || []).some((s) => matchesSearch(String(s), q)) ? 5 : 0;
        if (aSkills !== bSkills) return bSkills - aSkills;
        return 0;
      });
    }
    if (selectedExperience && selectedExperience !== 'ALL') {
      items = items.filter((j) => matchesExperience(j, selectedExperience));
    }
    return items.slice(0, 7);
  }, [requisitions, searchQuery, selectedExperience]);
  const pageStart = Math.max(1, Math.min(activePage - 2, totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageStart + index);

  const handleOpenJob = (job) => {
    setSelectedJob(job);
    setSubmitSuccess(null);
    setSubmitError(null);
    setResumeFile(null);
    setUseCustomResume(!hasResume);
    setModalActiveTab('job_details');
    setExpandedSections({
      company: false,
      role: true,
      responsibilities: false,
      qualifications: false,
      skills: false,
      employment: false,
    });
  };

  useEffect(() => {
    if (sharedRoleOpened.current || !requisitions.length) return;
    const requisitionId = new URLSearchParams(location.search).get('requisition');
    if (!requisitionId) return;

    const sharedJob = requisitions.find((job) => String(job.id || job._id) === requisitionId);
    if (!sharedJob) return;

    sharedRoleOpened.current = true;
    handleOpenJob(sharedJob);
  }, [location.search, requisitions]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!candidateUser) {
      setPendingAutoApplyJob(selectedJob);
      setSubmitError('Candidate sign-in or registration is mandatory to submit an application. Please sign in or create your profile.');
      setShowAuthModal(true);
      return;
    }

    const applicantName = applyForm.name.trim() || candidateUser?.candidate_name || '';
    const applicantEmail = applyForm.email.trim() || candidateUser?.candidate_email || '';
    const applicantPhone = applyForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';

    if (applicantPhone) {
      const applyPhoneErr = validatePhone(applicantPhone);
      if (applyPhoneErr) {
        setSubmitError(applyPhoneErr);
        return;
      }
    }

    if (!applicantName) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!applicantEmail) {
      setSubmitError('Please enter your email address.');
      return;
    }

    if (!resumeFile && (!hasResume || useCustomResume)) {
      if (hasResume) {
        setSubmitError('Please choose a resume file to upload, or switch to your saved profile resume.');
      } else {
        setSubmitError('Please upload your resume file (PDF or DOCX) to complete your application.');
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('name', applicantName);
      formData.append('email', applicantEmail);
      formData.append('phone', applicantPhone);
      formData.append('linkedin_url', applyForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', applyForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', applyForm.cover_note.trim());

      // Always append the uploaded resume file if present
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/public/requisitions/${selectedJob.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }

      if (!res.ok) {
        const errorText = formatApiErrorMessage(result, `Failed to submit application (${res.status}).`);
        throw new Error(errorText);
      }

      setSubmitSuccess(result);
      if (selectedJob?.id) {
        const jid = String(selectedJob.id);
        setJustAppliedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jid);
          if (selectedJob._id) next.add(String(selectedJob._id));
          if (appliedStorageKey) {
            try {
              localStorage.setItem(appliedStorageKey, JSON.stringify(Array.from(next)));
            } catch (_) { }
          }
          return next;
        });
      }
      if (refreshProfile) {
        refreshProfile();
      }
      if (typeof loadCandidateInterviews === 'function') {
        loadCandidateInterviews(applicantEmail);
      }
      if (!candidateUser?.onboarding_completed && !isStaffOrAdmin) {
        setShowOnboardingModal(true);
      }
    } catch (err) {
      console.error('Error applying to requisition:', err);
      const displayMsg = formatApiErrorMessage(err?.message || err, 'An unexpected error occurred while submitting your application.');
      setSubmitError(displayMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract clean human-readable error messages from API responses (preventing [object Object])
  const formatApiErrorMessage = (errOrResult, fallback = 'Operation failed. Please try again.') => {
    if (!errOrResult) return fallback;
    if (typeof errOrResult === 'string') {
      if (errOrResult === '[object Object]' || errOrResult.trim() === '') return fallback;
      return errOrResult;
    }
    const detail = errOrResult.detail !== undefined ? errOrResult.detail : errOrResult;
    if (typeof detail === 'string') {
      if (detail === '[object Object]' || detail.trim() === '') return fallback;
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d) => {
          if (typeof d === 'string') return d;
          if (d && typeof d === 'object') {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
            const msg = d.msg || d.message || JSON.stringify(d);
            return field && field !== 'body' ? `${field}: ${msg}` : msg;
          }
          return String(d);
        })
        .filter(Boolean)
        .join(', ');
    }
    if (detail && typeof detail === 'object') {
      return detail.message || detail.msg || detail.error || JSON.stringify(detail);
    }
    if (typeof errOrResult.message === 'string' && errOrResult.message !== '[object Object]') {
      return errOrResult.message;
    }
    if (typeof errOrResult.error === 'string') return errOrResult.error;
    return fallback;
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setSetupError(null);

    if (!setupForm.name.trim()) {
      setSetupError('Please enter your full name.');
      return;
    }
    const setupPhoneErr = validatePhone(setupForm.phone);
    if (setupPhoneErr) {
      setSetupError(setupPhoneErr);
      return;
    }

    setSetupSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('candidate_name', setupForm.name.trim());
      formData.append('candidate_phone', setupForm.phone.trim());
      formData.append('candidate_title', setupForm.title.trim());
      if (editingSkills && hasResume && !setupResumeFile) {
        formData.append('skills', setupForm.skills.trim());
        formData.append('skills_override', 'true');
      }
      formData.append('linkedin_url', setupForm.linkedin_url.trim());
      formData.append('github_url', setupForm.github_url.trim());
      formData.append('summary', setupForm.summary.trim());

      if (setupResumeFile) {
        formData.append('resume', setupResumeFile);
      }

      if (setupProfile) {
        await setupProfile(formData);
      }
      setEditingSkills(false);
      setSetupSuccess(true);
      setTimeout(() => {
        setShowSetupModal(false);
        setSetupSuccess(false);
      }, 1200);
    } catch (err) {
      setSetupError(formatApiErrorMessage(err?.message || err, 'Could not update profile.'));
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handlePoolSubmit = async (e) => {
    e.preventDefault();
    if (!poolResume && (!hasResume || poolUseCustomResume)) {
      setPoolError('Please upload your resume file (PDF or DOCX).');
      return;
    }
    const poolPhone = poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '';
    if (poolPhone) {
      const poolPhoneErr = validatePhone(poolPhone);
      if (poolPhoneErr) {
        setPoolError(poolPhoneErr);
        return;
      }
    }
    setPoolSubmitting(true);
    setPoolError(null);
    try {
      const formData = new FormData();
      formData.append('name', poolForm.name.trim() || candidateUser?.candidate_name || '');
      formData.append('email', poolForm.email.trim() || candidateUser?.candidate_email || '');
      formData.append('phone', poolForm.phone.trim() || candidateUser?.candidate_phone || candidateUser?.details?.candidate_phone || '');
      formData.append('title', poolForm.title.trim() || candidateUser?.candidate_title || '');
      formData.append('linkedin_url', poolForm.linkedin_url.trim() || candidateUser?.details?.linkedin_url || '');
      formData.append('github_url', poolForm.github_url.trim() || candidateUser?.details?.github_url || '');
      formData.append('cover_note', poolForm.cover_note.trim());
      if (candidateUser?.id || candidateUser?.candidate_id) {
        formData.append('candidate_id', candidateUser.id || candidateUser.candidate_id);
      }
      if (poolResume) {
        formData.append('resume', poolResume);
      }

      const headers = {};
      if (candidateAuth?.candidateToken) {
        headers['Authorization'] = `Bearer ${candidateAuth.candidateToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/public/talent-pool/join`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }

      if (!res.ok) {
        const errorText = formatApiErrorMessage(result, `Could not join talent pool (${res.status}).`);
        throw new Error(errorText);
      }
      const entryParams = new URLSearchParams(location.search);
      if (entryParams.get('join') === 'talent-pool' && entryParams.get('source') === 'launchpage') {
        setShowGeneralPoolModal(false);
        if (refreshProfile) refreshProfile();
        navigate('/candidate-pool/added', { replace: true, state: { poolSubmitted: true } });
        return;
      }
      setPoolSuccess(result);
      if (refreshProfile) {
        refreshProfile();
      }
      if (typeof loadCandidateInterviews === 'function') {
        loadCandidateInterviews(applicantEmail);
      }
      if (!candidateUser?.onboarding_completed && !isStaffOrAdmin) {
        setShowOnboardingModal(true);
      }
    } catch (err) {
      const displayMsg = formatApiErrorMessage(err?.message || err, 'Failed to submit profile. Please ensure all required fields are filled out.');
      setPoolError(displayMsg);
    } finally {
      setPoolSubmitting(false);
    }
  };

  const selectedJobApp = (selectedJob && isCandidateAuthenticated)
    ? getJobApplication(selectedJob) || (justAppliedJobIds.has(String(selectedJob.id)) ? { status: 'Submitted' } : null)
    : null;
  const isSelectedJobApplied = Boolean(selectedJobApp);

  const parsedJobSections = useMemo(() => {
    if (!selectedJob) return {
      overview: '',
      company: '',
      role: '',
      responsibilities: '',
      qualifications: '',
      skills: '',
      employment: '',
    };
    const role = selectedJob.structured_role || {};
    const markdown = selectedJob.generated_jd_markdown || '';

    // Helper to sanitize "About the Role" text so it never contains Responsibilities,
    // Requirements, Skills, Salary, Employment Type, etc. (which have their own dedicated sections).
    const cleanAboutRole = (text) => {
      if (!text) return '';
      const stopPatterns = [
        /(?:\r?\n|^)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:key\s+|core\s+)?responsibilit(?:ies|y)[:\s*]*/i,
        /(?:\r?\n|^)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:required\s+)?(?:requirements?|qualifications?)[:\s*]*/i,
        /(?:\r?\n|^)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:preferred\s+|nice\s+to\s+have\s+)?skills?[:\s*]*/i,
        /(?:\r?\n|^)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:salary|compensation|stipend)[:\s*]*/i,
        /(?:\r?\n|^)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:employment\s+type|work\s+mode|duration|location)[:\s*]*/i,
      ];

      let cleanest = text;
      for (const pat of stopPatterns) {
        const match = cleanest.search(pat);
        if (match !== -1) {
          cleanest = cleanest.slice(0, match).trim();
        }
      }
      return cleanest.trim();
    };

    const sections = {
      overview: '',
      company: '',
      role: '',
      responsibilities: '',
      qualifications: '',
      skills: '',
      employment: '',
    };

    if (markdown) {
      const parts = markdown.split(/\*\*([^*]+)\*\*/);
      // parts[0] is the introductory overview preceding the first bold heading
      if (parts[0] && parts[0].trim()) {
        sections.role = cleanAboutRole(parts[0].trim());
      }

      let currentKey = 'overview';

      for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i].trim();
        const cleanHeader = header.replace(/:+$/, '').trim();
        const content = (parts[i + 1] || '').trim();
        const hLower = cleanHeader.toLowerCase();

        if (hLower.includes('about the company') || (hLower.includes('about') && !hLower.includes('role'))) {
          currentKey = 'company';
          sections.company = content;
        } else if (hLower.includes('about the role') || hLower === 'the role' || hLower.includes('role overview') || hLower.includes('job summary')) {
          currentKey = 'role';
          sections.role = cleanAboutRole(content);
        } else if (hLower.includes('responsibilit') || /^\d+\.\s+/.test(header)) {
          currentKey = 'responsibilities';
          sections.responsibilities += (sections.responsibilities ? '\n\n' : '') + content;
        } else if (hLower.includes('qualification') || hLower.includes('requirement')) {
          currentKey = 'qualifications';
          sections.qualifications += (sections.qualifications ? '\n\n' : '') + content;
        } else if (hLower.includes('preferred skill') || hLower === 'skills') {
          currentKey = 'skills';
          sections.skills += (sections.skills ? '\n\n' : '') + content;
        } else if (hLower.includes('salary') || hLower.includes('employment') || hLower.includes('work mode') || hLower.includes('location')) {
          currentKey = 'employment';
          sections.employment += (sections.employment ? '\n- ' : '- ') + `**${cleanHeader}:** ` + content;
        } else {
          if (currentKey && sections[currentKey] !== undefined && currentKey !== 'role') {
            sections[currentKey] += (sections[currentKey] ? '\n\n' : '') + `**${cleanHeader}**\n` + content;
          }
        }
      }
    }

    if (!sections.role) {
      sections.role = cleanAboutRole(role.job_description || role.role_summary || role.summary || '');
    }
    if (!sections.role) {
      sections.role = 'We are seeking passionate talent to join our team.';
    }
    sections.role = cleanAboutRole(sections.role);

    if (!sections.overview) {
      sections.overview = sections.role;
    }
    if (!sections.company) {
      sections.company = selectedJob.company_description || `${selectedJob.company_name || 'Hiring partner'} is actively recruiting for this position.`;
    }
    if (!sections.responsibilities) {
      sections.responsibilities = Array.isArray(role.responsibilities)
        ? role.responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'Deliver high-quality work, collaborate with cross-functional teams, and contribute to production milestones.';
    }
    if (!sections.qualifications) {
      sections.qualifications = role.experience
        ? `Relevant Experience: ${role.experience}\nStrong technical fundamentals and practical domain expertise.`
        : 'Relevant academic degree or equivalent practical experience.';
    }
    if (!sections.skills) {
      sections.skills = (role.nice_to_have_skills || []).length > 0
        ? role.nice_to_have_skills.join(', ')
        : (role.must_have_skills || []).join(', ') || 'Domain-specific skills as outlined in the role specification.';
    }
    if (!sections.employment) {
      sections.employment = `- Company: ${selectedJob.company_name || 'Enterprise'}\n- Work Mode: ${role.work_mode || selectedJob.work_mode || 'On-site'}\n- Location: ${getLocationDisplay(selectedJob)}\n- Employment: ${role.duration || role.engagement_type || 'Full-time'}`;
    }

    return sections;
  }, [selectedJob]);

  return (
    <div className="w-full min-h-screen overflow-x-clip bg-[#08090b] text-white font-sans selection:bg-emerald-500 selection:text-black relative">
      {enabled && (
        <SEOHead
          title={isInterviewViewOpen ? "Upcoming Interviews — TermJobs" : "Open Roles & Contract Opportunities — TermJobs"}
          description="Browse live contract positions across enterprise partners on TermJobs. Fast-track AI screening, transparent rate transparency, and direct review with hiring managers."
          canonicalUrl="https://www.termjobs.in/open-roles"
        />
      )}

      {/* HORIZONTAL SLIDING TRACK: 200vw width, smoothly moves -100vw to right */}
      <div
        className={`flex w-[200vw] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isInterviewViewOpen ? '-translate-x-[100vw]' : 'translate-x-0'
        }`}
      >
        {/* ============================================================ */}
        {/* VIEW 1: OPEN ROLES (w-[100vw] min-w-[100vw] min-h-screen)    */}
        {/* ============================================================ */}
        <div className="w-[100vw] min-w-[100vw] min-h-screen shrink-0 flex flex-col lg:flex-row">
          {/* ============================================================ */}
          {/* LEFT PANEL: LIGHT EDITORIAL COLUMN (HIDDEN ON MOBILE)        */}
          {/* ============================================================ */}
          <aside className="hidden lg:flex w-full lg:w-[360px] xl:w-[400px] 2xl:w-[430px] shrink-0 bg-paper text-ink border-b lg:border-b-0 lg:border-r border-ink/10 flex-col relative self-stretch lg:min-h-screen">
        {/* Light Atmospheric Background Layer - mathematically synced with Landing Page */}
        <Backdrop tone="sidebar" active={!isInterviewViewOpen} />

        {/* Sticky Editorial Sidebar Content: stays in viewport while left panel stretches with right content */}
        <div className="relative z-10 w-full flex-1 flex flex-col justify-between lg:sticky lg:top-0 lg:h-screen lg:max-h-screen">

        {/* Zone 1: Main Scrollable Editorial Content (takes remaining height, never pushes bottom) */}
        <div className="relative z-10 flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar-none p-6 sm:p-7 xl:p-8 pb-2 flex flex-col justify-between">
          <div>
            {/* Official TermJobs Logo & Brand Mark */}
            <Link to="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <img
                src={logo}
                alt="TermJobs"
                className="w-7 h-7 object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="text-[13px] font-extrabold tracking-[0.2em] text-neutral-900 block leading-none">
                  TERMJOBS
                </span>
                <span className="text-[0.58rem] font-bold tracking-[0.15em] text-neutral-400 uppercase block mt-0.5">
                  Contract Workforce Platform
                </span>
              </div>
            </Link>

            {/* Accent vertical separator */}
            <div className="w-[2px] h-7 bg-neutral-400 my-5 sm:my-6" />

            {/* Eyebrow */}
            <div className="text-[0.62rem] font-bold tracking-[0.18em] text-neutral-400 uppercase mb-2.5 sm:mb-3">
              Contract Workforce Platform
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-[-0.03em] leading-[1.08] text-neutral-950">
              Explore<br />
              Open Roles.<br />
              <span className="text-neutral-400 font-bold block mt-1">
                Direct with<br />
                Hiring Partners.
              </span>
            </h1>

            {/* Subtext */}
            <p className="mt-4 sm:mt-5 text-xs text-neutral-500 leading-relaxed max-w-sm font-normal">
              Browse live contract opportunities from verified enterprise partners. Apply directly with 1-click
              resume parsing, instant skill matching, and verified compliance.
            </p>

            {/* Pure Transparent Glass Platform Metrics */}
            <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 relative z-10 max-w-sm">
              {/* Card 1: Open Roles */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Briefcase size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  {rolePage.stats.roles}
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Open Roles
                </div>
              </div>

              {/* Card 2: Avg Review Time */}
              <div className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] border border-neutral-900/15 hover:border-neutral-900/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-all group cursor-default">
                <Zap size={13} className="text-neutral-500 group-hover:text-neutral-900 transition-colors shrink-0" />
                <div className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none my-1">
                  &lt; 48h
                </div>
                <div className="text-[8.5px] sm:text-[9.5px] font-bold text-neutral-500 uppercase tracking-wider leading-tight text-center">
                  Review Time
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone 2: Bottom Talent Pool Callout - Pinned & Fixed at Bottom */}
        <div className="relative z-20 shrink-0 px-6 sm:px-7 xl:px-8 pt-2.5 pb-6 sm:pb-7 xl:pb-8 bg-transparent">
          <div className="flex items-stretch gap-3 max-w-sm">
            {/* Vertical Accent Line running alongside sentence and button */}
            <div className="w-[2px] bg-neutral-400 rounded-full shrink-0" />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-neutral-700">
                <Sparkles size={13} className="text-neutral-900 shrink-0" />
                <span className="text-[11.5px] sm:text-xs font-medium text-neutral-700 leading-snug">
                  Don't see your role? Join the verified talent pool.
                </span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowGeneralPoolModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[11px] tracking-tight transition cursor-pointer active:scale-95 shadow-md shadow-neutral-900/10"
                >
                  <span>Join Talent Pool</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* RIGHT PANEL: DARK DASHBOARD & OPEN ROLES                    */}
      {/* ============================================================ */}
      <div className="flex-1 min-w-0 bg-ink text-paper p-3 sm:p-4.5 xl:p-5 flex flex-col relative overflow-hidden">
        {/* Atmospheric Background Layer */}
        <Backdrop tone="dark" active={!isInterviewViewOpen} />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Top Header Navigation — Optimized for Mobile */}
          <header className="flex items-center justify-between gap-2.5 sm:gap-4 mb-2 sm:mb-2.5 pt-0.5 lg:pt-0 shrink-0">
            {/* Left: Brand logo + back link on mobile, Platform Overview on desktop */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 group cursor-pointer transition-transform active:scale-95 shrink-0"
              title="Return to Home"
            >
              <ArrowLeft size={14} className="text-paper/70 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
              <img src={logo} alt="TermJobs" className="h-5 w-5 object-contain invert lg:hidden" />
              <span className="text-[12px] font-extrabold tracking-[0.2em] text-white lg:hidden">TERMJOBS</span>
              <span className="hidden lg:inline text-xs text-paper/60 hover:text-white font-medium">Platform Overview</span>
            </Link>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto shrink-0">
              {candidateUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Interview Quick Access Trigger (Appears ONLY after candidate signin) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsInterviewViewOpen(true);
                      setActiveNavTab('interview');
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 text-white/90 hover:text-white text-[10px] sm:text-[11px] font-medium transition backdrop-blur-md active:scale-95 cursor-pointer"
                    title="Open My Interviews"
                  >
                    <span>Interview</span>
                    {allCandidateInterviewRounds.filter((r) => r.status === 'Upcoming').length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </button>

                  {/* Modern Monochrome Notification Bell */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowNotificationDrawer((prev) => !prev)}
                      className={`relative p-1.5 sm:p-2 rounded-full transition-all cursor-pointer flex items-center justify-center border ${
                        showNotificationDrawer
                          ? 'bg-white text-black border-white shadow-lg'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white/90 hover:text-white'
                      }`}
                      title="Interview & Match Notifications"
                    >
                      <Bell size={13} className={showNotificationDrawer ? 'text-black' : 'text-white'} />
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-white text-black font-black text-[8.5px] flex items-center justify-center border border-black/30 shadow-md">
                          {unreadNotificationCount}
                        </span>
                      )}
                    </button>

                    {/* Modern Monochrome Notifications Dropdown */}
                    {showNotificationDrawer && (
                      <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[82vh] overflow-y-auto rounded-2xl bg-[#090a0e]/95 border border-white/15 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] p-4 z-50 text-white">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-white">
                              <Bell size={12} />
                            </div>
                            <span className="text-[11px] font-black text-white tracking-widest uppercase">Notifications & Alerts</span>
                            {unreadNotificationCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white text-black shadow-sm">
                                {unreadNotificationCount} New
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowNotificationDrawer(false)}
                            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            title="Close"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* List of Outreach Notifications & Match Alerts */}
                        {activeNotificationItems.length === 0 ? (
                          <div className="py-8 text-center px-4">
                            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-2.5 text-white/40">
                              <Bell size={16} />
                            </div>
                            <p className="text-xs font-semibold text-white/80">No new notifications</p>
                            <p className="text-[11px] text-white/40 mt-1 max-w-[240px] mx-auto leading-relaxed">
                              When you receive interview invitations or fast-track updates, they will appear here.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeNotificationItems.map((item, idx) => {
                              const token = item.token || item._id;
                              const actionState = outreachActionStatus[token];

                              // Match corresponding interview round to detect completion
                              const matchingRound = (allCandidateInterviewRounds || []).find(
                                (r) => (item.round_id && String(r.id) === String(item.round_id)) ||
                                       (item.requisition_id && String(r.requisition_id) === String(item.requisition_id)) ||
                                       (item.requisition_title && r.requisition_title && item.requisition_title.toLowerCase() === r.requisition_title.toLowerCase())
                              );
                              const matchingApp = (displayedApplications || []).find(
                                (app) => (item.requisition_id && String(app.requisition_id) === String(item.requisition_id)) ||
                                         (item.requisition_title && app.requisition_title && item.requisition_title.toLowerCase() === app.requisition_title.toLowerCase())
                              );

                              // Precise check for whether AI interview is completed
                              const isCompleted = Boolean(
                                matchingRound?.status === 'Completed' ||
                                matchingRound?.status === 'Evaluated' ||
                                matchingRound?.evaluation?.overall_score !== undefined ||
                                (matchingRound?.evaluation && Object.keys(matchingRound.evaluation).length > 0) ||
                                matchingApp?.status === 'Completed' ||
                                matchingApp?.interview_status === 'Completed' ||
                                item.status === 'completed' ||
                                item.interview_status === 'Completed'
                              );

                              const isInterested = (actionState && actionState.action === 'interested') || item.status === 'interested';
                              const isUnavailable = (actionState && actionState.action === 'unavailable') || item.status === 'unavailable';
                              const meetingLink = actionState?.meeting_link || item.meeting_link;

                              return (
                                <div
                                  key={token || idx}
                                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-all flex flex-col gap-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-xs font-bold text-white leading-tight">
                                        {item.requisition_title || 'Position Match Alert'}
                                      </div>
                                      <div className="text-[10.5px] text-white/50 mt-0.5 font-medium">
                                        {item.company_name || 'Enterprise Partner'}
                                      </div>
                                    </div>
                                    {item.telegram_chat_id || item.telegram_sent ? (
                                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/[0.06] text-white/80 border border-white/15 flex items-center gap-1.5">
                                        <Send size={9} className="text-white/60" />
                                        <span>Telegram Synced</span>
                                      </span>
                                    ) : null}
                                  </div>

                                  {/* Render state: Completed vs Interested vs Pending Question */}
                                  {isCompleted ? (
                                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/15 flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                          <CheckCircle2 size={13} className="text-emerald-400" />
                                          <span>AI Interview Completed</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-black tracking-wide uppercase">
                                          Completed
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-white/50 leading-relaxed">
                                        Your voice responses and autonomous screening have been submitted for recruiter review.
                                      </p>
                                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowNotificationDrawer(false);
                                            setIsInterviewViewOpen(true);
                                            setActiveNavTab('interview');
                                          }}
                                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-semibold transition cursor-pointer flex items-center gap-1.5"
                                        >
                                          <Eye size={11} className="text-white/70" />
                                          <span>View in Interviews</span>
                                          <ArrowRight size={10} className="text-white/50" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : isInterested ? (
                                    <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/15 flex flex-col gap-2.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                          <CheckCircle2 size={13} className="text-emerald-400" />
                                          <span>Status Confirmed: Available & Interested</span>
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-emerald-400 border border-emerald-500/20">
                                          Ready
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-white/60 leading-relaxed">
                                        Your AI Interview is ready. You can attend immediately with your camera & mic.
                                      </p>
                                      <div className="pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowNotificationDrawer(false);
                                            if (meetingLink && meetingLink.startsWith('http')) {
                                              window.open(meetingLink, '_blank');
                                            } else if (item.round_id) {
                                              navigate(`/interview/ai/${item.round_id}?role=candidate&name=${encodeURIComponent(candidateUser?.candidate_name || 'Candidate')}&token=${encodeURIComponent(item.token || '')}`);
                                            } else {
                                              setIsInterviewViewOpen(true);
                                              setActiveNavTab('interview');
                                            }
                                          }}
                                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-[11px] flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                                        >
                                          <Sparkles size={12} className="text-black" />
                                          <span>Start AI Interview</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : isUnavailable ? (
                                    <div className="text-[10.5px] text-white/40 italic py-1">
                                      Marked as unavailable for this requisition.
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-[11.5px] text-white/80 leading-relaxed">
                                        Are you currently available & interested in exploring this role and taking the AI Interview?
                                      </p>
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          disabled={respondingOutreachToken === token}
                                          onClick={() => handleOutreachRsvp(token, 'interested')}
                                          className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-neutral-200 text-black text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                                        >
                                          {respondingOutreachToken === token ? (
                                            <span>Fast-Tracking...</span>
                                          ) : (
                                            <>
                                              <Check size={12} className="text-black" />
                                              <span>Yes, I am Interested</span>
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={respondingOutreachToken === token}
                                          onClick={() => handleOutreachRsvp(token, 'unavailable')}
                                          className="py-1.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-white/70 hover:text-white text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                                        >
                                          No
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Candidate Pill */}
                  <div className="flex items-center gap-1.5 sm:gap-2 p-0.5 pl-1.5 pr-1.5 rounded-full bg-paper/[0.06] border border-paper/15 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setShowSetupModal(true)}
                      className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition p-0.5 rounded-full"
                      title="Profile Settings"
                    >
                      <div className="w-5.5 h-5.5 rounded-full bg-white/10 text-white font-bold text-[9.5px] flex items-center justify-center border border-white/20 shrink-0">
                        {(candidateUser.candidate_name || 'C').slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold text-white max-w-[85px] sm:max-w-[120px] truncate hidden sm:inline">
                        {candidateUser.candidate_name || candidateUser.candidate_email}
                      </span>
                    </button>

                    <div className="h-3 w-px bg-paper/20 mx-0.5" />

                    {/* Candidate Onboarding Tour Preview Icon */}
                    <button
                      type="button"
                      onClick={() => setShowOnboardingModal(true)}
                      className="p-1 sm:p-1.5 text-paper/70 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer flex items-center justify-center"
                      title="Onboarding Tour Preview"
                    >
                      <Sparkles size={13} className="text-white/80 hover:text-white" />
                    </button>

                    <a
                      href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${candidateUser.id || candidateUser.candidate_email || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden lg:inline-flex p-1 sm:p-1.5 text-paper/70 hover:text-white transition rounded-lg hover:bg-paper/10 cursor-pointer items-center justify-center text-decoration-none"
                      title="Connect Telegram for instant interview alerts & notifications"
                    >
                      <Send size={12} />
                    </a>

                    <div className="h-3 w-px bg-paper/20 mx-0.5" />

                    {/* Sign Out Icon */}
                    <button
                      type="button"
                      onClick={handleCandidateLogout}
                      className="p-1 sm:p-1.5 text-paper/60 hover:text-rose-400 hover:bg-rose-500/10 transition rounded-lg cursor-pointer flex items-center justify-center"
                      title="Sign out"
                    >
                      <LogOut size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  {/* Candidate Sign In Trigger */}
                  <button
                    type="button"
                    onClick={() => { setAuthModalTab('login'); setShowAuthModal(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 text-white/90 hover:text-white text-[11px] sm:text-xs font-medium transition backdrop-blur-md active:scale-95 cursor-pointer"
                  >
                    <User size={11} className="text-white/70" />
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Section Title Header */}
          <div className="mb-2 sm:mb-2.5 pt-0 shrink-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Latest Opportunities
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5 font-medium">
              {rolePage?.filtered_total || requisitions.length} active roles available
            </p>
          </div>

          {/* Opportunities List / Table Section */}
          <main id="roles-grid-section" className="flex-1 w-full flex flex-col min-h-0">
            <div className="flex-1 flex flex-col justify-between rounded-2xl sm:rounded-3xl bg-[#0B0D12] border border-white/[0.08] p-3 sm:px-5 sm:pt-2 sm:pb-3 shadow-xl will-change-transform min-h-0">
{/* TOP OF ROLES TAB: Search & Filter Console Linked Directly to Table */}
                <div className="pb-2 mb-2 border-b border-white/[0.06] flex flex-wrap items-center gap-2 sm:gap-2.5 w-full">
                  {/* Keyword Search Input */}
                  <div className="relative flex-1 min-w-[190px] sm:min-w-[220px] max-w-sm">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search roles, skills, company..."
                      className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Compact Work Mode */}
                  <FilterDropdown
                    icon={Briefcase}
                    label="All Modes"
                    value={selectedWorkMode}
                    options={workModeOptions}
                    onChange={(val) => {
                      setSelectedWorkMode(val);
                      setCurrentPage(1);
                    }}
                    menuWidth="w-44"
                  />

                  {/* Compact Department */}
                  <FilterDropdown
                    icon={Building2}
                    label="All Depts"
                    value={selectedFamily}
                    options={departmentOptions}
                    onChange={(val) => {
                      setSelectedFamily(val);
                      setCurrentPage(1);
                    }}
                    menuWidth="w-56"
                  />

                  {/* Compact Location */}
                  <FilterDropdown
                    icon={MapPin}
                    label="All Locations"
                    value={selectedLocation}
                    options={locationOptions}
                    onChange={(val) => {
                      setSelectedLocation(val);
                      setCurrentPage(1);
                    }}
                    className="hidden sm:inline-block"
                    menuWidth="w-60"
                  />

                  {/* Compact Experience */}
                  <FilterDropdown
                    icon={GraduationCap}
                    label="All Experience"
                    value={selectedExperience}
                    options={experienceOptions}
                    onChange={(val) => {
                      setSelectedExperience(val);
                      setCurrentPage(1);
                    }}
                    className="hidden sm:inline-block"
                    menuWidth="w-56"
                    align="right"
                  />
                </div>

              {error && requisitions.length === 0 ? (
                <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center max-w-md mx-auto my-12 backdrop-blur-md">
                  <AlertCircle size={28} className="text-rose-400 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-white">Unable to fetch open roles</h3>
                  <p className="text-xs text-zinc-400 mt-1 mb-4">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : loading && requisitions.length === 0 ? (
                <div className="py-24 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white/80 border-t-transparent animate-spin mx-auto" />
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/60">
                    Loading published requisitions...
                  </div>
                </div>
              ) : paginatedJobs.length === 0 ? (
                <div className="py-14 px-6 text-center max-w-md mx-auto my-auto">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-neutral-400 mx-auto mb-3">
                    <Search size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-white">No roles matching this search</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                    {searchQuery.trim()
                      ? `No opportunities match "${searchQuery}". Try different keywords or reset your filters.`
                      : 'No opportunities match the selected filters.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOpportunityCategory('ALL');
                        setSearchQuery('');
                        setSelectedWorkMode('ALL');
                        setSelectedFamily('ALL');
                        setSelectedLocation('ALL');
                        setSelectedExperience('ALL');
                        setCurrentPage(1);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGeneralPoolModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition cursor-pointer shadow-md"
                    >
                      Join Talent Pool
                    </button>
                  </div>
                </div>
              ) : (
                <>
                                {/* Mobile View: Touch-Friendly Requisition Cards (< 640px) */}
                <div className="sm:hidden divide-y divide-white/[0.06]">
                  {paginatedJobs.map((job) => {
                    const role = job.structured_role || {};
                    const rawSkills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []);
                    const skills = rawSkills.filter((s) => s && typeof s === 'string' && s.trim());
                    const workMode = (role.work_mode || job.work_mode || 'Onsite').trim();
                    const isRemote = workMode.toLowerCase().includes('remote');
                    const isHybrid = workMode.toLowerCase().includes('hybrid');
                    const compName = (job.company_name || job.company || '').trim();
                    const companyInitial = (compName || job.title || 'R').slice(0, 1).toUpperCase();
                    const locDisplay = getLocationDisplay(job);
                    const expDisplay = getExperienceDisplay(job);
                    const existingApp = getJobApplication(job);
                    const isApplied = Boolean(
                      isCandidateAuthenticated && (
                        existingApp ||
                        justAppliedJobIds.has(String(job.id)) ||
                        (job._id && justAppliedJobIds.has(String(job._id)))
                      )
                    );
                    const isSaved = savedJobIds.has(String(job.id)) || (job._id && savedJobIds.has(String(job._id)));

                    return (
                      <div
                        key={job.id || job._id}
                        onClick={() => handleOpenJob(job)}
                        className="py-2.5 px-1 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors rounded-xl cursor-pointer space-y-2"
                      >
                        {/* 1. Header: Initial + Title + Company */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <CompanyAvatar job={job} size="w-8 h-8" />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[13px] font-bold text-white tracking-tight leading-snug truncate">
                                {job.title}
                              </h3>
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-medium">
                                {compName || locDisplay || 'Direct Requisition'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 2. Badges: Work Mode, Experience, Location */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#16181F] border border-white/[0.08] text-neutral-200">
                            <span>{isRemote ? 'Remote' : isHybrid ? 'Hybrid' : workMode}</span>
                          </span>
                          {expDisplay && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#16181F] border border-white/[0.08] text-neutral-300">
                              {expDisplay}
                            </span>
                          )}
                          {locDisplay && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16181F] border border-white/[0.08] text-neutral-300 truncate max-w-[140px]">
                              <MapPin size={10} className="text-neutral-400 shrink-0" />
                              <span className="truncate">{locDisplay}</span>
                            </span>
                          )}
                        </div>

                        {/* 3. Skills + Apply Button */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-1 overflow-hidden min-w-0">
                            {skills.slice(0, 2).map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-md bg-[#16181F] border border-white/[0.08] text-[10px] font-medium text-neutral-300 truncate max-w-[85px]"
                              >
                                {skill}
                              </span>
                            ))}
                            {skills.length > 2 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#16181F] border border-white/[0.08] text-[10px] font-medium text-neutral-400 shrink-0">
                                +{skills.length - 2}
                              </span>
                            )}
                          </div>

                          {isApplied ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenJob(job);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-[10.5px] transition shadow-sm cursor-pointer shrink-0"
                            >
                              <Check size={11} className="text-emerald-400" />
                              <span>Applied</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenJob(job);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-[10.5px] transition shadow-sm cursor-pointer shrink-0 active:scale-95"
                            >
                              <span>Apply Now</span>
                              <ArrowRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tablet and Desktop: Full Table (>= 640px) */}
                <div className="hidden sm:block overflow-x-auto scrollbar-thin">
                  <div className="min-w-[760px]">
                    {/* Table Header Row */}
                    <div className={`grid grid-cols-[minmax(230px,2fr)_100px_110px_140px_170px_140px] items-center px-4 ${paginatedJobs.length <= 7 ? 'py-2' : 'py-1.5'} text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-white/[0.06]`}>
                      <div className="flex items-center gap-1.5">
                        <ArrowLeft size={10} className="text-neutral-500" />
                        <span>ROLE &amp; COMPANY</span>
                      </div>
                      <div>TYPE</div>
                      <div>EXPERIENCE</div>
                      <div>LOCATION</div>
                      <div>SKILLS</div>
                      <div className="text-right pr-2">APPLY</div>
                    </div>

                    {/* Table Rows - Smooth 60fps hardware accelerated rows */}
                    <div className="divide-y divide-white/[0.05]">
                      {paginatedJobs.map((job) => {
                        const role = job.structured_role || {};
                        const rawSkills = (role.must_have_skills || []).concat(role.nice_to_have_skills || []);
                        const skills = rawSkills.filter((s) => s && typeof s === 'string' && s.trim());
                        const workMode = (role.work_mode || job.work_mode || 'Onsite').trim();
                        const isRemote = workMode.toLowerCase().includes('remote');
                        const isHybrid = workMode.toLowerCase().includes('hybrid');
                        const compName = (job.company_name || job.company || '').trim();
                        const companyInitial = (compName || job.title || 'R').slice(0, 1).toUpperCase();
                        const locDisplay = getLocationDisplay(job);
                        const expDisplay = getExperienceDisplay(job);
                        const existingApp = getJobApplication(job);
                        const isApplied = Boolean(
                          isCandidateAuthenticated && (
                            existingApp ||
                            justAppliedJobIds.has(String(job.id)) ||
                            (job._id && justAppliedJobIds.has(String(job._id)))
                          )
                        );
                        const isSaved = savedJobIds.has(String(job.id)) || (job._id && savedJobIds.has(String(job._id)));

                        return (
                          <div
                            key={job.id || job._id}
                            onClick={() => handleOpenJob(job)}
                            className={`grid grid-cols-[minmax(230px,2fr)_100px_110px_140px_170px_140px] items-center px-4 ${paginatedJobs.length <= 7 ? 'py-2.5' : 'py-2'} hover:bg-white/[0.04] transition-colors duration-100 ease-out rounded-xl group cursor-pointer`}
                          >
                            {/* 1. Role & Company */}
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              <CompanyAvatar job={job} size="w-8 h-8" />
                              <div className="min-w-0 flex-1">
                                <h3 className="text-[13px] font-bold text-white tracking-tight truncate group-hover:text-white transition-colors">
                                  {job.title}
                                </h3>
                                <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-medium">
                                  {compName ? compName : (locDisplay ? locDisplay : 'Direct Requisition')}
                                </p>
                              </div>
                            </div>

                            {/* 2. Type */}
                            <div>
                              <span className="inline-flex items-center -ml-2 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-[#16181F] border border-white/[0.08] text-neutral-200">
                                <span>{isRemote ? 'Remote' : isHybrid ? 'Hybrid' : workMode}</span>
                              </span>
                            </div>

                            {/* 3. Experience */}
                            <div className="text-[11.5px] text-neutral-300 font-medium truncate pr-2">
                              {expDisplay ? expDisplay : <span className="text-neutral-500">—</span>}
                            </div>

                            {/* 4. Location */}
                            <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-300 min-w-0 pr-2">
                              <MapPin size={11} className="text-neutral-400 shrink-0" />
                              <span className="truncate">{locDisplay || 'Location flexible'}</span>
                            </div>

                            {/* 5. Skills */}
                            <div className="flex items-center gap-1.5 flex-wrap pr-2">
                              {skills.length > 0 ? (
                                <>
                                  {skills.slice(0, 2).map((skill) => (
                                    <span
                                      key={skill}
                                      className="px-2 py-0.5 rounded-md bg-[#16181F] border border-white/[0.08] text-[10.5px] font-medium text-neutral-300 whitespace-nowrap"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {skills.length > 2 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#16181F] border border-white/[0.08] text-[10.5px] font-medium text-neutral-400 whitespace-nowrap">
                                      +{skills.length - 2}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-[11px] text-neutral-500 italic">Open to all skills</span>
                              )}
                            </div>

                            {/* 6. Apply */}
                            <div className="flex items-center justify-end pr-1">
                              {isApplied ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenJob(job);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] transition shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                                >
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Applied</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenJob(job);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-[11px] transition shadow-sm cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
                                >
                                  <span>Apply Now</span>
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Table Footer: Count & Pagination */}
                <div className="mt-auto pt-2 border-t border-white/[0.06] flex items-center justify-between px-2 text-xs">
                  <div className="text-neutral-400 font-medium text-[11.5px]">
                    Showing {paginatedJobs.length === 0 ? 0 : `${(activePage - 1) * ROLES_PER_PAGE + 1}–${(activePage - 1) * ROLES_PER_PAGE + paginatedJobs.length}`} of {rolePage.filtered_total ?? rolePage.total ?? requisitions.length} roles
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={activePage <= 1}
                      className="w-7 h-7 rounded-full bg-[#16181F] border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                      title="Previous page"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {visiblePages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        aria-label={`Page ${page}`}
                        aria-current={activePage === page ? 'page' : undefined}
                        className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                          activePage === page
                            ? 'bg-white text-black font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage >= totalPages}
                      className="w-7 h-7 rounded-full bg-[#16181F] border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                      title="Next page"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
            {/* Candidate Navigation (Mobile: Glassmorphic Floating Capsule Dock | Desktop: Minimal Vertical List) */}
            {enabled && typeof document !== 'undefined' && createPortal(
              <>
                {/* Mobile View: Floating Glassmorphic Capsule Dock */}
                <div className="md:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none px-3.5 pb-[env(safe-area-inset-bottom,0px)]">
                  <nav
                    aria-label="Mobile Candidate Navigation"
                    className="pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-[#0a0b10]/90 hover:bg-[#0a0b10]/95 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.22)] select-none"
                  >
                    {[
                      {
                        id: 'home',
                        label: 'HOME',
                        icon: Home,
                        onClick: () => {
                          setActiveNavTab('home');
                          setIsInterviewViewOpen(false);
                          setShowInterviewModal(false);
                          setShowAgreementModal(false);
                          setShowSetupModal(false);
                          setShowMyAppsModal(false);
                          setShowAuthModal(false);
                          document.getElementById('roles-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                        },
                      },
                      {
                        id: 'applications',
                        label: 'APPS',
                        icon: Briefcase,
                        badge: displayedApplications?.length > 0 ? displayedApplications.length : null,
                        onClick: () => {
                          setActiveNavTab('applications');
                          setIsInterviewViewOpen(false);
                          setShowInterviewModal(false);
                          setShowAgreementModal(false);
                          setShowSetupModal(false);
                          setShowAuthModal(false);
                          setShowMyAppsModal(true);
                        },
                      },
                      {
                        id: 'interview',
                        label: 'INTERVIEW',
                        icon: Video,
                        badge: candidateUser ? (allCandidateInterviewRounds.filter((r) => r.status === 'Upcoming').length || null) : null,
                        onClick: () => {
                          if (!candidateUser) {
                            setAuthModalTab('login');
                            setShowAuthModal(true);
                            return;
                          }
                          setActiveNavTab('interview');
                          setIsInterviewViewOpen(true);
                          setShowAgreementModal(false);
                          setShowSetupModal(false);
                          setShowMyAppsModal(false);
                          setShowAuthModal(false);
                        },
                      },
                      {
                        id: 'agreement',
                        label: 'AGREEMENT',
                        icon: FileText,
                        badge: candidateAgreements?.length > 0 ? candidateAgreements.length : null,
                        onClick: () => {
                          setActiveNavTab('agreement');
                          setShowInterviewModal(false);
                          setShowSetupModal(false);
                          setShowMyAppsModal(false);
                          setShowAuthModal(false);
                          setShowAgreementModal(true);
                        },
                      },
                      {
                        id: 'profile',
                        label: '',
                        icon: User,
                        hasUser: Boolean(candidateUser),
                        onClick: () => {
                          setActiveNavTab('profile');
                          setShowInterviewModal(false);
                          setShowAgreementModal(false);
                          setShowMyAppsModal(false);
                          if (candidateUser) {
                            setShowSetupModal(true);
                          } else {
                            setAuthModalTab('login');
                            setShowAuthModal(true);
                          }
                        },
                      },
                    ].map((item, idx) => {
                      const isActive = isInterviewViewOpen
                        ? item.id === 'interview'
                        : showMyAppsModal
                        ? item.id === 'applications'
                        : showAgreementModal
                        ? item.id === 'agreement'
                        : showSetupModal
                        ? item.id === 'profile'
                        : activeNavTab === item.id;
                      const IconComponent = item.icon;
                      return (
                        <div key={item.id} className="flex items-center">
                          {idx > 0 && <div className="h-3 w-px bg-white/12 mx-0.5" />}
                          <button
                            type="button"
                            onClick={item.onClick}
                            aria-current={isActive ? 'true' : undefined}
                            title={item.label || (item.id === 'profile' ? 'Profile' : item.id)}
                            aria-label={item.label || item.id}
                            className={`relative flex items-center justify-center gap-1 sm:gap-1.5 ${
                              item.label ? 'px-2 sm:px-3' : 'px-2 sm:px-2.5'
                            } py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 ${
                              isActive
                                ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] border border-transparent'
                            }`}
                          >
                            <span className="relative flex items-center justify-center">
                              <IconComponent
                                size={12}
                                className={isActive ? 'text-neutral-100' : 'text-neutral-400'}
                              />
                              {item.badge && (
                                <span className="absolute -top-1 -right-1.5 flex h-2.5 min-w-[10px] items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] font-bold text-black ring-1 ring-black">
                                  {item.badge}
                                </span>
                              )}
                              {!item.badge && item.hasUser && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
                              )}
                            </span>
                            {item.label ? (
                              <span className="text-[0.56rem] sm:text-[0.58rem] font-medium tracking-[0.12em] sm:tracking-[0.16em] uppercase">
                                {item.label}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </nav>
                </div>


              </>,
              document.body
            )}
          </main>
        </div>
      </div>
    </div>

    {/* ============================================================ */}
    {/* VIEW 2: CANDIDATE INTERVIEWS (HORIZONTAL SLIDE PAGE UI)      */}
    {/* ============================================================ */}
    <div className="w-[100vw] min-w-[100vw] min-h-screen shrink-0 flex flex-col lg:flex-row bg-[#08090b] relative overflow-x-hidden">
      {/* Main Left Section: Dark Canvas (~75% on Desktop) */}
      <main className="flex-1 min-w-0 bg-[#08090b] text-white p-3.5 sm:p-6 lg:p-8 xl:p-10 flex flex-col relative h-screen max-h-screen overflow-hidden">
        <Backdrop tone="dark" />

        <div className="relative z-10 flex flex-col flex-1 min-h-0 h-full">
          {/* Pinned Top Header (Non-scrolling) */}
          <div className="shrink-0">
            {/* Top Navigation Bar: ← Platform Overview & Candidate Profile Pill */}
            <div className="flex items-center justify-between gap-4 pb-2">
              {/* Back to Platform Overview */}
              <button
                type="button"
                onClick={() => {
                  setIsInterviewViewOpen(false);
                  setActiveNavTab('home');
                }}
                className="inline-flex items-center gap-2.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium tracking-wide">Platform Overview</span>
              </button>

              {/* Candidate Profile Pill / Sign In */}
              <div className="relative">
                {candidateUser ? (
                  <button
                    type="button"
                    onClick={() => setShowCandidateMenu(!showCandidateMenu)}
                    className="flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-neutral-900 border border-white/20 text-white font-bold text-[10px] flex items-center justify-center">
                      {(candidateUser.candidate_name || candidateUser.candidate_email || 'C').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                      {candidateUser.candidate_name || candidateUser.candidate_email}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Candidate</span>
                    <ChevronDown size={14} className="text-neutral-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalTab('login');
                      setShowAuthModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <User size={12} className="text-white/70" />
                    <span>Sign In</span>
                  </button>
                )}

                {/* Candidate Dropdown Menu */}
                {showCandidateMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#0f1218] border border-white/10 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        setShowSetupModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <User size={13} />
                      <span>Profile Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        setShowMyAppsModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <FileText size={13} />
                      <span>My Applications</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        setShowOnboardingModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles size={13} className="text-white/80" />
                      <span>Onboarding Tour</span>
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCandidateMenu(false);
                        handleCandidateLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {hasInterviewAccess && (
              <>
                {/* Title & Subtitle */}
                <div className="mt-4 sm:mt-6 mb-4">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Upcoming Interviews
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-neutral-400">
                    Your scheduled interviews with companies.
                  </p>
                </div>

                {/* Filter Tabs, Search & Sort Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap pb-1">
                    {[
                      { id: 'all', label: `All (${allCount})` },
                      { id: 'upcoming', label: `Upcoming (${upcomingCount})` },
                      { id: 'completed', label: `Completed (${completedCount})` },
                      { id: 'cancelled', label: `Cancelled (${cancelledCount})` },
                    ].map((tab) => {
                      const isActive = interviewFilterTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setInterviewFilterTab(tab.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 cursor-pointer ${
                            isActive
                              ? 'bg-white text-neutral-950 shadow-md font-bold'
                              : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 font-medium'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search & Sort Controls */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-1 sm:w-56">
                      <Search
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={interviewSearch}
                        onChange={(e) => setInterviewSearch(e.target.value)}
                        placeholder="Search interviews..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-white/30 transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setInterviewSortAsc(!interviewSortAsc)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-2 transition cursor-pointer shrink-0"
                      title="Toggle sorting order"
                    >
                      <Calendar size={13} className="text-neutral-400" />
                      <span>{interviewSortAsc ? 'Date (Soonest)' : 'Date (Latest)'}</span>
                      <ChevronDown size={13} className="text-neutral-400" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {loadingInterviews ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
              <div className="text-xs text-neutral-400 font-medium tracking-wide">
                Loading your scheduled interviews...
              </div>
            </div>
          ) : !candidateUser ? (
            /* Not Signed In State */
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 sm:p-8 text-center max-w-md mx-auto my-auto">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-neutral-400">
                <User size={28} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Sign In Required</h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Your interviews and AI evaluations are tied to your verified candidate account. Please sign in to view your scheduled rounds.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalTab('login');
                    setShowAuthModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition cursor-pointer flex items-center gap-2 shadow"
                >
                  <User size={14} />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInterviewViewOpen(false);
                    setActiveNavTab('home');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white font-bold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <ArrowLeft size={14} />
                  <span>Browse Open Roles</span>
                </button>
              </div>
            </div>
          ) : !hasInterviewAccess ? (
            /* Access Restricted State */
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 sm:p-8 text-center max-w-md mx-auto my-auto">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-neutral-400">
                <Video size={28} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">No Active Interviews</h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                When enterprise hiring partners schedule an interview or AI evaluation with you, your invitations and live meeting links will appear here automatically.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsInterviewViewOpen(false);
                    setActiveNavTab('home');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition cursor-pointer flex items-center gap-2 shadow"
                >
                  <ArrowLeft size={14} />
                  <span>Browse Open Roles</span>
                </button>
                <Link
                  to="/interview/login"
                  className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white font-bold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <Video size={14} className="text-emerald-400" />
                  <span>Passcode Login</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Interview Cards List (The Marked Portion - ONLY this section scrolls, scrollbar hidden) */
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-32 sm:pb-24 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredInterviews.length === 0 ? (
                  <div className="py-16 text-center rounded-2xl bg-white/[0.02] border border-white/5">
                    <Calendar size={32} className="mx-auto text-neutral-600 mb-3" />
                    <h3 className="text-base font-bold text-white">No interviews found</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                      {interviewSearch
                        ? `No scheduled or past interviews matching "${interviewSearch}".`
                        : 'You currently have no interviews in this category.'}
                    </p>
                  </div>
                ) : (
                  filteredInterviews.map((round) => {
                    const badge = round.date_badge || parseInterviewDateBadge(round.scheduled_date);
                    const isUpcoming = round.status === 'Upcoming';
                    const isCompleted = round.status === 'Completed';
                    const isCancelled = round.status === 'Cancelled';
                    const isLive = round.is_live_now;
                    const canEnter = Boolean(round.can_enter);
                    const typeConfig = getRoundTypeConfig(round.round_name, round.round_number);
                    const statusInfo = round.status_info || getStatusBadgeInfo(round, null, isLive, isCompleted, isCancelled, false);
                    const IconComponent = typeConfig.icon;

                    return (
                      <div
                        key={round.id}
                        className={`rounded-2xl transition-all duration-200 relative p-4 sm:p-5 lg:py-5 lg:px-6 ${
                          canEnter
                            ? 'bg-[#0b0e14] border border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.14)]'
                            : 'bg-[#0b0e14] border border-white/10 hover:border-white/20 shadow-lg'
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
                          {/* Left Section: Date Box + Role Info */}
                          <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                            {/* Date Box */}
                            <div className="shrink-0 w-12 sm:w-14 flex flex-col items-center justify-center text-center select-none py-0.5 pr-4 border-r border-white/10">
                              <span className="text-[10.5px] font-bold text-neutral-400 tracking-wider uppercase leading-none">
                                {badge.month}
                              </span>
                              <span className="text-2xl sm:text-3xl font-black text-white leading-tight my-1 tracking-tight">
                                {badge.day}
                              </span>
                              <span className="text-[9.5px] font-bold text-neutral-500 tracking-widest uppercase leading-none">
                                {badge.dayOfWeek}
                              </span>
                            </div>

                            {/* Round Name, Company & Badges */}
                            <div className="min-w-0 flex-1">
                              {/* Title + Icon */}
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${typeConfig.iconBoxStyle}`}>
                                  <IconComponent size={16} />
                                </div>
                                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                                  {round.round_name}
                                </h3>
                              </div>

                              {/* Company Name & Requisition */}
                              <div className="mt-1.5 pl-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded bg-neutral-800 border border-white/10 text-[9px] font-bold text-neutral-300 flex items-center justify-center shrink-0">
                                    {round.company_logo_letter}
                                  </span>
                                  <span className="text-xs font-semibold text-neutral-200 truncate">
                                    {round.company_name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                                  {round.requisition_title} · {round.requisition_id}
                                </div>
                              </div>

                              {/* Badges: Round X + Category */}
                              <div className="flex items-center gap-2 mt-2 pl-0.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${typeConfig.pillStyle}`}>
                                  {typeConfig.roundPill}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] text-neutral-300 border border-white/10 text-[10.5px] font-medium">
                                  {typeConfig.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Middle Section: Time, Mode, Interviewer */}
                          <div className="hidden md:flex items-center gap-6 xl:gap-8 shrink-0">
                            {/* Time */}
                            <div className="min-w-[145px]">
                              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                                <Clock size={15} className="text-neutral-400 shrink-0" />
                                <span>{round.time_range}</span>
                              </div>
                              <div className="text-[11.5px] text-neutral-400 pl-6 mt-0.5 font-normal">
                                {round.time_duration}
                              </div>
                            </div>

                            {/* Mode */}
                            <div className="min-w-[115px]">
                              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                                <Video size={15} className="text-neutral-400 shrink-0" />
                                <span>Online</span>
                              </div>
                              <div className="text-[11.5px] text-neutral-400 pl-6 mt-0.5 font-normal">
                                (Term Jobs Panel)
                              </div>
                            </div>

                            {/* Interviewer */}
                            <div className="min-w-[155px] flex items-center gap-3">
                              {round.interviewer_avatar ? (
                                <img
                                  src={round.interviewer_avatar}
                                  alt={round.interviewer_name}
                                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-[11px] font-bold text-neutral-200 shrink-0">
                                  {(round.interviewer_name || 'I').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[9.5px] text-neutral-400 font-medium tracking-wide">
                                  Interviewer
                                </div>
                                <div className="text-xs font-bold text-white leading-tight truncate">
                                  {round.interviewer_name}
                                </div>
                                <div className="text-[10.5px] text-neutral-400 leading-tight mt-0.5 truncate">
                                  {round.interviewer_role}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Responsive Mobile Sub-Row */}
                          <div className="flex md:hidden items-center justify-between gap-3 pt-2.5 border-t border-white/5 text-xs text-neutral-300">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-neutral-400" />
                              <span>{round.time_range}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Video size={13} className="text-neutral-400" />
                              <span>Online</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[110px]">
                              {round.interviewer_name}
                            </div>
                          </div>

                          {/* Right Section: Status Badge + Action Buttons + 3-Dot */}
                          <div className="shrink-0 flex flex-row xl:flex-col items-center xl:items-end justify-between xl:justify-center gap-3">
                            {/* Status Badge */}
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border ${statusInfo.style}`}>
                              <span className="text-[9px]">{statusInfo.icon}</span>
                              <span>{statusInfo.text}</span>
                            </div>

                            {/* Action Buttons + 3-Dot */}
                            <div className="flex items-center gap-2 relative interview-card-menu">
                              {canEnter ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const name = encodeURIComponent(
                                      candidateUser?.candidate_name || round.candidate_name || 'Candidate'
                                    );
                                    const token = encodeURIComponent(round.candidate_token || '');
                                    const isAi = round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai'));
                                    const path = isAi ? 'ai' : 'room';
                                    navigate(
                                      `/interview/${path}/${round.id}?role=candidate&name=${name}&token=${token}`
                                    );
                                  }}
                                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs transition shadow flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                                >
                                  {round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai')) ? (
                                    <Sparkles size={13} className="text-emerald-600" />
                                  ) : (
                                    <Video size={13} className="text-neutral-950" />
                                  )}
                                  <span>{round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai')) ? 'Start AI Interview' : 'Enter Interview'}</span>
                                  <ArrowRight size={13} className="text-neutral-950" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetailRound(round)}
                                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 font-medium text-xs transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                                >
                                  <span>View Details</span>
                                  <ArrowRight size={13} className="text-neutral-400" />
                                </button>
                              )}

                              {/* 3-Dot Dropdown Trigger */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMenuRoundId(
                                      activeMenuRoundId === round.id ? null : round.id
                                    )
                                  }
                                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                                    activeMenuRoundId === round.id
                                      ? 'bg-white/[0.12] text-white border-white/30'
                                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white border-white/10'
                                  }`}
                                  title="More Options"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {/* Functional 3-Dot Menu Dropdown */}
                                {activeMenuRoundId === round.id && (
                                  <div
                                    className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-[#0f1218] border border-white/15 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleCopyMeetingLink(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      {copiedRoundId === round.id ? (
                                        <>
                                          <Check size={13} className="text-emerald-400" />
                                          <span className="text-emerald-400 font-semibold">
                                            Link Copied!
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={13} className="text-neutral-400" />
                                          <span>Copy Meeting Link</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSendInterviewEmail(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Mail size={13} className="text-neutral-400" />
                                      <span>
                                        {resendingEmailId === round.id
                                          ? 'Sending Invite...'
                                          : emailSentStatus[round.id] === 'sent'
                                          ? 'Invite Sent!'
                                          : 'Resend Email Invite'}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAddToCalendar(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Calendar size={13} className="text-neutral-400" />
                                      <span>Add to Calendar</span>
                                    </button>

                                    <div className="h-px bg-white/10 my-1" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedDetailRound(round);
                                        setActiveMenuRoundId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                      <Eye size={13} className="text-neutral-400" />
                                      <span>View Details</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          )}

          {/* Interview Round Details Modal */}
          {selectedDetailRound && typeof document !== 'undefined' && createPortal(
            (() => {
              const isDetailCompleted = selectedDetailRound.status === 'Completed' || selectedDetailRound.status === 'Evaluated';
              const isDetailCancelled = selectedDetailRound.status === 'Cancelled' || selectedDetailRound.status === 'Rejected';
              const candidateDisplayName = candidateUser?.candidate_name || candidateUser?.name || selectedDetailRound.candidate_name || 'Candidate';
              const candidateDisplayEmail = candidateUser?.candidate_email || candidateUser?.email || selectedDetailRound.candidate_email || '';

              return (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
                  onClick={() => setSelectedDetailRound(null)}
                >
                  <div
                    className="relative w-full max-w-xl rounded-2xl bg-[#0f1218] border border-white/15 p-6 sm:p-7 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-300 flex items-center justify-center">
                            {selectedDetailRound.company_logo_letter}
                          </span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {selectedDetailRound.company_name}
                          </span>
                          {isDetailCompleted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 ml-1">
                              ✓ Completed
                            </span>
                          ) : isDetailCancelled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 ml-1">
                              ✕ Cancelled
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ml-1">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">
                          {selectedDetailRound.round_name}
                        </h2>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {selectedDetailRound.requisition_title} · {selectedDetailRound.requisition_id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailRound(null)}
                        className="p-1 rounded-lg hover:bg-white/[0.08] text-neutral-400 hover:text-white transition cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="space-y-3.5 text-xs">
                      {/* If Completed: Prominent Real Status Banner */}
                      {isDetailCompleted && (
                        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Check size={16} className="stroke-[2.5]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white">Interview Completed & Under Review</div>
                            <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                              Your interview session has concluded. Feedback and responses are actively being reviewed by the hiring team at {selectedDetailRound.company_name}.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Schedule Grid */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium flex items-center gap-1.5">
                            <Calendar size={12} className="text-neutral-500" />
                            <span>Date</span>
                          </div>
                          <div className="text-xs font-semibold text-white mt-1">
                            {selectedDetailRound.scheduled_date_display}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium flex items-center gap-1.5">
                            <Clock size={12} className="text-neutral-500" />
                            <span>Time & Duration</span>
                          </div>
                          <div className="text-xs font-semibold text-white mt-1">
                            {selectedDetailRound.time_range}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {selectedDetailRound.time_duration}
                          </div>
                        </div>
                      </div>

                      {/* Interviewer & Mode */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Interviewer</div>
                          <div className="text-xs font-bold text-white mt-1">{selectedDetailRound.interviewer_name}</div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">{selectedDetailRound.interviewer_role}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Interview Format</div>
                          <div className="text-xs font-bold text-white mt-1">
                            {selectedDetailRound.round_type === 'AI' ? 'AI Assessment Session' : 'Online Hosted Room'}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">Term Jobs Dedicated Panel</div>
                        </div>
                      </div>

                      {/* Candidate Details */}
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Name</div>
                          <div className="text-xs font-bold text-white mt-1">{candidateDisplayName}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Email</div>
                          <div className="text-xs font-mono text-zinc-300 mt-1 truncate">{candidateDisplayEmail}</div>
                        </div>
                      </div>

                      {/* If NOT completed: Show Passcode & Checklist */}
                      {!isDetailCompleted && selectedDetailRound.candidate_passcode && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-neutral-400 uppercase font-medium">Candidate Passcode</div>
                            <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5 tracking-wider">
                              {selectedDetailRound.candidate_passcode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyMeetingLink(selectedDetailRound)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedRoundId === selectedDetailRound.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {!isDetailCompleted && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-neutral-400 text-[11px]">
                          <div className="text-neutral-300 font-semibold text-xs mb-1">Preparation Checklist:</div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Ensure working webcam & microphone before joining</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Join from a quiet, well-lit environment</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span>Use Google Chrome, Brave or Microsoft Edge</span>
                          </div>
                        </div>
                      )}

                      {/* If Completed: Post-Interview Information Notice */}
                      {isDetailCompleted && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-neutral-400 text-[11px]">
                          <div className="text-neutral-300 font-semibold text-xs mb-1">Post-Interview Status:</div>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span>Evaluation feedback and notes are under review by the hiring manager</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>You will receive an automated email regarding round progression or decision status</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailRound(null)}
                        className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-neutral-200 hover:text-white transition cursor-pointer"
                      >
                        Close
                      </button>
                      {/* ONLY show Join Meeting Room button if round is NOT completed and is ready */}
                      {!isDetailCompleted && selectedDetailRound.is_ready && (
                        <button
                          type="button"
                          onClick={() => {
                            const name = encodeURIComponent(
                              candidateDisplayName || 'Candidate'
                            );
                            const token = encodeURIComponent(selectedDetailRound.candidate_token || '');
                            const isAi = selectedDetailRound.round_type === 'AI' || (selectedDetailRound.round_name && selectedDetailRound.round_name.toLowerCase().includes('ai'));
                            const path = isAi ? 'ai' : 'room';
                            navigate(
                              `/interview/${path}/${selectedDetailRound.id}?role=candidate&name=${name}&token=${token}`
                            );
                          }}
                          className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs transition shadow flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          {selectedDetailRound.round_type === 'AI' || (selectedDetailRound.round_name && selectedDetailRound.round_name.toLowerCase().includes('ai')) ? (
                            <Sparkles size={13} className="text-emerald-600" />
                          ) : (
                            <Video size={13} />
                          )}
                          <span>{selectedDetailRound.round_type === 'AI' || (selectedDetailRound.round_name && selectedDetailRound.round_name.toLowerCase().includes('ai')) ? 'Start AI Interview' : 'Join Meeting Room'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </div>
      </main>

      {/* Right White Editorial Sidebar (Exact Match to Screenshot) */}
      <aside className="hidden lg:flex w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 bg-paper text-ink border-l border-ink/10 flex-col justify-between relative overflow-hidden h-screen max-h-screen sticky top-0 p-6 sm:p-8">
        <Backdrop tone="sidebar" />
        <div className="relative z-10 flex flex-col h-full justify-between">
          {/* Top: Logo & Platform Identity */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-black text-sm shadow-sm">
                <Briefcase size={16} className="text-white" />
              </div>
              <div>
                <div className="text-[12px] font-extrabold tracking-[0.2em] uppercase text-neutral-900 leading-tight">
                  TERMJOBS
                </div>
                <div className="text-[8.5px] font-bold tracking-[0.18em] uppercase text-neutral-400">
                  CONTRACT WORKFORCE PLATFORM
                </div>
              </div>
            </div>

            {/* Vertical decorative accent line */}
            <div className="w-0.5 h-10 bg-neutral-900/20 my-8 ml-1" />

            {/* Eyebrow */}
            <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-neutral-400 mb-2">
              CONTRACT WORKFORCE PLATFORM
            </div>

            {/* Headline Display */}
            <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-950 tracking-tight leading-[1.05]">
              Your<br />Interviews.
            </h2>

            {/* 3 Metric Cards in a Grid */}
            <div className="mt-8 grid grid-cols-3 gap-2.5">
              {/* Card 1: Upcoming */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <Calendar size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {upcomingCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  UPCOMING
                </div>
              </div>

              {/* Card 2: Completed */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {completedCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  COMPLETED
                </div>
              </div>

              {/* Card 3: Cancelled */}
              <div className="p-3 rounded-2xl bg-black/[0.02] border border-neutral-900/10 flex flex-col items-center justify-center text-center">
                <X size={15} className="text-neutral-500 mb-2" />
                <div className="text-2xl font-black text-neutral-900 leading-none mb-1">
                  {cancelledCount}
                </div>
                <div className="text-[8.5px] font-bold text-neutral-500 tracking-wider uppercase">
                  CANCELLED
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

      {/* ============================================================ */}
      {/* MODAL 1: VIEW JOB DETAILS & 1-CLICK APPLY                    */}
      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* MODAL 1: JOB DETAILS (2-COLUMN DESIGN MATCHING IMAGE 2)      */}
      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* MODAL 1: JOB DETAILS (CLEAN WHITE THEME)                     */}
      {/* ============================================================ */}
      {selectedJob && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="rounded-3xl bg-white border border-neutral-200 shadow-[0_25px_80px_rgba(0,0,0,0.25)] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto text-neutral-900">
            {/* Header: Company & Action Icons */}
            <div className="p-5 pb-3 sm:px-6 sm:pt-5 sm:pb-3 border-b border-neutral-200/80 flex items-center justify-between gap-3 bg-neutral-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyAvatar job={selectedJob} size="w-7 h-7" inModal={true} />
                <span className="text-xs sm:text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-1.5 truncate">
                  <span className="truncate">{selectedJob.company_name || 'Hiring Partner'}</span>
                  <CheckCircle2 size={13} className="text-sky-600 fill-sky-100 shrink-0" />
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => toggleSaveJob(selectedJob.id || selectedJob._id, e)}
                  className={`p-2 rounded-full transition cursor-pointer border ${
                    savedJobIds.has(String(selectedJob.id)) || (selectedJob._id && savedJobIds.has(String(selectedJob._id)))
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                      : 'bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 border-neutral-200'
                  }`}
                  title="Save Role"
                >
                  <Bookmark size={15} className={savedJobIds.has(String(selectedJob.id)) || (selectedJob._id && savedJobIds.has(String(selectedJob._id))) ? 'fill-white' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(publicJobUrl(selectedJob))
                        .then(() => {
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        })
                        .catch(() => setCopiedLink(false));
                    }
                  }}
                  className="p-2 rounded-full bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 border border-neutral-200 transition cursor-pointer relative"
                  title="Share Role"
                >
                  <Share2 size={15} />
                  {copiedLink && (
                    <span className="absolute -bottom-7 right-0 text-[10px] font-bold bg-neutral-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="p-2 rounded-full bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 border border-neutral-200 transition cursor-pointer ml-1"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Title, Meta Badges & Due Date Banner */}
            <div className="px-5 pt-4 pb-4 sm:px-6 sm:pt-4 sm:pb-4 border-b border-neutral-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-neutral-950 tracking-tight">
                  {selectedJob.title}
                </h2>

                {/* Meta pills row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700 mt-2 font-medium">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 border border-neutral-200 text-neutral-800">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      (selectedJob.structured_role?.work_mode || '').toLowerCase().includes('remote')
                        ? 'bg-emerald-500'
                        : (selectedJob.structured_role?.work_mode || '').toLowerCase().includes('hybrid')
                        ? 'bg-sky-500'
                        : 'bg-amber-500'
                    }`} />
                    <span>{selectedJob.structured_role?.work_mode || 'Onsite'}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 border border-neutral-200 text-neutral-700">
                    <Briefcase size={11} className="text-neutral-500" />
                    <span>{selectedJob.structured_role?.duration || selectedJob.structured_role?.engagement_type || 'Permanent'}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 border border-neutral-200 text-neutral-700">
                    <User size={11} className="text-neutral-500" />
                    <span>{selectedJob.structured_role?.experience || selectedJob.experience || 'Experienced'}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 border border-neutral-200 text-neutral-700">
                    <MapPin size={11} className="text-neutral-500" />
                    <span>{getLocationDisplay(selectedJob)}</span>
                  </span>
                </div>
              </div>

              {/* Application Due Card */}
              {(() => {
                const dVal = selectedJob.due_date || selectedJob.submission_deadline || selectedJob.application_due_date || selectedJob.structured_role?.submission_deadline;
                const dInfo = formatDueDate(dVal);
                if (!dInfo) return null;
                return (
                  <div className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center gap-3 shrink-0 self-start md:self-auto shadow-sm">
                    <Calendar size={18} className="text-neutral-500 shrink-0" />
                    <div>
                      <div className="text-[10px] text-neutral-500 font-medium">Application Due</div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-900">{dInfo.text}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full font-bold text-[10.5px] bg-emerald-50 border border-emerald-200 text-emerald-700 ml-1">
                      {dInfo.daysLeft}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Scrollable Body: 2 Columns */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans scrollbar-thin bg-white">
              {submitSuccess ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">Application Submitted Successfully!</h3>
                  <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
                    {submitSuccess.round_id
                      ? 'Your profile has been verified and your AI Interview is ready right now! You can start immediately below or access it anytime from the Interviews tab.'
                      : `Your candidate profile has been sent directly to ${selectedJob?.company_name || 'the hiring partner'}. You will receive interview updates via email and Telegram.`}
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {submitSuccess.round_id ? (
                      <button
                        type="button"
                        onClick={() => {
                          const roundId = submitSuccess.round_id;
                          const candName = submitSuccess.candidate_name || candidateUser?.candidate_name || 'Candidate';
                          const candToken = submitSuccess.candidate_token || submitSuccess.outreach_token || '';
                          setSelectedJob(null);
                          navigate(`/interview/ai/${roundId}?role=candidate&name=${encodeURIComponent(candName)}&token=${encodeURIComponent(candToken)}`);
                        }}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                      >
                        <Sparkles size={15} />
                        <span>Start AI Interview Now</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(null);
                        setIsInterviewViewOpen(true);
                        setActiveNavTab('interview');
                        if (typeof loadCandidateInterviews === 'function') {
                          loadCandidateInterviews(applicantEmail);
                        }
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>View in My Interviews</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedJob(null)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium text-xs transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Two Columns Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                    {/* Left Column: Job Details Accordions (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Accordion Cards */}
                      <div className="space-y-2">
                        {/* 1. About the Company */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, company: !prev.company }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <Building2 size={14} className="text-neutral-500" />
                              <span>About the Company</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.company ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.company && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.company) }}
                            />
                          )}
                        </div>

                        {/* 2. About the Role */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, role: !prev.role }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <User size={14} className="text-neutral-500" />
                              <span>About the Role</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.role ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.role && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.role) }}
                            />
                          )}
                        </div>

                        {/* 3. Key Responsibilities */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, responsibilities: !prev.responsibilities }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <Layers size={14} className="text-neutral-500" />
                              <span>Key Responsibilities</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.responsibilities ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.responsibilities && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.responsibilities) }}
                            />
                          )}
                        </div>

                        {/* 4. Required Qualifications */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, qualifications: !prev.qualifications }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <GraduationCap size={14} className="text-neutral-500" />
                              <span>Required Qualifications</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.qualifications ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.qualifications && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.qualifications) }}
                            />
                          )}
                        </div>

                        {/* 5. Preferred Skills */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, skills: !prev.skills }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <Star size={14} className="text-neutral-500" />
                              <span>Preferred Skills</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.skills ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.skills && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.skills) }}
                            />
                          )}
                        </div>

                        {/* 6. Employment Details */}
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({ ...prev, employment: !prev.employment }))}
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 font-bold text-xs text-neutral-900">
                              <Briefcase size={14} className="text-neutral-500" />
                              <span>Employment Details</span>
                            </span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-200 ${expandedSections.employment ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedSections.employment && (
                            <div
                              className="px-4 pb-4 pt-2 text-xs text-neutral-700 border-t border-neutral-200/80 prose prose-xs max-w-none leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: marked.parse(parsedJobSections.employment) }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Key Highlights & Core Competencies (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Card 1: Key Highlights */}
                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider">
                          <Zap size={13} className="text-amber-500" />
                          <span>Key Highlights</span>
                        </div>

                        <div className="space-y-2.5 pt-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-neutral-500">
                              <Layers size={13} />
                              <span>Role</span>
                            </span>
                            <span className="font-semibold text-neutral-900 text-right truncate max-w-[170px]">{selectedJob.title}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-neutral-500">
                              <User size={13} />
                              <span>Experience</span>
                            </span>
                            <span className="font-semibold text-neutral-900 text-right">{selectedJob.structured_role?.experience || selectedJob.experience || 'Experienced'}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-neutral-500">
                              <Building2 size={13} />
                              <span>Work Mode</span>
                            </span>
                            <span className="font-semibold text-neutral-900 text-right">{selectedJob.structured_role?.work_mode || selectedJob.work_mode || 'Onsite'}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-neutral-500">
                              <Briefcase size={13} />
                              <span>Employment</span>
                            </span>
                            <span className="font-semibold text-neutral-900 text-right">{selectedJob.structured_role?.duration || selectedJob.structured_role?.engagement_type || 'Full-time, Permanent'}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-neutral-500">
                              <MapPin size={13} />
                              <span>Location</span>
                            </span>
                            <span className="font-semibold text-neutral-900 text-right truncate max-w-[170px]">{getLocationDisplay(selectedJob)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Core Competencies */}
                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider">
                          <Code2 size={13} className="text-neutral-700" />
                          <span>Core Competencies</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {((selectedJob.structured_role?.must_have_skills || []).concat(selectedJob.structured_role?.nice_to_have_skills || []))
                            .filter((s) => s && typeof s === 'string' && s.trim())
                            .map((skill) => (
                              <span
                                key={skill}
                                className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-[11px] font-medium text-neutral-800 shadow-sm"
                              >
                                {skill}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Bottom Footer Bar */}
            <div className="p-4 sm:px-6 sm:py-3.5 border-t border-neutral-200 bg-neutral-50/90 flex items-center justify-between gap-3 shrink-0">
              {/* Left Trust Indicators */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[11px] text-neutral-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck size={14} className="text-neutral-500" />
                  <span>1-Click Verified Apply</span>
                </span>
                <span className="hidden sm:flex items-center gap-1.5 font-medium">
                  <Users size={14} className="text-neutral-500" />
                  <span>Direct Partner Review</span>
                </span>
                <span className="hidden md:flex items-center gap-1.5 font-medium">
                  <Activity size={14} className="text-neutral-500" />
                  <span>Live Interview Status</span>
                </span>
              </div>

              {/* Right Action Button */}
              <div>
                {isSelectedJobApplied ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJob(null);
                      setShowMyAppsModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold text-xs tracking-tight transition shadow-sm cursor-pointer"
                  >
                    <Check size={13} className="text-emerald-600" />
                    <span>Applied</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!candidateUser) {
                        setShowAuthModal(true);
                      } else {
                        handleApplySubmit(e);
                      }
                    }}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-neutral-950 hover:bg-black text-white font-bold text-xs tracking-tight transition shadow-md cursor-pointer active:scale-95 shrink-0"
                  >
                    <span>{submitting ? 'Submitting...' : 'Apply Now'}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* ============================================================ */}
      {/* MODAL 2: MY APPLICATIONS DRAWER                              */}
      {/* ============================================================ */}
      {showMyAppsModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-neutral-900">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-neutral-900">Your Submitted Applications</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowMyAppsModal(false);
                    setShowOnboardingModal(true);
                  }}
                  className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-neutral-300 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title="View Candidate Onboarding Tour"
                >
                  <Sparkles size={11} className="text-neutral-700" />
                  <span>Tour</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowMyAppsModal(false)}
                className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {displayedApplications.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  You haven't submitted any applications yet.
                </div>
              ) : (
                displayedApplications.map((app, i) => {
                  const matchingRound = (allCandidateInterviewRounds || []).find(
                    (r) => r.requisition_id === app.requisition_id || (r.requisition_title && app.requisition_title && r.requisition_title.toLowerCase() === app.requisition_title.toLowerCase())
                  );
                  const matchingOutreach = (outreachHistory || []).find(
                    (o) => o.requisition_id === app.requisition_id
                  );
                  const hasAiInterview = Boolean(
                    matchingRound || (matchingOutreach?.meeting_link && matchingOutreach?.status === 'interested') || app.status === 'Interested - Fast Track'
                  );
                  const aiMeetingLink = matchingRound?.meeting_link || matchingOutreach?.meeting_link;
                  const isAi = matchingRound ? (matchingRound.round_type === 'AI' || (matchingRound.round_name && matchingRound.round_name.toLowerCase().includes('ai'))) : true;

                  const matchedReq = requisitions.find(
                    (r) => String(r.id) === String(app.requisition_id) || String(r._id) === String(app.requisition_id)
                  );
                  const roleTitle = (app.requisition_title && app.requisition_title !== 'Open Requisition' && app.requisition_title !== 'Contract Position')
                    ? app.requisition_title
                    : (matchedReq?.title || app.requisition_title || 'Role Application');
                  const compName = (app.company_name && app.company_name !== 'Enterprise Partner' && app.company_name !== 'Enterprise Client')
                    ? app.company_name
                    : (matchedReq?.company_name || matchedReq?.company || app.company_name || 'Enterprise Client');

                  return (
                    <div key={i} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="text-xs font-bold text-neutral-900">{roleTitle}</div>
                        <div className="text-[11px] text-neutral-500">{compName}</div>
                        {matchingRound?.candidate_passcode && (
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Passcode: {matchingRound.candidate_passcode}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          app.status === 'Interested - Fast Track'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-neutral-200 text-neutral-800 border-neutral-300'
                        }`}>
                          {app.status || 'Submitted'}
                        </span>
                        {hasAiInterview && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMyAppsModal(false);
                              if (matchingRound) {
                                const name = encodeURIComponent(candidateUser?.candidate_name || 'Candidate');
                                const token = encodeURIComponent(matchingRound.candidate_token || '');
                                const path = isAi ? 'ai' : 'room';
                                navigate(`/interview/${path}/${matchingRound.id}?role=candidate&name=${name}&token=${token}`);
                              } else if (aiMeetingLink && aiMeetingLink.startsWith('http')) {
                                window.open(aiMeetingLink, '_blank');
                              } else {
                                setIsInterviewViewOpen(true);
                                setActiveNavTab('interview');
                              }
                            }}
                            className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition cursor-pointer"
                          >
                            <Sparkles size={11} />
                            <span>{isAi ? 'Start AI Interview' : 'Enter Interview'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CANDIDATE PROFILE SETUP / EDIT                      */}
      {/* ============================================================ */}
      {showResumePreview && candidateAuth?.candidateToken && (
        <ResumePreviewModal token={candidateAuth.candidateToken}
          filename={currentResumeName}
          extractedText={candidateUser?.extracted_text || ''}
          onClose={() => setShowResumePreview(false)} />
      )}

      {showSetupModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-auto text-neutral-900">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Candidate Profile & Resume</h3>
                <p className="text-xs text-neutral-500">Keep your details up to date for instant 1-click applications.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {setupSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-900">Profile Updated Successfully</h4>
              </div>
            ) : (
              <form onSubmit={handleSetupSubmit} className="mt-4 space-y-3.5 text-xs">
                {setupError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {setupError}
                  </div>
                )}

                <CandidateEmailEditor />

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={setupForm.name}
                    onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={setupForm.phone}
                    onChange={(e) => {
                      setSetupForm({ ...setupForm, phone: e.target.value });
                      if (setupError) setSetupError(null);
                    }}
                    placeholder="e.g. 9876543210 or +91 9876543210"
                    className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                      setupForm.phone && validatePhone(setupForm.phone)
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                    } rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:ring-1 transition-all`}
                  />
                  {setupForm.phone && validatePhone(setupForm.phone) && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {validatePhone(setupForm.phone)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={setupForm.title}
                    onChange={(e) => setSetupForm({ ...setupForm, title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase">Master Resume (On File)</label>
                    {hasResume ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check size={11} /> Verified Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Upload Required
                      </span>
                    )}
                  </div>

                  {hasResume ? (
                    <div className="space-y-2">
                      <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-neutral-200/80 border border-neutral-300 text-neutral-700 flex items-center justify-center shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-xs font-bold text-neutral-900 truncate">{currentResumeName || 'candidate_resume.pdf'}</div>
                            <div className="text-[10.5px] text-neutral-500">Ready for instant 1-click applications</div>
                          </div>
                        </div>
                        {candidateAuth?.candidateToken && (
                          <button type="button" onClick={() => setShowResumePreview(true)} aria-haspopup="dialog"
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-300 text-[11px] font-semibold text-neutral-800 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                            title="Preview your master resume">
                            <FileText size={12} />
                            <span>View Uploaded Resume</span>
                          </button>
                        )}
                      </div>

                      <div className="pt-1">
                        <label className="block text-[10.5px] font-semibold text-neutral-600 uppercase mb-1">
                          Update / Replace Resume File (Optional)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc"
                          onChange={(e) => setSetupResumeFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-neutral-200 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition cursor-pointer"
                        />
                        {setupResumeFile && (
                          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
                            <Check size={12} /> Selected for update: {setupResumeFile.name} ({(setupResumeFile.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        onClick={() => setupFileInputRef.current?.click()}
                        className="p-5 border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50/60 hover:bg-neutral-50 rounded-2xl text-center cursor-pointer transition"
                      >
                        <input
                          type="file"
                          ref={setupFileInputRef}
                          accept=".pdf,.docx,.doc"
                          onChange={(e) => setSetupResumeFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <Upload size={22} className="text-neutral-400 mx-auto mb-1.5" />
                        {setupResumeFile ? (
                          <div className="text-xs font-bold text-neutral-900 flex items-center justify-center gap-1.5">
                            <Check size={14} className="text-emerald-600" />
                            <span>{setupResumeFile.name} ({(setupResumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs font-semibold text-neutral-800">Click or drag resume here to upload</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">PDF or DOCX (up to 10MB)</div>
                          </>
                        )}
                      </div>
                      <div className="text-[10.5px] text-neutral-500 mt-1.5">
                        Uploading a resume enables 1-click applications across all enterprise partner roles.
                      </div>
                    </div>
                  )}
                </div>

                {hasResume && !setupResumeFile && (
                  <div className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-neutral-700 uppercase">Skills from resume</span>
                      <button type="button" onClick={() => { if (editingSkills) setSetupForm((prev) => ({ ...prev, skills: (Array.isArray(candidateUser?.skills) ? candidateUser.skills : []).join(', ') })); setEditingSkills(!editingSkills); }} className="text-xs font-semibold text-neutral-900 underline">
                        {editingSkills ? 'Cancel' : 'Edit Skills'}
                      </button>
                    </div>
                    {editingSkills ? (
                      <input type="text" aria-label="Edit Skills" value={setupForm.skills}
                        onChange={(e) => setSetupForm({ ...setupForm, skills: e.target.value })}
                        placeholder="Comma-separated skills" className="mt-2 w-full rounded-lg border border-neutral-300 p-2 text-xs" />
                    ) : (
                      <p className="mt-2 text-xs text-neutral-600">{setupForm.skills || 'No skills found. Choose Edit Skills to add them.'}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={setupSubmitting}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer mt-2 shadow-sm"
                >
                  {setupSubmitting ? 'Saving Profile...' : 'Save Profile Details'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 4: GENERAL TALENT POOL (PREMIUM WHITE MODAL)            */}
      {/* ============================================================ */}
      {showGeneralPoolModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-200">
          <div className="rounded-3xl bg-white border border-neutral-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.06)] max-w-xl w-full p-6 sm:p-7 my-auto transition-all text-neutral-900">
            <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 mb-1">
                  Candidate Talent Network
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-neutral-900 tracking-tight">
                  Join General Talent Pool
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Get auto-matched with upcoming enterprise contract roles and verified hiring partners.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralPoolModal(false)}
                className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 text-neutral-500 hover:text-neutral-900 transition cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {poolSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 size={30} />
                </div>
                <h4 className="text-base font-bold text-neutral-900">Profile Submitted to Talent Pool</h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  We will notify you via email as soon as an enterprise requisition matching your skillset is published.
                </p>

                {/* Start Telegram Bot Callout */}
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-left max-w-sm mx-auto shadow-sm mt-4">
                  <div className="flex items-center gap-2 text-[#0284c7] font-bold text-xs mb-1">
                    <Send size={14} className="text-[#0284c7]" />
                    <span>Start Bot for 1-Tap Matching Alerts</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed mb-3">
                    Connect <strong>@{TELEGRAM_BOT_USERNAME}</strong> to receive notifications directly in Telegram with 1-tap RSVP buttons.
                  </p>
                  <a
                    href={poolSuccess.telegram_bot_url || `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${poolSuccess.candidate_id || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3.5 rounded-xl bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs transition text-decoration-none cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Start Bot (@{TELEGRAM_BOT_USERNAME})</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowGeneralPoolModal(false);
                    setPoolSuccess(null);
                  }}
                  className="mt-4 px-6 py-2.5 rounded-full bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePoolSubmit} className="mt-5 space-y-4 text-xs">
                {candidateUser && (
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[11px] font-bold">
                        {(candidateUser.candidate_name || candidateUser.candidate_email || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span>Joining as</span>
                          <span className="font-bold text-neutral-900">{candidateUser.candidate_name || candidateUser.candidate_email}</span>
                          <span className="text-[10px] font-bold bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-full">
                            Verified
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          {hasResume ? '✓ Master resume on profile ready' : 'Upload your resume below to complete'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {poolError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-500" />
                    <span>{typeof poolError === 'string' ? poolError : formatApiErrorMessage(poolError)}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.name}
                      onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                      placeholder="e.g. Alex Johnson"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={poolForm.email}
                      onChange={(e) => setPoolForm({ ...poolForm, email: e.target.value })}
                      placeholder="alex@example.com"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={poolForm.phone}
                      onChange={(e) => {
                        setPoolForm({ ...poolForm, phone: e.target.value });
                        if (poolError) setPoolError(null);
                      }}
                      placeholder="e.g. 9876543210 or +91 9876543210"
                      className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                        poolForm.phone && validatePhone(poolForm.phone)
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                      } rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 transition-all`}
                    />
                    {poolForm.phone && validatePhone(poolForm.phone) && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        {validatePhone(poolForm.phone)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Target Title / Role *</label>
                    <input
                      type="text"
                      required
                      value={poolForm.title}
                      onChange={(e) => setPoolForm({ ...poolForm, title: e.target.value })}
                      placeholder="e.g. Senior Frontend Lead"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>


                {/* Resume Dropzone */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Resume Document *
                  </label>

                  {hasResume && !poolUseCustomResume ? (
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText size={18} className="text-neutral-600" />
                        <div>
                          <div className="text-xs font-semibold text-neutral-900">{currentResumeName}</div>
                          <div className="text-[10px] text-neutral-500">Verified resume from candidate profile</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPoolUseCustomResume(true)}
                        className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
                      >
                        Upload different file
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setPoolIsDragging(true);
                      }}
                      onDragLeave={() => setPoolIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setPoolIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setPoolResume(file);
                          setPoolError(null);
                        }
                      }}
                      onClick={() => poolFileInputRef.current?.click()}
                      className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition ${poolIsDragging
                        ? 'border-neutral-900 bg-neutral-100'
                        : 'border-neutral-300 bg-neutral-50/70 hover:border-neutral-400 hover:bg-neutral-50'
                        }`}
                    >
                      <input
                        type="file"
                        ref={poolFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPoolResume(file);
                            setPoolError(null);
                          }
                        }}
                        accept=".pdf,.docx,.doc"
                        className="hidden"
                      />
                      <Upload size={22} className="text-neutral-400 mx-auto mb-2" />
                      {poolResume ? (
                        <div className="text-xs font-semibold text-neutral-900 flex items-center justify-center gap-1.5">
                          <Check size={14} className="text-emerald-600" />
                          <span>{poolResume.name} ({(poolResume.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-semibold text-neutral-800">
                            Drop resume here or click to browse
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-1">PDF, DOCX up to 10MB</div>
                        </>
                      )}
                    </div>
                  )}

                  {poolUseCustomResume && hasResume && (
                    <button
                      type="button"
                      onClick={() => {
                        setPoolUseCustomResume(false);
                        setPoolResume(null);
                      }}
                      className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                    >
                      ← Use saved profile resume instead
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={poolSubmitting}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-md hover:shadow-lg mt-3"
                >
                  {poolSubmitting ? 'Submitting Profile...' : 'Join Talent Network'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 4B: CANDIDATE SCHEDULED INTERVIEWS MODAL               */}
      {/* ============================================================ */}
      {showInterviewModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-white shrink-0">
                  <Video size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Scheduled Interviews</h3>
                  <p className="text-[11px] text-white/50">Live Video Rounds, Date & Time Coordinates, and Entry Room</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInterviewModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Email info strip */}
            <div className="mt-3.5 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Mail size={14} className="text-white/60 shrink-0" />
                <span className="text-xs text-white/70 truncate">
                  Candidate:{' '}
                  <strong className="text-white">
                    {candidateUser?.candidate_name || candidateUser?.name || 'Candidate'}
                  </strong>{' '}
                  {candidateUser?.candidate_email || candidateUser?.email ? (
                    <span>({candidateUser.candidate_email || candidateUser.email})</span>
                  ) : null}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {scheduledInterviews.length} Scheduled {scheduledInterviews.length === 1 ? 'Round' : 'Rounds'}
              </span>
            </div>

            {/* Interviews List (Scrollable) */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-3.5 pr-1 custom-scroll min-h-0">
              {scheduledInterviews.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 text-white/40 flex items-center justify-center mx-auto">
                    <Calendar size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-white">No Active Interviews Scheduled</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                    When an enterprise hiring manager schedules an interview for your applications, your confirmed round details, entry room, and calendar coordinates will appear here.
                  </p>
                </div>
              ) : (
                scheduledInterviews.map((round) => {
                  const isLive = round.status === 'In Progress' || round.status === 'Live';
                  const roomUrl = round.meeting_link || `${window.location.origin}/interview/room/${round.id}`;
                  const isSendingEmail = resendingEmailId === round.id;
                  const emailStatus = emailSentStatus[round.id];
                  const isCopied = copiedRoundId === round.id;

                  return (
                    <div
                      key={round.id}
                      className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-all space-y-4"
                    >
                      {/* Top Row: Role, Round & Status */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white">
                              {round.requisition_title || 'Position Interview'}
                            </h4>
                            <span className="text-xs text-white/40">&bull;</span>
                            <span className="text-xs font-semibold text-white/70">
                              {round.company_name || 'Bearitt'}
                            </span>
                          </div>
                          <div className="text-xs text-white/50 font-medium mt-0.5">
                            {round.round_name || 'Technical Round'}
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                            isLive
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          {isLive ? 'Live Now · In Session' : 'Scheduled & Confirmed'}
                        </span>
                      </div>

                      {/* Details Grid: Date, Time, Duration & Format */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Calendar size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Date</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {round.scheduled_date || 'Date Confirmed'}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Clock size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Time</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {round.scheduled_time || '10:00 AM'} ({round.scheduled_timezone || 'Asia/Kolkata'})
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <Video size={15} className="text-white/60 shrink-0" />
                          <div>
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Session Format</div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              TermJobs Live Video Room ({round.duration_minutes || 45} mins)
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5">
                          <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Passcode</div>
                            <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5 truncate">
                              {round.candidate_passcode || 'TJ-VERIFIED'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Instructions / Notes (if present) */}
                      {round.instructions && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                          <strong>Candidate Notice:</strong> {round.instructions}
                        </div>
                      )}

                      {/* Action Buttons: Enter Interview Room, Send Email, Copy Link */}
                      <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const name = encodeURIComponent(candidateUser?.name || round.candidate_name || 'Candidate');
                            const token = encodeURIComponent(round.candidate_token || '');
                            const isAi = round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai'));
                            const path = isAi ? 'ai' : 'room';
                            navigate(`/interview/${path}/${round.id}?role=candidate&name=${name}&token=${token}`);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          {round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai')) ? (
                            <Sparkles size={15} className="text-emerald-600" />
                          ) : (
                            <Video size={15} />
                          )}
                          <span>{round.round_type === 'AI' || (round.round_name && round.round_name.toLowerCase().includes('ai')) ? 'Start AI Interview Room' : 'Enter Interview Room'}</span>
                          <ArrowRight size={13} />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendInterviewEmail(round)}
                            disabled={isSendingEmail}
                            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                              emailStatus === 'sent'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : emailStatus === 'error'
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white/80 hover:text-white'
                            }`}
                          >
                            <Mail size={13} />
                            <span>
                              {isSendingEmail
                                ? 'Sending...'
                                : emailStatus === 'sent'
                                ? 'Email Dispatched!'
                                : emailStatus === 'error'
                                ? 'Send Failed'
                                : 'Send to My Email'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(roomUrl);
                              setCopiedRoundId(round.id);
                              setTimeout(() => setCopiedRoundId(null), 2000);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Notification confirmation */}
                      <p className="text-[11px] text-white/40 leading-normal">
                        ✉️ An interview invitation with calendar coordinates and passcode has been sent to{' '}
                        <strong className="text-white/70">
                          {round.candidate_email || candidateUser?.candidate_email || candidateUser?.email}
                        </strong>
                        .
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 5: CANDIDATE AGREEMENTS & CONTRACT TERMS                */}
      {/* ============================================================ */}
      {showAgreementModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-[#0a0b10]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Agreements & Contracts</h3>
                  <p className="text-[11px] text-white/50">Formal Employment Offers & Execution (Available Post-Interview Selection)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAgreementModal(false);
                  setActiveNavTab('home');
                }}
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Candidate Email Verification & Quick Switch */}
            <div className="mt-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-[11px] text-white/50 shrink-0 font-medium">Candidate Email:</span>
                <input
                  type="email"
                  value={agreementLookupEmail}
                  onChange={(e) => setAgreementLookupEmail(e.target.value)}
                  placeholder={candidateUser?.candidate_email || candidateUser?.email || "e.g. yourname@example.com"}
                  className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400 font-semibold"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = agreementLookupEmail || candidateUser?.candidate_email || candidateUser?.email;
                  if (target) loadCandidateAgreements(target);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition cursor-pointer shrink-0 shadow-sm"
              >
                Fetch Agreements
              </button>
            </div>

            <div className="mt-3 space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {loadingAgreements ? (
                <div className="py-12 text-center text-white/50 text-xs">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                  Checking for active employment agreements…
                </div>
              ) : candidateAgreements.length > 0 ? (
                <div className="space-y-3">
                  {candidateAgreements.map((agr, i) => {
                    const isSigned = agr.status === 'Accepted & Signed' || agr.agreement_status === 'Accepted & Signed' || agr.candidate_accepted;
                    const ctc = agr.annexure?.total_fixed_annual
                      ? `₹${Number(agr.annexure.total_fixed_annual).toLocaleString('en-IN')} / year`
                      : '₹18,00,000 / year';

                    return (
                      <div
                        key={agr._id || agr.candidate_id || i}
                        className="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/15 hover:border-white/25 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{agr.job_title || 'Software Engineer'}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.08] text-white/70 font-semibold">
                                {agr.company_name || 'Enterprise Client'}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/50 mt-0.5">
                              Addressed to: <strong className="text-white/80">{agr.candidate_name}</strong> ({agr.candidate_email})
                            </div>
                          </div>

                          {isSigned ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={12} />
                              Signed & Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              <AlertCircle size={12} />
                              Action Required: Sign
                            </span>
                          )}
                        </div>

                        {/* Terms Quick Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-black/40 border border-white/5 text-[11px]">
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Annual CTC</span>
                            <span className="text-white font-bold">{ctc}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Joining Date</span>
                            <span className="text-white font-semibold">{agr.joining_date || 'Within 14 Days'}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[9px] uppercase tracking-wider">Location</span>
                            <span className="text-white font-semibold">{agr.annexure?.work_location || 'Bengaluru / Hybrid'}</span>
                          </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <span className="text-[10px] text-white/40">
                            Issued: {agr.offer_date || 'Recent'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAgreement(agr);
                              setSignatureName(candidateUser?.candidate_name || agr.candidate_name || '');
                              setSignatureAgreed(false);
                              setSignSuccessMessage('');
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${isSigned
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 active:scale-98'
                              }`}
                          >
                            <FileText size={14} />
                            {isSigned ? 'View Executed Agreement' : 'Review & Sign Agreement →'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 mx-auto mb-2">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">No Active Agreements Issued Yet</h4>
                    <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed mt-1">
                      Agreements and formal employment contracts are generated exclusively after you complete your interview rounds and receive an official selection / offer from the hiring partner.
                    </p>
                  </div>

                  {/* Guest Email Lookup Box if not authenticated */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 max-w-sm mx-auto text-left">
                    <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                      Received an offer? Check with your email:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={agreementLookupEmail}
                        onChange={(e) => setAgreementLookupEmail(e.target.value)}
                        placeholder="e.g. arjunmheartitude@gmail.com"
                        className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/40"
                      />
                      <button
                        type="button"
                        onClick={() => loadCandidateAgreements(agreementLookupEmail)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs cursor-pointer transition"
                      >
                        Check
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAgreementModal(false);
                  setActiveNavTab('home');
                }}
                className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* MODAL 5B: FULL 5-PAGE AGREEMENT REVIEW & DIGITAL SIGNING MODAL*/}
      {/* ============================================================ */}
      {selectedAgreement && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#0f1117] border border-white/15 rounded-3xl max-w-4xl w-full my-6 p-4 sm:p-7 shadow-2xl relative flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    Formal Employment Agreement & Offer Letter
                  </h3>
                  <p className="text-xs text-white/50">
                    {selectedAgreement.company_name} · {selectedAgreement.job_title} · Ref: {selectedAgreement.candidate_id || selectedAgreement.submission_id || 'CND-OFFER'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white/80 hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAgreement(null)}
                  className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Canvas Body */}
            <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-6">
              <div
                className="bg-white text-slate-800 p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 text-xs sm:text-sm leading-relaxed"
                style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                {/* Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {selectedAgreement.company_name || 'TCS'}
                    </h2>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {selectedAgreement.company_address || 'Corporate Technology Park, Outer Ring Road, Bengaluru, Karnataka 560103'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block">Strictly Private & Confidential</span>
                    <span className="text-xs font-bold text-slate-600 mt-1 block">Date: {selectedAgreement.offer_date || new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Candidate Addressee */}
                <div className="mb-6">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Candidate Name:</div>
                  <div className="text-lg font-black text-slate-900">{selectedAgreement.candidate_name}</div>
                  <div className="text-xs text-slate-600">Email: {selectedAgreement.candidate_email}</div>
                </div>

                {/* Heading */}
                <div className="text-center my-6">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-widest underline decoration-2 underline-offset-4">
                    EMPLOYMENT OFFER
                  </h3>
                </div>

                {/* Intro */}
                <p className="mb-4 text-slate-700">
                  We are pleased to present you with an offer of employment with <strong>{selectedAgreement.company_name}</strong> as <strong>{selectedAgreement.job_title}</strong>. Your employment with the Company will commence on <strong>{selectedAgreement.joining_date}</strong>.
                </p>

                {/* Terms Table */}
                <table className="w-full border-collapse mb-6 border border-slate-300 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Joining Date</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.joining_date}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Contract Period</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.contract_period || 'Full Time / Unlimited'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Mobility & Relocation</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.mobility_clause}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Notice Period & Termination</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.termination_employee_notice_days || 30} days notice period by either party</td>
                    </tr>
                    <tr>
                      <td className="w-1/3 p-2.5 bg-slate-50 font-bold text-slate-900 border-r border-slate-200">Probation Period</td>
                      <td className="p-2.5 text-slate-700">{selectedAgreement.probation_period_months || 3} Months from joining</td>
                    </tr>
                  </tbody>
                </table>

                {/* Annexure A Compensation Details */}
                <div className="border-t-2 border-slate-300 pt-6 mt-6">
                  <div className="text-center mb-4">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">ANNEXURE A — COMPENSATION DETAILS</h4>
                    <span className="text-xs font-bold text-emerald-700 uppercase">Fixed Annual Cost to Company (CTC) Breakdown</span>
                  </div>

                  <table className="w-full border-collapse mb-6 border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900">
                        <th className="p-2.5 text-left font-bold">Salary Component</th>
                        <th className="p-2.5 text-right font-bold">Monthly (INR ₹)</th>
                        <th className="p-2.5 text-right font-bold">Annualized (INR ₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Basic Salary (50%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.basic_salary_monthly || 75000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.basic_salary_annual || 900000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">House Rent Allowance (HRA 25%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.hra_monthly || 37500).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.hra_annual || 450000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Other & Special Allowance (15%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.other_allowance_monthly || 22500).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.other_allowance_annual || 270000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 text-slate-800 font-medium">Provident Fund (Employer PF 10%)</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.pf_monthly || 15000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(selectedAgreement.annexure?.pf_annual || 180000).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-black text-slate-900 border-t-2 border-emerald-600">
                        <td className="p-2.5 text-emerald-900">Total Fixed CTC</td>
                        <td className="p-2.5 text-right text-emerald-900">₹{Number(selectedAgreement.annexure?.total_fixed_monthly || 150000).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-emerald-900">₹{Number(selectedAgreement.annexure?.total_fixed_annual || 1800000).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Benefits */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 mb-6">
                    <div><strong>Medical Insurance:</strong> {selectedAgreement.annexure?.medical_insurance_coverage || '₹5,00,000 family floater'}</div>
                    <div><strong>Life Insurance:</strong> {selectedAgreement.annexure?.life_insurance_coverage || 'Group Life Policy up to 3x CTC'}</div>
                    <div><strong>Bonus:</strong> {selectedAgreement.annexure?.annual_bonus_percentage || 10}% performance bonus eligibility</div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="border-t-2 border-slate-300 pt-6 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <div className="text-slate-500 mb-6">Authorized Signatory:</div>
                    <div className="border-t border-slate-900 pt-2">
                      <div className="font-black text-slate-900">{selectedAgreement.hr_signatory_name || 'Rakesh Sharma'}</div>
                      <div className="text-slate-500">{selectedAgreement.hr_signatory_title || 'VP – Human Resources'}</div>
                      <div className="text-slate-500">{selectedAgreement.company_name}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-6">Agreed & Accepted by:</div>
                    <div className="border-t border-slate-900 pt-2">
                      <div className="font-black text-slate-900">
                        {selectedAgreement.signature_name || selectedAgreement.candidate_name}
                      </div>
                      <div className="text-slate-500">Employee Signature</div>
                      {selectedAgreement.signed_at && (
                        <div className="text-emerald-700 font-bold text-[11px] mt-0.5">
                          Digitally Signed: {new Date(selectedAgreement.signed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Signing Execution Footer */}
              {signSuccessMessage && (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{signSuccessMessage}</span>
                </div>
              )}

              {selectedAgreement.status === 'Accepted & Signed' || selectedAgreement.agreement_status === 'Accepted & Signed' || selectedAgreement.candidate_accepted ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>This Employment Agreement has been digitally signed and executed. Onboarding is active.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgreement(null)}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/15 space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <span className="font-bold text-sm">Digital Signature & Execution</span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    By providing your digital signature and clicking below, you formally accept the employment terms, compensation breakdown, and standard policies specified in this document.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">
                        Full Legal Name (Digital Signature) *
                      </label>
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="e.g. Arjun M"
                        className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none pb-2">
                        <input
                          type="checkbox"
                          checked={signatureAgreed}
                          onChange={(e) => setSignatureAgreed(e.target.checked)}
                          className="w-4 h-4 rounded border-white/30 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>I confirm that I agree to all terms of this agreement.</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreement(null)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!signatureAgreed || !signatureName.trim() || signingAgreement}
                      onClick={() => handleSignAgreement(selectedAgreement._id || selectedAgreement.candidate_id)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-98 flex items-center gap-2"
                    >
                      {signingAgreement ? (
                        'Executing Agreement…'
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>✓ Sign & Accept Employment Agreement</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Candidate Auth Modal (Google OAuth & Email/Password) */}
      {/* ============================================================ */}
      {/* MODAL 6: AUTHENTICATION MODAL (PREMIUM WHITE MODAL)           */}
      {/* ============================================================ */}
      {showAuthModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl font-sans animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-md w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.06)] p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto text-neutral-900">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
                setAuthSuccessMsg('');
                setActiveNavTab('home');
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[0.65rem] font-bold tracking-[0.2em] text-neutral-600 uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
                <span>Candidate Talent Portal</span>
              </div>
              <h3 className="font-display text-xl font-extrabold text-neutral-900 tracking-tight">
                {googleResumeRequired ? 'Add your resume' : authModalTab === 'login' ? (new URLSearchParams(location.search).get('join') === 'talent-pool' ? 'Sign In to Join Talent Pool' : 'Sign In to Open Roles') : 'Create Talent Profile'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {googleResumeRequired ? 'One last step to complete your candidate profile.' : authModalTab === 'login'
                  ? 'Access verified partner requisitions and 1-click apply.'
                  : 'Join the verified talent network to browse and apply for roles.'}
              </p>
            </div>

            {googleResumeRequired && (
              <div className="mb-5">
                <div className="mb-5 flex items-center justify-center gap-2 text-[11px] font-medium text-neutral-500">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Google account verified</span><span className="text-neutral-300">/</span><span className="text-neutral-900">Upload resume</span>
                </div>
                <ResumeUploadField file={regResume} onChange={file => { setRegResume(file); setAuthError(null); }} disabled={authLoading} required />
              </div>
            )}

            {/* Primary Action Button */}
            {googleResumeRequired ? (
              <button
                type="button"
                onClick={handleCompleteGoogleRegistration}
                disabled={authLoading || !regResume}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {authLoading ? (
                  <span>Saving profile & signing in…</span>
                ) : (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Complete Profile & Sign In</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-5"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>{authLoading ? 'Connecting…' : 'Continue with Google'}</span>
              </button>
            )}

            {!googleResumeRequired && (<>
            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-neutral-200 w-full" />
              <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 absolute">
                or use candidate credentials
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-neutral-100 border border-neutral-200 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${authModalTab === 'login'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('register');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${authModalTab === 'register'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
                  }`}
              >
                Create Profile
              </button>
            </div>

            {/* Alerts */}
            </>)}


            {authError && !authSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span className="flex-1">{authError}</span>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {!googleResumeRequired && authModalTab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    >
                      {showAuthPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-md hover:shadow-lg mt-3 disabled:opacity-50"
                >
                  {authLoading ? 'Signing In…' : 'Sign In to Candidate Profile'}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER FORM */}
            {!googleResumeRequired && authModalTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Personal Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="alex@gmail.com"
                      className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                        regEmail && validateCandidateEmail(regEmail, { required: false })
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                      } rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 transition-all`}
                    />
                    {regEmail && validateCandidateEmail(regEmail, { required: false }) && (
                      <p className="mt-1 text-[10px] text-rose-600 font-medium">
                        {validateCandidateEmail(regEmail, { required: false })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => {
                        setRegPhone(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="e.g. 9876543210 or +91 9876543210"
                      className={`w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border ${
                        regPhone && validatePhone(regPhone, { required: false })
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900'
                      } rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 transition-all`}
                    />
                    {regPhone && validatePhone(regPhone, { required: false }) && (
                      <p className="mt-1 text-[10px] text-rose-600 font-medium">
                        {validatePhone(regPhone, { required: false })}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="e.g. Senior Fullstack Engineer"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">Key Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={regSkills}
                    onChange={(e) => setRegSkills(e.target.value)}
                    placeholder="React, TypeScript, Python, Node.js"
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                  />
                </div>

                <ResumeUploadField file={regResume} onChange={file => { setRegResume(file); setAuthError(null); }} disabled={authLoading} required />

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.14em] transition cursor-pointer shadow-md hover:shadow-lg mt-3 disabled:opacity-50"
                >
                  {authLoading ? 'Creating Profile…' : 'Create Profile & Access Roles'}
                </button>
              </form>
            )}

            {/* Footer Security Note */}
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Verified candidate session · Encrypted data</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Candidate Onboarding Carousel Modal */}
      <CandidateOnboardingModal
        isOpen={showOnboardingModal && !isStaffOrAdmin}
        onClose={() => {
          setShowOnboardingModal(false);
          setDismissedSessionOnboarding(true);
        }}
        candidateUser={candidateUser}
        onComplete={handleOnboardingComplete}
        openProfileSetup={() => setShowSetupModal(true)}
      />

    </div>
  );
}
