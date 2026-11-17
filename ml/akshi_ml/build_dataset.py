"""Build data/messages/messages.jsonl: generate → dedupe → split by family → validate → write → print counts.

Run from ml/:  python -m akshi_ml.build_dataset
Exits 1 (and writes nothing) when a row fails validation or a family yields fewer rows than its max_rows.
Also writes data/messages/stats.json, the source for the tables in docs/dataset-card.md.
"""
from __future__ import annotations

import json
import sys
from collections import Counter

from .contracts import DATASET_CATEGORIES, LANGS
from .generate import generate_family, load_families, load_fillers, write_jsonl
from .paths import MESSAGES
from .split import apply_splits, assign_splits, load_splits, save_splits
from .validate import build_context, validate_rows

OUT = MESSAGES / "messages.jsonl"
STATS = MESSAGES / "stats.json"
SPLIT_ORDER = ("train", "val", "test")
# SPEC_C_DATA.md §3.2: language → (scam, legit, hard negatives)
TARGETS = {"en": (450, 500, 180), "hi": (350, 380, 130), "te": (200, 220, 80), "bn": (200, 220, 80)}


def compute_stats(rows: list[dict]) -> dict:
    by_lls = Counter((r["lang"], r["label"], r["split"]) for r in rows)
    fam_cat: dict[str, set[str]] = {}
    for r in rows:
        if r["label"] == "scam":
            fam_cat.setdefault(r["category"], set()).add(r["family"])
    hi = [r for r in rows if r["lang"] == "hi"]
    return {
        "rows": len(rows),
        "families": len({r["family"] for r in rows}),
        "byLabel": dict(Counter(r["label"] for r in rows)),
        "bySplit": dict(Counter(r["split"] for r in rows)),
        "familiesBySplit": {s: len({r["family"] for r in rows if r["split"] == s}) for s in SPLIT_ORDER},
        "byLangLabelSplit": [
            {"lang": lang, "label": label, **{s: by_lls[(lang, label, s)] for s in SPLIT_ORDER},
             "total": sum(by_lls[(lang, label, s)] for s in SPLIT_ORDER)}
            for lang in LANGS for label in ("scam", "legit")
        ],
        "hardNegativesByLang": {lang: sum(1 for r in rows if r["lang"] == lang and r["hard_negative"])
                                for lang in LANGS},
        "hindiRomanisedShare": round(sum(1 for r in hi if r["script"] == "latn") / max(1, len(hi)), 4),
        "byCategory": [
            {"category": c, "rows": sum(1 for r in rows if r["category"] == c), "families": len(fam_cat.get(c, ())),
             **{s: sum(1 for r in rows if r["category"] == c and r["split"] == s) for s in SPLIT_ORDER},
             "langs": dict(Counter(r["lang"] for r in rows if r["category"] == c))}
            for c in DATASET_CATEGORIES
        ],
        "byChannel": dict(Counter(r["channel"] for r in rows)),
        "byScript": dict(Counter(r["script"] for r in rows)),
    }


def print_tables(stats: dict) -> None:
    print(f"\n{stats['rows']} rows in {stats['families']} families  "
          f"(families per split: {stats['familiesBySplit']})\n")
    print(f"{'lang':<5}{'label':<7}{'train':>7}{'val':>6}{'test':>6}{'total':>7}{'target':>8}")
    for r in stats["byLangLabelSplit"]:
        target = TARGETS[r["lang"]][0 if r["label"] == "scam" else 1]
        print(f"{r['lang']:<5}{r['label']:<7}{r['train']:>7}{r['val']:>6}{r['test']:>6}{r['total']:>7}{target:>8}")
    print("\nhard negatives by language:",
          ", ".join(f"{k} {v} (target {TARGETS[k][2]})" for k, v in stats["hardNegativesByLang"].items()))
    print(f"romanised share of Hindi rows: {stats['hindiRomanisedShare']:.1%} (target ≥ 35%)\n")
    print(f"{'category':<22}{'rows':>6}{'fams':>6}{'train':>7}{'val':>6}{'test':>6}")
    for c in stats["byCategory"]:
        print(f"{c['category']:<22}{c['rows']:>6}{c['families']:>6}{c['train']:>7}{c['val']:>6}{c['test']:>6}")


def shortfalls(stats: dict) -> list[str]:
    out = []
    for r in stats["byLangLabelSplit"]:
        target = TARGETS[r["lang"]][0 if r["label"] == "scam" else 1]
        if r["total"] < target:
            out.append(f"{r['lang']} {r['label']}: {r['total']} rows, target {target}")
    for lang, n in stats["hardNegativesByLang"].items():
        if n < TARGETS[lang][2]:
            out.append(f"{lang} hard negatives: {n}, target {TARGETS[lang][2]}")
    if stats["hindiRomanisedShare"] < 0.35:
        out.append(f"romanised Hindi share {stats['hindiRomanisedShare']:.1%}, target ≥ 35%")
    for c in stats["byCategory"]:
        if c["rows"] < 40 or c["families"] < 5:
            out.append(f"{c['category']}: {c['rows']} rows in {c['families']} families (need ≥ 40 rows, ≥ 5 families)")
        if min(c["train"], c["val"], c["test"]) == 0:
            out.append(f"{c['category']}: missing from a split")
    return out


def main() -> None:
    fillers = load_fillers()
    families = load_families()
    taken: set[str] = set()
    rows: list[dict] = []
    short: list[str] = []
    for fam in families:
        fam_rows = generate_family(fam, fillers, taken)
        if len(fam_rows) < fam.max_rows:
            short.append(f"{fam.family}: {len(fam_rows)} of {fam.max_rows} rows (add templates or slots)")
        rows += fam_rows
    mapping = assign_splits(rows, load_splits())
    rows = apply_splits(rows, mapping)
    errs = validate_rows(rows, require_split=True, ctx=build_context(fillers))
    for e in (errs + short)[:300]:
        print(e)
    if errs or short:
        print(f"\n{len(errs)} validation problems, {len(short)} short families — nothing written")
        sys.exit(1)
    save_splits(mapping)
    write_jsonl(rows, OUT)
    stats = compute_stats(rows)
    STATS.write_text(json.dumps(stats, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print_tables(stats)
    gaps = shortfalls(stats)
    print("\nShortfalls against §3.2:" if gaps else "\nAll §3.2 size targets met.")
    for g in gaps:
        print(" -", g)
    print(f"\nwrote {OUT} and {STATS}")


if __name__ == "__main__":
    main()
