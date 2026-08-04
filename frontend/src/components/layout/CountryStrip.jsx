import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useCountries } from '../../hooks/useReferenceData.js';

// The 15 chips used to be a hardcoded array in this file rendering plain text
// codes — the scaffold left a "paste the flag SVG here" note that was never
// filled in, so the strip showed "UK GR NZ …" where the design shows flags. And
// because the list was hardcoded, 11 of the 15 pointed at countries the database
// had never heard of: selecting one produced an empty grid with no explanation.
//
// Now driven by GET /api/countries, so the strip cannot drift from the data, and
// flagEmoji comes from the same row as the code. Emoji rather than inline SVG:
// 15 hand-drawn flags is a lot of markup to maintain for something the platform
// already renders.
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
            {c.flagEmoji && (
              <span className="flag-emoji" aria-hidden="true">
                {c.flagEmoji}
              </span>
            )}
            <span>{c.code}</span>
          </button>
        ))}
    </div>
  );
}
