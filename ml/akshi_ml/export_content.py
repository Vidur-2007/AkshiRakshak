"""Write the dataset-derived content files for @akshi/content (SPEC_C_DATA.md §7).

- packages/content/src/indicators.json  ~150 scam UPI IDs, phones and domains seen in the synthetic dataset,
  grouped into named campaigns. `reports` is the number of scam rows the value appears in. Everything is sample data.
- packages/content/src/landscape.json   counts of scam rows by category, language and channel.

The first ten indicators are pinned: they are the values the Phase 0 stubs shipped with, and the engine and web
tests on the other branches look them up by value and report count.

Run from ml/ after build_dataset:  python -m akshi_ml.export_content
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict

from .contracts import CHANNELS, DATASET_CATEGORIES, LANGS
from .build_dataset import OUT as DATASET
from .generate import load_fillers
from .paths import REPO
from .validate import MOBILE_RE, hosts_in, load_jsonl
from .normalize import normalize_text

CONTENT_SRC = REPO / "packages" / "content" / "src"
INDICATORS_OUT = CONTENT_SRC / "indicators.json"
LANDSCAPE_OUT = CONTENT_SRC / "landscape.json"
TARGET = 150
UPI_RE = re.compile(r"(?<![\w.-])[a-z0-9][a-z0-9._-]*@[a-z]{2,}(?![\w.])")

PINNED = [
    {"value": "kyc.update.helpdesk@ybl", "type": "upi", "category": "fake_kyc", "reports": 7, "campaign": "kyc-block-wave"},
    {"value": "sbi-kyc-update.xyz", "type": "domain", "category": "fake_kyc", "reports": 6, "campaign": "kyc-block-wave"},
    {"value": "+919876500001", "type": "phone", "category": "fake_kyc", "reports": 5, "campaign": "kyc-block-wave"},
    {"value": "sbi.refund.desk@ybl", "type": "upi", "category": "upi_collect", "reports": 4, "campaign": "refund-collect"},
    {"value": "9876500001@ybl", "type": "upi", "category": "qr_receive", "reports": 3, "campaign": "refund-collect"},
    {"value": "hdfcbenk.top", "type": "domain", "category": "phishing_link", "reports": 2},
    {"value": "parcel-release-help.site", "type": "domain", "category": "courier_customs", "reports": 2, "campaign": "parcel-customs-fee"},
    {"value": "+919876500003", "type": "phone", "category": "courier_customs", "reports": 3, "campaign": "parcel-customs-fee"},
    {"value": "incometax-refund-portal.info", "type": "domain", "category": "impersonation_govt", "reports": 4},
    {"value": "quickhelp.services77@ybl", "type": "upi", "category": "fake_customer_care", "reports": 1},
]

# Named campaigns (sample groupings by scam theme); categories not listed here have no campaign.
CAMPAIGNS = {
    "fake_kyc": "kyc-block-wave", "phishing_link": "kyc-block-wave",
    "upi_collect": "refund-collect", "qr_receive": "refund-collect", "refund_cashback": "refund-collect",
    "courier_customs": "parcel-customs-fee", "bill_disconnection": "power-cut-tonight",
    "digital_arrest": "digital-arrest-calls", "impersonation_govt": "fake-govt-notice",
    "job_task": "task-job-ring", "investment_crypto": "trading-tips-club", "loan_app": "instant-loan-apps",
    "lottery_prize": "lucky-draw-prize", "fake_customer_care": "fake-helpline",
    "remote_access": "fake-helpline", "malicious_apk": "apk-invite",
}


def _order(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def e164(raw: str) -> str:
    return "+91" + re.sub(r"\D", "", raw)[-10:]


def collect(rows: list[dict], scam_domains: set[str]) -> dict[tuple[str, str], Counter]:
    """(type, value) → Counter of categories of the scam rows that contain it."""
    seen: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for r in rows:
        if r["label"] != "scam":
            continue
        text = normalize_text(r["text"])
        found = set()
        for host in hosts_in(text):
            # report the invented registrable domain, not a subdomain trick built on it
            base = next((d for d in scam_domains if host == d or host.endswith("." + d)), None)
            if base:
                found.add(("domain", base))
        found |= {("upi", m.group(0)) for m in UPI_RE.finditer(text.lower())}
        found |= {("phone", e164(m.group(0))) for m in MOBILE_RE.finditer(text)}
        for key in found:
            seen[key][r["category"]] += 1
    return seen


def build_indicators(rows: list[dict], fillers: dict) -> list[dict]:
    scam_domains = {d for group in fillers["scam_domains"].values() for d in group}
    seen = collect(rows, scam_domains)
    out = [{**p, "sampleData": True} for p in PINNED]
    pinned = {(p["type"], p["value"]) for p in PINNED}

    def entry(kind: str, value: str) -> dict:
        cats = seen[(kind, value)]
        category = min(cats, key=lambda c: (-cats[c], c))
        e = {"value": value, "type": kind, "category": category, "reports": sum(cats.values())}
        if category in CAMPAIGNS:
            e["campaign"] = CAMPAIGNS[category]
        return {**e, "sampleData": True}

    for kind in ("domain", "upi"):
        values = sorted(v for k, v in seen if k == kind and (kind, v) not in pinned)
        out += [entry(kind, v) for v in values]
    # phones are random per row, so take an even, repeatable sample across categories to reach the target
    phones = sorted((v for k, v in seen if k == "phone" and ("phone", v) not in pinned), key=_order)
    by_cat: dict[str, list[str]] = defaultdict(list)
    for v in phones:
        by_cat[entry("phone", v)["category"]].append(v)
    picked: list[str] = []
    while len(out) + len(picked) < TARGET and any(by_cat.values()):
        for cat in sorted(by_cat):
            if by_cat[cat] and len(out) + len(picked) < TARGET:
                picked.append(by_cat[cat].pop(0))
    return out + [entry("phone", v) for v in picked]


def build_landscape(rows: list[dict]) -> dict:
    scam = [r for r in rows if r["label"] == "scam"]
    cat, lang, chan = (Counter(r[k] for r in scam) for k in ("category", "lang", "channel"))
    return {
        "byCategory": sorted(({"category": c, "count": cat[c]} for c in DATASET_CATEGORIES if cat[c]),
                             key=lambda x: -x["count"]),
        "byLang": [{"lang": l, "count": lang[l]} for l in LANGS if lang[l]],
        "byChannel": sorted(({"channel": c, "count": chan[c]} for c in CHANNELS if chan[c]),
                            key=lambda x: -x["count"]),
        "sampleData": True,
    }


def main() -> None:
    rows = load_jsonl(DATASET)
    indicators = build_indicators(rows, load_fillers())
    INDICATORS_OUT.write_text(json.dumps(indicators, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    LANDSCAPE_OUT.write_text(json.dumps(build_landscape(rows), indent=2) + "\n", encoding="utf-8")
    kinds = Counter(i["type"] for i in indicators)
    campaigns = sorted({i["campaign"] for i in indicators if "campaign" in i})
    print(f"{len(indicators)} indicators {dict(kinds)} in {len(campaigns)} campaigns: {', '.join(campaigns)}")
    print(f"landscape written from {sum(r['label'] == 'scam' for r in rows)} scam rows")


if __name__ == "__main__":
    main()
