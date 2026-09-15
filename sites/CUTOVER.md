# Public-site cutover instructions (no changes made)

Instructions only. No DNS, registrar, Porkbun, Cloudflare, or GitHub Pages custom-domain change was performed. DNS cutover is Eric's explicit go. Staged review copies are unlinked: they live under the existing public `ericbuess/cdn` GitHub Pages site and are not referenced from any domain, profile, or gist.

**Go word:** after Eric reviews the staged URLs, a single explicit “go” authorizes the interim URL-forward change below. It does not by itself authorize the later proper-host DNS records.

**Publish window held for:** Tue 15 Sep 2026, 9:00–10:30 AM America/Chicago, if tonight's staging is accepted.

## Final URL map (domain path → staged path)

Cutover is a table of forward changes only. Nothing here is linked from a live domain until Eric's go. The review hub is a private checklist, not a cutover target.

| Domain path | Serves | Staged path | Notes |
| --- | --- | --- | --- |
| `ericbuess.com/` | `sites/ericbuess.com/` (personal-light homepage, with work.html) | https://ericbuess.github.io/cdn/sites/ericbuess.com/ | House style chosen 01:20 CDT. |
| `ericbuess.com/work.html` | `sites/ericbuess.com/work.html` | https://ericbuess.github.io/cdn/sites/ericbuess.com/work.html | Same design system. |
| `ericbuess.com/the-argument/` | `sites/ericbuess.com/the-argument/` | https://ericbuess.github.io/cdn/sites/ericbuess.com/the-argument/ | Restyled; figures kept. |
| `ericbuess.com/the-argument/labs/` | `sites/ericbuess.com/the-argument/labs/` | https://ericbuess.github.io/cdn/sites/ericbuess.com/the-argument/labs/ | Restyled; figures kept. |
| `ericbuess.com/alignment-hypothesis/` | `sites/ericbuess.com/alignment-hypothesis/` | https://ericbuess.github.io/cdn/sites/ericbuess.com/alignment-hypothesis/ | **Staged draft, awaiting Eric's read.** thealignmenthypothesis.com does not resolve today. |
| `asi.contractors/` | `sites/asi.contractors/` (its own page) | https://ericbuess.github.io/cdn/sites/asi.contractors/ | Gist content kept. |
| `asi.blue/` | `sites/asi.blue/` (its own page) | https://ericbuess.github.io/cdn/sites/asi.blue/ | **Staged draft, awaiting Eric's read.** |
| `asi.blue/risk-table/` | `sites/asi.blue/risk-table/` | https://ericbuess.github.io/cdn/sites/asi.blue/risk-table/ | **Staged draft, awaiting Eric's read.** |
| `asi.red/` | `sites/asi.red/` (its own page) | https://ericbuess.github.io/cdn/sites/asi.red/ | **Staged draft, awaiting Eric's read.** |
| four-link index (not a public domain) | `sites/` | https://ericbuess.github.io/cdn/sites/ | |
| review hub (not a public domain; not forwarded) | `review/` | https://ericbuess.github.io/cdn/review/ | |
| review hub article draft | `review/article-draft.html` | https://ericbuess.github.io/cdn/review/article-draft.html | |
| résumé PDF (contact omitted) | `review/files/` | https://ericbuess.github.io/cdn/review/files/eric-buess-resume-for-approval.pdf | |
| LinkedIn PDF (contact omitted) | `review/files/` | https://ericbuess.github.io/cdn/review/files/eric-buess-linkedin-for-approval.pdf | |

Do not attach a custom domain to `ericbuess/cdn`. That repo already serves other public files (including `drafts/`). A custom domain on it would put the whole tree at the apex.

---

## Restyle (2026-09-15, Cursor native `idem:cursor-restyle-001`)

Eric chose personal-light as the house style. Each domain now lands on its own page in that design system. Shared CSS lives in `sites/shared/`; `ericbuess.com` also carries a standalone copy of the CSS/JS. asi.blue, asi.red and alignment-hypothesis are **staged drafts, awaiting Eric's read**. Zero Listen-to controls on any `sites/` page. The homepage and work.html load a manifest-gated Leo player (`idem:cursor-tts-leo-002`); draft pages have no manifest and no player. No DNS change.

## Current observed state (read-only, 2026-09-15T02:29Z–02:33Z)

No registrar or DNS writes.

| Domain | Nameservers | Apex address | HTTP now |
| --- | --- | --- | --- |
| `asi.contractors` | Porkbun (`maceio`/`salvador`/`curitiba`/`fortaleza.ns.porkbun.com`) | Porkbun forwarder `207.207.210.{23,36,50}` | `302` via openresty → [ASI.contractors gist](https://gist.github.com/ericbuess/71d359c702a4050ed691786e5c761a88) (`200`) |
| `asi.red` | Porkbun (same four) | same forwarder IPs | `302` → same contractors gist |
| `asi.build` | Porkbun (same four) | same forwarder IPs | `302` → same contractors gist |
| `asi.army` | Porkbun (same four) | same forwarder IPs | `302` → same contractors gist |
| `asi.blue` | Cloudflare (`crystal.ns.cloudflare.com`, `joaquin.ns.cloudflare.com`) | Cloudflare anycast | `302` (Cloudflare) → [Logan gist](https://gist.github.com/ericbuess/0d533db52c09b5616cb0d6c3bc5f5691) (`200`) |
| `ericbuess.com` | Cloudflare (same pair) | Cloudflare anycast `104.21.2.52` / `172.67.128.185` plus AAAA | Apex HTTP and HTTPS: **no TCP response** (`curl` `http_code=000`, 8–15s). `www.ericbuess.com` returns Cloudflare **404**. TXT already has iCloud `apple-domain` and `v=spf1 include:icloud.com ~all`. |

`ericbuess.com` does resolve in DNS (it is already a Cloudflare zone). It does not serve a site. The missing piece is a working origin, not nameserver delegation.

---

## Interim, after Eric's go: point visitors at the staged Pages URL

Keep nameservers as they are. Change only the existing forward/redirect destination. Use a `302` until the proper host is ready.

### Porkbun URL Forwarding (`asi.contractors`, `asi.red`, `asi.build`, `asi.army`)

Porkbun → Domain Management → the domain → **URL Forwarding**.

| Domain | Current destination (do not change until go) | Interim destination |
| --- | --- | --- |
| asi.contractors | `https://gist.github.com/ericbuess/71d359c702a4050ed691786e5c761a88` | `https://ericbuess.github.io/cdn/sites/asi.contractors/` |
| asi.red | same gist | `https://ericbuess.github.io/cdn/sites/asi.red/` |
| asi.build | same gist | `https://ericbuess.github.io/cdn/sites/asi.contractors/` (no staged `asi.build` page; keep sharing the contractors page unless Eric chooses otherwise) |
| asi.army | same gist | `https://ericbuess.github.io/cdn/sites/asi.contractors/` (same) |

Leave the forward type as temporary (`302`, which is what these domains return today). Include the trailing slash. If Porkbun offers a www forward, set the same destination.

### Cloudflare redirect (`asi.blue`) — not Porkbun

`asi.blue` is already on Cloudflare nameservers. The current `302` to the Logan gist is a Cloudflare redirect, not a Porkbun URL-forward. After go: in the `asi.blue` zone, change that redirect's destination to `https://ericbuess.github.io/cdn/sites/asi.blue/`. Do not revert nameservers to Porkbun for an interim forward.

### `ericbuess.com` — no Porkbun forward exists

There is no working URL-forward to edit. Interim options after go, still without a new public repo:

1. **Cloudflare Redirect Rule** in the existing `ericbuess.com` zone: `ericbuess.com/` and `www.ericbuess.com/` → `https://ericbuess.github.io/cdn/sites/ericbuess.com/` (`302`). This is the smallest analog of the Porkbun forward.
2. Or skip interim and go straight to the proper host below.

Do not add GitHub Pages A records to this zone as an interim. That would publish the entire `cdn` tree at the apex.

---

## Later proper host (after the interim, or instead of it)

Each domain needs its own site root (`index.html` at `/`). Do not bind a custom domain to `ericbuess/cdn`.

Tonight's constraint was no new public repos. **Cloudflare Pages** can host each page without a new public GitHub repository (direct upload or a private git source). **GitHub Pages with a CNAME** is the alternative once Eric authorizes a dedicated repo (or an existing repo whose Pages root is only that site).

### Option A — Cloudflare Pages (fits current zones for `ericbuess.com` and `asi.blue`)

For each domain, create one Pages project whose production files are that domain's `index.html` at the project root. In Pages → Custom domains → **Set up a domain**, add the apex. Then:

**If the zone is already on Cloudflare** (`ericbuess.com`, `asi.blue`): Cloudflare creates the DNS record. Expected result:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| `CNAME` (flattened at apex) | `@` | `<project>.pages.dev` | Proxied |
| `CNAME` | `www` | `<project>.pages.dev` | Proxied |

Replace `<project>` with the Pages project subdomain actually assigned (example: `ericbuess.pages.dev`). Adding the custom domain in the Pages dashboard is required; a manual CNAME without that step serves `522`.

Preserve existing iCloud mail on `ericbuess.com` (`MX` if present, `TXT` `apple-domain=…`, `TXT` `v=spf1 include:icloud.com ~all`). Do not delete those when adding the Pages CNAME.

**If the zone is still on Porkbun** (`asi.contractors`, `asi.red`, and optionally `asi.build` / `asi.army`): either (1) point nameservers at Cloudflare and add the domain as a zone, then add the Pages custom domain as above, or (2) keep Porkbun DNS and put a CNAME only on a subdomain:

| Type | Name | Content |
| --- | --- | --- |
| `CNAME` | `www` | `<project>.pages.dev` |

Porkbun cannot put a true `CNAME` at the apex. For an apex on Porkbun DNS, use Porkbun's ALIAS/CNAME-flattening if offered, pointing `@` at `<project>.pages.dev`, or move the zone to Cloudflare. Docs: [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

Remove the interim URL-forward / Redirect Rule after the Pages custom domain is active, so the origin is Pages rather than a redirect hop.

### Option B — GitHub Pages with a CNAME (dedicated site, not `cdn`)

Requires a repository whose GitHub Pages site contains only that domain's files. After Eric authorizes that repo: Pages → Custom domain → the apex. Then at the DNS host:

**Apex** (`example.com`), GitHub-documented records:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `AAAA` | `@` | `2606:50c0:8000::153` |
| `AAAA` | `@` | `2606:50c0:8001::153` |
| `AAAA` | `@` | `2606:50c0:8002::153` |
| `AAAA` | `@` | `2606:50c0:8003::153` |

**www** (required companion):

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `www` | `ericbuess.github.io` |

The `CNAME` target is `ericbuess.github.io` — not `ericbuess.github.io/cdn` and not `*.pages.github.io`. Docs: [Managing a custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

On a Cloudflare zone, do not mix GitHub's A records with Cloudflare proxy (“orange cloud”) unless Eric accepts Cloudflare-as-CDN in front of Pages. Grey-cloud the GitHub A/AAAA records, or prefer Option A.

On `ericbuess.com`, GitHub A/AAAA would **replace** the current Cloudflare origin addresses that do not serve HTTP. Keep the iCloud `TXT` (and MX) records.

---

## What `ericbuess.com` needs, in one line

It already has Cloudflare nameservers. After go it needs a working origin: either a Cloudflare Redirect Rule to the staged URL (interim) or a Cloudflare Pages custom-domain `CNAME` `@` → `<project>.pages.dev` (proper), plus `www` to the same. GitHub Pages A/AAAA to `185.199.108.153`–`111.153` (and the AAAA set) are the alternative if a dedicated Pages repo is authorized. Mail `TXT` records stay.

---

## Explicitly not in this file's authority

- No Porkbun save, no Cloudflare DNS edit, no Pages custom-domain attach, no purchase, no new public repo.
- No linking the staged URLs from gists, X, the article, or any live domain until Eric's go.
- Findings 3–4 from the heytitus PR 53 review (meta/Open Graph; pin the Logan Gist SHA) remain unapplied; they were listed as “before any link is shared,” not as the two must-fixes for tonight's exact-artifact review.
