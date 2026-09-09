import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Used by the Important Updates detail view (the eye icon), the course detail
// behind a course card's eye icon, and the blacklist list behind the red
// banner's "Click for list".
//
// Rendered into document.body through a portal rather than in place. A dialog
// is positioned against the viewport, but `position: fixed` resolves against
// the nearest ancestor with a transform, filter or containment instead of the
// viewport when one exists -- and .card sets `transform: translateY(-1px)` on
// hover, which is unavoidable when the thing opening the dialog is a button
// inside that card. Left in place, the backdrop was sized to the card and then
// clipped by its `overflow: hidden`. A portal makes the dialog independent of
// wherever it happens to be invoked from.
//
// Deliberately not a bare styled div: a dialog that cannot be dismissed with
// Escape, traps no focus, and leaves the page scrolling behind it is an
// accessibility problem, and this app already has enough controls that look
// interactive without being so.
export default function Modal({ title, subtitle, onClose, children, footer, wide = false }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Callers pass an inline arrow — `onClose={() => setEditing(null)}` — so
  // onClose is a new function on every parent render. With it in the dependency
  // list the setup below re-ran each time: focus was yanked back to the panel
  // mid-keystroke, the body-overflow value was re-captured from an already
  // hidden body, and the focus trap was torn down and rebuilt. Held in a ref so
  // the effect runs once per open and still calls the current callback.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    // Move focus into the dialog so the next Tab lands inside it rather than back
    // in the page underneath.
    panelRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // Focus trap. Without it, tabbing walks out of the dialog into the page
      // behind, which for a screen-reader user makes the modal effectively
      // invisible.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Stop the page behind from scrolling while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
    // Deliberately empty: this is open/close lifecycle, not a subscription to
    // the callback's identity.
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal-panel${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
