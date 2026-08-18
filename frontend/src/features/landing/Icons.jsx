/*
 * The landing page's icon set moved to src/components/ui/Icon.jsx when the
 * portal adopted the same convention — one registry for the whole app, so the
 * two cannot drift apart. This re-export keeps the landing imports working.
 *
 * New icons go in the shared registry, not here.
 */
export { default, ICON_NAMES } from '../../components/ui/Icon.jsx';
