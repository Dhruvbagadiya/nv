/**
 * ProfilePage — industry-standard profile management for ALL roles.
 *
 * Sections:
 *   1. Avatar with upload + crop
 *   2. Basic info — name, email (read-only), phone, bio
 *   3. Change password
 *   4. Student-only — nationality, date of birth, passport, address
 *   5. Agent-only tab link → Agency Settings
 *   6. Role badge + account status
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/useAuth.js';
import Modal from '../../components/ui/Modal.jsx';
import LogoCropper from '../../components/ui/LogoCropper.jsx';
import { fetchProfile, updateProfile, changePassword, uploadAvatar } from '../../api/profile.js';
import {
  fetchStudentProfile,
  updateStudentProfile,
} from '../../api/students.js';
import { formatDate, errorMessage } from '../../utils/format.js';
import Icon from '../../components/ui/Icon.jsx';
import { toast } from '../../store/useToast.js';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  AGENT:       'Partner Agent',
  STUDENT:     'Student',
};
const ROLE_COLOR = {
  SUPER_ADMIN: { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  ADMIN:       { background: 'var(--info-100)',   color: 'var(--info-700)' },
  AGENT:       { background: 'var(--success-100)',color: 'var(--success-700)' },
  STUDENT:     { background: 'var(--accent-100)', color: 'var(--accent-700)' },
};

// ── Avatar section ──────────────────────────────────────────────────────────
function AvatarSection({ profile, onUpdated }) {
  const [showCropper, setShowCropper] = useState(false);
  const patchUser = useAuth((s) => s.patchUser);

  const avatarMutation = useMutation({
    mutationFn: ({ blob, mime }) => uploadAvatar(blob, mime),
    onSuccess: (updated) => {
      patchUser({ avatarUrl: updated.avatarUrl });
      onUpdated(updated);
      toast.success('Photo updated.');
    },
    // Only isPending was rendered, so a rejected upload — too large, wrong type,
    // storage unreachable — ended with the old photo still showing and nothing
    // said, which reads as "it worked".
    onError: (e) => toast.error(errorMessage(e, 'Could not upload that photo.')),
  });

  const handleCropped = (blob, mime) => {
    setShowCropper(false);
    avatarMutation.mutate({ blob, mime });
  };

  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  return (
    <>
      <div className="profile-avatar-section">
        <div className="profile-avatar-wrap" onClick={() => setShowCropper(true)}
          title="Click to change photo" role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setShowCropper(true)}>
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-initials">{initials}</div>
          )}
          <div className="profile-avatar-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          {avatarMutation.isPending && <div className="profile-avatar-loading">…</div>}
        </div>
        <div>
          <div className="profile-name-big">{profile?.name}</div>
          <div className="profile-email-small">{profile?.email}</div>
          <div className="profile-role-badge" style={ROLE_COLOR[profile?.role] ?? {}}>
            {ROLE_LABEL[profile?.role] ?? profile?.role}
          </div>
        </div>
      </div>

      {showCropper && (
        <Modal title="Upload profile photo" onClose={() => setShowCropper(false)} wide>
          <LogoCropper
            onCropped={handleCropped}
            onCancel={() => setShowCropper(false)}
            outputSize={256}
          />
        </Modal>
      )}
    </>
  );
}

// ── Basic info form ─────────────────────────────────────────────────────────
function BasicInfoForm({ profile, onUpdated }) {
  const [form, setForm] = useState({ name: '', phone: '', bio: '' });
  const patchUser = useAuth((s) => s.patchUser);

  // Seeded during render rather than from an effect. Setting state inside an
  // effect renders twice and paints the empty form first, so the fields visibly
  // fill in a beat after the page appears. react-query keeps a stable object
  // while the data is unchanged, so this runs once per load.
  const [seededFrom, setSeededFrom] = useState(null);
  if (profile && profile !== seededFrom) {
    setSeededFrom(profile);
    setForm({ name: profile.name ?? '', phone: profile.phone ?? '', bio: profile.bio ?? '' });
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => updateProfile({
      name:  form.name.trim()  || undefined,
      phone: form.phone.trim() || null,
      bio:   form.bio.trim()   || null,
    }),
    onSuccess: (updated) => {
      patchUser({ name: updated.name, phone: updated.phone, bio: updated.bio });
      onUpdated(updated);
      toast.success('Profile updated.');
    },
  });

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Personal information</h2>
      <div className="profile-form-grid">
        <div className="form-field">
          <label className="flabel" htmlFor="pf-name">Full name *</label>
          <input id="pf-name" type="text" value={form.name}
            onChange={(e) => set('name', e.target.value)} required maxLength={120} />
        </div>
        <div className="form-field">
          <label className="flabel">Email</label>
          <input type="email" value={profile?.email ?? ''} readOnly
            style={{ background: 'var(--canvas)', color: 'var(--ink-400)', cursor: 'not-allowed' }} />
          <div className="field-hint">Email cannot be changed. Contact an admin if needed.</div>
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="pf-phone">Phone number</label>
          <input id="pf-phone" type="tel" value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+91 9000000000" maxLength={30} />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="flabel" htmlFor="pf-bio">Bio / about</label>
          <textarea id="pf-bio" value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="A short bio about yourself…"
            rows={3} maxLength={500}
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '7px 9px', fontFamily: 'var(--font-sans)', fontSize: 12.5,
              resize: 'vertical', background: 'var(--canvas)', lineHeight: 1.5,
              transition: 'border-color .13s',
            }} />
          <div className="field-hint">{form.bio.length}/500 characters</div>
        </div>
      </div>
      {mutation.isError && (
        <div className="form-error">{mutation.error?.response?.data?.error ?? 'Save failed.'}</div>
      )}
      <button type="button" className="btn btn-primary"
        onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
        {mutation.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </section>
  );
}

// ── Change password form ────────────────────────────────────────────────────
function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [localErr, setLocalErr] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => changePassword({
      currentPassword: form.currentPassword,
      newPassword:     form.newPassword,
    }),
    onSuccess: () => {
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setLocalErr(null);
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    },
    onError: (e) => setLocalErr(e.response?.data?.error ?? 'Password change failed.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setLocalErr(null);
    if (form.newPassword !== form.confirm) {
      setLocalErr('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 10) {
      setLocalErr('New password must be at least 10 characters.');
      return;
    }
    mutation.mutate();
  };

  const strength = passwordStrength(form.newPassword);

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Change password</h2>
      <form onSubmit={submit}>
        <div className="profile-form-grid">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="pw-current">Current password *</label>
            <input id="pw-current" type="password" value={form.currentPassword}
              onChange={(e) => set('currentPassword', e.target.value)}
              autoComplete="current-password" required />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="pw-new">New password *</label>
            <input id="pw-new" type="password" value={form.newPassword}
              onChange={(e) => set('newPassword', e.target.value)}
              autoComplete="new-password" required minLength={10} />
            {form.newPassword.length > 0 && (
              <div className="password-strength">
                <div className="password-strength-bar" data-strength={strength.level} />
                <span className="password-strength-label">{strength.label}</span>
              </div>
            )}
            <div className="field-hint">Minimum 10 characters.</div>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="pw-confirm">Confirm new password *</label>
            <input id="pw-confirm" type="password" value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              autoComplete="new-password" required />
            {form.confirm && form.newPassword !== form.confirm && (
              <div className="field-hint" style={{ color: 'var(--danger-700)' }}>
                Passwords do not match.
              </div>
            )}
          </div>
        </div>
        {localErr && <div className="form-error">{localErr}</div>}
        {done && (
          <div className="profile-saved-msg row gap-1">
            <Icon name="check" size={15} />
            Password changed. All other devices have been logged out.
          </div>
        )}
        <button type="submit" className="btn btn-primary"
          disabled={mutation.isPending || !form.currentPassword || !form.newPassword}>
          {mutation.isPending ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

// ── Student-specific fields ─────────────────────────────────────────────────
function StudentDetailsForm() {
  const queryClient = useQueryClient();
  const { data: sp, isLoading } = useQuery({ queryKey: ['student-profile'], queryFn: fetchStudentProfile });
  const [form, setForm] = useState({ nationality: '', dateOfBirth: '', passportNo: '', address: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Seeded during render — see BasicInfoForm above.
  const [seededFrom, setSeededFrom] = useState(null);
  if (sp && sp !== seededFrom) {
    setSeededFrom(sp);
    setForm({
      nationality:  sp.nationality  ?? '',
      dateOfBirth:  sp.dateOfBirth ? new Date(sp.dateOfBirth).toISOString().slice(0, 10) : '',
      passportNo:   sp.passportNo   ?? '',
      address:      sp.address      ?? '',
    });
  }

  const mutation = useMutation({
    mutationFn: () => updateStudentProfile({
      nationality:  form.nationality  || undefined,
      dateOfBirth:  form.dateOfBirth  || undefined,
      passportNo:   form.passportNo   || undefined,
      address:      form.address      || undefined,
    }),
    onSuccess: () => {
      invalidateResource(queryClient, 'profile');
      toast.success('Student info updated.');
    },
  });

  if (isLoading) return null;

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Student information</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12, marginBottom: 12, marginTop: -4 }}>
        Used to pre-fill your visa applications.
      </p>
      <div className="profile-form-grid">
        <div className="form-field">
          <label className="flabel" htmlFor="st-nat">Nationality</label>
          <input id="st-nat" type="text" value={form.nationality}
            onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Indian" />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="st-dob">Date of birth</label>
          <input id="st-dob" type="date" value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)} />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="st-pp">Passport number</label>
          <input id="st-pp" type="text" value={form.passportNo}
            onChange={(e) => set('passportNo', e.target.value)} placeholder="e.g. P1234567" />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="flabel" htmlFor="st-addr">Address</label>
          <textarea id="st-addr" value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Your current address" rows={2}
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '7px 9px', fontFamily: 'var(--font-sans)', fontSize: 12.5,
              resize: 'vertical', background: 'var(--canvas)',
            }} />
        </div>
      </div>
      {mutation.isError && (
        <div className="form-error">{mutation.error?.response?.data?.error ?? 'Save failed.'}</div>
      )}
      <button type="button" className="btn btn-primary"
        onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save student info'}
      </button>
    </section>
  );
}

// ── Account info (read-only) ────────────────────────────────────────────────
function AccountInfo({ profile }) {
  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Account details</h2>
      <div className="profile-account-grid">
        <div><span className="profile-account-label">Account type</span>
          <span className="profile-role-badge" style={ROLE_COLOR[profile?.role] ?? {}}>
            {ROLE_LABEL[profile?.role] ?? profile?.role}
          </span>
        </div>
        {profile?.parentAgentId && (
          <div><span className="profile-account-label">Account type</span>
            <span>Sub-agent</span>
          </div>
        )}
        <div><span className="profile-account-label">Member since</span>
          <span>{formatDate(profile?.createdAt)}</span>
        </div>
        <div><span className="profile-account-label">Status</span>
          <span style={{ color: profile?.isActive ? 'var(--success-700)' : 'var(--danger-700)', fontWeight: 600 }}>
            {profile?.isActive ? 'Active' : 'Deactivated'}
          </span>
        </div>
      </div>
      {/* Role-specific quick links */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(profile?.role === 'AGENT') && (
          <Link to="/partner/settings" className="btn btn-outline" style={{ fontSize: 12 }}>
            Agency settings →
          </Link>
        )}
        {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
          <Link to="/admin" className="btn btn-outline" style={{ fontSize: 12 }}>
            Admin panel →
          </Link>
        )}
        {profile?.role === 'STUDENT' && (
          <Link to="/my-applications" className="btn btn-outline" style={{ fontSize: 12 }}>
            My applications →
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Password strength helper ────────────────────────────────────────────────
function passwordStrength(pw) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak' };
  if (score <= 2) return { level: 2, label: 'Fair' };
  if (score <= 3) return { level: 3, label: 'Good' };
  return { level: 4, label: 'Strong' };
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchProfile,
  });

  const handleUpdated = () => {
    invalidateResource(queryClient, 'profile');
  };

  if (isLoading) {
    return <div className="profile-loading">Loading profile…</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-inner">
        {/* Header */}
        <div className="profile-page-header">
          <h1 className="profile-page-title">My Profile</h1>
          <p className="profile-page-sub">Manage your personal information and account settings</p>
        </div>

        {/* Avatar + name hero */}
        <div className="profile-card">
          <AvatarSection profile={profile} onUpdated={handleUpdated} />
        </div>

        {/* Two-column layout for the forms */}
        <div className="profile-cols">
          <div>
            <div className="profile-card">
              <BasicInfoForm profile={profile} onUpdated={handleUpdated} />
            </div>
            {/* Student-only section */}
            {profile?.role === 'STUDENT' && (
              <div className="profile-card">
                <StudentDetailsForm />
              </div>
            )}
          </div>
          <div>
            <div className="profile-card">
              <ChangePasswordForm />
            </div>
            <div className="profile-card">
              <AccountInfo profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
