# OmniSnap Engineering Log

## 2026-09-24: Phase 0 Setup & Project Renaming

### Decisions & Approvals
- **Project Name:** OmniSnap (renamed from Store Sentinel / Snap Check to reflect multi-domain inspection utility).
- **GitHub Repository:** `https://github.com/simkeyur/OmniSnap` (Public).
- **Hugging Face Account:** `simkeyur` (authenticated via `hf` CLI).
- **HF Spaces:**
  - Engine: `simkeyur/omnisnap-engine` (Gradio Space, ZeroGPU).
  - Web UI: `simkeyur/omnisnap-site` (Static Space).
- **Constraints confirmed:**
  - $0/month cost ceiling.
  - Stateless engine: images kept in memory only during single request; no persistent storage or logs.
  - Browser-side privacy: resizing (≤768px), EXIF stripping, and optional face/plate blurring before transmission.
  - Client-side policy evaluation: zero extra model calls when tweaking cost thresholds or fusion rules.

### Setup Actions
- [x] Initialized Git repository with `main` branch and linked remote `origin https://github.com/simkeyur/OmniSnap.git`.
- [x] Created `.gitignore`, `models.lock.json`, and directory layout (`engine/`, `web/`, `shared/`, `eval/`, `tests/`).
- [x] Created `shared/question-packs.json` containing 6 domain question packs and severity rules.
- [x] Added CI workflow for JSON schema validation, engine mock tests, and client policy tests.
- [x] Deployed engine to Hugging Face ZeroGPU Space: `https://huggingface.co/spaces/simkeyur/omnisnap-engine`.
- [x] Deployed web UI to Hugging Face Static Space: `https://huggingface.co/spaces/simkeyur/omnisnap-site` (Direct: `https://simkeyur-omnisnap-site.hf.space`).
