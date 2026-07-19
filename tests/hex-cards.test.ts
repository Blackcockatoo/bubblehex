import assert from "node:assert/strict";
import test from "node:test";
import {
  HEX_CARDS, HEX_CARD_IDS, MAX_ACTIVE_HEX_CARDS, MAX_HEX_CARD_RANK,
  defaultHexModifiers, equipNewCard, generateCardOffers, isCardMaxRank, replaceCard,
  resolveHexModifiers, upgradeCard, type EquippedHexCard,
} from "../app/game/hex-cards.ts";

test("catalogue has at least twelve cards across three readable rarities", () => {
  assert.ok(HEX_CARD_IDS.length >= 12);
  const rarities = new Set(Object.values(HEX_CARDS).map(card => card.rarity));
  assert.deepEqual([...rarities].sort(), ["common", "cursed", "rare"]);
});

test("cursed cards carry a real trade-off, not just bigger numbers", () => {
  const cursed = Object.values(HEX_CARDS).filter(card => card.rarity === "cursed");
  assert.ok(cursed.length >= 2);
  const widow = resolveHexModifiers([{ id: "widows-bargain", rank: 1 }], "vesper");
  assert.ok(widow.scoreMultiplier > 1);
  assert.equal(widow.widowsBargainActive, true, "the bargain must be visibly flagged, not a silent number change");
  const black = resolveHexModifiers([{ id: "black-bubble", rank: 1 }], "vesper");
  assert.ok(black.enemyPullStrength > 0, "black bubble pulls enemies toward its centre — including toward the player");
});

test("resolveHexModifiers with no cards returns pure defaults", () => {
  assert.deepEqual(resolveHexModifiers([], "vesper"), defaultHexModifiers());
});

test("split bubble adds an extra bubble but shrinks radius and lifetime", () => {
  const mods = resolveHexModifiers([{ id: "split-bubble", rank: 1 }], "jade");
  assert.equal(mods.bubbleCount, 2);
  assert.ok(mods.bubbleRadiusMultiplier < 1);
  assert.ok(mods.bubbleLifeMultiplier < 1);
});

test("card ranks cap at MAX_HEX_CARD_RANK and upgrades only touch the matching card", () => {
  let equipped: EquippedHexCard[] = [{ id: "grave-bubble", rank: 1 }, { id: "heart-magnet", rank: 1 }];
  equipped = upgradeCard(equipped, "grave-bubble");
  equipped = upgradeCard(equipped, "grave-bubble");
  equipped = upgradeCard(equipped, "grave-bubble");
  equipped = upgradeCard(equipped, "grave-bubble");
  assert.equal(equipped.find(c => c.id === "grave-bubble")?.rank, MAX_HEX_CARD_RANK);
  assert.equal(equipped.find(c => c.id === "heart-magnet")?.rank, 1);
  assert.equal(isCardMaxRank(equipped.find(c => c.id === "grave-bubble")!), true);
});

test("higher ranks enhance the defining mechanic, not just score", () => {
  const rank1 = resolveHexModifiers([{ id: "grave-bubble", rank: 1 }], "vesper");
  const rank3 = resolveHexModifiers([{ id: "grave-bubble", rank: 3 }], "vesper");
  assert.ok(rank3.graveBubbleLifeBonus > rank1.graveBubbleLifeBonus);
  const echo1 = resolveHexModifiers([{ id: "echo-bubble", rank: 1 }], "jade");
  const echo3 = resolveHexModifiers([{ id: "echo-bubble", rank: 3 }], "jade");
  assert.ok(echo3.echoBubbleEvery < echo1.echoBubbleEvery, "higher rank should echo more often (smaller N)");
});

test("hero identity gives the same card a different feel for Vesper vs Jade", () => {
  const vesperDash = resolveHexModifiers([{ id: "bubble-dash", rank: 1 }], "vesper");
  const jadeDash = resolveHexModifiers([{ id: "bubble-dash", rank: 1 }], "jade");
  assert.notEqual(vesperDash.airborneRecoil, jadeDash.airborneRecoil);
  const vesperGrave = resolveHexModifiers([{ id: "grave-bubble", rank: 1 }], "vesper");
  const jadeGrave = resolveHexModifiers([{ id: "grave-bubble", rank: 1 }], "jade");
  assert.ok(jadeGrave.graveBubbleLifeBonus > vesperGrave.graveBubbleLifeBonus, "Jade favours bubble platforms over Vesper");
});

test("equipping caps at four active cards", () => {
  let equipped: EquippedHexCard[] = [];
  const ids = HEX_CARD_IDS.slice(0, 6);
  for (const id of ids) equipped = equipNewCard(equipped, id);
  assert.equal(equipped.length, MAX_ACTIVE_HEX_CARDS);
});

test("replaceCard swaps one slot without changing the total count", () => {
  const equipped: EquippedHexCard[] = [{ id: "grave-bubble", rank: 2 }, { id: "heart-magnet", rank: 1 }];
  const replaced = replaceCard(equipped, "grave-bubble", "night-current");
  assert.equal(replaced.length, 2);
  assert.ok(replaced.some(c => c.id === "night-current" && c.rank === 1));
  assert.ok(!replaced.some(c => c.id === "grave-bubble"));
});

test("card offers are deterministic for the same seed, chamber, and equipped set", () => {
  const equipped: EquippedHexCard[] = [{ id: "grave-bubble", rank: 1 }];
  const a = generateCardOffers("night-run-seed", 4, equipped);
  const b = generateCardOffers("night-run-seed", 4, equipped);
  assert.deepEqual(a, b);
});

test("card offers differ across chambers and across seeds", () => {
  const equipped: EquippedHexCard[] = [];
  const c4 = generateCardOffers("seed-x", 4, equipped);
  const c6 = generateCardOffers("seed-x", 6, equipped);
  assert.notDeepEqual(c4, c6);
  const other = generateCardOffers("seed-y", 4, equipped);
  assert.notDeepEqual(c4, other);
});

test("offers never exceed three and never repeat within one offer", () => {
  const offers = generateCardOffers("seed-z", 2, []);
  assert.ok(offers.length <= 3);
  assert.equal(new Set(offers.map(o => JSON.stringify(o))).size, offers.length);
});

test("once all four slots are full, offers become upgrade/replace/reward only", () => {
  const equipped: EquippedHexCard[] = [
    { id: "grave-bubble", rank: 3 }, { id: "heart-magnet", rank: 3 },
    { id: "bubble-dash", rank: 3 }, { id: "glass-fang", rank: 3 },
  ];
  const offers = generateCardOffers("seed-full", 8, equipped);
  for (const offer of offers) assert.ok(offer.kind === "replace" || offer.kind === "reward" || offer.kind === "upgrade");
});

test("a full loadout with headroom to upgrade can still offer an upgrade", () => {
  const equipped: EquippedHexCard[] = [
    { id: "grave-bubble", rank: 1 }, { id: "heart-magnet", rank: 3 },
    { id: "bubble-dash", rank: 3 }, { id: "glass-fang", rank: 3 },
  ];
  const seen = new Set<string>();
  for (let chamber = 0; chamber < 30; chamber++) for (const offer of generateCardOffers("seed-upgrade", chamber, equipped)) seen.add(offer.kind);
  assert.ok(seen.has("upgrade"));
});
