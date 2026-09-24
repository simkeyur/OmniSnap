# 02: Architecture

## System overview
```
 Phone / laptop browser
 ┌──────────────────────────────────────────────┐
 │ ss-site (static HF Space)                    │
 │  capture → downscale 768px → strip EXIF      │
 │  (optional) blur faces in-browser            │
 │  session timeline + alert rules (all in JS)  │
 │  sample gallery (precomputed JSON)           │
 └───────────────┬──────────────────────────────┘
                 │ @gradio/client: analyze(image, domain, area, q)
                 │                 note(alert_context)        [only on alerts]
                 ▼
 ┌──────────────────────────────────────────────┐
 │ ss-engine (ZeroGPU Gradio Space)             │
 │  Jev-Omni (BF16)  +  small SLM (BF16)        │
 │  stateless · images in memory only · no logs │
 └──────────────────────────────────────────────┘
```
- **All session state lives in the browser tab.** The engine is stateless and stores nothing.
- The alert rules run **only in the browser** (a JS module unit-tested in CI with Node).

## Space budget (free account: 2 ZeroGPU Spaces)
- Store Sentinel needs **1 ZeroGPU Space** (`ss-engine`) and **1 static Space** (`ss-site`, which doesn't count toward the limit).
- If Who's Lying is also built, **ASK THE USER**:
  - (a) two engines, which uses the full allowance, or
  - (b) one shared "jev-lab-engine" Space exposing both APIs. The GPU memory must fit Jev-Omni + both SLMs, or share a single SLM.

## Folder layout
```
store-sentinel/
├── PLAN.md, LOG.md, models.lock.json
├── docs/, phases/, archive/
├── engine/                  # ZeroGPU Gradio Space
│   ├── app.py               # endpoints: analyze, note, health
│   ├── models.py            # module-level load of Jev-Omni + SLM
│   ├── jev.py               # choice/noul/score helpers over Jev-Omni (image)
│   ├── packs.py             # loads question packs (shared JSON with web/)
│   ├── notes.py             # SLM incident note from structured alert data
│   ├── limits.py            # input validation (size, type, dims), rate limits
│   ├── requirements.txt
│   └── README.md            # Space front-matter (sdk: gradio)
├── shared/
│   └── question-packs.json  # single source of truth, copied to engine/ and web/ at build
├── web/                     # static Space
│   ├── index.html
│   ├── app.js               # routing between screens, session state
│   ├── capture.js           # file-input + getUserMedia paths, downscale, EXIF strip
│   ├── blur.js              # optional in-browser face blur
│   ├── policy.js            # fusion + thresholds (pure functions)
│   ├── render.js            # results card, timeline, alerts feed
│   ├── live.js              # @gradio/client calls, retries, status states
│   ├── styles.css
│   ├── data/gallery/        # sample images (licensed/staged) + precomputed results
│   └── README.md            # front-matter: sdk: static
├── eval/
│   ├── photos/              # feasibility set (licensed/staged; faces blurred) + labels.csv
│   ├── run_eval.py          # calls ss-engine via gradio_client (runs in CI, not on the Mac)
│   └── REPORT.md
└── tests/                   # policy.js tests (node), engine unit tests (CPU, mocked models)
```

## Request flow: one snapshot
1. The user taps **Check**. `capture.js` gets an image → downscales to ≤ 768 px → JPEG q=0.85 (drops EXIF) → optional face blur.
2. `live.js` calls `analyze(image, domain, area, context, custom_question?)`. The UI shows "Checking…" with the queue position if any.
3. The engine validates the input (type, ≤ 2 MB, ≤ 1024 px) and runs that domain/area pack's questions (plus the custom one) with Jev-Omni **inside one `@spaces.GPU(duration=30)` call**.
4. It returns `{answers, latency_ms, model}`. The image is discarded when the function returns.
5. The browser adds the snapshot to the session, runs `policy.js` over the whole session, and updates the results card, timeline and alerts.
6. If a **new** alert opened, the browser calls `note(alert_context)`. The SLM returns a ≤ 40-word note from structured fields only.
