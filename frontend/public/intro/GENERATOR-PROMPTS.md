# Ready-to-paste image-generator prompts

Generate **both images in the same session**, one after the other, so the model
carries the style across. Do the traveller first, then say "same style, same
character proportions" before the couple prompt.

---

## Generator settings

| | Traveller | Couple |
|---|---|---|
| Aspect ratio to select | **3:5 portrait** (or 9:16 if that's all you get) | **1:1 square** |
| Generate at | 1024 × 1712 or larger | 1024 × 1024 or larger |
| Final canvas after cut-out | **600 × 1000 px** | **1100 × 1000 px** |
| Target file size | **≤ 300 KB** (hard max 600 KB) | **≤ 350 KB** (hard max 600 KB) |

Generate **larger** than the final canvas and scale down at the end — downscaling
keeps edges crisp, upscaling does not. Flat cartoon art with no gradients
compresses very well, so 300 KB is comfortable; the current broken files are
1.6 MB each, which is roughly 5× more than this scene should ever cost.

---

## Prompt 1 — traveller

```
Flat vector cartoon illustration of a cheerful Indian man walking to the right,
shown in full side profile. He wears a bright orange pagdi (Sikh-style turban),
a warm cream kurta and dark trousers, and pulls a small rolling suitcase with his
right hand. Cute chibi proportions: slightly oversized head, short rounded limbs,
friendly smiling expression.

Style: modern flat vector illustration, thick clean uniform outlines, solid flat
fill colours only, absolutely no gradients, no realistic shading, no texture, no
drop shadows. Warm palette built around orange #E78518, cream and deep navy.

Composition: full body, standing upright, mid-stride walking pose. The figure
fills the frame vertically — top of the turban near the top edge, soles of the
shoes touching the bottom edge. Centred horizontally.

Background: solid pure magenta #FF00FF, one flat colour, completely empty, no
shadow cast on the background, no ground line, no scenery, no props other than
the suitcase.
```

## Prompt 2 — couple

```
Same illustration style, same character proportions and same line weight as the
previous image.

Flat vector cartoon illustration of a young Indian couple walking to the right,
shown in full side profile, side by side. The man wears a teal shirt and dark
trousers and carries a shoulder bag; the woman wears a warm orange kurti and
carries a small handbag. Both smiling, cute chibi proportions with slightly
oversized heads and short rounded limbs.

Style: modern flat vector illustration, thick clean uniform outlines, solid flat
fill colours only, absolutely no gradients, no realistic shading, no texture, no
drop shadows. Warm palette built around orange #E78518, teal, cream and deep navy.

Composition: both figures full body, standing upright, mid-stride walking pose,
overlapping slightly so they read as one group. THE TWO FIGURES MUST BE THE SAME
HEIGHT AS THE MAN IN THE PREVIOUS IMAGE — heads near the top edge, shoes touching
the bottom edge. The pair is centred horizontally.

Background: solid pure magenta #FF00FF, one flat colour, completely empty, no
shadow cast on the background, no ground line, no scenery.
```

---

## After generating — the part that has broken twice

1. **Do not ask the model for a transparent background.** It will draw the grey
   checkerboard as real pixels, which is exactly what is wrong with the current
   files. The magenta is there so you can cut it out yourself.
2. Remove the magenta:
   - **Photopea** (free, browser): open image → Magic Wand → click the magenta →
     set Tolerance ~30 → Delete → *File ▸ Export As ▸ PNG*
   - or **remove.bg** — one click, but check the turban and bag edges afterwards
3. Resize to the final canvas in the table above, with the figure's feet at
   **y = 970** and a ~30 px margin at the top.
4. **Do not run it through TinyPNG or any PNG compressor.** That converts to a
   palette PNG and throws the alpha channel away — that is what killed the last
   attempt. If the file is over 600 KB, reduce the pixel dimensions instead.
5. Sanity check before sending: open the PNG in a browser on a **dark** page. If
   you see any grey, white or magenta rectangle around the character, the cut-out
   did not work.

---

## Still the better route: ask for SVG

If your tool can output SVG (Gemini did for `plane.svg`), use this instead and
skip every step above — no background to remove, no file-size budget, no
resizing:

```
Output a single inline SVG, flat vector cartoon style, thick uniform outlines,
solid flat fills only, no gradients, no filters, no embedded raster images, and
NO background rectangle of any kind — the SVG must be fully transparent. Use a
viewBox. [then paste the character description from the prompt above]
```
