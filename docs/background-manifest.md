# BUBBLE HEX — Background & Splash Art Manifest

## Source material

29 PNGs (1672×941) were supplied across three uploads. They split into two
unrelated sets by content, not by filename:

- **20 bright painterly fantasy vistas** (jungle temple, desert oasis, ice
  cavern, lava cave, cherry-blossom pagoda, floating islands, etc.), each with
  a hex-tiled foreground ledge and painted-on floating bubbles — a generic
  "hex platformer" background pack, not scenes built around Vesper, Jade, the
  Widow, or any of the five canon worlds.
- **9 "B$S" studio logo/splash images** (coiled snake, feathers, gold
  emblem, on black) — on-brand for BLUE $NAKE STUDIO, the developer name
  already shown in the game's top-rail header.

Both sets are preserved untouched in `art-masters/` at the repo root —
outside `public/`, never bundled or served — matching the existing
`audio-masters/` convention for source material.

## The tone problem, and the fix

BUBBLE HEX's visual grammar (`docs/bubble-hex-lore-bible.md`) is void-black
grounds with one dominant neon colour per world. The 20 fantasy vistas are
bright/daytime with none of that, and the game's existing bubbles are already
translucent circles — floating painted bubbles baked into a background would
be genuinely confusable with real, poppable gameplay bubbles.

Rather than skip them or use them as-is, `drawBackground()` in `engine.ts`
composites each one hard: the art is drawn at 38% opacity, followed by a 70%-opaque
near-black fill, followed by a 24%-opaque fill in the level's own `tint`
colour. The result keeps the source composition readable as texture/depth
(you can still make out the pagoda roofline, the jungle canopy, the lava
spires) while sitting at the same void-black-plus-one-neon-colour brightness
level as every hand-drawn procedural element already layered on top (the
Chapel's candle arches, the Garden's vine motif, Black Bubble's dashed
grid/circle, etc.) — old and new elements now read as one consistent scene
instead of two clashing art styles.

An earlier pass of this (alpha .5 / dark-overlay .45 / tint .17) still read
as daylight — the dark-overlay `fillRect` was accidentally inheriting a
stale `globalAlpha=.18` left over from the grid-line-drawing setup earlier in
the function, so it was only ~4.5% opaque instead of 45%. Fixed by wrapping
that fill in its own `save()`/`globalAlpha=1`/`restore()`.

## Chamber assignments

Velvet Drain (chambers 1–3) keeps its existing hand-picked triptych
(`velvet-drain-triptych.png`) — untouched. The other 9 chamber slots plus the
bonus vault are filled from the 20-image set, picked for content/mood fit
first and colour second (all get the same darken+tint treatment regardless,
so raw source colour matters less than composition):

| Chamber | World | Asset | Why |
|---|---|---|---|
| Room 108 | Heartbreak Hotel | `hotel-room-108` | Cherry-blossom pagoda — already pink-toned, ornate/decadent matches "faded glamour". |
| Mirror Teeth | Heartbreak Hotel | `hotel-mirror-teeth` | Gilded floating-castle sunset — grandeur reads as the hotel's stage-lit opulence. |
| Last Lift | Heartbreak Hotel | `hotel-last-lift` | Floating bridges/platforms — literal "lift" imagery. |
| Poison Moon | Jade Garden | `garden-poison-moon` | Green jungle-temple ruins — direct content match for a garden world. |
| Black Roses | Jade Garden | `garden-black-roses` | Bioluminescent mushroom forest — mist/poison mood even though its native palette is purple-teal, not green (the tint wash corrects that). |
| Serpent Glass | Crimson Chapel | `chapel-serpent-glass` | Lava cave — already red/dark, needed the least correction of any image in the set. |
| Thirteen Candles | Crimson Chapel | `chapel-thirteen-candles` | Golden honeycomb canyon with dripping resin-like formations — reads as melted wax/candlelight. |
| Event Horizon | Black Bubble | `bubble-event-horizon` | Steampunk clockwork/gear cave — "impossible grids" made literal. |
| The Widow Unveiled | Black Bubble | `bubble-widow` | Dark tech ruins, cracked neon circuitry — "broken neon" made literal. |
| The Dirty Gold Vault (bonus) | — | `velvet-bonus-vault` | Rainbow jewel/crystal cave — treasure-room content match. |

10 of the 20 fantasy images were not used and remain in `art-masters/` as
spares for a future stage or remix pass: the golden canyon, jungle-temple
alternate, purple sunset marsh, blue starry castle, desert-dune moonscape,
underwater jellyfish scene, ice aurora cavern, purple crystal cave, gold/purple
floating-island sunset, and the pastel cotton-candy sky islands (the last one
in particular is far too light/pastel to darken convincingly into this
game's palette).

## Splash art

One of the 9 B$S logo images (the coiled-snake-and-owl variant) now backs
the boot screen (`drawBoot()` in `engine.ts`), dimmed under the existing
"BLUE $NAKE STUDIO / DRESSING THE NIGHT" text and loading bar. The boot state
only holds for ~0.55s plus asset-load time, so it's a brief flash rather than
a lingering screen — verified by temporarily extending that hold to 4s
during testing, screenshotting, then reverting the change. The other 8 logo
variants are preserved in `art-masters/` as alternates (a future revision
could rotate through them, or use one for the pause/records screen).

## Format and size

All new backdrops are PNG to match this project's existing convention and
its `content.test.ts` check (`art manifest points at real PNGs with declared
dimensions`, which reads PNG magic bytes and IHDR width/height directly —
JPEG was tried first and is meaningfully smaller, but converting the test to
support a second format was a larger change than converting 11 images back
to PNG). Each of the 10 chamber backdrops is center-cropped to the
background draw box's aspect ratio (924:628) and downsized to 1200×816; the
boot logo is delivered at its native 1672×941. Combined new footprint is
about 25MB in `public/game/art/` — consistent with the existing per-image
budget set by `heroes-anchor.png` and `roster-anchor.png` (~2.2MB each).
