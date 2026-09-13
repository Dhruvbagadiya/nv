import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal, useCountUp } from './useReveal.js';
import BoardingAnimation from './BoardingAnimation.jsx';
import WorldBackdrop from './WorldBackdrop.jsx';
import EnquiryDialog from './EnquiryDialog.jsx';
import Icon from './Icons.jsx';
// RouteMapScene, StampScene, GlobeScene and BoardingPassScene are no longer
// imported — photographs took their places. They remain exported from
// Scenes.jsx rather than deleted: they are the fallback if a photo has to come
// out, and they need no network request.
import { SealRing } from './Scenes.jsx';
import { DESTINATIONS as COUNTRIES } from './worldMapData.js';

// Public marketing home page. Everything else in this app is behind a login or
// is portal chrome; this is the one screen a stranger sees, so it owns its own
// header and footer rather than borrowing the portal's.
//
// Content is data-driven from the constants below so copy edits never mean
// touching JSX. Iconography is the inline set in Icons.jsx, and the decorative
// artwork is inline SVG in Scenes.jsx.
//
// This page USED to ship zero raster assets. It now carries four photographs
// from public/photos, because an immigration consultancy sells trust and a
// diagram cannot do what a photograph of a person does. They are cropped and
// resized to the size they actually render at — 208 KB for the set — and each
// one carries width/height so nothing reflows as they arrive.

// Surat is the head office and the number every CTA on this page dials.
// The other branches still appear in the footer with their own numbers.
const WHATSAPP = '919925913764';
const PHONE_DISPLAY = '+91 9925913764';
const EMAIL = 'nvimmigrationsurat@gmail.com';

const TEL = `tel:${PHONE_DISPLAY.replace(/\s/g, '')}`;
const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

const NAV = [
  { label: 'Home', href: '#top', id: 'top' },
  { label: 'About Us', href: '#about', id: 'about' },
  { label: 'Services', href: '#services', id: 'services' },
  { label: 'Countries', href: '#countries', id: 'countries' },
  { label: 'FAQ', href: '#faq', id: 'faq' },
  { label: 'Contact Us', href: '#contact', id: 'contact' },
];

const SERVICES = [
  { icon: 'student',  title: 'Student Visa',      body: 'Professional guidance for students planning to study abroad.' },
  { icon: 'tourist',  title: 'Tourist Visa',      body: 'Visa assistance for international travel and tourism.' },
  { icon: 'business', title: 'Business Visa',     body: 'Support for professionals travelling for business purposes.' },
  { icon: 'working',  title: 'Working Visa',      body: 'Help with work permit and employment visa applications.' },
  { icon: 'ticket',   title: 'Air Ticket Booking', body: 'Affordable international flight booking with the best routes and fares.' },
  { icon: 'tours',    title: 'Tours & Travels',   body: 'Complete travel planning including tour packages and hotel bookings.' },
  { icon: 'exchange', title: 'Money Exchange',    body: 'Secure foreign currency exchange for international travellers.' },
];

// COUNTRIES is imported from worldMapData.js, which is the single source of
// truth for the destination list: the map, the marquee and the flag grid all
// read the same array, so a country can never appear in one and not another.

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
  { icon: 'globe',    title: 'Legal Immigration Success',  body: 'Since 2021 our success rate stands at 99 percent.' },
  { icon: 'document', title: 'Required Documents Support', body: 'We tell you exactly which documents are needed, and check them before submission.' },
  { icon: 'clock',    title: 'Faster Turnaround',          body: 'Applications assessed and submitted without the usual back-and-forth.' },
];

const TRUST = [
  { icon: 'shield', text: 'Registered consultants' },
  { icon: 'chat',   text: 'Same-day WhatsApp replies' },
  { icon: 'pin',    text: 'Surat · Dehradun · Kotdwara' },
  { icon: 'star',   text: '978+ clients served' },
];

const TESTIMONIALS = [
  { name: 'Riya Patel',   route: 'Canada · Study permit', text: 'Their team’s expertise and commitment to quality helped us improve efficiency across the board.' },
  { name: 'Aarav Sharma', route: 'Australia · Work visa',  text: 'We’ve seen measurable improvements in productivity and couldn’t be happier with the results.' },
  { name: 'Karan Singh',  route: 'UK · Tourist visa',      text: 'Clear guidance at every step. The documentation checklist alone saved us weeks of guesswork.' },
];

// Answers to the questions that actually arrive on WhatsApp. Also the section
// search engines quote directly — the matching FAQPage JSON-LD is in index.html,
// so these strings and that block must stay in step.
const FAQS = [
  {
    q: 'How long does a visa application take?',
    a: 'It depends on the country and visa type. Tourist visas are often decided in 2–4 weeks, student visas in 4–12 weeks. We tell you the current processing time for your specific case at the free assessment, before you commit to anything.',
  },
  {
    q: 'What documents will I need?',
    a: 'Every case is different, so we build you a checklist rather than handing you a generic list. Typically it covers your passport, financial proof, purpose-of-travel evidence and, for student visas, academic records and an offer letter. We verify each document before submission.',
  },
  {
    q: 'Do you charge for the first consultation?',
    a: 'No. The eligibility assessment is free. We only quote a fee once we have looked at your profile and can tell you honestly whether the application is worth filing.',
  },
  {
    q: 'What happens if my visa is refused?',
    a: 'We review the refusal letter with you, explain exactly which ground it was refused on, and advise whether to reapply, appeal, or change route. Our approval rate is 99 percent precisely because we do not file applications we expect to fail.',
  },
  {
    q: 'Can you help with flights and accommodation too?',
    a: 'Yes. We book international tickets, arrange tour packages and hotels, and handle foreign currency exchange — so the trip after the approval is covered as well.',
  },
  {
    q: 'Where are your offices?',
    a: 'Our head office is in Katargam, Surat, with branches in Kotdwara and Dehradun. Most of the process runs on WhatsApp and email, so you can work with us from anywhere in India.',
  },
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
function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${shown ? 'is-shown' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
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

/** Service/testimonial cards track the cursor so the hover highlight follows
 *  the pointer instead of washing the whole card at once. Writing to a CSS
 *  variable keeps this off the React render path — the handler never calls
 *  setState, so moving the mouse costs nothing but a style write. */
function useSpotlight() {
  return useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
}

function Faq({ q, a, open, onToggle, id }) {
  return (
    <div className={`lp-faq ${open ? 'is-open' : ''}`}>
      <h3 className="lp-faq-q">
        <button
          type="button"
          id={`faq-btn-${id}`}
          aria-expanded={open}
          aria-controls={`faq-panel-${id}`}
          onClick={onToggle}
        >
          <span>{q}</span>
          <Icon name="plus" size={20} className="lp-faq-sign" />
        </button>
      </h3>
      {/* The panel stays mounted and is collapsed with a grid-rows transition:
          grid-template-rows 0fr→1fr is the only way to animate to a content-
          driven height without measuring it in JS. Keeping it mounted also
          means the text is in the DOM for crawlers even while collapsed. */}
      <div
        className="lp-faq-panel"
        id={`faq-panel-${id}`}
        role="region"
        aria-labelledby={`faq-btn-${id}`}
      >
        <div><p className="lp-faq-a">{a}</p></div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [group, setGroup] = useState('All');
  // Which country is picked out on the map and in the flag grid. One piece of
  // state for both, so clicking in either place highlights it in the other.
  const [selectedIso, setSelectedIso] = useState(null);
  const [active, setActive] = useState('top');
  const [openFaq, setOpenFaq] = useState(0);
  const spotlight = useSpotlight();

  // The header condenses after the hero and drives the reading-progress bar.
  // passive:true because this listener never calls preventDefault, and saying
  // so lets the browser scroll without waiting on it.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll spy for the nav. rootMargin pulls the detection line down past the
  // sticky header and up from the bottom, so the highlighted link is the
  // section actually filling the viewport rather than the one grazing its edge.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean);
    if (!els.length) return undefined;

    // An IntersectionObserver callback receives only the entries whose state
    // CHANGED, not every observed element. Picking the winner from that batch
    // meant a section entering the band overrode the one already in it, and
    // nothing fired again to correct it — so the nav highlighted "About Us"
    // while the page sat at the top. The current state of every section is
    // tracked here and the winner recomputed from all of them.
    const visible = new Map();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (!visible.size) return;
        // Topmost section still crossing the band.
        const [id] = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        setActive(id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // An open mobile menu is a modal surface: Escape closes it, and the page
  // behind it must not scroll away underneath.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const shown = group === 'All' ? COUNTRIES : COUNTRIES.filter((c) => c.group === group);

  return (
    <div className="lp">
      {/* Fixed behind every section, so the continents drift on while the page
          scrolls over them. First in the DOM and z-index 0; everything else on
          this page sits on a layer above it. */}
      <WorldBackdrop />
      <BoardingAnimation />

      <EnquiryDialog
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        whatsappBase={`https://wa.me/${WHATSAPP}`}
        tel={TEL}
        email={EMAIL}
      />

      {/* Reading progress. scaleX on a fixed bar — no layout, no repaint. */}
      <div className="lp-progress" aria-hidden="true">
        <div className="lp-progress-bar" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`lp-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-wrap lp-header-inner">
          <a href="#top" className="lp-brand">
            {/* The real mark, served from our own CDN. It carries the wordmark
                itself, so it stands alone — a lettered square and a repeated
                company name were both standing in for this. */}
            <img
              className="lp-brand-logo"
              src="https://cdn.nvimmigrationpvtltd.com/brand/nv-immigration-logo.png"
              alt="NV Immigration"
              width="639"
              height="391"
            />
          </a>

          <nav className={`lp-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Primary">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className={active === n.id ? 'is-active' : ''}
                aria-current={active === n.id ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {n.label}
              </a>
            ))}
            <Link className="lp-nav-portal" to="/login" onClick={() => setMenuOpen(false)}>
              Client Portal
            </Link>
          </nav>

          <a className="lp-call" href={TEL}>
            <span className="lp-call-icon" aria-hidden="true"><Icon name="phone" size={19} /></span>
            <span className="lp-call-text">
              <small>Call us now</small>
              <strong>{PHONE_DISPLAY}</strong>
            </span>
          </a>

          <button
            className={`lp-burger ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Backdrop for the mobile nav — tapping outside is how people expect to
          dismiss a drop-down, and without this the only exit is the burger. */}
      {menuOpen && <div className="lp-nav-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {/* ── Hero ────────────────────────────────────────────────────── */}
      {/* id="top" lives here rather than on the page wrapper. On the wrapper it
          spanned the whole document, so it intersected the scroll spy's band at
          every position and the highlighted link was whichever section happened
          to fire last. */}
      <section className="lp-hero" id="top">
        <div className="lp-wrap lp-hero-inner">
          <div>
            <Reveal>
              <div className="lp-eyebrow lp-eyebrow-live">
                <span className="lp-live-dot" aria-hidden="true" />
                Trusted Immigration Partner · Surat
              </div>
            </Reveal>
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
                <a
                  className="lp-btn lp-btn-primary"
                  href={waLink('Hi NV Immigration, I would like a free consultation.')}
                  target="_blank" rel="noopener noreferrer"
                >
                  Book Free Consultation
                  <Icon name="arrow" size={18} />
                </a>
                <a className="lp-btn lp-btn-ghost" href="#services">Discover Services</a>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <p className="lp-hero-note">
                <Icon name="check" size={15} />
                Free eligibility assessment · No obligation · Reply usually within minutes
              </p>
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
              {/* A face, not a diagram. The wireframe globe that was here read as
                  a second world map on a page that already has one drifting
                  behind it; a photograph is the one warm, human thing in the
                  hero and gives the eye somewhere to land. The orbiting flags
                  around it do the "global" work the globe was doing. */}
              <div className="lp-hero-photo">
                <img
                  src={`${import.meta.env.BASE_URL || '/'}photos/hero-consultant.jpg`}
                  alt="An NV Immigration consultant holding passports and boarding passes"
                  width="700"
                  height="700"
                  fetchPriority="high"
                />
              </div>

              {/* Concrete outcomes beside an abstract graphic — what makes a
                  hero feel like a product rather than a poster. */}
              <div className="lp-float lp-float-1">
                <span className="lp-float-icon lp-float-icon--ok"><Icon name="check" size={17} /></span>
                <span>
                  <span className="lp-float-t">Visa approved</span>
                  <span className="lp-float-s">Canada · Study permit</span>
                </span>
              </div>
              <div className="lp-float lp-float-2">
                <span className="lp-float-icon lp-float-icon--accent"><Icon name="plane" size={17} /></span>
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
            {TRUST.map((t) => (
              <span className="lp-trust-item" key={t.text}>
                <Icon name={t.icon} size={18} />{t.text}
              </span>
            ))}
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
                  <Icon name="sparkle" size={17} className="lp-marquee-star" />{c.name}
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
            <figure className="lp-scene lp-scene-a lp-photo">
              <img
                src={`${import.meta.env.BASE_URL || '/'}photos/about-traveller.jpg`}
                alt="A student traveller in Paris with her backpack"
                width="660" height="880" loading="lazy"
              />
            </figure>
            <figure className="lp-scene lp-scene-b lp-photo">
              <img
                src={`${import.meta.env.BASE_URL || '/'}photos/about-couple.jpg`}
                alt="A couple travelling together with their bags"
                width="560" height="460" loading="lazy"
              />
            </figure>
            <div className="lp-badge-round">
              <strong>100%</strong>
              <span>successful visa rate</span>
            </div>
          </Reveal>

          <div>
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
                <li><Icon name="check" size={14} />Experienced visa consultants</li>
                <li><Icon name="check" size={14} />Complete documentation guidance</li>
                <li><Icon name="check" size={14} />Trusted travel support services</li>
              </ul>
            </Reveal>
            <Reveal delay={260}>
              <p className="lp-body">
                From <strong>student visas to tourist and work visas</strong>, we guide you through
                every step to ensure a smooth and efficient process.
              </p>
            </Reveal>
            <Reveal delay={310}>
              <a className="lp-textlink" href="#contact">
                Talk to a consultant <Icon name="arrow" size={17} />
              </a>
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
              <Reveal key={s.title} delay={i * 70} className="lp-card" onMouseMove={spotlight}>
                <div className="lp-card-icon"><Icon name={s.icon} size={26} /></div>
                <h3 className="lp-card-title">{s.title}</h3>
                <p className="lp-card-body">{s.body}</p>
                <a className="lp-card-link" href="#contact">
                  Read More <Icon name="arrow" size={16} />
                </a>
              </Reveal>
            ))}

            {/* The grid runs 7 services across a 4-column layout, leaving a
                hole. Filling it with the CTA turns a ragged row into a
                deliberate one — and puts an ask exactly where attention
                already stopped. */}
            <Reveal delay={SERVICES.length * 70} className="lp-card lp-card-cta">
              <div className="lp-card-icon"><Icon name="sparkle" size={26} /></div>
              <h3 className="lp-card-title">Not sure which visa?</h3>
              <p className="lp-card-body">
                Tell us where you want to go. We check your eligibility free, before you spend anything.
              </p>
              <a
                className="lp-card-link"
                href={waLink('Hi NV Immigration, I am not sure which visa suits me. Can you check my eligibility?')}
                target="_blank" rel="noopener noreferrer"
              >
                Ask on WhatsApp <Icon name="arrow" size={16} />
              </a>
            </Reveal>
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
                  <span className="lp-reason-icon"><Icon name={r.icon} size={21} /></span>
                  <div>
                    <h3 className="lp-reason-title">{r.title}</h3>
                    <p className="lp-reason-body">{r.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120} className="lp-why-media">
            <figure className="lp-scene lp-scene-c lp-photo">
              <img
                src={`${import.meta.env.BASE_URL || '/'}photos/consult-2.jpg`}
                alt="A traveller setting out with her backpack"
                width="560" height="420" loading="lazy"
              />
            </figure>
            <div className="lp-seal" aria-hidden="true">
              <SealRing />
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

          <Reveal className="lp-tabs" as="div" role="tablist">
            {GROUPS.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={group === g}
                className={`lp-tab ${group === g ? 'is-active' : ''}`}
                onClick={() => setGroup(g)}
              >
                {g}
              </button>
            ))}
          </Reveal>

          {/* The outlined WorldMap that used to sit here is hidden: the dotted
              world in WorldBackdrop now drifts behind every section, and two
              world maps on one page compete rather than reinforce.

              Removed from the render, NOT deleted — WorldMap.jsx and
              worldmap.css are untouched, and restoring it is putting this
              element back:

                <WorldMap group={group} selectedIso={selectedIso}
                  onSelect={(iso) => setSelectedIso((p) => (p === iso ? null : iso))} />

              Nothing else depended on it. It was decorative; the country grid
              below is the accessible, crawlable, tappable copy of the same
              list, and it already shares `selectedIso`. */}

          <div className="lp-grid lp-grid-3">
            {shown.map((c, i) => (
              <Reveal
                key={c.name}
                delay={i * 50}
                as="button"
                type="button"
                aria-pressed={selectedIso === c.iso}
                className={`lp-country ${selectedIso === c.iso ? 'is-selected' : ''}`}
                onClick={() => setSelectedIso((prev) => (prev === c.iso ? null : c.iso))}
              >
                <img
                  className="lp-country-flag"
                  src={`https://flagcdn.com/w40/${c.iso.toLowerCase()}.png`}
                  alt=""
                  loading="lazy"
                  width="40" height="27"
                />
                <span className="lp-country-name">{c.name}</span>
                <Icon name="arrow" size={17} className="lp-country-arrow" />
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
              <Reveal key={t.name} delay={i * 90} className="lp-quote" onMouseMove={spotlight}>
                <div className="lp-stars" aria-label="5 out of 5">
                  {[0, 1, 2, 3, 4].map((s) => <Icon key={s} name="star" size={16} />)}
                </div>
                <p className="lp-quote-text">{t.text}</p>
                <div className="lp-quote-by">
                  {/* Initials, not a stock headshot — a fake face on a real
                      business's testimonial is a lie; initials are not. */}
                  <span className="lp-avatar" aria-hidden="true">
                    {t.name.split(' ').map((w) => w[0]).join('')}
                  </span>
                  <span>
                    <span className="lp-quote-name">{t.name}</span>
                    <span className="lp-quote-route">{t.route}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-tint" id="faq">
        <div className="lp-wrap lp-faqs">
          <div className="lp-faqs-copy">
            <Reveal><Eyebrow>Common questions</Eyebrow></Reveal>
            <Reveal delay={80}><h2 className="lp-h2">Answers before you ask</h2></Reveal>
            <Reveal delay={140}>
              <p className="lp-body">
                The six questions we field most often on WhatsApp. If yours is not here, send it over —
                we answer every message.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <a
                className="lp-btn lp-btn-ghost"
                href={waLink('Hi NV Immigration, I have a question that is not on your FAQ.')}
                target="_blank" rel="noopener noreferrer"
              >
                <Icon name="whatsapp" size={18} />
                Ask your question
              </a>
            </Reveal>
          </div>

          <Reveal delay={120} className="lp-faq-list">
            {FAQS.map((f, i) => (
              <Faq
                key={f.q}
                id={i}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────── */}
      <section className="lp-contact" id="contact">
        <div className="lp-wrap lp-contact-inner">
          <div>
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
                  href={waLink('Hi NV Immigration, I have a question about a visa application.')}
                  target="_blank" rel="noopener noreferrer"
                >
                  <Icon name="whatsapp" size={18} />
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
                <span className="lp-method-icon lp-method-icon--wa"><Icon name="whatsapp" size={20} /></span>
                <span><strong>WhatsApp</strong><small>Fastest reply, usually minutes</small></span>
                <Icon name="arrow" size={17} className="lp-method-arrow" />
              </a>
              <a className="lp-method" href={TEL}>
                <span className="lp-method-icon"><Icon name="phone" size={19} /></span>
                <span><strong>{PHONE_DISPLAY}</strong><small>Mon–Sat, 9 am – 6 pm</small></span>
                <Icon name="arrow" size={17} className="lp-method-arrow" />
              </a>
              <a className="lp-method" href={`mailto:${EMAIL}`}>
                <span className="lp-method-icon"><Icon name="mail" size={19} /></span>
                <span><strong>Email us</strong><small>{EMAIL}</small></span>
                <Icon name="arrow" size={17} className="lp-method-arrow" />
              </a>
            </div>
            {/* Was a "Track your application" link to /login. The student
                portal behind it is real, but NV's clients do not have accounts
                there — applications are filed for them — so it sent people to a
                login for something they had never signed up to. The question
                they meant to ask is asked directly instead. */}
            <button
              type="button"
              className="lp-btn lp-btn-primary lp-btn-block"
              onClick={() => setEnquiryOpen(true)}
            >
              Ask about your application
            </button>
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
              <h4 className="lp-footer-head">
                {b.city}{b.city === 'Surat' ? ' (Head Office)' : ''}
              </h4>
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
          <Link to="/login">Client Portal <Icon name="arrow" size={15} /></Link>
        </div>
      </footer>

      {/* Floating WhatsApp — the primary contact channel for this audience.
          Hidden below 620px, where the sticky action bar takes over. */}
      <a
        className="lp-whatsapp"
        href={`https://wa.me/${WHATSAPP}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <Icon name="whatsapp" size={28} />
      </a>

      {/* Phone-only action bar. On mobile the two things anyone wants are one
          tap away and always on screen, rather than a scroll back to the hero. */}
      <div className="lp-actionbar">
        <a className="lp-actionbar-btn lp-actionbar-call" href={TEL}>
          <Icon name="phone" size={19} />Call now
        </a>
        <a
          className="lp-actionbar-btn lp-actionbar-wa"
          href={waLink('Hi NV Immigration, I would like a free consultation.')}
          target="_blank" rel="noopener noreferrer"
        >
          <Icon name="whatsapp" size={19} />WhatsApp
        </a>
      </div>
    </div>
  );
}
