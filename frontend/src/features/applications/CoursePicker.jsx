import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCourses } from '../../api/courses.js';
import { formatFee } from '../../utils/format.js';

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function CoursePicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['courses', 'picker', debouncedSearch],
    queryFn: () => fetchCourses({ search: debouncedSearch || undefined, page: 1 }),
    placeholderData: keepPreviousData,
  });

  // New response shape: { data: [{id, type, attributes}], meta }
  const programs = data?.data ?? [];
  const selected = programs.find((p) => p.id === value);

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
        {isFetching && programs.length === 0 && (
          <div className="picker-empty">Searching…</div>
        )}
        {!isFetching && programs.length === 0 && (
          <div className="picker-empty">
            {/* A failed search read as "that course is not in the catalogue",
                so an agent abandoned a perfectly valid application. */}
            {isError
              ? 'Couldn’t search courses — try again.'
              : search ? `No courses match "${search}".` : 'Start typing to search courses.'}
          </div>
        )}

        {programs.map((program) => {
          const a = program.attributes;
          const isSelected = program.id === value;
          return (
            <button
              type="button"
              key={program.id}
              className={`picker-row${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onChange(program.id)}
            >
              <span className="picker-main">
                <span className="cell-strong">{a.name}</span>
                <span className="picker-sub">
                  {a.school.name} · {a.school.countryCode}
                  {a.school.city ? ` · ${a.school.city}` : ''}
                </span>
              </span>
              <span className="picker-fee mono">
                {formatFee(a.tuition, a.currency)}
              </span>
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
