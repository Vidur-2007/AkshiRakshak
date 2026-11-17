import csv
import io
import json

from akshi_ml.iforest_check import OUT as IFOREST_OUT, feature_rows, reference_scores
from akshi_ml.paths import STATEMENTS
from akshi_ml.statements import BUNDLE, HEADER, build
from akshi_ml.validate import PAN_RE

BUILT = build()
TYPES = {"large_new_payee", "burst_small_debits", "odd_hour", "duplicate", "credit_then_return",
         "round_amount_new_payee", "velocity", "isolation_outlier"}


def rows_of(text):
    return list(csv.DictReader(io.StringIO(text)))


def test_generation_is_repeatable_and_committed_files_match():
    assert build() == BUILT
    for name, (text, labels) in BUILT.items():
        assert (STATEMENTS / f"{name}.csv").read_text(encoding="utf-8") == text
        assert json.loads((STATEMENTS / f"{name}.labels.json").read_text(encoding="utf-8")) == labels
    assert json.loads(BUNDLE.read_text(encoding="utf-8")) == [{"id": n, "csv": t} for n, (t, _) in BUILT.items()]


def test_statements_are_canonical_cover_90_days_and_never_go_negative():
    sizes = {}
    for name, (text, _) in BUILT.items():
        assert text.splitlines()[0] == ",".join(HEADER)
        rows = rows_of(text)
        sizes[name] = len(rows)
        stamps = [r["date"] + r["time"] for r in rows]
        assert stamps == sorted(stamps)
        assert rows[0]["date"] == "2026-08-01" and rows[-1]["date"] >= "2026-10-27"
        for r in rows:
            assert bool(r["debit"]) != bool(r["credit"])
            assert float(r["balance"]) >= 0
            assert r["channel"] in {"UPI", "IMPS", "NEFT", "RTGS", "CARD", "ATM", "OTHER"}
    assert sizes["student"] < sizes["salaried"] < sizes["shop"]
    assert 120 <= sizes["student"] <= 180 and 350 <= sizes["shop"] <= 450


def test_labels_point_at_the_injected_rows():
    for name, (text, labels) in BUILT.items():
        rows = rows_of(text)
        assert len(labels) == 2
        for label in labels:
            assert label["type"] in TYPES
            for txn_id in label["txnIds"]:
                assert 1 <= int(txn_id[4:]) <= len(rows)
    get = lambda name, i: rows_of(BUILT[name][0])[int(BUILT[name][1][i]["txnIds"][0][4:]) - 1]  # noqa: E731
    assert get("salaried", 0)["debit"] == "48000.00" and get("salaried", 0)["time"] == "02:47"
    assert get("student", 0)["debit"] == "499.00" and len(BUILT["student"][1][0]["txnIds"]) == 4
    assert get("student", 1)["debit"] == "9999.00" and get("student", 1)["time"] == "23:40"
    assert get("shop", 0)["credit"] == "5000.00" and get("shop", 1)["debit"] == "20000.00"


def test_no_real_looking_identifiers():
    for text, _ in BUILT.values():
        assert not PAN_RE.search(text)
        for r in rows_of(text):
            for part in r["description"].split("/"):
                if part.isdigit():
                    assert len(part) == 12 and part[0] in "01", part    # never a valid Aadhaar or mobile number
            assert r["upi_id"] == "" or ".demo@" in r["upi_id"] or r["upi_id"] in ("task.payout.hr@ybl", "refund.desk2026@ybl")


def test_iforest_reference_is_current():
    ref = json.loads(IFOREST_OUT.read_text(encoding="utf-8"))
    for name, (text, _) in BUILT.items():
        ids, rows = feature_rows(text)
        assert ref[name]["ids"] == ids
        assert ref[name]["sklearn"] == reference_scores(rows)
        assert len(rows[0]) == 8
