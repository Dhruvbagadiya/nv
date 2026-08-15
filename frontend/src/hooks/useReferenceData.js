import { useQuery } from '@tanstack/react-query';
import { fetchCountries } from '../api/countries.js';
import { fetchInstitutions } from '../api/institutions.js';

// Reference lists change rarely and are needed by nearly every screen's filters,
// so they are cached aggressively and shared through React Query rather than
// re-fetched per page. This replaces constants/referenceData.js as the source for
// countries — that file was an interim stand-in for the missing /api/countries.
const REFERENCE_QUERY = {
  staleTime: 30 * 60 * 1000, // 30 min
  gcTime: 60 * 60 * 1000,
  // A dropdown failing to load should not retry aggressively behind the user's back.
  retry: 1,
};

// These queries are now public — no auth required.
// api client adds bearer token only when it exists; absent token is fine here.
export function useCountries(options = {}) {
  const query = useQuery({
    queryKey: ['countries', options],
    queryFn: () => fetchCountries(options),
    ...REFERENCE_QUERY,
  });

  return {
    ...query,
    countries: query.data ?? [],
    // institutionCount is flattened from _count.institutions in the service.
    // Show it in the option label so agents can see which destinations have content.
    options: (query.data ?? []).map((c) => ({
      value: c.code,
      label: c.institutionCount
        ? `${c.name} (${c.institutionCount})`
        : c.name,
    })),
  };
}

export function useInstitutions(filters = {}) {
  const query = useQuery({
    queryKey: ['institutions', filters],
    queryFn: () => fetchInstitutions(filters),
    ...REFERENCE_QUERY,
  });

  return {
    ...query,
    institutions: query.data ?? [],
    options: (query.data ?? []).map((i) => ({ value: i.id, label: i.name })),
  };
}
