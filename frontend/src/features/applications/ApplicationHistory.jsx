import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchApplications } from '../../api/applications.js';

export default function ApplicationHistory() {
  const [filters, setFilters] = useState({ country: '', passportNo: '', studentName: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['applications', filters],
    queryFn: () => fetchApplications(filters),
    placeholderData: keepPreviousData,
  });

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  return (
    <div className="view active" id="view-app-history">
      <div className="page-head">
        <div>
          <h1>Application history</h1>
          <p>Track all your students' applications with ease</p>
        </div>
        <button className="btn btn-primary">Add new application</button>
      </div>

      <div className="filter-card">
        <div className="filter-grid">
          <div className="filter-field">
            <label>Country</label>
            <select value={filters.country} onChange={(e) => updateFilter('country', e.target.value)}>
              <option value="">Select country</option>
            </select>
          </div>
          <div className="filter-field">
            <label>Passport no.</label>
            <input
              type="text"
              placeholder="Enter passport number"
              value={filters.passportNo}
              onChange={(e) => updateFilter('passportNo', e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label>Student name</label>
            <input
              type="text"
              placeholder="First name, last name, or both"
              value={filters.studentName}
              onChange={(e) => updateFilter('studentName', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Student name &amp; info</th>
              <th>Institution / course</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5}>Loading...</td></tr>
            )}
            {data?.items.length === 0 && (
              <tr><td colSpan={5}>No applications found</td></tr>
            )}
            {data?.items.map((app) => (
              <tr key={app.id}>
                <td className="cell-strong">{app.id.slice(0, 8)}</td>
                <td>
                  <div className="cell-strong">{app.studentName}</div>
                  <div>Passport: {app.passportNo}</div>
                </td>
                <td>
                  <div>{app.course.institution.name}</div>
                  <div className="cell-strong">{app.course.title}</div>
                </td>
                <td>
                  <div className="status-line"><b>Primary:</b> {app.primaryStatus}</div>
                  <div className="status-line"><b>Secondary:</b> {app.secondaryStatus}</div>
                </td>
                <td>
                  <div className="action-row">
                    <button className="action-icon-btn" title="View">View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
