import * as countriesService from './countries.service.js';

export async function listCountriesHandler(req, res) {
  const countries = await countriesService.listCountries({
    withInstitutionsOnly: req.query.withInstitutionsOnly,
  });

  // Flattened so the client never has to reach into Prisma's `_count` shape.
  res.json({
    items: countries.map(({ _count, ...c }) => ({ ...c, institutionCount: _count.institutions })),
  });
}
