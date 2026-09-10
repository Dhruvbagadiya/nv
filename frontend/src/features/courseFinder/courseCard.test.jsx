import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CourseCard from './CourseCard.jsx';

afterEach(cleanup);

const program = (overrides = {}) => ({
  id: 'c1',
  attributes: {
    name: 'BSc (Hons) Construction Management',
    programLevel: 'FOUNDATION',
    currency: 'GBP',
    tuition: 12800,
    applicationFee: null,
    minLength: 48,
    maxLength: 48,
    intakeMonths: [1, 5, 9],
    programIntakes: [],
    badges: [],
    tags: [],
    school: {
      id: 's1',
      name: 'Anglia Ruskin University College',
      city: 'Cambridge',
      countryCode: 'UK',
      countryName: 'United Kingdom',
      countryIso: 'gb',
      logoThumbnailUrl: null,
    },
    ...overrides,
  },
});

const renderCard = (overrides) =>
  render(
    <MemoryRouter>
      <CourseCard program={program(overrides)} />
    </MemoryRouter>
  );

/**
 * Intakes reached the card from three places at once — scraped `badges`
 * ("Jan intake"), scraped `tags` ("Intake Jan") and the structured
 * `intakeMonths` — and all three rendered. A course running in three months
 * showed nine pills saying so, plus a "Fee Unknown" tag directly above the
 * Application fee line already reading Unknown.
 */
describe('CourseCard highlights', () => {
  it('drops badges and tags that only restate the intake months', () => {
    renderCard({
      badges: ['Jan intake', 'May intake', 'Sep intake', 'Instant Offer'],
      tags: ['intake_jan', 'intake_may', 'top_programs'],
    });

    // The structured months are still shown, once, in their own section.
    expect(screen.getByText(/Runs every/i).textContent).toMatch(/Jan.*May.*Sep/);
    // …but not as pills as well.
    expect(screen.queryByText('Jan intake')).toBeNull();
    expect(screen.queryByText('Intake Jan')).toBeNull();

    expect(screen.getByText('Instant Offer')).toBeTruthy();
    expect(screen.getByText('Top Programs')).toBeTruthy();
  });

  // A loose /\bmay\b/ used to be enough to drop a label; it also drops this one.
  it('keeps a highlight that merely contains a month word', () => {
    renderCard({ badges: ['May apply without IELTS'] });
    expect(screen.getByText('May apply without IELTS')).toBeTruthy();
  });

  // Nothing is gained by hiding the only intake information the row has.
  it('keeps an intake badge when there are no structured months to show', () => {
    renderCard({ badges: ['January Intake'], intakeMonths: [], programIntakes: [] });

    expect(screen.queryByText(/Runs every/i)).toBeNull();
    expect(screen.getByText('January Intake')).toBeTruthy();
  });

  it('drops a "Fee Unknown" tag, which the fee line already says', () => {
    renderCard({ tags: ['fee_unknown'] });

    expect(screen.queryByText('Fee Unknown')).toBeNull();
    expect(screen.getByText('Not published')).toBeTruthy();
  });

  // "Fast LOA" arrives as a badge and "fast_loa" as a tag. Deduplicating on the
  // raw strings keeps both, because the casing differs after prettifying.
  it('shows a highlight once when both feeds carry it', () => {
    renderCard({ badges: ['Fast LOA'], tags: ['fast_loa', 'instant_offer'] });

    expect(screen.getAllByText(/^Fast LOA$/i)).toHaveLength(1);
    expect(screen.getAllByText('Instant Offer')).toHaveLength(1);
  });

  it('reads a null application fee as not published, not as free', () => {
    renderCard({ applicationFee: null });
    expect(screen.getByText('Not published')).toBeTruthy();
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('says Free only when the fee is genuinely zero', () => {
    renderCard({ applicationFee: 0 });
    expect(screen.getByText('Free')).toBeTruthy();
  });

  // The institution is how an agent recognises a row; it used to truncate to
  // "Anglia…" at the first line.
  it('shows the whole institution name and its place', () => {
    renderCard();
    expect(screen.getByText('Anglia Ruskin University College')).toBeTruthy();
    expect(screen.getByText('Cambridge, United Kingdom')).toBeTruthy();
  });

  it('falls back to the country code when no name came through', () => {
    renderCard({
      school: { ...program().attributes.school, countryName: null },
    });
    expect(screen.getByText('Cambridge, UK')).toBeTruthy();
  });
});
