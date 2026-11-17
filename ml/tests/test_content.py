import json

from akshi_ml.build_dataset import OUT
from akshi_ml.export_content import (CAMPAIGNS, INDICATORS_OUT, LANDSCAPE_OUT, PINNED, build_indicators,
                                     build_landscape)
from akshi_ml.generate import dedupe_key, load_fillers
from akshi_ml.paths import REPO
from akshi_ml.validate import build_context, identifier_errors, load_jsonl

ROWS = load_jsonl(OUT)
SAMPLES = json.loads((REPO / "packages/content/src/samples.json").read_text(encoding="utf-8"))


def test_committed_content_files_match_the_dataset():
    assert json.loads(INDICATORS_OUT.read_text(encoding="utf-8")) == build_indicators(ROWS, load_fillers())
    assert json.loads(LANDSCAPE_OUT.read_text(encoding="utf-8")) == build_landscape(ROWS)


def test_indicators_come_from_scam_rows_only():
    indicators = build_indicators(ROWS, load_fillers())
    assert indicators[:len(PINNED)] == [{**p, "sampleData": True} for p in PINNED]
    scam_text = " ".join(r["text"].lower() for r in ROWS if r["label"] == "scam")
    legit_text = " ".join(r["text"].lower() for r in ROWS if r["label"] == "legit")
    for i in indicators[len(PINNED):]:
        needle = i["value"][-5:] if i["type"] == "phone" else i["value"]
        assert needle in scam_text, i
        if i["type"] != "phone":
            assert i["value"] not in legit_text, i
        assert i.get("campaign") == CAMPAIGNS.get(i["category"])


def test_sample_messages_are_not_dataset_rows():
    # never from train (SPEC_C_DATA.md §7); they are written fresh, so they match no row of any split
    keys = {dedupe_key(r["text"]) for r in ROWS}
    for s in SAMPLES:
        assert dedupe_key(s["text"]) not in keys, s["id"]


def test_sample_messages_hold_no_real_looking_identifiers():
    ctx = build_context()
    for s in SAMPLES:
        assert identifier_errors({"id": s["id"], "text": s["text"]}, ctx) == [], s["id"]
