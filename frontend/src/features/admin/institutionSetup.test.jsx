import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/institutions.js', () => ({
  fetchInstitutionsPage: vi.fn(),
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  updateInstitution: vi.fn(),
  archiveInstitution: vi.fn(),
  restoreInstitution: vi.fn(),
  setInstitutionBlacklist: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));

const api = await import('../../api/institutions.js');
const countriesApi = await import('../../api/countries.js');
const AdminInstitutions = (await import('./AdminInstitutions.jsx')).default;

const COUNTRY = { id: 'c1', code: 'UK', name: 'United Kingdom', isoCode: 'gb', institutionCount: 0 };

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminInstitutions /></MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Commission, entry requirements and MOI, on the Add Institution form.
 *
 * Each had its own screen, so adding a university meant four visits — and the
 * last three are easy to forget, which is how an institution ends up in the
 * catalogue looking complete with nothing behind it.
 *
 * The property that matters most is the one about NOT using them: a form where
 * nobody opened a section has to produce exactly the request it produced before
 * any of this existed.
 */
describe('AdminInstitutions — setting up a new institution', () => {
  afterEach(cleanup);

  beforeEach(() => {
    // Calls accumulate across tests otherwise, and every assertion here reads
    // `mock.calls[0]` — which would be the previous test's request.
    vi.clearAllMocks();
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    api.fetchInstitutionsPage.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, pageSize: 20, totalPages: 0, maxPage: 1 },
    });
    api.createInstitution.mockResolvedValue({ id: 'i1' });
  });

  const openAdd = async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Add institution')).toBeTruthy());
    fireEvent.click(screen.getByText('Add institution'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  };

  const fillRequired = () => {
    const dialog = screen.getByRole('dialog');
    // Scoped to the dialog: the filter bar behind it has a Country select too.
    fireEvent.change(within(dialog).getByLabelText(/Institution name/), { target: { value: 'Test University' } });
    fireEvent.change(within(dialog).getByLabelText(/Country/), { target: { value: 'c1' } });
  };

  const submitForm = () =>
    fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

  /**
   * Program level is a searchable picker, not a <select> — twenty options in a
   * native dropdown is a scroll, and the word is what a person knows.
   * mouseDown, not click: the row commits on mousedown, because the input's blur
   * would otherwise close the list before a click landed.
   */
  const pickLevel = async (fieldLabel, optionLabel) => {
    fireEvent.focus(screen.getByLabelText(fieldLabel));
    // Scoped to the open list, and awaited inside it: a level already chosen in
    // another row renders its label in that row's chip too, and the <ul> itself
    // renders empty a tick before its options arrive.
    const list = await screen.findByRole('listbox');
    fireEvent.mouseDown(await within(list).findByText(optionLabel));
  };

  it('sends nothing extra when the sections are left closed', async () => {
    await openAdd();
    fillRequired();
    submitForm();

    await waitFor(() => expect(api.createInstitution).toHaveBeenCalled());
    const body = api.createInstitution.mock.calls[0][0];
    expect(body.commission).toBeUndefined();
    expect(body.entryRequirements).toBeUndefined();
    expect(body.moiAcceptances).toBeUndefined();
  });

  it('offers all three, collapsed', async () => {
    await openAdd();

    for (const title of ['Commission rates', 'Entry requirements', 'MOI accepted']) {
      const head = screen.getByText(title).closest('button');
      expect(head.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('sends a commission in the same request as the institution', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('Commission rates'));
    fireEvent.change(screen.getByLabelText('Rate from (%)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Rate to (%)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Tier 1 label'), { target: { value: '1–5 students' } });
    fireEvent.change(screen.getByLabelText('Tier 1 rate'), { target: { value: '15%' } });
    submitForm();

    await waitFor(() => expect(api.createInstitution).toHaveBeenCalled());
    const { commission } = api.createInstitution.mock.calls[0][0];
    expect(commission.rateFrom).toBe(10);
    expect(commission.rateTo).toBe(15);
    expect(commission.tiers).toEqual([{ label: '1–5 students', rate: '15%' }]);
    // One request. Three sequential ones would let the institution exist with
    // its commission having failed.
    expect(api.createInstitution).toHaveBeenCalledTimes(1);
  });

  // A percentage commission carrying an amount range is two answers to one
  // question, and the card picks which to show from commissionType.
  it('sends only the pair that matches how commission is paid', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('Commission rates'));
    fireEvent.change(screen.getByLabelText('Paid as'), { target: { value: 'fixed_amount' } });
    fireEvent.change(screen.getByLabelText('Amount from'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Tier 1 label'), { target: { value: 'Flat' } });
    fireEvent.change(screen.getByLabelText('Tier 1 rate'), { target: { value: 'GBP 500' } });
    submitForm();

    await waitFor(() => expect(api.createInstitution).toHaveBeenCalled());
    const { commission } = api.createInstitution.mock.calls[0][0];
    expect(commission.amountFrom).toBe(500);
    expect(commission.rateFrom).toBeNull();
  });

  it('names the section and the problem rather than posting something invalid', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('Commission rates'));
    fireEvent.change(screen.getByLabelText('Rate from (%)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Rate to (%)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Tier 1 label'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Tier 1 rate'), { target: { value: 'y' } });
    submitForm();

    await waitFor(() => expect(screen.getByText(/higher than the "to" figure/)).toBeTruthy());
    expect(api.createInstitution).not.toHaveBeenCalled();
  });

  it('sends only the entry-requirement levels that were ticked', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('Entry requirements'));
    // UG is on by default, PG is not.
    for (const label of ['English requirement', 'Academic requirement', 'Offer timeline', 'Financial information']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'set' } });
    }
    submitForm();

    await waitFor(() => expect(api.createInstitution).toHaveBeenCalled());
    const { entryRequirements } = api.createInstitution.mock.calls[0][0];
    expect(entryRequirements).toHaveLength(1);
    expect(entryRequirements[0].level).toBe('UG');
  });

  // Five empty strings would fail min(1) on every field at once, which the
  // server reports as five issues and the banner shows as one of them.
  it('refuses a half-filled level instead of posting blanks', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('Entry requirements'));
    fireEvent.change(screen.getByLabelText('English requirement'), { target: { value: 'IELTS 6.0' } });
    submitForm();

    await waitFor(() => expect(screen.getByText(/fill in every Undergraduate field/)).toBeTruthy());
    expect(api.createInstitution).not.toHaveBeenCalled();
  });

  /**
   * A program level from the same list courses use, not a typed course type.
   * Free text is how the same award became "Bachelor's Degree", "Bachelors" and
   * "UG" — three course types as far as a groupBy is concerned, so the agent
   * dropdown grew an option per spelling and none of them could be joined to a
   * course.
   */
  it('sends a program level, with the label derived from it', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('MOI accepted'));
    await pickLevel('MOI program level 1', "Bachelor's Degree");
    fireEvent.change(screen.getByLabelText('MOI years 1'), { target: { value: '3' } });
    submitForm();

    await waitFor(() => expect(api.createInstitution).toHaveBeenCalled());
    expect(api.createInstitution.mock.calls[0][0].moiAcceptances).toEqual([
      // courseType derived rather than typed, so the label the agent screens
      // render and the enum a query joins on cannot say different things.
      { programLevel: 'BACHELORS_DEGREE', courseType: "Bachelor's Degree", years: 3 },
    ]);
  });

  // The unique key is (institutionId, courseType), so a repeat fails at the
  // database with a message about a constraint the admin cannot see.
  it('refuses the same program level twice', async () => {
    await openAdd();
    fillRequired();

    fireEvent.click(screen.getByText('MOI accepted'));
    await pickLevel('MOI program level 1', "Bachelor's Degree");
    fireEvent.change(screen.getByLabelText('MOI years 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('+ Add program level'));
    await pickLevel('MOI program level 2', "Bachelor's Degree");
    fireEvent.change(screen.getByLabelText('MOI years 2'), { target: { value: '4' } });
    submitForm();

    await waitFor(() => expect(screen.getByText(/each program level can only appear once/i)).toBeTruthy());
    expect(api.createInstitution).not.toHaveBeenCalled();
  });

  // On edit the existing rows already have their own screens, and a second
  // empty set of sections beside them would read as replacing what is there.
  it('offers none of it when editing', async () => {
    api.fetchInstitutionsPage.mockResolvedValue({
      items: [{
        id: 'i1', name: 'Existing University', slug: 'existing', city: null, province: null,
        logoUrl: null, bannerUrl: null, isTrending: false, isBlacklisted: false,
        archivedAt: null, country: COUNTRY, _count: { courses: 0 },
      }],
      meta: { total: 1, page: 1, pageSize: 20, totalPages: 1, maxPage: 1 },
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Existing University')).toBeTruthy());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Commission rates')).toBeNull();
    expect(within(dialog).queryByText('MOI accepted')).toBeNull();
  });
});
