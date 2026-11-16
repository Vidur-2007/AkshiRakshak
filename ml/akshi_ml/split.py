"""Family-level train/val/test splits (SPEC_C_DATA.md §3.5).

Every row of a family goes to the same split, so near-identical rows never sit on both sides. Families are split
70/15/15 inside each stratum (scam: the category; legit: language + hard-negative flag), so each category appears in
every split when it has at least three families. Within a stratum the validation and test families are chosen to
keep the languages balanced across splits.

Assignments are stored in data/messages/splits.json. A family that already has an assignment keeps it; only new
families are assigned. That keeps the test split untouched when families are added later.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from .paths import MESSAGES

SPLITS_FILE = MESSAGES / "splits.json"
HELD_OUT = ("val", "test")
HELD_OUT_SHARE = 0.15


def stratum(row: dict) -> str:
    if row["label"] == "scam":
        return f"scam:{row['category']}"
    return f"legit:{row['lang']}:{'hn' if row['hard_negative'] else 'plain'}"


def _order(family: str) -> str:
    return hashlib.sha256(family.encode()).hexdigest()


def held_out_count(n: int) -> int:
    """Families per held-out split for a stratum of n families."""
    if n < 3:
        return 0
    return max(1, round(n * HELD_OUT_SHARE))


def assign_splits(rows: list[dict], existing: dict[str, str] | None = None) -> dict[str, str]:
    """Return {family: split} for every family in `rows`, keeping `existing` assignments."""
    assigned = {f: s for f, s in (existing or {}).items()}
    fam_rows = Counter(r["family"] for r in rows)
    fam_lang = {r["family"]: r["lang"] for r in rows}
    fam_stratum: dict[str, str] = {}
    for r in rows:
        if fam_stratum.setdefault(r["family"], stratum(r)) != stratum(r):
            raise ValueError(f"family {r['family']} spans two strata")

    lang_rows: dict[str, Counter] = {s: Counter() for s in HELD_OUT}
    for fam, split in assigned.items():
        if split in HELD_OUT and fam in fam_lang:
            lang_rows[split][fam_lang[fam]] += fam_rows[fam]
    lang_total = Counter()
    for fam, n in fam_rows.items():
        lang_total[fam_lang[fam]] += n

    by_stratum: dict[str, list[str]] = defaultdict(list)
    for fam, st in fam_stratum.items():
        by_stratum[st].append(fam)

    for st in sorted(by_stratum):
        fams = sorted(by_stratum[st], key=_order)
        new = [f for f in fams if f not in assigned]
        quota = held_out_count(len(fams))
        for split in HELD_OUT:
            have = sum(1 for f in fams if assigned.get(f) == split)
            for _ in range(max(0, quota - have)):
                if not new:
                    break
                # take the family whose language is least represented in this split so far
                pick = min(new, key=lambda f: (lang_rows[split][fam_lang[f]] / lang_total[fam_lang[f]], _order(f)))
                new.remove(pick)
                assigned[pick] = split
                lang_rows[split][fam_lang[pick]] += fam_rows[pick]
        for f in new:
            assigned[f] = "train"
    return {f: assigned[f] for f in sorted(fam_rows)}


def apply_splits(rows: list[dict], mapping: dict[str, str]) -> list[dict]:
    return [{**r, "split": mapping[r["family"]]} for r in rows]


def load_splits(path: Path = SPLITS_FILE) -> dict[str, str]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_splits(mapping: dict[str, str], path: Path = SPLITS_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(mapping, indent=1, sort_keys=True) + "\n", encoding="utf-8")
