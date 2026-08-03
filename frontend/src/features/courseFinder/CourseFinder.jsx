import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { useCountryFilter } from '../../store/useCountryFilter.js';
import CourseCard from './CourseCard.jsx';
import Pagination from './Pagination.jsx';

const QUICK_FILTERS = ['Prime', 'Instant Submission', 'Scholarships Available'];

export default function CourseFinder() {
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
    <div className="view active" id="view-dashboard">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, agent name</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline">Ask our team</button>
          <button className="btn btn-primary">+ Add new application</button>
        </div>
      </div>

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
          <div className="result-count"><b>{data.total}</b> programs found</div>
          <div className="grid">
            {data.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
