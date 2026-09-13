import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/admin.js', () => ({
  uploadImage: vi.fn(),
  uploadFile: vi.fn(),
}));

const adminApi = await import('../../api/admin.js');
const FileField = (await import('./FileField.jsx')).default;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderField(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <FileField id="f" label="Logo" value="" onChange={onChange} {...props} />
    </QueryClientProvider>
  );
  return { ...utils, onChange };
}

const pick = (name = 'logo.png', type = 'image/png') => {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } });
};

/**
 * The admin forms asked for a "Logo URL" as free text, so an admin had to host
 * the image elsewhere and paste a link back. Nothing in the product produced
 * that link.
 */
describe('FileField', () => {
  it('uploads the picked file and reports back the stored URL', async () => {
    // The uploader returns the whole response — a PDF also comes back with a
    // rendered thumbnailUrl — and this field takes the one URL it stores.
    adminApi.uploadImage.mockResolvedValue({ fileUrl: 'https://cdn.example.com/institution-logos/a.png' });
    const { onChange } = renderField({ kind: 'image', category: 'institution-logos' });

    pick();

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/institution-logos/a.png')
    );
    // The category travels with the file, so uploads stay sorted by what they are.
    expect(adminApi.uploadImage.mock.calls[0][1]).toBe('institution-logos');
  });

  it('sends a non-image through the file endpoint, not the image one', async () => {
    adminApi.uploadFile.mockResolvedValue({ fileUrl: '/uploads/files/x.pdf', thumbnailUrl: null });
    renderField({ kind: 'file', category: 'update-attachments' });

    pick('circular.pdf', 'application/pdf');

    await waitFor(() => expect(adminApi.uploadFile).toHaveBeenCalled());
    expect(adminApi.uploadImage).not.toHaveBeenCalled();
  });

  it('surfaces the server error rather than failing silently', async () => {
    adminApi.uploadImage.mockRejectedValue({
      response: { data: { error: 'File is too large. Maximum is 5 MB.' } },
    });
    const { onChange } = renderField({ kind: 'image' });

    pick();

    await waitFor(() => expect(screen.getByText(/too large/i)).toBeTruthy());
    // Nothing is saved when the upload failed.
    expect(onChange).not.toHaveBeenCalled();
  });

  // The imports write logoUrl/bannerUrl/fileUrl directly, so an imported row has
  // a URL nobody uploaded here. Dropping the field would make those uneditable.
  it('still allows a pasted link, for rows an importer wrote', async () => {
    const { onChange } = renderField({ kind: 'image' });

    fireEvent.click(screen.getByText(/paste a link/i));
    fireEvent.change(screen.getByLabelText('Logo link'), {
      target: { value: 'https://elsewhere.example/logo.png' },
    });

    expect(onChange).toHaveBeenCalledWith('https://elsewhere.example/logo.png');
  });

  it('shows a preview and a Replace action once something is set', () => {
    renderField({ kind: 'image', value: 'https://cdn.example.com/a.png' });

    expect(screen.getByAltText('Logo preview')).toBeTruthy();
    expect(screen.getByText('Replace')).toBeTruthy();
    expect(screen.getByText('Remove')).toBeTruthy();
  });
});
