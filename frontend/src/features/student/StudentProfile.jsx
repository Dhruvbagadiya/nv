import { useSeededForm } from '../../hooks/useSeededForm.js';
import { toDateInput } from '../../utils/format.js';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';
import { fetchStudentProfile, updateStudentProfile } from '../../api/students.js';
import { useAuth } from '../../store/useAuth.js';
import { toast } from '../../store/useToast.js';


export default function StudentProfile() {
  const queryClient = useQueryClient();
  const user   = useAuth((s) => s.user);
  const logout   = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: fetchStudentProfile,
  });

  // The same hook the partner-side profile uses. This screen shares the
  // ['student-profile'] cache with it, so a save on either side refetched here
  // and reset whatever had been typed and not yet saved.
  const { values: form, setField: set, markSaved } = useSeededForm(profile, (p) => ({
    nationality: p.nationality ?? '',
    dateOfBirth: toDateInput(p.dateOfBirth),
    passportNo:  p.passportNo ?? '',
    phone:       p.phone ?? '',
    address:     p.address ?? '',
  }));

  const mutation = useMutation({
    mutationFn: () => updateStudentProfile({
      // null, not undefined — JSON.stringify drops undefined, so a cleared box
      // never reached the server and the old value came back on the refetch.
      nationality: form.nationality  || null,
      dateOfBirth: form.dateOfBirth  || null,
      passportNo:  form.passportNo   || null,
      phone:       form.phone        || null,
      address:     form.address      || null,
    }),
    onSuccess: () => {
      invalidateResource(queryClient, 'profile');
      markSaved();
      toast.success('Profile saved.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="student-profile-page">
      <div className="student-profile-inner">
        <div className="student-profile-header">
          <div className="student-profile-avatar">
            {user?.name?.slice(0, 2).toUpperCase() ?? 'ST'}
          </div>
          <div>
            <h1 className="student-profile-name">{user?.name}</h1>
            <div className="student-profile-email">{user?.email}</div>
          </div>
          <button className="student-profile-logout" onClick={handleLogout}>Sign out</button>
        </div>

        <div className="student-profile-card">
          <h2>Personal information</h2>
          <p style={{ color: 'var(--ink-500)', fontSize: 12, marginBottom: 16 }}>
            This information is used to pre-fill your applications.
          </p>

          {isLoading ? (
            <p>Loading…</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="student-profile-grid">
                <div className="student-apply-field">
                  <label>Nationality</label>
                  <input type="text" value={form.nationality}
                    onChange={(e) => set('nationality', e.target.value)}
                    placeholder="e.g. Indian" />
                </div>
                <div className="student-apply-field">
                  <label>Date of birth</label>
                  <input type="date" value={form.dateOfBirth}
                    onChange={(e) => set('dateOfBirth', e.target.value)} />
                </div>
                <div className="student-apply-field">
                  <label>Passport number</label>
                  <input type="text" value={form.passportNo}
                    onChange={(e) => set('passportNo', e.target.value)}
                    placeholder="e.g. P1234567" />
                </div>
                <div className="student-apply-field">
                  <label>Phone number</label>
                  <input type="text" value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+91 9000000000" />
                </div>
                <div className="student-apply-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder="Your current address"
                    rows={3}
                    style={{
                      width: '100%', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', padding: '7px 9px',
                      fontFamily: 'var(--font-sans)', fontSize: 13,
                      resize: 'vertical', background: 'var(--canvas)',
                    }}
                  />
                </div>
              </div>

              {mutation.isError && (
                <div className="student-auth-error">
                  {mutation.error?.response?.data?.error ?? 'Save failed.'}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <button type="submit" className="student-apply-btn" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
