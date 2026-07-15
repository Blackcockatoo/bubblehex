import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const htmlPath = fileURLToPath(new URL("../.next/server/app/index.html", import.meta.url));

test("production build renders BubbleHex with correct branding and no dev-only metadata", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.match(html, /<title>BUBBLE HEX — Blue \$nake Studio<\/title>/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="720"/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /localhost/i, "production markup must not reference localhost");
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
});
