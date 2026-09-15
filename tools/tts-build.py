#!/usr/bin/env python3
"""Build Leo page audio from HTML. Repo tooling, not a daemon.

Reads XAI_API_KEY from the environment for POST https://api.x.ai/v1/tts only.
Never prints the key. Re-running regenerates only changed chunks.
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import os
import shutil
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

TTS_URL = "https://api.x.ai/v1/tts"
VOICES_URL = "https://api.x.ai/v1/tts/voices"
VOICE_ID = "leo"
LANGUAGE = "en"
BIT_RATE = 96000
MAX_CHARS = 15000
DEFAULT_GROUP = 1200
DEFAULT_LIMIT = 200_000
MAX_MP3_BYTES = 15 * 1024 * 1024

SKIP_TAGS = {
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "canvas",
    "template",
    "button",
    "select",
    "textarea",
    "nav",
    "footer",
    "form",
}
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
SKIP_CLASS_PARTS = (
    "ticker",
    "wall",
    "preview",
    "page-audio",
    "speech-overview",
    "radar",
    "target-container",
    "target-nav",
    "core-metrics",
    "actions",
    "selected-media__player",
    "x-snapshot__engagement",
    "skip-link",
    "progress",
)
SKIP_IDS = {"listen", "overview-text", "radar-target", "cursor-ping"}
BLOCK_TAGS = {
    "h1",
    "h2",
    "h3",
    "h4",
    "p",
    "li",
    "dt",
    "dd",
    "th",
    "td",
    "blockquote",
    "pre",
    "figcaption",
}


def _attr(attrs, name):
    for key, value in attrs:
        if key.lower() == name:
            return value or ""
    return ""


def _classes(attrs):
    return _attr(attrs, "class").split()


def should_skip(tag, attrs):
    if tag in SKIP_TAGS:
        return True
    if _attr(attrs, "hidden") != "" or _attr(attrs, "inert") != "":
        return True
    if _attr(attrs, "aria-hidden") == "true":
        return True
    if "data-reader-skip" in {k.lower() for k, _ in attrs}:
        return True
    ident = _attr(attrs, "id")
    if ident in SKIP_IDS:
        return True
    classes = _classes(attrs)
    joined = " ".join(classes)
    for part in SKIP_CLASS_PARTS:
        if part in classes or part in joined:
            return True
    return False


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = {"tag": "[document]", "attrs": {}, "children": [], "text": []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = {"tag": tag.lower(), "attrs": dict(attrs), "children": [], "text": []}
        self.stack[-1]["children"].append(node)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(node)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in VOID_TAGS:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1]["text"].append(data)

    def handle_entityref(self, name):
        self.stack[-1]["text"].append(html_lib.unescape(f"&{name};"))

    def handle_charref(self, name):
        self.stack[-1]["text"].append(html_lib.unescape(f"&#{name};"))


def normalize(text):
    return " ".join(text.split()).strip()


def text_of(node, skip=False):
    tag = node["tag"]
    if tag == "br":
        return " "
    attrs = list(node["attrs"].items())
    if skip or should_skip(tag, attrs):
        return ""
    parts = ["".join(node["text"])]
    for child in node["children"]:
        parts.append(text_of(child))
    return "".join(parts)


def iter_blocks(node, skipping=False, in_block=False):
    tag = node["tag"]
    attrs = list(node["attrs"].items())
    skip_here = skipping or should_skip(tag, attrs)
    if skip_here:
        for child in node["children"]:
            yield from iter_blocks(child, skipping=True, in_block=in_block)
        return
    if tag in BLOCK_TAGS and not in_block:
        text = normalize(text_of(node))
        if text:
            yield tag, text
        return
    for child in node["children"]:
        yield from iter_blocks(child, skipping=False, in_block=in_block or tag in BLOCK_TAGS)


def chunk_blocks(blocks, group_limit=DEFAULT_GROUP):
    sections = []
    title = ""
    paras = []

    def flush():
        if paras:
            sections.append((title or "Introduction", list(paras)))

    for tag, text in blocks:
        if tag in {"h1", "h2"}:
            flush()
            title = text
            paras = [text]
        else:
            if not title and tag in {"h3", "h4"}:
                title = text
            paras.append(text)
    flush()

    chunks = []
    for section_title, items in sections:
        group = []
        size = 0
        for item in items:
            extra = len(item) + (1 if group else 0)
            if group and size + extra > group_limit:
                body = " ".join(group)
                chunks.append({"title": section_title, "text": body})
                group = [item]
                size = len(item)
            else:
                group.append(item)
                size += extra
        if group:
            chunks.append({"title": section_title, "text": " ".join(group)})

    out = []
    for chunk in chunks:
        text = chunk["text"]
        if len(text) <= MAX_CHARS:
            out.append(chunk)
            continue
        start = 0
        while start < len(text):
            end = min(start + MAX_CHARS, len(text))
            if end < len(text):
                split_at = text.rfind(". ", start, end)
                if split_at > start + 200:
                    end = split_at + 1
            piece = text[start:end].strip()
            if piece:
                out.append({"title": chunk["title"], "text": piece})
            start = end
    return out


def extract_chunks(html_text, group_limit=DEFAULT_GROUP):
    parser = TreeBuilder()
    parser.feed(html_text)
    parser.close()
    blocks = list(iter_blocks(parser.root))
    chunks = []
    for chunk in chunk_blocks(blocks, group_limit=group_limit):
        text = normalize(chunk["text"])
        if not text:
            continue
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        chunks.append(
            {
                "hash": digest,
                "title": chunk["title"],
                "text": text,
                "chars": len(text),
            }
        )
    return chunks


def page_key(html_path: Path) -> str:
    name = html_path.name
    return name if name else "index.html"


def audio_dir_for(html_path: Path) -> Path:
    return html_path.parent / "audio"


def index_audio_clips(repo: Path) -> dict[str, Path]:
    """Map chunk sha256 -> first existing MP3 in any audio/ folder."""
    found: dict[str, Path] = {}
    for mp3 in sorted(repo.rglob("*.mp3")):
        if mp3.parent.name != "audio":
            continue
        digest = mp3.stem.lower()
        if len(digest) == 64 and all(char in "0123456789abcdef" for char in digest):
            found.setdefault(digest, mp3.resolve())
    return found


def load_manifest(path: Path) -> dict:
    if not path.is_file():
        return {"voice_id": VOICE_ID, "language": LANGUAGE, "pages": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if "pages" not in data or not isinstance(data["pages"], dict):
        data["pages"] = {}
    return data


def clips_from_page_entry(entry):
    if isinstance(entry, list):
        return entry
    if isinstance(entry, dict) and isinstance(entry.get("clips"), list):
        return entry["clips"]
    return []


def referenced_files(manifest: dict) -> set[str]:
    files = set()
    for entry in manifest.get("pages", {}).values():
        for clip in clips_from_page_entry(entry):
            name = clip.get("file")
            if name:
                files.add(name)
    return files


def is_mp3(data: bytes) -> bool:
    return bool(data) and (data.startswith(b"ID3") or data[0] == 0xFF)


def billing_or_quota(status: int, body: bytes) -> bool:
    if status in {402, 429}:
        return True
    text = body.decode("utf-8", errors="replace").lower()
    needles = ("quota", "billing", "insufficient", "payment required", "credit", "spend limit")
    return any(word in text for word in needles)


def api_key():
    key = os.environ.get("XAI_API_KEY", "").strip()
    if not key:
        raise SystemExit("XAI_API_KEY is not set. Export it in this shell for voice work only.")
    return key


def request_bytes(url, key, data=None, method=None):
    headers = {"Authorization": f"Bearer {key}"}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Accept"] = "application/octet-stream"
    req = urllib.request.Request(url, data=body, headers=headers, method=method or ("POST" if body else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        payload = err.read() or b""
        return err.code, payload


def synthesize(text: str, key: str) -> bytes:
    payload = {
        "text": text,
        "voice_id": VOICE_ID,
        "language": LANGUAGE,
        "output_format": {"codec": "mp3", "bit_rate": BIT_RATE},
    }
    status, body = request_bytes(TTS_URL, key, data=payload, method="POST")
    if billing_or_quota(status, body):
        raise SystemExit(
            f"TTS billing or quota error (HTTP {status}). Stopped without retry. Characters in this request: {len(text)}."
        )
    if status != 200:
        snippet = body.decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"TTS failed HTTP {status}: {snippet}")
    if not is_mp3(body):
        snippet = body.decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"TTS HTTP 200 but body was not MP3 bytes: {snippet}")
    if len(body) > MAX_MP3_BYTES:
        raise SystemExit(f"TTS MP3 exceeded 15 MB ({len(body)} bytes).")
    return body


def confirm_leo(key: str) -> None:
    status, body = request_bytes(VOICES_URL, key, method="GET")
    if billing_or_quota(status, body):
        raise SystemExit(f"Voices list billing or quota error (HTTP {status}). Stopped without retry.")
    if status != 200:
        snippet = body.decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"GET /v1/tts/voices failed HTTP {status}: {snippet}")
    try:
        data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as err:
        raise SystemExit(f"Voices list was not JSON: {err}") from err
    voices = data if isinstance(data, list) else data.get("voices") or data.get("data") or []
    ids = set()
    for item in voices:
        if isinstance(item, str):
            ids.add(item.lower())
        elif isinstance(item, dict):
            for field in ("voice_id", "id", "name"):
                if item.get(field):
                    ids.add(str(item[field]).lower())
    if ids and "leo" not in ids:
        raise SystemExit("GET /v1/tts/voices succeeded but Leo was not listed.")


def clip_entry(chunk: dict) -> dict:
    digest = chunk["hash"]
    return {
        "hash": digest,
        "title": chunk["title"],
        "file": f"{digest}.mp3",
        "chars": chunk["chars"],
    }


def build_page(
    html_path: Path,
    chunks: list[dict],
    dry_run: bool,
    key: str | None,
    clip_index: dict[str, Path],
) -> dict:
    out_dir = audio_dir_for(html_path)
    manifest_path = out_dir / "manifest.json"
    manifest = load_manifest(manifest_path)
    page = page_key(html_path)
    wanted_hashes = [chunk["hash"] for chunk in chunks]
    page_clips = []
    generated = 0
    reused = 0
    copied = 0
    chars_sent = 0
    for chunk in chunks:
        digest = chunk["hash"]
        filename = f"{digest}.mp3"
        dest = out_dir / filename
        source = None
        if dest.is_file():
            source = dest.resolve()
        elif digest in clip_index:
            source = clip_index[digest]
        if source is not None:
            page_clips.append(clip_entry(chunk))
            dest_exists = dest.is_file()
            same_file = dest_exists and source == dest.resolve()
            if same_file:
                reused += 1
            else:
                copied += 1
                if not dry_run:
                    out_dir.mkdir(parents=True, exist_ok=True)
                    if not dest_exists or dest.resolve() != source:
                        shutil.copy2(source, dest)
                    print(
                        f"COPY {page} hash={digest[:12]} from={source} chars={chunk['chars']} title={chunk['title']!r}",
                        flush=True,
                    )
                    clip_index.setdefault(digest, dest.resolve())
            continue
        if dry_run:
            page_clips.append(clip_entry(chunk))
            continue
        if key is None:
            raise SystemExit(f"Missing clip {digest[:12]} for {page} and XAI_API_KEY was not loaded.")
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"TTS {page} hash={digest[:12]} chars={chunk['chars']} title={chunk['title']!r}", flush=True)
        audio = synthesize(chunk["text"], key)
        dest.write_bytes(audio)
        clip_index[digest] = dest.resolve()
        page_clips.append(clip_entry(chunk))
        generated += 1
        chars_sent += chunk["chars"]
    manifest["voice_id"] = VOICE_ID
    manifest["language"] = LANGUAGE
    manifest["pages"][page] = page_clips
    keep = referenced_files(manifest)
    if out_dir.is_dir() and not dry_run:
        for mp3 in out_dir.glob("*.mp3"):
            if mp3.name not in keep:
                print(f"drop orphan {mp3.relative_to(html_path.parent)}", flush=True)
                mp3.unlink()
        out_dir.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        "page": page,
        "path": str(html_path),
        "chunks": len(chunks),
        "chars": sum(chunk["chars"] for chunk in chunks),
        "generated": generated,
        "reused": reused,
        "copied": copied,
        "chars_sent": chars_sent,
        "wanted_hashes": wanted_hashes,
    }


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Generate Leo MP3 clips for page HTML.")
    parser.add_argument("pages", nargs="+", help="HTML files relative to the repo root or absolute.")
    parser.add_argument("--dry-run", action="store_true", help="Extract and count only; write nothing; call no API.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Stop before TTS if combined chars exceed this.")
    parser.add_argument("--group", type=int, default=DEFAULT_GROUP, help="Soft max characters per chunk.")
    parser.add_argument("--dump-chunks", action="store_true", help="Print chunk titles and hashes.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    repo = Path.cwd()
    pages = []
    for raw in args.pages:
        path = Path(raw)
        if not path.is_absolute():
            path = repo / path
        path = path.resolve()
        if not path.is_file():
            raise SystemExit(f"Missing HTML file: {path}")
        pages.append(path)

    extracted = []
    total_chars = 0
    for path in pages:
        html_text = path.read_text(encoding="utf-8")
        chunks = extract_chunks(html_text, group_limit=args.group)
        chars = sum(chunk["chars"] for chunk in chunks)
        total_chars += chars
        extracted.append((path, chunks, chars))
        print(f"PAGE {path} chunks={len(chunks)} chars={chars}", flush=True)
        if args.dump_chunks:
            for i, chunk in enumerate(chunks, 1):
                print(f"  {i:02d} {chunk['chars']:5d} {chunk['hash'][:12]} {chunk['title']}")

    print(f"TOTAL_CHARS {total_chars}", flush=True)
    if total_chars > args.limit:
        raise SystemExit(f"TOTAL_CHARS {total_chars} exceeds limit {args.limit}. Stopped before TTS.")

    clip_index = index_audio_clips(repo)
    missing = []
    for path, chunks, _chars in extracted:
        out_dir = audio_dir_for(path)
        for chunk in chunks:
            dest = out_dir / f"{chunk['hash']}.mp3"
            if dest.is_file() or chunk["hash"] in clip_index:
                continue
            missing.append((path, chunk))
    print(f"CLIP_INDEX {len(clip_index)} MISSING {len(missing)}", flush=True)

    key = None
    if not args.dry_run and missing:
        key = api_key()
        # Key is used only for POST /v1/tts. Skip GET /v1/tts/voices on reuse-only runs.

    summaries = []
    sent = 0
    copied = 0
    reused = 0
    generated = 0
    for path, chunks, _chars in extracted:
        summary = build_page(path, chunks, dry_run=args.dry_run, key=key, clip_index=clip_index)
        summaries.append(summary)
        sent += summary["chars_sent"]
        copied += summary["copied"]
        reused += summary["reused"]
        generated += summary["generated"]
        print(
            f"DONE {summary['page']} generated={summary['generated']} reused={summary['reused']} copied={summary['copied']} chars_sent={summary['chars_sent']}",
            flush=True,
        )
    print(f"GENERATED {generated} REUSED {reused} COPIED {copied} CHARS_SENT {sent}", flush=True)
    print(f"CHARS_SENT {sent}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
