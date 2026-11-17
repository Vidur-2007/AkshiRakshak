"""Exact port of normalizeText (SPEC.md §7.1, packages/contracts/src/normalize.ts).

1. Unicode NFKC
2. remove U+200B, U+200C, U+200D, U+2060, U+FEFF
3. map Devanagari (U+0966–096F), Bengali (U+09E6–09EF), Telugu (U+0C66–0C6F) digits to ASCII 0–9
4. replace every run of whitespace with one space
5. trim

Python's `\\s` and `str.strip()` treat more characters as whitespace than JavaScript
does (U+001C–U+001F and U+0085). Steps 4 and 5 therefore use JavaScript's exact `\\s`
set, which is also the set `String.prototype.trim()` removes.
"""
import re
import unicodedata

ZERO_WIDTH = re.compile("[​‌‍⁠﻿]")
INDIC_DIGIT = re.compile("[०-९০-৯౦-౯]")
DIGIT_BASES = (0x0966, 0x09E6, 0x0C66)

# ECMAScript WhiteSpace + LineTerminator: what `\s` and trim() match
JS_WHITESPACE = "\t\n\u000b\u000c\r    -     　﻿"
WHITESPACE_RUN = re.compile(f"[{JS_WHITESPACE}]+")
LEADING = re.compile(f"^[{JS_WHITESPACE}]+")
TRAILING = re.compile(f"[{JS_WHITESPACE}]+$")


def _indic_digit_to_ascii(m: re.Match) -> str:
    code = ord(m.group(0))
    for base in DIGIT_BASES:
        if base <= code <= base + 9:
            return str(code - base)
    return m.group(0)


def normalize_text(raw: str) -> str:
    s = unicodedata.normalize("NFKC", raw)
    s = ZERO_WIDTH.sub("", s)
    s = INDIC_DIGIT.sub(_indic_digit_to_ascii, s)
    s = WHITESPACE_RUN.sub(" ", s)
    return TRAILING.sub("", LEADING.sub("", s))
