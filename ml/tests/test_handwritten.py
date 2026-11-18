from pathlib import Path

import pytest

from akshi_ml.handwritten import HandwrittenError, convert, read_csvs

HEADER = "text,lang,channel,label,category,author\n"


def write(tmp: Path, name: str, body: str) -> None:
    (tmp / name).write_text(HEADER + body, encoding="utf-8")


def test_skips_template_and_example_rows(tmp_path):
    write(tmp_path, "TEMPLATE.csv", '"x",en,sms,legit,,Asha\n')
    write(tmp_path, "handwritten-asha.csv", '"482913 is your OTP. Do not share it.",en,sms,legit,,Example\n'
                                             '"Your parcel is out for delivery today.",en,sms,legit,,Asha\n')
    entries = read_csvs(tmp_path)
    assert [e[2]["text"] for e in entries] == ["Your parcel is out for delivery today."]


def test_converts_rows_without_writing_author_names(tmp_path):
    write(tmp_path, "a.csv",
          '"Aapka refund approve ho gaya hai, request accept karke PIN daalo",hi,whatsapp,scam,upi_collect,Ravi\n'
          '"Rs 500 debited from your account XX1234 via UPI.",en,sms,legit,,Asha\n'
          '"ఇది కొత్త రకం మోసం, డబ్బు పంపండి",te,whatsapp,scam,other,Asha\n')
    rows, errs = convert(read_csvs(tmp_path))
    assert errs == []
    assert [r["family"] for r in rows] == ["hw-b", "hw-a", "hw-a"]
    assert all(r["split"] == "handwritten" and r["source"] == "handwritten" for r in rows)
    assert rows[0]["script"] == "latn" and rows[0]["category"] == "upi_collect"
    assert rows[1]["hard_negative"] is True and rows[1]["category"] is None
    assert rows[2]["script"] == "telu" and rows[2]["category"] is None
    assert "Ravi" not in str(rows) and "Asha" not in str(rows)


def test_rejects_real_looking_identifiers_and_bad_values(tmp_path):
    write(tmp_path, "a.csv",
          '"Call 9812345678 now to update KYC",en,sms,scam,fake_kyc,Asha\n'
          '"Hello",xx,sms,legit,,Asha\n'
          '"Pay now",en,sms,scam,not_a_category,Asha\n'
          '"Your OTP is 123456",en,sms,legit,fake_kyc,Asha\n')
    _, errs = convert(read_csvs(tmp_path))
    text = "\n".join(errs)
    assert "invented prefix" in text
    assert "lang must be" in text
    assert "unknown category" in text
    assert "leave category empty" in text


def test_rejects_wrong_columns_and_duplicates(tmp_path):
    (tmp_path / "bad.csv").write_text("message,lang\nhi,en\n", encoding="utf-8")
    with pytest.raises(HandwrittenError):
        read_csvs(tmp_path)
    (tmp_path / "bad.csv").unlink()
    write(tmp_path, "a.csv", '"Same text here",en,sms,legit,,Asha\n"same  text here",en,sms,legit,,Ravi\n')
    _, errs = convert(read_csvs(tmp_path))
    assert any("same text" in e for e in errs)
