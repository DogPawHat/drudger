Migrate the real job tracker notes in `~/obsidian/crabpot/Job Search/` to the current schema/contract defined in `SPEC.md` in this repo.

Authoritative references:
- `/home/dogpawhat/Development/job-tracker/SPEC.md`
- `/home/dogpawhat/Development/job-tracker/example-jobs/Job Search/Job Tracker.base`
- `/home/dogpawhat/Development/job-tracker/example-jobs/Job Search/Jobs/`

Scope:
1) Migrate `~/obsidian/crabpot/Job Search/Job Tracker.base`
2) Migrate all files under `~/obsidian/crabpot/Job Search/Jobs/*.md`

Required schema migration:
- Rename frontmatter field `Canonical Source URL` -> `Job Spec`
- Rename frontmatter field `Canonical Source Kind` -> `Job Spec Kind`
- Rename frontmatter field `Canonical Source Verified` -> `Job Spec Verified`
- Rename frontmatter field `Canonical Source Confidence` -> `Job Spec Confidence`

Also remove non-canonical fields if present:
- `Found Via Date`
- `Job Spec Verified At`
- `Source Status Last Checked`

Normalize enum drift if present:
- `Found Via Type: hn` -> `Found Via Type: aggregator`
- `Job Spec Kind: aggregator` -> `Job Spec Kind: board_repost`

`Job Tracker.base` requirements:
- Properties must use `Job Spec`, `Job Spec Kind`, `Job Spec Verified`, `Job Spec Confidence`
- Update view columns/filters/sorts to reference `Job Spec*` names
- Ensure no references remain to `Canonical Source*`

Filename requirements (do not skip):
- Each job file must be named `{Company} - {Role} - {dedupeKey}.md`
- Replace `/` with `-` in company/role segments
- `dedupeKey = first10(sha256(normalize_url(job_spec_url)))`
- URL normalization for dedupe:
  - trim
  - lowercase scheme + host
  - remove trailing slash (except root `/`)
  - remove query params `utm_*`, `ref`, `source`
  - preserve meaningful path/query otherwise
- If collision still occurs, append ` (2)`, ` (3)`, etc.

Behavior and safety rules:
- Preserve markdown body text under frontmatter exactly
- Do not reorder semantic content in body
- If a required field is missing (`Company`, `Role`, `Job Spec`), report file and stop for manual review unless recoverable from existing equivalent fields
- If `Job Spec` is empty but a legacy equivalent URL field exists, fill from that equivalent before continuing

Validation checks to run and report:
1) Count migrated files
2) Confirm zero remaining `Canonical Source` references in:
   - `~/obsidian/crabpot/Job Search/Job Tracker.base`
   - `~/obsidian/crabpot/Job Search/Jobs/*.md`
3) Confirm every job file has required fields:
   - `Company`, `Role`, `Job Spec`
4) Confirm every filename matches computed dedupe key
5) Confirm all disallowed fields were removed

Output format required at end:
- A concise migration summary
- A full rename map: old filename -> new filename
- Any files skipped/failed with exact reason
- Validation results for checks (1)-(5)

Do not commit changes.
