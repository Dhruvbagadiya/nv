import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The screen moved to the paged endpoint, which returns { items, meta } rather
// than a bare array — fetchCountries is still the dropdown path and is mocked
// only so other importers of this module do not break.
vi.mock('../../api/countries.js', () => ({
  fetchCountries: vi.fn(),
  fetchCountriesPage: vi.fn(),
}));
vi.mock('../../api/admin.js', () => ({
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn(),
}));

const countriesApi = await import('../../api/countries.js');
const adminApi = await import('../../api/admin.js');
const AdminCountries = (await import('./AdminCountries.jsx')).default;

const UK = { id: 'c1', name: 'United Kingdom', code: 'UK', isoCode: 'GB', currencyCode: 'GBP', flagEmoji: '🇬🇧', sortOrder: 0, institutionCount: 10 };
const PT = { id: 'c2', name: 'Portugal', code: 'PT', isoCode: 'PT', currencyCode: 'EUR', flagEmoji: '🇵🇹', sortOrder: 20, institutionCount: 0 };

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><AdminCountries /></MemoryRouter></QueryClientProvider>
  );
}

describe('AdminCountries', () => {
  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([UK, PT]);
    countriesApi.fetchCountriesPage.mockResolvedValue({
      items: [UK, PT],
      meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
    });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('lists countries with both codes and the institution count', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('United Kingdom')).toBeTruthy());
    expect(screen.getByText('UK')).toBeTruthy();
    expect(screen.getByText('GB')).toBeTruthy();
    expect(screen.getByText('GBP')).toBeTruthy();
  });

  // Deleting a country with institutions would fail on the foreign key, so the
  // button is disabled rather than allowed-then-refused.
  it('disables delete for a country that still has institutions', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('United Kingdom')).toBeTruthy());
    const buttons = screen.getAllByText('Delete');
    expect(buttons[0].disabled).toBe(true);   // UK, 10 institutions
    expect(buttons[1].disabled).toBe(false);  // Portugal, none
  });

  it('sends the code on create and normalises to uppercase', async () => {
    adminApi.createCountry.mockResolvedValue({ id: 'c3' });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Add country')).toBeTruthy());
    fireEvent.click(screen.getByText('Add country'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/Country name/), { target: { value: 'Sweden' } });
    fireEvent.change(screen.getByLabelText(/Portal code/), { target: { value: 'sw' } });
    fireEvent.change(screen.getByLabelText(/ISO country code/), { target: { value: 'se' } });
    fireEvent.change(screen.getByLabelText(/Currency/), { target: { value: 'sek' } });
    // Scoped to the dialog: "Add country" is also the page's own action button.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add country' }));

    await waitFor(() => expect(adminApi.createCountry).toHaveBeenCalled());
    expect(adminApi.createCountry.mock.calls[0][0]).toMatchObject({
      name: 'Sweden', code: 'SW', isoCode: 'SE', currencyCode: 'SEK',
    });
  });

  // code lives in saved filter URLs and the header strip, so it is create-only.
  it('locks the code when editing and omits it from the payload', async () => {
    adminApi.updateCountry.mockResolvedValue({ id: 'c1' });
    renderScreen();
    await waitFor(() => expect(screen.getByText('United Kingdom')).toBeTruthy());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    expect(screen.getByLabelText(/Portal code/).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Country name/), { target: { value: 'UK & NI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(adminApi.updateCountry).toHaveBeenCalled());
    expect(adminApi.updateCountry.mock.calls[0][1]).not.toHaveProperty('code');
  });

  // sortOrder was missing from the API's select, so the Order column rendered
  // blank AND the edit form seeded it from undefined — saving any country reset
  // its order to 0 and reshuffled the header strip.
  it('preserves sortOrder when editing an unrelated field', async () => {
    adminApi.updateCountry.mockResolvedValue({ id: 'c2' });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Portugal')).toBeTruthy());
    // The column actually shows the value rather than an empty cell.
    expect(screen.getByText('20')).toBeTruthy();

    fireEvent.click(screen.getAllByText('Edit')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Country name/), { target: { value: 'Portugal PT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(adminApi.updateCountry).toHaveBeenCalled());
    expect(adminApi.updateCountry.mock.calls[0][1].sortOrder).toBe(20);
  });

  it('surfaces the API reason when a delete is refused', async () => {
    adminApi.deleteCountry.mockRejectedValue({
      response: { data: { error: 'United Kingdom still has 10 institutions.' } },
    });
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderScreen();
    await waitFor(() => expect(screen.getByText('Portugal')).toBeTruthy());
    fireEvent.click(screen.getAllByText('Delete')[1]);
    await waitFor(() => expect(screen.getByText(/still has 10 institutions/)).toBeTruthy());
    vi.unstubAllGlobals();
  });
});
