import { expect, test } from "bun:test";
import { createTempVault } from "../src/testing/tempVault";

test("temp vault helper can create and read a sample note", async () => {
  const vault = await createTempVault();

  try {
    const sampleContent = [
      "---",
      "Company: Acme",
      "Role: Engineer",
      "Job Spec: https://example.com/jobs/123",
      "---",
      "",
      "Applied on Tuesday.",
      "",
    ].join("\n");

    const relativePath = await vault.writeJobNote(
      "Acme - Engineer - abc123def0.md",
      sampleContent,
    );

    const actualContent = await vault.readJobNote(relativePath);

    expect(actualContent).toBe(sampleContent);
  } finally {
    await vault.cleanup();
  }
});
