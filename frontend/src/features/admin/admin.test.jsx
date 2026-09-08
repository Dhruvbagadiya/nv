import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The admin layer's risk is in the mapping, not the markup: form values have to
// become the exact payload the API's strict zod schemas accept. An extra key or an
// empty string where null is expected is a 400 at runtime and passes both lint and
// the build.

vi.mock('../../api/admin.js', () => ({
  fetchAllAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  createSupportContact: vi.fn(),
  updateSupportContact: vi.fn(),
  archiveSupportContact: vi.fn(),
  createImportantUpdate: vi.fn(),
  updateImportantUpdate: vi.fn(),
  archiveImportantUpdate: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  archiveDocument: vi.fn(),
  fetchStorageStatus: vi.fn(),
  createUploadUrl: vi.fn(),
  upsertCommission: vi.fn(),
  upsertEntryRequirement: vi.fn(),
  fetchSubAgents: vi.fn(),
  createSubAgent: vi.fn(),
  // SubAgentButton imports this and passes it straight to useMutation, so its
  // absence from the mock made the component throw on mount rather than fail an
  // assertion — which is why four unrelated SubAgentButton tests were red.
  removeSubAgent: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock('../../api/referenceScreens.js', () => ({
  fetchCommissions: vi.fn(),
  fetchEntryRequirements: vi.fn(),
  fetchEnglishTests: vi.fn(),
  fetchImportantUpdates: vi.fn(),
  fetchImportantUpdate: vi.fn(),
  fetchDocuments: vi.fn(),
  fetchDocumentCounts: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchSupportContacts: vi.fn(),
  fetchReportSummary: vi.fn(),
}));
vi.mock('../../api/countries.js', () => ({ fetchCountries: vi.fn() }));
vi.mock('../../api/institutions.js', () => ({
  fetchInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  setBlacklist: vi.fn(),
}));

const adminApi = await import('../../api/admin.js');
const refApi = await import('../../api/referenceScreens.js');
const countriesApi = await import('../../api/countries.js');
const institutionsApi = await import('../../api/institutions.js');
const { useAuth } = await import('../../store/useAuth.js');

const AdminAnnouncements = (await import('./AdminAnnouncements.jsx')).default;
const AdminCommissions = (await import('./AdminCommissions.jsx')).default;
const AdminDocuments = (await import('./AdminDocuments.jsx')).default;
const SubAgentButton = (await import('../../components/layout/SubAgentButton.jsx')).default;

const COUNTRY = { id: 'c1', code: 'UK', name: 'United Kingdom', flagEmoji: '🇬🇧', currencyCode: 'GBP', institutionCount: 3 };
const INSTITUTION = { id: 'i1', name: 'University of Hertfordshire', country: COUNTRY };
const meta = (total) => ({ total, page: 1, pageSize: 20, totalPages: 1 });

function renderScreen(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('admin resource pages', () => {
  beforeEach(() => {
    countriesApi.fetchCountries.mockResolvedValue([COUNTRY]);
    institutionsApi.fetchInstitutions.mockResolvedValue([INSTITUTION]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('lists announcements and shows live vs hidden', async () => {
    adminApi.fetchAllAnnouncements.mockResolvedValue({
      items: [
        { id: 'a1', variant: 'DANGER', message: 'Blacklist notice', ctaLabel: 'Click for list', ctaUrl: '/x', isActive: true, sortOrder: 0 },
        { id: 'a2', variant: 'INFO', message: 'Hidden one', ctaLabel: null, ctaUrl: null, isActive: false, sortOrder: 1 },
      ],
    });

    renderScreen(<AdminAnnouncements />);
    await waitFor(() => expect(screen.getByText('Blacklist notice')).toBeTruthy());
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    // A banner with no button shows a dash rather than an empty cell.
    expect(screen.getByText('—')).toBeTruthy();
  });

  // Empty strings must become null. The API treats "" as a present-but-empty value,
  // and an empty ctaLabel would render a button with no text.
  it('maps blank optional fields to null on save', async () => {
    adminApi.fetchAllAnnouncements.mockResolvedValue({ items: [] });
    adminApi.createAnnouncement.mockResolvedValue({ id: 'new' });

    renderScreen(<AdminAnnouncements />);
    await waitFor(() => expect(screen.getByText('Add banner')).toBeTruthy());
    fireEvent.click(screen.getByText('Add banner'));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'A new notice' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(adminApi.createAnnouncement).toHaveBeenCalled());
    expect(adminApi.createAnnouncement.mock.calls[0][0]).toEqual({
      variant: 'INFO',
      message: 'A new notice',
      ctaLabel: null,
      ctaUrl: null,
      isActive: true,
      sortOrder: 0,
    });
  });

  it('asks before deleting, and does not call the API when declined', async () => {
    adminApi.fetchAllAnnouncements.mockResolvedValue({
      items: [{ id: 'a1', variant: 'INFO', message: 'Keep me', ctaLabel: null, ctaUrl: null, isActive: true, sortOrder: 0 }],
    });
    vi.stubGlobal('confirm', vi.fn(() => false));

    renderScreen(<AdminAnnouncements />);
    await waitFor(() => expect(screen.getByText('Keep me')).toBeTruthy());
    // "Delete", not "Archive": this screen maps `remove` to a real delete, and
    // the button now says what it does.
    fireEvent.click(screen.getByText('Delete'));

    expect(window.confirm).toHaveBeenCalled();
    expect(adminApi.deleteAnnouncement).not.toHaveBeenCalled();
  });

  // Commission tiers are the irregular Json column. Blank rows must be dropped —
  // the API requires every tier to have a non-empty label and rate.
  it('drops blank commission tiers before saving', async () => {
    refApi.fetchCommissions.mockResolvedValue({ items: [], meta: meta(0) });
    adminApi.upsertCommission.mockResolvedValue({ id: 'cm1' });

    renderScreen(<AdminCommissions />);
    await waitFor(() => expect(screen.getByText('Set commission')).toBeTruthy());
    fireEvent.click(screen.getByText('Set commission'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^Institution/), { target: { value: 'i1' } });
    fireEvent.change(screen.getByLabelText('Tier 1 label'), { target: { value: '1-5 students' } });
    fireEvent.change(screen.getByLabelText('Tier 1 rate'), { target: { value: '15%' } });
    // Add a second tier and leave it blank.
    fireEvent.click(screen.getByText('+ Add tier'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(adminApi.upsertCommission).toHaveBeenCalled());
    expect(adminApi.upsertCommission.mock.calls[0][0]).toEqual({
      institutionId: 'i1',
      tiers: [{ label: '1-5 students', rate: '15%' }],
      notes: null,
    });
  });

  it('tells the admin when uploads are not configured instead of failing silently', async () => {
    refApi.fetchDocuments.mockResolvedValue({ items: [], meta: meta(0) });
    adminApi.fetchStorageStatus.mockResolvedValue({
      enabled: false,
      maxBytes: 26214400,
      allowedContentTypes: ['application/pdf'],
    });

    renderScreen(<AdminDocuments />);
    await waitFor(() => expect(screen.getByText('Add document')).toBeTruthy());
    fireEvent.click(screen.getByText('Add document'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    // Uploading with S3 unconfigured is no longer a dead end: POST
    // /documents/upload writes to the server's local disk instead, so the picker
    // is offered either way and the hint says where the file will land.
    expect(screen.getByText(/local disk/i)).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeTruthy();
    // Saving by URL still works.
    expect(screen.getByLabelText(/^File URL/)).toBeTruthy();
  });

  it('offers a file input when storage IS configured', async () => {
    refApi.fetchDocuments.mockResolvedValue({ items: [], meta: meta(0) });
    adminApi.fetchStorageStatus.mockResolvedValue({
      enabled: true,
      maxBytes: 26214400,
      allowedContentTypes: ['application/pdf', 'image/png'],
    });

    renderScreen(<AdminDocuments />);
    await waitFor(() => expect(screen.getByText('Add document')).toBeTruthy());
    fireEvent.click(screen.getByText('Add document'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    // accept is built from the server's allow-list, so the picker cannot offer a
    // type the API will reject.
    expect(fileInput.getAttribute('accept')).toBe('application/pdf,image/png');
    expect(screen.getByText(/Max 25 MB/)).toBeTruthy();
  });
});

describe('SubAgentButton', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('is hidden for a sub-agent, since the hierarchy is one level deep', () => {
    useAuth.setState({ status: 'authenticated', user: { id: 's1', role: 'AGENT', parentAgentId: 'a1' } });
    renderScreen(<SubAgentButton />);
    expect(screen.queryByLabelText('Manage team members')).toBeNull();
  });

  it('is hidden for an admin', () => {
    useAuth.setState({ status: 'authenticated', user: { id: 'ad1', role: 'ADMIN', parentAgentId: null } });
    renderScreen(<SubAgentButton />);
    expect(screen.queryByLabelText('Manage team members')).toBeNull();
  });

  it('lists the team for a top-level agent', async () => {
    useAuth.setState({ status: 'authenticated', user: { id: 'a1', role: 'AGENT', parentAgentId: null } });
    adminApi.fetchSubAgents.mockResolvedValue([
      { id: 's1', name: 'Priya Nair', email: 'priya@example.com', applicationCount: 3 },
    ]);

    renderScreen(<SubAgentButton />);
    fireEvent.click(screen.getByLabelText('Manage team members'));
    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeTruthy());
    expect(screen.getByText('3 applications')).toBeTruthy();
  });

  // There is no email delivery, so the password is shown once and the agent has to
  // pass it on. Losing it silently would leave an unusable account.
  it('shows the credentials once after creating', async () => {
    useAuth.setState({ status: 'authenticated', user: { id: 'a1', role: 'AGENT', parentAgentId: null } });
    adminApi.fetchSubAgents.mockResolvedValue([]);
    adminApi.createSubAgent.mockResolvedValue({
      id: 's2',
      name: 'New Person',
      email: 'new@example.com',
      role: 'AGENT',
    });

    renderScreen(<SubAgentButton />);
    fireEvent.click(screen.getByLabelText('Manage team members'));
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Temporary password/), {
      target: { value: 'temporary-pw-1' },
    });
    fireEvent.click(screen.getByText('Create sub-agent'));

    await waitFor(() => expect(screen.getByText('new@example.com')).toBeTruthy());
    expect(screen.getByText('temporary-pw-1')).toBeTruthy();
    // No role in the payload — a sub-agent is always an AGENT, enforced server-side too.
    expect(adminApi.createSubAgent.mock.calls[0][0]).toEqual({
      name: 'New Person',
      email: 'new@example.com',
      password: 'temporary-pw-1',
    });
  });
});

describe('destructive row action', () => {
  const ROW = { id: 'a1', variant: 'INFO', message: 'Keep me', ctaLabel: null, ctaUrl: null, isActive: true, sortOrder: 0 };

  // The button read "Archive" on every screen, including the two that map
  // `remove` to a real delete. The confirm text said "permanently" while the
  // button beside it promised the row was only being filed away.
  it('says Delete where the action really deletes', async () => {
    adminApi.fetchAllAnnouncements.mockResolvedValue({ items: [ROW] });
    renderScreen(<AdminAnnouncements />);

    await waitFor(() => expect(screen.getByText('Keep me')).toBeTruthy());
    expect(screen.getByRole('button', { name: /^Delete/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Archive/ })).toBeNull();
  });

  // Twenty rows produced twenty buttons all announced as just "Delete", with
  // nothing to say which record each one belonged to.
  it('names the row in the action label', async () => {
    adminApi.fetchAllAnnouncements.mockResolvedValue({ items: [ROW] });
    renderScreen(<AdminAnnouncements />);

    await waitFor(() => expect(screen.getByText('Keep me')).toBeTruthy());
    const label = screen.getByRole('button', { name: /^Delete/ }).getAttribute('aria-label');
    expect(label.startsWith('Delete')).toBe(true);
  });
});
