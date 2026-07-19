# BUBBLE HEX — Audio Manifest

Source masters supplied 2026-07-15 as 16-bit/48kHz PCM WAV. No perceptual
audition tool (speakers/playback) is available in this environment, so every
decision below is grounded in measured duration, RMS/peak loudness, and
`ffmpeg silencedetect` boundaries — never assigned from filename alone.

## Source audit

| File | Duration | Peak / RMS (dBFS) | Notes |
|---|---|---|---|
| `9ce5c2dd-Neon_Hex.wav` | 52.76s | -4.99 / -17.16 | Sustained mid-energy bed, no lead-in silence, ~0.76s natural fade tail. No clipping. |
| `12742441-Neon_Hex_1.wav` | 52.16s | -4.31 / -16.96 | Alternate take of the same composition as above — slightly hotter mix, ~1.06s fade tail. No clipping. |
| `1b791722-Neon_Hex_Jump_1.wav` | 39.80s | -5.01 / -17.82 | Distinct, shorter composition; ~0.30s fade tail. No clipping. |
| `b30f4466-BubbleHex_Jingle.wav` | 19.20s | -4.66 / -19.06 | Short jingle with a brief internal rest (~18.3–18.6s) then a final phrase; ~0.5s tail. No clipping. |
| `fe0cbb76-BubbleHex_Jingle_1.wav` | 19.12s | -4.36 / -18.04 | Alternate take of the same jingle — brighter mix, tighter ending, no internal rest detected. No clipping. |

No duplicates in the exact-file sense, but two composition pairs exist
("Neon Hex" ×2, "BubbleHex Jingle" ×2). Per instructions, each pair is used
deliberately rather than picked blindly:

- **Neon Hex** (`9ce5c2dd`) → the everyday arcade-stage loop (chambers 1–8,
  the more sustained, slightly cooler mix reads best under long play).
- **Neon Hex 1** (`12742441`) → boss approach/battle (chambers 9–12) — the
  hotter alternate mix reads as an escalation of the same theme rather than
  an unrelated track, and the existing procedural arpeggio layer
  (`musicClock` in `engine.ts`) speeds up on top of it for extra intensity
  during the Widow encounter without stacking a second full track.
- **BubbleHex Jingle** (`b30f4466`) → title screen loop (cleaner, longer
  tail, sits well under repeated looping).
- **BubbleHex Jingle 1** (`fe0cbb76`) → victory fanfare, one-shot (brighter,
  tighter ending suits a single triumphant sting rather than a loop).
- **Neon Hex Jump** (`1b791722`) → the new bonus/treasure chamber's theme —
  the one composition not otherwise used, giving the bonus room its own
  distinct identity as required.

## Processing pipeline

1. Trim to the last musically sustained point (via `ffmpeg silencedetect`),
   dropping each track's natural fade-to-silence tail so no track carries
   dead air into the loop.
2. `loudnorm` (I=-16 LUFS, TP=-1.5dB, LRA=11) to bring the five tracks to a
   consistent perceived loudness — they were already close (-17 to -19dBFS
   RMS), so this is a light touch, not a dynamics-crushing pass.
3. For the four looping tracks, a 350ms equal-power **wrap crossfade** blends
   the tail directly into the head at the sample level (`wrap_crossfade.py`),
   so native Web Audio `loop=true` playback has a smoothed seam instead of a
   hard cut. This is a deliberate compromise: the source masters were not
   authored with a bar-aligned loop point, so a perfect inaudible loop can't
   be guaranteed without stems — the crossfade prevents a harsh/clicky
   restart, which is the documented fallback for tracks that can't loop
   perfectly cleanly.
4. The victory fanfare is a one-shot: trimmed only, with a short 180ms
   fade-out for click safety (no wrap crossfade, since it never loops).
5. Encoded to OGG Vorbis (`-q:a 5`, primary for Chrome/Firefox/Android) and
   MP3 (`-q:a 3` VBR, fallback for Safari, which lacks native Vorbis
   support). Combined derivative footprint is ~7MB across both formats; a
   given browser only ever fetches one format per track, lazily.

## Delivery map

| Asset | Used for | Loop |
|---|---|---|
| `title-jingle.{ogg,mp3}` | Title screen / character select | Yes |
| `stage-theme.{ogg,mp3}` | Chambers 1–8 (Velvet Drain → Jade Garden/Crimson Chapel lead-in) | Yes |
| `bonus-theme.{ogg,mp3}` | Bonus/treasure chamber (Extra Mode) | Yes |
| `boss-theme.{ogg,mp3}` | Chambers 9–12 (Black Bubble approach + the Widow) | Yes |
| `victory-fanfare.{ogg,mp3}` | Stage clear roll-up on the final victory screen (normal and true ending) | No |

Game-over and short cheat/secret/record confirmations intentionally stay on
the existing lightweight procedural WebAudio stings (`AudioManager`'s tone
synth) — no supplied asset fit those very short, high-frequency UI moments,
and generating them keeps the SFX layer instant and dependency-free.

## Source masters

The untouched WAV masters (~34MB total) are preserved at `audio-masters/` in
the repository root — outside `public/`, so they are never bundled or served
to players — as non-destructive originals for any future remix pass.

## Addendum 2026-07-19 — per-world music, an Easter egg, and 89 voice lines

### Per-world stage variety

Three additional Suno-generated tracks ("Hexagonal Sparkle 1", "Hexagonal
Sparkle 3", "Hexagonal Sparkle Remix 2") were supplied as full-length songs,
not stings. Each was `loudnorm`'d to the same -16 LUFS / -1.5dBTP / LRA 11
target as the original five, checked for lead-in/trailing silence via
`silencedetect`, trimmed where a genuine fade tail existed (the remix only —
the other two run sustained to their natural end, matching the "Neon Hex"
pattern), and given the same 350ms equal-power wrap-crossfade loop seam
described above before OGG/MP3 encoding.

They now give three of the "stage" worlds their own flavor instead of
sharing one loop across chambers 1–8:

| Asset | Used for | Loop |
|---|---|---|
| `world-heartbreak-hotel.{ogg,mp3}` | Heartbreak Hotel (chambers 4–6) | Yes |
| `world-jade-garden.{ogg,mp3}` | Jade Garden (chambers 7–8) | Yes |
| `world-crimson-chapel.{ogg,mp3}` | Crimson Chapel (chambers 9–10) | Yes |

Velvet Drain (chambers 1–3) keeps the original `stage-theme` loop as the
game's establishing sound; `boss-theme` (Black Bubble approach + the Widow)
and `bonus-theme` are unchanged. Selection logic lives in
`BubbleHexEngine.syncMusic()` in `engine.ts`, keyed off `level.worldId`.

### Hidden Easter egg

A fourth supplied track, "Nara's Bubble 1", had no corresponding character
or level in the game — trimming a 0.42s lead-in and the standard loudness
pass was the only processing needed since it plays once, not in a loop. It
is wired to a new **hidden cheat code** (`nara` in `cheats.ts`:
`RIGHT,LEFT,RIGHT,LEFT,BUBBLE,JUMP,BUBBLE,START`, mirrorable like the
existing codes), entered the same way as the other title-screen codes. It
has no gameplay effect — it just shows a short "FOR NARA & MUM" message and
plays `nara-bubble.{ogg,mp3}` once as a private keepsake.

### 89 spoken voice lines

A performer-recorded set of 89 short lines (delivered pre-split and named,
with a manifest CSV giving verbatim text and category) now voices specific
game moments — title-screen hooks, player/enemy taunts, gameplay callouts
(trapped/chain/upgrades/boss phases/etc.), damage and low-health warnings,
boss arrival, victory/death lines, and secret discovery — 29 categories in
total, `app/game/voice-lines.ts`. Files ship as-is under
`public/game/audio/voice/` (MP3 only — no OGG pass; they were already
suitably mastered and this asset class doesn't need format fallback the way
the five/eight looping beds do).

Playback goes through a new `AudioManager.playVoice(category)`: it decodes
and caches each clip through the same shared SFX bus (so it obeys the
existing mute/SFX-volume controls with no new UI), picks a random line from
the category while never repeating the immediately previous pick, and
enforces a global cooldown spanning each line's own duration so barks never
overlap or talk over each other. Every trigger point is an existing,
already-discrete game event (state transitions, upgrade unlocks, widow
phase changes, projectile spawns, etc.) — no new gameplay mechanics were
added to host a line; where the manifest implied a mechanic the game
doesn't have (a checkpoint save/restore system), the closest existing
equivalent (world-boundary transitions) was used instead rather than
inventing one.
