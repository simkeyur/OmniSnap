# 05: Data Contracts

## 5.1 Engine API (Gradio `api_name`s; JSON in/out)
### `/analyze` (GPU, `@spaces.GPU(duration=30)`)
Input:
```json
{"image": "<gradio Image/File payload, JPEG ≤ 2 MB, ≤ 1024 px>",
 "domain": "store|home|kitchen|garden|rental|vehicle",
 "area": "<area id from docs/03, e.g. floor, living, walkin, leaf, walls, tires>",
 "context": {"focus": "toddlers", "mode": "move-out", "plant": "tomato"},
 "local_time": "14:02",
 "custom_question": "Is the freezer door left open?"}
```
Output:
```json
{"schema": 1,
 "model": "akhilaaa3/Jev-Omni@<sha>",
 "pack": "store/floor@v1",
 "answers": {
   "spill":      {"type": "noul",  "p": 0.91},
   "crowding":   {"type": "score", "dist": {"Empty": 0.1, "Light": 0.6, "Busy": 0.25, "Packed": 0.05}, "ev": 0.41},
   "custom":     {"type": "noul",  "p": 0.12, "question": "Is the freezer door left open?"}
 },
 "latency_ms": {"total": 1840, "per_question_median": 210},
 "gpu_ms": 1650}
```
Errors: `{"error": {"code": "bad_image|too_large|bad_question|busy", "message": "friendly text"}}`.

### `/note` (GPU, `duration=15`), called only when a new alert opens
Input (structured only, no image):
```json
{"q": "spill", "question": "Is there liquid, a puddle, or a wet patch on the floor?",
 "domain": "store", "area": "floor", "local_time": "14:02", "p": 0.91, "confirmations": 2,
 "context": {"crowding_ev": 0.41, "person_down": 0.03}}
```
Output: `{"note": "Aisle floor, 14:02: likely spill (91%), confirmed twice. Area lightly busy. Place a wet-floor sign and clean up.", "gpu_ms": 900}`

The note style follows the domain (docs/03 "Alert wording per domain"): incident note (store), fix tip (home), corrective action (kitchen), care tip (garden), neutral report line (rental), safety-first action (vehicle).

Server-side note rules:
- ≤ 40 words.
- Must not invent facts beyond the input fields.
- Post-check: every number in the note must come from the input. If not, regenerate once, then fall back to a template.

### `/health` (CPU)
`{"ok": true, "model_shas": {...}, "packs_version": "v1"}`

## 5.2 Session (browser memory; optional localStorage)
```json
{"schema": 1, "started_at": "2026-10-01T14:00:00", "domain": "store", "policy": {...params...},
 "snapshots": [{"id": "s1", "t": "14:02:11", "domain": "store", "area": "floor", "place": "Aisle 4",
                "thumb": "data:image/jpeg;base64,... (160px, optional; never uploaded)",
                "answers": {...}, "source": "camera|gallery"}],
 "resolved": ["alert-id-1"],
 "notes": {"alert-id-1": "..."}}
```
- Saving to `localStorage` is **opt-in** ("Keep this shift on this device"), with try/catch around every access. Thumbnails are stored only if opted in.
- **Export:** "Download shift report" → JSON + a printable HTML summary (no full-size images).

## 5.3 Gallery (`web/data/gallery/index.json`)
```json
[{"id": "g01", "file": "g01.jpg", "domain": "store", "area": "floor", "title": "Juice spill in aisle 4",
  "source": "staged by project author", "license": "CC BY 4.0",
  "answers": {...same shape as /analyze...}, "model": "...@sha"}]
```
All gallery results are **precomputed with the pinned model** (owner quota) and labeled "precomputed" in the UI.
