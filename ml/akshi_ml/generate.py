"""Dataset generator: template families + slot fillers → JSONL rows (SPEC_C_DATA.md §3.3).

Family file: data/templates/<category>/<family>.yaml (legit families live in data/templates/legit/):

    family: kyc-en-01              # must equal the file name
    label: scam                    # scam | legit
    category: fake_kyc             # a ScamCategory for scam families; null (or omitted) for legit
    lang: en                       # en | hi | te | bn
    script: latn                   # latn | deva | telu | beng | mixed  (romanised Hindi: lang hi, script latn)
    channel: sms                   # a contracts Channel
    hard_negative: false           # legit rows that look like scams on the surface (bank OTP, debit alert, ...)
    max_rows: 25                   # optional, at most 25
    amount: legit_debit            # optional key into fillers/amounts.yaml; defaults to the category
    pools:                         # optional: which filler pool fills a slot (defaults below)
      link: scam_domains.kyc
    templates:
      - "Dear Customer, your {bank} account will be blocked {deadline}. Update KYC: {link}"
    notes: ""

Slots: {bank} {brand} {amount} {link} {phone} {upi} {name} {date} {time} {deadline} {app} {otp}.
A slot repeated in one template gets the same value. {link} with pool official.bank / official.brand uses the
domain of the bank / brand picked for the same row, so a genuine HDFC message links to an HDFC domain.

Macros (not slots): [#N] → N random digits (N = 1..9), e.g. "A/c XX[#4]"; [ref] → a 12-digit reference
number that starts with 0 or 1 (so it can never be read as an Aadhaar number).

Variants (apply_variants): casing, emoji, line breaks, spaced-out evasions ("O T P", "K.Y.C"), digit-for-letter
swaps in bank/brand names, romanised Hindi spellings (aapka/apka), short forms (account → a/c). Links, UPI IDs
and phone numbers are never altered.

Dedupe: a row is dropped when its normalised text equals another row's in any family (ignoring case,
spacing, punctuation and emoji), or when its character
5-gram Jaccard similarity to a row of the same family is above 0.9.

Run from ml/:  python -m akshi_ml.generate [--out ../data/messages/generated.jsonl]
(the full pipeline with splits and validation is python -m akshi_ml.build_dataset)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import random
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .contracts import CHANNELS, DATASET_CATEGORIES, LANGS, SCRIPTS
from .normalize import normalize_text
from .paths import FILLERS, MESSAGES, TEMPLATES

SLOTS = ("bank", "brand", "amount", "link", "phone", "upi", "name", "date", "time", "deadline", "app", "otp")
SLOT_RE = re.compile(r"\{([a-z_]+)\}")
MACRO_RE = re.compile(r"\[#([1-9])\]|\[ref\]")
MAX_ROWS = 25
NEAR_DUP_JACCARD = 0.9
BASE_DATE = dt.date(2026, 11, 10)

DEFAULT_POOLS = {
    "scam": {"link": "scam_domains.generic", "upi": "upi_ids.personal", "brand": "brands.ecommerce",
             "app": "apps.remote", "name": "names"},
    "legit": {"link": "official.bank", "brand": "brands.ecommerce", "app": "apps.official", "name": "names"},
}


class FamilyError(ValueError):
    pass


@dataclass
class Family:
    family: str
    label: str
    category: str | None
    lang: str
    script: str
    channel: str
    hard_negative: bool
    templates: list[str]
    pools: dict[str, str] = field(default_factory=dict)
    amount: str | None = None
    max_rows: int = MAX_ROWS
    notes: str = ""
    path: Path | None = None

    def pool(self, slot: str) -> str | None:
        return self.pools.get(slot) or DEFAULT_POOLS[self.label].get(slot)


# ---------- loading ----------

def load_fillers(root: Path = FILLERS) -> dict:
    fillers: dict = {}
    for f in sorted(root.glob("*.yaml")):
        fillers.update(yaml.safe_load(f.read_text(encoding="utf-8")) or {})
    return fillers


def load_family(path: Path) -> Family:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    fam = Family(
        family=raw.get("family", ""), label=raw.get("label", ""), category=raw.get("category"),
        lang=raw.get("lang", ""), script=raw.get("script", ""), channel=raw.get("channel", ""),
        hard_negative=bool(raw.get("hard_negative", False)), templates=list(raw.get("templates") or []),
        pools=dict(raw.get("pools") or {}), amount=raw.get("amount"), max_rows=int(raw.get("max_rows", MAX_ROWS)),
        notes=raw.get("notes", "") or "", path=path,
    )
    check_family(fam)
    return fam


def check_family(f: Family) -> None:
    where = f"{f.path}: " if f.path else ""
    def fail(msg: str) -> None:
        raise FamilyError(where + msg)

    if f.path is not None and f.family != f.path.stem:
        fail(f"family '{f.family}' must equal the file name '{f.path.stem}'")
    if f.label not in ("scam", "legit"):
        fail(f"label must be scam or legit, got {f.label!r}")
    if f.label == "scam" and f.category not in DATASET_CATEGORIES:
        fail(f"scam families need one of the 19 dataset categories, got {f.category!r}")
    if f.label == "legit" and f.category is not None:
        fail("legit families have category null")
    if f.path is not None and f.path.parent.name != (f.category or "legit"):
        fail(f"file must live in data/templates/{f.category or 'legit'}/")
    if f.label == "scam" and f.hard_negative:
        fail("hard_negative is only for legit families")
    if f.lang not in LANGS or f.script not in SCRIPTS or f.channel not in CHANNELS:
        fail(f"bad lang/script/channel: {f.lang}/{f.script}/{f.channel}")
    if not 1 <= f.max_rows <= MAX_ROWS:
        fail(f"max_rows must be 1..{MAX_ROWS}")
    if not f.templates:
        fail("no templates")
    for t in f.templates:
        unknown = set(SLOT_RE.findall(t)) - set(SLOTS)
        if unknown:
            fail(f"unknown slot(s) {sorted(unknown)} in: {t}")
        if re.search(r"[{}]", SLOT_RE.sub("", t)):
            fail(f"stray brace in: {t}")
    for slot in f.pools:
        if slot not in SLOTS:
            fail(f"pool for unknown slot {slot!r}")


def load_families(root: Path = TEMPLATES) -> list[Family]:
    fams = [load_family(p) for p in sorted(root.glob("*/*.yaml"))]
    seen: dict[str, Path] = {}
    for f in fams:
        if f.family in seen:
            raise FamilyError(f"duplicate family id {f.family}: {seen[f.family]} and {f.path}")
        seen[f.family] = f.path  # type: ignore[assignment]
    return fams


# ---------- slot filling ----------

def script_key(fam: Family) -> str:
    return "latn" if fam.script in ("latn", "mixed") else fam.script


def by_script(value, fam: Family):
    """Fillers may be plain values or {latn, deva, telu, beng} maps."""
    if isinstance(value, dict):
        return value.get(script_key(fam)) or value["latn"]
    return value


def indian_group(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts) + "," + tail


def fill_pattern(pattern: str, rng: random.Random) -> str:
    return "".join(str(rng.randrange(10)) if c == "#" else c for c in pattern)


def lookup(fillers: dict, dotted: str):
    node = fillers
    for part in dotted.split("."):
        node = node[part]
    return node


class Filler:
    """Picks slot values for one row; a slot keeps its value within the row."""

    def __init__(self, fam: Family, fillers: dict, rng: random.Random):
        self.fam, self.fillers, self.rng, self.values = fam, fillers, rng, {}
        self.bank_rec: dict | None = None
        self.brand_rec: dict | None = None

    def get(self, slot: str) -> str:
        if slot not in self.values:
            self.values[slot] = getattr(self, f"_{slot}")()
        return self.values[slot]

    def _swap(self, name: str) -> str:
        """Scam rows in Latin script sometimes write the brand with a digit for a letter (HDFC B4nk, Amaz0n)."""
        if self.fam.label != "scam" or script_key(self.fam) != "latn" or self.rng.random() >= 0.10:
            return name
        spots = [i for i, c in enumerate(name) if c.lower() in DIGIT_SWAPS]
        if not spots:
            return name
        i = self.rng.choice(spots)
        return name[:i] + DIGIT_SWAPS[name[i].lower()] + name[i + 1:]

    def _bank(self) -> str:
        self.bank_rec = self.bank_rec or self.rng.choice(self.fillers["banks"])
        return self._swap(by_script(self.bank_rec["name"], self.fam))

    def _brand(self) -> str:
        pool = (self.fam.pool("brand") or "brands.ecommerce").split(".", 1)[1]
        self.brand_rec = self.brand_rec or self.rng.choice(self.fillers["brands"][pool])
        return self._swap(by_script(self.brand_rec["name"], self.fam))

    def _amount(self) -> str:
        key = self.fam.amount or self.fam.category or "default"
        lo, hi, step = self.fillers["amounts"].get(key) or self.fillers["amounts"]["default"]
        if hi <= 0:
            lo, hi, step = self.fillers["amounts"]["default"]
        n = self.rng.randrange(lo, hi + 1, step)
        fmt = self.rng.choice(by_script(self.fillers["formats"], self.fam))
        return fmt.format(n=indian_group(n))

    def _link(self) -> str:
        pool = self.fam.pool("link") or ""
        rng = self.rng
        if pool.startswith("official."):
            kind = pool.split(".", 1)[1]
            if kind == "bank":
                self.get("bank")
                domain = rng.choice(self.bank_rec["domains"])  # type: ignore[index]
            elif kind == "brand":
                self.get("brand")
                if not self.brand_rec["domains"]:  # type: ignore[index]
                    raise FamilyError(f"{self.fam.family}: brand {self.brand_rec['id']} has no official domain")  # type: ignore[index]
                domain = rng.choice(self.brand_rec["domains"])  # type: ignore[index]
            else:
                domain = rng.choice(self.fillers["official_domains"][kind])
            # only shop and courier sites get a path; bank and government links are the bare official domain
            brand_kind = (self.fam.pool("brand") or "brands.ecommerce").split(".", 1)[1] if kind == "brand" else ""
            paths = self.fillers["official_domains"]["paths"].get(brand_kind, [])
            path = rng.choice(["", ""] + paths)
            return rng.choice(["https://www.{d}{p}", "https://{d}{p}", "{d}{p}"]).format(d=domain, p=path)
        if pool == "shorteners":
            code = "".join(rng.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(6))
            return f"https://{rng.choice(self.fillers['shorteners'])}/{code}"
        domain = rng.choice(lookup(self.fillers, pool))
        path = rng.choice(self.fillers["paths"])
        return rng.choice(["https://{d}{p}", "http://{d}{p}", "{d}{p}", "www.{d}{p}"]).format(d=domain, p=path)

    def _phone(self) -> str:
        return fill_pattern(self.rng.choice(self.fillers["phones"]["patterns"]), self.rng)

    def _upi(self) -> str:
        return self.rng.choice(lookup(self.fillers, self.fam.pool("upi") or "upi_ids.personal"))

    def _name(self) -> str:
        pool = self.fam.pool("name") or "names"
        node = self.fillers["names"] if pool == "names" else lookup(self.fillers, pool)
        if pool == "names":
            node = {k: v for k, v in node.items() if k in ("latn", "deva", "telu", "beng")}
        return self.rng.choice(by_script(node, self.fam))

    def _date(self) -> str:
        d = BASE_DATE + dt.timedelta(days=self.rng.randrange(-20, 15))
        return d.strftime(self.rng.choice(self.fillers["date_formats"]))

    def _time(self) -> str:
        t = dt.datetime.combine(BASE_DATE, dt.time(self.rng.randrange(24), self.rng.randrange(60)))
        return t.strftime(self.rng.choice(self.fillers["time_formats"]))

    def _deadline(self) -> str:
        pool = self.fillers["deadlines"]
        key = "hinglish" if self.fam.lang == "hi" and self.fam.script == "latn" else script_key(self.fam)
        return self.rng.choice(pool.get(key) or pool["latn"])

    def _app(self) -> str:
        return self.rng.choice(lookup(self.fillers, self.fam.pool("app") or "apps.remote"))

    def _otp(self) -> str:
        return "".join(str(self.rng.randrange(10)) for _ in range(6))


def family_rng(family_id: str, salt: str = "") -> random.Random:
    seed = int.from_bytes(hashlib.sha256(f"{family_id}{salt}".encode()).digest()[:8], "big")
    return random.Random(seed)


def expand_macros(template: str, rng: random.Random) -> str:
    def sub(m: re.Match) -> str:
        if m.group(1):
            return "".join(str(rng.randrange(10)) for _ in range(int(m.group(1))))
        return str(rng.randrange(2)) + "".join(str(rng.randrange(10)) for _ in range(11))
    return MACRO_RE.sub(sub, template)


def fill(template: str, filler: Filler) -> str:
    return SLOT_RE.sub(lambda m: filler.get(m.group(1)), expand_macros(template, filler.rng))


# ---------- variants ----------

DIGIT_SWAPS = {"o": "0", "a": "4", "i": "1", "e": "3", "s": "5"}
EVASION_WORDS = ("OTP", "KYC", "PIN", "UPI", "ATM", "CVV", "APK")
SCAM_EMOJI = ["⚠️", "🚨", "✅", "🎁", "💰", "👉", "🔴", "📢", "‼️", "🙏"]
LEGIT_EMOJI = ["🙂", "👍", "🙏", "😊", "😄"]
SHORT_FORMS = {"account": "a/c", "your": "ur", "please": "pls", "immediately": "immediatly",
               "customer": "costumer", "you": "u", "message": "msg"}
# Romanised Hindi spellings that mean the same word; a matched word is swapped for another in its group.
HINGLISH_GROUPS = [
    ["aapka", "apka"], ["aapke", "apke"], ["aapki", "apki"], ["aapko", "apko"], ["khata", "khaata"],
    ["nahi", "nahin", "nhi"], ["kare", "karein", "karen"], ["kijiye", "kijie"], ["liye", "lie"],
    ["mein", "me"], ["turant", "turnt"], ["rupaye", "rupay", "rupye"], ["warna", "varna"],
    ["zaroori", "jaruri", "zaruri"], ["abhi", "abi"], ["kripya", "kripaya"], ["raha", "rha"],
    ["gaya", "gya"], ["kyunki", "kyuki"], ["jayega", "jaega"], ["yahan", "yaha"], ["bahut", "bohot", "bhut"],
    ["hai", "h"], ["karna", "krna"], ["kar", "kr"], ["paise", "paisey"], ["bhej", "bhej"],
]
HINGLISH_MAP = {w: g for g in HINGLISH_GROUPS for w in g}
_WORD_RE = re.compile(r"[A-Za-z]+")
_PROTECTED_RE = re.compile(r"://|@|^www\.|\.[A-Za-z]{2,}(/|$)|^\+?\d[\d\s-]*$|\.apk\b", re.IGNORECASE)


def _is_protected(token: str) -> bool:
    """Links, UPI IDs, file names and numbers are left exactly as generated."""
    return bool(_PROTECTED_RE.search(token.strip(".,;:!?()\"'।")))


def _map_tokens(text: str, fn) -> str:
    return "".join(t if (t.isspace() or _is_protected(t)) else fn(t) for t in re.split(r"(\s+)", text))


def _keep_case(src: str, dst: str) -> str:
    if src.isupper() and len(src) > 1:
        return dst.upper()
    return dst.capitalize() if src[:1].isupper() else dst


def apply_variants(text: str, fam: Family, rng: random.Random) -> str:
    latn = script_key(fam) == "latn"
    scam = fam.label == "scam"
    chatty = fam.channel in ("whatsapp", "telegram")

    if fam.lang == "hi" and latn:
        def hing(tok: str) -> str:
            def sub(m: re.Match) -> str:
                group = HINGLISH_MAP.get(m.group(0).lower())
                if group and rng.random() < 0.35:
                    return _keep_case(m.group(0), rng.choice(group))
                return m.group(0)
            return _WORD_RE.sub(sub, tok)
        text = _map_tokens(text, hing)

    if fam.lang == "en" and (scam or chatty) and rng.random() < 0.15:
        present = [w for w in SHORT_FORMS if re.search(rf"\b{w}\b", text, re.IGNORECASE)]
        if present:
            w = rng.choice(present)
            text = _map_tokens(text, lambda t: re.sub(rf"\b{w}\b", lambda m: _keep_case(m.group(0), SHORT_FORMS[w]),
                                                       t, flags=re.IGNORECASE))

    if scam and rng.random() < 0.12:
        present = [w for w in EVASION_WORDS if re.search(rf"\b{w}\b", text)]
        if present:
            w = rng.choice(present)
            spaced = rng.choice([" ", "."]).join(w)
            text = _map_tokens(text, lambda t: re.sub(rf"\b{w}\b", spaced, t))

    if latn:
        r = rng.random()
        if scam and r < 0.07:
            text = _map_tokens(text, str.upper)
        elif (scam and r < 0.19) or (not scam and chatty and r < 0.15):
            text = _map_tokens(text, str.lower)

    if rng.random() < 0.12:
        text = re.sub(r"([.!?।]) (?=\S)", r"\1\n", text)

    p_emoji = (0.30 if chatty else 0.04) if scam else (0.15 if chatty else 0.0)
    if rng.random() < p_emoji:
        e = rng.choice(SCAM_EMOJI if scam else LEGIT_EMOJI)
        text = f"{e} {text}" if (scam and rng.random() < 0.5) else f"{text} {e}"
    return text


# ---------- dedupe ----------

def dedupe_key(text: str) -> str:
    """Letters and digits of the normalised text, case-folded: rows that differ only in case, spacing,
    punctuation or emoji count as the same row."""
    return "".join(ch for ch in normalize_text(text).casefold() if ch.isalnum() or unicodedata.category(ch).startswith("M"))


def _gram_text(text: str) -> str:
    return normalize_text(text).casefold()


def char_ngrams(text: str, n: int = 5) -> frozenset[str]:
    t = _gram_text(text)
    if len(t) <= n:
        return frozenset([t])
    return frozenset(t[i:i + n] for i in range(len(t) - n + 1))


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    union = len(a | b)
    return len(a & b) / union if union else 1.0


def is_near_duplicate(grams: frozenset[str], others: list[frozenset[str]], threshold: float = NEAR_DUP_JACCARD) -> bool:
    return any(jaccard(grams, o) > threshold for o in others)


# ---------- generation ----------

def generate_family(fam: Family, fillers: dict, taken: set[str] | None = None) -> list[dict]:
    """Rows for one family. `taken` holds the dedupe keys of rows already produced by other families."""
    rng = family_rng(fam.family)
    taken = taken if taken is not None else set()
    rows: list[dict] = []
    grams: list[frozenset[str]] = []
    # no template may supply much more than its even share, so a family cannot be one template repeated
    cap = math.ceil(fam.max_rows / len(fam.templates)) + 1
    used = [0] * len(fam.templates)
    for i in range(fam.max_rows * 20):
        if len(rows) >= fam.max_rows:
            break
        t = i % len(fam.templates)
        if used[t] >= cap:
            continue
        text = fill(fam.templates[t], Filler(fam, fillers, rng))
        text = apply_variants(text, fam, rng)
        key = dedupe_key(text)
        if key in taken:
            continue
        g = char_ngrams(text)
        if is_near_duplicate(g, grams):
            continue
        taken.add(key)
        used[t] += 1
        grams.append(g)
        rows.append({
            "id": f"{fam.family}-{len(rows) + 1:03d}", "text": text, "lang": fam.lang, "script": fam.script,
            "channel": fam.channel, "label": fam.label, "category": fam.category, "family": fam.family,
            "split": None, "source": "synthetic", "hard_negative": fam.hard_negative, "notes": fam.notes,
        })
    return rows


def generate_all(families: list[Family] | None = None, fillers: dict | None = None) -> list[dict]:
    fillers = fillers if fillers is not None else load_fillers()
    families = families if families is not None else load_families()
    taken: set[str] = set()
    return [row for fam in families for row in generate_family(fam, fillers, taken)]


def write_jsonl(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, default=MESSAGES / "generated.jsonl")
    args = ap.parse_args()
    rows = generate_all()
    write_jsonl(rows, args.out)
    fams = sorted({r["family"] for r in rows})
    print(f"wrote {len(rows)} rows from {len(fams)} families to {args.out}")


if __name__ == "__main__":
    main()
