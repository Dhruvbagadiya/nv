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

export function useCountries(options = {}) {
  const query = useQuery({
    queryKey: ['countries', options],
    queryFn: () => fetchCountries(options),
    ...REFERENCE_QUERY,
  });

  return {
    ...query,
    countries: query.data ?? [],
    // Ready-made for <FilterBar>'s select fields. Showing the count means a user
    // can see a destination is empty before picking it, instead of selecting one
    // and getting an unexplained blank grid.
    options: (query.data ?? []).map((c) => ({
      value: c.code,
      label: c.institutionCount ? `${c.name} (${c.institutionCount})` : c.name,
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
