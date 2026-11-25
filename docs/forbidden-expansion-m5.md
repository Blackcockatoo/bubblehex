# Forbidden Expansion — M5: The Widow's Collection, achievements, wardrobe, living cabinet

Stacked on M4 (`expansion/m4-familiars`). Installed by `installLivingCabinet()` after the M4 familiars; every hook calls the
original method. The cabinet is an overlay, not a new engine state, so title/pause flow underneath is untouched.

## What ships
- **Widow's Collection cabinet** (`cabinet-expansion.ts`): full-screen overlay reachable from the title (`✦ COLLECTION` button,
  `V`) and from pause (Collection tab → `JUMP`, `V` or the on-screen button). Ten sections: Items, Familiars, Bubbles
  (11 ammo + 11 personalities discovered), Records (jukebox), Editions (themes), Chambers (13 incl. bonus vault, best time,
  secret found), Achievements, Memorabilia, Wardrobe, Reset. `←/→` pick, `JUMP`/`↑`/`Q`/`E` section, `BUBBLE` use,
  `Esc`/`Start`/`✕` close. Records/editions/familiars/wardrobe can be selected from inside the cabinet. While open the
  cabinet owns input: no attract mode, no title cheat tokens, no pause toggling underneath.
- **Achievements** (`cabinet.ts`): 23 data-driven definitions `{id, rarity, glyph, stat, need, reward?}` tied to real play
  across M1–M4 (pops, chains, chambers, perfect clears, secrets, items, vinyls, special ammo, personalities, familiars,
  familiar assists/naps, Widow remarks, the title secret, VENOM spelled, wardrobe). Badges are the pack rarity badges with a
  code-drawn ribbon + glyph; locked badges are dimmed with a lock. Toast + chime on unlock, max 3 queued. Never in attract.
- **Wardrobe**: 7 code-drawn accessories (Hex Cat Ears, Mourning Veil, Static Halo, Heartbreak Crown, Venom Aura, Crimson
  Aura, Velvet Wings), each unlocked by one achievement. Drawn over/under the original hero art (pose-matched bob/lean),
  never replacing sprites and never touching the hitbox; ghost/HUD icon draws stay untouched.
- **Memorabilia**: 8 forbidden objects using the pack `props` atlas (now loaded), unlocked by stats, each with lore.
- **Living cabinet title**: tiers by achievements (3/6/10/15/20) add candles, chandeliers + up to 6 wandering familiars,
  the Widow's eyes, her veil silhouette, gold candles + "THE WIDOW APPROVES". Spiders build a corner web over 150 s of
  cumulative title time (persisted; dew when finished). Heroes and familiars dance after 5 s idle (before attract at 15 s).
  A blinking glint in the frame (44 px DOM button, keyboard focusable) reveals the Secret Door card, memorabilia and the
  *Curiosity* achievement once; afterwards a door stays on the title.
- **The Widow's remarks**: on stage transitions, throttled (≥2 stages and ≥45 s apart, 60% chance, ≤6 per session, never
  in attract). Holds the stage intro up to 3.4 s; any Jump/Start/Bubble skips. Reduced motion: no fade.
- **Save v8**: `cabinet {achievements, wardrobeEquipped, ammoSeen, personalitiesSeen, counters, chambers, secretRooms, web,
  titleSecret}`. v5–v7 saves seed `chambers` from best times, `secretRooms` from fragments and `perfects` from
  perfectClears; unknown ids/counters from newer builds are kept (round-trip tested).
- **Familiar unlocks now read cabinet counters** so a reset truly resets them; this also fixes M4's Velvet unlock, which
  depended on `perfectClears` that the base engine never increments (M5 counts no-damage clears).
- **Collection reset** (Reset section): BUBBLE arms, BUBBLE again erases, JUMP cancels. Erases items, familiars,
  achievements, wardrobe, discoveries, memorabilia, web/secret, jukebox/theme choice. Keeps high score, best times, lore
  fragments, hero levels, skins and the familiar-assist preference.
- **i18n**: all new strings en/ja/hi (`cabinet-i18n.ts`); ja/hi lore names back-filled for all 16 items, 11 ammo,
  11 personalities and 6 familiars and used in the cabinet, the M2 collection tab and the M4 familiars tab/unlock toast.

## Bounds
Toasts ≤3 queued; walkers ≤6; one Widow remark at a time with a hold cap; web clamped 0..1; counters clamped and
key-limited in normalisation; no new particles; reduced motion disables dance, flicker, spider sway, slides and fades.

## Outstanding
- Item/ammo/personality descriptions, familiar behaviour/assist text and rarity labels remain English in ja/hi.
- Editions stay free to apply (as in M2); there are no edition-specific unlocks yet.
- Cabinet text is canvas-drawn: on phones in the rotated portrait layout it is small (same limitation as the pause panel).
- Section 8 chambers (Widow's Chambers) not started.
