import test from "node:test";
import assert from "node:assert/strict";
import {
  describeBrowserSkillCompatibility,
  normalizeSourceRoute,
  resolveBrowserSkillInputPlan,
} from "./BrowserSkillInputPolicyService.mjs";

test("describeBrowserSkillCompatibility classifies summarize as source-url input", () => {
  const compatibility = describeBrowserSkillCompatibility({
    name: "summarize",
    description: "Summarize URLs, podcasts, and local files.",
  });

  assert.equal(compatibility.inputMode, "source-url");
  assert.equal(compatibility.source, "sabrina-overlay");
  assert.deepEqual(compatibility.sourceKinds, ["public-url", "private-url", "local-file"]);
  assert.match(compatibility.useHint, /URL|文件输入/);
});

test("resolveBrowserSkillInputPlan keeps text-native skills on page-snapshot input", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "writer",
      description: "Write and edit content from provided browser context.",
    },
    context: {
      url: "sabrina://history",
    },
  });

  assert.equal(plan.inputMode, "page-snapshot");
  assert.equal(plan.canExecute, true);
  assert.equal(plan.compatibilitySource, "heuristic");
  assert.deepEqual(plan.supportedSourceKinds, []);
  assert.equal(plan.sourceRoute, "page-snapshot");
  assert.equal(plan.failureReason, "");
});

test("skill metadata overrides Sabrina registry and heuristic inference", () => {
  const compatibility = describeBrowserSkillCompatibility({
    name: "summarize",
    description: "Summarize URLs, podcasts, and local files.",
    browserInputMode: "page-snapshot",
    browserUseHint: "这个 skill 明确声明自己消费浏览器快照。",
  });

  assert.equal(compatibility.inputMode, "page-snapshot");
  assert.equal(compatibility.source, "skill-metadata");
  assert.deepEqual(compatibility.sourceKinds, []);
  assert.match(compatibility.useHint, /明确声明/);
});

test("browserCapability descriptor overrides legacy browser skill fields", () => {
  const compatibility = describeBrowserSkillCompatibility({
    name: "summarize",
    browserInputMode: "page-snapshot",
    browserCapability: {
      inputMode: "source-url",
      sourceKinds: ["public-url", "private-url", "local-file"],
      useHint: "Descriptor-first browser compatibility contract.",
      source: "skill-metadata",
      overlay: false,
    },
  });

  assert.equal(compatibility.inputMode, "source-url");
  assert.equal(compatibility.source, "skill-metadata");
  assert.deepEqual(compatibility.sourceKinds, ["public-url", "private-url", "local-file"]);
  assert.match(compatibility.useHint, /Descriptor-first/);
});

test("resolveBrowserSkillInputPlan rejects Sabrina internal surfaces for URL-native skills", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "summarize",
      description: "Summarize URLs, podcasts, and local files.",
    },
    context: {
      url: "sabrina://history",
    },
  });

  assert.equal(plan.inputMode, "source-url");
  assert.equal(plan.canExecute, false);
  assert.equal(plan.sourceRoute, "internal-surface");
  assert.match(plan.failureReason, /内部 surface|内部页/);
});

test("resolveBrowserSkillInputPlan allows private localhost URLs with explicit route note", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "summarize",
      description: "Summarize URLs, podcasts, and local files.",
    },
    context: {
      url: "http://localhost:3000/dashboard",
    },
  });

  assert.equal(plan.canExecute, true);
  assert.equal(plan.sourceRoute, "private-http");
  assert.match(plan.routeNote, /本机|私有地址/);
});

test("normalizeSourceRoute classifies local file and non-http pages explicitly", () => {
  const localFileRoute = normalizeSourceRoute(
    "file:///Users/jiaqi/Documents/Playground/sabrina-ai-browser/package.json",
  );
  const mailtoRoute = normalizeSourceRoute("mailto:test@example.com");

  assert.equal(localFileRoute.kind, "local-file");
  assert.equal(localFileRoute.canExecute, true);
  assert.match(localFileRoute.localFilePath, /package\.json$/);
  assert.equal(mailtoRoute.kind, "non-http");
  assert.equal(mailtoRoute.canExecute, false);
});

test("resolveBrowserSkillInputPlan maps safe file URLs to local file path handoff", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "summarize",
      description: "Summarize URLs, podcasts, and local files.",
    },
    context: {
      url: "file:///Users/jiaqi/Documents/Playground/sabrina-ai-browser/package.json",
    },
  });

  assert.equal(plan.inputMode, "source-url");
  assert.equal(plan.canExecute, true);
  assert.equal(plan.sourceRoute, "local-file");
  assert.match(plan.sourceFilePath, /package\.json$/);
  assert.match(plan.routeNote, /本地绝对路径/);
});

test("resolveBrowserSkillInputPlan rejects local file route when skill does not declare file support", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "url-reader",
      description: "Read URLs from browser context.",
      browserInputMode: "source-url",
      browserSourceKinds: ["public-url", "private-url"],
    },
    context: {
      url: "file:///Users/jiaqi/Documents/Playground/sabrina-ai-browser/package.json",
    },
  });

  assert.equal(plan.canExecute, false);
  assert.equal(plan.sourceRoute, "local-file");
  assert.equal(plan.sourceFilePath, "");
  assert.match(plan.failureReason, /只声明支持：公开链接、本机\/私有链接/);
});

test("resolveBrowserSkillInputPlan prefers Browser Context Package execution facts over ad hoc URL guessing", () => {
  const plan = resolveBrowserSkillInputPlan({
    skill: {
      name: "summarize",
      description: "Summarize URLs, podcasts, and local files.",
    },
    context: {
      primary: {
        title: "Internal page",
        url: "https://example.com/should-not-win",
      },
      execution: {
        primarySourceKind: "internal-surface",
        primarySourceLabel: "Sabrina 或浏览器内部页",
        sourceProtocol: "sabrina:",
        sourceHost: "",
        sourceFilePath: "",
        reachability: "browser-only",
        authBoundary: "internal-only",
        trustLevel: "internal",
        reproducibility: "browser-only",
        lossinessFlags: [],
      },
    },
  });

  assert.equal(plan.canExecute, false);
  assert.equal(plan.sourceRoute, "internal-surface");
  assert.match(plan.failureReason, /内部页|internal surface/);
});
