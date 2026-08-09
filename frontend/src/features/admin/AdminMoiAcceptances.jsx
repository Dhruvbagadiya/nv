import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { fetchMoiAcceptances, createMoiAcceptance, updateMoiAcceptance, deleteMoiAcceptance } from '../../api/admin.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', institutionId: '', courseType: '', page: 1 };

export default function AdminMoiAcceptances() {
  const { options: countryOptions } = useCountries();
  const { options: institutionOptions } = useInstitutions();

  const resource = {
    title: 'MOI Acceptances',
    subtitle: 'Ministry of Interior acceptance records per institution and course type',
    queryKey: 'admin-moi',
    createLabel: 'Add MOI record',
    emptyMessage: 'No MOI acceptance records yet.',

    list: fetchMoiAcceptances,
    create: createMoiAcceptance,
    update: updateMoiAcceptance,
    remove: deleteMoiAcceptance,
    confirmRemove: (r) => `Delete the MOI record for ${r.institution.name} (${r.courseType})?`,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'country',       label: 'Country',     type: 'select', placeholder: 'Any country',     options: countryOptions },
      { name: 'institutionId', label: 'Institution',  type: 'select', placeholder: 'Any institution', options: institutionOptions },
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
        type: 'select',
        options: institutionOptions,
        required: true,
      },
      {
        name: 'courseType',
        label: 'Course type',
        type: 'text',
        required: true,
        placeholder: "e.g. Master's Degree",
      },
      {
        name: 'years',
        label: 'Years accepted',
        type: 'number',
        required: true,
        defaultValue: 3,
      },
      {
        name: 'documentUrl',
        label: 'Document URL',
        type: 'text',
        placeholder: 'https://… or /files/…',
        hint: 'Optional. Agents see a View link when this is set.',
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
