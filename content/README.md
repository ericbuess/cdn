# The content loop

1. `content/manifest.json` is the whole site's content: every row is `{id, kind: writing|video|podcast|note, title, date, url, categories[], summary, source: x|youtube|site|manual}`, plus optional `audio` (a path), `text` (the quoted body of a note) and `draft: true`.
2. `url` is an absolute `https://` link for anything off-site, or a repository-root-relative path such as `sites/ericbuess.com/the-argument/` for pages in this repo.
3. Adding writing, a video or an episode is one JSON edit: append a row. `designs/essays/` renders it client-side, so nothing needs to be built or deployed.
4. `draft: true` rows render only on the staging host (`*.github.io`, `localhost`, or a local file) and only when the page is opened with `?drafts=1`; on a real domain they never render.
5. `python3 tools/x-export.py` pulls Eric's own X posts into `content/x-posts.json` — either from the API (`X_BEARER_TOKEN` in the environment, never printed; skipped with a message if absent) or from the official X archive: `--archive path/to/twitter-archive.zip`.
6. `python3 tools/x-categorize.py` reads `content/x-posts.json`, assigns categories from a keyword table plus a plain heuristic (no model calls; it leaves `categories` empty when unsure) and appends each post to the manifest as `kind: note`.
7. `content/overrides.json` is the human-edited file and always wins: `{"posts": {"<post id>": ["hardening"]}, "skip": ["<post id>"]}`. `skip` keeps a post off the site entirely.
8. Instead of editing that file, reply to your own X post with a single word from the taxonomy prefixed `cat:` (for example `cat:hardening`). `x-categorize.py` reads those replies from `content/x-posts.json` when the API input was used, and the `cat:` reply itself is never published as a note.
9. Precedence, highest first: `overrides.json` → `cat:` reply → keyword table → heuristic → empty. Both scripts are idempotent and support `--dry-run`, so re-running them never duplicates a row or overwrites a hand-written category.
10. Category names live in three places: this taxonomy in `content/CATEGORIES.md`, the `taxonomy` array in `content/manifest.json` (which drives the filter buttons) and the keyword table in `tools/x-categorize.py`.
