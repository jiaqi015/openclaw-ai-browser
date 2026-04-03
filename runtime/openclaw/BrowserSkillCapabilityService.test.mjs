import test from "node:test";
import assert from "node:assert/strict";
import { getDeclaredBrowserSkillCompatibility } from "./BrowserSkillCapabilityService.mjs";

test("overlay browserCapability is not treated as declared metadata", () => {
  const declared = getDeclaredBrowserSkillCompatibility({
    name: "summarize",
    browserCapability: {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint: "Overlay-only capability.",
      source: "sabrina-overlay",
      overlay: true,
    },
    browserInputMode: "source-url",
    browserSourceKinds: ["public-url", "private-url", "local-file"],
  });

  assert.equal(declared, null);
});

test("declared browserCapability takes precedence over legacy flat fields", () => {
  const declared = getDeclaredBrowserSkillCompatibility({
    name: "summarize",
    browserInputMode: "page-snapshot",
    browserCapability: {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint: "Descriptor-first browser capability.",
      source: "skill-metadata",
      overlay: false,
    },
  });

  assert.deepEqual(declared, {
    inputMode: "source-url",
    sourceKinds: ["public-url", "private-url", "local-file"],
    useHint: "Descriptor-first browser capability.",
    source: "skill-metadata",
    overlay: false,
  });
});
