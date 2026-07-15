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

test("all three codes can stack in one title session", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false };
  for (const key of ["power","super","extra"] as CheatKey[]) {
    assert.equal(feed(reader,CODES[key],active),key);
    active[key]=true;
  }
  assert.deepEqual(active,{power:true,super:true,extra:true});
});
