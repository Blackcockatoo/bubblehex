export type ChainableBubble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  lifeMax: number;
  phase: string;
};

export const CHAIN_GRACE_SECONDS = 0.16;
export const BASE_CHAIN_RADIUS = 82;
export const PULSE_CHAIN_RADIUS = 104;

export function isOccupiedBubble(bubble: ChainableBubble): boolean {
  return bubble.phase === "occupied" || bubble.phase === "warning" || bubble.phase === "bound";
}

export function bubbleLifetimeRatio(bubble: Pick<ChainableBubble,"life"|"lifeMax">): number {
  if (!Number.isFinite(bubble.lifeMax) || bubble.lifeMax <= 0) return 0;
  return Math.max(0, Math.min(1, bubble.life / bubble.lifeMax));
}

export function collectChain(
  bubbles: readonly ChainableBubble[],
  rootId: number,
  linkRadius = BASE_CHAIN_RADIUS,
): number[] {
  const byId = new Map(bubbles.filter(isOccupiedBubble).map((bubble) => [bubble.id, bubble]));
  if (!byId.has(rootId)) return [];
  const open = [rootId];
  const seen = new Set<number>();
  while (open.length) {
    const id = open.shift()!;
    if (seen.has(id)) continue;
    const bubble = byId.get(id);
    if (!bubble) continue;
    seen.add(id);
    for (const other of byId.values()) {
      if (seen.has(other.id)) continue;
      if (Math.hypot(bubble.x - other.x, bubble.y - other.y) <= linkRadius) open.push(other.id);
    }
  }
  return [...seen];
}

/**
 * Resolve one deterministic, low-energy collision pass. Separation is applied
 * before velocity exchange so overlapping trapped bubbles never collapse into
 * an unreadable stack. The caller may run this once per fixed simulation tick.
 */
export function resolveBubbleCollisions(bubbles: ChainableBubble[]): void {
  const ordered = [...bubbles].sort((a,b) => a.id - b.id);
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i], b = ordered[j];
      if (a.phase === "burst" || b.phase === "burst") continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      const minimum = a.r + b.r + 2;
      if (distance >= minimum) continue;
      const nx = distance < .001 ? (a.id < b.id ? 1 : -1) : dx / distance;
      const ny = distance < .001 ? 0 : dy / distance;
      if(distance<.001)distance=0;
      const correction = (minimum - distance) * .5;
      a.x -= nx * correction; a.y -= ny * correction;
      b.x += nx * correction; b.y += ny * correction;

      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative >= 0) continue;
      const occupied = isOccupiedBubble(a) || isOccupiedBubble(b);
      const impulse = -relative * (occupied ? .28 : .46);
      a.vx -= nx * impulse; a.vy -= ny * impulse;
      b.vx += nx * impulse; b.vy += ny * impulse;
    }
  }
}
