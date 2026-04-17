// Context pipeline — extracts page facts into a stable snapshot shape.
// Uses Playwright page.evaluate() for extraction (unified with the agent layer),
// with a direct executeJavaScript fallback for tests and pre-connect startup.
import {
  getBrowserUrlHostname,
  getBrowserUrlLabel,
} from "./BrowserUrlService.mjs";
import { getPlaywrightPage } from "./PlaywrightService.mjs";

export const PAGE_CONTEXT_CACHE_TTL_MS = 1200;

const pageContextSnapshotCache = new Map();
const pageContextSnapshotInFlight = new Map();

// ─── Utilities (unchanged) ────────────────────────────────────────

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(input) {
  return `${input ?? ""}`
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function clipText(input, maxChars) {
  const normalized = normalizeText(input);
  if (!maxChars || normalized.length <= maxChars) {
    return { text: normalized, truncated: false };
  }
  return { text: normalized.slice(0, maxChars).trim(), truncated: true };
}

function inferContentType(url, rawDocumentType) {
  const normalizedType = `${rawDocumentType ?? ""}`.trim().toLowerCase();
  if (normalizedType.includes("pdf") || /\.pdf($|\?)/i.test(url)) return "pdf";
  if (normalizedType.startsWith("image/")) return "image";
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("text/html")) return "webpage";
  return normalizedType || "webpage";
}

function compactArray(values, maxItems) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function compactLinks(values, maxItems) {
  const seen = new Set();
  const result = [];
  for (const entry of Array.isArray(values) ? values : []) {
    const href = `${entry?.href ?? ""}`.trim();
    const label = normalizeText(entry?.label ?? "");
    if (!href || seen.has(href)) continue;
    seen.add(href);
    result.push({ href, label: label || href, external: Boolean(entry?.external) });
    if (result.length >= maxItems) break;
  }
  return result;
}

function cloneSnapshot(snapshot) {
  return typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone(snapshot)
    : JSON.parse(JSON.stringify(snapshot));
}

function getPageContextCacheKey({ webContents, fallbackTitle, fallbackUrl, selectedText, maxPageChars, maxSelectionChars }) {
  const webContentsId = Number(webContents?.id);
  return JSON.stringify({
    webContentsId: Number.isFinite(webContentsId) ? webContentsId : "unknown",
    fallbackTitle: `${fallbackTitle ?? ""}`.trim(),
    fallbackUrl:   `${fallbackUrl ?? ""}`.trim(),
    selectedText:  `${selectedText ?? ""}`.trim(),
    maxPageChars,
    maxSelectionChars,
  });
}

function readCachedPageContextSnapshot(cacheKey) {
  const cached = pageContextSnapshotCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    pageContextSnapshotCache.delete(cacheKey);
    return null;
  }
  return cloneSnapshot(cached.snapshot);
}

export function clearPageContextSnapshotCache() {
  pageContextSnapshotCache.clear();
  pageContextSnapshotInFlight.clear();
}

// ─── DOM extraction (runs inside the browser page) ───────────────
// Pure function — no closures, no module imports.
// Called via page.evaluate(fn, arg) or IIFE via executeJavaScript.

function _domExtract(selText) {
  const normalize = (v) =>
    String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const getMeta = (selector) => {
    const el = document.querySelector(selector);
    return normalize(el?.content || el?.getAttribute("content") || "");
  };

  const selectedText = normalize(
    selText || (window.getSelection ? window.getSelection().toString() : "")
  );

  // OpenGraph (GenTabCodingService already reads og.description)
  const og = {
    title:       getMeta('meta[property="og:title"]'),
    description: getMeta('meta[property="og:description"]'),
    image:       getMeta('meta[property="og:image"]'),
    type:        getMeta('meta[property="og:type"]'),
    siteName:    getMeta('meta[property="og:site_name"]'),
  };

  // JSON-LD structured data (first parseable script block)
  let jsonLd = null;
  try {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const parsed = JSON.parse(s.textContent || "");
      if (parsed && typeof parsed === "object") { jsonLd = parsed; break; }
    }
  } catch (_) { /* ignore malformed JSON-LD */ }

  // Headings h1–h4 (visible only)
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4"))
    .filter(el => {
      const cs = window.getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    })
    .map(el => normalize(el.textContent))
    .filter(Boolean)
    .slice(0, 20);

  // Links (internal + external, up to 20)
  const origin = window.location.origin;
  const links = Array.from(document.querySelectorAll("a[href]"))
    .map(a => ({
      href: a.href,
      label: normalize(a.textContent || a.title || a.href).slice(0, 120),
      external: !a.href.startsWith(origin),
    }))
    .filter(l => l.href.startsWith("http") && l.label)
    .slice(0, 20);

  // Semantic sections (main/article/[role=main]) — was always [] before
  const sectionEls = Array.from(
    document.querySelectorAll("main, article, [role='main']")
  ).slice(0, 5);
  const sections = sectionEls
    .map((el, i) => ({
      id:      String(i + 1),
      title:   normalize(el.querySelector("h1,h2,h3")?.textContent || ""),
      summary: normalize(el.innerText || "").slice(0, 600),
    }))
    .filter(s => s.summary.length > 50);

  // Full page text
  const contentText = normalize(document.body ? document.body.innerText : "");

  // Lead text — first meaningful paragraph or content head
  const firstP = document.querySelector("article p, main p, p");
  const leadText = normalize(firstP?.textContent || contentText).slice(0, 500);

  // Metadata
  const description = getMeta('meta[name="description"]') || og.description || "";
  const language    = normalize(document.documentElement.lang) ||
                      getMeta('meta[name="language"]') || "";
  const docType     = normalize(document.contentType || "text/html");

  return {
    title:       normalize(document.title) || og.title || "",
    url:         String(window.location.href || "").trim(),
    selectedText,
    contentText,
    leadText,
    headings,
    links,
    sections,
    og,
    jsonLd,
    metadata: { description, language, documentContentType: docType },
  };
}

// ─── Extraction runner ────────────────────────────────────────────

async function _extractRaw(webContents, selectedText) {
  // 1. Playwright path (unified with agent layer)
  try {
    const page = await getPlaywrightPage(webContents);
    return await page.evaluate(_domExtract, selectedText || "");
  } catch (_) {
    // Playwright not connected (test env, app startup) → fall through
  }

  // 2. Direct executeJavaScript fallback
  const selArg = JSON.stringify(selectedText || "");
  return await webContents.executeJavaScript(
    `(${_domExtract.toString()})(${selArg})`
  );
}

// ─── Public API ───────────────────────────────────────────────────

export async function extractPageContextSnapshot({
  webContents,
  fallbackTitle = "",
  fallbackUrl = "",
  selectedText = "",
  maxPageChars = 18000,
  maxSelectionChars = 4000,
  cacheTtlMs = PAGE_CONTEXT_CACHE_TTL_MS,
}) {
  const normalizedCacheTtlMs = Number.isFinite(cacheTtlMs) ? Math.max(0, cacheTtlMs) : 0;
  const cacheKey = normalizedCacheTtlMs > 0
    ? getPageContextCacheKey({ webContents, fallbackTitle, fallbackUrl, selectedText, maxPageChars, maxSelectionChars })
    : "";

  if (cacheKey) {
    const cachedSnapshot = readCachedPageContextSnapshot(cacheKey);
    if (cachedSnapshot) return cachedSnapshot;

    const inFlightSnapshot = pageContextSnapshotInFlight.get(cacheKey);
    if (inFlightSnapshot) return cloneSnapshot(await inFlightSnapshot);
  }

  const extractionPromise = (async () => {
    const rawContext = await _extractRaw(webContents, selectedText);

    const finalUrl   = `${rawContext?.url   || fallbackUrl}`.trim();
    const finalTitle = `${rawContext?.title || fallbackTitle || getBrowserUrlLabel(finalUrl)}`.trim();

    const clippedSelection = clipText(`${selectedText || rawContext?.selectedText || ""}`, maxSelectionChars);
    const clippedContent   = clipText(`${rawContext?.contentText || ""}`, maxPageChars);
    const clippedLead      = clipText(
      `${rawContext?.leadText || rawContext?.contentText || ""}`,
      Math.min(2400, maxPageChars)
    );

    const headings = compactArray(rawContext?.headings, 20);
    const sections = (Array.isArray(rawContext?.sections) ? rawContext.sections : [])
      .map(s => ({
        id:      `${s?.id ?? createId("section")}`.trim(),
        title:   normalizeText(s?.title   ?? ""),
        summary: normalizeText(s?.summary ?? ""),
      }))
      .filter(s => s.summary)
      .slice(0, 8);

    const metadata = {
      description:         normalizeText(rawContext?.metadata?.description ?? ""),
      language:            `${rawContext?.metadata?.language            ?? ""}`.trim(),
      documentContentType: `${rawContext?.metadata?.documentContentType ?? ""}`.trim(),
    };

    // og: already expected by GenTabCodingService
    const og = rawContext?.og ?? null;

    // jsonLd: structured data for rich content types (product, recipe, article, event…)
    const jsonLd = rawContext?.jsonLd ?? null;

    return {
      snapshotId:     createId("ctx"),
      capturedAt:     new Date().toISOString(),
      title:          finalTitle,
      url:            finalUrl,
      hostname:       getBrowserUrlHostname(finalUrl),
      contentType:    inferContentType(finalUrl, metadata.documentContentType),
      source:         clippedSelection.text ? "selection" : "page",
      selectedText:   clippedSelection.text,
      contentText:    clippedContent.text,
      contentPreview: clippedContent.text.slice(0, 1200),
      leadText:       clippedLead.text,
      headings,
      sections,
      links:          compactLinks(rawContext?.links, 20),
      og,
      jsonLd,
      metadata,
      extraction: {
        pageTruncated:      clippedContent.truncated,
        selectionTruncated: clippedSelection.truncated,
        quality:
          clippedContent.text.length > 4000 ? "rich"
          : clippedContent.text.length > 800  ? "balanced"
          : clippedContent.text               ? "lite"
          : "minimal",
        approxChars: clippedContent.text.length,
        maxPageChars,
      },
    };
  })();

  if (cacheKey) {
    pageContextSnapshotInFlight.set(cacheKey, extractionPromise);
  }

  try {
    const snapshot = await extractionPromise;
    if (cacheKey) {
      pageContextSnapshotCache.set(cacheKey, {
        snapshot:  cloneSnapshot(snapshot),
        expiresAt: Date.now() + normalizedCacheTtlMs,
      });
    }
    return cloneSnapshot(snapshot);
  } finally {
    if (cacheKey) {
      pageContextSnapshotInFlight.delete(cacheKey);
    }
  }
}
