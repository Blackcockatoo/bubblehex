# Forbidden Expansion — M3: Living Bubbles

Stacked on M2 (`expansion/m2-interface`). Pure rules live in `app/game/living-bubbles.ts`;
engine hooks in `app/game/living-expansion.ts` (same prototype-hook pattern as M1/M2).

## Original gameplay preserved
With NORMAL ammo selected (the default, and whenever charges run out) `fireBubble` calls the
original method untouched; no metadata, effects or personalities are created. Tested.

## Special ammo (11 types, pack `bubble_*` sprites + code-drawn effects)
| Ammo | Effect |
|---|---|
| Venom | Pop releases a toxic cloud: nearby free enemies slowed 3s |
| Thunder | Pop arcs to ≤3 extra trapped bubbles within 240px (bolts) |
| Frost | Trapped prey held ×1.5 longer; pop freezes enemies within 150px for 2.5s |
| Mirror | Fires a reflected twin behind you |
| Inferno | Faster shot; pop stuns nearby enemies 1.5s and +200 per enemy (capped bonus) |
| Gravity | Pulls nearby bubbles together for bigger chains |
| Phantom | Slips through the side walls; lasts ×1.3 |
| Time | Pop adds +2s (≤12s per stage) and slows every enemy 2s |
| Recursive | Pop divides into 2 hunting bubbles (depth ≤2) |
| Widow | Wide web capture radius; prey held ×1.3 longer |
| Klein | Pop adds 50% kill score as capped bonus and a reborn bubble on the mirrored side |

*Venom ammo is separate from the VENOM letters and venom mastery upgrade* — its state lives in the M3 runtime and never reads or writes `engine.venom` / `upgrades.venom`.

### Getting and selecting ammo
- Popped enemies may drop an **ammo orb** (18% chance, ≥3 kills apart, ≤1 on field, ≤4 per stage; types gated by stage). Each orb gives 2 charges.
- Inventory: ≤3 charges per type, ≤9 total. First ammo collected is auto-selected; empty ammo falls back to NORMAL.
- **Switch ammo:** `V` / `S` / `↓` cycles NORMAL → owned types; on touch, tap the ammo chip (top-left of the screen, ≥44px button, only shown while ammo is owned).
- HUD chip shows the selected sprite, name, charge pips and total (only drawn when ammo is owned).
- Ammo is per-run, not saved (no save-format change).

## Personalities (all 11)
Procedurally assigned (deterministic hash of bubble id + stage) to special-ammo shots only:
Coward (repel from player), Glutton (merge empty bubbles, grows ≤30px), Lover (attract), Parasite (latch beside a trapped bubble so it joins the chain), Mimic (disguise: copies a nearby special type once), Jester (jitter), Sleeper (still for 2.5s), Mother (divide: buds ≤2 empty bubbles, every 3s), Vampire (drains life from empty bubbles, ≤8s), Ouroboros (circles its birthplace), Impostor (disguise: looks normal until it traps).
Glyph badge on each living bubble shows its personality.

## Bounds (`LIVING_LIMITS`)
- Global cap 24 bubbles for every expansion spawn (children, mirror twins, buds); a special shot over the cap falls back to one normal bubble and keeps its charge.
- ≤2 children per parent; recursion depth ≤2 (one Recursive shot ≤7 bubbles total).
- Thunder ≤3 jumps; bonus score ≤3000 per chain and ≤20000 per stage; time ≤12s per stage.
- Steering ≤70px/s; statuses ≤3s; ≤12 code-drawn effects; engine particle cap unchanged.
- Reduced motion: static accents, shortened effects, no jitter amplitude beyond 15px/s.

## Tests
- `tests/living-bubbles.test.ts` (11): registry, inventory caps/cycle, drop caps, child/depth/global caps, finite recursion tree, bonus/time ledgers, thunder bound, status clamp, personality determinism, steering bounds and merge/divide/attract/repel.
- `tests/living-engine.test.mjs` (10): original shot unchanged without ammo, ammo variant + VENOM isolation, V cycling, mirror + orb drop/collect, recursion bounds in-engine, global cap refusal, thunder bound, frost freeze + time cap, per-stage bonus cap, 4000-tick stress run.

## Outstanding
- Gamepad has no ammo-switch binding yet (keyboard + touch only).
- Ammo / personality names are English in ja/hi (aria label text is localised).
- Living bubble types are not yet recorded in the Widow's Collection.
- No balance playtesting; drop rates and effect strengths are first-pass.
- Special effects use code-drawn rings/bolts; the pack's effect atlas frames are not yet used for them.
