import { useState } from 'react';
import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchEntryRequirements } from '../../api/referenceScreens.js';
import { upsertEntryRequirement } from '../../api/admin.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', institutionId: '', page: 1 };

export default function AdminEntryRequirements() {
  // The API requires a level and there is no combined view, so the screen owns the
  // choice rather than pretending UG and PG are one list.
  const [level, setLevel] = useState('UG');
  const { options: countryOptions } = useCountries();
  const { options: institutionOptions } = useInstitutions();

  const resource = {
    title: 'Entry requirements',
    subtitle: `${level === 'UG' ? 'Undergraduate' : 'Postgraduate'} programmes`,
    // Level in the key so switching tabs refetches rather than showing the other
    // level's cached rows.
    queryKey: `admin-entry-requirements-${level}`,
    createLabel: `Set ${level} requirements`,
    emptyMessage: `No ${level} requirements recorded.`,
    list: (filters) => fetchEntryRequirements({ ...filters, level }),
    // Unique on (institutionId, level), so this is a PUT upsert with no delete.
    create: upsertEntryRequirement,
    idOf: (r) => r.institutionId,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'country', label: 'Country', type: 'select', placeholder: 'Any country', options: countryOptions },
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'select',
        placeholder: 'Any institution',
        options: institutionOptions,
      },
    ],

    columns: [
      { key: 'institution', header: 'Institution', className: 'cell-strong', render: (r) => r.institution.name },
      { key: 'englishRequirement', header: 'English', render: (r) => <span className="clamp-2">{r.englishRequirement}</span> },
      { key: 'academicRequirement', header: 'Academic', render: (r) => <span className="clamp-2">{r.academicRequirement}</span> },
      { key: 'offerTimeline', header: 'Offer timeline' },
      {
        key: 'credibilityInterview',
        header: 'Interview',
        render: (r) => (
          <span className={`status-pill ${r.credibilityInterview ? 'offer' : 'submission'}`}>
            {r.credibilityInterview ? 'Yes' : 'No'}
          </span>
        ),
      },
    ],

    formFields: [
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'select',
        options: institutionOptions,
        required: true,
        hint: `Saves against the ${level} level. Existing ${level} requirements for this institution are replaced.`,
      },
      { name: 'englishRequirement', label: 'English requirement', type: 'textarea', required: true, rows: 3 },
      { name: 'academicRequirement', label: 'Academic requirement', type: 'textarea', required: true, rows: 3 },
      {
        name: 'offerTimeline',
        label: 'Offer timeline',
        type: 'text',
        required: true,
        placeholder: '48 to 72 hours',
      },
      { name: 'financialInformation', label: 'Financial information', type: 'textarea', required: true, rows: 2 },
      { name: 'credibilityInterview', label: 'Credibility interview required', type: 'checkbox' },
    ],

    toForm: (r) => ({ ...r, institutionId: r.institutionId }),

    toPayload: (v) => ({
      institutionId: v.institutionId,
      level,
      englishRequirement: v.englishRequirement,
      academicRequirement: v.academicRequirement,
      offerTimeline: v.offerTimeline,
      financialInformation: v.financialInformation,
      credibilityInterview: Boolean(v.credibilityInterview),
    }),
  };

  return (
    <>
      <div className="level-tabs">
        {['UG', 'PG'].map((l) => (
          <button
            key={l}
            type="button"
            className={`chip${level === l ? ' chip-active' : ''}`}
            onClick={() => setLevel(l)}
            aria-pressed={level === l}
          >
            {l === 'UG' ? 'Undergraduate' : 'Postgraduate'}
          </button>
        ))}
      </div>
      <AdminResourcePage resource={resource} />
    </>
  );
}
