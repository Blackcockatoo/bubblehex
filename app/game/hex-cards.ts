// Hex Cards: temporary, per-Night-Run build modifiers layered on top of the
// permanent hero milestone upgrades in progression.ts. Card offers are fully
// deterministic (seeded by the run + chamber index) — never Math.random().
import type { HeroId } from "./content.ts";
import { pickDistinct, scopedRng } from "./run-rng.ts";

export type HexCardRarity = "common" | "rare" | "cursed";

export type HexCardId =
  | "split-bubble" | "grave-bubble" | "venom-link" | "heart-magnet"
  | "widows-bargain" | "echo-bubble" | "black-bubble" | "bubble-dash"
  | "chain-choir" | "glass-fang" | "stage-ward" | "night-current";

export const MAX_HEX_CARD_RANK = 3;
export const MAX_ACTIVE_HEX_CARDS = 4;

export type EquippedHexCard = { id: HexCardId; rank: number };

export type HexCardDefinition = {
  id: HexCardId;
  name: string;
  rarity: HexCardRarity;
  tagline: string;
  icon: string;
  flavor: string;
  rankNote: string;
  heroSynergy: Partial<Record<HeroId, string>>;
};

export const HEX_CARDS: Record<HexCardId, HexCardDefinition> = {
  "split-bubble": { id:"split-bubble", name:"Split Bubble", rarity:"rare", icon:"◐◑",
    tagline:"Fires a second, smaller bubble at an angle.", flavor:"Two apologies, thrown at once, rarely land the same way.",
    rankNote:"Widens the spread without losing control of either bubble.",
    heroSynergy:{ vesper:"Vesper's split shots fly a touch faster.", jade:"Jade keeps a touch more radius on each half." } },
  "grave-bubble": { id:"grave-bubble", name:"Grave Bubble", rarity:"common", icon:"◍",
    tagline:"Unoccupied bubbles stay as bounce platforms longer.", flavor:"Some rooms are only safe once no one is left inside them.",
    rankNote:"Extends how long an empty bubble holds its shape.",
    heroSynergy:{ jade:"Jade's platforms hold noticeably longer.", vesper:"Vesper's platforms hold only a little longer." } },
  "venom-link": { id:"venom-link", name:"Venom Link", rarity:"rare", icon:"☍",
    tagline:"A popped venom-marked enemy weakens one enemy nearby.", flavor:"Patience travels; so does its bite.",
    rankNote:"Widens the link radius and deepens the weaken effect.",
    heroSynergy:{ jade:"Jade's link reaches further.", vesper:"Vesper's link is a little shorter but still bites." } },
  "heart-magnet": { id:"heart-magnet", name:"Heart Magnet", rarity:"common", icon:"♡",
    tagline:"Rewards and VENOM letters pull toward you from further off.", flavor:"The night gives things back, if you let it come closer.",
    rankNote:"Extends the pull radius further still.",
    heroSynergy:{} },
  "widows-bargain": { id:"widows-bargain", name:"Widow's Bargain", rarity:"cursed", icon:"✦",
    tagline:"Large score multiplier — no shield benefit, more danger.", flavor:"Every bargain the Widow offers is generous and true, and costs everything.",
    rankNote:"Raises the multiplier and the price both.",
    heroSynergy:{ vesper:"Vesper leans into the risk for a sharper multiplier." } },
  "echo-bubble": { id:"echo-bubble", name:"Echo Bubble", rarity:"rare", icon:"◌",
    tagline:"Every few shots fires a delayed echo.", flavor:"Some things you say twice before you mean them.",
    rankNote:"The echo returns more often.",
    heroSynergy:{ vesper:"Vesper's rapid hands echo sooner." } },
  "black-bubble": { id:"black-bubble", name:"Black Bubble", rarity:"cursed", icon:"●",
    tagline:"Bubbles weakly drag nearby enemies toward their centre — toward you, too.", flavor:"The Black Bubble does not choose what it pulls in.",
    rankNote:"Widens the pull radius slightly.",
    heroSynergy:{ jade:"Jade shapes the pull a little more precisely." } },
  "bubble-dash": { id:"bubble-dash", name:"Bubble Dash", rarity:"common", icon:"»",
    tagline:"Firing while airborne pushes you the other way.", flavor:"Recoil is just momentum that hasn't decided whose fault it is.",
    rankNote:"Adds more push to the recoil.",
    heroSynergy:{ vesper:"Vesper gets extra recoil to chase her aggression." } },
  "chain-choir": { id:"chain-choir", name:"Chain Choir", rarity:"rare", icon:"♫",
    tagline:"Each enemy added to a chain widens the chain window a little.", flavor:"A choir only grows louder the longer it's allowed to gather.",
    rankNote:"Raises the cap on how far the window can stretch.",
    heroSynergy:{ jade:"Jade's choir holds its note a little longer." } },
  "glass-fang": { id:"glass-fang", name:"Glass Fang", rarity:"common", icon:"◆",
    tagline:"Bubbles fly faster and further, but smaller.", flavor:"The thinnest glass carries the furthest voice.",
    rankNote:"Trades a little more size for reach and speed.",
    heroSynergy:{ jade:"Jade's fang keeps a touch more range." } },
  "stage-ward": { id:"stage-ward", name:"Stage Ward", rarity:"rare", icon:"⛊",
    tagline:"Blocks the first hit taken in each chamber.", flavor:"The house always covers the first mistake. Never the second.",
    rankNote:"At rank 3 the ward can recharge after a big chain.",
    heroSynergy:{ vesper:"Vesper's ward recharges slightly sooner after a big chain." } },
  "night-current": { id:"night-current", name:"Night Current", rarity:"rare", icon:"≈",
    tagline:"Floating bubbles respond much more strongly to the chamber's current.", flavor:"Every room in Bubble Hex remembers which way it drains.",
    rankNote:"Strengthens the response further.",
    heroSynergy:{ jade:"Jade reads the current more precisely." } },
};

export const HEX_CARD_IDS = Object.keys(HEX_CARDS) as HexCardId[];

export type HexModifiers = {
  bubbleCount: number;
  bubbleRadiusMultiplier: number;
  bubbleSpeedMultiplier: number;
  bubbleLifeMultiplier: number;
  splitBubbleAngleSpread: number;
  rewardMagnetRadius: number;
  airborneRecoil: number;
  chainWindowBonus: number;
  chainWindowBonusPerLink: number;
  enemyPullStrength: number;
  enemyPullRadius: number;
  stageWardCharges: number;
  stageWardRecharge: boolean;
  scoreMultiplier: number;
  graveBubbleLifeBonus: number;
  echoBubbleEvery: number;
  venomLinkEnabled: boolean;
  venomLinkRadius: number;
  venomLinkPower: number;
  nightCurrentMultiplier: number;
  widowsBargainActive: boolean;
};

export function defaultHexModifiers(): HexModifiers {
  return {
    bubbleCount: 1, bubbleRadiusMultiplier: 1, bubbleSpeedMultiplier: 1, bubbleLifeMultiplier: 1,
    splitBubbleAngleSpread: 0, rewardMagnetRadius: 0, airborneRecoil: 0,
    chainWindowBonus: 0, chainWindowBonusPerLink: 0, enemyPullStrength: 0, enemyPullRadius: 0,
    stageWardCharges: 0, stageWardRecharge: false, scoreMultiplier: 1, graveBubbleLifeBonus: 0,
    echoBubbleEvery: 0, venomLinkEnabled: false, venomLinkRadius: 0, venomLinkPower: 0,
    nightCurrentMultiplier: 1, widowsBargainActive: false,
  };
}

const rankScale = (rank: number, base: number, perRank: number) => base + perRank * Math.max(0, rank - 1);
const heroLean = (hero: HeroId, forHero: HeroId, amount: number) => hero === forHero ? amount : 0;

function applyCard(mods: HexModifiers, card: EquippedHexCard, hero: HeroId): void {
  const r = clampRank(card.rank);
  switch (card.id) {
    case "split-bubble":
      mods.bubbleCount = Math.max(mods.bubbleCount, 2);
      mods.bubbleRadiusMultiplier *= 0.78;
      mods.bubbleLifeMultiplier *= 0.82;
      mods.splitBubbleAngleSpread = Math.max(mods.splitBubbleAngleSpread, rankScale(r, 0.12, 0.09));
      mods.bubbleSpeedMultiplier *= 1 + heroLean(hero, "vesper", 0.06);
      mods.bubbleRadiusMultiplier *= 1 + heroLean(hero, "jade", 0.05);
      break;
    case "grave-bubble":
      mods.graveBubbleLifeBonus += rankScale(r, 2.5, 1.9) * (1 + heroLean(hero, "jade", 0.25) - heroLean(hero, "vesper", 0.15));
      break;
    case "venom-link":
      mods.venomLinkEnabled = true;
      mods.venomLinkRadius = Math.max(mods.venomLinkRadius, rankScale(r, 120, 28) * (1 + heroLean(hero, "jade", 0.15)));
      mods.venomLinkPower = Math.max(mods.venomLinkPower, rankScale(r, 0.28, 0.1));
      break;
    case "heart-magnet":
      mods.rewardMagnetRadius += rankScale(r, 70, 45);
      break;
    case "widows-bargain":
      mods.widowsBargainActive = true;
      mods.scoreMultiplier *= rankScale(r, 1.5, 0.25) + heroLean(hero, "vesper", 0.1);
      break;
    case "echo-bubble": {
      const every = Math.max(1, 4 - r - Math.round(heroLean(hero, "vesper", 1)));
      mods.echoBubbleEvery = mods.echoBubbleEvery === 0 ? every : Math.min(mods.echoBubbleEvery, every);
      break;
    }
    case "black-bubble":
      mods.enemyPullStrength = Math.max(mods.enemyPullStrength, rankScale(r, 26, 6));
      mods.enemyPullRadius = Math.max(mods.enemyPullRadius, rankScale(r, 110, 14) * (1 + heroLean(hero, "jade", 0.1)));
      break;
    case "bubble-dash":
      mods.airborneRecoil = Math.max(mods.airborneRecoil, rankScale(r, 90, 40) * (1 + heroLean(hero, "vesper", 0.2)));
      break;
    case "chain-choir":
      mods.chainWindowBonusPerLink = Math.max(mods.chainWindowBonusPerLink, rankScale(r, 4, 2.5) * (1 + heroLean(hero, "jade", 0.15)));
      mods.chainWindowBonus = Math.max(mods.chainWindowBonus, rankScale(r, 26, 14));
      break;
    case "glass-fang":
      mods.bubbleSpeedMultiplier *= rankScale(r, 1.22, 0.1);
      mods.bubbleRadiusMultiplier *= rankScale(r, 0.86, -0.04);
      mods.bubbleLifeMultiplier *= rankScale(r, 1.15, 0.08) * (1 + heroLean(hero, "jade", 0.05));
      break;
    case "stage-ward":
      mods.stageWardCharges = Math.max(mods.stageWardCharges, 1);
      mods.stageWardRecharge = mods.stageWardRecharge || r >= 3;
      break;
    case "night-current":
      mods.nightCurrentMultiplier *= rankScale(r, 1.45, 0.35) * (1 + heroLean(hero, "jade", 0.1));
      break;
  }
}

/** Folds every equipped card + hero identity into one calculated modifier object the
 * engine can read from, instead of checking individual card ids throughout gameplay. */
export function resolveHexModifiers(equipped: readonly EquippedHexCard[], hero: HeroId): HexModifiers {
  const mods = defaultHexModifiers();
  for (const card of equipped) applyCard(mods, card, hero);
  // Chain window bonus is a per-link scalar consumed live by the engine (it depends on
  // the chain being built); cap the flat preview value so HUD/testing stays bounded.
  mods.chainWindowBonus = Math.min(mods.chainWindowBonus, 90);
  return mods;
}

function clampRank(rank: number): number {
  return Math.max(1, Math.min(MAX_HEX_CARD_RANK, Math.round(rank)));
}

export function cardDefinition(id: HexCardId): HexCardDefinition {
  return HEX_CARDS[id];
}

export function upgradeCard(equipped: readonly EquippedHexCard[], id: HexCardId): EquippedHexCard[] {
  return equipped.map(card => card.id === id ? { id, rank: clampRank(card.rank + 1) } : card);
}

export function isCardMaxRank(card: EquippedHexCard): boolean {
  return card.rank >= MAX_HEX_CARD_RANK;
}

export function equipNewCard(equipped: readonly EquippedHexCard[], id: HexCardId): EquippedHexCard[] {
  if (equipped.some(card => card.id === id)) return [...equipped];
  if (equipped.length >= MAX_ACTIVE_HEX_CARDS) return [...equipped];
  return [...equipped, { id, rank: 1 }];
}

export function replaceCard(equipped: readonly EquippedHexCard[], outgoingId: HexCardId, incomingId: HexCardId): EquippedHexCard[] {
  return equipped.map(card => card.id === outgoingId ? { id: incomingId, rank: 1 } : card);
}

// ---- Deterministic offer generation ------------------------------------------------

export type HexCardOffer =
  | { kind: "new"; card: HexCardId }
  | { kind: "upgrade"; card: HexCardId; fromRank: number; toRank: number }
  | { kind: "replace"; card: HexCardId }
  | { kind: "reward"; reward: "score" | "xp"; amount: number };

export function offerRewardAmount(kind: "score" | "xp", chamberIndex: number): number {
  const base = kind === "score" ? 1200 : 180;
  const perChamber = kind === "score" ? 220 : 24;
  return base + perChamber * Math.max(0, chamberIndex);
}

/** Deterministic given the same (runSeed, chamberIndex, equipped) triple — the run seed
 * plus chamber index scope a fresh independent rng, so replaying a run (or a future daily
 * challenge sharing a seed) always offers the same three cards. */
export function generateCardOffers(runSeed: number | string, chamberIndex: number, equipped: readonly EquippedHexCard[]): HexCardOffer[] {
  const rng = scopedRng(runSeed, "hex-card-offer", chamberIndex);
  const equippedIds = new Set(equipped.map(card => card.id));
  const hasSlot = equipped.length < MAX_ACTIVE_HEX_CARDS;
  const upgradeable = equipped.filter(card => !isCardMaxRank(card));
  const notEquipped = HEX_CARD_IDS.filter(id => !equippedIds.has(id));

  const pool: HexCardOffer[] = [];
  for (const card of upgradeable) pool.push({ kind: "upgrade", card: card.id, fromRank: card.rank, toRank: card.rank + 1 });
  if (hasSlot) for (const id of notEquipped) pool.push({ kind: "new", card: id });
  else for (const id of notEquipped) pool.push({ kind: "replace", card: id });
  pool.push({ kind: "reward", reward: "score", amount: offerRewardAmount("score", chamberIndex) });
  pool.push({ kind: "reward", reward: "xp", amount: offerRewardAmount("xp", chamberIndex) });

  return pickDistinct(pool, 3, rng);
}
