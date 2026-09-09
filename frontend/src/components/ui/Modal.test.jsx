import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
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

  it('labels a multi-figure fee as "from" and shows what the provider wrote', () => {
    // The stored number is the lowest of several quoted figures, so presenting
    // it unqualified would tell a student a per-campus minimum is the price.
    const ranged = {
      ...program,
      attributes: {
        ...program.attributes,
        tuition: 15000,
        entryRequirements: {
          ...program.attributes.entryRequirements,
          tuitionIsFrom: true,
          tuitionText: '15000-16500',
        },
      },
    };
    render(
      <MemoryRouter>
        <CourseCard program={ranged} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    const text = screen.getByRole('dialog').textContent;
    expect(text).toContain('from');
    expect(text).toContain('15000-16500');
  });

  it('does not say "from" when a single fee is published', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(screen.getByRole('dialog').textContent).not.toContain('from');
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

  // Callers pass an inline arrow, so onClose is a new function every parent
  // render. While it was in the effect's dependency list the whole setup re-ran:
  // focus jumped back to the panel mid-keystroke.
  it('does not grab focus back when the parent re-renders', () => {
    function Harness() {
      const [, tick] = useState(0);
      return (
        <Modal title="Edit" onClose={() => {}}>
          <input aria-label="Name" />
          <button type="button" onClick={() => tick((n) => n + 1)}>Re-render</button>
        </Modal>
      );
    }
    render(<Harness />);

    const input = screen.getByLabelText('Name');
    input.focus();
    expect(document.activeElement).toBe(input);

    // A parent re-render with a fresh onClose identity.
    fireEvent.click(screen.getByText('Re-render'));

    expect(document.activeElement).toBe(input);
  });
});
