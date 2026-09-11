import { useEffect, useRef, useState } from 'react';

/*
 * The enquiry dialog behind the contact card's main button.
 *
 * That button used to read "Track your application" and link to /login. The
 * student portal it points at is real — students can register there and follow
 * their own applications — but that is not how NV's clients actually behave:
 * applications are filed for them, so a stranger clicking "track" arrives at a
 * login for an account they have never had. The question they came to ask is
 * "where is my application", and this asks it for them.
 *
 * WHERE IT SENDS. There is no public write endpoint on this API — course
 * inquiries need partner auth and the support module is admin-only — and this
 * page's long-standing rule is that messaging is links, never a mailbox this
 * app owns. So the form composes the message and hands it to WhatsApp, which is
 * the channel the rest of the page already pushes and the one that gets
 * answered in minutes. Phone and email are offered as fallbacks for anyone
 * without WhatsApp.
 *
 * That means nothing is stored. If enquiries should land in the admin panel
 * instead, that is a public POST endpoint plus rate limiting plus a screen to
 * read them — a real piece of work, not a switch.
 */

const DESTINATIONS = [
  'Canada', 'USA', 'UK', 'Germany', 'Poland', 'Malta', 'Russia',
  'Europe (other)', 'Australia', 'New Zealand', 'Singapore', 'China',
  'Mauritius', 'Not decided yet',
];

// Kept short deliberately: these are <option> labels in a half-width select,
// and a longer sentence is truncated to "Where has my application re…".
const REASONS = [
  'Application status',
  'Start a new application',
  'Question about documents',
  'Something else',
];

export default function EnquiryDialog({ open, onClose, whatsappBase, tel, email }) {
  const [form, setForm] = useState({
    name: '', phone: '', destination: '', reason: REASONS[0], message: '',
  });
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);
  const returnFocusTo = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // LandingPage passes onClose as an inline arrow, so its identity changes on
  // every render of a 970-line page. With onClose in the dependency list the
  // setup below tore down and rebuilt each time — and its cleanup calls
  // returnFocusTo.current.focus(), which yanked focus out of the dialog
  // mid-keystroke and back to the first field. Modal.jsx holds its callback in
  // a ref for exactly this reason; this dialog never got the same fix.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusTo.current = document.activeElement;
    firstFieldRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      // Focus trap. Without it Tab walks out of the dialog and into the page
      // behind it, which is still scrollable and full of links.
      const items = panelRef.current?.querySelectorAll(
        'input, select, textarea, button, a[href]'
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    // The page behind a modal must not scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      returnFocusTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const canSend = form.name.trim() && form.phone.trim();

  const composed = [
    `Hello NV Immigration, I have an enquiry.`,
    ``,
    `Name: ${form.name.trim()}`,
    `Phone: ${form.phone.trim()}`,
    form.destination ? `Destination: ${form.destination}` : null,
    `Regarding: ${form.reason}`,
    form.message.trim() ? `\n${form.message.trim()}` : null,
  ].filter(Boolean).join('\n');

  const submit = (e) => {
    e.preventDefault();
    if (!canSend) return;
    window.open(`${whatsappBase}?text=${encodeURIComponent(composed)}`, '_blank', 'noopener');
    onClose();
  };

  return (
    <div className="lp-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="lp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-enq-title"
        ref={panelRef}
      >
        <button type="button" className="lp-dialog-x" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="lp-enq-title">Ask about your application</h2>
        <p className="lp-dialog-sub">
          Tell us who you are and we will come back to you on WhatsApp, usually within minutes.
        </p>

        <form className="lp-enq-form" onSubmit={submit}>
          <label>
            <span>Your name</span>
            <input ref={firstFieldRef} value={form.name} onChange={set('name')} required />
          </label>
          <label>
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="+91 …"
              value={form.phone}
              onChange={set('phone')}
              required
            />
          </label>
          <label>
            <span>Destination</span>
            <select value={form.destination} onChange={set('destination')}>
              <option value="">Select a country</option>
              {DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <span>What is this about?</span>
            <select value={form.reason} onChange={set('reason')}>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="lp-enq-wide">
            <span>Anything else we should know? <em>(optional)</em></span>
            <textarea rows={3} value={form.message} onChange={set('message')} />
          </label>

          <div className="lp-enq-actions">
            <button type="submit" className="lp-btn lp-btn-primary" disabled={!canSend}>
              Send on WhatsApp
            </button>
            {/* Not everyone has WhatsApp, and a dialog that offers exactly one
                way out is a dead end for those who do not. */}
            <a className="lp-btn lp-btn-ghost" href={tel}>Call instead</a>
            <a
              className="lp-btn lp-btn-ghost"
              href={`mailto:${email}?subject=${encodeURIComponent('Enquiry — NV Immigration')}&body=${encodeURIComponent(composed)}`}
            >
              Email instead
            </a>
          </div>
          <p className="lp-enq-note">
            Name and phone are all we need to reply — everything else just helps us answer faster.
          </p>
        </form>
      </div>
    </div>
  );
}
