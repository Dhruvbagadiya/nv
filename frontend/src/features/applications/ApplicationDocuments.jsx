import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon.jsx';
import EntityPicker from '../../components/ui/EntityPicker.jsx';
import { DOCUMENT_KIND_LABEL, searchDocumentKinds } from '../../constants/documentKinds.js';
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

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * What a row shows before the filename.
 *
 * An image gets its own preview, because that is the whole point: half of what
 * an agent attaches is a phone photo of a passport, and "01-hero.png" next to a
 * generic page icon tells them nothing about whether they sent the right one.
 * The files are already public on the CDN, so this costs one <img> and no new
 * endpoint.
 *
 * Everything else gets a TYPED tile carrying its extension rather than the same
 * grey page for all of them. A real PDF thumbnail needs rendering the first page
 * — pdf.js in the browser or a worker server-side — which is a much larger piece
 * of work than this earns; "PDF" in a red tile already answers the question the
 * icon was failing to answer.
 */
function DocumentThumb({ doc }) {
  // Through state, never by swapping the node out from under React.
  const [failed, setFailed] = useState(false);
  const isImage = doc.contentType?.startsWith('image/');

  if (isImage && !failed) {
    return (
      <img
        className="appdoc-thumb"
        src={doc.fileUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  // "application/pdf" -> PDF, and the long Office types -> DOCX, XLSX.
  const ext = (doc.fileName?.split('.').pop() ?? '').toUpperCase().slice(0, 4);
  const isPdf = doc.contentType?.includes('pdf');

  return (
    <span className={`appdoc-thumb appdoc-thumb--file${isPdf ? ' appdoc-thumb--pdf' : ''}`} aria-hidden="true">
      <Icon name={isPdf ? 'pdf' : 'document'} size={15} />
      {ext && <span className="appdoc-thumb__ext">{ext}</span>}
    </span>
  );
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
          {/* A searchable combobox, not a <select>: fifty-four options in a
              native dropdown is a scroll, and the thing an agent knows is the
              word — "bank", "TB", "CAS" — not where it sits in the list. The
              group rides along as the hint so "Transcript", which matches four
              kinds, stays tellable apart while searching. */}
          <EntityPicker
            id="appdoc-kind"
            label="Document type"
            value={kind}
            selectedLabel={DOCUMENT_KIND_LABEL[kind]}
            onChange={(value) => setKind(value || 'OTHER')}
            queryKey={['document-kinds']}
            fetchOptions={(search) =>
              searchDocumentKinds(search).map((k) => ({
                value: k.value,
                label: k.label,
                hint: k.group,
              }))
            }
            placeholder="Search document types…"
            emptyMessage="No document type matches that."
            allowClear={false}
          />

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
              {/* The thumbnail opens the file too — it is the part of the row
                  an eye goes to, so making it inert and the text clickable gets
                  it the wrong way round. */}
              <a
                className="appdoc-thumb-link"
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={-1}
                aria-hidden="true"
              >
                <DocumentThumb doc={doc} />
              </a>

              <div className="appdoc-main">
                <div className="appdoc-name">
                  {/* The agent's own filename, because that is how they recognise
                      which file they sent; the stored key is a uuid. */}
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.fileName}</a>
                </div>
                <div className="appdoc-meta">
                  {DOCUMENT_KIND_LABEL[doc.kind] ?? doc.kind}
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
