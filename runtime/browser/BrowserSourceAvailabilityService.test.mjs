import test from "node:test";
import assert from "node:assert/strict";
import { buildBrowserSourceAvailability } from "./BrowserSourceAvailabilityService.mjs";

test("buildBrowserSourceAvailability marks loading tabs as unavailable until ready", () => {
  const availability = buildBrowserSourceAvailability({
    url: "https://github.com/cline/cline",
    loading: true,
    lastError: null,
  });

  assert.equal(availability.state, "loading");
  assert.equal(availability.reason, "page-loading");
  assert.equal(availability.canReference, false);
  assert.equal(availability.canUseAsPrimary, false);
});

test("buildBrowserSourceAvailability marks browser pages as ready sources", () => {
  const availability = buildBrowserSourceAvailability({
    url: "https://github.com/features/copilot",
    loading: false,
    lastError: null,
  });

  assert.equal(availability.state, "ready");
  assert.equal(availability.reason, "ready");
  assert.equal(availability.canReference, true);
  assert.equal(availability.canUseAsPrimary, true);
});

test("buildBrowserSourceAvailability rejects internal surfaces", () => {
  const availability = buildBrowserSourceAvailability({
    url: "sabrina://history",
    loading: false,
    lastError: null,
  });

  assert.equal(availability.state, "unavailable");
  assert.equal(availability.reason, "internal-surface");
  assert.equal(availability.canReference, false);
});
