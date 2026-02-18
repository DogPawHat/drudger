import { expect, test } from "bun:test";
import {
  AddInputSchema,
  FindQuerySchema,
  JobRecordSchema,
  UpdatePatchSchema,
} from "../src/core/schema";

test("AddInputSchema requires Company, Role, and Job Spec", () => {
  const parsed = AddInputSchema.safeParse({
    Company: "Acme",
    Role: "Engineer",
    "Job Spec": "https://example.com/jobs/123",
  });

  expect(parsed.success).toBe(true);

  const missing = AddInputSchema.safeParse({
    Company: "Acme",
  });

  expect(missing.success).toBe(false);
});

test("schemas validate urls when provided", () => {
  const invalid = AddInputSchema.safeParse({
    Company: "Acme",
    Role: "Engineer",
    "Job Spec": "not-a-url",
  });

  expect(invalid.success).toBe(false);

  const validRecord = JobRecordSchema.safeParse({
    Company: "Acme",
    Role: "Engineer",
    "Job Spec": "https://example.com/jobs/123",
    "Found Via URL": "https://news.ycombinator.com/item?id=1",
  });

  expect(validRecord.success).toBe(true);
});

test("schemas enforce status and source enums", () => {
  const ok = JobRecordSchema.safeParse({
    Company: "Acme",
    Role: "Engineer",
    "Job Spec": "https://example.com/jobs/123",
    Status: "🔍",
    "Found Via Type": "board",
    "Job Spec Kind": "ats",
    "Job Spec Confidence": "high",
  });

  expect(ok.success).toBe(true);

  const bad = JobRecordSchema.safeParse({
    Company: "Acme",
    Role: "Engineer",
    "Job Spec": "https://example.com/jobs/123",
    Status: "in-progress",
  });

  expect(bad.success).toBe(false);
});

test("UpdatePatchSchema allows partial updates", () => {
  const parsed = UpdatePatchSchema.safeParse({
    Notes: "Follow up next week",
  });

  expect(parsed.success).toBe(true);
});

test("FindQuerySchema defaults and enforces max limit", () => {
  const withDefault = FindQuerySchema.parse({
    query: "engineer",
  });

  expect(withDefault.limit).toBe(20);

  const invalid = FindQuerySchema.safeParse({
    query: "engineer",
    limit: 500,
  });

  expect(invalid.success).toBe(false);
});
