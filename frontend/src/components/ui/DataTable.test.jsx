import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DataTable from './DataTable.jsx';

const COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'country', header: 'Country', render: (row) => row.country.toUpperCase() },
];

const ROWS = [
  { id: '1', name: 'Ulster University', country: 'uk' },
  { id: '2', name: 'Griffith College', country: 'ie' },
];

describe('DataTable', () => {
  afterEach(cleanup);

  it('renders headers, rows, and custom cell renderers', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Ulster University')).toBeTruthy();
    expect(screen.getByText('UK')).toBeTruthy(); // render() applied
  });

  it('shows a loading state instead of an empty table', () => {
    render(<DataTable columns={COLUMNS} rows={[]} isLoading />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('No data found')).toBeNull();
  });

  it('shows the empty state only once loading has finished', () => {
    render(<DataTable columns={COLUMNS} rows={[]} />);
    expect(screen.getByText('No data found')).toBeTruthy();
  });

  // The screens this replaces had no error branch at all, so a failed request
  // rendered as "no data" — telling the user the list is empty when in fact it
  // could not be fetched.
  it('distinguishes an error from an empty result', () => {
    render(<DataTable columns={COLUMNS} rows={[]} isError />);
    expect(screen.getByText(/Couldn’t load this list/)).toBeTruthy();
    expect(screen.queryByText('No data found')).toBeNull();
  });

  it('adds an access hint on a 403', () => {
    render(<DataTable columns={COLUMNS} rows={[]} isError error={{ response: { status: 403 } }} />);
    expect(screen.getByText(/may not have access/)).toBeTruthy();
  });

  it('renders no pagination when onPageChange is omitted', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} page={1} totalPages={5} />);
    expect(screen.queryByLabelText('Pagination')).toBeNull();
  });

  it('renders pagination when a page handler is supplied', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        page={1}
        totalPages={5}
        total={100}
        pageSize={20}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByLabelText('Pagination')).toBeTruthy();
    expect(screen.getByText('Showing 1–20 of 100')).toBeTruthy();
  });
});
