import type { HeroId } from "./content";

export type HeroRules = {
  groundAcceleration: number;
  airAcceleration: number;
  earlyJumpInfluence: number;
  airDeceleration: number;
  bubbleLaunch: number;
  bubbleLifetime: number;
  currentInfluence: number;
};

export const HERO_RULES:Record<HeroId,HeroRules> = {
  vesper:{groundAcceleration:1.12,airAcceleration:1,earlyJumpInfluence:1.14,airDeceleration:1,bubbleLaunch:1.08,bubbleLifetime:0,currentInfluence:1},
  jade:{groundAcceleration:1,airAcceleration:1.08,earlyJumpInfluence:1,airDeceleration:.82,bubbleLaunch:1,bubbleLifetime:.65,currentInfluence:.72},
};

export function heroRules(hero:HeroId):HeroRules {
  return HERO_RULES[hero];
}
