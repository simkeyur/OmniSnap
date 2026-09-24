# Phase 1: Minimal Engine + Feasibility Gate (GO/NO-GO)

**Goal:** prove that Jev-Omni gives useful, calibrated answers on real phone photos, and measure the GPU cost per snapshot, **before** building any UI.
**Read first:** [docs/01](../docs/01-key-facts.md), [docs/03](../docs/03-question-packs.md), [docs/08](../docs/08-evaluation.md).

## Steps
1. **Pin the model.** Record the current `akhilaaa3/Jev-Omni` SHA. Diff its `*.py` against the 2026-09-24 review. Re-review if changed (pickle, `eval`/`exec`, network, subprocess). Log the result.
2. **Minimal engine** (`engine/app.py` v0):
   - Module-level load of Jev-Omni in BF16 on `cuda`.
   - One endpoint `/analyze` (docs/05 §5.1) running any domain/area pack from `shared/question-packs.json`. No SLM yet.
   - **Investigate performance:** read `jev_omni.py` for image-feature reuse or multi-question batching. Implement it if available, and record the speedup.
3. **ASK THE USER**, then create `ss-engine`, push, and have the user set **ZeroGPU** hardware.
4. **Photo set:** collect ~60 photos **per domain** per docs/08, tier-1 domains (Store, Home, Kitchen) first, then tier 2 (Garden, Rental, Vehicle). Blur faces, write `labels.csv` and `SOURCES.md`. Photos that can't be redistributed go in `eval/photos/private/` (gitignored), uploaded as a private HF dataset **after asking**.
5. `eval/run_eval.py` in a `workflow_dispatch` GitHub Action: call `/analyze` for every photo (owner token secret), write `eval/results.jsonl`, generate `eval/REPORT.md` (docs/08 format). Spread runs over days if the owner quota runs out (5 min/day).
6. Run twice for the blur check: original and face-blurred versions of photos containing people.

## Outputs
`ss-engine` v0 live · `eval/REPORT.md` with a verdict · measured GPU ms per snapshot → update the docs/01 budget table.

## Acceptance (GO): all docs/08 GO criteria
- [ ] ≥ 5/8 floor questions: confident accuracy ≥ 85% at coverage ≥ 50%
- [ ] `spill` or `trip` passes
- [ ] Act precision ≥ 80% at default τ
- [ ] Median GPU per snapshot ≤ 4 s
- [ ] Blur costs `person_down` ≤ 10 points

## If NO-GO (in order)
1. Reword failing questions (more concrete, visual wording). Re-run only those.
2. Try higher image detail if the API exposes it, or center-crop plus full-frame (2 calls for key questions only).
3. Drop failing questions. If ≥ 4 useful questions remain, it's a GO with a reduced pack.
4. Still NO-GO → **stop and report to the user**, with the pivots from docs/09.

## Checklist
- [ ] Model pinned and loader reviewed
- [ ] Engine v0 on ZeroGPU
- [ ] 60 labeled photos with sources
- [ ] REPORT.md with verdict; user informed
