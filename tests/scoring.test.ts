import assert from "node:assert/strict";
import test from "node:test";
import { computeStageBreakdown, isNewCampaignRecord, isNewStageRecord } from "../app/game/scoring.ts";

test("stage breakdown sums speed, life, no-damage, and secret bonuses onto raw kills", () => {
  const result = computeStageBreakdown({ kills: 2400, remainingTime: 30, lives: 3, noDamage: true, secretFound: true, bonusRoom: false });
  assert.equal(result.kills, 2400);
  assert.equal(result.speedBonus, 360);
  assert.equal(result.lifeBonus, 900);
  assert.equal(result.noDamageBonus, 1000);
  assert.equal(result.secretBonus, 5000);
  assert.equal(result.total, 2400 + 360 + 900 + 1000 + 5000);
});

test("bonus-room secrets pay more than a normal chamber's Jade Door", () => {
  const normal = computeStageBreakdown({ kills: 0, remainingTime: 0, lives: 0, noDamage: false, secretFound: true, bonusRoom: false });
  const bonus = computeStageBreakdown({ kills: 0, remainingTime: 0, lives: 0, noDamage: false, secretFound: true, bonusRoom: true });
  assert.equal(normal.secretBonus, 5000);
  assert.equal(bonus.secretBonus, 8000);
});

test("no bonuses accrue for a damaged, secretless, timed-out clear", () => {
  const result = computeStageBreakdown({ kills: 500, remainingTime: -4, lives: 0, noDamage: false, secretFound: false, bonusRoom: false });
  assert.equal(result.speedBonus, 0);
  assert.equal(result.lifeBonus, 0);
  assert.equal(result.noDamageBonus, 0);
  assert.equal(result.secretBonus, 0);
  assert.equal(result.total, 500);
});

test("a first clear of any stage is always a new stage-time record", () => {
  assert.equal(isNewStageRecord(undefined, 999), true);
});

test("a stage record only improves on a strictly faster clear", () => {
  assert.equal(isNewStageRecord(42, 41.9), true);
  assert.equal(isNewStageRecord(42, 42), false);
  assert.equal(isNewStageRecord(42, 42.1), false);
});

test("a campaign record only improves on a strictly higher score", () => {
  assert.equal(isNewCampaignRecord(10000, 10001), true);
  assert.equal(isNewCampaignRecord(10000, 10000), false);
  assert.equal(isNewCampaignRecord(10000, 9999), false);
});
