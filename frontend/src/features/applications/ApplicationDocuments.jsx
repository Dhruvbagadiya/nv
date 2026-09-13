import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon.jsx';
import { errorMessage, formatDate } from '../../utils/format.js';
import { toast } from '../../store/useToast.js';
import {
  fetchApplicationDocuments,
  uploadApplicationDocument,
  removeApplicationDocument,
} from '../../api/applications.js';

/**
 * Where an agent attaches the passport scan, the transcripts and the declaration
 * form.
 *
 * There was nowhere. The Application model carried no documents at all, and
 * /api/uploads is ADMIN-only — so an agent had no upload endpoint they could
 * reach, on any screen. The stage-note field on this very panel offers
 * "Conditional offer issued, pending document upload" as its example text, so
 * the workflow assumed these existed the whole time.
 *
 * Distinct from the Document Bank, which is reference material an agent reads.
 * These belong to one application.
 */

// The kinds worth being able to ask "who is missing one of these?" about. OTHER
// exists so an unusual document is still attachable rather than blocked.
const KINDS = [
  ['PASSPORT', 'Passport'],
  ['ACADEMIC_TRANSCRIPT', 'Academic transcript'],
  ['ENGLISH_TEST', 'English test result'],
  ['STATEMENT_OF_PURPOSE', 'Statement of purpose'],
  ['LETTER_OF_RECOMMENDATION', 'Letter of recommendation'],
  ['DECLARATION_FORM', 'Declaration form'],
  ['FINANCIAL', 'Financial document'],
  ['OTHER', 'Other'],
];
const KIND_LABEL = Object.fromEntries(KINDS);

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ApplicationDocuments({ applicationId, canEdit = true }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [kind, setKind] = useState('PASSPORT');
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);

  const { data: documents = [], isLoading, isError } = useQuery({
    queryKey: ['applications', 'documents', applicationId],
    queryFn: () => fetchApplicationDocuments(applicationId),
    enabled: Boolean(applicationId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['applications', 'documents', applicationId] });

  const upload = useMutation({
    mutationFn: (file) => uploadApplicationDocument(applicationId, { file, kind, label: label.trim() }),
    onSuccess: () => {
      invalidate();
      setLabel('');
      // The input is uncontrolled, so clearing it is what lets the same file be
      // picked twice — a re-upload after a rejection otherwise fires no change
      // event and looks like nothing happened.
      if (fileRef.current) fileRef.current.value = '';
      setError(null);
      toast.success('Document uploaded.');
    },
    onError: (e) => setError(errorMessage(e, 'Could not upload that document.')),
  });

  const remove = useMutation({
    mutationFn: (documentId) => removeApplicationDocument(applicationId, documentId),
    onSuccess: () => { invalidate(); toast.success('Document removed.'); },
    onError: (e) => setError(errorMessage(e, 'Could not remove that document.')),
  });

  return (
    <div>
      <div className="admin-section-label">Documents</div>

      {canEdit && (
        <div className="appdoc-add">
          <div className="form-field">
            <label className="flabel" htmlFor="appdoc-kind">Document type</label>
            <select id="appdoc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label className="flabel" htmlFor="appdoc-label">
              Description {kind === 'OTHER' ? '' : '(optional)'}
            </label>
            <input
              id="appdoc-label"
              type="text"
              value={label}
              maxLength={160}
              placeholder={kind === 'OTHER' ? 'What is this document?' : 'e.g. Second attempt'}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="flabel" htmlFor="appdoc-file">File</label>
            <input
              id="appdoc-file"
              ref={fileRef}
              type="file"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
            <p className="field-hint">PDF, image or Office document, up to 25 MB.</p>
          </div>
        </div>
      )}

      {upload.isPending && <p className="field-hint">Uploading…</p>}
      {error && <p className="form-error">{error}</p>}

      {isLoading && <p className="field-hint">Loading documents…</p>}
      {/* A failed fetch must not render as "no documents yet" — an agent would
          re-upload files that are already there. */}
      {isError && <p className="form-error">Couldn’t load the documents for this application.</p>}

      {!isLoading && !isError && documents.length === 0 && (
        <p className="field-hint">Nothing attached yet.</p>
      )}

      {documents.length > 0 && (
        <ul className="appdoc-list">
          {documents.map((doc) => (
            <li key={doc.id} className="appdoc-row">
              <span className="appdoc-icon" aria-hidden="true">
                <Icon name={doc.contentType?.includes('pdf') ? 'pdf' : 'document'} size={16} />
              </span>

              <div className="appdoc-main">
                <div className="appdoc-name">
                  {/* The agent's own filename, because that is how they recognise
                      which file they sent; the stored key is a uuid. */}
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.fileName}</a>
                </div>
                <div className="appdoc-meta">
                  {KIND_LABEL[doc.kind] ?? doc.kind}
                  {doc.label ? ` · ${doc.label}` : ''}
                  {doc.sizeBytes ? ` · ${formatSize(doc.sizeBytes)}` : ''}
                  {` · ${formatDate(doc.createdAt)}`}
                  {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ''}
                </div>
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(doc.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
