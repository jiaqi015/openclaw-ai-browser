import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSkillMetadata } from "./SkillCatalogService.mjs";

test("normalizeSkillMetadata keeps explicit declared browser capability separate from resolved capability", () => {
  const normalized = normalizeSkillMetadata({
    name: "summarize",
    eligible: true,
    browserCapability: {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint: "OpenClaw-declared browser capability.",
      source: "skill-metadata",
    },
  });

  assert.equal(normalized.browserCapabilityDeclared, true);
  assert.deepEqual(normalized.declaredBrowserCapability, {
    inputMode: "source-url",
    sourceKinds: ["public-url", "private-url", "local-file"],
    useHint: "OpenClaw-declared browser capability.",
    source: "skill-metadata",
    overlay: false,
  });
  assert.deepEqual(normalized.browserCapability, normalized.declaredBrowserCapability);
  assert.equal(normalized.browserCompatibilitySource, "skill-metadata");
});

test("normalizeSkillMetadata leaves declared browser capability empty when Sabrina overlay is used", () => {
  const normalized = normalizeSkillMetadata({
    name: "summarize",
    eligible: true,
    description: "Summarize URLs, podcasts, and local files.",
  });

  assert.equal(normalized.browserCapabilityDeclared, false);
  assert.equal(normalized.declaredBrowserCapability, null);
  assert.equal(normalized.browserCapability.source, "sabrina-overlay");
  assert.equal(normalized.browserCapability.overlay, true);
});
