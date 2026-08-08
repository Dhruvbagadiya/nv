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

const QUICK_FILTERS = ['prime', 'instant_submission', 'scholarships_available'];
const QUICK_FILTER_LABELS = {
  prime: 'Prime',
  instant_submission: 'Instant Submission',
  scholarships_available: 'Scholarships Available',
};

// Matches the ProgramLevel enum values the backend accepts.
const PROGRAM_LEVELS = [
  { value: 'MASTERS_DEGREE',            label: "Master's Degree" },
  { value: 'POST_GRADUATE_CERTIFICATE', label: 'Postgraduate Certificate' },
  { value: 'BACHELORS_DEGREE',          label: "Bachelor's Degree" },
  { value: 'THREE_YEAR_BACHELORS',      label: '3-Year Bachelor\'s' },
  { value: 'FOUR_YEAR_BACHELORS',       label: '4-Year Bachelor\'s' },
  { value: 'DIPLOMA',                   label: 'Diploma' },
  { value: 'CERTIFICATE',               label: 'Certificate' },
  { value: 'FOUNDATION',                label: 'Foundation' },
];

export default function CourseFinder() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const { selectedCountry, setSelectedCountry } = useCountryFilter();
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions(
    selectedCountry && selectedCountry !== 'ALL' ? { country: selectedCountry } : {}
  );

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [tag, setTag] = useState(null);
  const [institutionId, setInstitutionId] = useState('');
  const [programLevel, setProgramLevel] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when country changes (F-12 fix).
  const [prevCountry, setPrevCountry] = useState(selectedCountry);
  if (prevCountry !== selectedCountry) {
    setPrevCountry(selectedCountry);
    setPage(1);
    setInstitutionId('');
  }

  // Pick up search term set from the header search box.
  const searchParam = searchParams.get('search') ?? '';
  const [prevSearchParam, setPrevSearchParam] = useState(searchParam);
  if (prevSearchParam !== searchParam) {
    setPrevSearchParam(searchParam);
    if (searchParam) {
      setSearch(searchParam);
      setPage(1);
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', selectedCountry, search, tag, institutionId, programLevel, page],
    queryFn: () =>
      fetchCourses({
        country: selectedCountry,
        search,
        tag,
        institutionId: institutionId || undefined,
        programLevel: programLevel || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const withPageReset = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  // New response shape: { data: [...programs], meta: { counts: { total }, page, pageSize, totalPages } }
  const programs = data?.data ?? [];
  const meta = data?.meta ?? null;

  return (
    <Page
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name ?? 'partner'}`}
      actions={
        <>
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
          value={programLevel}
          onChange={(e) => withPageReset(setProgramLevel)(e.target.value)}
          aria-label="Program level"
        >
          <option value="">All program levels</option>
          {PROGRAM_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
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
            {QUICK_FILTER_LABELS[f]}
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
            <b>{meta?.counts?.total ?? 0}</b> programs found
          </div>
          {programs.length === 0 ? (
            <p className="empty-state">No courses match these filters. Try widening them.</p>
          ) : (
            <div className="grid">
              {programs.map((program) => (
                <CourseCard key={program.id} program={program} />
              ))}
            </div>
          )}
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.counts?.total}
              pageSize={meta.pageSize}
              onChange={setPage}
            />
          )}
        </>
      )}
    </Page>
  );
}
