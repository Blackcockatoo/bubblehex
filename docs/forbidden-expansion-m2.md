# Forbidden Expansion — M2: Interface

Stacked on M1 (`expansion/m1-item-registry`). All additions are engine prototype hooks (`app/game/expansion-ui.ts`); original controls, sprites, mechanics and saves are preserved.

## Implemented
- **Animated score counter** – eased tween toward the real score (`stepShownScore`); snaps instantly with reduced motion.
- **Meters** – combo meter (bottom-left) and time / boss meter (bottom-right) drawn with the pack's `meter_combo`, `meter_time`, `meter_boss` frames, with procedural fallback.
- **Touch buttons** – `.mini-controls` buttons use pack button frames via `border-image` with normal / pressed (`:active`, `aria-pressed`) / disabled / focus-visible states; min 44px.
- **Pause tabs** – Settings · Collection · Jukebox · Theme (DOM tab bar + Q/E keys). Settings keeps every original pause control (sound, reduced motion, restart, etc.).
- **Widow's Collection** – gothic inventory grid of all 16 items: discovered icons with counts, undiscovered as `?`, selected item details.
- **Jukebox** – Auto / Stage / Title / Bonus (1 Cursed Vinyl) / Boss (2 Cursed Vinyls). Locked records show the vinyl requirement. Choice persists (`jukeboxTrack`).
- **Theme stub** – Original, Old Vic, Civilian Signal, Klein, Widow After Dark; changes the pause panel frame/accents only. Persists (`theme`).
- **Announcer** – event-driven, priority-ordered, throttled (4s global gap, 25s per-line cooldown, 1.6s display) for all 7 lines.
- **i18n** – new UI strings in en / ja / hi (`expansion-i18n.ts`).
- **Fix** – language menu button 38px → 44px (320px touch-target failure); hidden duplicate switch excluded from touch-target checks.

## Save data
Settings v6 gains `jukeboxTrack` ("auto") and `theme` ("default"), normalised on load; older saves migrate losslessly.

## Outstanding
- Item names / lore, track names and announcements remain English in ja/hi.
- Themes are a visual stub (pause panel only, not the full cabinet).
- Meters live in the narrow bottom HUD strip; in dev builds the dev label overlaps slightly.
- On portrait phones the canvas-drawn pause panels are small (whole cabinet is rotated); a DOM overlay may be better.
- No new recorded audio; jukebox reuses existing tracks. No balance playtesting.
