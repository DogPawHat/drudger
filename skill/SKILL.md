---
name: job-tracker
description: Use the Job Tracker CLI as the authoritative write interface for Obsidian job records. Covers add/exists/update/find, schema validation, dedupe, filename rules, and source-integrity requirements.
---

# Job Tracker

The source of truth is the Obsidian notes under `Job Search/`, organized by `Job Tracker.base`.

For agents and automation, the CLI is the only authorized write interface for job records:
- file creation
- frontmatter/property updates

Direct markdown reads are allowed. Body text (content under frontmatter) may be appended/updated via normal agent tools (patch, write, edit, etc.)

## Interface Rules

- Use CLI commands for all job record mutations.
- Do not manually create job files or manually edit frontmatter properties.
- Validate all `add` and `update` payloads through Zod-backed CLI schemas.
- Surface validation/duplicate/not-found errors directly; do not silently coerce.

## Canonical Frontmatter Schema

Required fields:
- `Company: string`
- `Role: string`
- `Job Spec: string (url)`

Optional fields:
- `Location?: string`
- `Found Via Type?: aggregator|board|referral|search|direct|other`
- `Found Via URL?: string|null`
- `Found Via Ref?: string|null`
- `Job Spec Kind?: ats|company_site|board_repost|unknown`
- `Job Spec Verified?: boolean`
- `Job Spec Confidence?: high|medium|low`
- `Source Status State?: pending|verified|needs_review|broken|unavailable`
- `Source Status Reason?: string|null`
- `Status?: 🔍|📝|💬|✅|🚫` (unquoted in YAML)
- `Next Step?: string`
- `Notes?: string`

Notes:
- URL fields must be syntactically valid when non-null.
- `Company`, `Role`, and `Job Spec` are required for `add`.
- Do not use non-canonical properties such as `Found Via Date`, `Job Spec Verified At`, or `Source Status Last Checked`.

## CLI Commands

Global options:
- `--vault-root <path>` (default `~/obsidian/crabpot`)
- `--format json|text` (default `json`)
- `--quiet` (text mode only)

`exists`
- `job-tracker exists --job-spec-url <url> [--vault-root <path>] [--format json|text]`
- Normalizes URL and checks for existing match.
- Exit codes: `0` success, `2` validation error, `5` storage/read error.

`add`
- `job-tracker add --input <json-or-file-ref> [--vault-root <path>] [--format json|text]`
- Always runs dedupe check on job spec URL.
- On duplicate returns conflict with exit code `3`.
- Exit codes: `0` created, `2` validation error, `3` duplicate, `5` storage/write error.

`update`
- `job-tracker update --id <id> --patch <json-or-file-ref> [--vault-root <path>] [--format json|text]`
- Applies partial patch, then revalidates full record.
- If `Job Spec` changes, reruns dedupe conflict check.
- Exit codes: `0` updated, `2` validation error, `3` duplicate, `4` not found, `5` storage/write error.

`find`
- `job-tracker find --query <text> [--status <emoji>] [--limit <n>] [--vault-root <path>] [--format json|text]`
- Search fields: `Company`, `Role`, `Location`, `Notes`, `Found Via Ref`, `Job Spec`.
- Default limit `20`, max `200`.
- Exit codes: `0` executed, `2` invalid args, `5` storage/read error.

## Dedupe and IDs

- Primary dedupe key is normalized `Job Spec`.
- Always call `exists` before `add`.
- Treat record `id` as a CLI-owned opaque identifier for lookup/update workflows.
- Do not derive or guess `id` in agent logic; use IDs returned by CLI responses.

## Filename Contract

Storage root:
- `${vaultRoot}/Job Search/Jobs`

Filename format:
- `{Company} - {Role} - {dedupeKey}.md`
- Replace `/` with `-`.

`dedupeKey` derivation:
- `first10(sha256(normalize_url(job_spec_url)))`

Rename behavior:
- On update, if `Company`, `Role`, or the URL used for `dedupeKey` changes, rename the file to match recomputed filename.
- If collision still occurs, append ` (2)`, ` (3)`, etc.

## Source Integrity Rules

- Never use aggregator thread URLs as `Job Spec` unless the posting actually lives there.
- `Found Via Ref` must be human-readable context (not a raw numeric ID only).
- If source evidence is contradictory or broken, set `Source Status State: needs_review` and record a clear `Source Status Reason`.

## Standard Workflows

Add flow:
1. Determine job spec URL.
2. Run `exists` with job spec URL.
3. If no match, run `add` with canonical schema payload.
4. If duplicate, stop and use existing record metadata.

Update flow:
1. Locate target by `id`.
2. Run `update --patch` with only intended changes.
3. If `Job Spec` changes, handle duplicate conflict if returned.
4. If filename-driving fields change, expect rename.

## Build/Runtime Constraints

- Language: TypeScript
- Runtime/build: Bun
- Runtime dependency policy: `zod` only
- Build command:

```bash
bun build ./src/cli.ts --compile --outfile ./job-tracker
```
