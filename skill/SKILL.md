---
name: drudger
description: Use the drudger CLI as the authoritative interface for creating, checking, updating, and searching job records with schema validation and deterministic dedupe behavior.
---

# Drudger CLI

Use this skill when an agent needs to mutate or query job records through the CLI.

For agents and automation, the CLI is the only write interface for job records:
- file creation
- frontmatter/property updates

Direct markdown reads are allowed. Body text (content under frontmatter) may be appended or edited via normal agent tools when needed.

## Interface Rules

- Use CLI commands for all job record mutations.
- Do not manually create job files or manually edit frontmatter properties.
- Validate all `add` and `update` payloads through the CLI schemas.
- Surface validation, duplicate, and not-found errors directly.

## Installation and Availability

- Verify the executable is installed and callable:

```bash
command -v drudger >/dev/null 2>&1 && drudger --help
```

- If `drudger` is missing, follow this repository's install instructions in `README.md`, then rerun the check.
- Expected binary path is typically `~/.local/bin/drudger`; ensure `~/.local/bin` is on `PATH`.

## Vault Root Requirement

- Always pass `--vault-root` explicitly in automation and agent runs.
- Use this default unless the user provides another path:

```bash
--vault-root ~/obsidian/vault
```

- This avoids environment drift and ensures deterministic behavior across hosts.

## Frontmatter Schema

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
- Do not use properties outside this schema, such as `Found Via Date`, `Job Spec Verified At`, or `Source Status Last Checked`.

## CLI Commands

Global options:
- `--vault-root <path>` (always provide explicitly)
- `--format json|text` (default `json`)
- `--quiet` (text mode only)

`exists`
- `drudger exists --vault-root <path> --job-spec-url <url> [--format json|text]`
- Normalizes URL and checks for an existing match.
- Exit codes: `0` success, `2` validation error, `5` storage/read error.

`add`
- `drudger add --vault-root <path> --input <json-or-file-ref> [--format json|text]`
- Always runs dedupe check on job spec URL.
- On duplicate, returns conflict with exit code `3`.
- Exit codes: `0` created, `2` validation error, `3` duplicate, `5` storage/write error.

`update`
- `drudger update --vault-root <path> --id <id> --patch <json-or-file-ref> [--format json|text]`
- Applies partial patch, then revalidates full record.
- If `Job Spec` changes, reruns dedupe conflict check.
- Exit codes: `0` updated, `2` validation error, `3` duplicate, `4` not found, `5` storage/write error.

`find`
- `drudger find --vault-root <path> --query <text> [--status <emoji>] [--limit <n>] [--format json|text]`
- Search fields: `Company`, `Role`, `Location`, `Notes`, `Found Via Ref`, `Job Spec`.
- Default limit `20`, max `200`.
- Exit codes: `0` executed, `2` invalid args, `5` storage/read error.

## Dedupe and IDs

- Primary dedupe key is normalized `Job Spec`.
- Always call `exists` before `add`.
- Treat record `id` as a CLI-owned opaque identifier for lookup/update workflows.
- Do not derive or guess `id` in agent logic; use IDs returned by CLI responses.

## Filename Contract

Filename format:
- `{Company} - {Role} - {dedupeKey}.md`
- Replace `/` with `-`.

`dedupeKey` derivation:
- `first10(sha256(normalize_url(job_spec_url)))`

Rename behavior:
- On update, if `Company`, `Role`, or the URL used for `dedupeKey` changes, rename to the recomputed filename.
- If collision occurs, append ` (2)`, ` (3)`, etc.

## Standard Workflows

Add flow:
1. Validate `drudger` availability.
2. Resolve and pass `--vault-root` explicitly.
3. Run `exists` with job spec URL.
4. If no match, run `add` with schema-valid payload.
5. If duplicate, stop and use existing record metadata.

Update flow:
1. Validate `drudger` availability.
2. Resolve and pass `--vault-root` explicitly.
3. Locate target by `id`.
4. Run `update --patch` with only intended changes.
5. If `Job Spec` changes, handle duplicate conflicts if returned.

## Build/Runtime Constraints

- Language: TypeScript
- Runtime/build: Bun
- Runtime dependency policy: `zod` only
- Build command:

```bash
bun build ./src/cli.ts --compile --outfile ./bin/drudger
```
