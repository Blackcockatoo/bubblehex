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
| `stage-theme.{ogg,mp3}` | Velvet Drain (chambers 1–3) | Yes |
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

## 2026-07-19 addition: per-world stage themes

Four new MP3 masters were supplied ("Hexagonal Sparkle" 4 & 5, and their
"Remix" 4 & 5 counterparts), pre-mixed at 48kHz stereo. As with the original
batch, no perceptual audition tool exists in this environment, so tempo,
spectral brightness (centroid/rolloff), RMS energy, and chroma similarity
were measured (`librosa`) rather than guessed from filenames.

| File | Duration | Tempo | Centroid (brightness) | Notes |
|---|---|---|---|---|
| `1792769a-Hexagonal_Sparkle_4.mp3` | 19.37s | ~92 BPM | 2439 Hz | Mellowest/slowest of the four; sustains cleanly to the end, no fade tail. |
| `466a516b-Hexagonal_Sparkle_5.mp3` | 20.95s | ~152 BPM | 2433 Hz | Fastest and most keyed-up of the four; short natural fade at the very end. |
| `b585cf8f-Hexagonal_Sparkle_Remix_5.mp3` | 37.39s | ~108 BPM | 2702 Hz | Mid tempo, brighter mix; ~0.35s fade tail from 37.0s. |
| `e75c9aa2-Hexagonal_Sparkle_Remix_4.mp3` | 72.67s | ~129 BPM | 2977 Hz | Longest and brightest/most energetic; sustains to the end (soft ~19dB dip in the closing bars, no hard cut). |

Before this addition, chambers 1–10 (Velvet Drain, Heartbreak Hotel, Jade
Garden, Crimson Chapel — every world before the final Black Bubble boss
approach) all shared the single `stage-theme` loop. Three of the four new
tracks close that gap with one distinct theme per intervening world, chosen
so tempo/brightness escalate in the same order the story escalates toward
the Widow:

- **Velvet Drain** keeps `stage-theme` (the original arcade-stage loop) as
  the game's "home" identity track for its opening world.
- **Heartbreak Hotel** → `hotel-theme` (`1792769a-Hexagonal_Sparkle_4`, the
  mellowest/slowest track) — fits the faded-glamour, mirrors-and-secrets mood
  of Room 13 better than a high-energy cue would.
- **Jade Garden** → `garden-theme` (`b585cf8f-...-Remix_5`, mid tempo/energy)
  — the VENOM reveal is a rising complication, not yet the climax.
- **Crimson Chapel** → `chapel-theme` (`e75c9aa2-...-Remix_4`, the
  longest/brightest/most energetic track) — the staged fight becomes
  undeniable here, immediately before the Black Bubble `boss-theme`, so this
  is the most intense of the three new cues.
- **`466a516b-Hexagonal_Sparkle_5`** (fastest tempo, ~152 BPM) is the one
  track left unused: its energy actually exceeds the Crimson Chapel cue,
  which would invert the intended escalation if slotted into an earlier
  world. It's preserved untouched in `audio-masters/` alongside the other
  three as a spare for any future remix or new mode.

Processing mirrored the original pipeline: `loudnorm` (I=-16 LUFS, TP=-1.5dB,
LRA=11), a 350ms equal-power sample-level wrap crossfade for seamless
`loop=true` playback (tail folded into head, track shortened by one crossfade
length), then encoded to OGG Vorbis (`-q:a 5`) and MP3 (`-q:a 3` VBR), same as
every other looping track in the delivery map above.

| Asset | Used for | Loop |
|---|---|---|
| `hotel-theme.{ogg,mp3}` | Heartbreak Hotel (chambers 4–6) | Yes |
| `garden-theme.{ogg,mp3}` | Jade Garden (chambers 7–8) | Yes |
| `chapel-theme.{ogg,mp3}` | Crimson Chapel (chambers 9–10) | Yes |

## 2026-07-19 addition: voice-line barks

An 89-clip voice pack (`Bubble_Hex_Voice_Lines_SPLIT_AND_NAMED.zip`, pre-split
and named per line with an accompanying manifest of exact in/out timestamps)
was supplied for gameplay barks. These are generic arcade quips ("bubble
boy", "the Hex", boss/victory/death stings) rather than Vesper/Jade/Widow
dialogue, so they're used as an announcer/hero-voice layer over the existing
music and procedural SFX, not as canon character lines.

79 of the 89 clips map onto real game events and are wired into
`app/game/voice.ts` / `AudioManager.playVoice()`. The other 10 — all in the
"GAMEPLAY_CALLOUT" category — reference mechanics BUBBLE HEX doesn't have
(checkpoints, an "ability charge" meter, gradual shield "weakening",
proximity warnings for secrets/treasure/projectiles/danger, a boss "final
phase") and were left out entirely rather than mapped to the nearest-sounding
event, which would have taught players a false mental model of the game's
systems. They're still preserved in the original zip if a future mechanic
makes one of them true.

Playback is a single-voice channel layered onto the existing SFX bus (so the
mute/SFX-volume controls already cover it): only one bark plays at a time,
a new trigger while one is still speaking is dropped rather than queued, and
each category avoids repeating its immediately-previous line. No dual-format
encode — one-shot spoken barks don't need the loop-safe OGG/MP3 treatment
music does, and MP3 alone covers every target browser.

| Category | Clips | Trigger |
|---|---|---|
| `startScreen` | 5 | Title screen after boot, or after a game over / victory reset (not attract-mode loops, to avoid spamming an idle demo) |
| `playerTaunt` | 14 | ~40% chance on a 3–5 bubble chain pop |
| `enemyTaunt` | 10 | An enemy escapes its bubble and turns furious |
| `trapped` | 1 | The first enemy trapped in a stage |
| `megaChain` | 1 | A 6+ bubble "HEARTBREAK" mega-combo |
| `doubleJump` | 1 | The first double jump performed all session |
| `rapidFire` | 1 | The rapid-fire (LIGHTNING CANDY) power-up |
| `rangeUp` | 1 | The range (HEART RANGE) power-up |
| `hurryUp` | 1 | The level timer hits zero and HURRY begins |
| `bossArmourBroken` | 1 | The Widow staggers from a hit (not yet defeated) |
| `playerDamage` | 7 | Player takes damage with 2+ lives remaining |
| `lowHealth` | 5 | Player takes damage down to their last life |
| `bossArrival` | 8 | A boss stage loads |
| `victory` | 7 | Stage clear, without a secret found |
| `deathRestart` | 7 | Final life lost — game over |
| `secret` | 7 | Stage clear with a Jade Door secret found (not the final stage) |
| `finalSecret` | 2 | The final stage's secret found |
