import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MUSIC_TRACKS, pickMusicUrl, type MusicTrackId } from "../app/game/audio.ts";
import { VOICE_LINES } from "../app/game/voice.ts";

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

test("only the victory fanfare is a one-shot; every other track loops", () => {
  const loopIds = (Object.keys(MUSIC_TRACKS) as MusicTrackId[]).filter(id => MUSIC_TRACKS[id].loop);
  assert.deepEqual(new Set(loopIds), new Set(["title", "stage", "hotel", "garden", "chapel", "bonus", "boss"]));
  assert.equal(MUSIC_TRACKS.victory.loop, false);
});

test("every voice category has at least one clip, and every clip file exists on disk", () => {
  for (const [category, urls] of Object.entries(VOICE_LINES)) {
    assert.ok(urls.length > 0, `voice category ${category} has no clips`);
    for (const url of urls) {
      const path = join(process.cwd(), "public", url.replace(/^\//, ""));
      assert.ok(existsSync(path), `missing voice clip: ${url}`);
    }
  }
});
