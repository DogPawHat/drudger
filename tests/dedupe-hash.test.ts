import { expect, test } from "bun:test";
import { computeRecordId, computeUrlDedupeKey } from "../src/core/dedupe";

test("computeRecordId hashes normalized job spec url", () => {
  const a = computeRecordId("https://EXAMPLE.com/jobs/123/?utm_source=mail");
  const b = computeRecordId("https://example.com/jobs/123");

  expect(a).toBe(b);
  expect(a).toHaveLength(64);
});

test("computeUrlDedupeKey uses first 10 chars of record id", () => {
  const id = computeRecordId("https://example.com/jobs/123");
  const dedupeKey = computeUrlDedupeKey("https://example.com/jobs/123");

  expect(dedupeKey).toBe(id.slice(0, 10));
  expect(dedupeKey).toHaveLength(10);
});
