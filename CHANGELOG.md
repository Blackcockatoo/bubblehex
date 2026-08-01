# Changelog

## Gameplay Evolution (draft)

### Why

The cabinet presentation was complete, but canonical rooms largely differed by
geometry and global current values. Enemy rank mostly scaled timing, bubble
overlap had no stable separation, the Widow used one repeated vulnerability
loop, and checkpoints plus projectile readability lived in a prototype-patching
file.

### Changed

- Gave all twelve canonical chambers explicit movement, encounter, chain,
  risk-route, secret, recovery, timing and expert-score identities without
  changing their order or story truth.
- Added five optional, post-story Encore chambers with four persisted medals per
  world.
- Added deterministic currents and valves, nonlethal drains, previewed mirror
  doors, lifts, revealed platforms, chain-grown vines, moon-pool buoyancy,
  chain blooms, ordered candles, wax platforms, contract gates, warned thorns,
  local gravity, previewed phase platforms, harmless delayed bubble echoes and
  warned time replays.
- Added selective readable mutations for all six existing enemy families.
- Added bubble lifetime and tension feedback, stable bubble collision, overlap
  separation, chain links, chain multiplier preview and a fixed-step grace
  window. Anchor, Pulse, Echo and VENOM effects remain earned run effects rather
  than new action buttons.
- Balanced Vesper toward acceleration, immediate jump influence and launch force;
  balanced Jade toward smooth air correction, bubble time and current control.
  Controls, collision, jumps and mandatory reach remain shared.
- Rebuilt the Widow as Host, Split Clause and Shared Vow acts with readable true
  clauses, contract-anchor redirection, a four-echo final release and per-act
  restart handling.
- Expanded the compact result card with source scores, largest chain, time,
  secret, damage, medals and personal-best comparison.
- Migrated persistence from v5 to v6 without changing the storage key.
- Integrated checkpoints and high-contrast projectiles into the maintained
  engine and removed `runtime-upgrades.ts` prototype patching.
- Added authored-level validation and targeted tests for chains, collision,
  environments, variants, heroes, persistence, checkpoints, Encore and boss
  transitions.
- Fixed authored risk pickups using the timed-drop spawn lifetime, which could
  produce a massive negative canvas scale and repaint every chamber jade green.
  Reward spawn transforms are now bounded and covered by a focused regression
  test.

### Preserved

Fixed 60 Hz simulation, interpolation, keyboard/touch/gamepad controls, landscape
layout, reduced motion, existing audio/settings/high scores/unlocks/mastery,
canonical lore, Original/Extra vault, VENOM, cheat sequences, deployment files
and production URL configuration remain intact.

### Baseline before editing

- `npm test`: 35 TypeScript gameplay tests and rendered artifact test passed;
  production build passed.
- `npm run lint`: passed with one existing `next/no-img-element` warning.
- standalone repository-wide `npx tsc --noEmit`: failed on `.ts` import
  configuration plus Cloudflare Worker ambient types. The evolution pass added
  an explicit `typecheck` command and the minimal ambient declarations needed to
  make that check pass.
