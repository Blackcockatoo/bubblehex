import type { Level, Platform } from "./levels.ts";
import {
  MAX_RUN_SPEED,
  classifyVerticalGap,
  solveDescendingCrossTime,
  theoreticalDoubleJumpHeight,
  type Reachability,
} from "./physics.ts";

export type PlatformAudit = {
  id: number;
  platform: Platform;
  status: Reachability | "start";
  from: number | null;
  verticalGap: number;
};

const horizontalGap = (a: Platform, b: Platform) =>
  Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));

const canReach = (from: Platform, to: Platform, mode: Reachability) => {
  const rise = from.y - to.y;
  if (rise < -8) return true;
  if (mode === "unreachable") return false;
  const flight = mode === "single"
    ? solveDescendingCrossTime(Math.max(0, rise))
    : 1.12;
  return horizontalGap(from, to) <= MAX_RUN_SPEED * flight + 34;
};

export const auditLevelReachability = (level: Level): PlatformAudit[] => {
  const platforms = level.platforms.map((platform, id) => ({ platform, id }));
  const start = platforms.reduce((best, item) => item.platform.y > best.platform.y ? item : best);
  const result = new Map<number, PlatformAudit>();
  result.set(start.id, { ...start, status:"start", from:null, verticalGap:0 });

  let changed = true;
  while (changed) {
    changed = false;
    for (const target of platforms) {
      if (result.has(target.id)) continue;
      for (const source of result.values()) {
        const rise = source.platform.y - target.platform.y;
        if (rise > theoreticalDoubleJumpHeight() - 8) continue;
        const status = classifyVerticalGap(Math.max(0, rise));
        if (canReach(source.platform, target.platform, status)) {
          result.set(target.id, { ...target, status, from:source.id, verticalGap:Math.max(0, rise) });
          changed = true;
          break;
        }
      }
    }
  }

  return platforms.map(item => result.get(item.id) ?? {
    ...item, status:"unreachable", from:null, verticalGap:0,
  });
};
