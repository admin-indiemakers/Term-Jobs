import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronsRight, Download, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import SEOHead from '../components/SEOHead';
import './InternshipPage.css';

const programTitle = 'Advanced Forward Deployed Engineer Internship + Training Program';
const programPdf = '/TermJobs-x-AsimovX-Forward-Deployed-Engineer-Program.pdf';
const partnerName = 'Asimov X Technologies AB';

function ProgramPartners({ className = '' }) {
  return (
    <div className={`program-partners ${className}`}>
      <span>Term Jobs <span className="partner-cross">×</span> {partnerName}</span>
    </div>
  );
}

function moveHeroLight({ currentTarget, clientX, clientY, pointerType }) {
  if (pointerType === 'touch' || !window.matchMedia('(any-pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
  const bounds = currentTarget.getBoundingClientRect();
  const x = (clientX - bounds.left) / bounds.width;
  const y = (clientY - bounds.top) / bounds.height;
  currentTarget.style.setProperty('--hero-light-x', `${x * 100}%`);
  currentTarget.style.setProperty('--hero-light-y', `${y * 100}%`);
  currentTarget.style.setProperty('--orbit-x', `${(x - .5) * 30}px`);
  currentTarget.style.setProperty('--orbit-y', `${(y - .5) * 24}px`);
  currentTarget.classList.add('is-tracking');
}

function resetHeroLight({ currentTarget }) {
  currentTarget.classList.remove('is-tracking');
  currentTarget.style.removeProperty('--orbit-x');
  currentTarget.style.removeProperty('--orbit-y');
}

function ProgramPhone() {
  return <a href="tel:+918197833803">+91 81978 33803</a>;
}

function InternshipApplicationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (submitting || submitted) return;
    const fields = new FormData(event.currentTarget);
    const name = fields.get('name').trim();
    const phone = fields.get('phone').trim().replace(/[\s().-]/g, '');
    if (!name || !/^\+?[0-9]{7,15}$/.test(phone)) {
      setError('Enter your name and a phone number with 7 to 15 digits.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/internship/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (response.status !== 201) throw new Error('Application submission failed');
      setSubmitted(true);
    } catch {
      setError('We couldn’t submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="application-panel">
      <p role="status">{submitted ? 'Application received. Thank you for applying.' : ''}</p>
      {!submitted && (
        <form className="application-form" onSubmit={submit}>
          <label>
            Full name
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            Phone number
            <input type="tel" name="phone" autoComplete="tel" required maxLength={32} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}

function HeroWords({ text, start = 0 }) {
  return text.split(' ').map((word, index) => (
    <Fragment key={word}>
      {index > 0 && ' '}
      <span className="wd" style={{ '--i': start + index }}>{word}</span>
    </Fragment>
  ));
}

export default function InternshipPage() {
  const pageRef = useRef(null);
  const dayChipRef = useRef(null);
  const dayNumberRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    const anchor = document.getElementById(window.location.hash.slice(1));
    if (anchor && page.contains(anchor)) anchor.scrollIntoView({ behavior: 'instant' });

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 640px)').matches) return;

    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.classList.add('in');
        observer.unobserve(target);
      }
    });

    const elements = page.querySelectorAll('section h2, section .eyebrow, section .card, .miles > div, .rules li, .timeline, .rhythm, .dl, .note');
    elements.forEach((element) => {
      element.classList.add('rv');
      observer.observe(element);
    });
    return () => {
      observer.disconnect();
      elements.forEach((element) => element.classList.remove('rv', 'in'));
    };
  }, []);

  function updateProgress({ currentTarget: page }) {
    const scrollRange = page.scrollHeight - page.clientHeight;
    const progress = scrollRange > 0 ? Math.min(1, Math.max(0, page.scrollTop / scrollRange)) : 0;
    page.style.setProperty('--scroll-progress', progress);
    dayChipRef.current.classList.toggle('on', page.scrollTop > 480);
    dayNumberRef.current.textContent = 1 + Math.round(progress * 29);
  }

  return (
    <div className="internship-page" ref={pageRef} onScroll={updateProgress}>
      <div className="program-backdrop" aria-hidden="true">
        <div className="backdrop-contours" />
      </div>
      <SEOHead
        title={`${programTitle} | Term Jobs × ${partnerName}`}
        description={`Explore the 30-day internship from Term Jobs and ${partnerName}, with 20 days of training and 10 days of hands-on project work.`}
        canonicalUrl="https://www.termjobs.in/internship"
      />
      <header className="program-header">
        <div className="wrap">
          <Link className="logo" to="/" aria-label="Term Jobs home">
            <BrandLogo size={34} />
            <span className="logo-wordmark">Term Jobs</span>
          </Link>
          <nav className="nav-links" aria-label="Main navigation">
            <Link className="nav-how" to="/#how">How we work</Link>
            <Link to="/#contact">Contact</Link>
            <a className="nav-apply" href="#apply">Apply</a>
          </nav>
        </div>
      </header>
      <main className="program-content">
        <div className="wrap page-hero play" onPointerMove={moveHeroLight} onPointerLeave={resetHeroLight}>
          <div className="hero-layout">
            <div className="hero-copy">
              <ProgramPartners className="hero-partners seq" />
              <h1 className="display" aria-label={`${programTitle}.`}>
                <span aria-hidden="true"><HeroWords text="Advanced Forward Deployed Engineer" />{' '}
                  <span className="soft"><HeroWords text="Internship + Training Program." start={4} /></span>
                </span>
              </h1>
              <p className="lead seq">Train for 20 days with a lab every day. Spend the final 10 days building an app or contributing to real projects.</p>
              <div className="program-actions seq">
                <a className="btn" href="#apply">Apply for the internship
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className="program-download" href={programPdf} download>
                  <ChevronsRight className="download-pointer" size={20} aria-hidden="true" />
                  Download program PDF
                  <Download size={18} aria-hidden="true" />
                </a>
              </div>
            </div>

            <section className="program-brief seq" aria-label="Program schedule and location">
              <div className="program-orbit" aria-hidden="true">
                <span className="orbit-track orbit-track-inner" />
                <span className="orbit-track" />
              </div>
              <p className="schedule-label">Program starts</p>
              <time className="schedule-date" dateTime="2026-12-07">07 <span>December <b>2026</b></span></time>
              <div className="schedule-hours">
                <p className="schedule-label">Daily schedule · 6 hours</p>
                <p className="schedule-time">10:30 AM – 5:30 PM <span>IST</span></p>
              </div>
              <ul className="program-details" role="list">
                <li><MapPin size={16} aria-hidden="true" /> On-site in Westhill, Kozhikode</li>
                <li><CalendarDays size={16} aria-hidden="true" /> Checkpoints · Days 10, 20, 30</li>
                <li><Phone size={16} aria-hidden="true" /> <ProgramPhone /></li>
              </ul>
            </section>
          </div>

          <div className="glance seq">
            <div><span className="tag">Length</span><b>30 working days</b></div>
            <div><span className="tag">Training</span><b>Days 1–20</b></div>
            <div><span className="tag">Hands-on</span><b>Days 21–30</b></div>
            <div><span className="tag">Daily</span><b>6 hours</b></div>
          </div>
        </div>

        <nav className="subnav" aria-label="Internship sections">
          <div className="wrap">
            <a href="#overview">Overview</a>
            <a href="#phase1">Phase 1</a>
            <a href="#phase2">Phase 2</a>
            <a href="#phase3">Phase 3</a>
            <a href="#rhythm">Daily rhythm</a>
            <a href="#outcomes">Outcomes</a>
            <a href="#apply">Apply</a>
          </div>
        </nav>

        {/* OVERVIEW */}
        <section id="overview" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="eyebrow">At a glance</div>
            <h2>Three phases.</h2>
            <ProgramPartners className="section-partners" />
            <div className="grid g3" style={{ marginTop: 44 }}>
              <div className="card">
                <div className="phase-num">PHASE 01 · DAYS 1–10</div>
                <h3>Foundations</h3>
                <p>Python, Git, data libraries, Machine Learning algorithms.</p>
                <div className="kv" style={{ marginTop: 22 }}><div><small>Output</small><span>A tested Python package and a trained ML model</span></div></div>
              </div>
              <div className="card">
                <div className="phase-num">PHASE 02 · DAYS 11–20</div>
                <h3>Core AI skills</h3>
                <p>Deep Learning, Prompt Engineering, LLM APIs, RAG, Deployment.</p>
                <div className="kv" style={{ marginTop: 22 }}><div><small>Output</small><span>A deployed LLM/RAG demo and a capstone pitch</span></div></div>
              </div>
              <div className="card">
                <div className="phase-num">PHASE 03 · DAYS 21–30</div>
                <h3>Hands-on build or job</h3>
                <p>Full-time project work: build an app, or assist on a real job.</p>
                <div className="kv" style={{ marginTop: 22 }}><div><small>Output</small><span>A live app or job deliverable, a demo and a portfolio</span></div></div>
              </div>
            </div>

            <div style={{ marginTop: 80 }}>
              <div className="eyebrow">Two ways to run it · same content</div>
              <div className="grid g2" style={{ marginTop: 20 }}>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Course track</h3>
                  <p>Days 1–20 are instructor-led teaching (about 2 h) plus a guided lab (about 3 h). Days 21–30 are project studio time with mentor office hours.</p>
                </div>
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Internship track</h3>
                  <p>The same content, delivered as work. Interns join squads, take tickets and get code reviews from Day 1, and pick up real work from Day 21.</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 80 }}>
              <div className="eyebrow">How the five topics are covered</div>
              <p className="note" style={{ marginBottom: 6 }}>Taught in the days shown, used daily after, applied again in the hands-on phase.</p>
              <div className="timeline">
                <table role="table" aria-label="Curriculum coverage">
                  <thead role="rowgroup"><tr role="row"><th scope="col">Topic</th><th scope="col">Taught</th><th scope="col">Used / applied again</th></tr></thead>
                  <tbody role="rowgroup">
                    <tr role="row"><td role="cell">Python</td><td role="cell" className="pr">Days 1–6</td><td role="cell">Used every day after</td></tr>
                    <tr role="row"><td role="cell">AI: Machine Learning algorithms</td><td role="cell" className="pr">Days 7–10</td><td role="cell">Applied in Days 21–30</td></tr>
                    <tr role="row"><td role="cell">AI: Deep Learning</td><td role="cell" className="pr">Days 11–13</td><td role="cell">Applied in Days 21–30</td></tr>
                    <tr role="row"><td role="cell">Prompt Engineering</td><td role="cell" className="pr">Days 14–16</td><td role="cell">Applied in Days 21–30</td></tr>
                    <tr role="row"><td role="cell">AI: RAG</td><td role="cell" className="pr">Days 17–18</td><td role="cell">Applied in Days 21–30</td></tr>
                    <tr role="row"><td role="cell">Deployment</td><td role="cell" className="pr">Days 19–20</td><td role="cell">Applied again Days 27–28</td></tr>
                    <tr role="row"><td role="cell">Hands-on job or app build</td><td role="cell" className="pr">Days 21–30</td><td role="cell">Both paths</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="tag" style={{ marginTop: 14 }}>Checkpoints · Day 10 (Phase 1) · Day 20 (Phase 2) · Day 30 (Phase 3)</p>
            </div>
          </div>
        </section>

        {/* PHASE 1 */}
        <section id="phase1">
          <div className="wrap">
            <div className="phase-head">
              <div>
                <div className="phase-num">PHASE 01 · DAYS 1–10</div>
                <h2 style={{ marginTop: 14 }}>Foundations.</h2>
              </div>
              <div className="chips">
                <span className="chip"><b>Covers</b> Python, Git, data libraries, ML algorithms</span>
                <span className="chip"><b>Output</b> A tested Python package and a trained ML model</span>
              </div>
            </div>
            <div className="days">
              <div className="row head"><span>Day</span><span>Theme</span><span>What is taught</span><span>Hands-on output</span></div>
              <div className="row"><span className="d">01</span><span className="t">Orientation and Python basics</span><span className="w" data-l="What is taught">Program overview, setup (Python 3.12, VS Code, Colab, GitHub), variables, types, conditions, loops, functions</span><span className="o" data-l="Hands-on output">15 practice problems; squads formed (internship)</span></div>
              <div className="row"><span className="d">02</span><span className="t">Python data structures</span><span className="w" data-l="What is taught">Lists, dicts, sets, tuples, comprehensions, file I/O, JSON and CSV</span><span className="o" data-l="Hands-on output">CLI expense tracker saving to JSON</span></div>
              <div className="row"><span className="d">03</span><span className="t">Writing real Python</span><span className="w" data-l="What is taught">OOP, modules, virtual environments, pip, exceptions, logging</span><span className="o" data-l="Hands-on output">Tracker refactored into classes and a package</span></div>
              <div className="row"><span className="d">04</span><span className="t">Git and quality</span><span className="w" data-l="What is taught">Git workflow, branches, pull requests, code review, pytest</span><span className="o" data-l="Hands-on output">5 tests written; first PR opened and reviewed</span></div>
              <div className="row"><span className="d">05</span><span className="t">Data with NumPy and pandas</span><span className="w" data-l="What is taught">Arrays, DataFrames, cleaning, joins, groupby</span><span className="o" data-l="Hands-on output">Clean a messy real dataset</span></div>
              <div className="row"><span className="d">06</span><span className="t">Visualisation and APIs</span><span className="w" data-l="What is taught">Matplotlib, EDA, calling REST APIs with requests</span><span className="o" data-l="Hands-on output"><b>Mini project 1</b> · Data-analysis notebook</span></div>
              <div className="row"><span className="d">07</span><span className="t">ML algorithms I</span><span className="w" data-l="What is taught">ML workflow, train/test split, linear and logistic regression</span><span className="o" data-l="Hands-on output">House-price predictor</span></div>
              <div className="row"><span className="d">08</span><span className="t">ML algorithms II</span><span className="w" data-l="What is taught">Decision trees, random forests, kNN, metrics (precision, recall, F1, confusion matrix), overfitting</span><span className="o" data-l="Hands-on output">Compare 3 classifiers on one dataset</span></div>
              <div className="row"><span className="d">09</span><span className="t">ML algorithms III</span><span className="w" data-l="What is taught">Feature engineering, cross-validation, hyperparameter tuning, k-means clustering</span><span className="o" data-l="Hands-on output">Customer segmentation plus tuned model</span></div>
              <div className="row cp"><span className="d">10</span><span className="t">Phase 1 checkpoint</span><span className="w" data-l="What is taught">Review and Q&amp;A, how to write a model-evaluation report</span><span className="o" data-l="Hands-on output"><b>MINI PROJECT 2</b>End-to-end ML model with a 1-page report; 20-question quiz</span></div>
            </div>
          </div>
        </section>

        {/* PHASE 2 */}
        <section id="phase2">
          <div className="wrap">
            <div className="phase-head">
              <div>
                <div className="phase-num">PHASE 02 · DAYS 11–20</div>
                <h2 style={{ marginTop: 14 }}>Core AI skills.</h2>
              </div>
              <div className="chips">
                <span className="chip"><b>Covers</b> Deep Learning, Prompt Engineering, LLM APIs, RAG, Deployment</span>
                <span className="chip"><b>Output</b> A deployed LLM/RAG demo and a capstone pitch</span>
              </div>
            </div>
            <div className="days">
              <div className="row head"><span>Day</span><span>Theme</span><span>What is taught</span><span>Hands-on output</span></div>
              <div className="row"><span className="d">11</span><span className="t">Deep Learning I</span><span className="w" data-l="What is taught">Neurons, layers, activation, loss, backpropagation intuition, PyTorch basics</span><span className="o" data-l="Hands-on output">Train a small neural network from scratch</span></div>
              <div className="row"><span className="d">12</span><span className="t">Deep Learning II</span><span className="w" data-l="What is taught">CNNs, image data, transfer learning, GPU use on Colab</span><span className="o" data-l="Hands-on output">Image classifier using a pretrained model</span></div>
              <div className="row"><span className="d">13</span><span className="t">Deep Learning III</span><span className="w" data-l="What is taught">Sequences, attention, transformers, tokens, embeddings, Hugging Face pipelines, AI ethics and bias</span><span className="o" data-l="Hands-on output">Sentiment and similarity demo with a pretrained model</span></div>
              <div className="row"><span className="d">14</span><span className="t">Prompt Engineering I</span><span className="w" data-l="What is taught">How LLMs respond; role, task, context and format; zero-shot, few-shot, constraints</span><span className="o" data-l="Hands-on output">Rewrite 10 weak prompts and compare outputs</span></div>
              <div className="row"><span className="d">15</span><span className="t">Prompt Engineering II</span><span className="w" data-l="What is taught">Step-by-step reasoning, structured JSON output, system prompts, templates, prompt versioning</span><span className="o" data-l="Hands-on output">Resume parser or ticket classifier returning valid JSON</span></div>
              <div className="row"><span className="d">16</span><span className="t">LLM APIs in Python</span><span className="w" data-l="What is taught">Messages, temperature, tokens and cost, streaming, retries, tool and function calling</span><span className="o" data-l="Hands-on output">CLI chatbot with memory and one tool</span></div>
              <div className="row"><span className="d">17</span><span className="t">RAG I</span><span className="w" data-l="What is taught">Chunking, embeddings, vector stores (Chroma, FAISS), retrieval, grounded answers</span><span className="o" data-l="Hands-on output">Q&amp;A bot over a document set</span></div>
              <div className="row"><span className="d">18</span><span className="t">RAG II and evaluation</span><span className="w" data-l="What is taught">Retrieval quality, reranking, citations, hallucination and prompt-injection defences, test sets</span><span className="o" data-l="Hands-on output"><b>Mini project 3</b> · 20-case test suite; fix the 3 worst failures</span></div>
              <div className="row"><span className="d">19</span><span className="t">Deployment I</span><span className="w" data-l="What is taught">FastAPI, request validation, environment variables and secrets, Docker</span><span className="o" data-l="Hands-on output">Q&amp;A bot exposed as an API and containerised</span></div>
              <div className="row cp"><span className="d">20</span><span className="t">Deployment II and capstone pitch</span><span className="w" data-l="What is taught">Cloud hosting (Render, Hugging Face Spaces or Cloud Run), Streamlit or Gradio UI, GitHub Actions CI, logging</span><span className="o" data-l="Hands-on output"><b>CHECKPOINT 2</b>Deployed demo at a public URL; 3-minute capstone pitch</span></div>
            </div>
          </div>
        </section>

        {/* PHASE 3 */}
        <section id="phase3">
          <div className="wrap">
            <div className="phase-head">
              <div>
                <div className="phase-num">PHASE 03 · DAYS 21–30</div>
                <h2 style={{ marginTop: 14 }}>Hands-on build or job.</h2>
              </div>
              <p className="sub" style={{ margin: 0 }}>From Day 21 there is no new lecture content. Each intern or squad picks one of two paths on Day 21.</p>
            </div>

            <div className="grid g2 tracks">
              <div className="card path">
                <div><div className="tag">Path A</div><h3>Build an app</h3></div>
                <div className="kv">
                  <div><small>What it is</small><span>Build a deployed AI app from a problem statement</span></div>
                  <div><small>Examples</small><span>Campus helpdesk bot · Resume screener · Ticket triage · Study-notes summariser · Predictive-maintenance demo</span></div>
                  <div><small>Mentor</small><span>Course instructor</span></div>
                  <div><small>Proof of work</small><span>Live URL, repo, tests, evaluation</span></div>
                </div>
              </div>
              <div className="card path">
                <div><div className="tag">Path B</div><h3>Assist on a real job</h3></div>
                <div className="kv">
                  <div><small>What it is</small><span>Take scoped tasks from a host company, startup, NGO or open-source project</span></div>
                  <div><small>Examples</small><span>Data cleaning · Internal chatbot · Report automation · Test writing · Prompt tuning · Bug fixes</span></div>
                  <div><small>Mentor</small><span>Instructor plus a host-side supervisor</span></div>
                  <div><small>Proof of work</small><span>Merged pull requests or delivered tasks, supervisor feedback, short case study</span></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 64 }}>
              <div className="eyebrow">Milestones · Days 21–30 · both paths</div>
              <div className="miles">
                <div><b>21</b><span>Kickoff</span></div>
                <div><b>22</b><span>Baseline</span></div>
                <div><b>23</b><span>Backend</span></div>
                <div><b>24</b><span>AI feature</span></div>
                <div><b>25</b><span>Frontend and review</span></div>
                <div><b>26</b><span>Testing</span></div>
                <div><b>27</b><span>Ship v1</span></div>
                <div><b>28</b><span>Hardening</span></div>
                <div><b>29</b><span>Polish</span></div>
                <div><b>30</b><span>Demo day</span></div>
              </div>
            </div>

            <div style={{ marginTop: 64 }}>
              <div className="eyebrow">Day-by-day plan</div>
              <div className="days" style={{ marginTop: 20 }}>
                <div className="row p3 head"><span>Day</span><span>Milestone</span><span>Path A: Build an app</span><span>Path B: Job assist</span></div>
                <div className="row p3"><span className="d">21</span><span className="t">Kickoff</span><span className="w" data-l="Path A: Build an app">Choose problem, write user stories and success metric, draw architecture, set up repo and board</span><span className="o" data-l="Path B: Job assist">Meet supervisor, agree scope, access and success criteria; write the task plan</span></div>
                <div className="row p3"><span className="d">22</span><span className="t">Baseline</span><span className="w" data-l="Path A: Build an app">Build the core pipeline (data, model or prompt) and measure a baseline score</span><span className="o" data-l="Path B: Job assist">Understand the codebase or data; complete the first small task</span></div>
                <div className="row p3"><span className="d">23</span><span className="t">Backend</span><span className="w" data-l="Path A: Build an app">Build the API and data layer with validation and error handling</span><span className="o" data-l="Path B: Job assist">Deliver task 2 with tests; open a pull request</span></div>
                <div className="row p3"><span className="d">24</span><span className="t">AI feature</span><span className="w" data-l="Path A: Build an app">Add the LLM or RAG feature; log prompt versions</span><span className="o" data-l="Path B: Job assist">Take the AI-related task (prompt, retrieval or model change)</span></div>
                <div className="row p3"><span className="d">25</span><span className="t">Frontend and review</span><span className="w" data-l="Path A: Build an app">Build the UI (Streamlit, Gradio or web); mid-sprint review</span><span className="o" data-l="Path B: Job assist">Mid-point review with supervisor; adjust the plan</span></div>
                <div className="row p3"><span className="d">26</span><span className="t">Testing</span><span className="w" data-l="Path A: Build an app">At least 10 tests, a prompt or model evaluation set, fix top failures</span><span className="o" data-l="Path B: Job assist">Test and document your changes; fix review comments</span></div>
                <div className="row p3"><span className="d">27</span><span className="t">Ship v1</span><span className="w" data-l="Path A: Build an app">Containerise, deploy to a public URL, set up CI</span><span className="o" data-l="Path B: Job assist">Release or hand over the work in the host's workflow</span></div>
                <div className="row p3"><span className="d">28</span><span className="t">Hardening</span><span className="w" data-l="Path A: Build an app">Logging, security checks, rate limits, cost control, README</span><span className="o" data-l="Path B: Job assist">Write handover notes and a runbook for what you built</span></div>
                <div className="row p3"><span className="d">29</span><span className="t">Polish</span><span className="w" data-l="Path A: Build an app">Fix bugs, record a demo, build the portfolio page, rehearse</span><span className="o" data-l="Path B: Job assist">Prepare a 5-minute case study with before/after results</span></div>
                <div className="row p3 cp"><span className="d">30</span><span className="t">Demo day</span><span className="w" data-l="Path A: Build an app">8-minute demo to a panel, retrospective, mock interviews, certificates</span><span className="o" data-l="Path B: Job assist">Present results; collect supervisor feedback and sign-off</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* DAILY RHYTHM */}
        <section id="rhythm">
          <div className="wrap">
            <div className="eyebrow">Every day · 10:30–17:30 IST · 6 program hours</div>
            <h2>Daily rhythm and ground rules.</h2>

            <div className="rhythm" style={{ marginTop: 44 }}>
              <div className="row head"><span>Time</span><span>Days 1–20 (Training)</span><span>Days 21–30 (Hands-on)</span></div>
              <div className="row"><span className="t">10:30–10:45 <span className="tag">15 min</span></span><span className="w">Stand-up: yesterday, today, blockers</span><span className="o">Stand-up</span></div>
              <div className="row"><span className="t">10:45–12:45 <span className="tag">2 h</span></span><span className="w">Concept session with live coding</span><span className="o">Build block 1</span></div>
              <div className="row"><span className="t">12:45–13:45 <span className="tag">1 h</span></span><span className="w">Lunch</span><span className="o">Lunch</span></div>
              <div className="row"><span className="t">13:45–16:30 <span className="tag">2 h 45 min</span></span><span className="w">Guided lab and ticket work</span><span className="o">Build block 2, pair programming</span></div>
              <div className="row"><span className="t">16:30–17:00 <span className="tag">30 min</span></span><span className="w">Demo and review of the day's output</span><span className="o">Mentor check-in and code review</span></div>
              <div className="row"><span className="t">17:00–17:30 <span className="tag">30 min</span></span><span className="w">Journal: 3 lines on what was learned</span><span className="o">Update the board and write the daily log</span></div>
            </div>

            <div className="rules" style={{ marginTop: 56 }}>
              <div className="eyebrow">Ground rules</div>
              <ol>
                <li>Every day ends with something committed to GitHub</li>
                <li>Pull requests need one reviewer before merging</li>
                <li>Every tenth day (Days 10, 20, 30) has a checkpoint: quiz, demo or review</li>
                <li>Never commit API keys; use environment variables</li>
                <li>Interns who fall behind get a catch-up lab, not extra lectures</li>
              </ol>
            </div>

            <p className="note" style={{ marginTop: 40 }}>The plan assumes 30 working days (Monday to Saturday, about 5 weeks). For a strict 30 calendar days, run all 7 days a week with Sundays as lighter self-paced lab days, or compress the plan to about 24 working days by merging the lighter days.</p>
          </div>
        </section>

        {/* OUTCOMES */}
        <section id="outcomes">
          <div className="wrap">
            <div className="eyebrow">Deliverables and certification</div>
            <h2>What each intern leaves with.</h2>
            <ProgramPartners className="section-partners" />
            <div className="dl" style={{ marginTop: 44 }}>
              <div className="row head"><span>Deliverable</span><span>When</span><span>Standard</span></div>
              <div className="row"><span className="t">Python package with tests</span><span className="w">Day 4</span><span className="o">Passing pytest, clear commit history</span></div>
              <div className="row"><span className="t">Mini project 1: data analysis</span><span className="w">Day 6</span><span className="o">Notebook with cleaned data and 3 insights</span></div>
              <div className="row"><span className="t">Mini project 2: ML model and report</span><span className="w">Day 10</span><span className="o">Correct metric, no data leakage, 1-page report</span></div>
              <div className="row"><span className="t">Mini project 3: RAG bot with test suite</span><span className="w">Day 18</span><span className="o">70% pass rate on own 20-case test set</span></div>
              <div className="row"><span className="t">Deployed demo</span><span className="w">Day 20</span><span className="o">Public URL and CI running</span></div>
              <div className="row"><span className="t">Capstone app or job deliverable</span><span className="w">Day 30</span><span className="o">Live app or merged work, 10+ tests, README, 8-minute demo</span></div>
              <div className="row"><span className="t">Portfolio and CV</span><span className="w">Day 29–30</span><span className="o">GitHub profile, project write-ups, mock interview done</span></div>
            </div>

            <div className="card" style={{ marginTop: 28 }}>
              <div className="tag">Certification</div>
              <h3>Complete all three checkpoints (Days 10, 20, 30) to earn the course certificate.</h3>
              <p>Interns also receive an internship letter and, for Path B, supervisor feedback.</p>
            </div>
          </div>
        </section>

        {/* APPLY */}
        <section id="apply" className="cta">
          <div className="wrap">
            <h2>Apply for the internship</h2>
            <p className="lead">Learn the stack, ship a live app or contribute to a real project, and leave with a portfolio.</p>
            <ProgramPartners className="apply-partners" />
            <InternshipApplicationForm />
            <p className="program-contact">For more details, call <ProgramPhone />.</p>
          </div>
        </section>
      </main>
      <footer>
        <div className="wrap">
          <span>© Term Jobs</span>
          <ProgramPartners />
          <Link className="footer-how" to="/#how">How we work</Link>
        </div>
      </footer>
      <div className="dayline" aria-hidden="true" />
      <div className="daychip" ref={dayChipRef} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" strokeWidth="2.5">
          <circle className="dayring-track" cx="13" cy="13" r="10" />
          <circle className="dayring" cx="13" cy="13" r="10" strokeLinecap="round" pathLength="1" transform="rotate(-90 13 13)" />
        </svg>
        <span>Day <b ref={dayNumberRef}>1</b> of 30</span>
      </div>
    </div>
  );
}
