"""Train the scam classifier and the category classifier, prune, refit and export (SPEC_C_DATA.md §4.2-4.3).

1. TF-IDF over akshi_analyzer features (sublinear tf, smooth idf, L2 norm, min_df 2), fitted on train.
2. Scam model: logistic regression (liblinear, balanced classes), C picked by validation F1.
3. Category model: multinomial L1 logistic regression (saga) on scam rows, C picked by validation macro-F1.
4. Prune: top 18,000 features by |coefficient| of the scam model plus the top 300 per class of the category model,
   capped at 20,000. Refit the vectorizer on that vocabulary (IDF recomputed on train) and retrain both models with
   the chosen C values, so Python and TypeScript compute exactly the same thing.
5. Export packages/model/model/scam-model.json (+ version.json) and write ml/out/train-report.json.

Only the train and validation splits are read. The test and handwritten splits are never loaded here.

Run from ml/:  python -m akshi_ml.train [--version 2026.11.16-a] [--no-export]
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import warnings
from dataclasses import dataclass

import joblib
import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

from .build_dataset import OUT as DATASET
from .featurize import CHAR_NGRAMS, PUNCT, WORD_NGRAMS, akshi_analyzer
from .normalize import normalize_text
from .paths import OUT, REPO
from .validate import load_jsonl

MODEL_DIR = REPO / "packages" / "model" / "model"
MODEL_JSON = MODEL_DIR / "scam-model.json"
VERSION_JSON = MODEL_DIR / "version.json"
REPORT = OUT / "train-report.json"
PIPELINE = OUT / "pipeline.joblib"   # the fitted scikit-learn objects, read by parity.py
FORMAT = "akshi-lr-v1"
SCAM_C = (0.5, 1, 2, 4, 8)
# The spec lists {0.5, 1, 2, 4}. On L2-normalised tf-idf those are so strong that almost every weight is zero and the
# best value sat on the edge of the grid, so the grid is extended upwards. Still chosen on validation only.
CATEGORY_C = (0.5, 1, 2, 4, 8, 16, 32)
TOP_SCAM, TOP_PER_CLASS, MAX_FEATURES = 18_000, 300, 20_000
SEED = 42
DECIMALS = 5


@dataclass
class Data:
    train_x: list[str]
    train_y: np.ndarray
    val_x: list[str]
    val_y: np.ndarray
    train_scam_x: list[str]
    train_cat: list[str]
    val_scam_x: list[str]
    val_cat: list[str]


def load_data() -> Data:
    rows = [r for r in load_jsonl(DATASET) if r["split"] in ("train", "val")]
    for r in rows:
        r["norm"] = normalize_text(r["text"])
    tr = [r for r in rows if r["split"] == "train"]
    va = [r for r in rows if r["split"] == "val"]
    is_scam = lambda rs: np.array([int(r["label"] == "scam") for r in rs])  # noqa: E731
    return Data(
        [r["norm"] for r in tr], is_scam(tr), [r["norm"] for r in va], is_scam(va),
        [r["norm"] for r in tr if r["label"] == "scam"], [r["category"] for r in tr if r["label"] == "scam"],
        [r["norm"] for r in va if r["label"] == "scam"], [r["category"] for r in va if r["label"] == "scam"],
    )


def make_vectorizer(vocabulary: list[str] | None = None) -> TfidfVectorizer:
    return TfidfVectorizer(analyzer=akshi_analyzer, sublinear_tf=True, smooth_idf=True, norm="l2",
                           min_df=1 if vocabulary is not None else 2, vocabulary=vocabulary)


def scam_model(c: float) -> LogisticRegression:
    return LogisticRegression(class_weight="balanced", solver="liblinear", C=c, max_iter=2000, random_state=SEED)


def category_model(c: float) -> LogisticRegression:
    # l1_ratio=1.0 is pure L1 (scikit-learn 1.8 deprecated the penalty= argument)
    return LogisticRegression(l1_ratio=1.0, solver="saga", C=c, max_iter=4000, random_state=SEED)


def fit_quietly(model, x, y):
    """Fit, and report (rather than hide) whether the solver stopped before converging."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model.fit(x, y)
    converged = not any(issubclass(w.category, ConvergenceWarning) for w in caught)
    other = sorted({str(w.message).split("\n")[0][:120] for w in caught if not issubclass(w.category, ConvergenceWarning)})
    return model, converged, other


def binary_metrics(y, pred) -> dict:
    return {"precision": float(precision_score(y, pred)), "recall": float(recall_score(y, pred)),
            "f1": float(f1_score(y, pred)), "accuracy": float(accuracy_score(y, pred)),
            "fpr": float(((pred == 1) & (y == 0)).sum() / max(1, (y == 0).sum())), "support": int(len(y))}


def train_pair(data: Data, vec: TfidfVectorizer, scam_c: float | None, cat_c: float | None, log: dict):
    """Fit both models on the vectorizer's features. With C None, pick it on validation."""
    xtr, xva = vec.transform(data.train_x), vec.transform(data.val_x)
    grid = []
    for c in ([scam_c] if scam_c is not None else SCAM_C):
        m, ok, notes = fit_quietly(scam_model(c), xtr, data.train_y)
        f1 = float(f1_score(data.val_y, m.predict(xva)))
        grid.append({"C": c, "valF1": round(f1, 5), "converged": ok, "warnings": notes, "model": m})
    best_scam = max(grid, key=lambda g: (g["valF1"], -g["C"]))   # ties go to the smaller C (more regularised)
    log["scamGrid"] = [{k: v for k, v in g.items() if k != "model"} for g in grid]

    xtr_s, xva_s = vec.transform(data.train_scam_x), vec.transform(data.val_scam_x)
    cgrid = []
    for c in ([cat_c] if cat_c is not None else CATEGORY_C):
        m, ok, notes = fit_quietly(category_model(c), xtr_s, data.train_cat)
        f1 = float(f1_score(data.val_cat, m.predict(xva_s), average="macro"))
        cgrid.append({"C": c, "valMacroF1": round(f1, 5), "converged": ok, "warnings": notes,
                      "nonZero": int((m.coef_ != 0).sum()), "model": m})
    best_cat = max(cgrid, key=lambda g: (g["valMacroF1"], -g["C"]))
    log["categoryGrid"] = [{k: v for k, v in g.items() if k != "model"} for g in cgrid]
    return best_scam, best_cat


def prune(vec: TfidfVectorizer, scam: LogisticRegression, cat: LogisticRegression) -> list[str]:
    names = vec.get_feature_names_out()
    keep: list[int] = []
    seen: set[int] = set()

    def add(indices) -> None:
        for i in indices:
            if len(keep) >= MAX_FEATURES:
                return
            if int(i) not in seen:
                seen.add(int(i))
                keep.append(int(i))

    # the category features first: they are few and the category model depends on each of them
    for row in cat.coef_:
        nz = np.flatnonzero(row)
        add(nz[np.argsort(-np.abs(row[nz]), kind="stable")][:TOP_PER_CLASS])
    w = np.abs(scam.coef_[0])
    add(np.argsort(-w, kind="stable")[:TOP_SCAM])
    return sorted(names[i] for i in keep)


def category_accuracy_by_lang(vec, cat) -> dict:
    out = {}
    rows = [x for x in load_jsonl(DATASET) if x["split"] == "val" and x["label"] == "scam"]
    for lang in ("en", "hi", "te", "bn"):
        part = [x for x in rows if x["lang"] == lang]
        pred = cat.predict(vec.transform([normalize_text(x["text"]) for x in part]))
        out[lang] = {"accuracy": r(accuracy_score([x["category"] for x in part], pred)), "support": len(part)}
    return out


def r(x: float) -> float:
    return round(float(x), DECIMALS)


def export(vec, scam, cat, version: str, trained_at: str, metrics: dict) -> dict:
    features = list(vec.get_feature_names_out())
    model = {
        "format": FORMAT, "version": version, "trainedAt": trained_at,
        "featurizer": {"word": list(WORD_NGRAMS), "char": list(CHAR_NGRAMS), "sublinearTf": True, "norm": "l2",
                       "punct": PUNCT},
        "features": features,
        "idf": [r(v) for v in vec.idf_],
        "scam": {"coef": [r(v) for v in scam.coef_[0]], "intercept": r(scam.intercept_[0])},
        "category": {
            "classes": list(cat.classes_),
            "coef": [[[int(j), r(row[j])] for j in np.flatnonzero(row) if r(row[j]) != 0] for row in cat.coef_],
            "intercept": [r(v) for v in cat.intercept_],
        },
        "metrics": metrics,
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(model, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    MODEL_JSON.write_bytes(raw + b"\n")
    sizes = {"rawBytes": len(raw) + 1, "gzipBytes": len(gzip.compress(raw, 9)), "features": len(features),
             "categoryNonZero": sum(len(c) for c in model["category"]["coef"])}
    VERSION_JSON.write_text(json.dumps({"version": version, "trainedAt": trained_at, "format": FORMAT,
                                        "metrics": metrics, **sizes}, indent=2) + "\n", encoding="utf-8")
    return sizes


def main() -> None:
    ap = argparse.ArgumentParser(description="Train, prune, refit and export the scam model")
    ap.add_argument("--version", default=dt.date.today().strftime("%Y.%m.%d") + "-a")
    ap.add_argument("--no-export", action="store_true")
    args = ap.parse_args()

    data = load_data()
    report: dict = {"version": args.version, "rows": {"train": len(data.train_x), "val": len(data.val_x),
                                                       "trainScam": len(data.train_scam_x), "valScam": len(data.val_scam_x)}}
    full = make_vectorizer().fit(data.train_x)
    report["fullVocabulary"] = len(full.vocabulary_)
    stage1: dict = {}
    best_scam, best_cat = train_pair(data, full, None, None, stage1)
    report["selection"] = stage1
    scam_c, cat_c = best_scam["C"], best_cat["C"]

    vocab = prune(full, best_scam["model"], best_cat["model"])
    vec = make_vectorizer(vocab).fit(data.train_x)
    stage2: dict = {}
    final_scam, final_cat = train_pair(data, vec, scam_c, cat_c, stage2)
    scam, cat = final_scam["model"], final_cat["model"]

    xva = vec.transform(data.val_x)
    val = binary_metrics(data.val_y, scam.predict(xva))
    xva_s = vec.transform(data.val_scam_x)
    cat_pred = cat.predict(xva_s)
    metrics = {"valF1": r(val["f1"]), "valCategoryMacroF1": r(f1_score(data.val_cat, cat_pred, average="macro"))}
    report.update({
        "chosen": {"scamC": scam_c, "categoryC": cat_c},
        "prunedVocabulary": len(vocab),
        "beforePruning": {"valF1": best_scam["valF1"], "valCategoryMacroF1": best_cat["valMacroF1"]},
        "final": {"scam": {k: (r(v) if isinstance(v, float) else v) for k, v in val.items()},
                  "categoryMacroF1": metrics["valCategoryMacroF1"],
                  "categoryAccuracy": r(accuracy_score(data.val_cat, cat_pred)),
                  "categoryAccuracyByLang": category_accuracy_by_lang(vec, cat),
                  "scamConverged": final_scam["converged"], "categoryConverged": final_cat["converged"],
                  "warnings": sorted(set(final_scam["warnings"] + final_cat["warnings"]))},
    })
    if not args.no_export:
        trained_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        report["export"] = export(vec, scam, cat, args.version, trained_at, metrics)
    OUT.mkdir(parents=True, exist_ok=True)
    joblib.dump({"version": args.version, "vectorizer": vec, "scam": scam, "category": cat}, PIPELINE)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
