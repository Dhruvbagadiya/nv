import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudentProfile, updateStudentProfile } from '../../api/students.js';
import { useAuth } from '../../store/useAuth.js';

export default function StudentProfile() {
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: fetchStudentProfile,
  });

  const [form, setForm] = useState({
    nationality: '', dateOfBirth: '', passportNo: '', phone: '', address: '',
  });
  const [saved, setSaved] = useState(false);

  // Seeded during render rather than in an effect: setState inside an effect costs
  // a second render pass, and React documents this compare-with-previous pattern
  // for "reset state when a value changes".
  const [seededFrom, setSeededFrom] = useState(null);
  if (profile && seededFrom !== profile.userId) {
    setSeededFrom(profile.userId);
    setForm({
      nationality: profile.nationality ?? '',
      dateOfBirth: profile.dateOfBirth
        ? new Date(profile.dateOfBirth).toISOString().slice(0, 10)
        : '',
      passportNo: profile.passportNo ?? '',
      phone: profile.phone ?? '',
      address: profile.address ?? '',
    });
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => updateStudentProfile({
      nationality:  form.nationality  || undefined,
      dateOfBirth:  form.dateOfBirth  || undefined,
      passportNo:   form.passportNo   || undefined,
      phone:        form.phone        || undefined,
      address:      form.address      || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
          <button className="student-profile-logout" onClick={logout}>Sign out</button>
        </div>

        <div className="student-profile-card">
          <h2>Personal information</h2>
          <p style={{ color: 'var(--ink-500)', fontSize: 12, marginBottom: 16 }}>
            This information is used to pre-fill your applications.
          </p>

          {isLoading ? <p>Loading…</p> : (
            <form onSubmit={handleSubmit}>
              <div className="student-profile-grid">
                <div className="student-apply-field">
                  <label>Nationality</label>
                  <input type="text" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Indian" />
                </div>
                <div className="student-apply-field">
                  <label>Date of birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </div>
                <div className="student-apply-field">
                  <label>Passport number</label>
                  <input type="text" value={form.passportNo} onChange={(e) => set('passportNo', e.target.value)} placeholder="e.g. P1234567" />
                </div>
                <div className="student-apply-field">
                  <label>Phone number</label>
                  <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 9000000000" />
                </div>
                <div className="student-apply-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <textarea value={form.address} onChange={(e) => set('address', e.target.value)}
                    placeholder="Your current address" rows={3}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 9px', fontFamily: 'var(--font-sans)', fontSize: 13, resize: 'vertical', background: 'var(--canvas)' }} />
                </div>
              </div>

              {mutation.isError && (
                <div className="student-auth-error">{mutation.error?.response?.data?.error ?? 'Save failed.'}</div>
              )}
              {saved && (
                <div style={{ color: 'var(--success-700)', fontWeight: 600, fontSize: 13, marginTop: 8 }}>
                  ✓ Profile saved successfully.
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
