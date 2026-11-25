# Bubble Hex — example asset kit v0.1

100 asset entries; each has editable SVG and transparent 2x PNG. Includes 16 collectibles, 12 bubbles, 6 familiars plus 24 illustrative idle frames, 8 props, UI elements and 5 pop frames.

- `DEVELOPMENT_PROMPT.md`: comprehensive implementation brief.
- `manifest.json`: stable IDs, dimensions, paths and animation sequences.
- `svg/`, `png/`: individual assets.
- `atlases/`: grouped PNG atlases and JSON frame coordinates (2x raster pixels, top-left origin, 256px cells).
- `preview.html`: offline gallery after unzipping; `preview.png`: contact sheet.

These are original vector-style visual prototypes, not the game's original sprites or finished pixel art. Familiar animation frames use simple vertical bobbing, not articulated movement. UI backgrounds are deliberately text-free; engine should draw labels, scores and meter fills. Assets are not yet integrated into or tested against the live game. No audio or runnable game code is included. Use the current game's renderer and asset conventions when integrating. The art direction uses violet, magenta, jade, antique gold and silver on deep velvet.
