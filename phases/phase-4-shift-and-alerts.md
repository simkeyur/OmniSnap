# Phase 4: Shift Timeline, Alert Rules, Incident Notes

**Goal:** turn single checks into a shift, with instant re-decisions and rare SLM notes.
**Read first:** [docs/04](../docs/04-policy-engine.md), [docs/05 §5.2](../docs/05-data-contracts.md), [docs/06 Shift timeline / Alert rules](../docs/06-ui-spec.md).

## Steps
1. `policy.js`: implement docs/04 exactly (pure functions). Write `tests/policy.vectors.json` covering every required case, and run it in CI with Node.
2. Session state in `app.js`: add a snapshot → `decide()` → render. Resolve alerts. Opt-in localStorage with try/catch; clear shift.
3. Shift timeline screen:
   - alerts strip, grouped list, per-area mini charts (inline SVG with τ lines)
   - counters, including "Language model used for N of M decisions"
4. Alert rules drawer:
   - sliders mapped to C_miss/C_false and confirmation per severity
   - live "Re-checked N photos instantly: 0 new AI calls" banner
   - reset to defaults
5. Notes: when `decide()` opens a **new** alert, call `/note` once. Cache per alert id. On error, show the template note labeled "template".
6. Export: "Download shift report" (JSON + printable HTML summary, no full images).
7. **Tune the default τ floors and margins** using `eval/results.jsonl` (the Phase 1 data), to maximize Act precision ≥ 80% while keeping recall reasonable. Document it in `eval/REPORT.md` under "Default policy".

## Acceptance
- [ ] All policy vectors pass in CI
- [ ] Moving any slider updates the timeline and alerts in < 50 ms for 200 snapshots, with 0 network calls (Playwright asserts no requests)
- [ ] The SLM is called only when a new alert opens (network count test)
- [ ] The export file opens and prints cleanly
