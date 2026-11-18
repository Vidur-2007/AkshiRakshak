"""Row validator for data/messages/*.jsonl (SPEC_C_DATA.md §3.1 and §3.3 step 6).

Schema checks: keys, types, enums, label/category consistency, id format and uniqueness.

Quality checks (on by default, --schema-only turns them off):
- script and language agree with the labels (share of Latin / Devanagari / Telugu / Bengali letters; romanised
  Hindi needs Hindi marker words, English must not have them);
- nothing that looks like a real identifier: PAN, Aadhaar (12 digits starting 2-9), card (13-19 digits or 4x4
  groups), account number (10-18 digits). Generated reference numbers are 12 digits starting with 0 or 1, which an
  Aadhaar number can never be, and are allowed;
- every 10-digit mobile number uses the invented prefixes from data/fillers/phones.yaml;
- synthetic rows only: every domain in a scam row comes from data/fillers/scam_domains.yaml, every domain in a
  legit row is an official domain from the fillers, and legit rows carry no mobile number.

Run from ml/:  python -m akshi_ml.validate ../data/messages/*.jsonl [--require-split] [--schema-only]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from .contracts import CHANNELS, LABELS, LANGS, SCAM_CATEGORIES, SCRIPTS, SOURCES, SPLITS
from .normalize import normalize_text

FIELDS = {
    "id": str, "text": str, "lang": str, "script": str, "channel": str, "label": str,
    "category": (str, type(None)), "family": str, "split": (str, type(None)), "source": str,
    "hard_negative": bool, "notes": str,
}
ID_RE = re.compile(r"^(?P<family>[a-z0-9]+(?:-[a-z0-9]+)*)-(?P<n>\d{3})$")


def validate_row(row: dict, require_split: bool = False) -> list[str]:
    errs: list[str] = []
    rid = row.get("id", "?")
    keys = set(row)
    if keys != set(FIELDS):
        missing, extra = set(FIELDS) - keys, keys - set(FIELDS)
        if missing:
            errs.append(f"{rid}: missing keys {sorted(missing)}")
        if extra:
            errs.append(f"{rid}: unknown keys {sorted(extra)}")
    for k, t in FIELDS.items():
        if k in row and not isinstance(row[k], t):
            errs.append(f"{rid}: {k} has type {type(row[k]).__name__}")
    if errs:
        return errs

    if not row["text"].strip():
        errs.append(f"{rid}: empty text")
    for k, allowed in (("lang", LANGS), ("script", SCRIPTS), ("channel", CHANNELS), ("label", LABELS),
                       ("source", SOURCES)):
        if row[k] not in allowed:
            errs.append(f"{rid}: {k}={row[k]!r} not in {list(allowed)}")
    # handwritten scams may have no category (the team's "other"); synthetic scams always have one
    other_ok = row["source"] == "handwritten" and row["category"] is None
    if row["label"] == "scam" and row["category"] not in SCAM_CATEGORIES and not other_ok:
        errs.append(f"{rid}: scam rows need a ScamCategory, got {row['category']!r}")
    if row["label"] == "legit" and row["category"] is not None:
        errs.append(f"{rid}: legit rows have category null")
    if row["label"] == "scam" and row["hard_negative"]:
        errs.append(f"{rid}: hard_negative is only for legit rows")
    if row["lang"] == "hi" and row["script"] not in ("deva", "latn", "mixed"):
        errs.append(f"{rid}: Hindi rows are deva, latn (romanised) or mixed")

    split = row["split"]
    if split is not None and split not in SPLITS:
        errs.append(f"{rid}: split={split!r} not in {list(SPLITS)}")
    if require_split and split is None:
        errs.append(f"{rid}: split not set")
    if row["source"] == "handwritten" and split not in (None, "handwritten"):
        errs.append(f"{rid}: handwritten rows use split 'handwritten'")
    if row["source"] == "synthetic" and split == "handwritten":
        errs.append(f"{rid}: synthetic rows never use split 'handwritten'")

    m = ID_RE.match(row["id"])
    if not m:
        errs.append(f"{rid}: id must look like <family>-NNN")
    elif row["source"] == "synthetic" and m.group("family") != row["family"]:
        errs.append(f"{rid}: id prefix does not match family {row['family']!r}")
    return errs


# ---------- quality checks ----------

SCRIPT_RANGES = {"deva": (0x0900, 0x097F), "beng": (0x0980, 0x09FF), "telu": (0x0C00, 0x0C7F)}
LANG_SCRIPTS = {"en": ("latn",), "hi": ("deva", "latn", "mixed"), "te": ("telu", "mixed"), "bn": ("beng", "mixed")}
NATIVE_SCRIPT = {"hi": "deva", "te": "telu", "bn": "beng"}
# Words that mark romanised Hindi and are not English words.
HINGLISH_MARKERS = frozenset("""
hai hain aap aapka aapke aapki aapko apka apke apki apko apna apne nahi nahin nhi kare karein karen karo karna krna
kijiye kijie liye turant turnt abhi abi paisa paise khata khaata ka ki ke ko aur raha rha rahe rahi gaya gya gaye
jayega jaega hoga hogi mat warna varna kripya kripaya bhej bhejo bhejiye kal aaj bhai yaar kya kyu kyun tha thi
hoon hu hum mera meri mujhe tum tumhara wala wali baje ghar bahut bohot bhut zaroori jaruri hua hui milega mila
rupaye rupay rupye mein sakte kyunki kyuki yahan yaha ji haan theek thik accha acha
bhi agar tak kab diye diya dena lena kiya aana jana wapas sab koi kr le lo de do gayi paisey
""".split())
FILE_EXTS = frozenset({"apk", "php", "html", "htm", "pdf", "jpg", "png", "exe", "zip"})
HOST_RE = re.compile(r"(?:[a-z0-9-]+\.)+[a-z]{2,}")
STRIP_CHARS = ".,;:!?()[]{}<>\"'“”‘’।॥*…"

PAN_RE = re.compile(r"(?<![A-Za-z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Za-z0-9])")
GROUPED_16_RE = re.compile(r"(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}(?!\d)")
GROUPED_12_RE = re.compile(r"(?<!\d)[2-9]\d{3}[ -]\d{4}[ -]\d{4}(?!\d)")
MOBILE_RE = re.compile(r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
DIGIT_RUN_RE = re.compile(r"(?<!\d)\d{10,}(?!\d)")


@dataclass(frozen=True)
class QualityContext:
    scam_domains: frozenset[str]
    official_domains: frozenset[str]
    fake_phone: re.Pattern


def build_context(fillers: dict | None = None) -> QualityContext:
    if fillers is None:
        from .generate import load_fillers
        fillers = load_fillers()
    scam = {d for group in fillers["scam_domains"].values() for d in group} | set(fillers["shorteners"])
    official = {d for b in fillers["banks"] for d in b["domains"]}
    official |= {d for kind in fillers["brands"].values() for b in kind for d in b["domains"]}
    official |= set(fillers["official_domains"]["govt"])
    return QualityContext(frozenset(scam), frozenset(official), re.compile(fillers["phones"]["fake_regex"]))


def hosts_in(text: str) -> list[str]:
    """Host names of links in the text (lower case). UPI IDs, emails and file names are not hosts."""
    out = []
    for tok in normalize_text(text).lower().split():
        tok = tok.strip(STRIP_CHARS)
        if "@" in tok:
            continue
        if "://" in tok:
            tok = tok.split("://", 1)[1]
        host = re.split(r"[/?#]", tok, maxsplit=1)[0].strip(STRIP_CHARS)
        if host.startswith("www."):
            host = host[4:]
        if HOST_RE.fullmatch(host) and host.rsplit(".", 1)[1] not in FILE_EXTS:
            out.append(host)
    return out


def host_in(host: str, domains: frozenset[str]) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def _prose(text: str) -> str:
    """Text without links and UPI IDs, for script and language checks."""
    keep = []
    for tok in normalize_text(text).split():
        bare = tok.strip(STRIP_CHARS).lower()
        if "@" in bare or "://" in bare or bare.startswith("www.") or HOST_RE.fullmatch(re.split(r"[/?#]", bare)[0]):
            continue
        keep.append(tok)
    return " ".join(keep)


def script_shares(text: str) -> dict[str, float]:
    counts = {"latn": 0, "deva": 0, "beng": 0, "telu": 0}
    for ch in _prose(text):
        cp = ord(ch)
        if ch.isascii() and ch.isalpha():
            counts["latn"] += 1
        else:
            for name, (lo, hi) in SCRIPT_RANGES.items():
                if lo <= cp <= hi and ch.isalpha():
                    counts[name] += 1
    total = sum(counts.values()) or 1
    return {k: v / total for k, v in counts.items()}


def hinglish_marker_count(text: str) -> int:
    return len(set(re.findall(r"[a-z]+", _prose(text).lower())) & HINGLISH_MARKERS)


def script_errors(row: dict) -> list[str]:
    rid, lang, script = row["id"], row["lang"], row["script"]
    if script not in LANG_SCRIPTS.get(lang, ()):
        return [f"{rid}: script {script} does not fit lang {lang}"]
    shares = script_shares(row["text"])
    native = NATIVE_SCRIPT.get(lang)
    foreign = [s for s in SCRIPT_RANGES if s != native and shares[s] > 0.02]
    errs = []
    if foreign:
        errs.append(f"{rid}: contains {'/'.join(foreign)} letters but lang is {lang}")
    if script == "latn":
        if shares["latn"] < 0.9:
            errs.append(f"{rid}: labelled latn but only {shares['latn']:.0%} Latin letters")
        markers = hinglish_marker_count(row["text"])
        if lang == "hi" and markers < 2:
            errs.append(f"{rid}: labelled romanised Hindi but has {markers} Hindi marker word(s)")
        if lang == "en" and markers > 1:
            errs.append(f"{rid}: labelled English but has {markers} romanised Hindi marker words")
    elif script == "mixed":
        if shares[native] < 0.2 or shares["latn"] < 0.2:
            errs.append(f"{rid}: labelled mixed but shares are {native} {shares[native]:.0%}, latn {shares['latn']:.0%}")
    elif shares[script] < 0.5:
        errs.append(f"{rid}: labelled {script} but only {shares[script]:.0%} of letters are {script}")
    return errs


def identifier_errors(row: dict, ctx: QualityContext) -> list[str]:
    rid = row["id"]
    text = normalize_text(row["text"])
    errs = []
    if PAN_RE.search(text):
        errs.append(f"{rid}: looks like a PAN")
    if GROUPED_16_RE.search(text):
        errs.append(f"{rid}: looks like a card number")
    if GROUPED_12_RE.search(text):
        errs.append(f"{rid}: looks like an Aadhaar number")
    mobiles = [m.group(0) for m in MOBILE_RE.finditer(text)]
    for m in mobiles:
        if not ctx.fake_phone.fullmatch(m):
            errs.append(f"{rid}: phone {m!r} does not use an invented prefix")
    # text with the invented phones removed, so their digits are not read as account numbers
    rest = MOBILE_RE.sub(" ", text)
    for m in DIGIT_RUN_RE.finditer(rest):
        run = m.group(0)
        if len(run) == 12 and run[0] in "01":
            continue  # generated reference number
        if len(run) == 12:
            errs.append(f"{rid}: {run} looks like an Aadhaar number")
        elif 13 <= len(run) <= 19:
            errs.append(f"{rid}: {run} looks like a card or account number")
        else:
            errs.append(f"{rid}: {run} looks like an account number")
    return errs


def synthetic_errors(row: dict, ctx: QualityContext) -> list[str]:
    rid = row["id"]
    errs = []
    scam = row["label"] == "scam"
    for host in hosts_in(row["text"]):
        if scam and not host_in(host, ctx.scam_domains):
            errs.append(f"{rid}: domain {host} is not in the invented scam-domain list")
        if not scam and not host_in(host, ctx.official_domains):
            errs.append(f"{rid}: domain {host} is not an official domain from the fillers")
    if not scam and MOBILE_RE.search(normalize_text(row["text"])):
        errs.append(f"{rid}: legit rows carry no mobile number")
    return errs


def quality_errors(row: dict, ctx: QualityContext) -> list[str]:
    errs = script_errors(row) + identifier_errors(row, ctx)
    if row["source"] == "synthetic":
        errs += synthetic_errors(row, ctx)
    return errs


def validate_rows(rows: list[dict], require_split: bool = False, ctx: QualityContext | None = None) -> list[str]:
    """Schema checks for every row; quality checks too when `ctx` is given."""
    errs: list[str] = []
    seen: set[str] = set()
    for row in rows:
        row_errs = validate_row(row, require_split)
        if not row_errs and ctx is not None:
            row_errs = quality_errors(row, ctx)
        errs += row_errs
        rid = row.get("id")
        if rid in seen:
            errs.append(f"{rid}: duplicate id")
        seen.add(rid)
    return errs


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{n}: invalid JSON ({e})") from e
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate dataset JSONL files")
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--require-split", action="store_true")
    ap.add_argument("--schema-only", action="store_true", help="skip the quality checks")
    args = ap.parse_args()
    rows = [r for f in args.files for r in load_jsonl(f)]
    errs = validate_rows(rows, args.require_split, None if args.schema_only else build_context())
    for e in errs[:200]:
        print(e)
    print(f"{len(rows)} rows, {len(errs)} problems")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
