# Job Tracker CLI Package Spec

## 1. Purpose

Build a standalone CLI package for managing the Obsidian job tracker with strict input validation and deterministic dedupe behavior.

The CLI is the only allowed write/read interface for job records. Agents and automation must call this CLI instead of editing markdown directly.

## 2. Scope

In scope:
- Add jobs.
- Check for existing jobs.
- Update jobs.
- Query jobs.
- Preserve existing markdown storage format under `~/obsidian/crabpot/Job Search/Jobs/`.
- Enforce source-integrity and schema validation.

Out of scope:
- UI application.
- Changes to `Job Tracker.base` view definitions.
- Networking/fetching/HTML scraping.

## 3. Hard Constraints

- Language: TypeScript.
- Runtime/build tool: Bun.
- Binary output: Bun-compiled executable.
- Runtime dependency policy: `zod` only.
- No direct consumer writes to markdown files; all writes go through CLI commands.

Build command:

```bash
bun build ./src/cli.ts --compile --outfile ./bin/job-tracker
```

## 4. Package Identity

Recommended package name:
- `@openclaw/job-tracker-cli`

Recommended repository layout:

```text
job-tracker-cli/
  package.json
  bun.lock
  src/
    cli.ts
    commands/
      add.ts
      exists.ts
      update.ts
      find.ts
    core/
      schema.ts
      dedupe.ts
      normalize.ts
      errors.ts
      clock.ts
    storage/
      markdown-store.ts
      parser.ts
      serializer.ts
      paths.ts
      lock.ts
    output/
      print.ts
  test/
    fixtures/
    unit/
    integration/
  bin/
```

## 5. Data Model

## 5.1 Canonical Record Fields

Required record fields for persisted job entries:

- `Company: string`
- `Role: string`
- `Location: string`
- `Job Spec: string (url)`
- `Found Via Type: "aggregator" | "board" | "referral" | "search" | "direct" | "other"`
- `Found Via URL: string | null`
- `Found Via Ref: string | null`
- `Found Via Date: string | null` (ISO8601)
- `Canonical Source URL: string | null`
- `Canonical Source Kind: "ats" | "company_site" | "board_repost" | "unknown"`
- `Canonical Source Verified: boolean`
- `Canonical Source Verified At: string | null` (ISO8601)
- `Canonical Source Confidence: "high" | "medium" | "low"`
- `Source Status State: "pending" | "verified" | "needs_review" | "broken" | "unavailable"`
- `Source Status Reason: string | null`
- `Source Status Last Checked: string | null` (ISO8601)
- `Status: "🔍" | "📝" | "💬" | "✅" | "🚫"` (unquoted in YAML output)
- `Next Step: string`
- `Notes: string`
- `Found: string` (YYYY-MM-DD)
- `Updated: string` (YYYY-MM-DD)

## 5.2 Internal Record ID

CLI should expose a stable computed ID for lookup/update responses:

- `id = sha256(lowercase(trim(canonical_source_url)))` when canonical URL exists.
- If canonical URL is missing, `id = sha256(normalized_company + "|" + normalized_role + "|" + normalized_location)`.

This ID is internal to CLI workflows and does not replace markdown filename conventions.

## 5.3 Zod Schemas

Define:
- `JobRecordSchema` for fully persisted records.
- `AddInputSchema` for create payload.
- `UpdatePatchSchema` for patch payload (partial, then merged and revalidated via `JobRecordSchema`).
- `FindQuerySchema` for query options.

Validation rules:
- URL fields must be syntactically valid URLs when non-null.
- ISO date/time fields must parse as valid ISO8601 strings.
- `Status` is enum of exact emojis.
- `Canonical Source URL` null is allowed, but such records cannot pass canonical dedupe check and must follow fallback find behavior.

## 6. Dedupe Contract

Primary key:
- `Canonical Source URL` (after normalization).

Normalization for URL dedupe:
- Trim whitespace.
- Lowercase scheme and host.
- Remove trailing slash from path (except root `/`).
- Remove known tracking query params (`utm_*`, `ref`, `source`) before compare.
- Preserve meaningful path/query data.

Command behavior:
- `add` must always run `exists` logic first when canonical URL exists.
- If canonical URL match exists, `add` must fail with conflict (exit code `3`) and return existing record metadata.
- If canonical URL is missing, `add` must perform fuzzy fallback query using normalized `Company + Role + Location` and warn on potential duplicate.

## 7. CLI Command Spec

Global options:
- `--vault-root <path>` default: `~/obsidian/crabpot`
- `--format json|text` default: `json`
- `--quiet` suppress non-error logs in text mode

## 7.1 `exists`

Command:

```bash
job-tracker exists --canonical-source-url <url> [--vault-root <path>] [--format json|text]
```

Behavior:
- Normalize URL.
- Search records by canonical URL.
- Return match status and matched record summary.

JSON success output:

```json
{
  "ok": true,
  "exists": true,
  "match": {
    "id": "string",
    "path": "Job Search/Jobs/Company - Role.md",
    "company": "Company",
    "role": "Role",
    "status": "🔍",
    "canonicalSourceUrl": "https://example.com/job/123"
  }
}
```

Exit codes:
- `0`: command executed, no internal error.
- `2`: validation error (invalid URL).
- `5`: storage/read error.

## 7.2 `add`

Command:

```bash
job-tracker add --input <json-or-file-ref> [--vault-root <path>] [--format json|text]
```

Input contract:
- `--input` accepts either inline JSON or `@path/to/file.json`.
- Parse -> `AddInputSchema`.
- Auto-populate `Found` and `Updated` with today if omitted.

Behavior:
- If canonical URL present, run dedupe check.
- If conflict, return existing record and fail with exit code `3`.
- If create allowed, generate markdown filename `Job Search/Jobs/{Company} - {Role}.md` with slash replacement.
- Persist frontmatter and existing body (empty on create unless `body` provided).

Exit codes:
- `0`: created.
- `2`: validation error.
- `3`: duplicate conflict.
- `5`: storage/write error.

## 7.3 `update`

Command:

```bash
job-tracker update --id <id> --patch <json-or-file-ref> [--vault-root <path>] [--format json|text]
```

Behavior:
- Locate record by computed ID.
- Apply partial patch.
- Revalidate full record through `JobRecordSchema`.
- Force `Updated` = today.
- If patch changes canonical URL, rerun dedupe conflict check against other records.

Exit codes:
- `0`: updated.
- `2`: validation error.
- `4`: not found.
- `3`: duplicate conflict.
- `5`: storage/write error.

## 7.4 `find`

Command:

```bash
job-tracker find --query <text> [--status <emoji>] [--limit <n>] [--vault-root <path>] [--format json|text]
```

Behavior:
- Case-insensitive search against `Company`, `Role`, `Location`, `Notes`, `Found Via Ref`, `Canonical Source URL`.
- Optional status filter.
- Default limit `20`, max limit `200`.
- Return compact summaries with `id` and `path`.

Exit codes:
- `0`: executed.
- `2`: invalid arguments.
- `5`: storage/read error.

## 8. Storage and File Semantics

Storage root:
- `${vaultRoot}/Job Search/Jobs`

Filename rule:
- `{Company} - {Role}.md`
- Replace `/` with `-`.
- If collision with different record, append ` (2)`, ` (3)`, etc.

Markdown format:
- YAML frontmatter first.
- One blank line after frontmatter.
- Preserve existing body content on update.

Atomicity:
- Write updates via temp file + rename.
- Use file lock (simple lock file) per target markdown during mutation to avoid concurrent corruption.

## 9. Error Model

Error envelope in JSON mode:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": []
  }
}
```

Canonical error codes:
- `VALIDATION_ERROR`
- `DUPLICATE_CONFLICT`
- `NOT_FOUND`
- `STORAGE_READ_ERROR`
- `STORAGE_WRITE_ERROR`
- `PARSE_ERROR`
- `INTERNAL_ERROR`

Exit code mapping:
- `0`: success/command completed.
- `2`: validation/arg error.
- `3`: dedupe conflict.
- `4`: not found.
- `5`: storage/parsing/internal failure.

## 10. Source Integrity Enforcement

Rules enforced in validators/business logic:
- Never set aggregator thread URL as canonical URL unless the posting truly lives there.
- If `Canonical Source URL` is null, `Source Status State` should not be `verified`.
- If `Canonical Source Verified` is true, `Canonical Source Verified At` must be non-null.
- `Found Via Ref` must be human-readable context, not raw numeric ID only.

## 11. Logging and Output

Default output mode:
- JSON for machine use.

Text mode:
- Concise, single-line summaries for humans.

No hidden coercion:
- Any normalization performed should be visible in JSON response fields.

## 12. Testing Spec

Unit tests:
- Zod schemas (valid/invalid cases).
- URL normalization and dedupe equality.
- Filename sanitization/collision behavior.
- Error-to-exit-code mapping.

Integration tests:
- Add with canonical URL then duplicate add conflict.
- Update with canonical URL change that conflicts.
- Find behavior with filters and limits.
- Markdown roundtrip parse/serialize preserves body.
- Concurrent update lock behavior.

Fixture strategy:
- Temporary vault directories under test runtime.
- Golden markdown fixtures for parse/serialize stability.

## 13. Release and Distribution

Build steps:

```bash
bun install
bun test
bun build ./src/cli.ts --compile --outfile ./bin/job-tracker
```

Package artifacts:
- Source package for development.
- Compiled binary for automation environments.

Versioning:
- Semantic versioning.
- Breaking CLI argument/output contract changes require major bump.

## 14. Implementation Phases

Phase 1:
- Schema + parser/serializer + `exists` + `find`.

Phase 2:
- `add` + dedupe enforcement + atomic writes.

Phase 3:
- `update` + conflict checks + lock behavior.

Phase 4:
- Integration tests + binary build + CI checks.

## 15. Acceptance Criteria

- CLI supports `exists`, `add`, `update`, `find` exactly as specified.
- Canonical URL dedupe is enforced and tested.
- All create/update inputs are Zod-validated.
- Runtime dependency list contains only `zod`.
- Binary builds successfully via Bun compile command.
- No direct markdown edits are needed by users/agents outside CLI operations.
