from collections import Counter

from sklearn.feature_extraction.text import CountVectorizer

from akshi_ml.featurize import PUNCT, akshi_analyzer, char_wb_ngrams, lower, word_tokens, words


def split(feats):
    return [f[2:] for f in feats if f.startswith("w:")], [f[2:] for f in feats if f.startswith("c:")]


def test_hand_computed_english():
    w, c = split(akshi_analyzer("Share OTP now!"))
    assert w == ["share", "otp", "now", "share otp", "otp now"]
    # "otp" padded to " otp ": 2-grams, 3-grams, 4-grams, 5-gram
    otp = [" o", "ot", "tp", "p ", " ot", "otp", "tp ", " otp", "otp ", " otp "]
    assert c[c.index(" o"):c.index(" o") + len(otp)] == otp
    # punctuation stays in char grams, not in word tokens
    assert "now!" in c and "w! " in c and "now!" not in w


def test_short_word_yields_one_gram_per_size_then_stops():
    # "a" padded is " a " (3 chars): 2-grams " a", "a "; the 3-gram is the whole padded word, so it is emitted
    # once and the loop over n stops (no 4- or 5-gram)
    assert char_wb_ngrams(["a"]) == [" a", "a ", " a "]
    # "ab" padded is " ab " (4 chars): the 4-gram is the whole word and ends the loop
    assert char_wb_ngrams(["ab"]) == [" a", "ab", "b ", " ab", "ab ", " ab "]


def test_punctuation_stripping():
    assert word_tokens(["(kyc)", "a/c", "--", "rs.500/-", "“otp”", "खाता।", "..."]) == ["kyc", "a/c", "rs.500", "otp", "खाता"]
    assert "।" in PUNCT and "॥" in PUNCT and "…" in PUNCT


def test_devanagari_telugu_bengali_use_code_points():
    w, c = split(akshi_analyzer("खाता बंद"))
    assert w == ["खाता", "बंद", "खाता बंद"]
    assert c[:5] == [" ख", "खा", "ात", "ता", "ा "]          # each matra is its own code point
    w, c = split(akshi_analyzer("మీ ఖాతా"))
    assert w == ["మీ", "ఖాతా", "మీ ఖాతా"]
    assert c[:3] == [" మ", "మీ", "ీ "]
    w, c = split(akshi_analyzer("আপনার টাকা।"))
    assert w == ["আপনার", "টাকা", "আপনার টাকা"]
    assert "কা।" in c and "।" not in "".join(w)


def test_emoji_is_one_code_point_and_a_word_of_its_own():
    w, c = split(akshi_analyzer("Win 🎁 now"))
    assert w == ["win", "🎁", "now", "win 🎁", "🎁 now"]
    assert " 🎁" in c and "🎁 " in c and " 🎁 " in c
    assert all(len(g) <= 5 for g in c)


def test_lowercasing_and_empty_input():
    assert lower("KYC Ünïté İ") == "kyc ünïté i̇"
    assert akshi_analyzer("") == [] and akshi_analyzer(" ") == []
    assert words("a  b") == ["a", "b"]


def test_char_grams_match_scikit_learn_char_wb():
    texts = ["Dear Customer, your SBI a/c will be BLOCKED today!", "आपका खाता बंद हो जाएगा। तुरंत KYC करें",
             "మీ ఖాతా బ్లాక్ అవుతుంది: http://sbi-kyc-update.xyz/kyc", "আপনার ওটিপি 482913 🎁", "a", "to be or"]
    sk = CountVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True).build_analyzer()
    for t in texts:
        ours = [f[2:] for f in akshi_analyzer(t) if f.startswith("c:")]
        assert Counter(ours) == Counter(sk(t)), t


def test_word_grams_match_scikit_learn_on_plain_text():
    sk = CountVectorizer(analyzer="word", ngram_range=(1, 2), token_pattern=r"\S+", lowercase=True).build_analyzer()
    t = "your account will be blocked today update kyc now"
    assert Counter(f[2:] for f in akshi_analyzer(t) if f.startswith("w:")) == Counter(sk(t))
