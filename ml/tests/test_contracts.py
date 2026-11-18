"""The Python enums must match packages/contracts (src/enums.ts, formerly src/schemas.ts) exactly, in the same order."""
import re

from akshi_ml import contracts
from akshi_ml.paths import CONTRACTS_SCHEMAS


def ts_tuple(name: str) -> tuple[str, ...]:
    files = [CONTRACTS_SCHEMAS, CONTRACTS_SCHEMAS.with_name("enums.ts")]
    src = "\n".join(f.read_text(encoding="utf-8") for f in files if f.exists())
    m = re.search(rf"export const {name} = \[(.*?)\] as const", src, re.S)
    assert m, f"{name} not found in packages/contracts/src"
    body = m.group(1)
    return tuple(re.findall(r"'([a-z_]+)'", body))


def test_enums_match_typescript():
    assert contracts.LANGS == ts_tuple("LANGS")
    assert contracts.CHANNELS == ts_tuple("CHANNELS")
    assert contracts.SCAM_CATEGORIES == ts_tuple("SCAM_CATEGORIES")
