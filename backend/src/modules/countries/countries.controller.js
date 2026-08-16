import * as countriesService from './countries.service.js';

export async function listCountriesHandler(req, res) {
  const { page, pageSize, ...filters } = req.query;

  // Same opt-in contract as /api/institutions: asking for a page returns
  // { items, meta }, and callers that do not ask — the header strip and every
  // dropdown — keep getting the whole list they already expect.
  // Service already flattens _count.institutions -> institutionCount.
  if (page === undefined) {
    return res.json({ items: await countriesService.listCountries(filters) });
  }
  res.json(await countriesService.listCountriesPage(filters, { page, pageSize }));
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
