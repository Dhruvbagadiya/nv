import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import EnquiryDialog from './EnquiryDialog.jsx';

/*
 * This replaced a "Track your application" link to /login. The student portal
 * behind that link is real, but NV's clients have no account there, so it sent
 * strangers to a login for something they never signed up to.
 *
 * Nothing is stored — the form composes a message and hands it to WhatsApp — so
 * what matters is that the composed message actually carries what was typed.
 */
const props = {
  open: true,
  onClose: vi.fn(),
  whatsappBase: 'https://wa.me/919925913764',
  tel: 'tel:+919925913764',
  email: 'nvimmigrationsurat@gmail.com',
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('EnquiryDialog', () => {
  it('renders nothing until it is opened', () => {
    const { container } = render(<EnquiryDialog {...props} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('will not send without a name and a phone number', () => {
    render(<EnquiryDialog {...props} />);
    const send = screen.getByRole('button', { name: /send on whatsapp/i });
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Riya Patel' } });
    expect(send.disabled).toBe(true); // phone still missing

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+91 90000 00000' } });
    expect(send.disabled).toBe(false);
  });

  it('carries every answer into the WhatsApp message', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EnquiryDialog {...props} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Riya Patel' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+91 90000 00000' } });
    fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'Canada' } });
    fireEvent.change(screen.getByLabelText(/what is this about/i), { target: { value: 'Application status' } });
    fireEvent.change(screen.getByLabelText(/anything else/i), { target: { value: 'Filed in March' } });
    fireEvent.click(screen.getByRole('button', { name: /send on whatsapp/i }));

    expect(open).toHaveBeenCalled();
    const sent = decodeURIComponent(open.mock.calls[0][0]);
    expect(sent).toContain('https://wa.me/919925913764');
    expect(sent).toContain('Riya Patel');
    expect(sent).toContain('+91 90000 00000');
    expect(sent).toContain('Canada');
    expect(sent).toContain('Application status');
    expect(sent).toContain('Filed in March');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<EnquiryDialog {...props} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // Not everyone has WhatsApp; a dialog with one way out is a dead end.
  it('offers phone and email as alternatives', () => {
    render(<EnquiryDialog {...props} />);
    expect(screen.getByRole('link', { name: /call instead/i })).toHaveProperty('href', 'tel:+919925913764');
    expect(screen.getByRole('link', { name: /email instead/i }).getAttribute('href')).toMatch(/^mailto:/);
  });
});
