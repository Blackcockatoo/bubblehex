# BUBBLE HEX

Sharni's modern-retro single-player arcade game from Blue $nake Studio.

Trap enemies in bubbles, chain-pop them for score multipliers, collect VENOM
letters, uncover secret rooms, and survive twelve gothic neon chambers.

## Controls

- Move: `A` / `D` or arrow keys
- Jump / double jump: `Space` or `C`
- Blow bubble: `X` or `Z`
- Start: `Enter`
- Pause: `P` or `Escape`
- Chamber map and mode: `M` or `Tab`
- Enemy consciousness: `W` or `Up`
- Gameplay diagnostics: `F3` or backtick (development builds)

Touch controls and gamepads are supported. Gameplay stays deterministic on a
960x720 internal canvas; only the presentation scales.

## Screens and devices

The cabinet is sized from one pair of numbers — the effective width and height
of the play surface — so the 4:3 screen and the controls always fit together
without scrolling:

- **Wide layout** (desktop, laptops, tablets): the screen sits above a deck with
  the movement pad and action buttons at the outer thumb corners.
- **Split layout** (phones and any short landscape window): the pads flank the
  screen so both thumbs rest on the edges of the device and never cover the
  picture.
- **Portrait phones play horizontally.** `Full screen` requests a real
  landscape orientation lock where the browser allows it; where it does not
  (every iOS browser), the cabinet rotates itself a quarter turn so the game is
  horizontal either way.

Every control target is at least 52 px, and scales up to ~104 px on roomy
screens.

## Modes and the chamber map

- **Chronicle** is the forgiving default: clearing a chamber records it, the
  chamber map lets you return to anything you have already opened, checkpoints
  are banked every five chambers, and hero mastery perks carry between runs.
- **Original Hex** is the unforgiving arcade rule set: no map jumps, no
  checkpoints, no chamber retries from the pause screen, no carried-over
  mastery, shorter timers and angrier enemies. Losing your last life sends you
  back to chamber one. Points are worth x1.5 and are recorded on a separate
  board.

Progress, records and the chosen mode are saved to `localStorage` and survive a
reload. Toggle modes with the deck button or with `Up` on the chamber map
(`M` / `Tab` opens the map).

## Development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
```

## Gameplay systems

- Fixed 60 Hz simulation with bounded frame deltas
- Proportional 150.8 px primary jump and weaker recovery double jump
- Coyote time, jump buffering, variable jump height, and swept feet collision
- Twelve audited, traversable chambers plus a hidden bonus vault
- A saved chamber map with per-chamber best times and jade-door progress
- Chronicle and Original Hex rule sets with separate record boards
- Title-screen arcade cheat sequences
- Local high score and accessibility settings

Built with React, TypeScript, Canvas 2D, and B$S neon-gothic arcade styling.
