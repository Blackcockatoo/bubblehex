/**
 * Forbidden Expansion — jukebox records and visual themes (M2).
 * Pure rules so unlocks and save normalisation are unit tested.
 */
import type { MusicTrackId } from "./audio";

export type JukeboxChoice = "auto" | MusicTrackId;
export type JukeboxRecord = { id: JukeboxChoice; vinylsNeeded: number };

/** Cursed Vinyl's purpose: each record collected unlocks the next pressing. */
export const JUKEBOX_RECORDS: readonly JukeboxRecord[] = [
  { id: "auto", vinylsNeeded: 0 },
  { id: "stage", vinylsNeeded: 0 },
  { id: "title", vinylsNeeded: 0 },
  { id: "bonus", vinylsNeeded: 1 },
  { id: "boss", vinylsNeeded: 2 },
];

export const isJukeboxChoice = (value: unknown): value is JukeboxChoice =>
  typeof value === "string" && JUKEBOX_RECORDS.some(record => record.id === value);

export function isRecordUnlocked(choice: JukeboxChoice, vinyls: number): boolean {
  const record = JUKEBOX_RECORDS.find(item => item.id === choice);
  return !!record && Math.max(0, vinyls) >= record.vinylsNeeded;
}

/** Track to play during a chamber: an unlocked override, otherwise the chamber default. */
export function chamberTrack(choice: JukeboxChoice, vinyls: number, chamberDefault: MusicTrackId): MusicTrackId {
  if (choice === "auto" || !isRecordUnlocked(choice, vinyls)) return chamberDefault;
  return choice;
}

export type ThemeId = "default" | "old-vic" | "civilian-signal" | "klein" | "widow-after-dark";
export type ThemeDefinition = { id: ThemeId; panel?: string; accent: string; secondary: string };
export const THEMES: readonly ThemeDefinition[] = [
  { id: "default", accent: "#FF2A9D", secondary: "#20C98B" },
  { id: "old-vic", panel: "panel_old_vic", accent: "#FFD36A", secondary: "#C9A24B" },
  { id: "civilian-signal", panel: "panel_signal", accent: "#4FF3FF", secondary: "#20C98B" },
  { id: "klein", accent: "#9A8CFF", secondary: "#4FF3FF" },
  { id: "widow-after-dark", panel: "panel_velvet", accent: "#C4133D", secondary: "#FF2A9D" },
];
export const isThemeId = (value: unknown): value is ThemeId => typeof value === "string" && THEMES.some(theme => theme.id === value);
export const themeById = (id: unknown): ThemeDefinition => THEMES.find(theme => theme.id === id) ?? THEMES[0];
