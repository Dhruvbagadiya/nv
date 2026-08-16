# Intro artwork

The full-screen boarding sequence on the landing page loads three files from
this folder. Until all three exist the intro is skipped entirely — the site is
unaffected, and the console notes why once.

| File | What it must be |
|---|---|
| `plane.svg` | Side view, facing **left**, **pink**, open-top with visible seating |
| `traveller.svg` | Man in a pagdi/turban, **side profile**, walking, with a suitcase |
| `couple.svg` | Man and woman, **side profile**, walking together with bags |

**Transparent background.** SVG preferred; PNG at 1000px+ wide is fine. Use the
same illustration style for all three or they will not read as one scene.

Sources with free tiers: **storyset.com** (best fit — consistent characters,
editable colours, SVG export; search `travel`, `airport`, `boarding`),
**freepik.com** (check the licence), **lottiefiles.com**.

Two things worth knowing before you pick:

- **Separate files, not one composite scene.** Each element is positioned and
  animated independently; splitting a combined illustration afterwards is
  fragile and usually looks it.
- **The plane must face left.** It flies in from the right, so a right-facing
  plane would arrive flying backwards. If yours faces right, say so — one CSS
  line flips it.

Positions are tuned in `src/styles/landing.css` under `INTRO OVERLAY`. The two
seat offsets (`.io-seat-1`, `.io-seat-2`) are percentages of the plane's own
width, so they will need nudging to match wherever the seats are in your art.
