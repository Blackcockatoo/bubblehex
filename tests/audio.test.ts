import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MUSIC_TRACKS, pickMusicUrl, type MusicTrackId } from "../app/game/audio.ts";
import { VOICE_LINES, type VoiceCategory } from "../app/game/voice-lines.ts";

test("codec selection prefers ogg when supported and falls back to mp3", () => {
  const source = MUSIC_TRACKS.stage;
  assert.equal(pickMusicUrl(source, true), source.ogg);
  assert.equal(pickMusicUrl(source, false), source.mp3);
});

test("every music track has both derivative files present on disk", () => {
  for (const track of Object.values(MUSIC_TRACKS)) {
    for (const url of [track.ogg, track.mp3]) {
      const path = join(process.cwd(), "public", url.replace(/^\//, ""));
      assert.ok(existsSync(path), `missing audio derivative: ${url}`);
    }
  }
});

test("only one-shot fanfares/stings don't loop; every stage/menu bed does", () => {
  const loopIds = (Object.keys(MUSIC_TRACKS) as MusicTrackId[]).filter(id => MUSIC_TRACKS[id].loop);
  assert.deepEqual(new Set(loopIds), new Set(["title", "stage", "bonus", "boss", "worldHeartbreakHotel", "worldJadeGarden", "worldCrimsonChapel"]));
  assert.equal(MUSIC_TRACKS.victory.loop, false);
  assert.equal(MUSIC_TRACKS.naraBubble.loop, false);
});

test("every voice line file is present on disk", () => {
  for (const lines of Object.values(VOICE_LINES)) {
    for (const line of lines) {
      const path = join(process.cwd(), "public", line.url.replace(/^\//, ""));
      assert.ok(existsSync(path), `missing voice line: ${line.url}`);
    }
  }
});

test("all 89 voice lines are accounted for with no duplicate URLs", () => {
  const urls = (Object.keys(VOICE_LINES) as VoiceCategory[]).flatMap(k => VOICE_LINES[k].map(l => l.url));
  assert.equal(urls.length, 89);
  assert.equal(new Set(urls).size, 89);
});
