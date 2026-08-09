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

export async function createCountryHandler(req, res) {
  res.status(201).json(await countriesService.createCountry(req.body));
}

export async function updateCountryHandler(req, res) {
  res.json(await countriesService.updateCountry(req.params.id, req.body));
}

export async function deleteCountryHandler(req, res) {
  await countriesService.deleteCountry(req.params.id);
  res.status(204).send();
}
