import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import FilterBar from './FilterBar.jsx';

const FIELDS = [
  {
    name: 'country',
    label: 'Country',
    type: 'select',
    placeholder: 'Select country',
    options: [
      { value: 'UK', label: 'United Kingdom' },
      { value: 'CA', label: 'Canada' },
    ],
  },
  { name: 'search', label: 'Search by name', type: 'text', placeholder: 'Enter keywords' },
  { name: 'dateFrom', label: 'Publish date from', type: 'date' },
];

function setup(overrides = {}) {
  const props = {
    fields: FIELDS,
    values: { country: '', search: '', dateFrom: '' },
    onChange: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return props;
}

describe('FilterBar', () => {
  afterEach(cleanup);

  it('renders a control per configured field, with the right input types', () => {
    setup();
    expect(screen.getByLabelText('Country').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Search by name').getAttribute('type')).toBe('text');
    expect(screen.getByLabelText('Publish date from').getAttribute('type')).toBe('date');
  });

  // The original screens used bare <label>s with no htmlFor, so clicking a label
  // did nothing and assistive tech announced the control as unlabelled.
  it('associates every label with its control', () => {
    setup();
    for (const field of FIELDS) {
      expect(screen.getByLabelText(field.label)).toBeTruthy();
    }
  });

  it('renders the placeholder as the empty option of a select', () => {
    setup();
    const select = screen.getByLabelText('Country');
    expect(select.options[0].textContent).toBe('Select country');
    expect(select.options[0].value).toBe('');
    expect(select.options).toHaveLength(3); // placeholder + 2
  });

  it('reflects supplied values rather than holding its own state', () => {
    setup({ values: { country: 'CA', search: 'nursing', dateFrom: '' } });
    expect(screen.getByLabelText('Country').value).toBe('CA');
    expect(screen.getByLabelText('Search by name').value).toBe('nursing');
  });

  it('reports changes as (name, value)', () => {
    const { onChange } = setup();
    // fireEvent.change, not a raw dispatchEvent: React tracks the value via its
    // own setter, so assigning .value directly is invisible to onChange.
    fireEvent.change(screen.getByLabelText('Search by name'), {
      target: { value: 'data science' },
    });
    expect(onChange).toHaveBeenCalledWith('search', 'data science');

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'UK' } });
    expect(onChange).toHaveBeenCalledWith('country', 'UK');
  });

  it('applies on the primary button and clears on the secondary', () => {
    const { onApply, onClear } = setup();
    screen.getByText('Apply Filter').click();
    expect(onApply).toHaveBeenCalled();
    screen.getByText('Clear Filter').click();
    expect(onClear).toHaveBeenCalled();
  });

  // A real <form> means Enter submits — the reference screens are click-only,
  // which forces keyboard users to the mouse.
  it('applies when the form is submitted with the keyboard', () => {
    const { onApply } = setup();
    const form = screen.getByText('Apply Filter').closest('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onApply).toHaveBeenCalled();
  });

  it('disables both actions while a request is in flight', () => {
    setup({ busy: true });
    expect(screen.getByText('Applying…').disabled).toBe(true);
    expect(screen.getByText('Clear Filter').disabled).toBe(true);
  });
});
