# Forbidden Expansion — M6: the Widow's Chambers, props and playable editions

Stacked on `expansion/m5-collection` (PR #22). **Do not merge out of order:** #18 → #19 → #20 → #21 → #22 → this PR.

## What's in it

### The route (uses the Widow's Key for real now)
- `widow_key` (M1) changes from *collection-only* to *implemented*: "Opens the Secret Door to a Widow's Chamber." It still drops only from a chain of 3+ after stage 4.
- Picking one up gives the run a key (up to 3) and shows a key counter.
- After a Widow's Key has been found at least once, a **Secret Door** appears on the floor (x≈878) in original stages that aren't boss, final or vault stages. Without a key, touching it just shows a keyhole hint.
- Opening the door spends the key and books the **first undiscovered chamber** (once all six are found, it cycles). When the stage is cleared, the chamber loads *between* stage N and N+1. `levelIndex` doesn't change, so clearing the chamber carries on to stage N+1 through the original `nextStage`.
- The original 12 stages and the vault are never edited (a test compares a `LEVELS` snapshot). Chamber secrets go to the cabinet's `secretRooms`, never to the 12 Jade Doors (`fragments` and `secrets` are restored).
- Restarting inside a chamber reloads the chamber. Transitions: two door panels slide apart, then a card shows the chamber name and its rule (a static card under reduced motion). The HUD reads "✦ SECRET CHAMBER ✦" with the chamber name, and the DOM background maps each chamber.
- **Practice:** in Collection → Rooms, a discovered chamber shows **ENTER** on the title screen. It starts a fresh practice run, and clearing it returns to the title.

### Six chambers, each with its own mechanic (`app/game/chambers.ts`)
| Chamber | Mechanic | Props |
|---|---|---|
| The Dead Disco | 0.5 s beat. Enemies lunge (×2.2) during the first 0.18 s and creep (×0.35) the rest of the time, for an average of ≈1. Pops on the beat score +150 each, capped at 6000 per stage. A HUD beat light shows the beat. | jukebox, coffin, tarot |
| The Vanity Room | Enchanted mirrors reflect shots, and a fired shot casts one mirror twin (max 6 per stage, and only while the field is under the M3 bubble cap). | 2 mirrors (drawn in code), tarot |
| The Drowned Ballroom | Alternating current bands carry floating bubbles, which rise more slowly. Shots get extra drag. Your fall speed is capped at 360. | chandelier, coffin |
| Poison Conservatory | Venom tiles spread one slot every 3.5 s (max 18) and never onto the spawn side of the floor. Standing on one hurts. Pops cleanse tiles within 90 px. | serpent statue |
| The Klein Chamber | The side edges wrap for you, enemies and bubbles. Bubbles that reach the ceiling come back up from below. Nested frames draw the recursive geometry. | mirror, tarot |
| The Widow's Cathedral | A boss encounter with a Widow variant: after 3.4 s of chasing she veil-steps (a mirrored teleport, kept in bounds). She has her own nameplate. | 2 stained glass, chandelier |

### Props (data-driven: `PROP_DEFINITIONS` / `PROP_LIMITS`, placed per chamber)
- **Jukebox:** every 4th beat it pulses and holds nearby enemies for 0.7 s.
- **Chandelier:** falls when a pop lands near it. On impact it holds enemies within 140 px for 2.5 s and scores +500 each (max 2500). Single use.
- **Stained glass:** refracts a shot once: it tilts upward, flies 1.25× faster, and gets +1.5 s of life.
- **Coffin:** stand still inside it for 0.4 s to hide (3 s of invulnerability). Coming out holds nearby enemies for 1 s. 8 s cooldown.
- **Enchanted mirror:** drawn in code. Reflects shots and casts a twin.
- **Serpent statue:** spits a venom orb every 9 s (max 2 alive). Catching one gives +1 Venom ammo.
- **Secret door:** opened with the Widow's Key (see route).
- **Tarot:** single use. Boons: Sun +10 s (capped at the stage clock), Star +1 life (max 5), Magician +2 special shots, Lovers freeze 2 s. Curses: Tower haste ×1.3 for 6 s, Death −6 s (floor 8 s), Moon darkness for 5 s.

### Editions (B$S specials)
- Original is free. Unlock rules:
  - Old Vic ← *Opening Night* (first clear)
  - Civilian Signal ← *Chamber Crawler*
  - Klein ← clear The Klein Chamber
  - Widow After Dark ← clear The Widow's Cathedral
- Locked editions are refused (deny tone) in both the M2 pause Theme tab and the M5 cabinet, with a lock and the unlock hint. A banner announces new unlocks.
- When worn, an edition restyles the **whole cabinet**:
  - DOM: `data-theme` on `.arcade-page` re-tints the CSS variables, the cabinet body, the bezel and the buttons (`editions.css`).
  - HUD: accent rule plus edition ornaments.
  - Playfield: vignette, scanlines or nested frames.
  - Every `drawGothicFrame` / `drawGothicBox` (title, select, records, game over, victory, cabinet) gets edition corner ornaments.
- **Save v9:** `cabinet.themesUnlocked`. A v8 save that had already picked a special edition keeps it (grandfathered). The round trip is lossless.

### Translations
- All M6 strings are in en/ja/hi (`chambers-i18n.ts`).
- New `lore-i18n.ts` adds ja/hi descriptions for all 16 items, 11 ammo types and 11 personalities. Numbers come from the English text, so limits stay in sync. These are shown in the Collection tab and the cabinet.

## Bounds and comfort
- Every list is capped: tiles 18, orbs 2, flashes 12, held 12, keys 3, twins 6 per stage, props 6 per chamber.
- Entities are clamped to the playfield.
- Reduced motion: effect lifetimes are shortened, there's no sway or sweep, and the intro is a static card.
- Original gameplay is unchanged when no chamber is active and no key has been found.

## Tests
- `tests/chambers.test.ts` (10): data, reachability, prop bounds, route, beat, venom tiles, tarot, edition rules, v9 migration, i18n completeness, ja/hi descriptions.
- `tests/chamber-engine.test.mjs` (14): the key → door → chamber → N+1 flow, no-key untouched, restart and cycling, each chamber's mechanic, each prop, tarot limits, practice from the Collection, edition lock/unlock/wear, and a 25 s random session in every chamber × 2 editions × reduced motion, checking bounds.
- Existing tests updated for v9, plus the M2 theme test (special editions now unlock through play).
