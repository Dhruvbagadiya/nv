import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Pagination from './Pagination.jsx';

describe('Pagination', () => {
  afterEach(cleanup);

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('disables Previous on the first page and Next on the last', () => {
    render(<Pagination page={1} totalPages={3} onChange={() => {}} />);
    expect(screen.getByLabelText('Previous page').disabled).toBe(true);
    expect(screen.getByLabelText('Next page').disabled).toBe(false);

    cleanup();
    render(<Pagination page={3} totalPages={3} onChange={() => {}} />);
    expect(screen.getByLabelText('Previous page').disabled).toBe(false);
    expect(screen.getByLabelText('Next page').disabled).toBe(true);
  });

  it('marks the current page with aria-current', () => {
    render(<Pagination page={2} totalPages={3} onChange={() => {}} />);
    expect(screen.getByLabelText('Page 2').getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText('Page 1').getAttribute('aria-current')).toBeNull();
  });

  it('collapses long ranges rather than rendering every page', () => {
    render(<Pagination page={10} totalPages={40} onChange={() => {}} />);
    // first, last and a window around the current page — not 40 buttons
    expect(screen.getByLabelText('Page 1')).toBeTruthy();
    expect(screen.getByLabelText('Page 40')).toBeTruthy();
    expect(screen.getByLabelText('Page 9')).toBeTruthy();
    expect(screen.getByLabelText('Page 11')).toBeTruthy();
    expect(screen.queryByLabelText('Page 25')).toBeNull();
  });

  it('does not fire onChange for the page already shown', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    screen.getByLabelText('Page 2').click();
    expect(onChange).not.toHaveBeenCalled();
    screen.getByLabelText('Page 3').click();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  // Guards the arithmetic behind "Showing 21–40 of 45", which is easy to get
  // off-by-one on the final page.
  it('clamps the row range on a partial last page', () => {
    render(<Pagination page={3} totalPages={3} total={45} pageSize={20} onChange={() => {}} />);
    expect(screen.getByText('Showing 41–45 of 45')).toBeTruthy();
  });
});

describe('Pagination beyond the servable depth', () => {
  // These assert on document.body, so a previous render left in place would be
  // counted as part of this one.
  afterEach(cleanup);

  // The API refuses offsets past a limit, so 93,076 courses report 7,757 pages
  // while only ~834 can actually be fetched. Offering the rest is a control
  // that always fails.
  it('does not offer a page the server will refuse', () => {
    render(<Pagination page={1} totalPages={7757} maxPage={834} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Page 7757' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Page 834' })).toBeTruthy();
  });

  it('says why the rest is out of reach', () => {
    const { container } = render(
      <Pagination page={1} totalPages={7757} maxPage={834} total={93076} pageSize={12} onChange={() => {}} />
    );
    expect(container.textContent).toContain('browsable to page 834');
  });

  it('disables Next on the last reachable page', () => {
    const onChange = vi.fn();
    render(<Pagination page={834} totalPages={7757} maxPage={834} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is unaffected when every page is reachable', () => {
    const { container } = render(<Pagination page={1} totalPages={3} maxPage={3} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeTruthy();
    expect(container.textContent).not.toContain('browsable to page');
  });
});
