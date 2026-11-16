import copy

import pytest

from akshi_ml.validate import validate_row, validate_rows

GOOD = {"id": "kyc-hi-03-007", "text": "आपका KYC अपडेट करें", "lang": "hi", "script": "deva", "channel": "sms",
        "label": "scam", "category": "fake_kyc", "family": "kyc-hi-03", "split": "train", "source": "synthetic",
        "hard_negative": False, "notes": ""}


def with_(**kw):
    r = copy.deepcopy(GOOD)
    r.update(kw)
    return r


def test_good_row_passes():
    assert validate_row(GOOD) == []
    legit = with_(label="legit", category=None, hard_negative=True, id="otp-en-01-001", family="otp-en-01",
                  lang="en", script="latn", text="123456 is your OTP")
    assert validate_row(legit) == []


@pytest.mark.parametrize("bad", [
    with_(lang="ta"), with_(script="arab"), with_(channel="fax"), with_(label="spam"),
    with_(category=None), with_(category="not_a_category"), with_(text="  "),
    with_(label="legit"),                       # legit with a category
    with_(hard_negative=True),                  # scam marked hard negative
    with_(split="dev"), with_(id="kyc-hi-03"),  # bad split, bad id
    with_(id="otp-en-01-001"),                  # id prefix != family
    with_(split="handwritten"),                 # synthetic row in handwritten split
    with_(source="handwritten", split="train"),
    with_(script="telu"),                       # Hindi must be deva/latn/mixed
    with_(hard_negative="no"),                  # wrong type
])
def test_bad_rows_fail(bad):
    assert validate_row(bad)


def test_missing_and_extra_keys():
    r = with_()
    del r["notes"]
    r["extra"] = 1
    errs = validate_row(r)
    assert any("missing" in e for e in errs) and any("unknown" in e for e in errs)


def test_duplicate_ids_and_required_split():
    assert any("duplicate" in e for e in validate_rows([GOOD, GOOD]))
    assert validate_rows([with_(split=None)]) == []
    assert any("split not set" in e for e in validate_rows([with_(split=None)], require_split=True))
