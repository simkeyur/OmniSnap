# 04: Policy Engine (`web/policy.js`)

Pure functions, **no model calls**. Input: the session snapshots + policy params. Output: per-snapshot decisions + alert list. Re-runs on every slider change (< 20 ms for 200 snapshots).

## Concepts
- **Snapshot:** one photo's answers (probabilities per question) + domain + area + place label + timestamp.
- **Signal per alertable question:** `s = p` (noul) or `s = ev` (score).
- **Place streams:** fusion happens **per (domain, place)**, e.g. (store, "Aisle 4") or (vehicle, "Front left tire"). Snapshots of different places shouldn't reinforce each other. If no place label is given, use the area.

## Rules
1. **Cost-sensitive threshold per question:**
   `τ_q = max(floor_severity, C_false / (C_false + C_miss))`. Sliders adjust C_miss and C_false per severity (simple mode: one "Sensitivity" slider per severity).
2. **Confidence bands** (the three-way decision from the Nexus lesson):
   - `s ≥ τ_q + margin` → **Act** (alert)
   - `τ_q − margin ≤ s < τ_q + margin` → **Check** ("take another photo")
   - otherwise → **Clear**

   Default `margin = 0.1`.
3. **Confirmation (fusion across snapshots)** for the same place:
   - **Single-shot** (default for critical): one Act-level snapshot opens an alert.
   - **k-of-n** (default for others, k=2, n=3): the alert opens when ≥ k of the last n snapshots for that place are ≥ τ_q. A single Act snapshot shows as "Needs confirmation (1 of 2)".
   - A "Confirmation" slider picks per-severity mode and k.
4. **Alert lifecycle:** open → (user taps **Resolved**) → closed. It re-opens only if a later snapshot passes again. Resolving is a user action stored in the session.
5. **Attendant budget (optional):** max open alerts. If exceeded, keep the highest `(s · C_miss)` and mark the rest "Queued".

## Outputs
```js
decide(session, params) → {
  perSnapshot: [{id, domain, place, t, results: {q: {s, band: "act"|"check"|"clear"}}}],
  alerts: [{id, q, domain, place, opened_at, snapshot_ids, peak_s, status: "open"|"needs_confirmation"|"resolved"|"queued"}],
  counts: {act, check, clear}
}
```

## Test vectors (`tests/policy.vectors.json`)
Required cases:
- a single critical snapshot opens an alert
- a single high snapshot → needs_confirmation, and a second one opens the alert
- snapshots of different places don't fuse
- a slider change flips decisions deterministically
- the budget queues the lowest-cost alerts
- a resolved alert re-opens only after a new passing snapshot

CI runs them with Node (`node --test tests/`).
