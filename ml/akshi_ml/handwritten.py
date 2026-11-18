"""Convert the team's handwritten test messages to data/messages/handwritten.jsonl (SPEC_C_DATA.md §3.5).

Input: every data/handwritten/*.csv except TEMPLATE.csv, with the columns of TEMPLATE.csv
(text, lang, channel, label, category, author). Rows whose author is "Example" are the template's examples
and are skipped.

Output rows have split "handwritten" and source "handwritten". The authors' names are not written out: each
author becomes family hw-a, hw-b, ... in alphabetical order. A scam row with category "other" or empty keeps
category null (it still counts for the scam/genuine metrics, not for per-category recall).

The same schema, script and identifier checks as the synthetic rows run on every row (invented phone
prefixes only, nothing that looks like a PAN, Aadhaar, card or account number). Any problem stops the
conversion and nothing is written. This script never runs the model or the engine on the rows: the
handwritten set is used only for the final report (npm run eval).

Run from ml/:  python -m akshi_ml.handwritten
"""
import csv
import json
import re
import sys
from pathlib import Path

from .contracts import CHANNELS, SCAM_CATEGORIES
from .validate import build_context, script_errors, identifier_errors, script_shares, validate_row

REPO = Path(__file__).resolve().parents[2]
SRC_DIR = REPO / "data" / "handwritten"
OUT = REPO / "data" / "messages" / "handwritten.jsonl"
COLUMNS = ["text", "lang", "channel", "label", "category", "author"]
NATIVE = {"hi": "deva", "te": "telu", "bn": "beng"}

# Genuine bank, OTP and UPI messages count as hard negatives, like the synthetic hard-negative families,
# so the report's "false alarms on genuine bank messages" covers them too.
BANK_RE = re.compile(
    r"\b(otp|upi|a/c|acct|account|debited|credited|bank|netbanking|card|neft|imps|emi)\b"
    r"|ओटीपी|यूपीआई|खाते|खाता|बैंक|డెబిట్|ఓటీపీ|యూపీఐ|ఖాతా|బ్యాంక్|ওটিপি|ইউপিআই|অ্যাকাউন্ট|ব্যাংক",
    re.IGNORECASE,
)


class HandwrittenError(Exception):
    pass


def pick_script(text: str, lang: str) -> str:
    shares = script_shares(text)
    if lang == "en":
        return "latn"
    native = NATIVE[lang]
    if shares[native] >= 0.5:
        return native
    if lang == "hi" and shares["latn"] >= 0.9:
        return "latn"
    return "mixed"


def read_csvs(src_dir: Path = SRC_DIR) -> list[tuple[str, int, dict]]:
    """(file name, line number, row) for every non-example row of every team CSV."""
    out = []
    for path in sorted(src_dir.glob("*.csv")):
        if path.name == "TEMPLATE.csv":
            continue
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            header = [h.strip().lower() for h in (reader.fieldnames or [])]
            if header != COLUMNS:
                raise HandwrittenError(f"{path.name}: columns must be {','.join(COLUMNS)}, got {','.join(header)}")
            for i, raw in enumerate(reader, start=2):
                row = {k.strip().lower(): (v or "").strip() for k, v in raw.items() if k}
                if not any(row.values()) or row["author"].lower() == "example":
                    continue
                out.append((path.name, i, row))
    return out


def convert(entries: list[tuple[str, int, dict]]) -> tuple[list[dict], list[str]]:
    authors = sorted({r["author"].strip().lower() or "anonymous" for _, _, r in entries})
    family_of = {a: "hw-" + chr(ord("a") + i) if i < 26 else f"hw-{i}" for i, a in enumerate(authors)}
    ctx = build_context()
    rows, errs, seen_text = [], [], {}
    for n, (fname, line, r) in enumerate(entries, start=1):
        where = f"{fname}:{line}"
        text, lang, label = r["text"], r["lang"].lower(), r["label"].lower()
        channel = (r["channel"] or "unknown").lower()
        category = r["category"].lower() or None
        if lang not in ("en", "hi", "te", "bn"):
            errs.append(f"{where}: lang must be en, hi, te or bn, got {r['lang']!r}")
            continue
        if label not in ("scam", "legit"):
            errs.append(f"{where}: label must be scam or legit, got {r['label']!r}")
            continue
        if channel not in CHANNELS:
            errs.append(f"{where}: channel {channel!r} not in {list(CHANNELS)}")
            continue
        if label == "legit" and category is not None:
            errs.append(f"{where}: genuine rows leave category empty")
            continue
        if label == "scam" and category == "other":
            category = None
        if category is not None and category not in SCAM_CATEGORIES:
            errs.append(f"{where}: unknown category {category!r}")
            continue
        key = re.sub(r"\s+", " ", text.lower())
        if key in seen_text:
            errs.append(f"{where}: same text as {seen_text[key]}")
            continue
        seen_text[key] = where
        row = {
            "id": f"hw-{n:03d}",
            "text": text,
            "lang": lang,
            "script": pick_script(text, lang),
            "channel": channel,
            "label": label,
            "category": category,
            "family": family_of[r["author"].strip().lower() or "anonymous"],
            "split": "handwritten",
            "source": "handwritten",
            "hard_negative": label == "legit" and bool(BANK_RE.search(text)),
            "notes": "",
        }
        row_errs = validate_row(row, require_split=True) or script_errors(row) + identifier_errors(row, ctx)
        errs += [f"{where} ({row['id']}): " + e.split(": ", 1)[-1] for e in row_errs]
        rows.append(row)
    return rows, errs


def main() -> int:
    try:
        entries = read_csvs()
    except HandwrittenError as e:
        print(e)
        return 1
    if not entries:
        print(f"no team CSV files in {SRC_DIR.relative_to(REPO)} (TEMPLATE.csv is skipped); nothing written")
        return 1
    rows, errs = convert(entries)
    if errs:
        print("\n".join(errs))
        print(f"\n{len(errs)} problem(s); nothing written. Fix the CSV rows above and rerun.")
        return 1
    OUT.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    counts: dict[tuple[str, str], int] = {}
    for r in rows:
        counts[(r["lang"], r["label"])] = counts.get((r["lang"], r["label"]), 0) + 1
    print(f"wrote {OUT.relative_to(REPO)}: {len(rows)} rows from {len({r['family'] for r in rows})} authors")
    for (lang, label), c in sorted(counts.items()):
        print(f"  {lang} {label}: {c}")
    print("Use them only through npm run eval (the final report). Do not tune anything on them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
