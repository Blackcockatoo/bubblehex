import test from "node:test";
import assert from "node:assert/strict";
import { ANNOUNCEMENT_LINES, ANNOUNCER_LIMITS, Announcer } from "../app/game/announcer.ts";
import { JUKEBOX_RECORDS, THEMES, chamberTrack, isRecordUnlocked, themeById } from "../app/game/jukebox.ts";
import { EXPANSION_COPY, PAUSE_TABS } from "../app/game/expansion-i18n.ts";
import { migrateSettings } from "../app/game/persistence.ts";
import { LANGS } from "../app/game/i18n.ts";

test("all seven brief announcements are bound to events", () => {
  assert.deepEqual(new Set(Object.values(ANNOUNCEMENT_LINES)), new Set(["POP RESPONSIBLY.","THAT WAS PERSONAL.","ABSOLUTELY HEXED.","YOU LITTLE MENACE.","BUBBLE BAD BEHAVIOUR.","THE WIDOW APPROVES.","SIN. WIN. REPEAT."]));
});

test("announcer throttles: global gap, per-line cooldown, priority interrupt", () => {
  const a = new Announcer();
  assert.ok(a.trigger("lastSecondPop"));
  assert.equal(a.trigger("recaptureFurious"), null, "same priority inside the global gap");
  assert.ok(a.trigger("megaChain"), "higher priority may interrupt");
  a.tick(ANNOUNCER_LIMITS.globalGap + .1);
  assert.equal(a.trigger("lastSecondPop"), null, "line cooldown still active");
  assert.ok(a.trigger("recaptureFurious"));
  a.tick(ANNOUNCER_LIMITS.lineCooldown + .1);
  assert.ok(a.trigger("lastSecondPop"));
  assert.equal(a.shown, 4);
});

test("spamming events for a minute yields a bounded number of announcements", () => {
  const a = new Announcer();
  let accepted = 0;
  for (let i = 0; i < 3600; i++) { a.tick(1/60); for (const e of ["lastSecondPop","megaChain","recaptureFurious","hoarder"] as const) if (a.trigger(e)) accepted++; }
  assert.ok(accepted <= 4 * Math.ceil(60 / ANNOUNCER_LIMITS.lineCooldown), `accepted ${accepted}`);
});

test("announcements expire and hide clears the screen", () => {
  const a = new Announcer(); a.trigger("flawlessClear");
  a.tick(ANNOUNCER_LIMITS.displayTime + .01); assert.equal(a.current, null);
  a.tick(30); a.trigger("venomAscension"); a.hide(); assert.equal(a.current, null);
});

test("Cursed Vinyl unlocks jukebox records in order", () => {
  assert.equal(isRecordUnlocked("stage", 0), true);
  assert.equal(isRecordUnlocked("bonus", 0), false);
  assert.equal(isRecordUnlocked("bonus", 1), true);
  assert.equal(isRecordUnlocked("boss", 1), false);
  assert.equal(isRecordUnlocked("boss", 2), true);
  assert.equal(chamberTrack("boss", 1, "stage"), "stage", "locked choice falls back to the chamber default");
  assert.equal(chamberTrack("boss", 2, "stage"), "boss");
  assert.equal(chamberTrack("auto", 9, "bonus"), "bonus");
  assert.ok(JUKEBOX_RECORDS.some(r => r.vinylsNeeded > 0));
});

test("themes cover the four B$S special editions plus the original", () => {
  assert.deepEqual(THEMES.map(t => t.id), ["default","old-vic","civilian-signal","klein","widow-after-dark"]);
  assert.equal(themeById("nope").id, "default");
});

test("jukebox and theme settings persist and sanitise", () => {
  const s = migrateSettings({version:6,jukeboxTrack:"boss",theme:"klein"});
  assert.equal(s.jukeboxTrack, "boss"); assert.equal(s.theme, "klein");
  const bad = migrateSettings({version:6,jukeboxTrack:"evil",theme:42});
  assert.equal(bad.jukeboxTrack, "auto"); assert.equal(bad.theme, "default");
  assert.deepEqual(migrateSettings(JSON.parse(JSON.stringify(s))), s);
});

test("interface copy is complete in every cabinet language", () => {
  for (const lang of LANGS) {
    const copy = EXPANSION_COPY[lang];
    for (const tab of PAUSE_TABS) assert.ok(copy.tabs[tab], `${lang} ${tab}`);
    for (const r of JUKEBOX_RECORDS) assert.ok(copy.tracks[r.id], `${lang} ${r.id}`);
    for (const t of THEMES) assert.ok(copy.themes[t.id], `${lang} ${t.id}`);
    assert.ok(copy.locked(2).length && copy.owned(3).length && copy.vinylsOwned(1).length);
  }
});
