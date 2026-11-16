"""Generate the three sample bank statements with labelled injected scenarios (SPEC_C_DATA.md §6.5).

Writes, for each of student / salaried / shop:
  data/statements/<id>.csv           90 days in the canonical format
  data/statements/<id>.labels.json   [{ "txnIds": [...], "type": "<anomaly type>", "note": "..." }]
and packages/insights/src/sample-statements.json (the same CSV text, bundled into the app).

Everything is invented: names, UPI IDs, merchants' reference numbers. Transaction ids are txn-001, txn-002, … in
file order, which is how the TypeScript parser numbers rows.

Run from ml/:  python -m akshi_ml.statements
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import random
from dataclasses import dataclass

from .paths import REPO, STATEMENTS

HEADER = ["date", "time", "description", "debit", "credit", "balance", "channel", "counterparty", "upi_id"]
START = dt.date(2026, 8, 1)
DAYS = 90
BUNDLE = REPO / "packages" / "insights" / "src" / "sample-statements.json"


@dataclass
class T:
    when: dt.datetime
    amount: float
    debit: bool
    channel: str
    counterparty: str
    upi: str = ""
    note: str = ""
    desc: str = ""
    tag: str = ""          # scenario tag, for the labels file


class Builder:
    def __init__(self, seed: int, opening: float):
        self.rng = random.Random(seed)
        self.opening = opening
        self.txns: list[T] = []

    def at(self, day: int, hour: int, minute: int) -> dt.datetime:
        return dt.datetime.combine(START + dt.timedelta(days=day), dt.time(hour, minute))

    def rand_time(self, day: int, lo: int, hi: int) -> dt.datetime:
        return self.at(day, self.rng.randrange(lo, hi), self.rng.randrange(60))

    def add(self, when, amount, debit, channel, counterparty, upi="", note="", desc="", tag=""):
        self.txns.append(T(when, float(amount), debit, channel, counterparty, upi, note, desc, tag))

    def upi_out(self, when, amount, name, upi="", note="Payment", tag=""):
        self.add(when, amount, True, "UPI", name, upi, note, tag=tag)

    def upi_in(self, when, amount, name, upi="", note="Payment", tag=""):
        self.add(when, amount, False, "UPI", name, upi, note, tag=tag)

    def describe(self, t: T) -> str:
        if t.desc:
            return t.desc
        if t.channel == "UPI":
            ref = str(self.rng.randrange(2)) + "".join(str(self.rng.randrange(10)) for _ in range(11))
            parts = ["UPI", "DR" if t.debit else "CR", ref, t.counterparty.upper()]
            if t.upi:
                parts += [t.upi.split("@")[1].upper()[:4], t.upi]
            parts.append(t.note)
            return "/".join(parts)
        return f"{t.channel} {'DR' if t.debit else 'CR'} {t.counterparty.upper()}"

    def finish(self) -> tuple[str, list[dict]]:
        self.txns.sort(key=lambda t: t.when)
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(HEADER)
        balance = self.opening
        tags: dict[str, list[str]] = {}
        for i, t in enumerate(self.txns, 1):
            balance += -t.amount if t.debit else t.amount
            if balance < 0:
                raise ValueError(f"balance below zero at row {i}: {t}")
            w.writerow([t.when.strftime("%Y-%m-%d"), t.when.strftime("%H:%M"), self.describe(t),
                        f"{t.amount:.2f}" if t.debit else "", "" if t.debit else f"{t.amount:.2f}",
                        f"{balance:.2f}", t.channel, t.counterparty, t.upi])
            if t.tag:
                tags.setdefault(t.tag, []).append(f"txn-{i:03d}")
        return buf.getvalue(), tags


def student() -> tuple[str, list[dict]]:
    b = Builder(101, 21500)
    r = b.rng
    friends = [("Arjun Nair", "arjun.n.demo@okaxis"), ("Neha Das", "neha.das.demo@ybl"), ("Imran Khan", "imran.k.demo@paytm")]
    for month, first in enumerate((0, 31, 61)):
        b.upi_in(b.at(first, 9, 5 + month), 8000, "Sunita Devi", "sunita.devi.demo@oksbi", "Monthly allowance")
        b.upi_out(b.rand_time(first + 2, 10, 20), 299, "Jio Recharge", note="Recharge")
        b.upi_out(b.rand_time(first + 4, 18, 22), 199, "Netflix", note="Subscription")
    for day in range(DAYS):
        if r.random() < 0.72:
            b.upi_out(b.rand_time(day, 8, 15), r.randrange(40, 180), "College Canteen", note="Food")
        if r.random() < 0.30:
            b.upi_out(b.rand_time(day, 19, 23), r.randrange(120, 380), r.choice(["Swiggy", "Zomato"]), note="Order")
        if r.random() < 0.35:
            b.upi_out(b.rand_time(day, 7, 21), r.randrange(20, 140), r.choice(["Rapido", "Metro Rail"]), note="Ride")
        if r.random() < 0.10:
            name, upi = r.choice(friends)
            b.upi_out(b.rand_time(day, 11, 22), r.randrange(1, 9) * 100, name, upi, "Split")
        if r.random() < 0.06:
            name, upi = r.choice(friends)
            b.upi_in(b.rand_time(day, 11, 22), r.randrange(1, 12) * 100, name, upi, "Thanks")
        if r.random() < 0.07:
            b.upi_out(b.rand_time(day, 10, 19), r.randrange(60, 450), r.choice(["Campus Stationery", "Blinkit"]), note="Purchase")
    # scenario 1: four ₹499 "task" payments to a new payee within 12 minutes
    for k, minute in enumerate((10, 13, 17, 22)):
        b.upi_out(b.at(40, 21, minute), 499, "Task Payout HR", "task.payout.hr@ybl", f"Task {k + 1}", tag="burst")
    # scenario 2: ₹1 credit from a stranger, then ₹9,999 to a new payee at 23:40
    b.upi_in(b.at(66, 23, 31), 1, "Refund Desk", "refund.desk2026@ybl", "Refund test", tag="credit1")
    b.upi_out(b.at(66, 23, 40), 9999, "Refund Desk", "refund.desk2026@ybl", "Refund verify", tag="large")
    csv_text, tags = b.finish()
    return csv_text, [
        {"txnIds": tags["burst"], "type": "burst_small_debits", "note": "4 × ₹499 task payments to a new payee"},
        {"txnIds": tags["large"], "type": "large_new_payee", "note": "₹1 credit then ₹9,999 to a new payee at 23:40"},
    ]


def salaried() -> tuple[str, list[dict]]:
    b = Builder(202, 118000)
    r = b.rng
    people = [("Priya Sharma", "priya.sharma.demo@okhdfcbank"), ("Anil Verma", "anil.verma.demo@ybl"),
              ("Meena Iyer", "meena.iyer.demo@okaxis"), ("Suresh Reddy", "suresh.r.demo@paytm")]
    for month, first in enumerate((0, 31, 61)):
        b.add(b.at(first, 9, 5), 85000, False, "NEFT", "Acme Software Pvt Ltd", desc="NEFT CR SALARY ACME SOFTWARE PVT LTD")
        b.upi_out(b.at(first + 1, 10, 30 + month), 22000, "R Sharma", "sharma.rent.demo@oksbi", "House rent")
        b.add(b.at(first + 4, 6, 15), 12500, True, "OTHER", "Home Loan EMI", desc="NACH DR HOME LOAN EMI")
        b.add(b.at(first + 6, 7, 40), 5000, True, "OTHER", "Groww Mutual Fund SIP", desc="NACH DR SIP GROWW MUTUAL FUND")
        b.upi_out(b.rand_time(first + 8, 9, 20), r.randrange(1500, 2300), "Electricity Board", note="Electricity bill")
        b.upi_out(b.rand_time(first + 9, 9, 20), 999, "Airtel Broadband", note="Broadband")
        b.upi_out(b.rand_time(first + 10, 9, 20), 349, "Jio Recharge", note="Recharge")
        b.add(b.rand_time(first + 11, 18, 22), 649, True, "CARD", "Netflix", desc="POS NETFLIX SUBSCRIPTION")
        for d in (first + 3, first + 17):
            b.add(b.rand_time(d, 10, 20), r.choice([2000, 3000, 5000]), True, "ATM", "ATM Cash", desc="ATM WDL CASH WITHDRAWAL")
    for day in range(DAYS):
        if r.random() < 0.55:
            b.upi_out(b.rand_time(day, 12, 22), r.randrange(150, 720), r.choice(["Swiggy", "Zomato"]), note="Food order")
        if r.random() < 0.22:
            b.upi_out(b.rand_time(day, 8, 21), r.randrange(300, 2200), r.choice(["BigBasket", "Blinkit", "DMart"]), note="Groceries")
        if r.random() < 0.50:
            b.upi_out(b.rand_time(day, 8, 22), r.randrange(120, 620), r.choice(["Uber", "Ola"]), note="Trip")
        if r.random() < 0.09:
            b.add(b.rand_time(day, 10, 22), r.randrange(400, 4200), True, "CARD", r.choice(["Amazon", "Flipkart", "Myntra"]),
                  desc=f"POS {r.choice(['AMAZON', 'FLIPKART', 'MYNTRA'])} ONLINE")
        if r.random() < 0.10:
            name, upi = r.choice(people)
            b.upi_out(b.rand_time(day, 9, 22), r.randrange(5, 50) * 100, name, upi, "Transfer")
        if r.random() < 0.05:
            name, upi = r.choice(people)
            b.upi_in(b.rand_time(day, 9, 22), r.randrange(5, 40) * 100, name, upi, "Returned")
        if r.random() < 0.05:
            b.upi_out(b.rand_time(day, 9, 21), r.randrange(180, 1400), "Apollo Pharmacy", note="Medicines")
        if r.random() < 0.04:
            b.upi_out(b.rand_time(day, 15, 22), r.randrange(300, 900), "BookMyShow", note="Tickets")
    # scenario 1: ₹48,000 to a new payee at 02:47
    b.upi_out(b.at(47, 2, 47), 48000, "Vikram Enterprises", "vikram.ent.demo@ybl", "Urgent", tag="night")
    # scenario 2: the same ₹1,299 charge twice within two minutes
    b.add(b.at(71, 20, 14), 1299, True, "CARD", "Myntra", desc="POS MYNTRA ONLINE", tag="dup")
    b.add(b.at(71, 20, 15), 1299, True, "CARD", "Myntra", desc="POS MYNTRA ONLINE", tag="dup")
    csv_text, tags = b.finish()
    return csv_text, [
        {"txnIds": tags["night"], "type": "large_new_payee", "note": "₹48,000 to a new payee at 02:47"},
        {"txnIds": tags["dup"], "type": "duplicate", "note": "₹1,299 charged twice within a minute"},
    ]


def shop() -> tuple[str, list[dict]]:
    b = Builder(303, 58000)
    r = b.rng
    first_names = ["Ravi", "Pooja", "Farah", "Lakshmi", "Vikram", "Sanjay", "Kavita", "Rahul", "Anita", "Deepa",
                   "Manoj", "Sneha", "Kiran", "Asha", "Rohit", "Nisha", "Gopal", "Rekha", "Arun", "Divya"]
    suppliers = [("Shree Wholesale Traders", "shree.wholesale.demo@okicici"), ("Balaji Distributors", "balaji.dist.demo@ybl"),
                 ("Fresh Dairy Supply", "fresh.dairy.demo@paytm")]
    staff = [("Ramesh Staff", "ramesh.staff.demo@ybl"), ("Sita Staff", "sita.staff.demo@okaxis")]
    for month, first in enumerate((0, 31, 61)):
        b.upi_out(b.at(first + 1, 11, 10 + month), 12000, "Gupta Properties", "gupta.prop.demo@oksbi", "Shop rent")
        b.upi_out(b.rand_time(first + 7, 10, 18), r.randrange(3200, 4100), "Electricity Board", note="Electricity bill")
        for name, upi in staff:
            b.upi_out(b.at(first + 2, 19, r.randrange(5, 55)), 9000, name, upi, "Salary")
    for day in range(DAYS):
        for _ in range(r.randrange(2, 6)):  # customers paying by UPI
            name = f"{r.choice(first_names)} {r.choice('ABCDGKMNPRSTV')}"
            b.upi_in(b.rand_time(day, 9, 21), r.randrange(4, 260) * 10, name, note="Purchase")
        if r.random() < 0.30:
            name, upi = r.choice(suppliers)
            b.upi_out(b.rand_time(day, 10, 18), r.randrange(30, 120) * 100, name, upi, "Stock")
        if r.random() < 0.30:
            b.upi_out(b.rand_time(day, 7, 20), r.randrange(60, 520), r.choice(["Tea Stall", "Petrol Pump", "Courier Counter"]), note="Expense")
    # scenario 1: ₹5,000 from a stranger, "sent by mistake", and ₹5,000 sent back to another ID within 3 hours
    b.upi_in(b.at(35, 13, 12), 5000, "Deepak M", "deepak.m8834.demo@ybl", "Sent by mistake", tag="credit")
    b.upi_out(b.at(35, 15, 48), 5000, "D Mehta", "d.mehta.return.demo@paytm", "Return", tag="return")
    # scenario 2: a round ₹20,000 to a payee never paid before
    b.upi_out(b.at(58, 16, 20), 20000, "Quick Finance Agent", "quick.finance.demo@ybl", "Advance", tag="round")
    csv_text, tags = b.finish()
    return csv_text, [
        {"txnIds": tags["credit"] + tags["return"], "type": "credit_then_return",
         "note": "₹5,000 credit from an unknown sender, ₹5,000 debit within 3 hours"},
        {"txnIds": tags["round"], "type": "round_amount_new_payee", "note": "round ₹20,000 to a new payee"},
    ]


PERSONAS = {"student": student, "salaried": salaried, "shop": shop}


def build() -> dict[str, tuple[str, list[dict]]]:
    return {name: fn() for name, fn in PERSONAS.items()}


def main() -> None:
    STATEMENTS.mkdir(parents=True, exist_ok=True)
    bundle = []
    for name, (csv_text, labels) in build().items():
        (STATEMENTS / f"{name}.csv").write_text(csv_text, encoding="utf-8")
        (STATEMENTS / f"{name}.labels.json").write_text(json.dumps(labels, indent=1, ensure_ascii=False) + "\n",
                                                        encoding="utf-8")
        bundle.append({"id": name, "csv": csv_text})
        print(f"{name}: {csv_text.count(chr(10)) - 1} rows, {len(labels)} labelled scenarios")
    BUNDLE.write_text(json.dumps(bundle, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
