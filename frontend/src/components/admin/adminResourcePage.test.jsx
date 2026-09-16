import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminResourcePage from './AdminResourcePage.jsx';

afterEach(cleanup);

const ROWS = [
  { id: 'r1', name: 'First row', archivedAt: null },
  { id: 'r2', name: 'Second row', archivedAt: null },
];

/** A never-settling promise, so the pending state stays up to be inspected. */
const pending = () => new Promise(() => {});

function renderPage(over = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const resource = {
    queryKey: 'things',
    title: 'Things',
    list: vi.fn(async () => ({
      items: ROWS,
      meta: { total: 2, page: 1, pageSize: 20, totalPages: 1, maxPage: 1 },
    })),
    remove: vi.fn(pending),
    columns: [{ key: 'name', header: 'Name' }],
    formFields: [{ name: 'name', label: 'Name', type: 'text' }],
    toForm: (r) => ({ name: r.name }),
    toPayload: (v) => v,
    rowLabel: (r) => r.name,
    ...over,
  };
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminResourcePage resource={resource} /></MemoryRouter>
    </QueryClientProvider>
  );
  return resource;
}

/**
 * Which row is busy.
 *
 * `mutation.isPending` is one flag for the whole screen, so archiving a single
 * row greyed out every row's button — and the one that was actually working
 * looked identical to the nineteen that were not, which is the opposite of what
 * a disabled state is for.
 */
describe('AdminResourcePage — row actions', () => {
  const archiveButtonFor = (name) =>
    within(screen.getByText(name).closest('tr')).getByRole('button', { name: /Archive/ });

  it('disables only the row being archived', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getByText('First row')).toBeTruthy());

    fireEvent.click(archiveButtonFor('First row'));

    await waitFor(() => expect(archiveButtonFor('First row').disabled).toBe(true));
    // The other rows stay usable: nothing about archiving one says anything
    // about the others.
    expect(archiveButtonFor('Second row').disabled).toBe(false);
  });

  it('says which action is running, in the button that started it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getByText('First row')).toBeTruthy());

    fireEvent.click(archiveButtonFor('First row'));

    await waitFor(() => expect(screen.getByText('Archiving…')).toBeTruthy());
    // Exactly one: a shared flag would have put it on every row, or on none.
    expect(screen.getAllByText('Archiving…')).toHaveLength(1);
  });

  it('derives the running verb from whatever the label is', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage({ removeLabel: 'Delete' });
    await waitFor(() => expect(screen.getByText('First row')).toBeTruthy());

    fireEvent.click(within(screen.getByText('First row').closest('tr')).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(screen.getByText('Deleting…')).toBeTruthy());
  });

  // The confirm is the last thing between a click and a destructive write.
  it('archives nothing when the confirm is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const resource = renderPage();
    await waitFor(() => expect(screen.getByText('First row')).toBeTruthy());

    fireEvent.click(archiveButtonFor('First row'));

    expect(resource.remove).not.toHaveBeenCalled();
  });
});
