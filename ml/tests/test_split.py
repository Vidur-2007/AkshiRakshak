import json

from akshi_ml.build_dataset import OUT, compute_stats, shortfalls
from akshi_ml.contracts import DATASET_CATEGORIES
from akshi_ml.generate import generate_all, load_families, load_fillers
from akshi_ml.split import apply_splits, assign_splits, held_out_count, load_splits
from akshi_ml.validate import build_context, load_jsonl, validate_rows

ROWS = generate_all(load_families(), load_fillers())


def families_by_split(rows):
    out: dict[str, set[str]] = {}
    for r in rows:
        out.setdefault(r["split"], set()).add(r["family"])
    return out


def test_no_family_crosses_splits():
    rows = apply_splits(ROWS, assign_splits(ROWS))
    by = families_by_split(rows)
    assert set(by) == {"train", "val", "test"}
    assert not (by["train"] & by["val"]) and not (by["train"] & by["test"]) and not (by["val"] & by["test"])
    assert all(len({r["split"] for r in rows if r["family"] == f}) == 1 for f in {r["family"] for r in rows})


def test_every_category_and_language_is_in_every_split():
    rows = apply_splits(ROWS, assign_splits(ROWS))
    for split in ("train", "val", "test"):
        part = [r for r in rows if r["split"] == split]
        assert {r["category"] for r in part if r["label"] == "scam"} == set(DATASET_CATEGORIES), split
        assert {(r["lang"], r["label"]) for r in part} == {(l, y) for l in ("en", "hi", "te", "bn")
                                                           for y in ("scam", "legit")}, split
        assert any(r["hard_negative"] for r in part)


def test_split_sizes_are_roughly_70_15_15():
    rows = apply_splits(ROWS, assign_splits(ROWS))
    share = {s: sum(r["split"] == s for r in rows) / len(rows) for s in ("train", "val", "test")}
    assert 0.60 <= share["train"] <= 0.75 and 0.12 <= share["val"] <= 0.20 and 0.12 <= share["test"] <= 0.20


def test_assignment_is_deterministic_and_existing_families_never_move():
    first = assign_splits(ROWS)
    assert assign_splits(ROWS) == first
    # a new family arrives: nothing already assigned may change
    extra = [{**r, "family": "new-en-99", "id": f"new-en-99-{i:03d}"} for i, r in enumerate(ROWS[:10], 1)]
    second = assign_splits(ROWS + extra, existing=first)
    assert {f: s for f, s in second.items() if f != "new-en-99"} == first
    assert second["new-en-99"] in ("train", "val", "test")
    # pinned assignments are respected even when they differ from what would be computed
    fam = next(f for f, s in first.items() if s == "train")
    assert assign_splits(ROWS, existing={fam: "test"})[fam] == "test"


def test_held_out_count():
    assert [held_out_count(n) for n in (1, 2, 3, 5, 7, 13, 20)] == [0, 0, 1, 1, 1, 2, 3]


def test_committed_dataset_matches_the_generator_and_the_stored_splits():
    rows = load_jsonl(OUT)
    assert validate_rows(rows, require_split=True, ctx=build_context()) == []
    assert rows == apply_splits(ROWS, load_splits())
    assert shortfalls(compute_stats(rows)) == []
    json.dumps(compute_stats(rows))
