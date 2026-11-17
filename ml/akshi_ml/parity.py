"""Write the fixtures the TypeScript tests compare against (SPEC_C_DATA.md §4.5).

- packages/model/test/parity-fixtures.json: 200 validation texts in all four languages (with emoji rows and
  romanised Hindi), each with its normalised form, scikit-learn's pScam and the category model's argmax.
- packages/model/test/featurize-fixtures.json: a few texts with the full feature list of akshi_analyzer.

The reference numbers come from the fitted scikit-learn objects train.py saved (ml/out/pipeline.joblib), not from
the exported JSON, so the test also covers the export and its 5-decimal rounding.

Run from ml/ after train:  python -m akshi_ml.parity
"""
from __future__ import annotations

import hashlib
import json
import re

import joblib

from .build_dataset import OUT as DATASET
from .featurize import akshi_analyzer
from .normalize import normalize_text
from .paths import REPO
from .train import PIPELINE, VERSION_JSON
from .validate import load_jsonl

TEST_DIR = REPO / "packages" / "model" / "test"
PARITY_OUT = TEST_DIR / "parity-fixtures.json"
FEATURIZE_OUT = TEST_DIR / "featurize-fixtures.json"
N = 200
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿]")

FEATURIZE_TEXTS = [
    "Share OTP now!",
    "Dear Customer, your SBI a/c XX1234 will be BLOCKED today. Update KYC: http://sbi-kyc-update.xyz/kyc",
    "आपका खाता बंद हो जाएगा। तुरंत KYC करें",
    "మీ ఖాతా బ్లాక్ అవుతుంది: వెంటనే కాల్ చేయండి",
    "আপনার ওটিপি 482913। কাউকে বলবেন না।",
    "Aapka khata band ho jayega, turant KYC kare!!",
    "🚨 Win ₹25,000 🎁 now — claim “today”…",
    "a",
    "İstanbul ΣΟΦΟΣ ǅ",
    "x  (kyc)  --  rs.500/-",
    "",
]


def pick(rows: list[dict]) -> list[dict]:
    """A repeatable sample of N rows: all emoji rows first, then an even share per (lang, script, label)."""
    order = lambda r: hashlib.sha256(r["id"].encode()).hexdigest()  # noqa: E731
    rows = sorted(rows, key=order)
    chosen = [r for r in rows if EMOJI_RE.search(r["text"])][:30]
    taken = {r["id"] for r in chosen}
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        if r["id"] not in taken:
            groups.setdefault((r["lang"], r["script"], r["label"]), []).append(r)
    while len(chosen) < N and any(groups.values()):
        for key in sorted(groups):
            if groups[key] and len(chosen) < N:
                chosen.append(groups[key].pop(0))
    return sorted(chosen, key=lambda r: r["id"])


def main() -> None:
    bundle = joblib.load(PIPELINE)
    exported = json.loads(VERSION_JSON.read_text(encoding="utf-8"))["version"]
    if bundle["version"] != exported:
        raise SystemExit(f"pipeline.joblib is {bundle['version']} but the exported model is {exported}: rerun train")
    vec, scam, cat = bundle["vectorizer"], bundle["scam"], bundle["category"]
    rows = pick([r for r in load_jsonl(DATASET) if r["split"] == "val"])
    norm = [normalize_text(r["text"]) for r in rows]
    x = vec.transform(norm)
    p_scam = scam.predict_proba(x)[:, 1]
    category = cat.predict(x)
    fixtures = [{"id": r["id"], "lang": r["lang"], "script": r["script"], "text": r["text"], "normalized": n,
                 "pScam": round(float(p), 6), "category": str(c)}
                for r, n, p, c in zip(rows, norm, p_scam, category)]
    TEST_DIR.mkdir(parents=True, exist_ok=True)
    PARITY_OUT.write_text(json.dumps({"modelVersion": exported, "cases": fixtures}, ensure_ascii=False, indent=1) + "\n",
                          encoding="utf-8")
    feats = [{"text": t, "features": akshi_analyzer(t)} for t in map(normalize_text, FEATURIZE_TEXTS)]
    FEATURIZE_OUT.write_text(json.dumps(feats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    langs = {k: sum(1 for f in fixtures if (f["lang"], f["script"]) == k) for k in sorted({(f["lang"], f["script"]) for f in fixtures})}
    print(f"{len(fixtures)} parity cases for model {exported}: {langs}; "
          f"{sum(bool(EMOJI_RE.search(f['text'])) for f in fixtures)} with emoji; {len(feats)} featurizer cases")


if __name__ == "__main__":
    main()
