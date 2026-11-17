"""The analyzer shared by training, the parity fixtures and (ported line for line) packages/model/src/featurize.ts.

SPEC_C_DATA.md §4.1. Input is text that already went through normalize_text.

1. Lower-case, one code point at a time (see lower()).
2. Words = the text split on single spaces (normalize_text leaves no other whitespace), empty pieces dropped.
3. Word features: each word with PUNCT stripped from both ends (empty results dropped); unigrams and bigrams over
   those tokens, bigrams joined with one space, prefixed "w:".
4. Char features: for each word (punctuation kept), pad it as " " + word + " " and emit character n-grams for
   n = 2..5 exactly as scikit-learn's char_wb analyzer does, including its rule that a word shorter than n yields
   one gram and then stops. Prefixed "c:".
5. One list, word features first.

Deviation from the spec text, on purpose: the spec says text.lower(); this lower-cases code point by code point
instead. The two differ only for Greek capital sigma at the end of a word. Per-code-point lower-casing is what lets
the TypeScript side keep an exact map from every feature back to its position in the original string.
"""
from __future__ import annotations

ASCII_PUNCT = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
EXTRA_PUNCT = "“”‘’…–—।॥"
PUNCT = ASCII_PUNCT + EXTRA_PUNCT
WORD_NGRAMS = (1, 2)
CHAR_NGRAMS = (2, 5)


def lower(text: str) -> str:
    return "".join(ch.lower() for ch in text)


def words(lowered: str) -> list[str]:
    return [w for w in lowered.split(" ") if w]


def word_tokens(ws: list[str]) -> list[str]:
    return [t for t in (w.strip(PUNCT) for w in ws) if t]


def char_wb_ngrams(ws: list[str], min_n: int = CHAR_NGRAMS[0], max_n: int = CHAR_NGRAMS[1]) -> list[str]:
    grams: list[str] = []
    for w in ws:
        w = " " + w + " "
        w_len = len(w)
        for n in range(min_n, max_n + 1):
            offset = 0
            grams.append(w[offset:offset + n])
            while offset + n < w_len:
                offset += 1
                grams.append(w[offset:offset + n])
            if offset == 0:  # a word shorter than n is counted once
                break
    return grams


def akshi_analyzer(text: str) -> list[str]:
    ws = words(lower(text))
    tokens = word_tokens(ws)
    feats = ["w:" + t for t in tokens]
    feats += ["w:" + a + " " + b for a, b in zip(tokens, tokens[1:])]
    feats += ["c:" + g for g in char_wb_ngrams(ws)]
    return feats
