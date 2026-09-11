import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Modal from '../../components/ui/Modal.jsx';
import LogoCropper from '../../components/ui/LogoCropper.jsx';
import { useAuth } from '../../store/useAuth.js';
import { saveAgencyProfile, deleteAgencyProfile, uploadAgencyLogo } from '../../api/agency.js';
import { buildAccentScale, applyTheme, resetTheme, NV_DEFAULT_ACCENT } from '../../hooks/useTheme.js';
import { extractDominantColor } from '../../components/ui/LogoCropper.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { toast } from '../../store/useToast.js';

// A curated palette of 12 suggested accent colors.
const PRESET_COLORS = [
  { hex: '#C96E0E', label: 'NV Orange (default)' },
  { hex: '#1B5AA0', label: 'Navy Blue' },
  { hex: '#0B6B4E', label: 'Forest Green' },
  { hex: '#6E2C9C', label: 'Purple' },
  { hex: '#A32419', label: 'Crimson' },
  { hex: '#0A7F6B', label: 'Teal' },
  { hex: '#8A5B00', label: 'Amber' },
  { hex: '#1A6E8A', label: 'Steel Blue' },
  { hex: '#5C3D8F', label: 'Indigo' },
  { hex: '#2D6A27', label: 'Emerald' },
  { hex: '#C0392B', label: 'Red' },
  { hex: '#2C3E50', label: 'Slate' },
];

export default function AgencySettings() {
  const user              = useAuth((s) => s.user);
  const agencyProfile     = useAuth((s) => s.agencyProfile);
  const setAgencyProfile  = useAuth((s) => s.setAgencyProfile);
  const isSubAgent        = Boolean(user?.parentAgentId);

  const current     = agencyProfile ?? {};
  const [agencyName,   setAgencyName]   = useState(current.agencyName  ?? 'NV Immigration');
  const [website,      setWebsite]      = useState(current.website     ?? '');
  const [logoUrl,      setLogoUrl]      = useState(current.logoUrl     ?? null);
  const [accentColor,  setAccentColor]  = useState(current.accentColor ?? NV_DEFAULT_ACCENT);

  // logo crop state
  const [pendingBlob,    setPendingBlob]    = useState(null);
  const [pendingMime,    setPendingMime]    = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [showCropper,    setShowCropper]    = useState(false);

  const [error,  setError]  = useState(null);

  // Native color input ref for the custom hex picker
  const colorInputRef = useRef(null);

  // Live-preview the theme as the user changes the color (no save yet)
  const previewColor = (hex) => {
    setAccentColor(hex);
    applyTheme(hex); // instantly repaints CSS vars
  };

  // ── Save mutation ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      let finalLogoUrl = logoUrl;
      if (pendingBlob) {
        finalLogoUrl = await uploadAgencyLogo(pendingBlob, pendingMime);
      }
      return saveAgencyProfile({
        agencyName:  agencyName.trim(),
        logoUrl:     finalLogoUrl  || null,
        website:     website.trim() || null,
        accentColor: accentColor   || null,
      });
    },
    onSuccess: (profile) => {
      setAgencyProfile(profile); // also calls applyTheme internally
      setLogoUrl(profile.logoUrl);
      setPendingBlob(null);
      setPendingPreview(null);
      toast.success('Branding saved.');
      // No ['agency-profile'] invalidation: nothing queries that key. The
      // branding lives in the auth store, and setAgencyProfile above is what
      // actually republishes it.
    },
    onError: (e) => setError(e.response?.data?.error ?? 'Could not save. Please try again.'),
  });

  // ── Reset mutation ───────────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: deleteAgencyProfile,
    onSuccess: () => {
      setAgencyProfile(null);
      setAgencyName('NV Immigration');
      setWebsite('');
      setLogoUrl(null);
      setPendingBlob(null);
      setPendingPreview(null);
      setAccentColor(NV_DEFAULT_ACCENT);
      resetTheme();
    },
    onError: (e) => setError(e.response?.data?.error ?? 'Could not reset.'),
  });

  // ── Logo crop callback — receives blob + detected color ──────────────────
  const handleCropped = (blob, mime, detectedColor) => {
    setPendingBlob(blob);
    setPendingMime(mime);
    setPendingPreview(URL.createObjectURL(blob));
    setShowCropper(false);

    // Auto-apply the detected color as a live preview
    if (detectedColor) {
      previewColor(detectedColor);
    }
  };

  // ── Auto-detect from existing logo URL ──────────────────────────────────
  const handleAutoDetect = () => {
    const src = pendingPreview ?? logoUrl;
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const detected = extractDominantColor(img);
      if (detected) previewColor(detected);
    };
    img.src = src;
  };

  const displayLogo = pendingPreview ?? logoUrl;

  if (isSubAgent) {
    return (
      <Page title="Agency settings" subtitle="Branding for your partner portal">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: 24, maxWidth: 560,
        }}>
          <p style={{ color: 'var(--ink-600)', fontSize: 13, margin: 0 }}>
            You are a sub-agent. Your portal uses your agency owner&rsquo;s branding.
            {agencyProfile
              ? <> Currently showing <strong>{agencyProfile.agencyName}</strong>.</>
              : ' No custom branding is set — NV Immigration branding is shown.'}
          </p>
          {agencyProfile?.accentColor && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 4,
                background: agencyProfile.accentColor,
                border: '1px solid rgba(0,0,0,.1)',
              }} />
              <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                Theme color: {agencyProfile.accentColor}
              </span>
            </div>
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Agency settings"
      subtitle="Customise your agency name, logo and brand colour"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900, alignItems: 'start' }}>

        {/* ── Left: settings form ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Logo card */}
          <div className="profile-card">
            <div className="profile-section-title">Agency logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {displayLogo ? (
                <img src={displayLogo} alt="Agency logo" style={{
                  width: 72, height: 72, objectFit: 'contain',
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: 4, background: 'var(--canvas)',
                }} />
              ) : (
                <div style={{
                  width: 72, height: 72, border: '2px dashed var(--border-strong)',
                  borderRadius: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--ink-300)',
                  background: 'var(--canvas)',
                }}><Icon name="building" size={28} /></div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCropper(true)}>
                  {displayLogo ? 'Change logo' : 'Upload logo'}
                </button>
                {displayLogo && (
                  <>
                    <button type="button" className="btn btn-outline"
                      title="Auto-detect brand color from logo"
                      onClick={handleAutoDetect}
                      style={{ fontSize: 12 }}>
                      <Icon name="palette" size={15} /> Detect color from logo
                    </button>
                    <button type="button" className="btn btn-ghost"
                      style={{ fontSize: 11, color: 'var(--danger-700)' }}
                      onClick={() => { setLogoUrl(null); setPendingBlob(null); setPendingPreview(null); }}>
                      Remove logo
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="field-hint">
              Square PNG, JPEG or WebP · max 2 MB. Image will be cropped before upload.
              Uploading a new logo will auto-detect its dominant colour.
            </div>
          </div>

          {/* Name + website card */}
          <div className="profile-card">
            <div className="profile-section-title">Agency details</div>
            <div className="form-field">
              <label className="flabel" htmlFor="ag-name">Agency name *</label>
              <input id="ag-name" type="text" value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="e.g. Sunrise Immigration" maxLength={120} />
              <div className="field-hint">Shown in the sidebar and portal header.</div>
            </div>
            <div className="form-field">
              <label className="flabel" htmlFor="ag-site">Website</label>
              <input id="ag-site" type="url" value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com" />
            </div>
          </div>

          {/* Color picker card */}
          <div className="profile-card">
            <div className="profile-section-title">Brand colour</div>
            <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 12px' }}>
              This colour is applied to buttons, active links, and highlights
              throughout your portal. Changes are previewed live on this page.
            </p>

            {/* Preset swatches */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PRESET_COLORS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  title={p.label}
                  onClick={() => previewColor(p.hex)}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: p.hex, border: accentColor === p.hex
                      ? '3px solid var(--ink-950)'
                      : '2px solid transparent',
                    cursor: 'pointer', transition: 'transform .1s, border .1s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.18)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  aria-label={p.label}
                  aria-pressed={accentColor === p.hex}
                />
              ))}
            </div>

            {/* Custom hex picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: 8,
                  background: accentColor, border: '1px solid var(--border)',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                }}
                onClick={() => colorInputRef.current?.click()}
                title="Open color picker"
              />
              <input
                ref={colorInputRef}
                type="color"
                value={accentColor}
                onChange={(e) => previewColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                aria-label="Custom color"
              />
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#([0-9A-Fa-f]{0,6})$/.test(v)) {
                      setAccentColor(v);
                      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)) applyTheme(v);
                    }
                  }}
                  maxLength={7}
                  placeholder="#C96E0E"
                  style={{
                    width: '100%', height: 36, border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '0 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    background: 'var(--canvas)',
                  }}
                />
                <div className="field-hint">Enter a hex code or click the swatch to open the colour picker.</div>
              </div>
              {accentColor !== NV_DEFAULT_ACCENT && (
                <button type="button" className="btn btn-ghost"
                  style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={() => previewColor(NV_DEFAULT_ACCENT)}>
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          {error  && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary"
              onClick={() => { setError(null); saveMutation.mutate(); }}
              disabled={saveMutation.isPending || !agencyName.trim()}>
              {saveMutation.isPending ? 'Saving…' : 'Save branding'}
            </button>
            {agencyProfile && (
              <button type="button" className="btn btn-ghost"
                style={{ color: 'var(--danger-700)', fontSize: 12 }}
                onClick={() => window.confirm('Reset to NV Immigration branding?') && resetMutation.mutate()}
                disabled={resetMutation.isPending}>
                {resetMutation.isPending ? 'Resetting…' : 'Reset to default'}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: live preview ──────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="profile-card">
            <div className="profile-section-title">Live preview</div>
            <p style={{ fontSize: 11, color: 'var(--ink-500)', margin: '0 0 14px' }}>
              All changes apply instantly — this is how your portal looks right now.
            </p>

            {/* Sidebar mini-preview */}
            <LiveSidebarPreview agencyName={agencyName || 'Your Agency'} logoUrl={displayLogo} accentColor={accentColor} />

            {/* Button + chip samples */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-400)', marginBottom: 8 }}>
                UI samples
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary">Primary button</button>
                <button className="btn btn-outline">Outline</button>
                <span className="chip chip-active">Active chip</span>
                <span style={{ background: 'var(--accent-100)', color: 'var(--accent-700)', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Tag pill</span>
              </div>
              <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'var(--accent-700)', width: '100%' }} />
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent-700)', fontWeight: 600 }}>Active nav link color →</div>
            </div>

            {/* Color scale */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-400)', marginBottom: 8 }}>
                Colour scale derived
              </div>
              <ColorScale hex={accentColor} />
            </div>
          </div>
        </div>
      </div>

      {/* Crop modal */}
      {showCropper && (
        <Modal title="Upload & crop logo" onClose={() => setShowCropper(false)} wide>
          <LogoCropper
            onCropped={handleCropped}
            onCancel={() => setShowCropper(false)}
            outputSize={256}
          />
        </Modal>
      )}
    </Page>
  );
}

// ── Live sidebar preview ────────────────────────────────────────────────────
function LiveSidebarPreview({ agencyName, logoUrl, accentColor }) {
  const initials = agencyName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 12px', display: 'flex',
      alignItems: 'center', gap: 10, maxWidth: 220,
    }}>
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{
          width: 30, height: 30, borderRadius: 8, objectFit: 'contain',
          border: '1px solid var(--border)', padding: 2,
          background: 'var(--canvas)', flexShrink: 0,
        }} />
      ) : (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: accentColor, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>
          {initials}
        </div>
      )}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-950)', lineHeight: 1.2, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agencyName}
        </div>
        <div style={{ fontSize: 9, color: 'var(--ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 1 }}>
          Powered by NV
        </div>
      </div>
    </div>
  );
}

// ── Color scale visualiser ───────────────────────────────────────────────────
function ColorScale({ hex }) {
  const scale = buildAccentScale(hex);
  const slots = [
    { key: '--accent-800', label: '800 (hover)' },
    { key: '--accent-700', label: '700 (base)' },
    { key: '--accent-100', label: '100 (light bg)' },
    { key: '--accent-50',  label: '50 (tint)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {slots.map(({ key, label }) => (
        <div key={key} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            height: 32, borderRadius: 6,
            background: scale[key],
            border: '1px solid rgba(0,0,0,.07)',
            marginBottom: 4,
          }} />
          <div style={{ fontSize: 9, color: 'var(--ink-400)', fontWeight: 600 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
