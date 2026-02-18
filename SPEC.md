# Job Tracker CLI Package Spec

## 1. Purpose

Build a standalone CLI package for managing the Obsidian job tracker with strict input validation and deterministic dedupe behavior.

The source of truth is the Obsidian notes under `Job Search/`, organized by `Job Tracker.base` (reference layout: `example-jobs/Job Search/`).

For agents and automation, the CLI is the only authorized write interface for job records (file creation and frontmatter/property updates). Agents and automation must call this CLI instead of editing markdown directly.

Direct reads of markdown are allowed. The CLI may also append/update body text (content under frontmatter) directly in an existing job file when needed.

## 2. Scope

In scope:
- Add jobs.
- Check for existing jobs.
- Update jobs.
- Query jobs.
- Preserve existing markdown storage format under `~/obsidian/crabpot/Job Search/Jobs/`.
- Preserve compatibility with `~/obsidian/crabpot/Job Search/Job Tracker.base` organization and property/view expectations.
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
- Only the CLI may create job files or modify frontmatter/properties.

Build command:

```bash
bun build ./src/cli.ts --compile --outfile ./bin/drudger
```

## 4. Package Identity

Recommended package name:
- `drudger`

Recommended repository layout:

```text
drudger/
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
    storage/
      markdown-store.ts
      parser.ts
      serializer.ts
      paths.ts
      lock.ts
    output/
      print.ts
```

## 5. Data Model

## 5.1 Record Fields

Persisted job entries must include:

- `Company: string`
- `Role: string`
- `Job Spec: string (url)`

All other fields are optional:

- `Location?: string`
- `Found Via Type?: "aggregator" | "board" | "referral" | "search" | "direct" | "other"`
- `Found Via URL?: string | null`
- `Found Via Ref?: string | null`
- `Job Spec Kind?: "ats" | "company_site" | "board_repost" | "unknown"`
- `Job Spec Verified?: boolean`
- `Job Spec Confidence?: "high" | "medium" | "low"`
- `Source Status State?: "pending" | "verified" | "needs_review" | "broken" | "unavailable"`
- `Source Status Reason?: string | null`
- `Status?: "🔍" | "📝" | "💬" | "✅" | "🚫"` (unquoted in YAML output)
- `Next Step?: string`
- `Notes?: string`

## 5.2 Internal Record ID

CLI should expose a stable computed ID for lookup/update responses:

- `id = sha256(normalize_url(job_spec_url))` when job spec URL exists.
- If job spec URL is missing, `id = sha256(normalized_company + "|" + normalized_role + "|" + normalized_location)`.

`normalize_url(...)` for ID computation must use the same normalization rules defined in Section 6 (Dedupe Contract).

This ID is internal to CLI workflows and does not replace markdown filename conventions.

## 5.3 Zod Schemas

Define:
- `JobRecordSchema` for fully persisted records.
- `AddInputSchema` for create payload.
- `UpdatePatchSchema` for patch payload (partial, then merged and revalidated via `JobRecordSchema`).
- `FindQuerySchema` for query options.

Validation rules:
- URL fields must be syntactically valid URLs when non-null.
- `Status` is enum of exact emojis.
- `Company`, `Role`, and `Job Spec` are required for `add`.

## 5.4 Current Note Schema Differences (Informational Only)

The schema contract in Sections 5.1-5.3 is the active schema. Example notes and `Job Tracker.base` are aligned to this schema at this time.

## 6. Dedupe Contract

Primary key:
- `Job Spec` (after normalization).

Normalization for URL dedupe:
- Trim whitespace.
- Lowercase scheme and host.
- Remove trailing slash from path (except root `/`).
- Remove known tracking query params (`utm_*`, `ref`, `source`) before compare.
- Preserve meaningful path/query data.

Command behavior:
- `add` must always run `exists` logic first.
- If job spec URL match exists, `add` must fail with conflict (exit code `3`) and return existing record metadata.

## 7. CLI Command Spec

Global options:
- `--vault-root <path>` default: `~/obsidian/crabpot`
- `--format json|text` default: `json`
- `--quiet` suppress non-error logs in text mode
- Backward-compatible flag alias (temporary): `--canonical-source-url` is accepted as an alias for `--job-spec-url`.

## 7.1 `exists`

Command:

```bash
drudger exists --job-spec-url <url> [--vault-root <path>] [--format json|text]
```

Compatibility:
- `--canonical-source-url <url>` must be accepted as a deprecated alias for one release window.
- When alias is used, behavior must be identical to `--job-spec-url`, and JSON output may include a deprecation warning.

Behavior:
- Normalize job spec URL.
- Search records by job spec URL.
- Return match status and matched record summary.

JSON success output:

```json
{
  "ok": true,
  "exists": true,
  "match": {
    "id": "string",
    "path": "Job Search/Jobs/Company - Role - ab12cd34ef.md",
    "company": "Company",
    "role": "Role",
    "status": "🔍",
    "jobSpec": "https://example.com/job/123"
  }
}
```

Exit codes:
- `0`: command executed, no internal error.
- `2`: validation error (invalid job spec URL).
- `5`: storage/read error.

## 7.2 `add`

Command:

```bash
drudger add --input <json-or-file-ref> [--vault-root <path>] [--format json|text]
```

Input contract:
- `--input` accepts either inline JSON or `@path/to/file.json`.
- Parse -> `AddInputSchema`.
- `Company`, `Role`, and `Job Spec` are required.
- Every other field is optional.

Behavior:
- Run dedupe check on `Job Spec`.
- If conflict, return existing record and fail with exit code `3`.
- If create allowed, generate markdown filename `Job Search/Jobs/{Company} - {Role} - {dedupeKey}.md` with slash replacement.
- Persist frontmatter and existing body (empty on create unless `body` provided).

Exit codes:
- `0`: created.
- `2`: validation error.
- `3`: duplicate conflict.
- `5`: storage/write error.

## 7.3 `update`

Command:

```bash
drudger update --id <id> --patch <json-or-file-ref> [--vault-root <path>] [--format json|text]
```

Behavior:
- Locate record by computed ID.
- Apply partial patch.
- Revalidate full record through `JobRecordSchema`.
- If patch changes `Job Spec`, rerun dedupe conflict check against other records.
- If patch changes `Job Spec` (or changes the URL used to derive `dedupeKey`), recompute `dedupeKey` and rename the file to match the filename rule.

Exit codes:
- `0`: updated.
- `2`: validation error.
- `4`: not found.
- `3`: duplicate conflict.
- `5`: storage/write error.

## 7.4 `find`

Command:

```bash
drudger find --query <text> [--status <emoji>] [--limit <n>] [--vault-root <path>] [--format json|text]
```

Behavior:
- Case-insensitive search against `Company`, `Role`, `Location`, `Notes`, `Found Via Ref`, `Job Spec`.
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
- `{Company} - {Role} - {dedupeKey}.md`
- Replace `/` with `-`.
- `dedupeKey` is derived from URL hash:
  - `dedupeKey = first10(sha256(normalize_url(job_spec_url)))`.
- If collision still occurs (extremely unlikely), append ` (2)`, ` (3)`, etc.
- On update, if `Company`, `Role`, or the URL used for `dedupeKey` changes, the file must be renamed to the newly computed filename.

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
- Never set aggregator thread URL as `Job Spec` unless the posting truly lives there.
- `Company`, `Role`, and `Job Spec` are required for `add` and cannot be removed by `update`.
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
- Filename sanitization and URL-based dedupe key generation.
- Error-to-exit-code mapping.

Integration tests:
- Add with job spec URL then duplicate add conflict.
- Update with job spec URL change that conflicts.
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
bun build ./src/cli.ts --compile --outfile ./bin/drudger
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
- Job spec URL dedupe is enforced and tested.
- All create/update inputs are Zod-validated.
- Runtime dependency list contains only `zod`.
- Binary builds successfully via Bun compile command.
- No direct markdown edits are needed by users/agents outside CLI operations.
