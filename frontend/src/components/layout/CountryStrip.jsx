import { useNavigate, useLocation } from 'react-router-dom';
import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import Flag from '../ui/Flag.jsx';

// The catalogue, not the dashboard: picking a destination is a request to see
// those universities, and a summary screen has nothing to filter.
const CATALOGUE = '/partner/courses';

// The 15 chips used to be a hardcoded array in this file rendering plain text
// codes — the scaffold left a "paste the flag SVG here" note that was never
// filled in, so the strip showed "UK GR NZ …" where the design shows flags. And
// because the list was hardcoded, 11 of the 15 pointed at countries the database
// had never heard of: selecting one produced an empty grid with no explanation.
//
// Now driven by GET /api/countries, so the strip cannot drift from the data, and
// flags render through <Flag>, not as raw emoji: Windows has no country-flag
// emoji font, so the two Regional Indicator code points fall back to their
// letters and the strip read "GB DE NZ FR…" instead of showing flags.
export default function CountryStrip() {
  const { selectedCountry, setSelectedCountry } = useCountryFilter();
  const { countries, isLoading, isError } = useCountries();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Picking a destination is a request to see those universities, and until now
  // it only wrote to the store — so from Applications or Document Bank the strip
  // appeared to do nothing at all, and the filter silently took effect later,
  // whenever the user happened to reach the catalogue. Selecting now takes you
  // there, which is what the click looks like it promises.
  const select = (code) => {
    setSelectedCountry(code);
    if (pathname !== CATALOGUE) navigate(CATALOGUE);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // A failed /countries request would otherwise render as a strip holding
  // nothing but "All" — indistinguishable from an empty catalogue.
  if (isError) return <div className="country-strip country-strip--muted">Destinations unavailable</div>;

  return (
    <nav className="country-strip" aria-label="Filter by destination country">
      <button
        type="button"
        className={`country-chip country-chip--all${selectedCountry === 'ALL' ? ' is-active' : ''}`}
        aria-pressed={selectedCountry === 'ALL'}
        onClick={() => select('ALL')}
        title="All destinations"
      >
        <span className="country-chip__flag country-chip__globe">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
          </svg>
        </span>
        <span className="country-chip__code">All</span>
      </button>

      {/* Nothing at all while loading — a row of skeleton chips in the header
          would flicker on every page load for no benefit. */}
      {!isLoading &&
        countries.map((c) => (
          <button
            key={c.code}
            type="button"
            className={`country-chip${selectedCountry === c.code ? ' is-active' : ''}`}
            aria-pressed={selectedCountry === c.code}
            // Includes the count, so hovering tells you whether a destination has
            // anything behind it before you click.
            title={`${c.name}${c.institutionCount ? ` — ${c.institutionCount} institutions` : ' — no institutions yet'}`}
            onClick={() => select(c.code)}
          >
            <span className="country-chip__flag">
              <Flag isoCode={c.isoCode} emoji={c.flagEmoji} code={c.code} name={c.name} size={20} />
            </span>
            <span className="country-chip__code">{c.code}</span>
          </button>
        ))}
    </nav>
  );
}
