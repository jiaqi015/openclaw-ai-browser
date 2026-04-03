// Context pipeline is the browser-facing ingestion layer. It extracts page facts
// into a stable snapshot shape that the OpenClaw adapter can consume later.
import {
  getBrowserUrlHostname,
  getBrowserUrlLabel,
} from "./BrowserUrlService.mjs";

export const PAGE_CONTEXT_CACHE_TTL_MS = 1200;

const pageContextSnapshotCache = new Map();
const pageContextSnapshotInFlight = new Map();

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
    return {
      text: normalized,
      truncated: false,
    };
  }

  return {
    text: normalized.slice(0, maxChars).trim(),
    truncated: true,
  };
}

function inferContentType(url, rawDocumentType) {
  const normalizedType = `${rawDocumentType ?? ""}`.trim().toLowerCase();
  if (normalizedType.includes("pdf")) {
    return "pdf";
  }

  if (normalizedType.startsWith("image/")) {
    return "image";
  }

  if (normalizedType.startsWith("video/")) {
    return "video";
  }

  if (normalizedType.startsWith("text/html")) {
    return "webpage";
  }

  if (/\.pdf($|\?)/i.test(url)) {
    return "pdf";
  }

  return normalizedType || "webpage";
}

function compactArray(values, maxItems) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function compactLinks(values, maxItems) {
  const seen = new Set();
  const result = [];

  for (const entry of Array.isArray(values) ? values : []) {
    const href = `${entry?.href ?? ""}`.trim();
    const label = normalizeText(entry?.label ?? "");
    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    result.push({
      href,
      label: label || href,
      external: Boolean(entry?.external),
    });

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function cloneSnapshot(snapshot) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot));
}

function getPageContextCacheKey({
  webContents,
  fallbackTitle,
  fallbackUrl,
  selectedText,
  maxPageChars,
  maxSelectionChars,
}) {
  const webContentsId = Number(webContents?.id);
  return JSON.stringify({
    webContentsId: Number.isFinite(webContentsId) ? webContentsId : "unknown",
    fallbackTitle: `${fallbackTitle ?? ""}`.trim(),
    fallbackUrl: `${fallbackUrl ?? ""}`.trim(),
    selectedText: `${selectedText ?? ""}`.trim(),
    maxPageChars,
    maxSelectionChars,
  });
}

function readCachedPageContextSnapshot(cacheKey) {
  const cached = pageContextSnapshotCache.get(cacheKey);
  if (!cached) {
    return null;
  }

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
  const cacheKey =
    normalizedCacheTtlMs > 0
      ? getPageContextCacheKey({
          webContents,
          fallbackTitle,
          fallbackUrl,
          selectedText,
          maxPageChars,
          maxSelectionChars,
        })
      : "";
  if (cacheKey) {
    const cachedSnapshot = readCachedPageContextSnapshot(cacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const inFlightSnapshot = pageContextSnapshotInFlight.get(cacheKey);
    if (inFlightSnapshot) {
      return cloneSnapshot(await inFlightSnapshot);
    }
  }

  const extractionPromise = (async () => {
    const rawContext = await webContents.executeJavaScript(
      `(() => {
      const cleanText = (input) =>
        String(input ?? "")
          .replace(/\\u00a0/g, " ")
          .replace(/[ \\t]+\\n/g, "\\n")
          .replace(/\\n{3,}/g, "\\n\\n")
          .replace(/[ \\t]{2,}/g, " ")
          .trim();

      const selectedText = cleanText(window.getSelection?.()?.toString?.() ?? "");
      const title = document.title || location.href;
      const url = location.href;
      const body = document.body;
      const metadata = {
        description:
          document.querySelector('meta[name="description"]')?.getAttribute("content") ||
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
          "",
        language: document.documentElement?.lang || "",
        documentContentType: document.contentType || "",
      };

      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((node) => cleanText(node.textContent || ""))
        .filter(Boolean)
        .slice(0, 18);

      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((node) => {
          const href = node.href || "";
          const label = cleanText(node.textContent || node.getAttribute("aria-label") || "");
          return {
            href,
            label,
            external: href ? new URL(href, location.href).origin !== location.origin : false,
          };
        })
        .filter((entry) => entry.href)
        .slice(0, 24);

      if (!body) {
        return {
          title,
          url,
          selectedText,
          metadata,
          headings,
          links,
          contentText: "",
          leadText: "",
          sections: [],
        };
      }

      const clone = body.cloneNode(true);
      clone
        .querySelectorAll("script, style, nav, footer, aside, noscript, template, svg, canvas")
        .forEach((node) => node.remove());

      const contentText = cleanText(clone.innerText || "");
      const leadText = cleanText(
        clone.querySelector("main, article, [role='main']")?.innerText ||
          clone.querySelector("p")?.innerText ||
          "",
      );

      const sections = Array.from(clone.querySelectorAll("h1, h2, h3"))
        .map((node, index) => {
          const title = cleanText(node.textContent || "");
          if (!title) {
            return null;
          }

          const siblingTexts = [];
          let pointer = node.nextElementSibling;
          while (pointer && siblingTexts.length < 2) {
            const nextText = cleanText(pointer.textContent || "");
            if (nextText) {
              siblingTexts.push(nextText);
            }
            pointer = pointer.nextElementSibling;
          }

          return {
            id: \`section-\${index + 1}\`,
            title,
            summary: cleanText(siblingTexts.join("\\n\\n")).slice(0, 600),
          };
        })
        .filter(Boolean)
        .slice(0, 12);

      return {
        title,
        url,
        selectedText,
        metadata,
        headings,
        links,
        contentText,
        leadText,
        sections,
      };
      })()`,
      true,
    );

    const finalUrl = `${rawContext?.url || fallbackUrl}`.trim();
    const finalTitle = `${rawContext?.title || fallbackTitle || getBrowserUrlLabel(finalUrl)}`.trim();
    const clippedSelection = clipText(
      `${selectedText || rawContext?.selectedText || ""}`,
      maxSelectionChars,
    );
    const clippedContent = clipText(`${rawContext?.contentText || ""}`, maxPageChars);
    const clippedLead = clipText(
      `${rawContext?.leadText || rawContext?.contentText || ""}`,
      Math.min(2400, maxPageChars),
    );
    const headings = compactArray(rawContext?.headings, 12);
    const sections = (Array.isArray(rawContext?.sections) ? rawContext.sections : [])
      .map((section) => ({
        id: `${section?.id ?? createId("section")}`.trim(),
        title: normalizeText(section?.title ?? ""),
        summary: normalizeText(section?.summary ?? ""),
      }))
      .filter((section) => section.title && section.summary)
      .slice(0, 8);
    const metadata = {
      description: normalizeText(rawContext?.metadata?.description ?? ""),
      language: `${rawContext?.metadata?.language ?? ""}`.trim(),
      documentContentType: `${rawContext?.metadata?.documentContentType ?? ""}`.trim(),
    };

    return {
      snapshotId: createId("ctx"),
      capturedAt: new Date().toISOString(),
      title: finalTitle,
      url: finalUrl,
      hostname: getBrowserUrlHostname(finalUrl),
      contentType: inferContentType(finalUrl, metadata.documentContentType),
      source: clippedSelection.text ? "selection" : "page",
      selectedText: clippedSelection.text,
      contentText: clippedContent.text,
      contentPreview: clippedContent.text.slice(0, 1200),
      leadText: clippedLead.text,
      headings,
      sections,
      links: compactLinks(rawContext?.links, 12),
      metadata,
      extraction: {
        pageTruncated: clippedContent.truncated,
        selectionTruncated: clippedSelection.truncated,
        quality:
          clippedContent.text.length > 4000
            ? "rich"
            : clippedContent.text.length > 800
              ? "balanced"
              : clippedContent.text
                ? "lite"
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
        snapshot: cloneSnapshot(snapshot),
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
