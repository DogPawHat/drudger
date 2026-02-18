const TRACKING_PARAM_PATTERN = /^utm_/i;
const TRACKING_PARAM_NAMES = new Set(["ref", "source"]);

export function normalizeUrl(input: string): string {
  const value = input.trim();
  const url = new URL(value);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const next = new URLSearchParams();

  for (const [key, queryValue] of url.searchParams.entries()) {
    if (TRACKING_PARAM_PATTERN.test(key)) {
      continue;
    }

    if (TRACKING_PARAM_NAMES.has(key.toLowerCase())) {
      continue;
    }

    next.append(key, queryValue);
  }

  url.search = next.toString();

  return url.toString();
}
