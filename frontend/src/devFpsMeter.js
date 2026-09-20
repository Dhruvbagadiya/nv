/*
 * On-screen frame-rate meter, for diagnosing jank without DevTools.
 *
 * Open any page with ?fps on the URL — e.g. http://localhost:4173/?fps — and a
 * small readout appears in the top-left. Without that parameter this function
 * returns on its second line and nothing is created, so the cost on a normal
 * page load is one URLSearchParams lookup.
 *
 * WHY THIS EXISTS RATHER THAN A CONSOLE SNIPPET. Chrome refuses the first paste
 * into its console — it demands you type "allow pasting" first — which makes
 * "just paste this in the console" a genuinely awkward instruction to give
 * someone. This needs no typing and no DevTools at all.
 *
 * WHAT THE NUMBERS MEAN
 *   fps     frames per second, averaged over the last second. 55-60 is healthy.
 *   p95     the 95th-percentile frame time. This is the number that matters:
 *           an average can look fine while one frame in twenty takes 60ms, and
 *           that hitch is what a person actually feels. Under ~20ms is smooth.
 *   janky   how many of the last 180 frames took over 20ms.
 *
 * The meter measures the frames the browser actually delivers, so it costs one
 * requestAnimationFrame callback per frame and never forces layout or paint.
 */

const SAMPLE = 180;   // ~3 seconds at 60fps
const JANK_MS = 20;   // a frame slower than this is a visible hitch

export function installFpsMeter() {
  if (typeof window === 'undefined') return;
  if (!new URLSearchParams(window.location.search).has('fps')) return;

  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = [
    'position:fixed', 'top:8px', 'left:8px', 'z-index:2147483647',
    'padding:6px 10px', 'border-radius:8px',
    'background:rgba(0,0,0,.82)', 'color:#0f0',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'white-space:pre', 'pointer-events:none',
    'text-shadow:0 0 2px #000',
  ].join(';');
  document.body.appendChild(box);

  const times = [];
  let last = performance.now();

  const tick = (now) => {
    times.push(now - last);
    last = now;
    if (times.length > SAMPLE) times.shift();

    // Repaint the readout about twice a second. Writing textContent every frame
    // would make the meter itself a source of the jank it is measuring.
    if (times.length > 20 && times.length % 30 === 0) {
      const sorted = [...times].sort((a, b) => a - b);
      const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const janky = sorted.filter((t) => t > JANK_MS).length;
      const fps = 1000 / mean;
      box.style.color = fps > 50 ? '#3f6' : fps > 35 ? '#fc3' : '#f55';
      box.textContent =
        `fps   ${fps.toFixed(1)}\n`
        + `p95   ${p95.toFixed(1)}ms\n`
        + `janky ${janky}/${sorted.length}`;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
