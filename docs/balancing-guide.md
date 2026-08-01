# Bubble Hex balancing guide

## Build a decision, not a stat wall

Start each chamber with one movement question and one enemy-composition
question. Add pressure by making two readable behaviours interact. Do not solve
difficulty with global speed, bubble resistance, projectile rate or timer cuts.
One mutation per early encounter and two complementary mutations per late
encounter is usually enough.

## Geometry guardrails

- Keep a threat-free opening pocket for at least the stage-intro read.
- Maintain one broad lowest-area recovery route.
- Test every mandatory ledge with the shared base jump envelope; hero modifiers
  may improve routing but may never be required.
- Preview every teleport exit and both phase-platform destinations.
- Put a waiting shelf before a timed hazard.
- Never place a ground enemy without support or within 72 px of player spawn.
- Run `validateCampaign()` for every authored content change.

## Chain routing

Every room needs an obvious two- or three-bubble cluster and a deliberate
full-room route. Place the safe setup near recovery geometry. The expert setup
may cross a current, portal, buoyancy zone or expiring platform, but its final
links must be visible together. Base link radius is 82 px; Pulse is 104 px and
the fixed-step extension window is 0.16 seconds.

## Timers and scores

Set normal timers near the upper end of the documented beginner completion
range. The timer should punish wandering, not the first room read. Encore target
time should be achievable on the safe route; target score should require the
risk pickup plus a strong chain. Recheck targets after changing enemy rank,
pickup value or chain multipliers.

Score sources are additive and visible: traps, releases, pickups, chain value,
full-room chain, time, lives, no damage and secret. Do not hide a medal condition
inside a story secret.

## Readability and accessibility

Every mutation needs a silhouette mark and a timing cue. Every hazard needs an
idle, warning and active state. Colour is secondary. Keep particles below the
projectile, platform and pickup silhouettes; reduced motion removes shake and
limits particle bursts. Review the busiest late chamber at 960×720 and in a
landscape mobile viewport before raising density.

## Boss tuning

The Host checks anchor redirection, Split Clause checks telegraph reading, and
Shared Vow checks chain preparation. Tune act duration and formation composition
before changing Widow speed. Each act checkpoint must restore a solvable state,
and the final release must always come from all four numbered bound echoes.
