import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useAuth } from '../../store/useAuth.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import CourseCard from './CourseCard.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Page from '../../components/ui/Page.jsx';

const QUICK_FILTERS = ['Prime', 'Instant Submission', 'Scholarships Available'];

// Matches Course.degreeLevel, which is free text in the schema. Kept short and
// explicit rather than derived, since these three are the catalogue's whole range.
const PROGRAM_LEVELS = ["Bachelor's Degree", "Master's Degree", 'Postgraduate Certificate'];

export default function CourseFinder() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  // The header country strip is the global destination filter; the Destination
  // select below is a second entry point onto the same store, not a rival filter.
  const { selectedCountry, setSelectedCountry } = useCountryFilter();
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions(
    selectedCountry && selectedCountry !== 'ALL' ? { country: selectedCountry } : {}
  );

  // Seeded from ?search= so the header's search box (and any shared link) lands
  // here with the term already applied.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [tag, setTag] = useState(null);
  const [institutionId, setInstitutionId] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('');
  const [page, setPage] = useState(1);

  // F-12: page was reset on search and tag changes but not on country, because the
  // country lives in a separate store. Switching destination while on page 4 left
  // you on page 4 of a shorter result set — an empty grid that looks like
  // "no courses here".
  // Both resets below adjust state during render rather than in an effect.
  // setState inside an effect triggers a second render pass; React documents this
  // compare-with-previous pattern for "reset state when a value changes".
  const [prevCountry, setPrevCountry] = useState(selectedCountry);
  if (prevCountry !== selectedCountry) {
    setPrevCountry(selectedCountry);
    setPage(1);
    // The institution list is scoped to the country, so a previously chosen
    // institution may not exist in the new one.
    setInstitutionId('');
  }

  // Arriving from the header search while already on the dashboard changes only
  // the query string, so the term has to be picked up here.
  const searchParam = searchParams.get('search') ?? '';
  const [prevSearchParam, setPrevSearchParam] = useState(searchParam);
  if (prevSearchParam !== searchParam) {
    setPrevSearchParam(searchParam);
    if (searchParam) {
      setSearch(searchParam);
      setPage(1);
    }
  }

  // keepPreviousData avoids the list flashing empty while a new filter/page loads.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', selectedCountry, search, tag, institutionId, degreeLevel, page],
    queryFn: () =>
      fetchCourses({
        country: selectedCountry,
        search,
        tag,
        institutionId: institutionId || undefined,
        degreeLevel: degreeLevel || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  // Every filter change returns to page 1 — see F-12 above.
  const withPageReset = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <Page
      title="Dashboard"
      // Was the literal string "Welcome back, agent name".
      subtitle={`Welcome back, ${user?.name ?? 'partner'}`}
      actions={
        <>
          {/* Both of these were buttons with no onClick. */}
          <button className="btn btn-outline" onClick={() => navigate('/ask-team')}>
            Ask our team
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/add-application')}>
            + Add new application
          </button>
        </>
      }
    >
      <div className="filter-row">
        <input
          type="text"
          placeholder="Course, institution or city"
          value={search}
          onChange={(e) => withPageReset(setSearch)(e.target.value)}
          aria-label="Search courses"
        />

        {/* All three of these were <select><option>Label</option></select> —
            decorative markup with nothing behind them. */}
        <select
          value={selectedCountry === 'ALL' ? '' : selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value || 'ALL')}
          aria-label="Destination"
        >
          <option value="">All destinations</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
              {c.institutionCount ? ` (${c.institutionCount})` : ''}
            </option>
          ))}
        </select>

        <select
          value={institutionId}
          onChange={(e) => withPageReset(setInstitutionId)(e.target.value)}
          aria-label="Institution"
        >
          <option value="">All institutions</option>
          {institutionOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={degreeLevel}
          onChange={(e) => withPageReset(setDegreeLevel)(e.target.value)}
          aria-label="Program level"
        >
          <option value="">All program levels</option>
          {PROGRAM_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="quick-filters">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${tag === f ? ' chip-active' : ''}`}
            onClick={() => withPageReset(setTag)(tag === f ? null : f)}
          >
            {f}
          </button>
        ))}
      </div>

      {isError && (
        <p className="empty-state">Couldn&rsquo;t load courses — check the API is running.</p>
      )}
      {isLoading && <p className="empty-state">Loading courses...</p>}

      {data && (
        <>
          <div className="result-count">
            <b>{data.meta.total}</b> programs found
          </div>
          {data.items.length === 0 ? (
            <p className="empty-state">No courses match these filters. Try widening them.</p>
          ) : (
            <div className="grid">
              {data.items.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            pageSize={data.meta.pageSize}
            onChange={setPage}
          />
        </>
      )}
    </Page>
  );
}
