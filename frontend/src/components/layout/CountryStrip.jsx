import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import Flag from '../ui/Flag.jsx';

// The 15 chips used to be a hardcoded array in this file rendering plain text
// codes — the scaffold left a "paste the flag SVG here" note that was never
// filled in, so the strip showed "UK GR NZ …" where the design shows flags. And
// because the list was hardcoded, 11 of the 15 pointed at countries the database
// had never heard of: selecting one produced an empty grid with no explanation.
//
// Now driven by GET /api/countries, so the strip cannot drift from the data, and
// Flags render through <Flag>, not as raw emoji: Windows has no country-flag
// emoji font, so the two Regional Indicator code points fall back to their
// letters and the strip read "GB DE NZ FR…" instead of showing flags.
export default function CountryStrip() {
  const { selectedCountry, setSelectedCountry } = useCountryFilter();
  const { countries, isLoading } = useCountries();

  return (
    <div className="country-strip" title="Filter everything by destination country">
      <button
        className={`country-chip all-chip${selectedCountry === 'ALL' ? ' active' : ''}`}
        onClick={() => setSelectedCountry('ALL')}
      >
        <span className="flag-globe">
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
          </svg>
        </span>
        <span>All</span>
      </button>

      {/* Nothing at all while loading — a row of skeleton chips in the header
          would flicker on every page load for no benefit. */}
      {!isLoading &&
        countries.map((c) => (
          <button
            key={c.code}
            className={`country-chip${selectedCountry === c.code ? ' active' : ''}`}
            // Includes the count, so hovering tells you whether a destination has
            // anything behind it before you click.
            title={`${c.name}${c.institutionCount ? ` — ${c.institutionCount} institutions` : ' — no institutions yet'}`}
            onClick={() => setSelectedCountry(c.code)}
          >
            <Flag isoCode={c.isoCode} emoji={c.flagEmoji} code={c.code} name={c.name} size={18} />
            <span>{c.code}</span>
          </button>
        ))}
    </div>
  );
}
