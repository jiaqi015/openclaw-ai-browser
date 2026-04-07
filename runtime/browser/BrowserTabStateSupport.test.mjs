import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBrowserAddressInput } from "./BrowserTabStateSupport.mjs";

test("normalizeBrowserAddressInput preserves Sabrina and internal surfaces", () => {
  assert.equal(
    normalizeBrowserAddressInput("sabrina://gentab/test-gen-tab").url,
    "sabrina://gentab/test-gen-tab",
  );
  assert.equal(
    normalizeBrowserAddressInput("internal://history").url,
    "internal://history",
  );
});

test("normalizeBrowserAddressInput still falls back to search for plain text", () => {
  assert.equal(
    normalizeBrowserAddressInput("structured browser workspace").url,
    "https://www.bing.com/search?q=structured%20browser%20workspace",
  );
});
