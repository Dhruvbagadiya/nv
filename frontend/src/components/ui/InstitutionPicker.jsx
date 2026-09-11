import EntityPicker from './EntityPicker.jsx';
import { fetchInstitutions } from '../../api/institutions.js';

/**
 * The institution field, in one place.
 *
 * Seven screens each built their own 1,255-option `<select>` from
 * `useInstitutions()`. Searching is server-side here, so only the matches are
 * fetched — and a screen that needs an institution field now writes one line
 * rather than wiring a list it does not otherwise use.
 *
 * `pageSize` is capped well below the endpoint's 100 limit: this is a picker,
 * and anyone scrolling past twenty results should be typing instead. It is sent
 * with `page`, because the endpoint treats an absent page as "give me the whole
 * capped list" and discards pageSize on that branch — so this asked for 20 and
 * was quietly served up to 2,000 rows with their relations.
 */
export default function InstitutionPicker({
  id = 'institution-picker',
  label = 'Institution',
  value,
  selectedLabel,
  onChange,
  countryCode,
  ...rest
}) {
  return (
    <EntityPicker
      id={id}
      label={label}
      value={value}
      selectedLabel={selectedLabel}
      onChange={onChange}
      // Under the ['institutions'] root, not beside it: one key root per entity
      // is what lets a single invalidateResource('institutions') reach the
      // picker too. Keyed on its own root, a newly created institution stayed
      // missing from every one of the ~14 screens that mount this until the
      // page was reloaded by hand — the "I have to refresh" report, verbatim.
      // countryCode stays in the key so the same search text does not reuse
      // results cached for a different country.
      queryKey={['institutions', 'picker', countryCode ?? 'all']}
      fetchOptions={async (search) => {
        const rows = await fetchInstitutions({
          ...(search ? { search } : {}),
          ...(countryCode ? { country: countryCode } : {}),
          page: 1,
          pageSize: 20,
        });
        return rows.map((i) => ({
          value: i.id,
          label: i.name,
          // City and country disambiguate the many same-named campuses.
          hint: [i.city, i.country?.name ?? i.country?.code].filter(Boolean).join(', '),
        }));
      }}
      placeholder="Type an institution name…"
      emptyMessage="No institution matches that name."
      {...rest}
    />
  );
}
