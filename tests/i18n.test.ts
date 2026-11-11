import assert from "node:assert/strict";
import test from "node:test";
import { CABINET_COPY, LANGS, detectLang } from "../app/game/i18n.ts";

test("every language has every cabinet string", () => {
  const keys = Object.keys(CABINET_COPY.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(CABINET_COPY[lang]).sort(), keys, lang);
    for (const key of keys) {
      const value = (CABINET_COPY[lang] as Record<string, unknown>)[key];
      if (typeof value === "function") {
        assert.ok(String(value(true)).length > 0 && String(value(false)).length > 0, `${lang}.${key}`);
      } else if (typeof value === "string") {
        assert.ok(value.trim().length > 0, `${lang}.${key}`);
      }
    }
  }
});

test("language detection: query, then saved, then browser, then English", () => {
  assert.equal(detectLang("?lang=hi", "ja", ["en-AU"]), "hi");
  assert.equal(detectLang("?lang=xx", "ja", ["hi-IN"]), "ja");
  assert.equal(detectLang("", null, ["fr-FR", "ja-JP"]), "ja");
  assert.equal(detectLang("", null, ["hi-IN"]), "hi");
  assert.equal(detectLang("", "de", ["en-AU"]), "en");
  assert.equal(detectLang("", null, []), "en");
});
