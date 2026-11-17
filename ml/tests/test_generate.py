import random
import re
from pathlib import Path

import pytest
import yaml

from akshi_ml.generate import (Family, FamilyError, apply_variants, char_ngrams, dedupe_key, expand_macros,
                               is_near_duplicate, jaccard, generate_all, generate_family, indian_group, load_families,
                               load_family, load_fillers, write_jsonl)
from akshi_ml.validate import build_context, load_jsonl, validate_rows

FILLERS = load_fillers()
FAMILIES = load_families()


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


def test_every_generated_row_passes_the_quality_checks():
    # script/language agreement, no real-looking identifiers, scam domains from the fillers, official legit links
    assert validate_rows(generate_all(FAMILIES, FILLERS), ctx=build_context(FILLERS)) == []


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


# ---------- Phase 1: macros, variants, dedupe ----------

def fam(**kw) -> Family:
    base = dict(family="t-en-01", label="scam", category="fake_kyc", lang="en", script="latn", channel="whatsapp",
                hard_negative=False, templates=["x"])
    return Family(**{**base, **kw})


def test_macros():
    rng = random.Random(1)
    assert re.fullmatch(r"XX\d{4}", expand_macros("XX[#4]", rng))
    for _ in range(50):
        ref = expand_macros("[ref]", rng)
        assert re.fullmatch(r"[01]\d{11}", ref)  # never a valid Aadhaar (those start 2-9)


def test_variants_never_touch_links_upi_ids_or_phones():
    text = "Update your KYC and OTP at https://sbi-kyc-update.xyz/kyc or pay kyc.update.helpdesk@ybl, call +91 98765 01234 please"
    seen = set()
    for seed in range(400):
        out = apply_variants(text, fam(), random.Random(seed))
        seen.add(out)
        assert "https://sbi-kyc-update.xyz/kyc" in out
        assert "kyc.update.helpdesk@ybl" in out
        assert "+91 98765 01234" in out
    joined = "\n".join(seen)
    assert len(seen) > 5
    assert "UPDATE YOUR" in joined                       # casing
    assert "O T P" in joined or "O.T.P" in joined or "K Y C" in joined or "K.Y.C" in joined   # spaced-out evasion
    assert "pls" in joined or "ur " in joined            # short forms
    assert any(e in joined for e in ("⚠️", "🚨", "✅"))    # emoji


def test_legit_sms_rows_get_no_scam_style_variants():
    text = "Your OTP is 123456. Do not share your PIN with anyone."
    f = fam(label="legit", category=None, channel="sms", hard_negative=True)
    for seed in range(300):
        out = apply_variants(text, f, random.Random(seed))
        assert out.replace("\n", " ") == text


def test_hinglish_spelling_variants():
    f = fam(lang="hi", category="fake_kyc")
    outs = {apply_variants("Aapka khata band ho jayega, turant KYC kare", f, random.Random(s)).lower() for s in range(300)}
    joined = " ".join(outs)
    assert "apka" in joined and "khaata" in joined and ("karein" in joined or "karen" in joined)


def test_dedupe_key_ignores_case_spacing_punctuation_and_emoji():
    assert dedupe_key("Reached  home safely.") == dedupe_key("reached home\nsafely 🙂")
    assert dedupe_key("खाता बंद") != dedupe_key("खाता चालू")
    assert dedupe_key("की") != dedupe_key("का")            # vowel signs are kept


def test_near_duplicates():
    a = char_ngrams("Dear Customer, your SBI account will be blocked today due to pending KYC. Update now")
    b = char_ngrams("Dear Customer, your SBI account will be blocked today due to pending KYC. Update now!")
    c = char_ngrams("Your parcel is held at customs. Pay the clearance fee to release it today")
    assert jaccard(a, b) > 0.9 and is_near_duplicate(b, [c, a])
    assert jaccard(a, c) < 0.3 and not is_near_duplicate(c, [a])


def test_no_two_rows_share_a_dedupe_key_and_no_near_duplicates_inside_a_family():
    rows = generate_all(FAMILIES, FILLERS)
    keys = [dedupe_key(r["text"]) for r in rows]
    assert len(keys) == len(set(keys))
    by_family: dict[str, list] = {}
    for r in rows:
        by_family.setdefault(r["family"], []).append(char_ngrams(r["text"]))
    for family, grams in by_family.items():
        for i, g in enumerate(grams):
            assert not is_near_duplicate(g, grams[:i]), family


def test_every_family_reaches_its_row_count_from_several_templates():
    rows = generate_all(FAMILIES, FILLERS)
    for f in FAMILIES:
        assert sum(r["family"] == f.family for r in rows) == f.max_rows, f.family
        assert len(f.templates) >= 3, f.family
