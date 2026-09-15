#!/usr/bin/env python3
"""Categorise exported X posts and append them to content/manifest.json as notes.

Reads  content/x-posts.json   (written by tools/x-export.py)
       content/overrides.json (hand-edited; always wins)
       content/manifest.json  (taxonomy + existing entries)

Precedence for a post's categories, highest first:

  1. content/overrides.json  — Eric edits one file
  2. a `cat:<category>` reply to his own post, read from the exported reply thread
  3. the keyword table below
  4. the existing manifest row, if it already has hand-written categories
  5. empty — the honest answer when the heuristic is not confident

No model calls. The heuristic is deliberately plain: keyword hits are scored, a post
needs MIN_SCORE to be labelled at all, and it keeps at most two categories. Anything
below the threshold is left uncategorised rather than guessed.

Idempotent: re-running updates managed rows in place, appends new ones at the end and
never reorders or rewrites entries it does not own.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT = REPO_ROOT / "content"
MIN_SCORE = 2
MAX_CATEGORIES = 2

# Category ids must match content/CATEGORIES.md and the manifest taxonomy.
# A multi-word phrase scores 2, a single word scores 1.
KEYWORDS: dict[str, list[str]] = {
    "safety-argument": [
        "ai safety", "existential", "x-risk", "extinction", "doom", "p(doom)",
        "safety case", "catastrophic", "misuse", "regulation", "policy", "governance",
    ],
    "hardening": [
        "vulnerability", "vulnerabilities", "cve", "patch", "patched", "exploit",
        "hardening", "secure", "security", "fuzzing", "sandbox", "supply chain",
    ],
    "adversarial-safety": [
        "red team", "red-team", "jailbreak", "prompt injection", "adversarial",
        "attack", "evals", "eval", "stress test", "deception",
    ],
    "alignment-hypothesis": [
        "alignment hypothesis", "alignment", "corrigible", "corrigibility",
        "correction", "developmental environment", "persistent consequences",
        "interpretability", "reward hacking",
    ],
    "fleet-and-tools": [
        "claude code", "agent teams", "subagent", "sub-agent", "agent sdk", "mcp",
        "hooks", "harness", "codex", "cursor", "headless", "cli", "voice", "pendant",
        "transcription", "screenless", "titus", "orchestrat", "workflow", "open source",
    ],
    "family-and-life": [
        "my kids", "my children", "my wife", "family", "fatherhood", "church",
        "bible", "prayer", "sunday", "present with", "screen time", "homeschool",
    ],
    "music": ["suno", "song", "songs", "lyrics", "album", "worship music", "playlist", "melody"],
    "misc": [],
}

CAT_REPLY = re.compile(r"(?:^|\s)cat:\s*([a-z][a-z0-9-]*)", re.IGNORECASE)
MENTION_PREFIX = re.compile(r"^(?:@[\w]+\s+)+")
URL_PATTERN = re.compile(r"https?://\S+")


def rel(path: Path) -> str:
    """Repository-relative for readable messages, absolute when the path is elsewhere."""
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_json(path: Path, default=None):
    if not path.exists():
        if default is None:
            raise SystemExit(f"missing {rel(path)}")
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"{rel(path)} is not valid JSON: {error}") from None


def posts_from(payload) -> list[dict]:
    if isinstance(payload, list):
        return [post for post in payload if isinstance(post, dict)]
    if isinstance(payload, dict):
        return [post for post in payload.get("posts", []) if isinstance(post, dict)]
    return []


def iso_day(value: str) -> str:
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", str(value or ""))
    return match.group(1) if match else str(value or "")


def short_title(text: str) -> str:
    """A one-line title from the post body: first sentence, mentions and links stripped."""
    body = URL_PATTERN.sub("", MENTION_PREFIX.sub("", text or "")).strip()
    body = re.split(r"(?<=[.!?])\s+|\n", body)[0].strip() or (text or "").strip()
    body = re.sub(r"\s+", " ", body)
    if len(body) <= 72:
        return body or "Untitled note"
    return body[:71].rsplit(" ", 1)[0] + "\u2026"


def command_categories(text: str, valid: set[str]) -> tuple[list[str], list[str]]:
    """Return (recognised, unrecognised) `cat:` words in a reply."""
    found = [word.lower() for word in CAT_REPLY.findall(text or "")]
    return [word for word in found if word in valid], [word for word in found if word not in valid]


def is_command_only(text: str) -> bool:
    """A reply that is nothing but `cat:` words (plus @mentions) is an instruction, not a note."""
    stripped = MENTION_PREFIX.sub("", text or "").strip()
    return bool(stripped) and bool(re.fullmatch(r"(?:cat:\s*[a-z][a-z0-9-]*[\s,]*)+", stripped, re.IGNORECASE))


def keyword_categories(text: str, order: list[str]) -> list[str]:
    haystack = (text or "").lower()
    scores: dict[str, int] = {}
    for category in order:
        score = 0
        for keyword in KEYWORDS.get(category, []):
            if keyword in haystack:
                score += 2 if " " in keyword or "-" in keyword else 1
        if score:
            scores[category] = score
    if not scores or max(scores.values()) < MIN_SCORE:
        return []
    ranked = sorted(scores.items(), key=lambda item: (-item[1], order.index(item[0])))
    return [category for category, score in ranked[:MAX_CATEGORIES] if score >= MIN_SCORE]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--posts", type=Path, default=CONTENT / "x-posts.json")
    parser.add_argument("--overrides", type=Path, default=CONTENT / "overrides.json")
    parser.add_argument("--manifest", type=Path, default=CONTENT / "manifest.json")
    parser.add_argument("--dry-run", action="store_true", help="report the plan and write nothing")
    args = parser.parse_args(argv)

    manifest = load_json(args.manifest)
    if not isinstance(manifest, dict) or not isinstance(manifest.get("entries"), list):
        raise SystemExit("manifest must be an object with an \"entries\" array")
    taxonomy_order = [str(item.get("id")) for item in manifest.get("taxonomy", []) if item.get("id")]
    valid = set(taxonomy_order)
    unknown_keywords = sorted(set(KEYWORDS) - valid)
    if unknown_keywords:
        print(f"warning: keyword table has categories missing from the manifest taxonomy: {', '.join(unknown_keywords)}", file=sys.stderr)

    posts = posts_from(load_json(args.posts, default={"posts": []}))
    if not posts:
        print(f"{rel(args.posts)} has no posts; run tools/x-export.py first")
        return 0

    overrides = load_json(args.overrides, default={})
    override_posts = {str(key): list(value) for key, value in (overrides.get("posts") or {}).items()}
    skip = {str(value) for value in (overrides.get("skip") or [])}

    by_id = {str(post.get("id")): post for post in posts if post.get("id")}
    existing = {str(entry.get("id")): entry for entry in manifest["entries"] if entry.get("id")}

    # `cat:` replies to Eric's own posts, read from the exported thread.
    commanded: dict[str, list[str]] = {}
    bad_words: list[str] = []
    for post in posts:
        parent = str(post.get("reply_to") or "")
        if not parent or parent not in by_id:
            continue
        good, bad = command_categories(post.get("text", ""), valid)
        bad_words.extend(bad)
        if good:
            commanded[parent] = list(dict.fromkeys(good))[:MAX_CATEGORIES]
    if bad_words:
        print(f"ignored cat: words that are not in the taxonomy: {', '.join(sorted(set(bad_words)))}", file=sys.stderr)

    added, updated, sources = 0, 0, {"overrides": 0, "cat-reply": 0, "keywords": 0, "kept": 0, "empty": 0}
    appended: list[dict] = []

    for post in posts:
        post_id = str(post.get("id") or "")
        if not post_id or post_id in skip or is_command_only(post.get("text", "")):
            continue
        entry_id = f"x-{post_id}"
        entry = existing.get(entry_id)
        text = post.get("text", "")

        if post_id in override_posts:
            categories, why = [c for c in override_posts[post_id] if c in valid], "overrides"
        elif post_id in commanded:
            categories, why = commanded[post_id], "cat-reply"
        else:
            categories = keyword_categories(text, taxonomy_order)
            why = "keywords" if categories else "empty"
            if not categories and entry and entry.get("categories"):
                categories, why = list(entry["categories"]), "kept"
        sources[why] += 1

        if entry is not None:
            if entry.get("categories") != categories:
                entry["categories"] = categories
                updated += 1
            entry.setdefault("kind", "note")
            entry["text"] = text
            entry["date"] = iso_day(post.get("date"))
            entry["url"] = post.get("url") or entry.get("url", "")
            entry.setdefault("title", short_title(text))
            entry["source"] = "x"
            continue

        appended.append({
            "id": entry_id,
            "kind": "note",
            "title": short_title(text),
            "date": iso_day(post.get("date")),
            "url": post.get("url", ""),
            "categories": categories,
            "text": text,
            "summary": "",
            "source": "x",
        })
        added += 1

    manifest["entries"].extend(appended)
    plan = (
        f"{added} new note rows, {updated} category changes "
        f"(overrides {sources['overrides']}, cat: replies {sources['cat-reply']}, "
        f"keywords {sources['keywords']}, kept {sources['kept']}, left empty {sources['empty']})"
    )
    if args.dry_run:
        print(f"dry run: {plan}; {rel(args.manifest)} not written")
        return 0

    temp = args.manifest.with_suffix(args.manifest.suffix + ".tmp")
    temp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(args.manifest)
    print(f"{rel(args.manifest)}: {plan}")
    if sources["empty"]:
        print(f"{sources['empty']} posts were left uncategorised on purpose. Categorise them in content/overrides.json, or reply cat:<category> on X and re-export.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
