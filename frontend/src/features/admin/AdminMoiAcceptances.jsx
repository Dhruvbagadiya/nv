import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { programLevelLabel } from '../../constants/referenceData.js';
import { fetchMoiAcceptances, createMoiAcceptance, updateMoiAcceptance, deleteMoiAcceptance } from '../../api/admin.js';
import { useCountries } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', institutionId: '', programLevel: '', page: 1 };

export default function AdminMoiAcceptances() {
  const { options: countryOptions, isError: countriesFailed } = useCountries();

  const resource = {
    title: 'MOI Acceptances',
    subtitle: 'Ministry of Interior acceptance records per institution and course type',
    queryKey: ['moi-institutions', 'admin'],
    createLabel: 'Add MOI record',
    emptyMessage: 'No MOI acceptance records yet.',

    list: fetchMoiAcceptances,
    create: createMoiAcceptance,
    update: updateMoiAcceptance,
    // This is a hard delete, not an archive — say so on the button.
    removeLabel: 'Delete',
    remove: deleteMoiAcceptance,
    confirmRemove: (r) => `Delete the MOI record for ${r.institution.name} (${r.courseType})?`,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'country',       label: 'Country',     type: 'select', placeholder: 'Any country',     options: countryOptions, optionsError: countriesFailed },
      { name: 'institutionId', label: 'Institution',  type: 'institution' },
      // A list, not a text box. Filtering on a typed string meant the filter
      // only worked if you spelled the award the same way the admin who entered
      // it did.
      { name: 'programLevel',  label: 'Program level', type: 'programLevel' },
    ],

    columns: [
      {
        key: 'institution',
        header: 'Institution',
        className: 'cell-strong',
        render: (r) => (
          <div>
            <div className="cell-strong">{r.institution.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              <Flag
                isoCode={r.institution.country?.isoCode}
                emoji={r.institution.country?.flagEmoji}
                code={r.institution.country?.code}
                name={r.institution.country?.name}
              />{' '}
              {r.institution.country?.name}
            </div>
          </div>
        ),
      },
      {
        key: 'programLevel',
        header: 'Program level',
        // The enum where there is one; the raw courseType for rows written
        // before the column existed, which the backfill could not map.
        render: (r) => r.programLevel
          ? programLevelLabel(r.programLevel)
          : <span title="No program level set — invisible to the MOI course filter">{r.courseType}</span>,
      },
      { key: 'years',      header: 'Years', className: 'cell-mono' },
      {
        key: 'documentUrl',
        header: 'Document',
        render: (r) => r.documentUrl
          ? <a href={r.documentUrl} target="_blank" rel="noopener noreferrer" className="alert-link">View</a>
          : '—',
      },
    ],

    formFields: [
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'institution',
        required: true,
        hint: 'The university that accepts a Medium of Instruction letter in place of IELTS.',
      },
      {
        name: 'programLevel',
        label: 'Program level',
        type: 'programLevel',
        required: true,
        // Was a free-text "Course type", which is how the same award became
        // "Bachelor's Degree", "Bachelors" and "UG" — three course types as far
        // as a groupBy is concerned, so the agent dropdown grew an option per
        // spelling and none of them could be joined to a course.
        hint: 'The same list courses use, so agents can filter the catalogue to courses this school accepts an MOI letter for.',
      },
      {
        name: 'years',
        label: 'Years accepted',
        type: 'number',
        required: true,
        defaultValue: 3,
        hint: 'How old the qualification may be and still be accepted. Enter 0 if the university sets no limit.',
      },
      {
        name: 'documentUrl',
        label: 'Document',
        type: 'file',
        category: 'moi-documents',
        hint: 'Optional. The university\'s MOI letter or policy — agents get a View link when this is set.',
      },
    ],

    toForm: (r) => ({
      institutionId: r.institutionId,
      programLevel:  r.programLevel ?? '',
      years:         r.years,
      documentUrl:   r.documentUrl ?? '',
    }),

    toPayload: (v) => ({
      institutionId: v.institutionId,
      programLevel:  v.programLevel,
      // Derived from the level rather than typed, so the label the agent screens
      // render and the enum a query joins on cannot say different things.
      courseType:    programLevelLabel(v.programLevel),
      years:         Number(v.years),
      documentUrl:   v.documentUrl || null,
    }),
  };

  return <AdminResourcePage resource={resource} />;
}
