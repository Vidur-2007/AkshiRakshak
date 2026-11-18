import copy

import pytest

from akshi_ml.validate import (build_context, hosts_in, quality_errors, script_shares, validate_row,
                                validate_rows)

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


# ---------- Phase 1: quality checks ----------

CTX = build_context()


def row(text, **kw):
    base = {"id": "t-en-01-001", "text": text, "lang": "en", "script": "latn", "channel": "sms", "label": "scam",
            "category": "fake_kyc", "family": "t-en-01", "split": "train", "source": "synthetic",
            "hard_negative": False, "notes": ""}
    return {**base, **kw}


LEGIT = {"label": "legit", "category": None}


def test_clean_rows_pass():
    assert quality_errors(row("Update KYC at https://sbi-kyc-update.xyz/kyc or call +91 98765 01234"), CTX) == []
    assert quality_errors(row("Paid Rs 500 to Ravi. UPI Ref 012345678901. See https://www.hdfcbank.com", **LEGIT), CTX) == []
    assert quality_errors(row("आपका खाता बंद हो जाएगा, तुरंत KYC करें", lang="hi", script="deva"), CTX) == []
    assert quality_errors(row("Aapka khata band ho jayega, turant KYC kare", lang="hi"), CTX) == []
    assert quality_errors(row("మీ ఖాతా బ్లాక్ అవుతుంది", lang="te", script="telu"), CTX) == []
    assert quality_errors(row("আপনার অ্যাকাউন্ট বন্ধ হয়ে যাবে", lang="bn", script="beng"), CTX) == []


@pytest.mark.parametrize("text,kw,needle", [
    ("Your account will be blocked", {"lang": "hi", "script": "deva"}, "labelled deva"),
    ("आपका खाता बंद हो जाएगा", {}, "letters but lang is en"),
    ("Your account will be blocked today", {"lang": "hi"}, "Hindi marker"),
    ("Aapka khata band ho jayega turant", {}, "romanised Hindi marker"),
    ("మీ ఖాతా", {"lang": "bn", "script": "beng"}, "telu"),
    ("Your account", {"lang": "te", "script": "latn"}, "does not fit"),
    ("PAN ABCDE1234F needed", {}, "PAN"),
    ("Aadhaar 2345 6789 0123 needed", {}, "Aadhaar"),
    ("Aadhaar 234567890123 needed", {}, "Aadhaar"),
    ("Card 4321 8765 2109 6543 blocked", {}, "card"),
    ("Card 4321876521096543 blocked", {}, "card or account"),
    ("Account 30211234567 blocked", {}, "account number"),
    ("Call 9999999999 now", {}, "invented prefix"),
    ("Visit http://real-bank.com/login now", {}, "not in the invented scam-domain list"),
    ("Visit https://www.hdfcbank.com now", {}, "not in the invented scam-domain list"),
    ("Track at https://sbi-kyc-update.xyz", LEGIT, "not an official domain"),
    ("Call us on 98765 01234", LEGIT, "no mobile number"),
])
def test_quality_problems_are_caught(text, kw, needle):
    errs = quality_errors(row(text, **kw), CTX)
    assert any(needle in e for e in errs), errs


def test_hosts_ignore_upi_ids_files_amounts_and_evasions():
    text = "Pay Rs.500 to kyc.update.helpdesk@ybl, open Wedding_Invitation.apk, share O.T.P, see /form.php"
    assert hosts_in(text) == []
    assert hosts_in("Go to WWW.SBI-KYC-UPDATE.XYZ/kyc, or hdfcbank.com.secure-verify-now.top।") == [
        "sbi-kyc-update.xyz", "hdfcbank.com.secure-verify-now.top"]


def test_subdomain_tricks_on_scam_domains_are_allowed_but_not_real_domains():
    assert quality_errors(row("Login at http://hdfcbank.com.secure-verify-now.top/login"), CTX) == []
    assert quality_errors(row("Login at http://secure-verify-now.top.example.com/login"), CTX) != []


def test_script_shares_ignore_links():
    shares = script_shares("खाता बंद https://sbi-kyc-update.xyz/kyc")
    assert shares["deva"] == 1.0


def test_handwritten_rows_skip_the_filler_list_checks_but_not_identifiers():
    hw = {"source": "handwritten", "split": "handwritten", "id": "hw-001", "family": "hw"}
    assert quality_errors(row("Visit http://some-invented-site.top now", **hw), CTX) == []
    assert quality_errors(row("PAN ABCDE1234F", **hw), CTX) != []
