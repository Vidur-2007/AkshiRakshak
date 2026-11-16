"""Row validator for data/messages/*.jsonl (SPEC_C_DATA.md §3.1).

Phase 0: schema checks (keys, types, enums, label/category consistency, id format and uniqueness).
Phase 1 adds quality checks (script/language agreement, look-alike real identifiers, domain allow-lists).

Run from ml/:  python -m akshi_ml.validate ../data/messages/*.jsonl [--require-split]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .contracts import CHANNELS, LABELS, LANGS, SCAM_CATEGORIES, SCRIPTS, SOURCES, SPLITS

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
    if row["label"] == "scam" and row["category"] not in SCAM_CATEGORIES:
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


def validate_rows(rows: list[dict], require_split: bool = False) -> list[str]:
    errs: list[str] = []
    seen: set[str] = set()
    for row in rows:
        errs += validate_row(row, require_split)
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
    args = ap.parse_args()
    rows = [r for f in args.files for r in load_jsonl(f)]
    errs = validate_rows(rows, args.require_split)
    for e in errs[:200]:
        print(e)
    print(f"{len(rows)} rows, {len(errs)} problems")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
