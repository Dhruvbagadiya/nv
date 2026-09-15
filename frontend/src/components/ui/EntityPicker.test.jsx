import { useState } from 'react';
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
    // No search box until Change is pressed. Asserted on the combobox rather
    // than on the label: this used to check that getByLabelText found NOTHING,
    // which is a different claim and happened to pin a bug — with no element
    // carrying the id in this branch, the <label htmlFor> pointed nowhere, so a
    // screen reader announced a label with no control and clicking it did
    // nothing. That is most of the time on most admin forms.
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('still gives the label a control to point at once a value is chosen', () => {
    renderPicker({ value: 'i1', selectedLabel: 'University of Hertfordshire' });

    const control = screen.getByLabelText(/Institution/);
    expect(control).toBeTruthy();
    // The Change button is what the label names here, because it is what the
    // label's click should reach.
    expect(control.tagName).toBe('BUTTON');
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

/**
 * What the field shows once something is chosen.
 *
 * `selectedLabel` is a prop, so it can only ever describe a value that arrived
 * from elsewhere — the row being edited. For a value the user has just picked
 * there is nothing to seed it from, and the fallback was `|| value`: the Add
 * course form rendered the institution's uuid where its name belongs, on every
 * create, because the create path has no `attr.school.name` to pass.
 */
describe('EntityPicker: the chosen label', () => {
  /** A controlled host, so choosing actually sets the value the picker renders. */
  function Controlled({ selectedLabel }) {
    const [value, setValue] = useState('');
    const fetchOptions = async (search) =>
      ROWS.filter((r) => r.label.toLowerCase().includes((search ?? '').toLowerCase()));
    return (
      <EntityPicker
        id="p"
        label="Institution"
        value={value}
        selectedLabel={selectedLabel}
        onChange={(v) => setValue(v)}
        queryKey={['label-test']}
        fetchOptions={fetchOptions}
      />
    );
  }

  const renderControlled = (props = {}) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
      <QueryClientProvider client={queryClient}><Controlled {...props} /></QueryClientProvider>
    );
  };

  const choose = async (name) => {
    fireEvent.focus(screen.getByLabelText('Institution'));
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
    // mouseDown, not click: the row commits on mousedown, because the input's
    // blur would otherwise close the list before a click ever landed.
    fireEvent.mouseDown(screen.getByText(name));
  };

  it('names what was just picked, with no selectedLabel to lean on', async () => {
    renderControlled();
    await choose('University of Hertfordshire');

    await waitFor(() => expect(screen.getByText('University of Hertfordshire')).toBeTruthy());
    // The failure this replaces: the uuid rendered as if it were the name.
    expect(screen.queryByText('i1')).toBeNull();
  });

  it('forgets the remembered name when the value is cleared', async () => {
    renderControlled();
    await choose('University of Hull');
    await waitFor(() => expect(screen.getByText('Clear')).toBeTruthy());

    fireEvent.click(screen.getByText('Clear'));

    // A remembered label outliving the value it described is a field
    // confidently naming the wrong row.
    await waitFor(() => expect(screen.queryByText('University of Hull')).toBeNull());
  });

  it('still prefers a seeded selectedLabel before anything is picked', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <EntityPicker
          id="p" label="Institution" value="i9" selectedLabel="Seeded University"
          onChange={() => {}} queryKey={['seed-test']} fetchOptions={async () => ROWS}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Seeded University')).toBeTruthy();
    expect(screen.queryByText('i9')).toBeNull();
  });
});
