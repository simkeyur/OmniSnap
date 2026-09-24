import json
import os
from pathlib import Path

SHARED_PACKS_PATH = Path(__file__).resolve().parent.parent / "shared" / "question-packs.json"
LOCAL_PACKS_PATH = Path(__file__).resolve().parent / "question-packs.json"

def load_question_packs():
    if SHARED_PACKS_PATH.exists():
        with open(SHARED_PACKS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    elif LOCAL_PACKS_PATH.exists():
        with open(LOCAL_PACKS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError("question-packs.json not found in shared/ or local directory")
