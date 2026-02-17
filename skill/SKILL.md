---
name: job-tracker
description: Manage the Obsidian-based job tracker in the crabpot vault through a validated CLI. Use when adding, updating, or querying job listings — including from job search cron results. Covers CLI-driven note creation/updates in Jobs/ and source-integrity checks.
---

# Job Tracker

Job listings live in `~/obsidian/crabpot/Job Search/Jobs/` as individual Markdown notes with YAML frontmatter. The `Job Search/Job Tracker.base` file provides filtered Obsidian Bases views, and `Job Search/Pipeline.md` embeds those views.

## Interface Rules (CLI-Only)

- Do not read or write job markdown files directly from this skill.
- Use the job tracker CLI for all create, update, and query operations.
- CLI input must be validated by Zod before any write.
- Surface CLI validation errors directly; do not silently coerce invalid fields.

## Required CLI Operations

- `job-tracker exists --canonical-source-url <url>`
  - Primary dedupe check. Canonical URL is the canonical ID for a job.
- `job-tracker add --input <json>`
  - Create a job only after `exists` returns no match.
- `job-tracker update --id <id> --patch <json>`
  - Update an existing job; always set `Updated` to today.
- `job-tracker find --query <text>`
  - Query records when exact canonical URL is not available.

## CLI Implementation Constraints

- Implement the CLI in TypeScript and compile it to a standalone executable with Bun.
- Build command pattern:
  - `bun build ./src/cli.ts --compile --outfile ./bin/job-tracker`
- Keep dependencies minimal:
  - runtime deps: `zod` only
  - avoid additional runtime libraries unless explicitly approved
- Validation boundary:
  - all `add` and `update` payloads must pass Zod validation before write operations

## Dedupe Rules (CRITICAL)

1. Primary key: `Canonical Source URL` (same URL means same job).
2. Always call `exists` with canonical URL before `add`.
3. If canonical URL is unavailable, do not create duplicates blindly:
   - use `find` with normalized `Company + Role + Location`
   - set `Source Status State: needs_review` until canonical URL is known

## File Convention

One note per job: `Job Search/Jobs/{Company} - {Role}.md`

- Replace `/` with `-` in filenames (e.g. `React/TS` → `React-TS`)
- Note body is free-form (interview prep, research, etc.)

## Frontmatter Schema

```yaml
---
Company: string           # Employer name from the official posting
Role: string              # Exact job title
Location: string          # Work location/eligibility (e.g. "Remote", "Dublin", "Remote EU / Berlin")
Job Spec: url             # Primary job description or application link

# Source Provenance (REQUIRED - see Source Integrity Rules below)
Found Via Type: aggregator|board|referral|search|direct|other
Found Via URL: url|null                    # Where this lead was discovered (HN thread, job board page, search results)
Found Via Ref: string|null                  # Human-readable: full link, org name, or recruiter name (NOT raw ID)
Found Via Date: ISO8601|null                # When discovered

Canonical Source URL: url|null              # The actual job posting URL (ATS, careers page, company site)
Canonical Source Kind: ats|company_site|board_repost|unknown
Canonical Source Verified: true|false
Canonical Source Verified At: ISO8601|null
Canonical Source Confidence: high|medium|low

Source Status State: pending|verified|needs_review|broken|unavailable
Source Status Reason: string|null           # Why pending/review/broken
Source Status Last Checked: ISO8601|null

Status: 🔍|📝|💬|✅|🚫      # Pipeline stage (NO QUOTES — see below)
Next Step: string          # Immediate follow-up action or date, empty string if none
Notes: string              # Freeform — comp, stack, interview details, constraints
---
```

## Status Values (NO QUOTES in frontmatter)

- `🔍` — **Interested**: identified and worth pursuing, not yet applied
- `📝` — **Applied**: application submitted
- `💬` — **Interviewing**: in active interview process
- `✅` — **Offer**: offer received
- `🚫` — **Rejected**: rejected by company, withdrawn, or position closed

**Important:** Do NOT quote the emoji in YAML. Use `Status: 💬` not `Status: "💬"`.

## Source Integrity Rules (CRITICAL)

### Never conflate discovery with canonical source

**WRONG:**
```yaml
Source: https://news.ycombinator.com/item?id=46857488  # Main HN thread, not specific job
```

**CORRECT:**
```yaml
Found Via Type: aggregator
Found Via URL: https://hnhired.fly.dev/?q=react
Found Via Ref: https://news.ycombinator.com/item?id=45883675
Found Via Date: 2026-02-11T16:00:00Z

Canonical Source URL: https://jobs.company.com/senior-engineer
Canonical Source Kind: ats
Canonical Source Verified: true
Canonical Source Verified At: 2026-02-11T16:05:00Z
Canonical Source Confidence: high

Source Status State: verified
```

### Verification is mandatory before presenting source as fact

1. **Open the discovered URL** (HN comment, job board post, etc.)
2. **Extract the canonical job URL** from within the content
   - For HN: Look for "Apply at:", company careers links, or ATS URLs
   - For boards: Prefer company ATS over board repost URL
3. **Open the canonical URL** and confirm it contains the job
4. **Record verification details** in `Canonical Source` fields

### When canonical URL cannot be found

```yaml
Canonical Source URL: 
Canonical Source Kind: unknown
Canonical Source Verified: false
Canonical Source Confidence: low

Source Status State: needs_review
Source Status Reason: No canonical URL found in HN comment body; only email contact provided
```

## Contradiction Handling Protocol

When the user says any variant of:
- "I can't find it"
- "Double check this link"
- "This link doesn't work"
- "404" / "Not found"
- "Wrong thread/post"

**STOP. TRIGGER AUDIT:**

1. Acknowledge the contradiction
2. Set `Source Status State: needs_review`
3. Re-open `Found Via URL`
4. Re-extract canonical URL
5. Validate match (company, role, location)
6. Update `Canonical Source` fields with new findings
7. Report back what was found and what changed

**DO NOT continue adding details or enrichment until source is resolved.**

## Adding a New Job

1. Run `job-tracker exists --canonical-source-url <url>` before creating anything.
2. If no existing match, run `job-tracker add --input <json>`.
3. Set `Found` and `Updated` to today.
4. Set `Status: 🔍` (unquoted).
5. **CRITICAL:** Populate `Found Via` AND `Canonical Source` fields.
   - `Found Via URL`: Where you discovered it (HN, board, search)
   - `Canonical Source URL`: The actual job posting (after verification)
   - `Found Via Ref`: Human-readable link or source name (NOT raw ID)
6. If `Canonical Source URL` cannot be verified, set `Source Status State: needs_review`.

## Updating a Job

- Use `job-tracker update --id <id> --patch <json>`; do not edit files directly.
- When changing any field (especially Status), also set `Updated` to today.

When source is questioned, follow **Contradiction Handling Protocol** above.

## Cron Ingestion Guardrails

For automated job search cron jobs:

1. **Never mark aggregator-only records as verified**
   - If source domain is `news.ycombinator.com`, `reddit.com`, `lobste.rs`, etc.
   - Set `Canonical Source Verified: false` and `Source Status State: pending`
   - Queue for manual review

2. **Extract, don't assume**
   - From HN comment body, extract actual company careers/ATS links
   - Don't store the HN thread URL as `Canonical Source URL`

3. **Canonical URL drives dedupe**
   - Check `job-tracker exists --canonical-source-url <url>` before `add`
   - If a match exists, `update` instead of creating a new record

4. **Low confidence for mismatched domains**
   - If `Found Via URL` domain == `Canonical Source URL` domain and it's an aggregator, set `Canonical Source Confidence: low`

5. **Pending SLA**
   - Records with `Source Status State: pending` older than 24 hours → escalate to `needs_review`

6. **Found Via Ref must be human-readable**
   - Full URL for HN: `https://news.ycombinator.com/item?id=45883675`
   - Referral name: `Referral from Sarah`
   - Board listing: `Indeed Ireland listing #abc123`
   - **NOT just:** `45883675` (raw ID without context)

## Base Views

`Job Tracker.base` provides table views:
- **All Jobs** — unfiltered, sorted by Found date descending
- **Interested** — `Status == 🔍`
- **Applied** — `Status == 📝`
- **Interviewing** — `Status == 💬`
- **Concluded** — `Status == ✅` or `Status == 🚫`
- **Pending Verification** — `Source Status State == pending` or `Canonical Source Verified == false`
- **Source Review Queue** — `Source Status State == needs_review` or `Source Status State == broken` or `Canonical Source URL` is empty

Do not edit `Job Tracker.base` or `Pipeline.md` unless the schema changes.

## Examples

### Example 1: HN Comment with Company Careers Link
**Discovery:** HN "Who is Hiring" thread, comment mentions company careers page

```yaml
---
Company: Filen
Role: Senior Full-Stack Developer
Location: Remote EU / Germany
Job Spec: https://jobs.filen.io/senior-full-stack

Found Via Type: aggregator
Found Via URL: https://hnhired.fly.dev/?q=react
Found Via Ref: https://news.ycombinator.com/item?id=45883675
Found Via Date: 2026-02-11T16:00:00Z

Canonical Source URL: https://jobs.filen.io/senior-full-stack
Canonical Source Kind: ats
Canonical Source Verified: true
Canonical Source Verified At: 2026-02-11T16:05:00Z
Canonical Source Confidence: high

Source Status State: verified
Source Status Last Checked: 2026-02-11T16:05:00Z

Status: 💬
Next Step: 2026-02-18T14:30:00
Notes: Interview scheduled for Feb 18 at 2:30pm
---
```

### Example 2: Job Board Repost (Canonical Unknown)
**Discovery:** Indeed Ireland listing, no clear company ATS link

```yaml
---
Company: ExampleCorp
Role: Senior Frontend Engineer
Location: Remote EU
Job Spec: https://example.com/careers

Found Via Type: board
Found Via URL: https://ie.indeed.com/job/senior-engineer-abc123
Found Via Ref: Indeed Ireland listing #abc123
Found Via Date: 2026-02-12T10:00:00Z

Canonical Source URL: 
Canonical Source Kind: unknown
Canonical Source Verified: false
Canonical Source Confidence: low

Source Status State: needs_review
Source Status Reason: Board repost; no company ATS link found in listing
Source Status Last Checked: 2026-02-12T10:00:00Z

Status: 🔍
Next Step: 
Notes: 
---
```

### Example 3: After User Contradiction
**Scenario:** User says "I can't find it at that HN link"

```yaml
# Before audit (WRONG):
Found Via URL: https://news.ycombinator.com/item?id=46857488
Canonical Source URL: https://news.ycombinator.com/item?id=46857488
Source Status State: pending

# After audit (CORRECTED):
Found Via Type: aggregator
Found Via URL: https://hnhired.fly.dev/?q=react
Found Via Ref: https://hnhired.fly.dev
Found Via Date: 2026-02-11T16:00:00Z

Canonical Source URL: https://news.ycombinator.com/item?id=45883675
Canonical Source Kind: board_repost
Canonical Source Verified: true
Canonical Source Verified At: 2026-02-12T20:55:00Z
Canonical Source Confidence: high

Source Status State: verified
Source Status Reason: Corrected after user audit; original was wrong HN thread ID
Source Status Last Checked: 2026-02-12T20:55:00Z
```
