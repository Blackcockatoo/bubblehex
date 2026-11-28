# Forbidden Expansion M7: animation pass (heroes, enemies, the Widow)

Purely visual. Sprites, silhouettes, hitboxes, simulation timing, controls and save data are unchanged
(no save-version bump). The new code lives in three places:

| File | Role |
| --- | --- |
| `app/game/animation-fx.ts` | Render-only state: hero turn/takeoff/landing/shot/hit ages, one slot per live enemy (firing, landing, break-free, trapped time, smoothed facing and fury), defeat ghosts (capped at 16), Widow hit/rage. Fed read-only snapshots once per fixed tick by `BubbleHexEngine.stepFx`. |
| `app/game/hero-art.ts` | Hero rig additions (still the original vector sprite). |
| `app/game/enemy-art.ts` | Enemy and Widow drawing moved out of `engine.ts`, with the original art plus the new motion. |

The engine only gained: one `stepFx` call per tick, `fx.enemyDefeated` where a trapped enemy pops, `fx.heroHurt` when the
shield breaks, `fx.reset` on level load, and the new draw calls. Nothing the simulation reads is written by animation.

## Heroes (Vesper and Jade)
- **Idle:** breathing, a blink every ~3s (occasional double blink), a fidget every ~8s (eyes look around, tail flicks, small head tilt).
- **Run:** footfall squash on each stride, head counter-bob.
- **Jump:** arms drop and the body stretches on takeoff; landing squash is unchanged.
- **Turning:** a ~90 ms squish through the flip instead of an instant mirror.
- **Shooting:** body kicks back, tiny squash, arm and spark as before.
- **Hit (shield break):** knock wobble, pale flash, shock ring.
- **Death:** hops up, then spins and drops out of the stage.
- **Stage clear / victory:** a cheer pose: hops with landing squash, happy eyes, big smile, tail swish, orbiting sparkles.

## Enemies
All: pop-in on spawn (overshoot), landing squash, recoil when they fire, burst-free pulse when they escape a bubble,
fury flames and rage brows, smoothed turning, blinking.
- **Love (heart):** heartbeat quickens when furious, waddle squash and hop while walking, blinking eyes, angry brows.
- **Bat:** wings tuck on a dive and spread on a climb, body pitches with vertical speed, ear flick, glowing red eyes when furious.
- **Eye:** darting saccades, breathing pupil that contracts hard while charging and flares after firing, red veins and heavy brow when furious.
- **Witch:** sleeves hang relaxed then are flung up to channel a star, hat jolts back on the cast, hem flutters with speed, sways with movement.
- **Doll:** sinks and coils before its charge, stretches long during it, stubby arms swing/reach, marionette jerks while ambling.
- **Skull:** crouches and clenches its jaw in the last 0.3 s before each hop (the hop timing itself is unchanged), eye-socket glow, jaw chatter speeds up when furious.
- **Trapped:** thumping against the bubble walls, harder the longer it has been held, frantic once the bubble starts warning.
- **Defeat:** swell, burst ring and spokes, then spin, rise and fade (lasts 0.8 s, at most 16 at once).

## The Widow
Silk-thread drop and swing on entrance, breathing hover, legs rise and the body coils before a lunge, veil flares, crown shakes;
dazed state sags the legs and sways; a hit flashes her white with a shockwave ring and a recoil pop; at half health she goes into a
rage (flame aura, narrowed eyes and brows, faster legs); defeat shudders, the legs curl in, cracks widen and the crown falls away;
flails when caught in a bubble.

## Reduced motion
With reduced motion on (setting or system): no fidget, breathing, squash, spawn pop, struggle ramp, recoil, spin, strobe flash,
flames, sparkles, shockwave or hop; turns snap; eye blinks and static expression changes remain.

## Tests
`tests/animation-engine.test.mjs` (in `npm test`): blink/fidget curves; event detection (takeoff, landing, shot, turn, fire, break-free);
bounded slots and ghosts; every kind x state x calm draws with balanced save/restore and finite values; deterministic frames; anticipation
and fury tells differ from idle; reduced motion removes the tells; and 1,500-tick simulations (stage 1 and the Widow stage, with real
bubbling and trapping) that produce identical simulation state with animation off, on, rendered, and in reduced motion.
