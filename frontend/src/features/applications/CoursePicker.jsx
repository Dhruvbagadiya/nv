import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { formatFee } from '../../utils/format.js';

// Debounced so typing does not fire a request per keystroke.
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// The course field on New Application was a <select> containing a single disabled
// placeholder and a TODO, so `courseId` could never be set and the form could
// never be submitted — the application flow had no working path at all.
//
// A plain <select> would not do here either: there are 72 courses in the seed
// alone and it grows with the catalogue. This is a search box over the same
// endpoint the Dashboard uses.
export default function CoursePicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const { data, isFetching } = useQuery({
    queryKey: ['courses', 'picker', debouncedSearch],
    // Server-side search covers course title, institution name and city.
    queryFn: () => fetchCourses({ search: debouncedSearch || undefined, page: 1 }),
    placeholderData: keepPreviousData,
  });

  const courses = data?.items ?? [];

  // When arriving with ?courseId= the selected course may not be in the current
  // result page, so it is resolved and shown separately above the list.
  const selected = courses.find((c) => c.id === value);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by course, institution or city"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search courses"
      />

      <div className="picker-list">
        {isFetching && courses.length === 0 && <div className="picker-empty">Searching…</div>}
        {!isFetching && courses.length === 0 && (
          <div className="picker-empty">No courses match “{search}”.</div>
        )}

        {courses.map((course) => {
          const currency = course.institution.country?.currencyCode ?? 'USD';
          const isSelected = course.id === value;
          return (
            <button
              type="button"
              key={course.id}
              // A radio-style list rather than a dropdown: the agent needs to see
              // institution, country and fee to choose, which an <option> cannot show.
              className={`picker-row${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onChange(course.id)}
            >
              <span className="picker-main">
                <span className="cell-strong">{course.title}</span>
                <span className="picker-sub">
                  {course.institution.name} · {course.institution.country.name} · {course.city}
                </span>
              </span>
              <span className="picker-fee mono">{formatFee(course.tuitionFee, currency)}</span>
            </button>
          );
        })}
      </div>

      {value && !selected && (
        <p className="picker-note">
          A course is selected but is not in the current results — clear the search to see it.
        </p>
      )}
    </div>
  );
}
