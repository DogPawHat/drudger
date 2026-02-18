# Job Tracker CLI Implementation Handoff Plan (TDD Vertical Slices)

## Context

- Canonical schema uses `Job Spec` fields (not `Canonical Source*`).
- CLI alias required: `--canonical-source-url` accepted as deprecated alias for `--job-spec-url`.
- Real vault migration is complete.
- Runtime deps policy: `zod` only.
- Use Bun tooling (`bun test`, `bun build`).

## Test Strategy

- Use `bun:test` only.
- Strict RED->GREEN vertical slices (one behavior at a time).
- Prefer behavior/integration tests via public interfaces.

## Slice Order

1. Tracer bullet
   - RED: temp vault helper test can create/read sample note.
   - GREEN: minimal fixture helper.

2. URL normalization
   - RED: normalize rules from spec (trim, lowercase scheme/host, trailing slash rules, strip `utm_*`, `ref`, `source`).
   - GREEN: `normalize_url` implementation.

3. Hash contracts
   - RED: `id = sha256(normalize_url(job_spec_url))`, `dedupeKey = first10(sha256(normalize_url(job_spec_url)))`.
   - GREEN: hash helpers.

4. Schemas
   - RED: required fields (`Company`, `Role`, `Job Spec`), enums, URL validation.
   - GREEN: `JobRecordSchema`, `AddInputSchema`, `UpdatePatchSchema`, `FindQuerySchema`.

5. Parser/serializer
   - RED: parse frontmatter + preserve body; roundtrip stability.
   - GREEN: parser/serializer modules.

6. `exists` command
   - RED: `exists --job-spec-url` finds by normalized `Job Spec`.
   - RED: alias `--canonical-source-url` behaves identically (+ deprecation warning allowance).
   - GREEN: command implementation + output envelope.

7. `add` command (create)
   - RED: valid add creates file under `Job Search/Jobs`.
   - RED: filename format `{Company} - {Role} - {dedupeKey}.md` with `/` replaced by `-`.
   - GREEN: create path + atomic write.

8. `add` command (duplicate)
   - RED: duplicate `Job Spec` returns conflict, exit code `3`.
   - GREEN: dedupe check before write.

9. `find` command
   - RED: case-insensitive search over spec fields.
   - RED: status filter + default/maximum limits.
   - GREEN: find implementation.

10. `update` command (basic)
    - RED: update by id, patch + revalidate, preserve body.
    - RED: not found => exit `4`.
    - GREEN: update path.

11. `update` conflict + rename
    - RED: changing `Job Spec` to existing match => conflict `3`.
    - RED: changing `Company` / `Role` / `Job Spec` renames file to recomputed filename.
    - RED: collision fallback suffix `(2)`, `(3)`.
    - GREEN: rename/collision logic.

12. Locking
    - RED: concurrent mutation test shows no corruption.
    - GREEN: lockfile + temp-file-rename flow.

13. Output/error contract
    - RED: JSON success/error envelopes and exit code mapping match spec.
    - RED: text mode concise output.
    - GREEN: output/error modules.

## Refactor Pass (After All Green)

- Extract shared command parsing and `--input` loader (`inline JSON` vs `@file`).
- Deepen modules (`core/*`, `storage/*`, `output/*`).
- Keep tests green after each refactor step.

## Build Verification

- `bun test`
- `bun build ./src/cli.ts --compile --outfile ./bin/job-tracker`
- Smoke run commands against fixture vault.
