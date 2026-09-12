import { Component } from 'react';
import Icon from './Icon.jsx';

/**
 * The app had none of these, anywhere.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, so
 * one bad row in one panel emptied `#root` to white with the URL still sitting
 * on the page the user thought they were looking at. The blast radius was the
 * problem: PartnerShell wraps every partner AND admin route, so the crash took
 * the header, the sidebar and the toast stack with it. The user did not get a
 * broken panel with working navigation — they got a white page and no way out
 * but a manual reload.
 *
 * Placed around each shell's content rather than only at the root, so the nav
 * survives and "go somewhere else" stays available. The root gets one too, as a
 * backstop for anything thrown outside a shell.
 *
 * Still a class component because `getDerivedStateFromError` and
 * `componentDidCatch` have no hook equivalent — this is the one thing React
 * still has no function-component API for.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Without this the boundary is QUIETER than the white page it replaces: the
    // crash would be caught, rendered as a tidy message, and leave no trace in
    // the console for anyone debugging it.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <span className="e-icon e-icon--danger" aria-hidden="true">
          <Icon name="alert" size={20} />
        </span>
        <h3>{this.props.title ?? 'Something went wrong on this screen'}</h3>
        <p>
          The rest of the app is still working — use the menu to go elsewhere, or try this
          screen again.
        </p>

        <div className="error-boundary__actions">
          {/* Clearing the error re-renders the same children. That is enough for
              a transient failure and harmless for a persistent one, which simply
              throws again and lands back here. */}
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>

        {/* The message is the one thing that makes a bug report actionable, and
            it is safe to show: these are our own exceptions, not the server's. */}
        {error.message && <pre className="error-boundary__detail">{error.message}</pre>}
      </div>
    );
  }
}
