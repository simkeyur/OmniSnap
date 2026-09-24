# Phase 3: Capture → Results

**Goal:** the core loop on every device: pick area → take photo → Check → friendly results card.
**Read first:** [docs/06 §6.1–6.3](../docs/06-ui-spec.md), [docs/07](../docs/07-privacy-safety.md), [docs/01 "Browser camera capture"](../docs/01-key-facts.md).

## Steps
1. `capture.js`:
   - **Path A:** `<input type="file" accept="image/*" capture="environment">` + a "Choose from library" input.
   - **Path B:** `getUserMedia` viewfinder with a shutter and camera switch, shown only if permission is granted and it works in the current frame.
   - Normalize: `createImageBitmap(file, {imageOrientation: "from-image"})` → canvas → downscale ≤ 768 px → `toBlob("image/jpeg", 0.85)`. This drops EXIF and handles HEIC where the browser can decode it; otherwise show the "bad image" error.
2. `blur.js`: lazy-load the face detector only when blur is on, and blur boxes on the canvas before encoding. Show "Faces were blurred" if any were found.
3. `live.js`:
   - `@gradio/client` connect with a retry/backoff loop.
   - Status states from docs/06 §6.3: waking, queue position, slow, quota, down.
   - 3 s client cooldown between checks.
   - A **mock mode** (`?mock=1`) that returns gallery results for UI development and CI.
4. Screens: Welcome, Pick area, Camera/Check, Checking, Results card (docs/06). Use the copy exactly as written in the spec, or better.
5. CI: Playwright on Chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` in mock mode. Test the file-input path using a fixture JPEG.
6. **Real-device QA** by the user or agent on the **deployed** site (not the Mac for compute; just a browser): iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari. Log the results in `LOG.md`.

## Acceptance
- [ ] End-to-end check works on all 5 browser targets against the live engine
- [ ] The uploaded image is ≤ 768 px with no EXIF (verified by inspecting the network payload in Playwright)
- [ ] All error states reachable in mock mode, with the spec copy
- [ ] Results card matches the spec: bands, sorting, clamped 1–99% display, custom question row

## Fallbacks
Camera blocked in the huggingface.co iframe → hide Path B there and add an "Open full screen" link to the direct `*.static.hf.space` URL.
