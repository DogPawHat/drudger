import { expect, test } from "bun:test";
import { parseMarkdownNote } from "../src/storage/parser";
import { serializeMarkdownNote } from "../src/storage/serializer";

test("parseMarkdownNote reads frontmatter and preserves body", () => {
  const input = [
    "---",
    "Company: Acme",
    "Role: Engineer",
    "Job Spec: https://example.com/jobs/123",
    "Status: 🔍",
    "---",
    "",
    "First paragraph.",
    "",
    "Second paragraph.",
    "",
  ].join("\n");

  const parsed = parseMarkdownNote(input);

  expect(parsed.frontmatter.Company).toBe("Acme");
  expect(parsed.frontmatter.Role).toBe("Engineer");
  expect(parsed.frontmatter["Job Spec"]).toBe("https://example.com/jobs/123");
  expect(parsed.body).toBe("First paragraph.\n\nSecond paragraph.\n");
});

test("serializeMarkdownNote roundtrips parse output", () => {
  const input = [
    "---",
    "Company: Acme",
    "Role: Engineer",
    "Job Spec: https://example.com/jobs/123",
    "Status: 🔍",
    "---",
    "",
    "Hello world.",
    "",
  ].join("\n");

  const parsed = parseMarkdownNote(input);
  const output = serializeMarkdownNote(parsed.frontmatter, parsed.body);

  expect(output).toBe(input);
});
