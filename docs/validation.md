# Validation record

## Baseline on `main`

Audited at commit `cc415c7` before gameplay edits.

- `npm ci`: passed.
- `npm test`: passed 35 existing Node test cases, the production build, and the rendered HTML smoke check.
- `npm run lint`: passed with the repository's existing Next.js `<img>` advisory.
- Standalone `npx tsc --noEmit`: exposed the existing `.ts` import-extension and Cloudflare ambient-type configuration gaps. The project now has an explicit `typecheck` script and local ambient declarations so this gate is reproducible.
- Fixed-step simulation, interpolation, checkpoint/save storage, keyboard/touch/gamepad mappings, reduced-motion handling, responsive 960×720 cabinet scaling, and Cloudflare deployment configuration were inspected before editing.
- `runtime-upgrades.ts` contained prototype-level mutation and scoring patches that duplicated engine responsibilities; those stable mechanics now live in focused engine modules.

## Post-change coverage

The automated matrix covers all twelve story chambers, Dirty Gold Vault, and all five Encore chambers with the shared movement envelope for both Vesper and Jade. It also exercises currents and valves, mirror reveals, candles, chain-driven gates/blooms/vines, thorn warning windows, all enemy mutation declarations, persistence migration, checkpoint round-trips, bubble collision and chain grace, chamber results, Encore unlocks, and all three Widow acts.

Run the complete gate with:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The Node playthrough matrix is deterministic and supplements hands-on tuning; it does not claim to replace a human dodge or score-routing pass. Browser automation was unavailable in the implementation environment because no compatible browser binary could be installed, so final feel and visual-density tuning remains an explicit PR review item.
