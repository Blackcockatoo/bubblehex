import test from "node:test";
import assert from "node:assert/strict";
import {
  BEAT, CHAMBERS, CHAMBER_IDS, EDITION_UNLOCKS, PROP_DEFINITIONS, PROP_LIMITS, TAROT, TAROT_LIMITS, beatScale, chamberById, chamberKey,
  cleanseTiles, doorAllowed, drawTarot, isEditionUnlocked, nextChamber, onBeat, seedTiles, spreadTiles, tileSlots, tileX,
} from "../app/game/chambers.ts";
import { chamberCopy, CHAMBER_COPY_LANGS } from "../app/game/chambers-i18n.ts";
import { LEVELS, BONUS_LEVEL } from "../app/game/levels.ts";
import { THEMES } from "../app/game/jukebox.ts";
import { auditLevelReachability } from "../app/game/reachability.ts";
import { DEFAULT_SETTINGS, migrateSettings } from "../app/game/persistence.ts";
import { ITEM_DEFINITIONS } from "../app/game/items.ts";

test("six chambers, each a separate Level with its own mechanic; the original 12 + vault are untouched", () => {
  assert.equal(CHAMBERS.length, 6);
  assert.deepEqual(CHAMBER_IDS, ["dead_disco", "vanity_room", "drowned_ballroom", "poison_conservatory", "klein_chamber", "widow_cathedral"]);
  assert.equal(new Set(CHAMBERS.map(c => c.mechanic)).size, 6, "every chamber has a distinct mechanical identity");
  const keys = CHAMBERS.map(c => c.level.loreFragmentId);
  assert.equal(new Set(keys).size, 6);
  for (const k of keys) assert.ok(!LEVELS.some(l => l.loreFragmentId === k) && k !== BONUS_LEVEL.loreFragmentId);
  assert.equal(LEVELS.length, 12);
  for (const l of LEVELS) assert.equal((l as { chamberId?: string }).chamberId, undefined);
  assert.equal(chamberById("widow_cathedral")?.level.boss, true);
  assert.equal(chamberKey("klein_chamber"), "chamber-klein-chamber");
});

test("chamber layouts are reachable and every prop sits inside the playfield", () => {
  for (const c of CHAMBERS) {
    const audit = auditLevelReachability(c.level);
    assert.ok(audit.every(a => a.status !== "unreachable"), `${c.id} has an unreachable platform`);
    assert.ok(c.props.length <= PROP_LIMITS.maxPropsPerChamber);
    for (const p of c.props) {
      const d = PROP_DEFINITIONS[p.kind];
      assert.ok(p.x - d.w / 2 >= 18 && p.x + d.w / 2 <= 942, `${c.id}/${p.kind} x`);
      assert.ok(p.y - d.h >= 70 && p.y <= 650, `${c.id}/${p.kind} y`);
    }
    for (const e of c.level.enemies) assert.ok(e.x >= 24 && e.x <= 900 && e.y > 70 && e.y < 650);
  }
  const kinds = new Set(CHAMBERS.flatMap(c => c.props.map(p => p.kind)));
  for (const k of Object.keys(PROP_DEFINITIONS)) if (k !== "secret_door") assert.ok(kinds.has(k as never), `${k} is placed in some chamber`);
  assert.equal(PROP_DEFINITIONS.mirror.sprite, null, "the enchanted mirror is code-drawn");
});

test("route: first undiscovered chamber, then cycles; the door only appears in original non-boss stages", () => {
  assert.equal(nextChamber([], 0).id, "dead_disco");
  assert.equal(nextChamber(["chamber-dead-disco"], 1).id, "vanity_room");
  const all = CHAMBERS.map(c => c.level.loreFragmentId);
  assert.equal(nextChamber(all, 0).id, "dead_disco");
  assert.equal(nextChamber(all, 7).id, "vanity_room");
  const base = { levelIndex: 3, lastIndex: 11, boss: false, bonus: false, inChamber: false, attract: false };
  assert.equal(doorAllowed(base), true);
  assert.equal(doorAllowed({ ...base, levelIndex: 11 }), false);
  assert.equal(doorAllowed({ ...base, boss: true }), false);
  assert.equal(doorAllowed({ ...base, bonus: true }), false);
  assert.equal(doorAllowed({ ...base, inChamber: true }), false);
  assert.equal(doorAllowed({ ...base, attract: true }), false);
  const key = ITEM_DEFINITIONS.find(i => i.id === "widow_key")!;
  assert.equal(key.status, "implemented"); assert.equal(key.effect, "key");
});

test("Dead Disco beat: lunges on the beat, creeps between; the average stays close to normal speed", () => {
  assert.equal(onBeat(0), true); assert.equal(onBeat(0.3), false); assert.equal(onBeat(BEAT.seconds + 0.01), true);
  assert.equal(beatScale(0.05), BEAT.fast); assert.equal(beatScale(0.4), BEAT.slow);
  const avg = (BEAT.window * BEAT.fast + (BEAT.seconds - BEAT.window) * BEAT.slow) / BEAT.seconds;
  assert.ok(avg > 0.8 && avg < 1.3, `average ${avg}`);
});

test("venom tiles: seeded, spread one slot at a time, capped, never onto the spawn side of the floor, cleansed by pops", () => {
  const def = chamberById("poison_conservatory")!, plats = def.level.platforms;
  const tiles = seedTiles(plats, def.seeds!);
  assert.equal(tiles.length, 3);
  let i = 0; const seq = [0.1, 0.9, 0.4, 0.2, 0.7, 0.6, 0.3]; const rng = () => seq[i++ % seq.length];
  for (let n = 0; n < 200; n++) spreadTiles(tiles, plats, rng);
  assert.ok(tiles.length <= PROP_LIMITS.maxTiles);
  for (const t of tiles) {
    assert.ok(t.slot >= 0 && t.slot < tileSlots(plats[t.platform]));
    if (t.platform === 0) assert.ok(tileX(plats[0], t.slot) >= PROP_LIMITS.tileSafeX);
  }
  assert.equal(new Set(tiles.map(t => `${t.platform}:${t.slot}`)).size, tiles.length);
  const t0 = tiles[0], p0 = plats[t0.platform];
  const removed = cleanseTiles(tiles, plats, tileX(p0, t0.slot), p0.y - 10);
  assert.ok(removed >= 1);
  const empty: never[] = []; assert.equal(spreadTiles(empty, plats, rng), null);
});

test("tarot: bounded deck of boons and curses with limits", () => {
  assert.ok(TAROT.some(c => c.boon) && TAROT.some(c => !c.boon));
  assert.equal(drawTarot(() => 0).id, TAROT[0].id);
  assert.equal(drawTarot(() => 0.9999).id, TAROT[TAROT.length - 1].id);
  assert.ok(TAROT_LIMITS.maxLives <= 5 && TAROT_LIMITS.deathFloor >= 5 && TAROT_LIMITS.moonSeconds <= 6);
});

test("editions: Original free, the four specials unlock through achievements/chambers", () => {
  assert.deepEqual(Object.keys(EDITION_UNLOCKS).sort(), THEMES.filter(t => t.id !== "default").map(t => t.id).sort());
  const s = { cabinet: { achievements: [] as string[], chambers: [] as string[], themesUnlocked: [] as string[] } };
  assert.equal(isEditionUnlocked(s, "default"), true);
  for (const t of THEMES) if (t.id !== "default") assert.equal(isEditionUnlocked(s, t.id), false);
  s.cabinet.achievements.push("opening_night"); assert.equal(isEditionUnlocked(s, "old-vic"), true);
  s.cabinet.achievements.push("chamber_crawler"); assert.equal(isEditionUnlocked(s, "civilian-signal"), true);
  s.cabinet.chambers.push("chamber-klein-chamber"); assert.equal(isEditionUnlocked(s, "klein"), true);
  s.cabinet.chambers.push("chamber-widow-cathedral"); assert.equal(isEditionUnlocked(s, "widow-after-dark"), true);
  assert.equal(isEditionUnlocked({}, "klein"), false);
});

test("save v9: anyone who already picked a special edition keeps it; fresh saves stay locked; round trip is lossless", () => {
  assert.equal(DEFAULT_SETTINGS.version, 9);
  for (const theme of ["old-vic", "civilian-signal", "klein", "widow-after-dark"]) {
    const m = migrateSettings({ version: 8, theme, cabinet: { achievements: [], chambers: [] } });
    assert.equal(m.theme, theme);
    assert.deepEqual(m.cabinet.themesUnlocked, [theme]);
    assert.equal(isEditionUnlocked(m, theme), true);
    const again = migrateSettings(JSON.parse(JSON.stringify(m)));
    assert.deepEqual(again, m);
  }
  const fresh = migrateSettings({ version: 6, theme: "default" });
  assert.deepEqual(fresh.cabinet.themesUnlocked, []);
  // v9 saves with an explicit list are taken at face value (a reset clears it).
  const reset = migrateSettings({ version: 9, theme: "default", cabinet: { themesUnlocked: [] } });
  assert.deepEqual(reset.cabinet.themesUnlocked, []);
  const future = migrateSettings({ version: 9, cabinet: { themesUnlocked: ["klein", "future-edition"] } });
  assert.deepEqual(future.cabinet.themesUnlocked, ["klein", "future-edition"]);
});

test("M6 copy is complete in en / ja / hi", () => {
  const en = chamberCopy("en");
  assert.deepEqual(CHAMBER_COPY_LANGS, ["en", "ja", "hi"]);
  for (const lang of CHAMBER_COPY_LANGS) {
    const c = chamberCopy(lang);
    for (const id of CHAMBER_IDS) { assert.ok(c.chambers[id][0] && c.chambers[id][1], `${lang} ${id}`); }
    for (const k of Object.keys(en.props)) assert.ok(c.props[k as keyof typeof en.props]);
    for (const t of TAROT) assert.ok(c.tarot[t.id][0] && c.tarot[t.id][1]);
    for (const id of Object.keys(EDITION_UNLOCKS)) assert.ok(c.editionHint[id]);
    if (lang !== "en") assert.notEqual(c.chambers.dead_disco[0], en.chambers.dead_disco[0]);
    assert.ok(c.beatBonus(150).includes("150") && c.editionUnlocked("X").includes("X"));
  }
  assert.equal(chamberCopy("xx"), en);
});

test("ja / hi descriptions cover every item, ammo type and personality; limits stay in sync", async () => {
  const { loreDesc } = await import("../app/game/lore-i18n.ts");
  const { AMMO_DEFINITIONS, PERSONALITIES, LIVING_LIMITS } = await import("../app/game/living-bubbles.ts");
  const keys = [...ITEM_DEFINITIONS.map(i => [i.id, i.description]), ...AMMO_DEFINITIONS.map(a => [`ammo:${a.id}`, a.summary]), ...PERSONALITIES.map(p => [`p:${p.id}`, p.summary])];
  for (const lang of ["ja", "hi"]) for (const [key, en] of keys) {
    const t = loreDesc(lang, key, en);
    assert.notEqual(t, en, `${lang} ${key}`); assert.ok(!t.includes("{n}"));
  }
  assert.ok(loreDesc("ja", "ammo:thunder", AMMO_DEFINITIONS.find(a => a.id === "thunder")!.summary).includes(String(LIVING_LIMITS.maxThunderJumps)));
  assert.equal(loreDesc("en", "poison_apple", "One bite. +500."), "One bite. +500.");
  assert.equal(loreDesc("ja", "unknown", "x"), "x");
});
