import json

from akshi_ml.contracts import DATASET_CATEGORIES
from akshi_ml.featurize import CHAR_NGRAMS, PUNCT, WORD_NGRAMS
from akshi_ml.train import DECIMALS, FORMAT, MAX_FEATURES, MODEL_JSON, VERSION_JSON

MODEL = json.loads(MODEL_JSON.read_text(encoding="utf-8"))
VERSION = json.loads(VERSION_JSON.read_text(encoding="utf-8"))


def decimals(x: float) -> int:
    s = repr(x)
    return len(s.split(".")[1]) if "." in s and "e" not in s else 0


def test_exported_model_has_the_documented_shape():
    assert MODEL["format"] == FORMAT
    assert MODEL["featurizer"] == {"word": list(WORD_NGRAMS), "char": list(CHAR_NGRAMS), "sublinearTf": True,
                                   "norm": "l2", "punct": PUNCT}
    n = len(MODEL["features"])
    assert 0 < n <= MAX_FEATURES
    assert MODEL["features"] == sorted(set(MODEL["features"]))          # the order scikit-learn uses
    assert all(f[:2] in ("w:", "c:") for f in MODEL["features"])
    assert len(MODEL["idf"]) == n and len(MODEL["scam"]["coef"]) == n
    assert all(v >= 1 for v in MODEL["idf"])                             # smooth idf is never below 1


def test_category_block_is_sparse_and_covers_the_19_categories():
    cat = MODEL["category"]
    assert sorted(cat["classes"]) == sorted(DATASET_CATEGORIES)
    assert len(cat["coef"]) == len(cat["intercept"]) == 19
    n = len(MODEL["features"])
    for row in cat["coef"]:
        assert all(0 <= j < n and w != 0 for j, w in row)
        assert [j for j, _ in row] == sorted(j for j, _ in row)


def test_floats_are_rounded_and_sizes_are_recorded():
    values = MODEL["idf"] + MODEL["scam"]["coef"] + [w for row in MODEL["category"]["coef"] for _, w in row]
    assert max(decimals(v) for v in values) <= DECIMALS
    assert VERSION["version"] == MODEL["version"] and VERSION["metrics"] == MODEL["metrics"]
    assert VERSION["rawBytes"] == MODEL_JSON.stat().st_size <= 1_200_000
    assert VERSION["features"] == len(MODEL["features"])
