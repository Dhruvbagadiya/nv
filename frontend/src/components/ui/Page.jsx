// Replaces the `<div className="view active">` wrapper every feature component
// carried over from the single-page HTML mockup, where `.view { display: none }`
// plus `.view.active { display: block }` was how tabs were switched. Routing does
// that job now, and the old pair was a footgun: forget `active` and the page
// renders invisible with no error anywhere.
//
// `.page` keeps the fade-up entry animation but never controls visibility.
export default function Page({ title, subtitle, eyebrow, actions, children }) {
  return (
    <div className="page">
      {(title || actions) && (
        <div className="page-head">
          <div>
            {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="head-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
