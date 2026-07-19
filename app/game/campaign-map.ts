// Pure layout data for the campaign map screen: chamber nodes arranged as a
// serpentine route through five world clusters (a "haunted arcade circuit"
// rather than a plain grid), plus the edges connecting them in play order.
// Coordinates live in the same 960x720 internal canvas space as gameplay.
import type { WorldId } from "./content.ts";
import { CAMPAIGN_CHAMBERS } from "./campaign.ts";

export type CampaignNodeLayout = {
  index: number;
  x: number;
  y: number;
  worldId: WorldId;
  row: number;
};

const MAP_LEFT = 150;
const MAP_RIGHT = 810;
const MAP_TOP = 175;
const MAP_BOTTOM = 600;
const ROW_COUNT = 5;

export function campaignMapLayout(): CampaignNodeLayout[] {
  const rowSpacing = (MAP_BOTTOM - MAP_TOP) / (ROW_COUNT - 1);
  return CAMPAIGN_CHAMBERS.map(chamber => {
    const worldChambers = CAMPAIGN_CHAMBERS.filter(item => item.worldId === chamber.worldId);
    const count = worldChambers.length;
    const row = chamber.worldOrder;
    const reversed = row % 2 === 1;
    const posInRow = reversed ? count - 1 - chamber.indexInWorld : chamber.indexInWorld;
    const x = count > 1 ? MAP_LEFT + posInRow * ((MAP_RIGHT - MAP_LEFT) / (count - 1)) : (MAP_LEFT + MAP_RIGHT) / 2;
    // Deterministic (not random) wobble so the route reads as a hand-run serpent path
    // rather than a rigid grid, while staying identical every render.
    const y = MAP_TOP + row * rowSpacing + Math.sin(chamber.index * 1.7) * 12;
    return { index: chamber.index, x, y, worldId: chamber.worldId, row };
  });
}

/** Sequential play-order connections between chamber nodes, for drawing the route line. */
export function campaignMapEdges(): [number, number][] {
  return CAMPAIGN_CHAMBERS.slice(0, -1).map((_, i): [number, number] => [i, i + 1]);
}
