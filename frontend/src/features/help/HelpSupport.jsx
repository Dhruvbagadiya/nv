import { useQuery } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import { fetchSupportContacts } from '../../api/referenceScreens.js';

// Digits only — tel: and wa.me both reject spaces and punctuation, and the stored
// numbers are written for humans ("+91 90000 00001").
const toDialable = (phone) => phone.replace(/[^\d+]/g, '');
const toWhatsApp = (phone) => phone.replace(/[^\d]/g, '');

function ContactCard({ contact }) {
  const initials = contact.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="contact-card">
      <div className="avatar contact-avatar">{initials}</div>
      <div className="contact-body">
        <div className="contact-name">{contact.name}</div>
        <div className="contact-actions">
          {/* Real links rather than the reference's inert text: tapping a number
              on a phone should dial it. */}
          <a className="contact-link" href={`tel:${toDialable(contact.phone)}`}>
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
            </svg>
            {contact.phone}
          </a>
          <a
            className="contact-link"
            href={`https://wa.me/${toWhatsApp(contact.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z" />
            </svg>
            Message
          </a>
        </div>
      </div>
    </div>
  );
}

export default function HelpSupport() {
  const { data: contacts = [], isLoading, isError } = useQuery({
    queryKey: ['support-contacts'],
    // Wrapped, not passed by reference: React Query calls queryFn with its own
    // context object ({ client, queryKey, signal, meta }), and fetchSupportContacts
    // takes `params` — so a whole QueryClient was being handed to axios as the
    // query string. It only escaped notice because this endpoint's query schema
    // is the one in its module without .strict(), so the junk was stripped.
    queryFn: () => fetchSupportContacts(),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <Page title="Help & Support" subtitle="Talk to the team handling your applications">
      {isLoading && <p className="empty-state">Loading…</p>}
      {isError && <p className="empty-state">Couldn’t load the support team.</p>}
      {!isLoading && !isError && contacts.length === 0 && (
        <p className="empty-state">No support contacts have been published yet.</p>
      )}
      <div className="contact-grid">
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>
    </Page>
  );
}
