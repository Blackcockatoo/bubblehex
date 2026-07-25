# BUBBLE HEX

Sharni's modern-retro single-player arcade game from Blue $nake Studio.

Trap enemies in bubbles, chain-pop them for score multipliers, collect VENOM
letters, uncover secret rooms, and survive twelve gothic neon chambers.

## Where this is published

This game deploys from this repository to `https://bubblehex.vercel.app` and is
listed on the Blue Snake Studios arcade hub at `/arcade`, where `/bubblehex`
hands players off to the deployment above.

The hub keeps its own copy of that URL in `src/lib/arcade/games.ts` in the `bss`
repository, overridable with `NEXT_PUBLIC_BUBBLE_HEX_URL`. If the production
domain for this game changes, update that registry entry too.

Bubble Hex is intentionally **not** part of the child-safe route surface, so it
is not reachable from MetaPet.school.

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
