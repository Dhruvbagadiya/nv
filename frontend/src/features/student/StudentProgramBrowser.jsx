import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import Pagination from '../../components/ui/Pagination.jsx';
import { formatFee } from '../../utils/format.js';

const PROGRAM_LEVELS = [
  { value: 'MASTERS_DEGREE',            label: "Master&rsquo;s Degree" },
  { value: 'POST_GRADUATE_CERTIFICATE', label: 'Postgraduate Certificate' },
  { value: 'BACHELORS_DEGREE',          label: "Bachelor&rsquo;s Degree" },
  { value: 'THREE_YEAR_BACHELORS',      label: "3-Year Bachelor's" },
  { value: 'DIPLOMA',                   label: 'Diploma' },
  { value: 'CERTIFICATE',               label: 'Certificate' },
];

function ProgramCard({ program }) {
  const a = program.attributes;
  const initials = a.school.name.slice(0, 2).toUpperCase();
  const dur = a.minLength === a.maxLength ? `${a.minLength}m` : `${a.minLength}–${a.maxLength}m`;
  const nextIntake = a.programIntakes?.[0];

  return (
    <Link to={`/programs/${program.id}`} className="student-program-card">
      <div className="student-card-top">
        {a.school.logoThumbnailUrl
          ? <img src={a.school.logoThumbnailUrl} alt="" className="student-card-logo"
              onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}/>
          : null
        }
        <div className="student-card-logo-fallback" style={{ display: a.school.logoThumbnailUrl ? 'none' : 'flex' }}>
          {initials}
        </div>
        <div className="student-card-school">
          <div className="student-card-school-name">{a.school.name}</div>
          <div className="student-card-school-loc">
            {a.school.city ? `${a.school.city}, ` : ''}{a.school.countryCode}
          </div>
        </div>
      </div>

      <div className="student-card-level">{a.programLevel?.replace(/_/g, ' ')}</div>
      <div className="student-card-title">{a.name}</div>

      <div className="student-card-meta">
        <div><span className="student-meta-label">Tuition</span><span className="student-meta-val">{formatFee(a.tuition, a.currency)}</span></div>
        <div><span className="student-meta-label">Duration</span><span className="student-meta-val">{dur}</span></div>
        {nextIntake && (
          <div><span className="student-meta-label">Next intake</span>
            <span className="student-meta-val">
              {new Date(nextIntake.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
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
  const [search, setSearch]           = useState(searchParams.get('search') ?? '');
  const [country, setCountry]         = useState('ALL');
  const [programLevel, setProgramLevel] = useState('');
  const [page, setPage]               = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-programs', country, search, programLevel, page],
    queryFn: () => fetchCourses({ country, search: search || undefined, programLevel: programLevel || undefined, page }),
    placeholderData: keepPreviousData,
  });

  const programs = data?.data ?? [];
  const meta     = data?.meta;

  return (
    <div className="student-browser">
      {/* Hero */}
      <div className="student-hero">
        <h1 className="student-hero-title">Find your perfect program</h1>
        <p className="student-hero-sub">Browse thousands of programs at top universities worldwide</p>
        <div className="student-hero-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" className="student-search-icon">
            <circle cx="10" cy="10" r="6"/><line x1="20" y1="20" x2="14.5" y2="14.5"/>
          </svg>
          <input type="search" placeholder="Search programs, universities or cities…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="student-browser-body">
        {/* Sidebar filters */}
        <aside className="student-filters">
          <div className="student-filter-section">
            <div className="student-filter-label">Country</div>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
              <option value="ALL">All countries</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flagEmoji} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="student-filter-section">
            <div className="student-filter-label">Program level</div>
            <div className="student-filter-options">
              <label className="student-filter-opt">
                <input type="radio" name="level" value="" checked={programLevel === ''}
                  onChange={() => { setProgramLevel(''); setPage(1); }} /> All levels
              </label>
              {PROGRAM_LEVELS.map((l) => (
                <label key={l.value} className="student-filter-opt">
                  <input type="radio" name="level" value={l.value} checked={programLevel === l.value}
                    onChange={() => { setProgramLevel(l.value); setPage(1); }} /> {l.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="student-results">
          <div className="student-results-header">
            {meta && <span><b>{meta.counts?.total ?? 0}</b> programs found</span>}
          </div>

          {isLoading && <p className="student-empty">Loading programs…</p>}
          {isError   && <p className="student-empty">Couldn&rsquo;t load programs. Please try again.</p>}

          {!isLoading && !isError && programs.length === 0 && (
            <p className="student-empty">No programs match your filters. Try broadening your search.</p>
          )}

          <div className="student-programs-grid">
            {programs.map((p) => <ProgramCard key={p.id} program={p} />)}
          </div>

          {meta && (
            <Pagination page={meta.page} totalPages={meta.totalPages}
              total={meta.counts?.total} pageSize={meta.pageSize} onChange={setPage} />
          )}
        </div>
      </div>
    </div>
  );
}
