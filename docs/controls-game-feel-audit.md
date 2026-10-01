# Bubble Hex controls and game-feel audit

Scope: current main at `cc415c73e74ccee0ab032eb0b282dc3df2aba366`, 1 October 2026. Preserve the gothic neon cabinet, Vesper/Jade, authored levels, physics, modes, scores, mastery, skins, archive, audio, bonus vault and checkpoints.

Bubble Hex is a fixed-step canvas arcade platformer. Bubble firing traps enemies; touching occupied bubbles pops connected chains. There is no tile-swap or colour-match board. This pass improves the implemented loop rather than adding a different matching system.

## FIX NOW

| Issue | Implemented repair |
| --- | --- |
| Small secondary targets, cramped primary groups | 48px portrait/desktop secondary controls; 44px in short landscape. Movement minimum 60 × 64px; mobile action buttons minimum 68px. Separate groups and larger gaps. |
| Mobile cabinet status consumes three stacked rows | Compact two-column rail; readable DOM score and action guidance. Cabinet remains recognizable. |
| Larger controls push desktop and landscape below viewport | Reserve their actual height when sizing the cabinet/screen; remove cabinet minimum-width overflow. |
| Held touch feedback depends on CSS `:active` | Pointer-specific held styling; capture and release on up, cancellation, lost capture and blur. |
| Neutral connected gamepad cancels keyboard/touch direction | Independent sources per action; release/disconnection removes only that source. Keyboard aliases and multiple fingers coexist. |
| Chain callbacks continue during pause/restart | Fixed-step pop queue with immediate chain reservation. Pause freezes resolution; restart/destroy clears the queue. No delayed callbacks remain. |
| Reserved enemies may participate in another pop before callback executes | Explicit `popping` phase and guarded one-time scoring. Preserve the original 55ms chain cadence and multipliers. |
| Lost focus leaves held inputs running | Release inputs and automatically pause active play; preserve Hurry as the resume state. |
| Restart retains effects, firing cooldown and hit stop | Reset transient effects, queue, combo, held inputs and cooldown with the chamber. Scores and checkpoint rules remain unchanged. |
| Hit stop discards quick input edges | Preserve pending action edges until simulation resumes. |
| Bubble boundary overshoot can repeatedly reverse velocity | Clamp to the existing boundary before reflecting velocity; show a short visual compression. |
| Keyboard listeners suppress native focused-button activation | Preserve native Space/Enter keydown and keyup; assistive/native click activates primary controls once. |
| Holding Jump for paused SFX adjustment also toggles reduced motion | Toggle motion on a released tap; consume the tap when Jump modifies a volume action. |
| Sound button can disagree with pause-menu mute setting | Mirror saved engine mute state into the control deck. |
| Chain banner mixes pop count with multiplier | Show the actual pop count and existing scoring multiplier; stronger existing Heartbreak feedback for large chains. |
| Pop score appears disconnected from action | Bounded floating points at the originating position and a brief score-HUD accent. Actual scores update immediately. |
| Pop/removal lacks a finishing outline | Short expanding rings, reserved-bubble anticipation and bounded particle hierarchy. No collision-size changes. |
| Completion instantly covers final effects | Fast fade/slide of the existing completion panel; particles continue resolving; bonus rows settle into their existing values. Existing auto-advance timing retained; optional Start advance. |
| Level purpose is hard to read on a small canvas | Readable authored encounter/current cues for all twelve chambers and the bonus vault. Intro can be dismissed after a short minimum. |
| Pause instructions shrink with the canvas | Readable DOM pause summary mirrors existing controls, live volumes, sound and motion state. |
| Effects have no global particle budget | Cap at 160 particles, 20 rings and 8 score bursts. No additional animation loop or React render per simulation tick. |
| Reduced motion misses new/old decorative effects | Disable particles, rings, trails, squash, warning flicker and cosmetic bubble wobble; preserve warnings and score text. Listen for OS motion preference changes. |
| Background overlays darken important canvas content | Reduce overlay/vignette strength. Slow transform-only drift preserves existing SVG scenes; reactive energy remains a restrained canvas-edge response. |

## Verification

Final automated result: 49 tests pass (35 existing unit/content checks, 13 engine regressions and 1 production artifact test); portable production build, game TypeScript check and lint pass. Lint retains one existing `<img>` optimization advisory. Real Chromium reports no page errors. Eleven viewport checks and the documented integration flows pass.

- Existing authored-level/physics/scoring/cheat/content/audio/checkpoint tests retained.
- Added engine regressions for independent input sources, gamepad coexistence/disconnection, chain reservation and score, pause, restart cleanup, lost focus/Hurry resume, effect budgets, reduced motion, wall reflection, buffered hit-stop input, native keyboard activation, pause modifier/tap distinction and rapid modifier chords across slow frames.
- Added a repeatable real-Chromium check in `tests/browser-polish.mjs`: viewport bounds, target sizes and overlaps; native keyboard; real CDP multi-touch; pause/restart; deterministic campaign integration; failure/replay; bonus flow; saved state and live reduced motion.
- Browser viewport matrix: 320×568, 360×640, 375×667, 390×844, 412×915, 430×932, 768×1024, 1280×900, 568×320, 667×375 and 844×390.
- The scripted campaign puts bubbles at authored enemy locations, then uses the actual trap/pop/scoring/progression methods. It validates all twelve chamber transitions and the boss/victory state. It is **not an unassisted difficulty playthrough**.
- Existing reachability tests confirm every chamber's platform graph is traversable. No timers, spawns, enemy ranks, physics constants, score multipliers or progression thresholds were rebalanced without playtest evidence.
- The game-scoped TypeScript check excludes unrelated existing Cloudflare binding/type errors in the repository-wide check. `npm run typecheck:game` checks all app modules.
- Use `VERCEL=1 npm test` for the existing portable production pipeline. The artifact test now understands both portable HTML and the original Worker entrypoint; the default Cloudflare build path remains intact.
- Managed runtime's agent-browser daemon could not start. Browser verification uses Playwright/Chromium directly. Screenshot capture can stall in software rendering; layout and interaction assertions are independent of screenshots.
- Real-device safe-area/browser-chrome behavior, sustained low-end-phone frame pacing and an unassisted complete difficulty playthrough remain release follow-ups. No claim is made that browser viewport emulation proves those.

## POLISH NEXT

1. Measure frame pacing and battery/thermal load on an ordinary Android phone; tune budgets from recorded results.
2. Check iPhone/Android browser bar expansion, notches and safe-area behavior on devices.
3. Review canvas archive, character cards and completion text at 320px; the readable DOM guidance/score/pause summary covers primary actions, but dense lore still scales down.
4. Tune the timing and audio balance of single pops versus large chains with player feedback.
5. Conduct an unassisted campaign playtest at each existing enemy-consciousness setting; record time-to-clear, deaths and frustration before any balance edits.

## FUTURE IDEAS — not implemented

- Optional device haptics coordinated with existing audio and large-chain events.
- Player-adjustable thumb layout/handedness with saved preferences.
- Optional progressive first-use instruction cards for existing enemy behaviours.
- Replay/per-chamber performance summaries using existing scores and best times.
- Optional interactive archive presentation for lore readability on small phones.

## Five strongest opportunities for the next reviewed pass

1. **Real-player difficulty evidence:** complete campaign runs and conservative tuning only where repeated evidence supports it.
2. **Phone-readable canvas HUD/menu content:** prioritize text and archive accessibility while preserving the art and board.
3. **Audio/tactile hierarchy:** tune existing sound cues and evaluate opt-in haptics for pops and chains.
4. **Personal control ergonomics:** review handedness and saved thumb-placement options on actual devices.
5. **Replay/progression feedback:** review a compact chamber performance recap using existing records and mastery.

No new gameplay modes, mechanics or experimental progression systems were implemented. No deployment is part of this pass.

## Corrective pass — 2 October 2026

User feedback: retain the older large diagonal action layout; the released game did not respond reliably on their device.

### FIX NOW — implemented
- Restored the earlier diagonal relationship: Bubble above/left of Jump. Action targets are 76–104px on portrait phones, 83–101px at the tested landscape sizes, and 124px on desktop. Landscape uses the earlier vertically staggered thumb pair and leaves more room for the chamber.
- Reserved height for the larger controls; kept all controls visible at 320×568 and the other ten tested sizes. Removed the duplicate decorative signal line on phones and kept movement targets at least 60×72px in portrait.
- A stalled optional artwork request previously kept the engine at boot with Start disabled indefinitely. Startup now proceeds with the existing procedural art after three simulation seconds; late art can still load.
- Audio-device initialization exceptions previously interrupted input before the action was recorded. Input now continues silently.
- Added click-only activation fallback while suppressing duplicate pointer clicks. Expiring the legacy suppression record fixes switching from earlier touch input to click-only activation.
- Focus gameplay after menu clicks so Space/Enter do not remain captured by menu buttons. Retain native keyboard activation for explicitly focused controls.
- Clear touch indicators/input when the page is hidden; tolerate pointer-capture cancellation and release uncaptured input on pointer exit.

### Verification
- 51 automated tests pass (35 existing unit/content tests, 15 engine regressions, one built-HTML check); game typecheck passes. Lint has no errors and the existing image advisory.
- Development browser suite passes all eleven layouts, diagonal/size regression checks, multi-touch, native keyboard, pause/restart, saved progress, reduced motion and fixture-assisted campaign flow.
- New `tests/production-controls.mjs` serves and exercises the actual static Vercel artifact: eleven layouts, real touch Start/hero confirmation, simultaneous movement/fire and independent finger release, click-only activation, pause/resume, keyboard jump after touch menus, restart and reduced motion. No page errors.
- Live desktop startup, selection and gameplay worked during diagnosis. The user's precise device-specific failure was not reproduced; the concrete startup and input failure paths above are covered by regression tests. Full physical-device testing remains POLISH NEXT.

POLISH NEXT and FUTURE IDEAS from the earlier audit remain unchanged. No game rules, levels, scoring, progression or artwork were replaced.
