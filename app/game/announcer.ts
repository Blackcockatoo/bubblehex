/**
 * Forbidden Expansion — memetic arcade announcements (M2).
 * Each line is bound to a real gameplay event and throttled so the cabinet
 * heckles you, not spams you.
 */
export type AnnouncementEvent =
  | "lastSecondPop"     // popped a trapped bubble in its warning phase
  | "survivedHit"       // lost a life but the run continues
  | "megaChain"         // chain of 5+ pops
  | "recaptureFurious"  // re-trapped an enemy that had broken free
  | "hoarder"           // 3+ enemies trapped before the first pop of a chamber
  | "flawlessClear"     // chamber cleared without damage
  | "venomAscension";   // spelled VENOM, or found a chamber secret

export const ANNOUNCEMENT_LINES: Record<AnnouncementEvent, string> = {
  lastSecondPop: "POP RESPONSIBLY.",
  survivedHit: "THAT WAS PERSONAL.",
  megaChain: "ABSOLUTELY HEXED.",
  recaptureFurious: "YOU LITTLE MENACE.",
  hoarder: "BUBBLE BAD BEHAVIOUR.",
  flawlessClear: "THE WIDOW APPROVES.",
  venomAscension: "SIN. WIN. REPEAT.",
};

/** Higher priority may interrupt the global gap (never the per-line cooldown). */
export const ANNOUNCEMENT_PRIORITY: Record<AnnouncementEvent, number> = {
  lastSecondPop: 1, recaptureFurious: 1, hoarder: 1, megaChain: 2, survivedHit: 2, flawlessClear: 3, venomAscension: 3,
};

export const ANNOUNCER_LIMITS = {
  /** Minimum seconds between any two announcements (unless higher priority). */
  globalGap: 4,
  /** Minimum seconds before the same line can repeat. */
  lineCooldown: 25,
  /** Seconds an announcement stays on screen. */
  displayTime: 1.6,
} as const;

export type Announcement = { event: AnnouncementEvent; text: string; age: number; priority: number };

export class Announcer {
  private clock = 0;
  private lastAny = -Infinity;
  private lastByEvent = new Map<AnnouncementEvent, number>();
  current: Announcement | null = null;
  shown = 0;

  tick(dt: number) {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.clock += step;
    if (this.current) { this.current.age += step; if (this.current.age >= ANNOUNCER_LIMITS.displayTime) this.current = null; }
  }

  /** Returns the announcement if it was accepted, or null when throttled. */
  trigger(event: AnnouncementEvent): Announcement | null {
    const priority = ANNOUNCEMENT_PRIORITY[event];
    const last = this.lastByEvent.get(event) ?? -Infinity;
    if (this.clock - last < ANNOUNCER_LIMITS.lineCooldown) return null;
    const busy = this.clock - this.lastAny < ANNOUNCER_LIMITS.globalGap;
    if (busy && (!this.current || priority <= this.current.priority)) return null;
    const announcement: Announcement = { event, text: ANNOUNCEMENT_LINES[event], age: 0, priority };
    this.current = announcement;
    this.lastAny = this.clock;
    this.lastByEvent.set(event, this.clock);
    this.shown++;
    return announcement;
  }

  /** Clears what is on screen; cooldowns persist so restarts cannot farm lines. */
  hide() { this.current = null; }
}
