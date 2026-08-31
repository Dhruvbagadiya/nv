import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Modal from './Modal.jsx';
import CourseCard from '../../features/courseFinder/CourseCard.jsx';

// The dialog is portalled into document.body, so it outlives the render
// container and has to be torn down explicitly between cases.
afterEach(cleanup);

describe('Modal', () => {
  // The dialog is positioned against the viewport with `position: fixed`, which
  // silently resolves against the nearest transformed ancestor instead when one
  // exists. .card sets a transform on hover, so a dialog opened from a card
  // rendered in place was sized to the card and clipped by its overflow. This
  // asserts the escape hatch -- the portal -- rather than the symptom, because
  // the symptom is invisible to jsdom (no layout) and only shows up on screen.
  it('renders into document.body, not into the tree that opened it', () => {
    const { container } = render(
      <div style={{ transform: 'translateY(-1px)', overflow: 'hidden' }}>
        <Modal title="Detail" onClose={() => {}}>
          <p>body</p>
        </Modal>
      </div>
    );

    // Nothing of the dialog is inside the transformed wrapper...
    expect(container.querySelector('.modal-backdrop')).toBeNull();
    // ...it is a child of document.body instead.
    expect(document.body.querySelector('.modal-backdrop')).not.toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('CourseCard eye button', () => {
  const program = {
    id: 'c1',
    attributes: {
      name: 'BSc (Hons) Construction Management',
      programLevel: 'bachelors_degree',
      currency: 'GBP',
      tuition: 12800,
      applicationFee: null,
      minLength: 48,
      maxLength: 48,
      tags: ['fee_unknown'],
      badges: [],
      programIntakes: [],
      entryRequirements: { ielts: { overall: '6', notLessThan: '5.5' }, summary: '12th Grade' },
      externalUrl: 'https://example.ac.uk/course',
      school: {
        id: 's1',
        name: 'Anglia Ruskin University College',
        slug: 'aru',
        city: 'Cambridge',
        countryCode: 'UK',
        logoThumbnailUrl: null,
        photos: [],
        bannerUrl: null,
      },
    },
  };

  const renderCard = () =>
    render(
      <MemoryRouter>
        <CourseCard program={program} />
      </MemoryRouter>
    );

  it('opens the detail dialog outside the card', () => {
    const { container } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    // The card must not contain the dialog: that is what made it render at the
    // card's width and get clipped.
    expect(container.querySelector('.card .modal-backdrop')).toBeNull();
  });

  it('shows an unpublished application fee as Unknown, never as free', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    const text = screen.getByRole('dialog').textContent;
    expect(text).toContain('Unknown');
    expect(text).not.toContain('None');
  });

  it('shows a published application fee as money', () => {
    const withFee = {
      ...program,
      attributes: { ...program.attributes, applicationFee: 95, currency: 'EUR', tags: [] },
    };
    render(
      <MemoryRouter>
        <CourseCard program={withFee} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(screen.getByRole('dialog').textContent).toContain('95');
  });
});
