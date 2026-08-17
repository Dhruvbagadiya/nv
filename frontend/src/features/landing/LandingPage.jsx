import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal, useCountUp } from './useReveal.js';
import BoardingAnimation from './BoardingAnimation.jsx';

// Public marketing home page. Everything else in this app is behind a login or
// is portal chrome; this is the one screen a stranger sees, so it owns its own
// header and footer rather than borrowing the portal's.
//
// Content is data-driven from the constants below so copy edits never mean
// touching JSX. Images are intentionally CSS gradients with a documented swap
// path — see IMAGE SLOTS at the bottom of landing.css.

// Surat is the head office and the number every CTA on this page dials.
// The other branches still appear in the footer with their own numbers.
const WHATSAPP = '919925913764';
const PHONE_DISPLAY = '+91 9925913764';
const EMAIL = 'nvimmigrationsurat@gmail.com';

const NAV = [
  { label: 'Home', href: '#top' },
  { label: 'About Us', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Countries', href: '#countries' },
  { label: 'Contact Us', href: '#contact' },
];

const SERVICES = [
  { icon: '🎓', title: 'Student Visa',     body: 'Professional guidance for students planning to study abroad.' },
  { icon: '🧳', title: 'Tourist Visa',     body: 'Visa assistance for international travel and tourism.' },
  { icon: '💼', title: 'Business Visa',    body: 'Support for professionals travelling for business purposes.' },
  { icon: '🛠️', title: 'Working Visa',     body: 'Help with work permit and employment visa applications.' },
  { icon: '✈️', title: 'Air Ticket Booking', body: 'Affordable international flight booking with the best routes and fares.' },
  { icon: '🗺️', title: 'Tours & Travels',  body: 'Complete travel planning including tour packages and hotel bookings.' },
  { icon: '💱', title: 'Money Exchange',   body: 'Secure foreign currency exchange for international travellers.' },
];

const COUNTRIES = [
  { name: 'Canada', iso: 'CA', group: 'North America' },
  { name: 'USA', iso: 'US', group: 'North America' },
  { name: 'UK', iso: 'GB', group: 'Europe' },
  { name: 'Germany', iso: 'DE', group: 'Europe' },
  { name: 'Poland', iso: 'PL', group: 'Europe' },
  { name: 'Malta', iso: 'MT', group: 'Europe' },
  { name: 'Russia', iso: 'RU', group: 'Europe' },
  { name: 'Europe', iso: 'EU', group: 'Europe' },
  { name: 'Australia', iso: 'AU', group: 'Oceania' },
  { name: 'New Zealand', iso: 'NZ', group: 'Oceania' },
  { name: 'Singapore', iso: 'SG', group: 'Asia' },
  { name: 'China', iso: 'CN', group: 'Asia' },
  { name: 'Mauritius', iso: 'MU', group: 'Africa' },
];

const STEPS = [
  { n: '01', t: 'Free assessment',  b: 'Tell us where you want to go. We check eligibility before you spend anything.' },
  { n: '02', t: 'Document check',   b: 'A precise checklist for your case, verified by us before it is submitted.' },
  { n: '03', t: 'We apply',         b: 'Forms, fees and appointments handled end to end, with nothing left to chance.' },
  { n: '04', t: 'You travel',       b: 'Approval tracked to the decision, then flights and stay if you want them.' },
];

const GROUPS = ['All', 'Africa', 'Asia', 'Europe', 'North America', 'Oceania'];

const STATS = [
  { value: 600, suffix: '+',  label: 'Visa Applications Assisted' },
  { value: 99,  suffix: '%',  label: 'Successful Visa Process Rate' },
  { value: 42,  suffix: 'hrs', label: 'Application Approval Time' },
  { value: 50,  suffix: '+',  label: 'Countries Operations' },
];

const REASONS = [
  { icon: '🌐', title: 'Legal Immigration Success', body: 'Since 2021 our success rate stands at 99 percent.' },
  { icon: '📄', title: 'Required Documents Support', body: 'We tell you exactly which documents are needed, and check them before submission.' },
  { icon: '⏱️', title: 'Faster Turnaround',          body: 'Applications assessed and submitted without the usual back-and-forth.' },
];

const TESTIMONIALS = [
  { name: 'Riya Patel',   text: 'Their team’s expertise and commitment to quality helped us improve efficiency across the board.' },
  { name: 'Aarav Sharma', text: 'We’ve seen measurable improvements in productivity and couldn’t be happier with the results.' },
  { name: 'Karan Singh',  text: 'Clear guidance at every step. The documentation checklist alone saved us weeks of guesswork.' },
];

const BRANCHES = [
  {
    city: 'Surat',
    phones: ['+91 9925913764'],
    address: '213, Silver Stone Arcade, Singanpore Causeway Road, Katargam, Surat, Gujarat, 395004',
  },
  {
    city: 'Kotdwara',
    phones: ['+91 7037831101', '+91 9925913877'],
    address: '2-3, N.V Immigration, Shrishti Honda Complex, Near Devi Mandir, Kotdwar, Uttarakhand - 246149',
  },
  {
    city: 'Dehradun',
    phones: ['+91 8439991102', '+91 9925913205'],
    address: 'Opp. St. Jude’s School, N.C.R Residency, Office No-1, G.M.S Road, Dehradun (UK)',
  },
];

// ── Small building blocks ────────────────────────────────────────────────────

/** Wraps children in a scroll-reveal. `delay` staggers siblings in a grid. */
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${shown ? 'is-shown' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="lp-eyebrow">
      <span className="lp-eyebrow-mark" aria-hidden="true">NV</span>
      {children}
    </div>
  );
}

function Stat({ value, suffix, label }) {
  const [ref, shown] = useReveal({ threshold: 0.4 });
  const n = useCountUp(value, { start: shown });
  return (
    <div className="lp-stat" ref={ref}>
      <div className="lp-stat-value">{n}{suffix}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [group, setGroup] = useState('All');

  // The header condenses after the hero. passive:true because this listener
  // never calls preventDefault, and saying so lets the browser scroll without
  // waiting on it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const shown = group === 'All' ? COUNTRIES : COUNTRIES.filter((c) => c.group === group);

  return (
    <div className="lp" id="top">
      <BoardingAnimation />

      {/* ── Utility bar ─────────────────────────────────────────────── */}
      <div className="lp-utility">
        <div className="lp-wrap lp-utility-inner">
          <span><strong>Working Hours:</strong> Monday to Saturday, 9 am – 6 pm</span>
          <a className="lp-utility-mail" href={`mailto:${EMAIL}`}>
            <strong>Email:</strong> {EMAIL}
          </a>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`lp-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-wrap lp-header-inner">
          <a href="#top" className="lp-brand">
            <span className="lp-brand-mark">NV</span>
            <span className="lp-brand-text">
              <strong>NV Immigration</strong>
              <small>Visa &amp; Travel Consultants</small>
            </span>
          </a>

          <nav className={`lp-nav ${menuOpen ? 'is-open' : ''}`}>
            {NAV.map((n) => (
              <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</a>
            ))}
            <Link className="lp-nav-portal" to="/login" onClick={() => setMenuOpen(false)}>
              Client Portal
            </Link>
          </nav>

          <a className="lp-call" href={`tel:${PHONE_DISPLAY.replace(/\s/g, '')}`}>
            <span className="lp-call-icon" aria-hidden="true">📞</span>
            <span className="lp-call-text">
              <small>Call us now</small>
              <strong>{PHONE_DISPLAY}</strong>
            </span>
          </a>

          <button
            className="lp-burger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-inner">
          <div className="lp-hero-copy">
            <Reveal><Eyebrow>Trusted Immigration Partner</Eyebrow></Reveal>
            <Reveal delay={80}>
              <h1 className="lp-h1">
                Our simple approach to <span className="lp-h1-accent">immigration</span> process
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lp-lead">
                At NV Immigration we make visa applications simple and stress-free. Our experts guide
                you through documentation, application submission and approval, so you can focus on
                planning your international journey.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="lp-hero-badges">
                <span className="lp-chip"><b>99%</b> approval rate</span>
                <span className="lp-chip"><b>600+</b> applications filed</span>
                <span className="lp-chip"><b>6+</b> years, 3 offices</span>
              </div>
            </Reveal>
            <Reveal delay={280}>
              <div className="lp-cta-row">
                <a className="lp-btn lp-btn-primary" href="#services">Discover Services</a>
                <a
                  className="lp-btn lp-btn-ghost"
                  href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hi NV Immigration, I would like a free consultation.')}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  Book Free Consultation
                </a>
              </div>
            </Reveal>
          </div>

          {/* The orbit is pure CSS: one rotating ring, with each flag
              counter-rotating at the same speed so it stays upright while the
              ring carries it around. */}
          <div className="lp-hero-visual">
            <div className="lp-orbit">
              <div className="lp-orbit-ring" aria-hidden="true" />
              <div className="lp-orbit-spin" aria-hidden="true">
                {/* Images, not emoji: Windows ships no flag emoji font, so a
                    flag character falls back to its two regional-indicator
                    letters — "IN" instead of the Indian flag. */}
                {['ca', 'us', 'gb', 'de', 'au', 'nz', 'sg', 'in'].map((iso, i, a) => (
                  <span key={iso} className="lp-orbit-item" style={{ '--i': i, '--n': a.length }}>
                    <span className="lp-orbit-flag">
                      <img src={`https://flagcdn.com/w40/${iso}.png`} alt="" width="30" height="20" loading="lazy" />
                    </span>
                  </span>
                ))}
              </div>
              <div className="lp-hero-photo" role="img" aria-label="Traveller holding passports and boarding passes" />

              {/* Concrete outcomes beside an abstract graphic — what makes a
                  hero feel like a product rather than a poster. */}
              <div className="lp-float lp-float-1">
                <span className="lp-float-icon" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>✓</span>
                <span>
                  <span className="lp-float-t">Visa approved</span>
                  <span className="lp-float-s">Canada · Study permit</span>
                </span>
              </div>
              <div className="lp-float lp-float-2">
                <span className="lp-float-icon" style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}>✈</span>
                <span>
                  <span className="lp-float-t">50+ countries</span>
                  <span className="lp-float-s">Student · Work · Tourist</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────────── */}
      <div className="lp-trust">
        <div className="lp-wrap lp-trust-inner">
          <span className="lp-trust-label">Why families choose us</span>
          <div className="lp-trust-items">
            <span className="lp-trust-item"><span>🛡️</span> Registered consultants</span>
            <span className="lp-trust-item"><span>💬</span> Same-day WhatsApp replies</span>
            <span className="lp-trust-item"><span>📍</span> Surat · Dehradun · Kotdwara</span>
            <span className="lp-trust-item"><span>⭐</span> 978+ clients served</span>
          </div>
        </div>
      </div>

      {/* ── Marquee ─────────────────────────────────────────────────── */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...Array(2)].map((_, dup) => (
            <div className="lp-marquee-group" key={dup}>
              {COUNTRIES.map((c) => (
                <span key={c.name} className="lp-marquee-item">
                  <span className="lp-marquee-star">✳</span>{c.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── About ───────────────────────────────────────────────────── */}
      <section className="lp-section" id="about">
        <div className="lp-wrap lp-about">
          <Reveal className="lp-about-media">
            <div className="lp-photo lp-photo-a" role="img" aria-label="Traveller in Paris" />
            <div className="lp-photo lp-photo-b" role="img" aria-label="Couple travelling" />
            <div className="lp-badge-round">
              <strong>100%</strong>
              <span>successful visa rate</span>
            </div>
          </Reveal>

          <div className="lp-about-copy">
            <Reveal><Eyebrow>Who are NV Immigration</Eyebrow></Reveal>
            <Reveal delay={80}><h2 className="lp-h2">Professional visa consulting services</h2></Reveal>
            <Reveal delay={140}>
              <p className="lp-body">
                NV Immigration provides trusted visa consultation and travel support for individuals
                planning to travel abroad. Our experienced team assists with visa applications,
                documentation preparation and travel arrangements.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <ul className="lp-ticks">
                <li>Experienced visa consultants</li>
                <li>Complete documentation guidance</li>
                <li>Trusted travel support services</li>
              </ul>
            </Reveal>
            <Reveal delay={260}>
              <p className="lp-body">
                From <strong>student visas to tourist and work visas</strong>, we guide you through
                every step to ensure a smooth and efficient process.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-tint" id="services">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div>
              <Reveal><Eyebrow>Our Services</Eyebrow></Reveal>
              <Reveal delay={80}><h2 className="lp-h2">Everything your application needs</h2></Reveal>
            </div>
            <Reveal delay={140} className="lp-section-note">
              <p className="lp-body">
                We provide skilled staff to help you get the most out of your immigration. Our
                qualified and dependable consultants can assist you at every stage.
              </p>
            </Reveal>
          </div>

          <div className="lp-grid lp-grid-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 70} className="lp-card">
                <div className="lp-card-icon" aria-hidden="true">{s.icon}</div>
                <h3 className="lp-card-title">{s.title}</h3>
                <p className="lp-card-body">{s.body}</p>
                <a className="lp-card-link" href="#contact">
                  Read More <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Process ─────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div>
              <Reveal><Eyebrow>How it works</Eyebrow></Reveal>
              <Reveal delay={80}><h2 className="lp-h2">Four steps, and we handle three of them</h2></Reveal>
            </div>
            <Reveal delay={140} className="lp-section-note">
              <p className="lp-body">
                Most people give up on a visa somewhere in the paperwork. This is the whole
                process, start to finish, so you know exactly what you are signing up for.
              </p>
            </Reveal>
          </div>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90} className="lp-step">
                <div className="lp-step-n">{s.n}</div>
                <h3 className="lp-step-t">{s.t}</h3>
                <p className="lp-step-b">{s.b}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section className="lp-stats">
        <div className="lp-wrap lp-stats-inner">
          {STATS.map((s) => <Stat key={s.label} {...s} />)}
        </div>
      </section>

      {/* ── Why choose ──────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap lp-why">
          <div>
            <Reveal><Eyebrow>Why choose NV Immigration</Eyebrow></Reveal>
            <Reveal delay={80}><h2 className="lp-h2">Countless benefits &amp; easy processing</h2></Reveal>
            <Reveal delay={140}>
              <p className="lp-body">
                Immigration rules are dynamic and complicated to apply. Dealing with the migration
                department takes experience — that is exactly what we bring.
              </p>
            </Reveal>
            <div className="lp-reasons">
              {REASONS.map((r, i) => (
                <Reveal key={r.title} delay={200 + i * 80} className="lp-reason">
                  <span className="lp-reason-icon" aria-hidden="true">{r.icon}</span>
                  <div>
                    <h3 className="lp-reason-title">{r.title}</h3>
                    <p className="lp-reason-body">{r.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120} className="lp-why-media">
            <div className="lp-photo lp-photo-c" role="img" aria-label="Consultation in progress" />
            <div className="lp-seal" aria-hidden="true">
              <span className="lp-seal-text">★ Apply Now ★ Apply Now </span>
              <span className="lp-seal-core">NV</span>
            </div>
            <div className="lp-years">
              <strong>6+</strong>
              <span>Years of experience</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Countries ───────────────────────────────────────────────── */}
      <section className="lp-section lp-section-tint" id="countries">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div>
              <Reveal><Eyebrow>Countries we offer support</Eyebrow></Reveal>
              <Reveal delay={80}><h2 className="lp-h2">Immigration &amp; visa services worldwide</h2></Reveal>
            </div>
          </div>

          <Reveal className="lp-tabs" as="div">
            {GROUPS.map((g) => (
              <button
                key={g}
                className={`lp-tab ${group === g ? 'is-active' : ''}`}
                onClick={() => setGroup(g)}
              >
                {g}
              </button>
            ))}
          </Reveal>

          <div className="lp-grid lp-grid-3">
            {shown.map((c, i) => (
              <Reveal key={c.name} delay={i * 50} className="lp-country">
                <img
                  className="lp-country-flag"
                  src={`https://flagcdn.com/w40/${c.iso.toLowerCase()}.png`}
                  alt=""
                  loading="lazy"
                  width="40" height="27"
                />
                <span>{c.name}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <div>
              <Reveal><Eyebrow>Client testimonials</Eyebrow></Reveal>
              <Reveal delay={80}><h2 className="lp-h2">What customers say about us</h2></Reveal>
            </div>
          </div>
          <div className="lp-grid lp-grid-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 90} className="lp-quote">
                <div className="lp-stars" aria-label="5 out of 5">★★★★★</div>
                <p className="lp-quote-text">{t.text}</p>
                <div className="lp-quote-name">{t.name}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────── */}
      <section className="lp-contact" id="contact">
        <div className="lp-wrap lp-contact-inner">
          <div className="lp-contact-copy">
            <Reveal><h2 className="lp-h2 lp-h2-onaccent">Feel free to enquire about any question you have</h2></Reveal>
            <Reveal delay={100}>
              <p className="lp-body lp-body-onaccent">
                Our team is ready with quick, helpful answers. Message us on WhatsApp for the fastest
                reply, or call the branch nearest to you.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <div className="lp-cta-row">
                <a
                  className="lp-btn lp-btn-onaccent"
                  href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hi NV Immigration, I have a question about a visa application.')}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  Chat on WhatsApp
                </a>
                <Link className="lp-btn lp-btn-outline-onaccent" to="/programs">
                  Browse Programs
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120} className="lp-contact-card">
            <h3 className="lp-contact-title">Talk to a consultant</h3>
            <p className="lp-contact-sub">
              Pick whichever is easiest — we answer all three.
            </p>
            <div className="lp-contact-methods">
              <a className="lp-method" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                <span className="lp-method-icon" aria-hidden="true">💬</span>
                <span><strong>WhatsApp</strong><small>Fastest reply, usually minutes</small></span>
              </a>
              <a className="lp-method" href={`tel:${PHONE_DISPLAY.replace(/\s/g, '')}`}>
                <span className="lp-method-icon" aria-hidden="true">📞</span>
                <span><strong>{PHONE_DISPLAY}</strong><small>Mon–Sat, 9 am – 6 pm</small></span>
              </a>
              <a className="lp-method" href={`mailto:${EMAIL}`}>
                <span className="lp-method-icon" aria-hidden="true">✉️</span>
                <span><strong>Email us</strong><small>{EMAIL}</small></span>
              </a>
            </div>
            <Link className="lp-btn lp-btn-primary lp-btn-block" to="/login">
              Track your application
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div>
            <a href="#top" className="lp-brand lp-brand-footer">
              <span className="lp-brand-mark">NV</span>
              <span className="lp-brand-text"><strong>NV Immigration</strong></span>
            </a>
            <p className="lp-footer-about">
              We make visa applications simple and stress-free — guiding you through documentation,
              submission and approval so you can focus on the journey.
            </p>
          </div>

          <div>
            <h4 className="lp-footer-head">Quick Links</h4>
            <ul className="lp-footer-links">
              {NAV.map((n) => <li key={n.label}><a href={n.href}>{n.label}</a></li>)}
              <li><Link to="/login">Client Portal</Link></li>
            </ul>
          </div>

          {BRANCHES.map((b) => (
            <div key={b.city}>
              <h4 className="lp-footer-head">{b.city}{b.city === 'Surat' ? ' (Head Office)' : ''}</h4>
              <ul className="lp-footer-links">
                {b.phones.map((p) => (
                  <li key={p}><a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a></li>
                ))}
                <li className="lp-footer-addr">{b.address}</li>
              </ul>
            </div>
          ))}
        </div>
        <div className="lp-wrap lp-footer-base">
          <span>© {new Date().getFullYear()} NV Immigration. All rights reserved.</span>
          <Link to="/login">Client Portal →</Link>
        </div>
      </footer>

      {/* Floating WhatsApp — the primary contact channel for this audience. */}
      <a
        className="lp-whatsapp"
        href={`https://wa.me/${WHATSAPP}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z"/>
        </svg>
      </a>
    </div>
  );
}
