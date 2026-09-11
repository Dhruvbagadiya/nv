import { useState } from 'react';
import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchEntryRequirements } from '../../api/referenceScreens.js';
import { upsertEntryRequirement, archiveEntryRequirement, restoreEntryRequirement } from '../../api/admin.js';
import { useCountries } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', institutionId: '', status: 'active', page: 1 };

export default function AdminEntryRequirements() {
  // The API requires a level and there is no combined view, so the screen owns the
  // choice rather than pretending UG and PG are one list.
  const [level, setLevel] = useState('UG');
  const { options: countryOptions } = useCountries();

  const resource = {
    title: 'Entry requirements',
    subtitle: `${level === 'UG' ? 'Undergraduate' : 'Postgraduate'} programmes`,
    // Level in the key so switching tabs refetches rather than showing the other
    // level's cached rows.
    queryKey: ['entry-requirements', 'admin', level],
    createLabel: `Set ${level} requirements`,
    emptyMessage: `No ${level} requirements recorded.`,
    list: (filters) => fetchEntryRequirements({ ...filters, level }),
    // Unique on (institutionId, level), so this is a PUT upsert with no delete.
    create: upsertEntryRequirement,
    idOf: (r) => r.institutionId,
    // The upsert keys on (institutionId, level); archive and restore address the
    // requirement row itself.
    removeIdOf: (r) => r.id,
    remove: archiveEntryRequirement,
    restore: restoreEntryRequirement,
    confirmRemove: (r) => `Archive the ${level} requirements for ${r.institution?.name ?? 'this institution'}?`,
    rowLabel: (r) => r.institution?.name ?? 'requirements',

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'country', label: 'Country', type: 'select', placeholder: 'Any country', options: countryOptions },
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'institution',
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
        type: 'institution',
        required: true,
        hint: `Saves against the ${level} level. Existing ${level} requirements for this institution are replaced.`,
      },
      {
        name: 'englishRequirement', label: 'English requirement', type: 'textarea', required: true, rows: 3,
        placeholder: 'IELTS 6.0 overall with no band below 5.5 | PTE 59/59 | Waiver: 70% in class 12 English',
        // The agent screen's test filter matches on this text, so naming the test
        // is what makes the row findable.
        hint: 'Name each test and its scores. The English filter searches this text, so a row that omits "IELTS" will not show under IELTS.',
      },
      {
        name: 'academicRequirement', label: 'Academic requirement', type: 'textarea', required: true, rows: 3,
        placeholder: '55% in Bachelors; 50% for University of Mumbai, Delhi and Calcutta',
        hint: 'Marks needed, plus any university-specific exceptions and the accepted study gap.',
      },
      {
        name: 'offerTimeline',
        label: 'Offer timeline',
        type: 'text',
        required: true,
        placeholder: '48 to 72 hours',
        hint: 'How long the university takes to return an offer. Free text — write it the way the university states it.',
      },
      {
        name: 'financialInformation', label: 'Financial information', type: 'textarea', required: true, rows: 2,
        placeholder: '3000 GBP deposit, or 50% of tuition before CAS',
        hint: 'What the student must pay, and when. This is the figure agents quote, so be specific.',
      },
      {
        name: 'credibilityInterview', label: 'Credibility interview required', type: 'checkbox',
        hint: 'Tick if the university interviews the student before issuing a CAS. Agents filter on this.',
      },
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
