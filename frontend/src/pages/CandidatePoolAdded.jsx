import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LogOut } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { useCandidateAuth } from '../context/CandidateAuthContext';
import { useEffect, useRef, useState } from 'react';
import './CandidatePoolAdded.css';

export default function CandidatePoolAdded() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAuthenticated, candidateUser } = useCandidateAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const closeMenu = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };
  const email = candidateUser?.candidate_email || candidateUser?.email || '';
  const name = candidateUser?.candidate_name || candidateUser?.name || 'Candidate';
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  if (!location.state?.poolSubmitted) return <Navigate to="/" replace />;
  return (
    <main className="candidate-waiting-page">
      <SEOHead title="You’re on the Candidate Waiting List — TermJobs" noindex />
      <div className="candidate-waiting-wrap">
        <header>
          <Link className="waiting-brand" to="/" aria-label="Go to TermJobs homepage">
            <img src="/logo.png" alt="TermJobs" />
          </Link>
          <div className="waiting-header-actions">
            {isAuthenticated && (
              <div className="waiting-profile" ref={profileRef}>
                <button
                  type="button"
                  className="waiting-profile-trigger"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className="waiting-profile-avatar">{initials || 'C'}</span>
                  <span className="waiting-profile-email">{email || 'Candidate account'}</span>
                </button>
                {profileOpen && (
                  <div className="waiting-profile-menu" role="menu">
                    <div className="waiting-profile-details">
                      <span>{name}</span>
                      <small>{email}</small>
                    </div>
                    <button type="button" role="menuitem" onClick={handleLogout}>
                      <LogOut size={15} aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
            <Link className="waiting-home-link" to="/">
              Go to home
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main className="candidate-waiting-main">
          <section>
            <div className="pass">
              <span className="pass-mark" aria-hidden="true">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Verified candidate</span>
              <span className="pass-status">Waiting list</span>
            </div>
            <h1>
              <b>You&rsquo;re one</b>
              <b>of the first</b>
              <b>on the list.</b>
            </h1>
            <p className="lede">
              Your profile and résumé are in. As an early member, you’ll hear from us first when verified contract and permanent roles open up.
            </p>
          </section>

          <section className="ticket" aria-label="Waiting list status">
            <div className="head">
              <svg className="mark" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="27" />
                <path d="M17 29l8 8 14-17" />
              </svg>
              <div>
                <h2>Added to candidate pool</h2>
                <p>Your spot is saved</p>
              </div>
            </div>
            <ul>
              {['Profile received', 'Résumé uploaded', 'First access when we open the doors'].map((item) => (
                <li key={item}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link className="btn" to="/">
              Back to home
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        </main>
      </div>
    </main>
  );
}
