import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountryFilter } from '../../store/useCountryFilter.js';
import { useAuth } from '../../store/useAuth.js';
import CourseCard from './CourseCard.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Page from '../../components/ui/Page.jsx';

const QUICK_FILTERS = ['Prime', 'Instant Submission', 'Scholarships Available'];

export default function CourseFinder() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const { selectedCountry } = useCountryFilter();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState(null);
  const [page, setPage] = useState(1);

  // keepPreviousData avoids the list flashing empty while a new
  // filter/page loads — same feel as the mockup's instant re-render.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', selectedCountry, search, tag, page],
    queryFn: () => fetchCourses({ country: selectedCountry, search, tag, page }),
    placeholderData: keepPreviousData,
  });

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
          placeholder="What would you like to study?"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select><option>Destination</option></select>
        <select><option>Institution</option></select>
        <select><option>Program level</option></select>
        <button className="btn btn-outline">Advanced filters</button>
      </div>

      <div className="quick-filters">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${tag === f ? ' chip-active' : ''}`}
            onClick={() => {
              setPage(1);
              setTag(tag === f ? null : f);
            }}
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
          <div className="result-count"><b>{data.meta.total}</b> programs found</div>
          <div className="grid">
            {data.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
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
