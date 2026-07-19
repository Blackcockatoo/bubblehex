import test from "node:test";
import assert from "node:assert/strict";
import { CheatReader, CODES, mirrorCode, nextTitleStartGrace, type CheatKey, type Token } from "../app/game/cheats.ts";

const feed = (reader: CheatReader, code: Token[], active: Record<CheatKey, boolean>, start = 1000) => {
  let result: CheatKey | null = null;
  code.forEach((token, index) => { result = reader.feed(token, start + index * 100, active); });
  return result;
};

test("all canonical and mirrored title codes match", () => {
  for (const key of Object.keys(CODES) as CheatKey[]) {
    const active = { power:false, super:false, extra:false, nara:false };
    assert.equal(feed(new CheatReader(), CODES[key], active), key);
    assert.equal(feed(new CheatReader(), mirrorCode(CODES[key]), active), key);
  }
});

test("a plain START does not activate Super and the full Super prefix does", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false, nara:false };
  assert.equal(reader.feed("START", 1000, active), null);
  assert.equal(feed(reader, CODES.super.slice(1), active, 1100), "super");
});

test("codes expire after a 1.5 second gap", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false, nara:false };
  CODES.power.slice(0,4).forEach((token,index)=>reader.feed(token,1000+index*100,active));
  assert.equal(feed(reader,CODES.power.slice(4),active,4000),null);
});

test("all four codes can stack in one title session", () => {
  const reader = new CheatReader();
  const active = { power:false, super:false, extra:false, nara:false };
  for (const key of ["power","super","extra","nara"] as CheatKey[]) {
    assert.equal(feed(reader,CODES[key],active),key);
    active[key]=true;
  }
  assert.deepEqual(active,{power:true,super:true,extra:true,nara:true});
});

test("a mid-sequence START token (as in SUPER) never leaves a dangling start-run grace", () => {
  // SUPER = START,JUMP,BUBBLE,LEFT,RIGHT,JUMP,START,RIGHT — token 7 is START but
  // does not complete the code by itself, so it must not arm a stale grace timer
  // that fires after token 8 confirms the cheat a moment later.
  assert.equal(nextTitleStartGrace(false, true), 0.24, "a non-completing START arms the grace window");
  assert.equal(nextTitleStartGrace(true, true), 0, "a START that completes a code clears the grace window");
  assert.equal(nextTitleStartGrace(false, false), 0, "non-START tokens never arm the grace window");
  assert.equal(nextTitleStartGrace(true, false), 0, "a completing non-START token clears any pending grace");
});
