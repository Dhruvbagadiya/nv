import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useAuth } from '../../store/useAuth.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import CourseCard from './CourseCard.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { errorMessage } from '../../utils/format.js';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { PROGRAM_LEVELS } from '../../constants/referenceData.js';

const QUICK_FILTERS = ['prime', 'instant_submission', 'scholarships_available'];
const QUICK_FILTER_LABELS = {
  prime: 'Prime',
  instant_submission: 'Instant Submission',
  scholarships_available: 'Scholarships Available',
};


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

  const { data, isLoading, isError, error } = useQuery({
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

  const countryName = countries.find((c) => c.code === selectedCountry)?.name;

  // What is narrowing the 93,000 programmes right now, as removable pills. The
  // count alone does not say WHY it is the number it is — and the destination in
  // particular is set from the header strip, which is nowhere near this list.
  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => withPageReset(setSearch)('') },
    selectedCountry !== 'ALL' && {
      key: 'country',
      label: countryName ?? selectedCountry,
      clear: () => setSelectedCountry('ALL'),
    },
    institutionId && {
      key: 'institution',
      label: institutionOptions.find((o) => o.value === institutionId)?.label ?? 'Institution',
      clear: () => withPageReset(setInstitutionId)(''),
    },
    programLevel && {
      key: 'level',
      label: PROGRAM_LEVELS.find((l) => l.value === programLevel)?.label ?? programLevel,
      clear: () => withPageReset(setProgramLevel)(''),
    },
    tag && { key: 'tag', label: QUICK_FILTER_LABELS[tag], clear: () => withPageReset(setTag)(null) },
  ].filter(Boolean);

  const clearAll = () => {
    setPage(1);
    setSearch('');
    setTag(null);
    setInstitutionId('');
    setProgramLevel('');
    setSelectedCountry('ALL');
  };

  return (
    <Page
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name ?? 'partner'}`}
      actions={
        <>
          <button className="btn btn-outline" onClick={() => navigate('/partner/ask-team')}>
            Ask our team
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/partner/add-application')}>
            + Add new application
          </button>
        </>
      }
    >
      {/* One panel, four controls, each labelled. The labels are what make a
          filter row legible at a glance instead of four unexplained dropdowns —
          "All institutions" tells you the current value, not what it controls. */}
      <div className="cf-filters">
        <div className="cf-field cf-field--search">
          <label htmlFor="cf-search">Search</label>
          <div className="cf-search">
            <Icon name="search" size={15} />
            <input
              id="cf-search"
              type="text"
              placeholder="Course, institution or city"
              value={search}
              onChange={(e) => withPageReset(setSearch)(e.target.value)}
            />
            {search && (
              <button type="button" className="cf-search__clear" onClick={() => withPageReset(setSearch)('')} aria-label="Clear search">
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="cf-field">
          <label htmlFor="cf-country">Destination</label>
          <select
            id="cf-country"
            value={selectedCountry === 'ALL' ? '' : selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value || 'ALL')}
          >
            <option value="">All destinations</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.institutionCount ? ` (${c.institutionCount})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="cf-field">
          <label htmlFor="cf-institution">Institution</label>
          <select
            id="cf-institution"
            value={institutionId}
            onChange={(e) => withPageReset(setInstitutionId)(e.target.value)}
          >
            <option value="">All institutions</option>
            {institutionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="cf-field">
          <label htmlFor="cf-level">Program level</label>
          <select
            id="cf-level"
            value={programLevel}
            onChange={(e) => withPageReset(setProgramLevel)(e.target.value)}
          >
            <option value="">All program levels</option>
            {PROGRAM_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="cf-quick">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${tag === f ? ' chip-active' : ''}`}
            aria-pressed={tag === f}
            onClick={() => withPageReset(setTag)(tag === f ? null : f)}
          >
            {QUICK_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {isError && (
        // The API's own message, when it sent one. A page past the offset limit
        // returns 400 with "the last reachable page is 834" — telling the user
        // to check the API is running sends them to debug something healthy.
        <div className="empty-state">
          <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
          <h3>{errorMessage(error, 'Couldn\u2019t load courses. Please try again.')}</h3>
        </div>
      )}

      {/* Skeleton cards rather than a line of text: the grid keeps its shape, so
          the results do not jump into place underneath the filters. */}
      {isLoading && (
        <div className="grid" aria-busy="true" aria-label="Loading courses">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="pcard-skeleton" />)}
        </div>
      )}

      {data && (
        <>
          <div className="cf-toolbar">
            <div className="cf-count">
              <b>{(meta?.counts?.total ?? 0).toLocaleString()}</b>
              {(meta?.counts?.total ?? 0) === 1 ? ' program' : ' programs'}
            </div>

            {activeFilters.length > 0 && (
              <div className="cf-active">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="cf-pill"
                    onClick={f.clear}
                    title={`Remove this filter`}
                  >
                    <span>{f.label}</span>
                    <Icon name="close" size={12} />
                  </button>
                ))}
                <button type="button" className="cf-clear-all" onClick={clearAll}>
                  Clear all
                </button>
              </div>
            )}
          </div>

          {programs.length === 0 ? (
            <div className="empty-state">
              <span className="e-icon" aria-hidden="true"><Icon name="inbox" size={20} /></span>
              <h3>No programs match these filters</h3>
              <p>Try removing a filter above, or search for a broader term.</p>
              {activeFilters.length > 0 && (
                <button type="button" className="btn btn-outline" style={{ marginTop: 'var(--sp-4)' }} onClick={clearAll}>
                  Clear all filters
                </button>
              )}
            </div>
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
              maxPage={meta.maxPage}
              onChange={setPage}
            />
          )}
        </>
      )}
    </Page>
  );
}
