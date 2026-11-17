"""Same cases as packages/contracts/test/normalize.test.ts, plus the whitespace characters where Python and JS differ."""
from akshi_ml.normalize import normalize_text as n


def test_maps_devanagari_digits():
    assert n("०१२३४५६७८९") == "0123456789"
    assert n("₹५,०००") == "₹5,000"


def test_maps_bengali_digits():
    assert n("০১২৩৪৫৬৭৮৯") == "0123456789"


def test_maps_telugu_digits():
    assert n("౦౧౨౩౪౫౬౭౮౯") == "0123456789"


def test_removes_zero_width_characters():
    assert n("O​T‌P‍ ⁠cod﻿e") == "OTP code"
    assert n("﻿hello") == "hello"


def test_collapses_whitespace_and_trims():
    assert n("  your \n\n account\t\tis   blocked  ") == "your account is blocked"
    assert n("a  b") == "a b"  # NBSP
    assert n("a\r\nb c") == "a b c"  # CRLF, em space
    assert n("   ") == ""


def test_applies_nfkc():
    assert n("ＫＹＣ ＯＴＰ") == "KYC OTP"  # full-width Latin
    assert n("ﬁle") == "file"  # ligature
    assert n("１２３") == "123"  # full-width digits
    assert n("é") == "é"  # composition


def test_nfkc_before_digit_mapping_and_whitespace_collapse():
    assert n("OTP　:　４५౬") == "OTP : 456"  # ideographic space, mixed digits


def test_is_idempotent():
    s = n(" आपका  खाता‍ ब्लॉक ২৪ ঘণ্টায় ")
    assert n(s) == s


def test_leaves_indic_letters_intact():
    assert n("మీ ఖాతా") == "మీ ఖాతా"


def test_keeps_characters_python_but_not_javascript_calls_whitespace():
    # U+001C–U+001F and U+0085 match Python's \s and strip(), not JavaScript's \s or trim()
    for ch in ("\u001c", "\u001d", "\u001e", "\u001f", "\u0085"):
        assert n(f"a{ch}b") == f"a{ch}b"
        assert n(f"{ch}x{ch}") == f"{ch}x{ch}"
