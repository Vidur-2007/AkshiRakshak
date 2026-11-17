"""scikit-learn reference for the TypeScript Isolation Forest (SPEC_C_DATA.md §6.4, "Validation").

For each sample statement this computes the per-debit feature rows independently in Python and scores them with
sklearn.ensemble.IsolationForest (100 trees, max_samples = min(256, n), seed 42). The TypeScript test checks that
its own feature rows equal these and that its scores have a Spearman rank correlation of at least 0.8 with
scikit-learn's.

Writes packages/insights/test/iforest-reference.json (it also carries the scenario labels, so the TypeScript
tests need no file access). Run from ml/:  python -m akshi_ml.iforest_check
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math

import numpy as np
from sklearn.ensemble import IsolationForest

from .paths import REPO, STATEMENTS

OUT = REPO / "packages" / "insights" / "test" / "iforest-reference.json"
NAMES = ("student", "salaried", "shop")


def feature_rows(csv_text: str) -> tuple[list[str], list[list[float]]]:
    debits = []
    for i, row in enumerate(csv.DictReader(io.StringIO(csv_text)), 1):
        if not row["debit"]:
            continue
        when = dt.datetime.strptime(f"{row['date']} {row['time']}", "%Y-%m-%d %H:%M")
        debits.append((when, i, row))
    debits.sort(key=lambda d: (d[0], d[1]))
    last_seen: dict[str, dt.datetime] = {}
    ids, rows = [], []
    for n, (when, i, row) in enumerate(debits):
        amount = float(row["debit"])
        key = (row["upi_id"] or row["counterparty"] or row["description"]).strip().lower()
        prev = last_seen.get(key)
        days = 90.0 if prev is None else min(90.0, (when - prev).total_seconds() / 86400)
        in_hour = sum(1 for w, _, _ in debits[:n] if (when - w).total_seconds() <= 3600)
        angle = 2 * math.pi * (when.hour + when.minute / 60) / 24
        rows.append([math.log10(max(amount, 0.01)), math.sin(angle), math.cos(angle), 1.0 if prev is None else 0.0,
                     days, float(in_hour), 1.0 if amount >= 1000 and amount % 1000 == 0 else 0.0,
                     1.0 if row["channel"] == "UPI" else 0.0])
        ids.append(f"txn-{i:03d}")
        last_seen[key] = when
    return ids, rows


def reference_scores(rows: list[list[float]]) -> list[float]:
    x = np.array(rows)
    forest = IsolationForest(n_estimators=100, max_samples=min(256, len(rows)), random_state=42).fit(x)
    return [round(float(s), 6) for s in -forest.score_samples(x)]   # the paper's s(x): higher = more unusual


def main() -> None:
    out = {}
    for name in NAMES:
        ids, rows = feature_rows((STATEMENTS / f"{name}.csv").read_text(encoding="utf-8"))
        scores = reference_scores(rows)
        labels = json.loads((STATEMENTS / f"{name}.labels.json").read_text(encoding="utf-8"))
        out[name] = {"ids": ids, "features": [[round(v, 9) for v in r] for r in rows], "sklearn": scores,
                     "labels": [{"txnIds": l["txnIds"], "type": l["type"]} for l in labels]}
        print(f"{name}: {len(ids)} debits, sklearn score range {min(scores):.3f}–{max(scores):.3f}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
