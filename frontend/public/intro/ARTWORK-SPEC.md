# Character artwork spec — traveller & couple

## Why the current files don't work

`traveller.png` and `couple.png` are 1408×768 RGBA. They *have* an alpha channel,
but **every pixel is alpha 255** — nothing is transparent. The image editor's
grey-and-white transparency checkerboard was rasterised into the RGB pixels:

```
traveller.png  top-left pixel = RGB(201,201,201) alpha=255
couple.png     top-left pixel = RGB(204,204,204) alpha=255
```

That is why both render as grey rectangles sitting on the page. The alpha channel
is present and unused. `plane.svg` is fine because a vector has no background at
all — which is why the plane looks right and the characters don't.

**This has now failed twice with AI-generated PNGs.** The cause is always the
same: you ask a model for "a transparent background" and it *draws* the
checkerboard, because that is what transparency looks like in every screenshot it
was trained on.

## Best option — ask for SVG

The plane works because it is an SVG. Ask for the same thing:

> Draw a flat-vector cartoon illustration as a single inline SVG. No background
> rectangle of any kind — the SVG must be transparent. Use a viewBox, flat fill
> colours only, no gradients, no filters, no embedded raster images.

If you get an SVG, the size does not matter at all — it scales cleanly. Just send
me the file.

## If you use PNG instead

### Dimensions

| File | Canvas | Figure |
|---|---|---|
| `traveller.png` | **600 × 1000 px** (portrait) | one man with a suitcase |
| `couple.png` | **1100 × 1000 px** (landscape) | two people side by side, with bags |

**Both files must use the same 1000px height, and the characters must be drawn to
the same height inside it.** That is what makes the traveller and the couple come
out at matching scale in the animation without any per-file tuning.

### Placement inside the canvas

- Figure height: **940 px** of the 1000 (a 30 px margin top and bottom)
- Feet on the **bottom** edge: lowest pixel of the shoes at **y = 970**
- Horizontally centred
- Facing **right** (they walk in from the left edge of the screen)

### Format

- PNG-24 with a **real alpha channel**
- Background must be genuinely empty — not white, not grey, not a checkerboard
- Do **not** run it through TinyPNG or any "compress PNG" tool. That converts it
  to a palette PNG and drops the alpha, which is what broke the last attempt.

### How to actually get transparency out of an AI image generator

Do not ask for a transparent background. Ask for a **solid flat background in a
colour that appears nowhere in the character**:

> ...on a solid pure magenta (#FF00FF) background, flat single colour, no shadows
> on the background.

Then remove that colour with **remove.bg** or **Photopea** (Magic Wand → select the
magenta → Delete → Export As → PNG). Magenta is the right choice because no skin
tone, fabric or luggage colour is anywhere near it, so the edges come out clean.

## Style, to match plane.svg

- Flat vector cartoon, thick clean outlines, **no gradients, no realistic shading**
- Slightly oversized heads (cute/chibi proportions) — they read better small
- Warm palette that sits beside the brand orange `#E78518`
- Traveller: Indian man in a **pagdi/turban**, side profile, mid-stride, pulling a
  suitcase
- Couple: a man and a woman, side profile, walking together, carrying bags
- Same illustration style across both files, or they won't read as one scene

## What happens after you send them

The animation sizes characters relative to the plane, so I only need to change two
lines. Current values, for reference:

```
--plane-w:  clamp(180px, 32vw, 440px)   /* 440px on a 1440px screen */
--person-w: calc(var(--plane-w) * 0.52)
```
