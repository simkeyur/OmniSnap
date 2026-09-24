# 08: Evaluation

## Per-domain gating
Every domain is evaluated and gated **separately**, with its own photo set, report section and verdict. Only domains that pass are shown in the domain picker.
- **Order:** Store → Home → Kitchen (tier 1), then Garden → Rental → Vehicle (tier 2). See docs/03.
- **Minimum to launch:** Store plus at least one other tier-1 domain.
- The criteria below apply per domain, with "`spill` or `trip` passes" replaced by that domain's **headline question**:

| Domain | Headline question(s) (one must pass) | Easy-to-stage photos |
|---|---|---|
| store | `spill`, `trip` | water on a shop-like floor, boxes in an aisle |
| home | `loose_rug`, `cord_walkway`, `floor_clutter` | rugs, cables, toys on the floor |
| kitchen | `raw_above_rte`, `uncovered`, `chem_near_food` | a home fridge staged with packaged raw meat above salad; spray bottle next to food |
| garden | `wilting`, `leaf_spots`, `yellowing` | houseplants (a wilted one vs. a healthy one) |
| rental | `scuffs`, `floor_stain`, `trash_left` | walls and floors at home; a coffee stain on an old rug |
| vehicle | `tire_low`, `glass_crack`, `fluid_leak` | a partly deflated bike or car tire; a puddle under a car (water) |

## Feasibility photo set (`eval/photos/<domain>/`)
- **~60 photos per domain**, phone-quality, varied lighting, covering that domain's areas.
- **Per alertable question:** ≥ 6 positives and ≥ 6 hard negatives. Examples:
  - a shiny clean floor vs. a real spill
  - a box neatly placed vs. one in the walkway
  - a sitting person vs. a fallen person
- **Sources:**
  1. **Staged by the user**: water on a floor, boxes in a hallway, a pantry shelf with gaps, a friend lying on a mat. This is the best option for licensing and realism, so **ASK THE USER** if they're willing.
  2. CC0/CC BY stock photos.
  3. Research datasets **for private evaluation only** if their license forbids redistribution. Never ship those to the gallery.
- `eval/photos/labels.csv`: `file, domain, area, question_id, label (1/0 or level), notes`.

## Running (cloud only)
`eval/run_eval.py` runs in a GitHub Actions `workflow_dispatch` job and calls `ss-engine` `/analyze` via `gradio_client` with the owner's HF token (a GitHub secret the user adds). Results go to `eval/results.jsonl`, and `eval/REPORT.md` is generated.

## Metrics (per question and overall)
| Metric | Definition |
|---|---|
| Accuracy | argmax vs. label |
| **Confident accuracy / coverage** | accuracy where p ≥ 0.8 or ≤ 0.2, and the share of such answers |
| Brier, ECE (10 bins) | calibration quality |
| Band quality | at default τ: precision of **Act**, share of positives landing in **Check** vs. **Clear** |
| Latency | median / p95 total per snapshot; GPU ms per snapshot |
| Face-blur impact | accuracy with vs. without blur on photos containing people |

## GO criteria (Phase 1)
1. At least **5 of the 8** questions in the domain's default area reach confident accuracy **≥ 85%** with coverage **≥ 50%**.
2. **At least one headline question passes** (table above). Every domain needs one convincing everyday catch.
3. **Act precision ≥ 80%** at default thresholds (false alarms feel bad in a friendly demo).
4. Median GPU time per snapshot **≤ 4 s** (so anonymous visitors get ≥ 30 checks/day).
5. Face blur doesn't drop `person_down` confident accuracy by more than 10 points.

Questions that fail are **dropped or reworded**, not hidden. The "How it works" page lists what was dropped and why.

## REPORT.md format
Summary table · per-question table · reliability chart · latency histogram · 6 example photos (2 good catches, 2 misses, 2 hard negatives) · dropped/reworded questions · verdict.
