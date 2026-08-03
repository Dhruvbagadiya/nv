import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMoiAcceptances } from '../../api/moiInstitutions.js';

export default function MoiAccepted() {
  const [filters, setFilters] = useState({ country: '', courseType: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['moi-institutions', filters],
    queryFn: () => fetchMoiAcceptances(filters),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="view active" id="view-moi-accepted">
      <div className="page-head">
        <div>
          <h1>MOI accepted universities</h1>
          <p>Universities list</p>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-grid">
          <div className="filter-field">
            <label>Country</label>
            <select value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}>
              <option value="">Select country</option>
            </select>
          </div>
          <div className="filter-field">
            <label>Course type</label>
            <select value={filters.courseType} onChange={(e) => setFilters((f) => ({ ...f, courseType: e.target.value }))}>
              <option value="">Course type</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>University name</th>
              <th>Course type</th>
              <th>Years</th>
              <th>Document</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5}>Loading...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan={5}>No data available</td></tr>}
            {data?.items.map((m) => (
              <tr key={m.id}>
                <td>{m.institution.country.name}</td>
                <td className="cell-strong">{m.institution.name}</td>
                <td>{m.courseType}</td>
                <td>{m.years}</td>
                <td>
                  {m.documentUrl ? (
                    <a href={m.documentUrl} target="_blank" rel="noreferrer">View</a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
