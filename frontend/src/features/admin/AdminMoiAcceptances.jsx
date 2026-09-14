import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { fetchMoiAcceptances, createMoiAcceptance, updateMoiAcceptance, deleteMoiAcceptance } from '../../api/admin.js';
import { useCountries } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', institutionId: '', courseType: '', page: 1 };

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
      { name: 'courseType',    label: 'Course type',  type: 'text',   placeholder: 'e.g. Masters' },
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
      { key: 'courseType', header: 'Course type' },
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
        name: 'courseType',
        label: 'Course type',
        type: 'text',
        required: true,
        placeholder: "e.g. Master's Degree",
        // The agent screen filters on this exact string, so two spellings of the
        // same award split the dropdown into two options.
        hint: 'Match the wording already used for this award — a second spelling creates a second filter option.',
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
      courseType:    r.courseType,
      years:         r.years,
      documentUrl:   r.documentUrl ?? '',
    }),

    toPayload: (v) => ({
      institutionId: v.institutionId,
      courseType:    v.courseType,
      years:         Number(v.years),
      documentUrl:   v.documentUrl || null,
    }),
  };

  return <AdminResourcePage resource={resource} />;
}
