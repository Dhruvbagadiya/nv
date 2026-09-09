import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import Pagination from '../../components/ui/Pagination.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatFee } from '../../utils/format.js';

// Fixed program level labels — no HTML entities in JSX
const PROGRAM_LEVELS = [
  { value: 'MASTERS_DEGREE',            label: "Master's Degree" },
  { value: 'POST_GRADUATE_CERTIFICATE', label: 'Postgraduate Certificate' },
  { value: 'BACHELORS_DEGREE',          label: "Bachelor's Degree" },
  { value: 'THREE_YEAR_BACHELORS',      label: "3-Year Bachelor's" },
  { value: 'FOUR_YEAR_BACHELORS',       label: "4-Year Bachelor's" },
  { value: 'DIPLOMA',                   label: 'Diploma' },
  { value: 'CERTIFICATE',               label: 'Certificate' },
  { value: 'FOUNDATION',                label: 'Foundation' },
];

// Debounce — prevent an API call on every keypress
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ProgramCard({ program }) {
  const a = program.attributes;
  const initials = a.school.name.slice(0, 2).toUpperCase();
  const hasBoth  = a.minLength && a.maxLength;
  const dur      = !hasBoth ? null
    : a.minLength === a.maxLength ? `${a.minLength} months`
    : `${a.minLength}–${a.maxLength} months`;
  const nextIntake = a.programIntakes?.[0];

  return (
    <Link to={`/programs/${program.id}`} className="student-program-card">
      <div className="student-card-top">
        {a.school.logoThumbnailUrl ? (
          <img
            src={a.school.logoThumbnailUrl}
            alt=""
            className="student-card-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              // show the fallback sibling
              const fb = e.currentTarget.parentElement?.querySelector('.student-card-logo-fallback');
              if (fb) fb.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="student-card-logo-fallback"
          style={{ display: a.school.logoThumbnailUrl ? 'none' : 'flex' }}
        >
          {initials}
        </div>
        <div className="student-card-school">
          <div className="student-card-school-name">{a.school.name}</div>
          <div className="student-card-school-loc">
            {a.school.city ? `${a.school.city}, ` : ''}{a.school.countryCode}
          </div>
        </div>
      </div>

      <div className="student-card-level">
        {a.programLevel?.replace(/_/g, ' ').toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())}
      </div>
      <div className="student-card-title">{a.name}</div>

      <div className="student-card-meta">
        <div>
          <span className="student-meta-label">Tuition</span>
          <span className="student-meta-val">{formatFee(a.tuition, a.currency)}</span>
        </div>
        {dur && (
          <div>
            <span className="student-meta-label">Duration</span>
            <span className="student-meta-val">{dur}</span>
          </div>
        )}
        {nextIntake && (
          <div>
            <span className="student-meta-label">Next intake</span>
            <span className="student-meta-val">
              {new Date(nextIntake.startDate).toLocaleDateString(undefined, {
                month: 'short', year: 'numeric',
              })}
            </span>
          </div>
        )}
        <div>
          <span className="student-meta-label">App fee</span>
          <span className="student-meta-val">
            {Number(a.applicationFee) === 0 ? 'Free' : formatFee(a.applicationFee, a.currency)}
          </span>
        </div>
      </div>

      {a.tags?.includes('scholarships_available') && (
        <div className="student-card-badge">Scholarships available</div>
      )}
    </Link>
  );
}

export default function StudentProgramBrowser() {
  const [searchParams] = useSearchParams();
  const { countries } = useCountries();

  // Controlled input value (updates on every keystroke for responsive UX)
  const [searchInput,  setSearchInput]  = useState(searchParams.get('search') ?? '');
  // Debounced value — only changes 350ms after the user stops typing
  const debouncedSearch = useDebounced(searchInput);

  const [country,      setCountry]      = useState('ALL');
  const [programLevel, setProgramLevel] = useState('');
  const [page,         setPage]         = useState(1);

  // Reset page when any filter changes
  const handleSearchChange = useCallback((val) => {
    setSearchInput(val);
    setPage(1);
  }, []);
  const handleCountryChange = useCallback((val) => {
    setCountry(val);
    setPage(1);
  }, []);
  const handleLevelChange = useCallback((val) => {
    setProgramLevel(val);
    setPage(1);
  }, []);

  // Query fires only when the debounced value changes
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['student-programs', country, debouncedSearch, programLevel, page],
    queryFn: () => fetchCourses({
      country,
      search:       debouncedSearch || undefined,
      programLevel: programLevel    || undefined,
      page,
    }),
    placeholderData: keepPreviousData,
  });

  const programs = data?.data ?? [];
  const meta     = data?.meta;
  const total    = meta?.counts?.total ?? 0;

  return (
    <div className="student-browser">
      {/* Hero search bar */}
      <div className="student-hero">
        <h1 className="student-hero-title">Find your perfect program</h1>
        <p className="student-hero-sub">
          Browse {total > 0 ? total.toLocaleString() : 'thousands of'} programs at top universities worldwide
        </p>
        <div className="student-hero-search">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className="student-search-icon"
          >
            <circle cx="10" cy="10" r="6"/>
            <line x1="20" y1="20" x2="14.5" y2="14.5"/>
          </svg>
          <input
            type="search"
            placeholder="Search programs, universities or cities…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search programs"
          />
          {/* Show a subtle spinner while debounce is pending */}
          {isFetching && searchInput !== debouncedSearch && (
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: 'rgba(255,255,255,0.6)',
            }}>…</span>
          )}
        </div>
      </div>

      <div className="student-browser-body">
        {/* Sidebar filters */}
        <aside className="student-filters">
          <div className="student-filter-section">
            <div className="student-filter-label">Destination</div>
            <select value={country} onChange={(e) => handleCountryChange(e.target.value)}>
              <option value="ALL">All countries</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flagEmoji ? `${c.flagEmoji} ` : ''}{c.name}
                  {c.institutionCount ? ` (${c.institutionCount})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="student-filter-section">
            <div className="student-filter-label">Program level</div>
            <div className="student-filter-options">
              <label className="student-filter-opt">
                <input
                  type="radio" name="level" value=""
                  checked={programLevel === ''}
                  onChange={() => handleLevelChange('')}
                />
                All levels
              </label>
              {PROGRAM_LEVELS.map((l) => (
                <label key={l.value} className="student-filter-opt">
                  <input
                    type="radio" name="level" value={l.value}
                    checked={programLevel === l.value}
                    onChange={() => handleLevelChange(l.value)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>

          {/* Active filter pills */}
          {(country !== 'ALL' || programLevel || debouncedSearch) && (
            <div style={{ marginTop: 12 }}>
              <div className="student-filter-label" style={{ marginBottom: 6 }}>Active filters</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {debouncedSearch && (
                  <span className="student-filter-pill">
                    &ldquo;{debouncedSearch}&rdquo;
                    <button onClick={() => handleSearchChange('')}>×</button>
                  </span>
                )}
                {country !== 'ALL' && (
                  <span className="student-filter-pill">
                    {countries.find((c) => c.code === country)?.name ?? country}
                    <button onClick={() => handleCountryChange('ALL')}>×</button>
                  </span>
                )}
                {programLevel && (
                  <span className="student-filter-pill">
                    {PROGRAM_LEVELS.find((l) => l.value === programLevel)?.label ?? programLevel}
                    <button onClick={() => handleLevelChange('')}>×</button>
                  </span>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Results panel */}
        <div className="student-results">
          <div className="student-results-header">
            {meta ? (
              <span>
                <b>{total.toLocaleString()}</b> program{total !== 1 ? 's' : ''} found
                {isFetching && <span style={{ color: 'var(--ink-400)', marginLeft: 8, fontSize: 11 }}>updating…</span>}
              </span>
            ) : null}
          </div>

          {isLoading && (
            <div className="student-programs-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="student-program-card student-card-skeleton" />
              ))}
            </div>
          )}

          {isError && (
            <div className="student-empty-state">
              <div className="student-empty-icon"><Icon name="alert" size={22} /></div>
              <h3>Couldn&rsquo;t load programs</h3>
              <p>Please check your connection and try again.</p>
            </div>
          )}

          {!isLoading && !isError && programs.length === 0 && (
            <div className="student-empty-state">
              <div className="student-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="10" cy="10" r="6"/><line x1="20" y1="20" x2="14.5" y2="14.5"/>
                </svg>
              </div>
              <h3>No programs found</h3>
              <p>Try different keywords, a different country, or remove some filters.</p>
              {(country !== 'ALL' || programLevel || debouncedSearch) && (
                <button
                  className="btn btn-outline"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    handleSearchChange('');
                    handleCountryChange('ALL');
                    handleLevelChange('');
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          <div className="student-programs-grid">
            {programs.map((p) => <ProgramCard key={p.id} program={p} />)}
          </div>

          {meta && total > 0 && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={total}
              pageSize={meta.pageSize}
              // Without this the pager offered all 7,757 pages, but the API
              // refuses an offset past page 834 — so the last-page button led
              // to an error. maxPage is what is actually navigable; Pagination
              // caps at it and explains how to reach the rest.
              maxPage={meta.maxPage}
              onChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
