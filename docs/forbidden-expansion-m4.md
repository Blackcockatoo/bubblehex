# Forbidden Expansion — M4: Familiars

Stacked on M3 (`expansion/m3-living-bubbles`). Pure rules: `app/game/familiars.ts`; engine hooks: `app/game/familiar-expansion.ts`.

## Familiars
| Familiar | Moves | Idle | Assist (cooldown) | Unlock |
|---|---|---|---|---|
| Hex Cat | prowls behind you | grooms, tail flick | Nine Lives: +1.5s post-hit safety (1×/chamber) | Clear 1 chamber |
| Blue $nake | slithers (sway) | coils, tastes air | Coil: bubble about to burst +1s (15s, ≤4/chamber) | Discover 4 items |
| Nevermore | hops, long hops when far | pecks | Omen: croaks the chamber secret clue after 20s (1×/chamber) | Find a secret |
| Boo | drifts and bobs (flier) | bobs, blushes | Spook: freezes an enemy within 80px for 1s (18s) | Pop a 5-chain |
| Velvet | skitters in bursts | dangles | Silk Line: reels in the pickup closest to vanishing within 280px (14s) | 2 perfect clears |
| Vamp | flutters figure-8 (flier) | hangs | Drain: 3+ chain gives +3s, never above chamber time (20s, ≤3/chamber) | Clear 6 chambers |

Drawn from the pack's 4 idle frames (`familiar_frames` atlas) with code-drawn transforms: squash on landing, tilt when hurt, droop on death, bob while walking, Zzz, hearts, sweat drop, tear, "!" and a small speech tag for assists.

### State machine
`idle · follow · sleep · celebrate · react`, with priority (death > hurt > big chain > clear/unlock > combo > assist/startle).
- **Sleep:** hero still for 6s → sleeps (Zzz); moving again → startled awake.
- **Celebrate:** chain of 2+ (combo), 5+ (big chain, hearts), chamber clear, unlock.
- **React:** hurt (sweat + shake), death (sad, droop), shield break (startle).

### Never in the way
Drawn on the world layer right after platforms — behind rewards, bubbles, enemies and the hero; no collision; stays inside the playfield and below the HUD. No assists in attract mode or with assists off (**cosmetic mode**).

## Unlocks, selection, save v7
- Deterministic milestones from existing save data (chambers cleared, items discovered, secrets, perfect clears) plus new `bestChain`.
- First unlock auto-equips; afterwards the choice persists (or "none").
- Save v7 adds `familiars: {unlocked, selected, assists, bestChain}`; v5/v6 saves migrate losslessly (tested); unknown ids from newer builds are kept.

## Pause menu / Collection
New **FAMILIARS** pause tab (Widow's Collection · Familiars n/6): ← → choose, BUBBLE equip/remove, JUMP toggles assist/cosmetic mode. Locked cards show progress and the unlock hint. The Collection header also shows `FAMILIARS n/6`. On phones the 5 tabs use compact labels (full accessible names).

## Title
Up to 3 unlocked familiars wander along the bottom of the title screen (a dim Hex Cat teaser when none are unlocked); still under reduced motion.

## Also
- Gamepad: Y / △ (button 3) cycles special ammo (M3 follow-up).

## Reduced motion
Idle frame loop frozen on frame 0, no squash/bob/shake, static overlays, title walkers stand still.

## Tests
- `tests/familiars.test.ts` (8): registry, unlocks, assist clock (cooldown, per-chamber, attract, cosmetic), follow bounds/speed, sleep/wake, event priority, reduced motion, title walkers.
- `tests/familiar-engine.test.mjs` (10): unlock + auto-equip + save, 5-chain → Boo, hurt/death + Nine Lives once per chamber, Velvet silk (cooldown, cosmetic, attract), Snake coil, Vamp drain cap, Boo spook, Nevermore omen once, sleep in engine, pause tab equip/remove/assist toggle persisted, title walkers, gamepad ammo cycle.
- `tests/expansion-save.test.ts`: v5→v7 and v6→v7 lossless, v7 round-trip, corrupted familiars.

## Outstanding
- Familiar names / hints / assist text are English in ja/hi (tab labels and UI chrome are localised).
- Wardrobe slots (crown, boots, …) not started.
- Familiars do not interpolate between 60 Hz ticks (minor judder on high-refresh screens).
- Assist balance not playtested.
