import { expect, test } from "bun:test";
import { normalizeUrl } from "../src/core/normalize";

test("normalizeUrl trims input and lowercases scheme/host", () => {
  const actual = normalizeUrl("  HTTPS://EXAMPLE.COM/Jobs/123  ");
  expect(actual).toBe("https://example.com/Jobs/123");
});

test("normalizeUrl removes trailing slash for non-root paths", () => {
  const actual = normalizeUrl("https://example.com/jobs/123/");
  expect(actual).toBe("https://example.com/jobs/123");
});

test("normalizeUrl preserves root slash", () => {
  const actual = normalizeUrl("https://example.com/");
  expect(actual).toBe("https://example.com/");
});

test("normalizeUrl strips tracking params and keeps meaningful query data", () => {
  const actual = normalizeUrl(
    "https://example.com/jobs/123?utm_source=mail&source=x&ref=abc&page=2&sort=desc&utm_medium=email",
  );

  expect(actual).toBe("https://example.com/jobs/123?page=2&sort=desc");
});
