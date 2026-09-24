import re
from PIL import Image

MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_IMAGE_DIM = 1024
MAX_CUSTOM_Q_LEN = 120

URL_REGEX = re.compile(r'https?://[^\s]+', re.IGNORECASE)
CODE_SNIPPET_REGEX = re.compile(r'(<script|import\s+|def\s+|class\s+|SELECT\s+.*FROM)', re.IGNORECASE)

def validate_custom_question(q: str) -> str:
    if not q:
        return ""
    q = q.strip()
    if len(q) > MAX_CUSTOM_Q_LEN:
        raise ValueError(f"Custom question exceeds maximum length of {MAX_CUSTOM_Q_LEN} characters.")
    if URL_REGEX.search(q):
        raise ValueError("Custom question cannot contain URLs.")
    if CODE_SNIPPET_REGEX.search(q):
        raise ValueError("Custom question contains prohibited code patterns.")
    return q

def validate_image(image: Image.Image) -> Image.Image:
    if not isinstance(image, Image.Image):
        raise ValueError("Input must be a valid PIL Image.")
    w, h = image.size
    if w > MAX_IMAGE_DIM or h > MAX_IMAGE_DIM:
        image.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM), Image.Resampling.LANCZOS)
    return image
