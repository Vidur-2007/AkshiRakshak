import re
from pathlib import Path

import pytest
import yaml

from akshi_ml.generate import (FamilyError, generate_all, generate_family, indian_group, load_families,
                               load_family, load_fillers, write_jsonl)
from akshi_ml.validate import load_jsonl, validate_rows

FILLERS = load_fillers()
FAMILIES = load_families()


def domains(text):
    # a domain ends in a letters-only TLD of 2+ characters, so amounts like "Rs.4,75,000" are not domains
    # and nothing after a "/" (a path such as /form.php) counts as a host
    return re.findall(r"(?<![/\w.-])(?:https?://)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})\b", text.lower())


def test_example_families_load():
    ids = {f.family for f in FAMILIES}
    assert {"kyc-en-01", "arrest-hir-01", "otp-en-01"} <= ids


def test_rows_are_valid_capped_and_fully_filled(tmp_path):
    rows = generate_all(FAMILIES, FILLERS)
    assert validate_rows(rows) == []
    for fam in FAMILIES:
        n = sum(r["family"] == fam.family for r in rows)
        assert 0 < n <= 25
    assert not any("{" in r["text"] or "}" in r["text"] for r in rows)
    out = tmp_path / "g.jsonl"
    write_jsonl(rows, out)
    assert load_jsonl(out) == rows


def test_generation_is_deterministic():
    assert generate_all(FAMILIES, FILLERS) == generate_all(FAMILIES, FILLERS)


def test_scam_links_come_from_the_scam_list_and_legit_links_are_official():
    scam = {d for ds in FILLERS["scam_domains"].values() for d in ds} | set(FILLERS["shorteners"])
    official = {d for b in FILLERS["banks"] for d in b["domains"]}
    official |= {d for g in FILLERS["brands"].values() for b in g for d in b["domains"]}
    official |= set(FILLERS["official_domains"]["govt"])
    for r in generate_all(FAMILIES, FILLERS):
        for d in domains(r["text"]):
            if "@" in d or re.fullmatch(r"[\d.]+", d):
                continue
            assert d in (scam if r["label"] == "scam" else official), (r["id"], d)


def test_phones_are_invented():
    fake = re.compile(FILLERS["phones"]["fake_regex"])
    for _ in range(200):
        from akshi_ml.generate import Filler, family_rng
        fam = next(f for f in FAMILIES if f.family == "kyc-en-01")
        assert fake.fullmatch(Filler(fam, FILLERS, family_rng("x", str(_))).get("phone"))


def test_indian_grouping():
    assert indian_group(999) == "999"
    assert indian_group(1000) == "1,000"
    assert indian_group(125000) == "1,25,000"
    assert indian_group(15000000) == "1,50,00,000"


def write_family(tmp_path: Path, folder: str, data: dict) -> Path:
    p = tmp_path / folder / f"{data['family']}.yaml"
    p.parent.mkdir(parents=True)
    p.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return p


BASE = {"family": "t-en-01", "label": "scam", "category": "fake_kyc", "lang": "en", "script": "latn",
        "channel": "sms", "templates": ["Update KYC {link}"]}


@pytest.mark.parametrize("change,folder", [
    ({"templates": ["Pay {fee}"]}, "fake_kyc"),             # unknown slot
    ({"templates": ["Pay {amount"]}, "fake_kyc"),           # stray brace
    ({"category": "other"}, "other"),                       # not one of the 19 dataset categories
    ({"label": "legit", "category": None}, "fake_kyc"),     # legit outside templates/legit
    ({"max_rows": 40}, "fake_kyc"),
    ({}, "loan_app"),                                       # folder != category
    ({"family": "renamed"}, "fake_kyc"),                    # file name != family
])
def test_bad_families_are_rejected(tmp_path, change, folder):
    data = {**BASE, **change}
    p = write_family(tmp_path, folder, {**data, "family": BASE["family"]})
    if "family" in change:
        p.write_text(yaml.safe_dump(data), encoding="utf-8")
    with pytest.raises(FamilyError):
        load_family(p)


def test_legit_bank_link_matches_the_named_bank(tmp_path):
    p = write_family(tmp_path, "legit", {"family": "t-legit-01", "label": "legit", "category": None, "lang": "en",
                                         "script": "latn", "channel": "sms", "hard_negative": True,
                                         "templates": ["{bank} alert. Details at {link}"]})
    by_name = {b["name"]["latn"]: b["domains"] for b in FILLERS["banks"]}
    for r in generate_family(load_family(p), FILLERS):
        bank = r["text"].split(" alert.")[0]
        assert any(d in r["text"] for d in by_name[bank])
