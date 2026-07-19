import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_CHAMBERS } from "../app/game/campaign.ts";
import { campaignMapEdges, campaignMapLayout } from "../app/game/campaign-map.ts";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../app/game/physics.ts";

test("every chamber gets exactly one node, in bounds of the internal canvas", () => {
  const layout = campaignMapLayout();
  assert.equal(layout.length, CAMPAIGN_CHAMBERS.length);
  for (const node of layout) {
    assert.ok(node.x >= 0 && node.x <= CANVAS_WIDTH, `node ${node.index} x in bounds`);
    assert.ok(node.y >= 0 && node.y <= CANVAS_HEIGHT, `node ${node.index} y in bounds`);
  }
});

test("layout is deterministic across calls", () => {
  assert.deepEqual(campaignMapLayout(), campaignMapLayout());
});

test("nodes advance world-to-world across five distinct rows matching world order", () => {
  const layout = campaignMapLayout();
  const rows = layout.map(node => node.row);
  assert.deepEqual([...new Set(rows)].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test("route edges connect every chamber to the next in play order, forming one continuous path", () => {
  const edges = campaignMapEdges();
  assert.equal(edges.length, CAMPAIGN_CHAMBERS.length - 1);
  for (const [from, to] of edges) assert.equal(to, from + 1);
});
