# davi — visual artist

A paper-collage portfolio rebuilt from the reference mockup as a real,
responsive site. No build step, no framework, no external requests.

```
index.html      markup + the position data for every scrap
style.css       tokens, the collage stage, the cut-paper lettering, motion
script.js       reveal, parallax, cursor, expandable cards
assets/         15 cut-outs (WebP with real alpha) + 2 animated wordmarks
fonts/          6 self-hosted woff2 families, latin subset — 212 KB
```

## Running it

Open `index.html`. It works straight from disk; serving it over any static
server (`npx serve`, `python3 -m http.server`) is closer to production.

## How the collage works

Each scrap is a `.piece` placed by percentage on a `.stage` that carries a
fixed `aspect-ratio`, so the whole composition scales as one object instead of
reflowing at every width. `container-type: size` on the stage means the
typography inside scales with it too (`cqw` units), which is why the text keeps
its position on the paper at any desktop size.

Three nested layers per scrap, so transforms never fight each other:

| layer          | owns                                    |
| -------------- | --------------------------------------- |
| `.piece`       | placement + pointer/scroll parallax      |
| `.piece__float`| the perpetual idle drift (CSS animation) |
| `.piece__art`  | resting angle + hover response           |

Position, angle, drift speed and parallax depth live in custom properties on
each `.piece` in the HTML (`--x --y --w --rot --dur --delay --amp --spin
--depth`). Moving a scrap means changing two numbers, not touching the CSS.

Below 980px the canvas stops being a canvas: tablets get a two-column board,
phones a single column, both with the angles softened to 45% (`--straighten`).
Shrinking the 1438px composition instead would have made the type illegible
long before it made the layout wrong.

## Editing the content

- **Text on a scrap** — all of it is real HTML inside the `.piece`. The text
  box on each card is positioned with `--bx / --by / --bw` (see `.piece--flip`,
  `.piece--taped`, `.piece--contact` in `style.css`), because the tape, the clip
  and the tear each eat into a different corner.
- **Contact links** — `index.html`, `.links`. Placeholders are marked with a
  comment; replace the three `href` values.
- **The wordmark** — `davi` and `VISUAL ARTIST` are the animated ransom-letter
  sequences, converted from the source GIFs to animated WebP. Each sits in a
  `<picture>` that swaps to a single still frame under
  `prefers-reduced-motion` — the one thing CSS cannot pause. Swapping either
  one means replacing the `.webp` pair and, if the proportions change, the
  `--w` on its `.piece`.
- **A different photo** — replace `assets/photo-davi.webp`. It is cropped to
  the polaroid aperture with `object-fit: cover`; nudge `object-position` in
  `.polaroid__photo` if the framing needs it.

## Assets

The original PNGs had solid black backgrounds. They were re-cut with real alpha
(silhouette fill for paper, luminance for the chalk scribbles) and encoded as
WebP. Real transparency is what lets the scraps overlap and take a drop shadow
on hover.

Three things decide how sharp they look:

**Source.** The mockup renders the large papers at roughly 3x the size of the
exported element PNGs — and it carries the fibre to match, because it was built
from bigger originals. So `paper-holes`, `grid-black`, `grid-white` and
`paper-black-tape` are cut from the mockup itself, de-rotated back to upright,
and refitted into the exact canvas geometry of the file they replace, which is
why none of the page's positions or text boxes had to move. `grid-spiral` keeps
its element PNG: the mockup crops its binding and clip at the page edge.

**Size.** Every asset is now rendered at 2x the size it is actually drawn at.
The previous set was a flat 2x of each source regardless, so the biggest sheet
was being enlarged *again* by the browser — it was showing at 0.65x its own
pixels before a retina display even doubled that.

**Detail.** Enlarging attenuates high frequencies, and for a photograph of
paper the high frequencies *are* the fibre. Rather than denoise and invent
texture, the source's own residual is lifted to the target size and its
amplitude put back to what it measured before the resize — weighted so it lands
only on flat areas. Across a punched hole or a torn rim an upscaled high-pass
is ringing, not fibre, and leaving it there produced visibly blocky, haloed
edges.

The two lettering GIFs were cropped to the bounding box the letters actually
travel through across all 15 frames, then re-encoded as animated WebP:
2.87 MB down to 424 KB, with no visible loss. They keep their black background
on purpose — the page is `#000`, so a tight crop is indistinguishable from
transparency and costs nothing to decode.

## Notes

- `prefers-reduced-motion` disables drift, parallax, reveal and the custom
  cursor; everything lands in its final state.
- The custom cursor only appears for fine pointers, and only after the first
  real pointer move.
- The wordmark animations loop on their own clocks (3.7s and 6.7s), so they
  drift out of sync with each other rather than pulsing together.
- Cards expand in place: the detail text is always in the layout, so opening one
  never shifts the board.
