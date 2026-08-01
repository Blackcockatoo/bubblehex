# Gameplay content schema

Bubble Hex keeps authored content in `app/game/levels.ts` and simulation rules in
focused modules. The canvas engine consumes these modules; it does not patch its
prototype at runtime.

## Level

`Level` preserves the canonical name, world, background, lore fragment, timer,
platforms, enemies, current and secret. New fields are additive:

- `design`: required play-test intent: movement, interaction, safe and advanced
  chains, risk route, secret, recovery, timing, difficulty, expert strategy and
  two viable routes.
- `environment`: optional authored mechanics. Empty categories do nothing.
- `encore`, `encoreId`, `medalTargets`: optional post-clear challenge metadata.

Environment categories are deliberately narrow: `currents`, `valves`, `drains`,
`mirrorDoors`, `lifts`, `revealPlatforms`, `vines`, `moonPools`, `blooms`,
`candles`, `waxPlatforms`, `contractGates`, `thorns`, `gravityZones`,
`phasePlatforms`, `echoBubbles`, `timeFracture`, `riskPickups`, and
`ritualTargetSeconds`.

All positions use the fixed 960×720 simulation space. Directions, candle order,
gate requirements, chain thresholds and hazard states are rendered with shapes,
arrows or text as well as colour.

## Enemy spawn

`EnemySpawn` keeps `x`, `y` and one of the six canonical `kind` values. Optional
`variant` and `group` fields compose encounters without defining a replacement
enemy. `enemy-grammar.ts` owns valid family variants, defaults, cue phases and
threat values. An invalid cross-family variant falls back to the family's
original behaviour.

## Runtime modules

- `bubble-system.ts`: lifetime ratio, stable collision separation, connected
  chain graph, Pulse radius and fixed-step chain grace.
- `environment.ts`: deterministic mechanic state, dynamic platforms, current and
  gravity lookup, valves, candle order, contract gates and thorn phases.
- `enemy-grammar.ts`: mutation validity and readable warning/attack states.
- `hero-rules.ts`: the balanced Vesper/Jade modifiers. Jump count, jump velocity,
  collision size and controls stay shared.
- `widow-boss.ts`: Host → Split Clause → Shared Vow progression and phase
  checkpoint data.
- `level-validation.ts`: complete authored-content validation.

## Persistence v6

The existing `bubble-hex-settings` key is retained. Migration v6 preserves all
v5 audio, accessibility, high score, secrets, skins, codex, fragments, stage
times, perfect clears and hero mastery. It adds:

- `storyClears`
- `encoreMedals`
- `bestChamberScores`
- `bestChains`

Unknown medals, worlds and negative records are discarded. Encore is unlocked
from `storyClears > 0`; old saves begin with it locked and lose no prior data.

## Validation contract

`validateCampaign()` checks platform and spawn bounds, safe opening distance,
ground-enemy support, duplicate geometry, route reachability, lowest-area
recovery, variant ownership, world/background/lore IDs, boss/bonus/Encore flags,
timer range, reciprocal mirror exits, candle order, canonical count, Encore
coverage and checkpoint compatibility.
