import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({ fetchInstitutions: vi.fn() }));

const countriesApi = await import('../../api/countries.js');
const CountryStrip = (await import('./CountryStrip.jsx')).default;
const { useCountryFilter } = await import('../../store/useCountryFilter.js');

const COUNTRIES = [
  { id: 'c1', code: 'UK', name: 'United Kingdom', isoCode: 'gb', flagEmoji: '🇬🇧', institutionCount: 42 },
  { id: 'c2', code: 'CA', name: 'Canada', isoCode: 'ca', flagEmoji: '🇨🇦', institutionCount: 17 },
];

/**
 * Picking a destination only ever wrote to the zustand store. From any screen
 * that is not the dashboard — Applications, Document Bank, Commission — the
 * strip therefore appeared to do nothing at all, while the filter silently took
 * effect later, whenever the user next happened to open the dashboard.
 */
function renderStrip(route = '/partner/app-history') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <CountryStrip />
        <Routes>
          <Route path="/partner/courses" element={<p>CATALOGUE</p>} />
          <Route path="/partner/app-history" element={<p>APPLICATIONS</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CountryStrip', () => {
  afterEach(cleanup);

  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue(COUNTRIES);
    useCountryFilter.setState({ selectedCountry: 'ALL' });
  });

  it('opens the catalogue when a country is picked from another screen', async () => {
    renderStrip('/partner/app-history');
    await waitFor(() => expect(screen.getByText('UK')).toBeTruthy());
    expect(screen.getByText('APPLICATIONS')).toBeTruthy();

    fireEvent.click(screen.getByText('UK'));

    await waitFor(() => expect(screen.getByText('CATALOGUE')).toBeTruthy());
    // …and the filter the dashboard reads is the one that was clicked.
    expect(useCountryFilter.getState().selectedCountry).toBe('UK');
  });

  it('sets the filter without navigating when already on the catalogue', async () => {
    renderStrip('/partner/courses');
    await waitFor(() => expect(screen.getByText('CA')).toBeTruthy());

    fireEvent.click(screen.getByText('CA'));

    expect(useCountryFilter.getState().selectedCountry).toBe('CA');
    expect(screen.getByText('CATALOGUE')).toBeTruthy();
  });

  it('clears the filter through the All chip', async () => {
    useCountryFilter.setState({ selectedCountry: 'UK' });
    renderStrip('/partner/courses');
    await waitFor(() => expect(screen.getByText('All')).toBeTruthy());

    fireEvent.click(screen.getByText('All'));

    expect(useCountryFilter.getState().selectedCountry).toBe('ALL');
  });

  it('marks the selected destination as pressed, for the row and for screen readers', async () => {
    useCountryFilter.setState({ selectedCountry: 'UK' });
    renderStrip('/partner/courses');
    await waitFor(() => expect(screen.getByText('UK')).toBeTruthy());

    expect(screen.getByRole('button', { name: /UK/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /CA/ }).getAttribute('aria-pressed')).toBe('false');
  });

  // A failed /countries request rendered a strip holding nothing but "All",
  // which is indistinguishable from a catalogue with no destinations in it.
  it('says so when the destinations cannot be loaded', async () => {
    countriesApi.fetchCountries.mockRejectedValue(new Error('network'));
    renderStrip('/partner/courses');

    // useCountries hardcodes retry: 1 (useReferenceData.js), which the test
    // client's retry:false cannot override — so the failure takes a retry plus
    // its backoff to surface.
    await waitFor(() => expect(screen.getByText(/Destinations unavailable/i)).toBeTruthy(), {
      timeout: 5000,
    });
  });
});
