import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The inquiry form kept `countryId` in state but rendered no control that could
// set it, so every inquiry was saved with no destination — which is why the
// history screen's Destination column showed "—" for every row and its country
// filter could never match anything. These tests pin the repaired form.

vi.mock('../../api/courseInquiries.js', () => ({
  fetchInquiries: vi.fn(),
  createInquiry: vi.fn(),
  updateInquiryStage: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  setBlacklist: vi.fn(),
}));

const inquiriesApi = await import('../../api/courseInquiries.js');
const countriesApi = await import('../../api/countries.js');

const CourseInquiryForm = (await import('./CourseInquiryForm.jsx')).default;
const { intakeChoices, intakeFilters, PROGRAM_LEVELS } = await import(
  '../../constants/referenceData.js'
);

const COUNTRIES = [
  { id: 'c1', code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', institutionCount: 3 },
  { id: 'c2', code: 'CA', name: 'Canada', flagEmoji: '🇨🇦', institutionCount: 5 },
];

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CourseInquiryForm />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Opens a collapsed ChoiceField by its label and picks the named option.
async function pick(fieldLabel, optionLabel) {
  fireEvent.click(screen.getByText(fieldLabel));
  const option = await screen.findByRole('option', { name: optionLabel });
  fireEvent.click(option);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CourseInquiryForm', () => {
  it('submits the selected country as countryId', async () => {
    countriesApi.fetchCountries.mockResolvedValue(COUNTRIES);
    inquiriesApi.createInquiry.mockResolvedValue({ id: 'q1' });
    renderForm();

    await screen.findByText('Preferred country');
    await pick('Preferred country', 'Canada');
    await pick('Preferred intake', intakeChoices()[0].label);
    await pick('Type of course', PROGRAM_LEVELS[0].label);

    fireEvent.click(screen.getByRole('button', { name: /submit your inquiry/i }));

    await waitFor(() => expect(inquiriesApi.createInquiry).toHaveBeenCalled());
    // react-query passes its own context as a second argument, so assert on the
    // payload rather than on the whole call.
    expect(inquiriesApi.createInquiry.mock.calls[0][0]).toEqual({
      nationality: 'Indian',
      countryId: 'c2',
      intake: intakeChoices()[0].label,
      courseType: PROGRAM_LEVELS[0].label,
    });
  });

  // The bug the user hit: an unselected field submitted "" and the API rejected
  // the whole request with "countryId: Invalid uuid". The backend now treats an
  // empty optional as absent, and the form no longer lets you get there anyway.
  it('will not submit until every choice is made', async () => {
    countriesApi.fetchCountries.mockResolvedValue(COUNTRIES);
    renderForm();
    await screen.findByText('Preferred country');

    const submit = screen.getByRole('button', { name: /submit your inquiry/i });
    expect(submit.disabled).toBe(true);

    await pick('Preferred country', 'United Kingdom');
    expect(submit.disabled).toBe(true);

    await pick('Preferred intake', intakeChoices()[0].label);
    await pick('Type of course', PROGRAM_LEVELS[0].label);
    expect(submit.disabled).toBe(false);
  });

  it('filters the option list as you type', async () => {
    countriesApi.fetchCountries.mockResolvedValue(COUNTRIES);
    renderForm();
    await screen.findByText('Preferred country');

    fireEvent.click(screen.getByText('Preferred country'));
    expect(await screen.findByRole('option', { name: 'Canada' })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search country'), { target: { value: 'king' } });
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Canada' })).toBeNull()
    );
    expect(screen.getByRole('option', { name: 'United Kingdom' })).toBeTruthy();
  });

  // Nationality is free text in the API and no fixed list covers everyone.
  it('accepts a nationality that is not in the list', async () => {
    countriesApi.fetchCountries.mockResolvedValue(COUNTRIES);
    inquiriesApi.createInquiry.mockResolvedValue({ id: 'q1' });
    renderForm();
    await screen.findByText('Student nationality')

    fireEvent.click(screen.getByText('Student nationality'));
    fireEvent.change(screen.getByPlaceholderText('Search nationality'), {
      target: { value: 'Andorran' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Use .Andorran./ }));

    await pick('Preferred country', 'Canada');
    await pick('Preferred intake', intakeChoices()[0].label);
    await pick('Type of course', PROGRAM_LEVELS[0].label);
    fireEvent.click(screen.getByRole('button', { name: /submit your inquiry/i }));

    await waitFor(() => expect(inquiriesApi.createInquiry).toHaveBeenCalled());
    expect(inquiriesApi.createInquiry.mock.calls[0][0].nationality).toBe('Andorran');
  });
});

describe('intake options', () => {
  const TODAY = new Date(2026, 7, 1); // Aug 2026

  // The form must not offer an intake that has already gone — you cannot apply
  // for it, so picking one only files an inquiry nobody can act on.
  it('the form offers the current month forward and nothing earlier', () => {
    const options = intakeChoices(TODAY);
    expect(options[0].label).toBe('Aug 2026');
    expect(options.at(-1).label).toBe('Aug 2028');
    expect(options.map((o) => o.label)).not.toContain('Jul 2026');
  });

  // The filter must reach back, or an inquiry whose intake has started becomes
  // unfilterable — the row is still there but nothing selects it.
  it('the history filter reaches back as well as forward', () => {
    const options = intakeFilters(TODAY);
    expect(options[0].label).toBe('Aug 2025');
    expect(options.at(-1).label).toBe('Aug 2028');
  });

  // Both must generate the same label text, or a filter hit is coincidence.
  it('the filter is a superset of what the form can produce', () => {
    const filterLabels = new Set(intakeFilters(TODAY).map((o) => o.label));
    for (const option of intakeChoices(TODAY)) {
      expect(filterLabels.has(option.label), `${option.label} is unfilterable`).toBe(true);
    }
  });

  it('labels match the format the API stores', () => {
    for (const option of intakeFilters()) {
      expect(option.value).toBe(option.label);
      expect(option.label).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    }
  });
});
