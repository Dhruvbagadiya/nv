import { useCountryFilter } from '../../store/useCountryFilter.js';
import { COUNTRIES } from '../../constants/referenceData.js';

// The list used to be inlined here, which is why the header offered 15
// destinations while every dropdown elsewhere was empty. Now shared, so the strip
// and the filters cannot drift apart.
const countries = COUNTRIES.map((c) => ({ code: c.code, title: c.name }));

export default function CountryStrip() {
  const { selectedCountry, setSelectedCountry } = useCountryFilter();

  return (
    <div className="country-strip" title="Filter everything by destination country">
      <button
        className={`country-chip all-chip${selectedCountry === 'ALL' ? ' active' : ''}`}
        onClick={() => setSelectedCountry('ALL')}
      >
        <span className="flag-globe">
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
          </svg>
        </span>
        <span>All</span>
      </button>
      {countries.map((c) => (
        <button
          key={c.code}
          className={`country-chip${selectedCountry === c.code ? ' active' : ''}`}
          title={c.title}
          onClick={() => setSelectedCountry(c.code)}
        >
          {/* NOTE: paste the matching inline flag SVG from the mockup's
              CountryStrip markup here per country — omitted in scaffold for brevity */}
          <span>{c.code}</span>
        </button>
      ))}
    </div>
  );
}
