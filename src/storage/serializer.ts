import type { Frontmatter } from "./parser";

function serializeScalar(value: string | boolean | null): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null) {
    return "null";
  }

  return value;
}

export function serializeMarkdownNote(frontmatter: Frontmatter, body: string): string {
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${serializeScalar(value)}`,
  );

  return ["---", ...lines, "---", "", body].join("\n");
}
