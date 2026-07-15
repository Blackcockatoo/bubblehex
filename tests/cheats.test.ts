import test from "node:test";
import assert from "node:assert/strict";
import { CheatReader, CODES, mirrorCode, type CheatKey, type Token } from "../app/game/cheats.ts";

const feed = (reader: CheatReader, code: Token[], active: Record<CheatKey, boolean>, start = 1000) => {
  let result: CheatKey | null = null;
  code.forEach((token, index) => { result = reader.feed(token, start + index * 100, active); });
  return result;
};

test("all canonical and mirrored title codes match", () => {
  for (const key of Object.keys(CODES) as CheatKey[]) {
    const active = { power:false, super:false, extra:false };
    assert.equal(feed(new CheatReader(), CODES[key], active), key);
    assert.equal(feed(new CheatReader(), mirrorCode(CODES[key]), active), key);
  }
});

test("a plain START does not activate Super and the full Super prefix does", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false };
  assert.equal(reader.feed("START", 1000, active), null);
  assert.equal(feed(reader, CODES.super.slice(1), active, 1100), "super");
});

test("codes expire after a 1.5 second gap", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false };
  CODES.power.slice(0,4).forEach((token,index)=>reader.feed(token,1000+index*100,active));
  assert.equal(feed(reader,CODES.power.slice(4),active,4000),null);
});

test("hasPending reports mid-sequence entry so a Start step of a code isn't mistaken for a fresh press", () => {
  const reader = new CheatReader();
  const active = { power: false, super: false, extra: false };
  assert.equal(reader.hasPending(1000), false);
  // Feed the first three tokens of POWER; a Start as the 4th token should read as "pending".
  ["LEFT", "JUMP", "LEFT"].forEach((token, i) => reader.feed(token as Token, 1000 + i * 100, active));
  assert.equal(reader.hasPending(1400), true);
  // After the buffer expires (>1.5s gap), it should no longer read as pending.
  assert.equal(reader.hasPending(3200), false);
});

test("hasPending ignores a buffer of only repeated Start presses (plain impatient tapping)", () => {
  const reader = new CheatReader();
  const active = { power: false, super: false, extra: false };
  reader.feed("START", 1000, active);
  assert.equal(reader.hasPending(1100), false);
  reader.feed("START", 1100, active);
  assert.equal(reader.hasPending(1200), false);
});

test("all three codes can stack in one title session", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false };
  for (const key of ["power","super","extra"] as CheatKey[]) {
    assert.equal(feed(reader,CODES[key],active),key);
    active[key]=true;
  }
  assert.deepEqual(active,{power:true,super:true,extra:true});
});
