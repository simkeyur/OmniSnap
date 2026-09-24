# Store Sentinel: Execution Plan

> **Audience:** any LLM coding agent (or human) executing this project step by step.
> **Read this whole file before doing anything.** Execute phases in order. Each phase has **inputs, steps, outputs and acceptance criteria**. Do not start a phase until the previous phase's criteria pass. Where it says **ASK THE USER**, stop and get explicit approval.

*Plan drafted 2026-09-24. Background research: [`../jev-research.md`](../../jev-research.md).*

---

## 0. Project summary

**What we're building:** a public showcase of a *Jev-style typed-decision model* watching retail store camera footage. Every ~1 s of video, the model answers ~8 typed questions about the frame (spill? person down? empty shelf? queue length?) and returns **calibrated probabilities, not text**. The demo shows:

1. **A probability grid** updating as the video plays (many questions per frame).
2. **Probability timelines** with alert markers, where alerts come from *temporal fusion* of probabilities.
3. **Policy sliders.** Visitors change the costs of false alarms and misses, and alerts **re-decide instantly across the whole clip with zero new model calls**. This is the headline feature. It shows "probabilities as an API", which LLMs can't provide.
4. **A small language model (SLM) that wakes up only when an alert fires** to write an incident note. The expensive/generative model stays mostly idle.
5. **A cost/latency meter** comparing *estimated* cost of the same decisions made by a vision LLM vs. the decision model.
6. *(Optional)* **"Try your own photo"** live mode on Hugging Face ZeroGPU.

**Why this use case:** it plays to what Jev-style models do well and LLMs do badly. That means high-frequency, multi-question, multimodal decisions where calibrated probabilities feed math (fusion, cost-sensitive thresholds). Single low-volume decisions like "is this item a banana" are deliberately *not* the focus.

**Hosting target: $0/month.**
- Main showcase: **static Hugging Face Space** (free) that replays precomputed probabilities.
- Live mode: **ZeroGPU Gradio Space** (free for accounts older than 30 days with a verified email; GPU time is charged to each *visitor's* daily quota, not the owner's).

---

## 1. Key facts the executor needs (verified 2026-09-24)

### 1.1 The decision model: Jev-Omni (NOT TypeSafe's Jev)

- **TypeSafe's Jev** is proprietary, API-only, and text-only. We do **not** use it at runtime. It's referenced only in the cost meter.
- **Jev-Omni** (`akhilaaa3/Jev-Omni`) is an **independent open-weight clone** (Apache-2.0). It's Gemma-4-12B-it plus a trained decision head, fine-tuned on 30K questions. Inputs: text, image, audio (≤30 s), video (16 frames). Output: a probability per supplied option.
  - Best with **≤ 20 options** per question (the head accepts 256, but quality above 20 is untested).
  - Self-reported: JevBench 86.2%, DecisionBench-Medium 87.6%, ECE 0.04, MVBench (video) **53.1%** (weak, so we use **single frames**, not video mode).
  - **Answers one question per call** (the state is re-sent for each question). There's no multi-question single pass.
  - Speed (author's figures): H200 26 ms/image question, 83 ms for ~2K-token text.
- Builds:

| Build | Repo | Use in this project |
|---|---|---|
| Original (FP32 weights, BF16 autocast, CUDA only, ~50 GB) | `akhilaaa3/Jev-Omni` | ZeroGPU live Space (Phase 7) |
| **MLX 4-bit** (Apple Silicon, ~7 GB of memory at run time, ~1 s/decision on an M4 with 16 GB) | `Ruiruiz30/Jev-Omni-MLX-4bit` | **Local dev + batch precompute (Phases 2–4)** |
| GGUF Q4_K_M (llama.cpp + decision head .npz + adapter script) | `Reza2kn/Jev-Omni-Q4_K_M-GGUF` | Fallback only |

- **MLX CLI usage** (from its model card):
  ```bash
  python -m omni_mlx.classifier --model . --calibration calibration.json \
    --image /path/frame.png --state "..." --question "..." \
    --options "Opt A" "Opt B" "Opt C" --image-tokens 20
  ```
  `--image-tokens 20` is the recommended default. Use `70` for small details (slower, ~1.8 s). `calibration.json` applies temperature scaling (T≈1.115, fitted on JevBench). It changes probabilities, not the argmax.
- The loader code was reviewed on 2026-09-24:
  - weights load via safetensors, `torch.load(weights_only=True)`, or `np.load` without pickle
  - the only subprocess call is `ffmpeg`
  - the GGUF script only calls a local llama-server

  **Re-review if the repo revision has changed** (see Phase 0).

### 1.2 Question primitives → Jev-Omni mapping

Jev-Omni takes `state`, `question`, `options`, plus optional `media`. Map the three Jev primitives like this:

| Primitive | How to call Jev-Omni | Value stored |
|---|---|---|
| `noul` (yes/no) | options `["Yes", "No"]` | `p = P("Yes")` |
| `choice` | options = the list (≤ 20) | full distribution + argmax |
| `score` (ordered levels) | options = level labels in order | distribution + expected value `Σ i·p_i / (n−1)` ∈ [0,1] |

### 1.3 Target machine (the user's)

Apple **M4, 16 GB unified memory**. At last check it had ~26 GB free disk, plus `python3.13`, `ffmpeg` and `llama-server` (Homebrew) installed. Keep peak memory < ~11 GB: do **not** load Jev-Omni and the SLM at the same time on this machine. Run them in separate phases or processes.

### 1.4 Hugging Face hosting facts

- **Static Space:** free for everyone.
- **ZeroGPU:**
  - Gradio SDK only.
  - Hardware: `large` = half an RTX Pro 6000 Blackwell (48 GB VRAM), the default. `xlarge` = 96 GB and costs 2× quota.
  - Default 60 s max per `@spaces.GPU` call (configurable).
  - Load models to `cuda` **at module level**, not inside the decorated function.
  - Visitor daily quota: anonymous 2 min, free 5 min, PRO 40 min.
  - Free accounts can host 2 ZeroGPU Spaces.
  - No `torch.compile` (ahead-of-time compilation is OK).
- **Paid GPU Spaces bill every running minute.** Never leave one running. Set a sleep time or switch back to CPU basic.

---

## 2. Ground rules for the executor

1. **ASK THE USER before:**
   - any download > 500 MB (state repo, size, destination)
   - creating or pushing Hugging Face Spaces/repos
   - spending money (paid hardware, credits)
   - anything that publishes content
2. **Never commit model weights or video files to git.** Use `.gitignore`. Keep large assets under `store-sentinel/.cache/` and `store-sentinel/data/raw/`.
3. **Licenses:** only use footage and images with licenses that allow public redistribution in a demo. Record every source in `data/SOURCES.md` (URL, license, author, date accessed). If unsure, don't use it.
4. **Privacy:** no footage with identifiable faces unless the license explicitly allows that use. Prefer stock footage with model releases, or blur faces (Phase 2 includes an optional blur step).
5. **Honesty in the UI:**
   - Label Jev-Omni as "an open Jev-style model (not TypeSafe's Jev)".
   - Label cost-meter numbers as **estimates** and show the pricing sources and dates.
   - Show measured accuracy from Phase 1/3, including failures.
6. **Resumability:** every batch job must skip already-computed items and write incrementally (JSONL, append-only).
7. **Pin revisions:** record the exact Hugging Face commit SHA of every model used in `models.lock.json`.
8. If an acceptance criterion fails and the plan's fallback doesn't resolve it, **stop and report to the user** with data. Don't silently lower the bar.

---

## 3. Target folder layout

```
store-sentinel/
├── PLAN.md                  # this file
├── README.md                # project overview (update at the end)
├── .gitignore
├── pyproject.toml / requirements.txt
├── models.lock.json         # model repo → commit SHA
├── config/
│   ├── questions.yaml       # the question set (single source of truth)
│   └── policy.defaults.json # default costs/thresholds/fusion params
├── sentinel/                # python package
│   ├── decider.py           # Decider interface + MLX / Transformers / GGUF backends
│   ├── questions.py         # load/validate questions.yaml, primitive mapping
│   ├── frames.py            # ffmpeg frame extraction, optional face blur
│   ├── precompute.py        # batch: clips × frames × questions → JSONL
│   ├── policy.py            # fusion + cost-sensitive alerting (mirrors JS version)
│   ├── notes.py             # SLM incident notes for alert events
│   ├── evaluate.py          # accuracy / calibration / latency reports
│   └── export.py            # JSONL → compact JSON for the web app
├── data/
│   ├── SOURCES.md
│   ├── raw/                 # downloaded clips/images (gitignored)
│   ├── frames/              # extracted frames (gitignored)
│   ├── labels/              # hand labels (committed, small)
│   └── out/                 # decisions.jsonl, notes.jsonl, reports (committed if small)
├── spike/                   # Phase 1 throwaway scripts + report
├── web/                     # static site (Phase 6), deploys to static Space
│   ├── index.html
│   ├── app.js
│   ├── policy.js            # MUST match sentinel/policy.py (shared test vectors)
│   ├── styles.css
│   └── data/                # exported JSON + small video files (compressed)
├── space-live/              # ZeroGPU Gradio app (Phase 7)
│   ├── app.py
│   ├── requirements.txt
│   └── packages.txt         # ffmpeg
└── tests/
```

---

## 4. The question set (initial draft → `config/questions.yaml`)

Each question needs: `id`, `type` (noul/choice/score), `question`, `options` (for choice/score), `state_template`, `alert` (bool: can it trigger alerts?), and `severity` (drives the default costs).

```yaml
state_template: "Frame from a retail store security camera. Zone: {zone}. Time: {timestamp}."
questions:
  - id: spill
    type: noul
    question: "Is there liquid or a spill on the floor?"
    alert: true
    severity: high
  - id: person_down
    type: noul
    question: "Is a person lying or fallen on the floor?"
    alert: true
    severity: critical
  - id: obstruction
    type: noul
    question: "Is an object or unattended cart blocking the aisle?"
    alert: true
    severity: medium
  - id: empty_shelf
    type: noul
    question: "Is there a visibly empty section on a shelf?"
    alert: true
    severity: low
  - id: queue
    type: score
    question: "How long is the checkout queue?"
    options: ["No queue", "1-2 people", "3-5 people", "More than 5 people"]
    alert: true            # alert when expected value is high
    severity: medium
  - id: crowding
    type: score
    question: "How crowded is this area?"
    options: ["Empty", "Light", "Moderate", "Crowded"]
    alert: false
  - id: staff_present
    type: noul
    question: "Is a store employee visible in the frame?"
    alert: false
  - id: scene
    type: choice
    question: "What part of the store is shown?"
    options: ["Checkout", "Aisle", "Produce", "Entrance", "Stockroom", "Other"]
    alert: false
```

Phase 1 decides which questions survive. Budget: **≤ 8 questions** × 1 fps.

---

## 5. Phases

### Phase 0: Setup (≈30 min)

**Steps**
1. Create the folder layout from §3, a `.gitignore` (`.cache/`, `data/raw/`, `data/frames/`, `.venv/`, `*.safetensors`, `*.gguf`, `*.mp4` except under `web/data/`), and a Python 3.13 venv.
2. **ASK THE USER** before downloading `Ruiruiz30/Jev-Omni-MLX-4bit` (~8 GB) to `store-sentinel/.cache/jev-omni-mlx/`:
   ```bash
   hf download Ruiruiz30/Jev-Omni-MLX-4bit --local-dir .cache/jev-omni-mlx
   ```
3. Record the commit SHA in `models.lock.json`. Compare it with the revision reviewed on 2026-09-24. If the Python files changed, re-review them for `pickle`, `eval`/`exec`, network calls and unexpected subprocesses before running anything.
4. `pip install -r .cache/jev-omni-mlx/requirements.txt`.
5. Smoke test with the CLI on a trivial image (e.g. generate a red square with PIL and ask "What color is the shape?" with options Red/Green/Blue).

**Acceptance:** the smoke test returns Red with p > 0.8. Record load time, warm latency and peak memory (`/usr/bin/time -l`) in `spike/SMOKE.md`.

---

### Phase 1: Feasibility spike, the GO/NO-GO GATE (≈half a day)

**Goal:** prove Jev-Omni can see these events on real store-camera-like frames *before* building anything.

**Steps**
1. **Collect 30–40 frames** covering each alert question with both positives and negatives (≥ 4 positives per alert question). Sources to evaluate (**verify each license first**; these are candidates, not guarantees):
   - Free stock-video sites with permissive licenses (e.g. Pexels, Pixabay): search "supermarket CCTV", "store aisle", "spill floor", "checkout line".
   - Research datasets such as **SKU-110K** (dense shelf images, good for empty-shelf) and fall-detection datasets (e.g. **UR Fall Detection**, **Le2i**) for person-down. Check that the license allows *public demo redistribution*; if it's research-only, use it for the **spike only**, not the public site.
   - Staged footage the user records themselves (the best licensing option, if they're willing).
2. **Hand-label** each frame for each question → `data/labels/spike.csv` (`frame, question_id, label`).
3. Write `sentinel/decider.py` with the interface:
   ```python
   class Decider(Protocol):
       def decide(self, image_path: str | None, state: str, question: str,
                  options: list[str]) -> dict:  # {"probs": {opt: p}, "latency_ms": float}
   ```
   and an `MLXDecider` backend. **Read `.cache/jev-omni-mlx/omni_mlx/classifier.py` first** and use its Python class directly (loading the model once). Only fall back to one subprocess per call if the class can't be imported cleanly.
4. Run every (frame × question). Try `--image-tokens 20` vs `70` on the alert questions, and with vs without calibration.
5. `sentinel/evaluate.py` writes `spike/REPORT.md` with, per question:
   - accuracy
   - **accuracy on confident answers (p ≥ 0.8 or ≤ 0.2) and the coverage fraction**
   - Brier score
   - a small reliability table
   - median/p95 latency
   - the 5 worst errors (with frame thumbnails linked)

**GO criteria (all must hold)**
- At least **3 of the 5 alert questions** have confident-answer accuracy **≥ 85%** with coverage **≥ 50%**.
- `person_down` **or** `spill` is among the passing questions (the demo needs one dramatic event).
- Median latency ≤ 2.5 s per question on the M4 (so precomputing is feasible: see the Phase 3 budget).

**If NO-GO**, try in order, re-running only the failing questions:
- (a) Rephrase questions (more concrete: "Is there a puddle or wet patch on the floor?").
- (b) Use image-tokens 70.
- (c) Crop to regions of interest.
- (d) Use the GGUF or original build on a rented GPU for comparison (ASK THE USER before spending).
- (e) Drop the failing questions.

If still NO-GO, **stop and report to the user**, proposing the pivot: a live-shopping stream monitor (product-on-screen `choice` over the catalog, demo-in-progress, unapproved-claim detection from audio).

**Output:** `spike/REPORT.md`, the final `config/questions.yaml` (surviving questions only), and a recommendation for image-tokens and calibration.

---

### Phase 2: Clip curation and frame extraction (≈half a day)

**Steps**
1. Pick **3–5 clips** of 60–180 s each, all with licenses allowing public redistribution. Together they must contain at least:
   - one dramatic event (spill or fall)
   - one queue buildup
   - one empty-shelf or obstruction case
   - a stretch of "nothing happening" (to show the demo stays quiet)
2. Record every source in `data/SOURCES.md`.
3. `sentinel/frames.py`: extract at **1 fps** as 768 px-wide JPEGs:
   ```bash
   ffmpeg -i clip.mp4 -vf "fps=1,scale=768:-2" -q:v 3 data/frames/<clip_id>/%05d.jpg
   ```
   Optional face blur: OpenCV Haar or a small face detector. Apply it to the frames **and** re-encode the web video from the blurred frames.
4. Produce a web video per clip: H.264, ≤ 720p, ≤ 1.5 Mbps, muted, `+faststart` → `web/data/clips/<clip_id>.mp4`. Keep the total web payload under ~50 MB.
5. Write `data/clips.json`: id, title, zone, duration, fps, frame count, source ref.
6. **Hand-label ground-truth event intervals** per clip (`data/labels/events.csv`: `clip, question_id, start_s, end_s`). These are used for evaluation and for the "ground truth" strip in the UI.

**Acceptance:** frames exist for every clip, the frame count equals ⌊duration⌋ ±1, labels exist, and sources are documented.

---

### Phase 3: Batch precompute (overnight on the M4)

**Budget check:** with Q questions × F frames × ~1 s, 5 clips × 120 s × 8 questions = 4,800 calls ≈ 1.3–2 h on the M4. If it's over ~8 h, reduce fps to 0.5 on the quiet stretches or ask the user about renting a GPU.

**Steps**
1. `sentinel/precompute.py --clips all --questions config/questions.yaml --out data/out/decisions.jsonl`
   - Load the model once and loop frames × questions.
   - Append one JSON line per decision:
     ```json
     {"clip":"c1","t":17,"q":"spill","type":"noul","probs":{"Yes":0.91,"No":0.09},
      "p":0.91,"ev":null,"latency_ms":948,"model":"jev-omni-mlx-4bit@<sha>",
      "image_tokens":20,"calibrated":true}
     ```
   - Resumable: skip keys `(clip, t, q, model, image_tokens)` already present.
   - Keep the Mac awake: `caffeinate -i python -m sentinel.precompute ...`.
2. `sentinel/evaluate.py --events data/labels/events.csv` writes `data/out/EVAL.md`: per-question accuracy vs. labels, coverage at thresholds, a reliability diagram (PNG) and a latency histogram.
3. `sentinel/export.py` writes compact `web/data/decisions.<clip_id>.json`:
   ```json
   {"clip":"c1","fps":1,"questions":[...meta...],
    "series":{"spill":[0.02,0.03,...], "queue":[0.1,...]},   // p for noul, EV for score
    "dists":{"scene":[[...],[...]]},                        // choice distributions per frame
    "latency_ms":{"median":950,"p95":1100}}
   ```

**Acceptance:** 100% of (clip, frame, question) keys present, EVAL.md generated, export files < 1 MB each.

---

### Phase 4: Policy engine (Python + JS, identical behavior)

Alerts are computed **only from stored probabilities**, so the web UI can recompute them instantly.

**Per alert question, per frame t:**
1. **Signal:** `s_t = p_t` (noul) or `ev_t` (score).
2. **Temporal fusion:** exponential moving average `f_t = α·s_t + (1−α)·f_{t−1}` (default α = 0.5), **or** k-of-n (≥ k of the last n frames above the threshold). Configurable.
3. **Cost-sensitive threshold:** the alert fires when expected cost of ignoring > expected cost of alerting:
   `f_t · C_miss > (1 − f_t) · C_false` ⇔ `f_t > τ = C_false / (C_false + C_miss)`.
4. **Hysteresis/debounce:** once an alert opens, keep it open until `f_t < τ − h` (default h = 0.1). Merge alerts closer than `gap_s` (default 3 s).
5. **Output:** a list of alert intervals `{q, start_s, end_s, peak_p}`.

**UI sliders** (all mapped to the parameters above):
- Per severity: "cost of a missed event" and "cost of a false alarm" (or one "sensitivity" slider per question as the simple mode).
- Fusion window (α or k/n).
- Attendant budget: max alerts/hour. If exceeded, keep the highest-expected-cost alerts.

**Steps**
1. Implement `sentinel/policy.py` and `web/policy.js`.
2. Write **shared test vectors** in `tests/policy_vectors.json` (input series + params → expected intervals). Both implementations must pass them (pytest + a small node script, or run the JS in the browser test page).
3. Compute metrics against `events.csv` at the default policy: event-level recall, false alarms/hour and detection delay. Put them in `data/out/EVAL.md`.

**Acceptance:** Python and JS agree on all vectors. At the default policy, the dramatic event in each clip is detected with delay ≤ 5 s, with ≤ 2 false alarms per clip. (If not, tune the defaults. Don't change the data.)

---

### Phase 5: SLM incident notes

The SLM runs **only on alert events**. That's the point of the demo.

**Steps**
1. Pick a small instruct model runnable with `mlx-lm` on 16 GB. Candidates: a Qwen3 ~1.7B–4B instruct, or a Gemma small instruct. **Verify the exact repo ids and licenses at execution time**, then record them in `models.lock.json`. **Do not** load it while Jev-Omni is loaded.
2. For each alert under the **default policy**, build a prompt from **structured data only**:
   - clip/zone, timestamp
   - the question and peak probability
   - co-occurring signals (e.g. crowding EV, staff_present p)
   - the scene choice

   Ask for a ≤ 40-word incident note plus a recommended action. No image goes to the SLM. It must not invent facts beyond the fields given.
3. Save to `data/out/notes.jsonl`, then export to `web/data/notes.<clip_id>.json`.
4. Record SLM calls vs. total decisions (e.g. "SLM invoked 6 times vs. 4,800 decisions = 0.13%"). The UI shows this.

**Web behavior when sliders change:** the notes are tied to default-policy alerts. For alerts that only exist under the modified policy, show a templated note ("Possible spill, p=0.87, 14:02:17") labeled "(template; SLM note generated for default policy only)". Optional: in live mode (Phase 7), generate on demand.

**Acceptance:** every default-policy alert has a note, and a human spot-check of 5 notes finds no hallucinated facts.

---

### Phase 6: Static showcase site (`web/`)

**Tech:** plain HTML/CSS/JS, no build step. Chart library from a CDN (e.g. uPlot or Chart.js) or hand-written canvas. It must work as a static Hugging Face Space (`sdk: static`).

**Layout (desktop; stacks on mobile):**
1. **Header:** one-line pitch ("An open Jev-style decision model watching a store: ~8 typed questions every second, calibrated probabilities, zero text generated"), plus the honesty labels from §2.5.
2. **Left: video player** with a clip picker. The playback time drives everything.
3. **Right: question grid.** One row per question with a live probability bar (noul), a distribution bar (choice/score) and a tint by value.
4. **Below: timeline chart.** One line per alert question plus the threshold line τ, alert intervals shaded, a ground-truth strip from `events.csv`, and a playhead. Clicking the chart seeks the video.
5. **Policy panel:** the sliders from Phase 4. On change, recompute alerts with `policy.js` in < 50 ms and redraw. Show "0 model calls" next to the sliders.
6. **Incident feed:** alerts with SLM notes, timestamps and "jump to" links.
7. **Meter strip:**
   - decisions made, SLM calls
   - measured median latency (from the data)
   - **estimated** cost to make the same decisions with a vision LLM vs. TypeSafe Jev pricing vs. self-hosted
   - "LLM would be N s behind live"

   Prices go in `web/data/pricing.json`, with source URLs and date. **Look up current prices at build time. Do not reuse numbers from this plan.**
8. **"How it works"** collapsible section: the pipeline diagram, the questions list, and the EVAL.md summary (accuracy, calibration plot, known failure cases).
9. **Footer:** licenses, sources, model credits (Jev-Omni author, MLX conversion author, Gemma license note), and a link to the repo.

**Quality bar:**
- Loads in < 3 s on broadband.
- No console errors.
- Works in Chrome/Safari/Firefox.
- Keyboard accessible (sliders, clip picker).
- Readable in light and dark mode.
- Mobile width 375 px with no horizontal scroll.

**Acceptance:** local check via `python -m http.server` in `web/`. Scrub the video, move the sliders and check that alerts change immediately and match the Python policy output for the same parameters.

---

### Phase 7: Live mode on ZeroGPU (optional; ASK THE USER before creating the Space)

**Steps**
1. `space-live/app.py` (Gradio):
   - At **module level**, load the original `akhilaaa3/Jev-Omni` via its `jev_omni.load_jev_omni()` onto `cuda` (BF16, ~24 GB fits in the 48 GB `large` slice). Pin the revision SHA.
   - `@spaces.GPU(duration=30)` decorates `decide_all(image) -> dict`, which runs the question set on one uploaded image and returns probabilities.
   - Optional: load the small SLM on the same GPU and generate a note if any alert question has p > τ_default.
   - Input limits: images only, ≤ 5 MB, resized to 768 px. Rate-limit via Gradio queue settings.
2. `requirements.txt` (torch version from the ZeroGPU-supported list, transformers, the Jev-Omni requirements) and `packages.txt` (`ffmpeg`).
3. Test locally where possible (the `spaces` decorator is a no-op off ZeroGPU, but this needs CUDA, so the real test happens on the Space).
4. **ASK THE USER** before creating it: `huggingface-cli repo create <name> --type space --space_sdk gradio`, then set hardware to ZeroGPU in the settings (UI step for the user).
5. The static site calls it via `@gradio/client` from a "Try your own photo" panel. It must degrade gracefully if the Space is asleep, queued or over quota (show "live mode unavailable, showing precomputed demo").

**Acceptance:** an uploaded photo returns all question probabilities in < 15 s including queueing, on a warm Space. The Space shows no errors in its logs.

---

### Phase 8: Deploy the static Space and write up

**Steps**
1. **ASK THE USER** for the Space name and visibility. Create it with `sdk: static` and put the README front-matter in `web/README.md`:
   ```yaml
   ---
   title: Store Sentinel
   emoji: 🛒
   sdk: static
   app_file: index.html
   license: apache-2.0
   ---
   ```
2. Push `web/` (use Git LFS if any file > 10 MB).
3. Verify the live URL: the full Phase 6 quality bar, and the live panel if Phase 7 was done.
4. Update `store-sentinel/README.md` with:
   - what it is and the links
   - architecture diagram
   - how to reproduce (Phase 0–5 commands)
   - evaluation results
   - limitations (single frames, not video; open clone, not TypeSafe's Jev; small eval set; estimated costs)
   - credits
5. Optional: write a short blog-style post (`POST.md`) framing "System One vs System Two": the decision model watches, the SLM only speaks when needed.

**Acceptance:** the public URL works, the README is complete, and no secrets or weights are in any repo.

---

## 6. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Jev-Omni can't reliably see spills/falls in CCTV-quality frames | Medium–High | Phase 1 gate; rephrase/crop/tokens-70; pivot to the live-shopping monitor |
| Licensable store footage is scarce | Medium | Stock sites; user-staged footage; research datasets for the spike only |
| M4 16 GB memory pressure | Medium | One model loaded at a time; 4-bit MLX; close other apps; `caffeinate` |
| Probabilities poorly calibrated on this domain | Medium | Report reliability honestly; optionally refit temperature on Phase 1 labels (keep a held-out split) |
| ZeroGPU queues/quota make live mode flaky | Medium | Live mode is optional; the static replay is the main showcase |
| Upstream model repos change or disappear | Low–Medium | Pin SHAs; keep a local cache; the `Decider` interface allows swapping backends (MLX / GGUF / Transformers / simple-jev) |
| Misleading comparisons | — | Label cost numbers as estimates with sources; show our own measured accuracy, including failures |

---

## 7. Definition of done

- [ ] Phase 1 GO report committed (or a documented pivot approved by the user)
- [ ] 3–5 licensed clips, precomputed decisions, EVAL.md with accuracy, calibration and latency
- [ ] Python and JS policy engines agree on the shared test vectors
- [ ] SLM notes only for alerts; the invocation ratio is displayed
- [ ] Static Space live at a public URL, meeting the Phase 6 quality bar
- [ ] (Optional) ZeroGPU live mode working, with graceful fallback
- [ ] README with reproduction steps, results, limitations and credits
- [ ] Hosting cost verified at $0/month (no paid hardware left running)
