import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
    render(<DataTable columns={COLUMNS} rows={ROWS} meta={{ page: 1, totalPages: 5 }} />);
    expect(screen.queryByLabelText('Pagination')).toBeNull();
  });

  it('renders pagination when a page handler is supplied', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        meta={{ page: 1, totalPages: 5, total: 100, pageSize: 20 }}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByLabelText('Pagination')).toBeTruthy();
    expect(screen.getByText('Showing 1–20 of 100')).toBeTruthy();
  });

  // The row was mouse-only. On AdminUsers and AdminApplications the row is the
  // only way to open the detail panel, so a keyboard user could not advance an
  // application at all.
  it('opens a clickable row from the keyboard', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ id: 'r1', name: 'Priya' }]}
        onRowClick={onRowClick}
        rowLabel={(r) => `Open ${r.name}`}
      />
    );

    const row = screen.getByRole('button', { name: 'Open Priya' });
    expect(row.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('leaves a non-clickable row out of the tab order entirely', () => {
    render(
      <DataTable columns={[{ key: 'name', header: 'Name' }]} rows={[{ id: 'r1', name: 'Priya' }]} />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
