const GENTAB_URL_PREFIX = "sabrina://gentab/";

export function parseGenTabIdFromUrl(url: string): string | null {
  if (!url.startsWith(GENTAB_URL_PREFIX)) {
    return null;
  }

  return url.slice(GENTAB_URL_PREFIX.length);
}

export function createGenTabUrl(genTabId: string): string {
  return `${GENTAB_URL_PREFIX}${genTabId}`;
}
