# Leo page audio

Repo tooling, not a daemon. `tools/tts-build.py` extracts readable sections from a page, hashes each chunk, and calls the xAI speech endpoint only for hashes missing from that page directory’s `audio/manifest.json`.

The key must already be in the environment as `XAI_API_KEY`. Use it only for this speech endpoint. Do not print it, write it to a file, or commit it. Do not use it for chat or search.

## Generate or refresh pages

From the `cdn` repo root:

```
python3 tools/tts-build.py designs/personal-light/index.html designs/personal-light/work.html
```

That is the approved pair. Re-running it regenerates only changed chunks and drops orphan MP3s that no remaining page in that directory still lists.

## Later pages (one command, after Eric has read them)

Do not generate for asi.blue, asi.red, the Alignment Hypothesis, the long-form, or its companions until Eric has read those pages. When he has, run the same script on the HTML file:

```
python3 tools/tts-build.py path/to/page.html
```

Examples for later, not now:

```
python3 tools/tts-build.py designs/editorial/research.html
python3 tools/tts-build.py designs/safety/index.html designs/adversarial/index.html
python3 tools/tts-build.py sites/ericbuess.com/the-argument/index.html
```

## Dry run

Print chunk counts and combined characters with no API call and no writes:

```
python3 tools/tts-build.py --dry-run --dump-chunks designs/personal-light/index.html designs/personal-light/work.html
```

The script prints `TOTAL_CHARS` first and stops before any speech request if the combined total exceeds 200,000 characters (`--limit` to change). A billing or quota error stops the run; it does not retry.

Each page directory keeps `audio/manifest.json` with ordered `{hash, title, file, chars}` clips under `pages.<filename>`. The shared player fetches that file and renders the bottom bar only when clips exist for the current page.
