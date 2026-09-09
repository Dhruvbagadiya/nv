import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EntityPicker from './EntityPicker.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ROWS = [
  { value: 'i1', label: 'University of Hertfordshire', hint: 'Hatfield, UK' },
  { value: 'i2', label: 'University of Hull', hint: 'Hull, UK' },
];

function renderPicker(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onChange = vi.fn();
  const fetchOptions = vi.fn(async (search) =>
    ROWS.filter((r) => r.label.toLowerCase().includes((search ?? '').toLowerCase()))
  );
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <EntityPicker
        id="p"
        label="Institution"
        value=""
        onChange={onChange}
        queryKey={['test-picker']}
        fetchOptions={fetchOptions}
        {...props}
      />
    </QueryClientProvider>
  );
  return { ...utils, onChange, fetchOptions };
}

/**
 * Seven admin screens rendered every one of ~1,255 institutions as an <option>,
 * some of them twice. The list endpoints already accepted ?search=; nothing used
 * it.
 */
describe('EntityPicker', () => {
  it('searches on the server rather than filtering a list it holds', async () => {
    const { fetchOptions } = renderPicker();

    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'Hert' } });

    await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());
    // Debounced, so the assertion is on what it eventually asked for.
    await waitFor(() => expect(fetchOptions).toHaveBeenCalledWith('Hert'));
    expect(screen.queryByText('University of Hull')).toBeNull();
  });

  it('reports the id, not the text that was typed', async () => {
    const { onChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'Hert' } });
    await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());
    // mouseDown, not click: the input's blur would close the list first.
    fireEvent.mouseDown(screen.getByText('University of Hertfordshire'));

    expect(onChange.mock.calls[0][0]).toBe('i1');
  });

  it('can be driven from the keyboard', async () => {
    const { onChange } = renderPicker();
    const input = screen.getByLabelText('Institution');

    fireEvent.focus(input);
    await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange.mock.calls[0][0]).toBe('i2');
  });

  // The chosen row is rarely in the current page of results, so re-fetching it
  // by id purely to render a name the caller already has would be a request per
  // edit.
  it('shows the name it was given for an already-chosen value', () => {
    renderPicker({ value: 'i1', selectedLabel: 'University of Hertfordshire' });

    expect(screen.getByText('University of Hertfordshire')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();
    // No search box until Change is pressed.
    expect(screen.queryByLabelText('Institution')).toBeNull();
  });

  it('clears back to nothing', () => {
    const { onChange } = renderPicker({ value: 'i1', selectedLabel: 'University of Hertfordshire' });

    fireEvent.click(screen.getByText('Clear'));

    expect(onChange).toHaveBeenCalledWith('', null);
  });

  it('says so when nothing matches, instead of showing an empty box', async () => {
    renderPicker({ emptyMessage: 'No institution matches that name.' });

    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'zzzz' } });

    await waitFor(() =>
      expect(screen.getByText('No institution matches that name.')).toBeTruthy()
    );
  });
});
