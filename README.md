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
- Gameplay diagnostics: `F3` or backtick

Touch controls and gamepads are supported. The cabinet scales responsively for
mobile and desktop while gameplay remains deterministic on a 960×720 internal
canvas.

## Development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Quality checks:

```bash
node --experimental-strip-types --test tests/cheats.test.ts tests/levels.test.ts tests/physics.test.ts
npm run lint
npm run build
```

## Gameplay systems

- Fixed 60 Hz simulation with bounded frame deltas
- Proportional 150.8 px primary jump and weaker recovery double jump
- Coyote time, jump buffering, variable jump height, and swept feet collision
- Twelve audited, traversable chambers
- Title-screen arcade cheat sequences
- Local high score and accessibility settings

Built with React, TypeScript, Canvas 2D, and B$S neon-gothic arcade styling.
