import { useToast } from '../../store/useToast.js';
import Icon from './Icon.jsx';

const TONE_ICON = { success: 'check', error: 'alert', info: 'info' };

// Mounted once, at the app root. aria-live="polite" so a screen reader is told
// what happened without interrupting whatever it is currently reading — these
// are confirmations, not alerts that demand the user stop what they are doing.
export default function ToastStack() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="toast__icon">
            <Icon name={TONE_ICON[t.tone] ?? 'info'} size={17} />
          </span>
          <span>{t.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
