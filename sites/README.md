# Public-site review pages

This directory contains one no-build, no-script, no-tracking static page per proposed domain:

| Folder | Review page | Later serving route (not configured by this change) |
| --- | --- | --- |
| `ericbuess.com/` | `index.html` | The future `ericbuess.com` static host, after Eric approves the exact artifact and a separate DNS/hosting change is authorized. |
| `asi.contractors/` | `index.html` | The future `asi.contractors` static host; the current domain forward remains the public Gist until separately changed. |
| `asi.blue/` | `index.html` | The future `asi.blue` static host; the current domain forward remains the Logan proposal Gist until separately changed. |
| `asi.red/` | `index.html` | The future `asi.red` static host, chosen only after Eric approves the page and a separate DNS/hosting change is authorized. |

## Preview

Open any `index.html` file directly in a browser, or run this manually from the desired domain folder:

```sh
python3 -m http.server
```

Then visit `http://localhost:8000/`. No server was started by this change.

## Source boundaries

- `ericbuess.com`: `.runtime/visitor-copy-20260913/personal/index-copy.txt`, the approved positioning proposal, and the Signal Sweep design direction. No personal email address, phone number, or substitute-teacher experience appears.
- `asi.contractors`: `research/asi-contractors/RELEASE-v1.md` at `c41518d6f23c3f5971ef2a1ea370e31e50f3b3dc`, mirrored by the linked public Gist.
- `asi.blue`: the linked Logan Gist’s `01-one-page-brief.md` and `02-full-proposal.md`, plus the ASI domain-role statement in the contractors release.
- `asi.red`: `research/x-article-the-argument/ARTICLE.md` at `ee5d7c9ff41cec489899093ea6f9009f41087e1c`, section “Three things, built in public.” The scope/disclosure sentence is reproduced verbatim.

These files are review artifacts only. They do not configure a host, change a forwarder or DNS, publish a page, or authorize public release.
