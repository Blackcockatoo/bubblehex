# Forbidden Expansion — M1: collectible item engine

Status: implemented on branch `expansion/m1-item-registry`. Feature flag: `FORBIDDEN_EXPANSION_ENABLED` in `app/game/forbidden-expansion.ts`.

## Files
- `app/game/items.ts` — data-driven registry (16 items), rarity weights, drop rules, score ledger, timed-effect state, discovery bookkeeping. Pure; unit tested.
- `app/game/expansion-assets.ts` — manifest-driven loader for `public/game/expansion/` (items + effects atlases, rarity badges). Falls back to procedural glyphs.
- `app/game/forbidden-expansion.ts` — installs onto `BubbleHexEngine.prototype` (same pattern as `runtime-upgrades.ts`); every hook calls the original method.
- `app/game/persistence.ts` — save schema v6 adds `collection.items` (id → count); v5 and older migrate losslessly.
- `public/game/expansion/` — asset pack v0.1.0 (SVG, 2x PNG, atlases, manifest).

## Rules and limits (`ITEM_LIMITS`)
- At most 2 expansion pickups on the field, 4 per stage attempt, at least 2 kills between drops; 20% chance per kill (Wicked Clover: 40% max).
- Item score capped at 15,000 per stage attempt; Widow Cherries pop bonus (+50%) capped at 5,000 per stage attempt.
- Lives cap 5 (Broken Heart). Vanity Mirror echo skipped when 18+ bubbles exist.
- No drops in attract mode. Timed effects refresh (never stack) and clear on death, stage load/restart, checkpoint restore and return to title.
- Expansion rewards use kind `HEX_ITEM` + `itemId`; native CHERRY/RING/PERFUME… drops and VENOM letters are untouched.

## Items
| Item | Rarity | Effect | Status |
|---|---|---|---|
| Poison Apple | common | +500 | implemented |
| Widow Cherries | common | pop score +50% for 12s (capped) | implemented |
| Forbidden Perfume | uncommon | reward magnet 10s | implemented |
| Broken Heart | rare | +1 life (max 5), else +1000 | implemented |
| Serpent Ring | uncommon | bubbles +45% life, +15% speed for 15s | implemented |
| Widow's Key | rare | +1500, collected key | collection-only (secret doors: M6) |
| Dead Rose | rare | enemies half speed 4s | implemented |
| Cursed Vinyl | cursed | +666, collected record | collection-only (jukebox: M2/M6) |
| Black Pearl | legendary | +5000 | implemented |
| Golden Fang | rare | +750, counted | implemented |
| Widow's Eye | rare | marks enemies 6s | implemented |
| Stolen Minute | uncommon | +15s (capped at stage time, not in boss) | implemented |
| Deadly Kiss | cursed | untouchable 3s | implemented |
| Wicked Clover | uncommon | expansion drop chance ×2 for 20s (bounded) | implemented |
| Midnight Moth | uncommon | whispers the chamber's secret | implemented |
| Vanity Mirror | rare | mirrored echo bubble 10s (bounded) | implemented |

Rarity is shown by colour, a badge, the rarity word, and pips (0–4), with a dashed outline for cursed, so it never relies on colour alone.

## Feedback
Pickup: per-item tone cue, pop frames (`pop_0..4`), particles, top-right toast with sprite pop-in, rarity badge, NEW flag, detail and memetic announcement. Active timed effects show as icons with countdown bars under the HUD. Reduced motion disables bob, slide, pop-in, pop frames and particles.

## Dev QA hook
In development builds only (`import.meta.env.DEV`), `window.__bubbleHexExpansion.spawn(id, x?, y?)` and `.state()`.
