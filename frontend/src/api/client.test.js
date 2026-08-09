import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../store/useAuth.js', () => ({
  getAccessToken: () => 'test-token',
  setAccessToken: vi.fn(),
  useAuth: { getState: () => ({ setAnonymous: vi.fn(), setSession: vi.fn() }) },
}));

const { api } = await import('./client.js');

// The screens hold their filter state as empty strings when nothing is selected.
// Sending those produces `?countryId=&stage=`, which the API validates rather than
// ignores — that 400'd six of eight screens on first load.
function runRequestInterceptor(config) {
  const handler = api.interceptors.request.handlers.find((h) => h?.fulfilled);
  return handler.fulfilled({ headers: {}, ...config });
}

describe('request params', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops empty, null and undefined params', () => {
    const out = runRequestInterceptor({
      params: { countryId: '', intake: '', stage: '', page: 1, search: null, tag: undefined },
    });
    expect(out.params).toEqual({ page: 1 });
  });

  it('keeps real values, including ones that are falsy but meaningful', () => {
    const out = runRequestInterceptor({
      params: { page: 1, blacklisted: false, count: 0, search: 'Algoma' },
    });
    // false and 0 are genuine filter values, not "unset".
    expect(out.params).toEqual({ page: 1, blacklisted: false, count: 0, search: 'Algoma' });
  });

  it('leaves a request with no params alone', () => {
    expect(runRequestInterceptor({}).params).toBeUndefined();
  });

  it('still attaches the bearer token', () => {
    expect(runRequestInterceptor({ params: {} }).headers.Authorization).toBe('Bearer test-token');
  });
});
