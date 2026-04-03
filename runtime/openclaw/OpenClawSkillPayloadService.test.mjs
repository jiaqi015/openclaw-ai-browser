import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOpenClawSkillPayload } from "./OpenClawSkillPayloadService.mjs";

test("normalizeOpenClawSkillPayload canonicalizes raw skill payload and declared capability", () => {
  const normalized = normalizeOpenClawSkillPayload({
    skillKey: "summarize",
    display_name: "Summarize",
    description: "Summarize URLs and files.",
    eligible: true,
    source: "workspace",
    browserCapability: {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint: "OpenClaw declared capability.",
      source: "skill-metadata",
    },
    install: [{ id: "brew", kind: "package", label: "brew install foo", bins: ["foo"] }],
  });

  assert.equal(normalized.name, "summarize");
  assert.equal(normalized.skillKey, "summarize");
  assert.equal(normalized.displayName, "Summarize");
  assert.equal(normalized.source, "workspace");
  assert.deepEqual(normalized.declaredBrowserCapability, {
    inputMode: "source-url",
    sourceKinds: ["public-url", "private-url", "local-file"],
    useHint: "OpenClaw declared capability.",
    source: "skill-metadata",
    overlay: false,
  });
  assert.equal(normalized.install[0].id, "brew");
});
