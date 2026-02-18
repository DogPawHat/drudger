export type Frontmatter = Record<string, string | boolean | null>;

export type ParsedMarkdownNote = {
  frontmatter: Frontmatter;
  body: string;
};

function parseYamlScalar(value: string): string | boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "null") {
    return null;
  }

  return value;
}

export function parseMarkdownNote(content: string): ParsedMarkdownNote {
  if (!content.startsWith("---\n")) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const closingIndex = content.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const rawFrontmatter = content.slice(4, closingIndex);
  const rest = content.slice(closingIndex + "\n---\n".length);
  const body = rest.startsWith("\n") ? rest.slice(1) : rest;

  const frontmatter: Frontmatter = {};

  for (const line of rawFrontmatter.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const delimiterIndex = line.indexOf(":");
    if (delimiterIndex === -1) {
      continue;
    }

    const key = line.slice(0, delimiterIndex).trim();
    const value = line.slice(delimiterIndex + 1).trim();
    frontmatter[key] = parseYamlScalar(value);
  }

  return {
    frontmatter,
    body,
  };
}
