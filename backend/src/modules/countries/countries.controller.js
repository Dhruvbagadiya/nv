import * as countriesService from './countries.service.js';

export async function listCountriesHandler(req, res) {
  const items = await countriesService.listCountries({
    withInstitutionsOnly: req.query.withInstitutionsOnly,
  });
  // Service already flattens _count.institutions -> institutionCount
  res.json({ items });
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
