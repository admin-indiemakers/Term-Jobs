import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ============ GOOGLE SHEET & EMAIL INTEGRATION ============ */
const WAITLIST_SHEET_URL = "https://script.google.com/macros/s/AKfycbwQinVM7RhGUNT25697HjMawl3eq63Q-Sj3ledWEnu52H1JayF8zaDo8Z41XEE5ZN2Fmw/exec";
const CONTACT_SHEET_URL = "";

async function sendFormToGoogleSheet(data, customUrl = null) {
  const url = customUrl || WAITLIST_SHEET_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('Error submitting form:', err);
  }
}

/* ============ LOGO ============ */
const LogoIcon = ({ className = '', alt = '' }) => (
  <img src="/logo.png" alt={alt} className={`${className} object-contain block`} />
);

const IconParchment = ({ stroke = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className="w-5 h-5">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-5 h-5">
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </svg>
);

const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-5 h-5">
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

/* ============ REVEAL ============ */
const Reveal = ({ as: Tag = 'div', className = '', type = 'reveal', children }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`${type} ${className}`}>
      {children}
    </Tag>
  );
};

/* ============ NAV ============ */
const Nav = ({ currentRoute, setRoute }) => {
  const { user } = useAuth();
  const navRef = useRef(null);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const nav = navRef.current;
      if (!nav) return;
      if (y > lastY && y > 120) nav.classList.add('hide');
      else nav.classList.remove('hide');
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-3.5 sm:px-7 py-2.5 sm:py-3.5 bg-white/95 backdrop-blur-md border-b border-black/[0.06] transition-transform duration-[400ms]"
    >
      <a href="#home" onClick={() => setRoute('#home')} className="flex items-center gap-2 sm:gap-3 group focus:outline-none shrink-0">
        <LogoIcon className="h-7 sm:h-8 md:h-9 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105" alt="Term Jobs" />
        <span className="font-extrabold text-[15px] sm:text-[18px] md:text-[20px] tracking-[-0.02em] text-[#0a0a0a] leading-none select-none translate-y-[1px] whitespace-nowrap">
          TERM JOBS
        </span>
      </a>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <a
          href="#contact"
          onClick={() => setRoute('#contact')}
          className={`font-semibold text-[11.5px] sm:text-[13px] px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-[100px] whitespace-nowrap transition-colors duration-200 ${
            currentRoute === '#contact' ? 'bg-[#f5f5f7] text-[#0a0a0a] font-bold' : 'text-[#86868b] hover:text-[#0a0a0a]'
          }`}
        >
          Contact Us
        </a>
        {user ? (
          <Link
            to="/dashboard"
            className="font-semibold text-[11.5px] sm:text-[13px] bg-[#0a0a0a] text-white py-1.5 px-3.5 sm:py-[9px] sm:px-[18px] rounded-[100px] whitespace-nowrap transition-opacity duration-200 hover:opacity-75 shrink-0 flex items-center gap-1"
          >
            Dashboard →
          </Link>
        ) : (
          <Link
            to="/login"
            className="font-semibold text-[11.5px] sm:text-[13px] bg-[#0a0a0a] text-white py-1.5 px-3.5 sm:py-[9px] sm:px-[18px] rounded-[100px] whitespace-nowrap transition-opacity duration-200 hover:opacity-75 shrink-0 flex items-center gap-1"
          >
            Sign In →
          </Link>
        )}
      </div>
    </nav>
  );
};

/* ============ HERO ============ */
const Hero = () => {
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.currentTarget.email.value.trim();
    if (!email) return;
    sendFormToGoogleSheet({
      formType: 'Waitlist (Hero)',
      email: email,
      timestamp: new Date().toLocaleString()
    });
    setStatus(`You're on the list — we'll email ${email} at launch.`);
    setJoined(true);
  };

  return (
    <section className="relative flex flex-col items-center text-center px-6 pt-[90px] sm:pt-[110px] md:pt-[130px] pb-10 md:pb-14 overflow-hidden" id="signup">
      <div
        className="absolute inset-0 z-[-1]"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 8%, rgba(0,0,0,0.05), transparent 70%), radial-gradient(40% 30% at 80% 20%, rgba(0,0,0,0.03), transparent 70%)',
        }}
      />
      <div className="mb-6 animate-[markIn_1s_cubic-bezier(.16,1,.3,1)_0.15s_both]">
        <LogoIcon className="w-16 h-16 md:w-20 md:h-20 object-contain mx-auto" alt="Term Jobs" />
      </div>
      <p className="font-semibold text-xs tracking-[0.24em] uppercase text-[#86868b] mb-[22px] animate-[riseIn_0.9s_cubic-bezier(.16,1,.3,1)_0.3s_both]">
        Coming Soon
      </p>
      <h1 className="font-extrabold text-[clamp(38px,6.2vw,84px)] leading-[1.03] max-w-[1000px] text-[#0a0a0a] animate-[riseIn_1s_cubic-bezier(.16,1,.3,1)_0.4s_both]">
        The future of work<br />
        isn't permanent. <span className="text-[#86868b]">It's flexible.</span>
      </h1>
      <p className="text-[clamp(16px,1.9vw,20px)] leading-[1.6] text-[#86868b] max-w-[560px] mt-[26px] mb-8 animate-[riseIn_1s_cubic-bezier(.16,1,.3,1)_0.55s_both]">
        Term Jobs brings verified contract roles, trusted employers, and everything in between — hiring, tracking, and payments — into one place.
      </p>

      {/* Shifted Waitlist Section */}
      <div className="w-full max-w-[480px] bg-white/70 backdrop-blur-md border border-[#d2d2d7] p-6 md:p-8 rounded-3xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.07)] animate-[riseIn_1s_cubic-bezier(.16,1,.3,1)_0.7s_both]">
        <h2 className="font-extrabold text-[22px] md:text-[26px] text-[#0a0a0a] mb-2 leading-[1.2]">
          Be first through the door.
        </h2>
        <p className="text-[#86868b] text-[14px] md:text-[15px] max-w-[400px] mx-auto mb-5 leading-[1.5]">
          Join the waitlist and we'll let you know the moment Term Jobs goes live.
        </p>
        <form
          className="flex flex-col max-[480px]:w-full gap-2.5 max-w-[440px] mx-auto w-full min-[481px]:flex-row"
          onSubmit={handleSubmit}
        >
          <input
            type="email"
            name="email"
            placeholder="you@email.com"
            required
            aria-label="Email address"
            disabled={joined}
            className="flex-1 min-w-0 px-[18px] py-3.5 rounded-[100px] border border-[#d2d2d7] bg-white text-[14.5px] text-[#0a0a0a] outline-none transition-colors duration-200 focus:border-[#0a0a0a] disabled:opacity-60 shadow-xs"
          />
          <button
            type="submit"
            disabled={joined}
            className="font-semibold text-[14.5px] bg-[#0a0a0a] text-white border-none rounded-[100px] px-6 py-3.5 cursor-pointer whitespace-nowrap transition-opacity duration-200 hover:opacity-[0.82] disabled:opacity-60 shadow-xs"
          >
            {joined ? 'Added ✓' : 'Notify Me'}
          </button>
        </form>
        <div className={`mt-3.5 text-[13px] min-h-4 ${joined ? 'text-[#0a0a0a] font-medium' : 'text-[#86868b]'}`}>{status}</div>
      </div>
    </section>
  );
};

/* ============ STATEMENT ============ */
const Statement = () => {
  const sectionRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const start = windowHeight * 0.85;
      const totalRange = windowHeight * 0.6 + rect.height;
      const current = start - rect.top;
      const p = Math.min(Math.max(current / totalRange, 0), 1);
      setProgress(p);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    handleScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const text =
    "One platform for project-based teams. Verified talent, transparent billing, and full visibility — from the first interview to the final invoice.";
  const words = text.split(' ');

  return (
    <section ref={sectionRef} className="px-6 pt-16 pb-20 min-[861px]:pt-24 min-[861px]:pb-32 text-center">
      <h2 className="font-bold text-[clamp(28px,4.2vw,52px)] leading-[1.25] max-w-[900px] mx-auto flex flex-wrap justify-center gap-x-[0.3em] gap-y-[0.1em]">
        {words.map((word, i) => {
          const step = 1 / words.length;
          const wordStart = i * step;
          const wordEnd = (i + 1) * step;
          const wordProgress = Math.min(Math.max((progress - wordStart) / (wordEnd - wordStart), 0), 1);
          const opacity = 0.2 + wordProgress * 0.8;

          return (
            <span
              key={i}
              className="transition-colors duration-150 select-none"
              style={{
                color: `rgba(10, 10, 10, ${opacity})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </h2>
    </section>
  );
};

/* ============ STICKY FEATURE SCROLLER ============ */
const steps = [
  {
    title: 'Hire with confidence',
    body: 'Post a role once and reach verified contract professionals and trusted staffing vendors in a single search.',
  },
  {
    title: 'Manage every engagement',
    body: 'Track performance, hours, and compliance in one dashboard — no more spreadsheets across five vendors.',
  },
  {
    title: 'Pay without the paperwork',
    body: 'Approve timesheets and release payments automatically, with full cost visibility across every project.',
  },
];

const pinCards = [
  { icon: <IconParchment />, rows: ['w-[80%]', 'w-[60%]', 'w-[40%]'] },
  { icon: <IconChart />, stat: '98%', statLabel: 'On-time performance across active contracts', rows: null },
  { icon: <IconDollar />, rows: ['w-[60%]', 'w-[80%]', 'w-[40%]'] },
];

const PinSection = () => {
  const sectionRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let raf = 0;
    const updatePin = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.min(Math.max(-rect.top / total, 0), 0.999);
      setActive(Math.floor(progress * 3));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updatePin);
    };
    updatePin();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative min-[861px]:h-[320vh] bg-[#f5f5f7] py-16 min-[861px]:py-0" id="features">
      {/* Mobile Layout (< 861px) */}
      <div className="block min-[861px]:hidden px-6 max-w-[1180px] mx-auto">
        <div className="font-semibold text-xs tracking-[0.2em] uppercase text-[#86868b] mb-3">How it works</div>
        <h2 className="font-extrabold text-[28px] text-[#0a0a0a] mb-8 leading-[1.15]">
          Built for contract hiring and project execution.
        </h2>
        <div className="flex flex-col gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-white border border-[#d2d2d7] rounded-3xl p-7 shadow-xs">
              <div className="w-12 h-12 rounded-[14px] bg-[#0a0a0a] flex items-center justify-center mb-5 text-white">
                {pinCards[i].icon}
              </div>
              <h3 className="font-bold text-[22px] text-[#0a0a0a] mb-2">{s.title}</h3>
              <p className="text-[14.5px] text-[#86868b] leading-[1.6] mb-4">{s.body}</p>
              {pinCards[i].stat && (
                <div className="pt-4 border-t border-[#d2d2d7] mt-2">
                  <div className="font-extrabold text-[32px] text-[#0a0a0a]">{pinCards[i].stat}</div>
                  <div className="text-[12.5px] text-[#86868b]">{pinCards[i].statLabel}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Sticky Pinned Layout (>= 861px) */}
      <div className="hidden min-[861px]:flex sticky top-0 h-svh items-center overflow-hidden bg-[#f5f5f7]">
        <div className="w-full grid grid-cols-2 gap-[60px] items-center px-6 max-w-[1180px] mx-auto">
          <div>
            <div className="font-semibold text-xs tracking-[0.2em] uppercase text-[#86868b] mb-5">How it works</div>
            <div className="flex flex-col gap-0.5">
              {steps.map((s, i) => (
                <div key={s.title} className={`pin-step py-6 border-t border-[#d2d2d7] ${i === steps.length - 1 ? 'border-b' : ''} ${active === i ? 'active' : ''}`}>
                  <h3 className="font-bold text-[clamp(20px,2.4vw,30px)] text-[#0a0a0a] mb-2">{s.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-[1.6] max-w-[420px]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[440px] flex items-center justify-center">
            {pinCards.map((card, i) => (
              <div
                key={i}
                className={`pin-card bg-white border border-[#d2d2d7] rounded-3xl p-9 flex flex-col justify-between shadow-[0_30px_60px_-20px_rgba(0,0,0,0.12)] ${active === i ? 'active' : ''}`}
              >
                <div className="w-12 h-12 rounded-[14px] bg-[#0a0a0a] flex items-center justify-center">
                  {card.icon}
                </div>
                {card.stat ? (
                  <div>
                    <div className="font-extrabold text-[40px] text-[#0a0a0a]">{card.stat}</div>
                    <div className="text-[13px] text-[#86868b] mt-1">{card.statLabel}</div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1">
                    <div className="mb-4">
                      <h3 className="font-bold text-[20px] text-[#0a0a0a] mb-2">{steps[i]?.title}</h3>
                      <p className="text-[14px] text-[#86868b] leading-[1.6] max-w-[340px]">{steps[i]?.body}</p>
                    </div>
                    <div className="mt-auto flex flex-col gap-2">
                      {card.rows.map((w, j) => (
                        <div key={j} className={`h-[12px] rounded-[6px] bg-[#f5f5f7] ${w}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ============ FEATURE GRID ============ */
const features = [
  {
    num: '01',
    title: 'Verified talent network',
    body: 'Every professional and vendor on Term Jobs is vetted, so you spend less time screening and more time building.',
  },
  {
    num: '02',
    title: 'Live cost visibility',
    body: 'See spend, hours, and performance across every project-based team in real time — no end-of-month surprises.',
  },
  {
    num: '03',
    title: 'Built-in compliance',
    body: 'Onboarding, documentation, and billing rules are handled automatically, keeping every engagement audit-ready.',
  },
];

const Features = () => (
  <section className="px-6 py-[140px]">
    <div className="max-w-[1180px] mx-auto">
      <Reveal className="text-center max-w-[640px] mx-auto mb-20">
        <div className="eyebrow font-semibold text-xs tracking-[0.2em] uppercase text-[#86868b] mb-4">Built for modern teams</div>
        <h2 className="font-extrabold text-[clamp(30px,4vw,48px)] text-[#0a0a0a] leading-[1.1]">
          Everything project-based hiring needs. Nothing it doesn't.
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 min-[861px]:grid-cols-3 gap-0.5 bg-[#d2d2d7] rounded-3xl overflow-hidden stagger">
        {features.map((f) => (
          <Reveal
            key={f.num}
            className="bg-white p-11 min-h-[280px] flex flex-col justify-between transition-colors duration-300 hover:bg-[#f5f5f7]"
          >
            <div className="font-extrabold text-[13px] tracking-[0.05em] text-[#d2d2d7]">{f.num}</div>
            <div>
              <h3 className="font-bold text-[22px] text-[#0a0a0a] mt-7 mb-2.5">{f.title}</h3>
              <p className="text-[14.5px] text-[#86868b] leading-[1.6]">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ============ DARK STATEMENT / SMOKE ============ */
const DarkSection = () => (
  <section className="relative bg-black text-white px-6 py-[140px] min-[861px]:py-[220px] text-center overflow-hidden">
    <div className="smoke absolute inset-0 z-0 overflow-hidden">
      <i />
      <i />
    </div>
    <div className="relative z-10">
      <Reveal as="h2" className="font-bold text-[clamp(30px,5vw,58px)] leading-[1.2] max-w-[820px] mx-auto mb-7">
        Behind every role is a real person building a career.
      </Reveal>
      <Reveal as="p" className="text-base text-white/[0.55] max-w-[480px] mx-auto">
        That's the part we designed around first.
      </Reveal>
    </div>
  </section>
);

/* ============ APP PREVIEW ============ */
const PhonePreview = () => {
  const phoneRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const phone = phoneRef.current;
      if (!phone) return;
      const r = phone.getBoundingClientRect();
      const center = window.innerHeight / 2;
      const dist = (r.top + r.height / 2 - center) / center;
      const tilt = Math.max(Math.min(dist * 6, 8), -8);
      phone.style.transform = `rotateY(${-8 + tilt}deg) rotateX(${2 - tilt / 2}deg)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <section className="px-6 pt-[160px] pb-[140px] overflow-hidden">
      <Reveal className="text-center max-w-[600px] mx-auto mb-[70px]">
        <div className="font-semibold text-xs tracking-[0.2em] uppercase text-[#86868b] mb-4">A closer look</div>
        <h2 className="font-extrabold text-[clamp(30px,4vw,46px)] text-[#0a0a0a] leading-[1.1]">Your next opportunity, one tap away.</h2>
      </Reveal>
      <Reveal type="reveal-scale" className="flex justify-center [perspective:1400px]">
        <div
          ref={phoneRef}
          className="phone w-[260px] h-[530px] min-[861px]:w-[300px] min-[861px]:h-[610px] rounded-[44px] bg-black p-3 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.35)]"
        >
          <div className="w-full h-full rounded-[34px] bg-white overflow-hidden flex flex-col">
            <div className="flex justify-between px-5 pt-4 pb-1.5 text-xs font-semibold text-[#0a0a0a]">
              <span>9:41</span>
              <span>●●●●</span>
            </div>
            <div className="bg-black text-white px-5 pt-6 pb-[30px]">
              <div className="w-8 h-8 rounded-[9px] bg-white flex items-center justify-center mb-4">
                <IconParchment stroke="#0a0a0a" />
              </div>
              <h4 className="font-bold text-xl mb-1.5">Good morning, Arjun 👋</h4>
              <p className="text-[12.5px] text-white/[0.55]">6 new opportunities match your profile</p>
            </div>
            <div className="-mt-4 mx-5 bg-white rounded-xl px-3.5 py-3 text-[12.5px] text-[#86868b] shadow-[0_10px_24px_rgba(0,0,0,0.12)] flex items-center gap-2">
              🔍&nbsp; Search roles, companies, skills…
            </div>
            <div className="px-5 pt-[26px] pb-5 flex flex-col gap-3 flex-1">
              <div className="text-[11px] font-semibold text-[#86868b] uppercase tracking-[0.08em] mb-1">Featured Jobs</div>
              <div className="border border-[#d2d2d7] rounded-[14px] p-3.5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-[13.5px] font-bold text-[#0a0a0a]">Senior UX Designer</h5>
                    <div className="text-[11px] text-[#86868b] mt-0.5">Notion · Remote · 6 months</div>
                  </div>
                  <div className="text-[10.5px] font-semibold bg-[#f5f5f7] px-2 py-1 rounded-md text-[#1d1d1f]">₹85k/mo</div>
                </div>
                <div className="text-[11px] font-semibold bg-[#0a0a0a] text-white text-center py-2 rounded-lg mt-0.5">Apply Now</div>
              </div>
              <div className="border border-[#d2d2d7] rounded-[14px] p-3.5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-[13.5px] font-bold text-[#0a0a0a]">Product Marketing Lead</h5>
                    <div className="text-[11px] text-[#86868b] mt-0.5">Linear · Remote · 3 months</div>
                  </div>
                  <div className="text-[10.5px] font-semibold bg-[#f5f5f7] px-2 py-1 rounded-md text-[#1d1d1f]">₹90k/mo</div>
                </div>
                <div className="text-[11px] font-semibold bg-[#0a0a0a] text-white text-center py-2 rounded-lg mt-0.5">Apply Now</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
};

/* ============ CONTACT PAGE ============ */
const ContactPage = ({ setRoute }) => {
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.elements.name?.value || form.elements[0]?.value || '';
    const email = form.elements.email?.value || form.elements[1]?.value || '';
    const topic = form.elements.topic?.value || form.elements[2]?.value || 'General';
    const message = form.elements.message?.value || form.elements[3]?.value || '';

    sendFormToGoogleSheet({
      formType: 'Contact Form',
      name,
      email,
      topic,
      message,
      timestamp: new Date().toLocaleString()
    }, CONTACT_SHEET_URL);

    setSubmitted(true);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('Termjobsofficial@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-svh pt-[120px] pb-24 px-6 max-w-[1180px] mx-auto animate-[riseIn_0.6s_cubic-bezier(.16,1,.3,1)_both]">
      <div className="mb-8">
        <button
          onClick={() => {
            window.location.hash = '#home';
            setRoute('#home');
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#86868b] hover:text-[#0a0a0a] transition-colors duration-200 cursor-pointer"
        >
          ← Back to Home
        </button>
      </div>

      <div className="text-center max-w-[640px] mx-auto mb-16">
        <div className="eyebrow font-semibold text-xs tracking-[0.24em] uppercase text-[#86868b] mb-3">
          Get in Touch
        </div>
        <h1 className="font-extrabold text-[clamp(32px,5vw,56px)] text-[#0a0a0a] leading-[1.08] mb-4">
          We'd love to hear from you.
        </h1>
        <p className="text-[#86868b] text-[16px] md:text-[18px] leading-[1.6]">
          Have questions about Term Jobs, waitlist priority, enterprise hiring, or contract roles? Reach out to us anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 min-[861px]:grid-cols-12 gap-10 items-start">
        {/* Left Column: Contact Info Cards */}
        <div className="min-[861px]:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-7 shadow-xs">
            <div className="w-11 h-11 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center mb-5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 0-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-xl text-[#0a0a0a] mb-1">Direct Email</h3>
            <p className="text-sm text-[#86868b] mb-4">Drop us an email directly for any inquiry.</p>
            <div className="flex items-center gap-2 bg-[#f5f5f7] p-3 rounded-xl border border-[#d2d2d7]">
              <span className="font-semibold text-sm text-[#0a0a0a] truncate flex-1">Termjobsofficial@gmail.com</span>
              <button
                type="button"
                onClick={copyEmail}
                className="text-xs font-semibold bg-white border border-[#d2d2d7] px-3 py-1.5 rounded-lg hover:bg-white transition-colors duration-150 shrink-0 cursor-pointer"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-7 shadow-xs">
            <div className="w-11 h-11 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center mb-5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-xl text-[#0a0a0a] mb-1">Quick Response</h3>
            <p className="text-sm text-[#86868b] leading-[1.6]">
              Our team reviews messages daily and will get back to you within 24 hours.
            </p>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-7 shadow-xs">
            <h4 className="font-bold text-base text-[#0a0a0a] mb-3">Inquiry Categories</h4>
            <ul className="space-y-2.5 text-sm text-[#86868b]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]"></span>
                Waitlist & Pre-launch Access
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]"></span>
                Employer & Enterprise Hiring
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]"></span>
                Contractor & Freelancer Network
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]"></span>
                Partnership & Media Opportunities
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Contact Form */}
        <div className="min-[861px]:col-span-7 bg-white border border-[#d2d2d7] rounded-3xl p-8 md:p-10 shadow-xs">
          {submitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-[#0a0a0a] text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                ✓
              </div>
              <h3 className="font-extrabold text-2xl text-[#0a0a0a] mb-3">Message Sent!</h3>
              <p className="text-[#86868b] max-w-[420px] mx-auto text-sm md:text-base leading-[1.6] mb-8">
                Thank you for contacting Term Jobs. We have received your message and will respond to your email shortly. You can also email us anytime directly at <strong className="text-[#0a0a0a]">Termjobsofficial@gmail.com</strong>.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="font-semibold text-sm bg-[#f5f5f7] text-[#0a0a0a] px-6 py-3 rounded-full hover:bg-[#d2d2d7] transition-colors duration-200 cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Arjun Patel"
                    className="w-full px-4 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] transition-colors duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@email.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] transition-colors duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                  Topic / Inquiry Type
                </label>
                <select
                  name="topic"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] transition-colors duration-200"
                >
                  <option value="general">General Inquiry</option>
                  <option value="waitlist">Waitlist & Access</option>
                  <option value="employer">Employer / Enterprise Hiring</option>
                  <option value="talent">Contract Talent & Freelancer</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  required
                  rows="5"
                  placeholder="How can we help you?"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#d2d2d7] bg-white text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] transition-colors duration-200 resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#0a0a0a] text-white font-semibold text-sm rounded-xl transition-opacity duration-200 hover:opacity-85 shadow-xs cursor-pointer"
              >
                Send Message →
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============ FOOTER ============ */
const Footer = () => (
  <footer className="border-t border-[#d2d2d7] px-6 py-9 flex items-center justify-between text-[12.5px] text-[#86868b] flex-wrap gap-3 max-[480px]:flex-col max-[480px]:text-center bg-white">
    <div className="flex items-center gap-3 font-semibold text-[#1d1d1f]">
      Term Jobs
    </div>
    <div>&copy; 2026 Term Jobs. All rights reserved.</div>
  </footer>
);

export default function LandingPage() {
  const [route, setRoute] = useState(window.location.hash || '#home');

  useEffect(() => {
    const onHashChange = () => {
      const current = window.location.hash || '#home';
      setRoute(current);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] font-sans antialiased">
      <Nav currentRoute={route} setRoute={setRoute} />
      <main>
        {route === '#contact' ? (
          <ContactPage setRoute={setRoute} />
        ) : (
          <>
            <Hero />
            <DarkSection />
            <PhonePreview />
            <Statement />
            <PinSection />
            <Features />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
