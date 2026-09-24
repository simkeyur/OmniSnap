# 01: Key Facts (verified 2026-09-24)

Re-verify items marked **VERIFY** at execution time and log the results.

## Why Jev-Omni (and not a smaller clone)
This project needs **image input**. Jev-Omni is the only open Jev-style model that accepts images; the others (Tiny-Jev, Jev-Style-Qwen, open-jev-deberta) are text-only. So Jev-Omni is required here, unlike in Who's Lying.

## Jev-Omni
- `akhilaaa3/Jev-Omni`, Apache-2.0 (Gemma 4 terms apply to the backbone). An **independent open clone, not TypeSafe's Jev**.
- Gemma-4-12B-it + decision head. Weights FP32 (~50 GB on disk), run in **BF16 (~24 GB VRAM)**.
- API (from its model card):
  ```python
  from huggingface_hub import snapshot_download
  import sys; path = snapshot_download("akhilaaa3/Jev-Omni", revision="<PINNED_SHA>")
  sys.path.insert(0, path)
  from jev_omni import load_jev_omni
  clf = load_jev_omni()
  clf.predict(state="...", question="...", options=["Yes", "No"],
              media="/tmp/photo.jpg", modality="image")
  ```
- **One question per call.** The image is re-processed each call unless we cache the vision features. **VERIFY** whether `jev_omni.py` exposes a way to reuse image embeddings or batch questions. That's the main performance lever.
- ≤ 20 options per question recommended.
- Author-reported (H200, warm): **26 ms per image question**, 83 ms per ~2K-token text. **VERIFY on ZeroGPU** (RTX Pro 6000 Blackwell half-slice).
- Image/video benchmark results are mixed (MVBench 53%), and nothing has been measured on store-safety photos. **Phase 1 exists to find out.**
- Loader reviewed 2026-09-24: `torch.load(weights_only=True)`; the only subprocess is ffmpeg (audio/video only). Re-review if the pinned SHA changes.

## SLM (incident notes only)
- A ~1.5–4B instruct model with a permissive license (e.g. a Qwen3 small instruct variant). **VERIFY** the repo id, license and chat template, then pin it.
- It sees **structured data only** (question ids, probabilities, domain, area, time), never the photo.

## ZeroGPU
- Gradio SDK only. `large` = 48 GB VRAM. `@spaces.GPU(duration=N)`, 60 s default.
- Load models to `cuda` at **module level**.
- Daily quota per **caller**: anonymous 2 min, free account 5 min, PRO 40 min. Visitors spend their own quota.
- Hosting: free accounts older than 30 days with a verified email can have **2 ZeroGPU Spaces**. If Who's Lying also uses one, the account is at its limit (see docs/02 for the shared-engine option).

## Browser camera capture
- **Primary path (most compatible):** `<input type="file" accept="image/*" capture="environment">`. On phones it opens the native camera directly. It needs no permission prompt beyond the OS camera app and works inside iframes. On desktop it falls back to a file picker.
- **Live-viewfinder path (nicer on desktop/Android):** `navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}})` → `<video>` → draw to `<canvas>` → `toBlob("image/jpeg", 0.85)`.
  - Requires HTTPS; HF Spaces serve HTTPS.
  - Inside the huggingface.co Space iframe, camera access depends on the iframe's `allow="camera"` policy. **VERIFY** on the deployed Space. If blocked, link to the direct `*.static.hf.space` URL or fall back to the file-input path.
- Downscale in the browser to **max 768 px** on the long side. Re-encoding through canvas **drops EXIF** (location etc.).

## Budget estimates (replace with Phase 1/2 measurements)
| Item | Estimate |
|---|---|
| Questions per snapshot | 8 (+1 optional custom) |
| GPU time per snapshot | ~1–3 s (8 sequential image questions; less with feature caching) |
| Anonymous visitor (2 min/day) | ~40–120 snapshots/day |
| SLM note | ~1–2 s GPU, only on alerts |
| Owner quota for gallery precompute | 5 min/day, which easily covers ~40 gallery photos |
