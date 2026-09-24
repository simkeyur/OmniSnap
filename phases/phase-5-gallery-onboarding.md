# Phase 5: Sample Gallery, Onboarding, How It Works

**Goal:** a delightful no-camera path and a clear explanation, with zero quota use.
**Read first:** [docs/05 §5.3](../docs/05-data-contracts.md), [docs/06](../docs/06-ui-spec.md), [docs/07 Gallery](../docs/07-privacy-safety.md).

## Steps
1. Select ~20 redistributable photos (staged or CC0/CC BY): positives, hard negatives and all-clear scenes, **3–5 per launched domain**, spread across areas. Blur faces. Record sources and licenses.
2. Precompute `/analyze` results for them with the pinned model (CI job, owner quota) → `web/data/gallery/index.json`. Precompute notes for the alert-worthy ones.
3. "Try sample photos" grid: tapping a photo adds it to the shift (source = gallery) and shows the results card with a "precomputed" label.
4. Suggested tour: "Try these 3 in order" (a clean aisle → a spill → the same spill again, confirmed) to show off fusion and alerts in under a minute.
5. "How it works" page: diagram, calibrated probabilities explained in 3 sentences, per-question accuracy from REPORT.md (including dropped questions), privacy summary, credits.
6. Welcome screen on first visit only (remembered in localStorage, try/catch). An "About" link afterwards.

## Acceptance
- [ ] The full demo (tour + alerts + rules drawer) works with **no camera and zero engine calls** (Playwright with network blocked)
- [ ] Every gallery image has a source and license entry
- [ ] The accuracy table on "How it works" matches REPORT.md
