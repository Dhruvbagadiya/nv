import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Icon from './Icon.jsx';
import { uploadImage, uploadFile } from '../../api/admin.js';

/**
 * Pick a file, get a URL back.
 *
 * The admin forms used to ask for a *URL* — "Logo URL", "Banner URL", the
 * attachment on an Important Update — which meant hosting the file somewhere
 * else first and pasting a link back in. Nothing in the product could produce
 * that link, so the fields stayed empty or pointed at another company's server.
 *
 * The URL box is kept, below the picker and folded away once something is set.
 * It is not decoration: the catalogue imports write `logoUrl` and `bannerUrl`
 * directly and the Document Bank import writes `fileUrl`, so an imported row
 * has a URL nobody uploaded here, and removing the field would make those rows
 * uneditable.
 */
export default function FileField({
  id,
  label,
  value,
  onChange,
  kind = 'file',        // 'image' renders a preview and accepts PNG/JPEG/WebP
  category,
  hint,
  accept,
  previewHeight = 40,
}) {
  const inputRef = useRef(null);
  const [showUrl, setShowUrl] = useState(false);

  const upload = useMutation({
    mutationFn: (file) => (kind === 'image' ? uploadImage : uploadFile)(file, category),
    onSuccess: (fileUrl) => onChange(fileUrl),
  });

  const error = upload.error
    ? (upload.error.response?.data?.error ?? 'Upload failed. Try again.')
    : null;

  const pick = (e) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires a change —
    // otherwise a retry after a failed upload appears to do nothing.
    e.target.value = '';
    if (file) upload.mutate(file);
  };

  const filename = value ? decodeURIComponent(value.split('/').pop() ?? '') : '';

  return (
    <div className="form-field file-field">
      <label className="flabel" htmlFor={id}>{label}</label>

      <div className="file-field__row">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept ?? (kind === 'image' ? 'image/png,image/jpeg,image/webp' : undefined)}
          onChange={pick}
          className="file-field__input"
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Icon name="upload" size={15} />
          {upload.isPending ? 'Uploading…' : value ? 'Replace' : 'Choose file'}
        </button>

        {value && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { onChange(''); upload.reset(); }}
            disabled={upload.isPending}
          >
            Remove
          </button>
        )}
      </div>

      {hint && <p className="field-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}

      {/* What is actually stored, so it is obvious the file took. */}
      {value && kind === 'image' && (
        <img
          src={value}
          alt={`${label} preview`}
          className="file-field__preview"
          style={{ height: previewHeight }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {value && kind !== 'image' && (
        <a className="text-link file-field__name" href={value} target="_blank" rel="noopener noreferrer">
          {filename || 'Open file'}
        </a>
      )}

      {/* Folded away by default: needed only for rows an importer wrote. */}
      <button
        type="button"
        className="file-field__toggle"
        onClick={() => setShowUrl((v) => !v)}
        aria-expanded={showUrl}
      >
        {showUrl ? 'Hide link' : 'Or paste a link'}
      </button>
      {showUrl && (
        <input
          type="text"
          className="file-field__url"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          aria-label={`${label} link`}
        />
      )}
    </div>
  );
}
