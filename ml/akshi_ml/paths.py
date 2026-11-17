"""Repository paths used by the ML scripts."""
from pathlib import Path

ML_DIR = Path(__file__).resolve().parents[1]
REPO = ML_DIR.parent
DATA = REPO / "data"
MESSAGES = DATA / "messages"
TEMPLATES = DATA / "templates"
FILLERS = DATA / "fillers"
STATEMENTS = DATA / "statements"
HANDWRITTEN = DATA / "handwritten"
OUT = ML_DIR / "out"
CONTRACTS_SCHEMAS = REPO / "packages" / "contracts" / "src" / "schemas.ts"
