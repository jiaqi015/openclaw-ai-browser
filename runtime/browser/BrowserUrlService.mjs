export function getBrowserUrlLabel(url) {
  if (url === "about:blank") {
    return "新标签页";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") || url;
  } catch {
    return url || "新标签页";
  }
}

export function getBrowserUrlHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
