import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/courses.js', () => ({ bulkImportCourses: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({ fetchInstitutions: vi.fn() }));

const coursesApi = await import('../../api/courses.js');
const institutionsApi = await import('../../api/institutions.js');
const BulkImportDialog = (await import('./BulkImportDialog.jsx')).default;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog() {
  institutionsApi.fetchInstitutions.mockResolvedValue([
    { id: 'i1', name: 'University of Hertfordshire', city: 'Hatfield' },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onImported = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <BulkImportDialog onClose={() => {}} onImported={onImported} />
    </QueryClientProvider>
  );
  return { onImported };
}

const paste = (csv) =>
  fireEvent.change(screen.getByLabelText('Course rows (CSV)'), { target: { value: csv } });

async function chooseInstitution() {
  fireEvent.change(screen.getByLabelText(/^Institution/), { target: { value: 'Hert' } });
  await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());
  fireEvent.mouseDown(screen.getByText('University of Hertfordshire'));
}

/**
 * POST /courses/bulk-import accepted 1,000 rows from the day it was written and
 * had no client function and no screen, so adding a prospectus meant opening the
 * single-course form once per programme.
 */
describe('BulkImportDialog', () => {
  it('sends the parsed rows under the chosen institution', async () => {
    coursesApi.bulkImportCourses.mockResolvedValue({ imported: 1 });
    const { onImported } = renderDialog();

    await chooseInstitution();
    paste('title,programLevel,tuitionFee,currencyCode\n"MSc Data Science",MASTERS_DEGREE,15000,gbp');

    await waitFor(() => expect(screen.getByText('Import 1 course')).toBeTruthy());
    fireEvent.click(screen.getByText('Import 1 course'));

    await waitFor(() => expect(coursesApi.bulkImportCourses).toHaveBeenCalled());
    const rows = coursesApi.bulkImportCourses.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].institutionId).toBe('i1');
    expect(rows[0].title).toBe('MSc Data Science');
    // Upper-cased for the API, which requires a 3-letter ISO code.
    expect(rows[0].currencyCode).toBe('GBP');
  });

  // A silent fallback to OTHER would land a whole prospectus unfilterable.
  it('reports an unknown program level instead of quietly importing it as OTHER', async () => {
    renderDialog();
    paste('title,programLevel,tuitionFee\n"MSc Data Science",MASTER-DEGREE,15000');

    await waitFor(() => expect(screen.getByText(/is not a known level/)).toBeTruthy());
    expect(screen.getByText(/Line 2:/)).toBeTruthy();
  });

  it('will not import until an institution is chosen', async () => {
    renderDialog();
    paste('title,programLevel,tuitionFee\n"MSc Data Science",MASTERS_DEGREE,15000');

    await waitFor(() => expect(screen.getByText('Import 1 course')).toBeTruthy());
    expect(screen.getByText('Import 1 course').disabled).toBe(true);
  });

  it('counts the good rows and the broken ones separately', async () => {
    renderDialog();
    paste(
      'title,programLevel,tuitionFee\n' +
      '"MSc Data Science",MASTERS_DEGREE,15000\n' +
      ',MASTERS_DEGREE,15000\n' +
      '"MSc Nursing",MASTERS_DEGREE,notanumber'
    );

    await waitFor(() => expect(screen.getByText('1 ready, 2 to fix')).toBeTruthy());
  });
});
