import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';
import {
  fetchInstitutionPhotos,
  addInstitutionPhoto,
  deleteInstitutionPhoto,
  reorderInstitutionPhotos,
} from '../../api/institutions.js';
import { errorMessage } from '../../utils/format.js';
import Icon from '../../components/ui/Icon.jsx';

/*
 * Gallery management for one institution.
 *
 * 4,985 photos arrived with the Catalogue A import and until now there was no way
 * to see, reorder or remove any of them — a broken or wrong image could only be
 * fixed by editing the database. This is that missing screen.
 *
 * Reordering is by move-up / move-down rather than drag-and-drop: a drag needs a
 * keyboard equivalent to be usable at all, and two buttons are that equivalent
 * without a second implementation to keep in step.
 */
export default function InstitutionPhotos({ institutionId, institutionName }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);

  const key = ['institution-photos', institutionId];
  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchInstitutionPhotos(institutionId),
  });

  // The gallery is also embedded in the institution and course payloads the
  // detail views read, so clearing only its own key left those showing the
  // photo set from before the edit.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    invalidateResource(queryClient, 'institutions');
  };
  const onError = (e) => setError(errorMessage(e));

  const add = useMutation({
    mutationFn: (body) => addInstitutionPhoto(institutionId, body),
    onSuccess: () => { setUrl(''); setError(null); invalidate(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (photoId) => deleteInstitutionPhoto(institutionId, photoId),
    onSuccess: invalidate,
    onError,
  });
  const reorder = useMutation({
    mutationFn: (ids) => reorderInstitutionPhotos(institutionId, ids),
    onSuccess: invalidate,
    onError,
  });

  const move = (index, delta) => {
    const next = [...photos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((p) => p.id));
  };

  const submit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    // Checked here so a typo is reported next to the field rather than as a
    // generic validation failure after a round trip.
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
      setError('Enter a full image URL, starting with https://');
      return;
    }
    add.mutate({ url: trimmed });
  };

  return (
    <div className="photo-manager">
      <div className="admin-section-label">
        Gallery {photos.length > 0 && <span className="cell-muted">({photos.length})</span>}
      </div>

      {error && <p className="form-error">{error}</p>}

      <form className="photo-add-row" onSubmit={submit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/photo.jpg"
          aria-label={`Add a photo to ${institutionName}`}
        />
        <button type="submit" className="btn btn-outline" disabled={add.isPending || !url.trim()}>
          {add.isPending ? 'Adding…' : 'Add photo'}
        </button>
      </form>

      {isLoading && <p className="cell-muted">Loading photos…</p>}
      {isError && <p className="form-error">Could not load photos.</p>}
      {!isLoading && !isError && photos.length === 0 && (
        <p className="cell-muted">No photos for this institution.</p>
      )}

      <ul className="photo-grid">
        {photos.map((p, i) => (
          <li key={p.id} className="photo-tile">
            <img
              src={p.thumbnailUrl || p.url}
              alt=""
              loading="lazy"
              /* A dead URL is the most likely thing wrong with a gallery, so it
                 has to be visible rather than rendering as a broken-image icon
                 that looks like a loading state. */
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.removeAttribute('hidden');
              }}
            />
            <div className="photo-broken" hidden>Image failed to load</div>
            <div className="photo-actions">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending}
                aria-label="Move earlier" title="Move earlier">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1 || reorder.isPending}
                aria-label="Move later" title="Move later">↓</button>
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                aria-label="Open full size" title="Open full size">
                <Icon name="eye" size={13} />
              </a>
              <button type="button" className="photo-del"
                onClick={() => window.confirm('Remove this photo?') && remove.mutate(p.id)}
                disabled={remove.isPending}
                aria-label="Remove photo" title="Remove photo">
                <Icon name="close" size={13} />
              </button>
            </div>
            {p.source && p.source !== 'manual' && (
              <span className="photo-source" title={`Imported from ${p.source} — a re-import may restore it`}>
                {p.source}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
