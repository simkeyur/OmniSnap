# OmniSnap

**A second pair of eyes for your shift, home, or fleet.** 

Snap a photo of any space or item with your phone or laptop camera. An open Jev-style decision model ([Jev-Omni](https://huggingface.co/akhilaaa3/Jev-Omni)) answers about 8 typed safety and inspection questions (e.g. spill? trip hazard? blocked exit? food storage violation? low tire?) in a few seconds, with **calibrated probabilities** rather than free-form text.

Client-side alert policies evaluate thresholds and fuse multi-snapshot observations instantly with **zero extra model calls**, and a lightweight language model generates concise incident notes only when an alert fires.

---

## Key Features

- **6 Inspection Domains:**
  1. 🏬 **Store:** Spills, trip hazards, blocked aisles, stockroom safety, line lengths.
  2. 🏠 **Home:** Fall/trip hazards, loose rugs, walkway cables, child safety, fire risks.
  3. 🍳 **Kitchen:** Commercial food safety, cross-contamination, clean surfaces, refrigeration.
  4. 🌱 **Garden:** Plant health, leaf spots, wilting, soil moisture, pest signs.
  5. 🔑 **Rental:** Move-in/move-out condition, wall scuffs, floor stains, fixture damage.
  6. 🚗 **Vehicle:** Walk-around check, tire pressure, body scratches, leaks, dashboard lights.
- **Privacy by Design:**
  - Downscaled (≤ 768px) and stripped of EXIF metadata entirely inside your browser.
  - Optional client-side face and license plate blurring before transmission.
  - Engine is completely stateless and never logs, caches, or stores user photos.
- **Zero-Compute Policy Tuning:**
  - Alert thresholds and sensitivity sliders re-evaluate your entire session history in milliseconds right in Javascript without querying the model.
- **Zero-Cost Cloud Deployment ($0/month):**
  - Hosted on Hugging Face ZeroGPU (`omnisnap-engine`) and static web spaces (`omnisnap-site`).

---

## Architecture Overview

```
 Phone / Laptop Browser
 ┌──────────────────────────────────────────────┐
 │ omnisnap-site (Static HF Space / Web)        │
 │  • Camera capture & upload                   │
 │  • Downscale 768px + EXIF strip              │
 │  • Optional in-browser face & plate blur     │
 │  • Instant policy engine & session timeline  │
 │  • Sample fallback gallery                   │
 └──────────────────────┬───────────────────────┘
                        │ Gradio Client API
                        ▼
 ┌──────────────────────────────────────────────┐
 │ omnisnap-engine (ZeroGPU Space)              │
 │  • Jev-Omni: ~8 typed questions per photo    │
 │  • SLM: incident notes only on alert firing  │
 │  • Stateless · in-memory only · 0 logs       │
 └──────────────────────────────────────────────┘
```

---

## Development & Testing

```bash
# Run client policy tests & validate question packs
npm test

# Run engine unit tests
python3 -m unittest discover tests/engine
```

---

## Project Structure

- `shared/question-packs.json`: Single source of truth for domain checklists and severity rules.
- `engine/`: ZeroGPU Gradio backend exposing `analyze` and `note` endpoints.
- `web/`: Static client-side frontend (HTML, Vanilla CSS, JS policy engine).
- `docs/`: Technical specifications, architecture, question packs, policy logic, and privacy protocols.
- `phases/`: Step-by-step master implementation plan.

---

> **Disclaimer:** OmniSnap is an open demonstration tool and is **not** a certified safety, health, mechanical, or legal inspection system. Powered by Jev-Omni, an independent open-weight model not affiliated with TypeSafe AI.
