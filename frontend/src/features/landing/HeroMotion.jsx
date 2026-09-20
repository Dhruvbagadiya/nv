import './HeroMotion.css';
import { prefersReducedMotion } from './useReveal.js';

/*
 * Hero motion.
 *
 * Two pieces that share one file because they share one timing scheme: the
 * ambient light behind the hero, and the headline that assembles on top of it.
 *
 * NO ANIMATION LIBRARY. The first version of this used motion/react for the
 * per-character stagger, which pulled the whole library into the landing page's
 * main chunk: 119 kB to 249 kB, a 130 kB download-parse-execute tax paid before
 * anything could paint, for an effect CSS does natively. Thirty-seven one-shot
 * character animations need a custom property and a calc(), not a runtime —
 * which is exactly how worldmap.css already staggers its country outlines.
 *
 * The animation this replaces was a cartoon aeroplane that flew past in three
 * seconds and left. It read as cheap for a reason that has a name: motion that
 * announces itself, finishes, and exits is a gag, not an atmosphere. Everything
 * here is slow, continuous, and has no visible beginning or end.
 */

/**
 * The ambient light layer. Renders nothing interactive and nothing that can be
 * focused; it exists purely to stop the hero being a flat rectangle.
 */
export function HeroAurora() {
  return (
    <div className="lp-aurora" aria-hidden="true">
      <span className="lp-aurora-blob lp-aurora-blob--1" />
      <span className="lp-aurora-blob lp-aurora-blob--2" />
      <span className="lp-aurora-blob lp-aurora-blob--3" />
      <span className="lp-aurora-sheen" />
    </div>
  );
}

/**
 * The headline, assembled one character at a time.
 *
 * `segments` is the headline split into runs that need different styling, e.g.
 *   [{ text: 'Our simple approach to ' }, { text: 'immigration', accent: true }, …]
 * rather than a single string, so the accent word keeps its own element and the
 * underline that hangs off it.
 *
 * ACCESSIBILITY. The visible characters are aria-hidden and a flat copy of the
 * text sits behind them for assistive tech. Without that, a screen reader reads
 * the headline one letter at a time — the standard failure of every split-text
 * effect, and the reason this is worth eleven lines rather than three.
 */
export function SplitHeadline({ segments, className = '' }) {
  const plain = segments.map((s) => s.text).join('');

  // Someone who asked for less motion gets the headline, not a still frame of
  // an effect: no split, no extra DOM, no per-character elements at all.
  // Decided at first render rather than corrected afterwards, so there is no
  // flash of animated text before it settles.
  if (prefersReducedMotion()) {
    return (
      <h1 className={className}>
        {segments.map((seg, i) => (
          seg.accent
            ? <span key={i} className="lp-h1-accent">{seg.text}</span>
            : <span key={i}>{seg.text}</span>
        ))}
      </h1>
    );
  }

  // One running index across the whole headline, so the stagger reads as a
  // single wave rather than restarting at each styled run. It is handed to CSS
  // as --i and turned into a delay there.
  let index = 0;

  return (
    <h1 className={className}>
      <span className="lp-split-sr">{plain}</span>
      <span className="lp-split-stage" aria-hidden="true">
        {segments.map((seg, si) => (
          <span key={si} className={seg.accent ? 'lp-h1-accent' : undefined}>
            {seg.text.split(' ').filter(Boolean).map((word, wi) => (
              <span className="lp-split-word" key={wi}>
                {Array.from(word).map((ch, ci) => {
                  const i = index;
                  index += 1;
                  return (
                    <span key={ci} className="lp-split-char" style={{ '--i': i }}>
                      {ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  );
}

/**
 * The rotating scan ring around the hero portrait. A sibling of the photo, not
 * a child, so it is not clipped by the photo's own border-radius overflow.
 */
export function HeroPhotoRing() {
  return <span className="lp-hero-ring" aria-hidden="true" />;
}
