# OmniSnap Master Plan

> **Audience:** any LLM coding agent (or human). This file is the **index**. Read it fully, then read every file in `docs/`, then execute `phases/` **in order**.
> Each phase file has **inputs → steps → outputs → acceptance → fallbacks → checklist**. Don't start a phase until the previous one passes.
> Where a file says **ASK THE USER**, stop and get explicit approval in chat.

*OmniSnap (formerly Store Sentinel / Snap Check) drafted 2026-09-24. Replaces the clip-based v1 ([archive/PLAN-v1-video-clips.md](archive/PLAN-v1-video-clips.md)). Background: [../jev-research.md](../jev-research.md).*

---

## What changed from v1
| v1 (archived) | v2 (this plan) |
|---|---|
| Curated video clips, precomputed on the user's Mac | **Visitors snap photos with their own phone or laptop camera**, analyzed live |
| Replay-only demo | Live, personal, friendly. Replay gallery kept only as a no-camera fallback |
| MLX on a Mac | **Cloud-only:** ZeroGPU engine + static site. Nothing runs on the user's Mac |
| One fixed question set | **6 domains** (Store, Home, Kitchen, Garden, Rental, Vehicle) with area-specific question packs + an optional custom yes/no question |

## Hard constraints (apply to every phase)
1. **$0/month.** No paid hardware, subscriptions or credits without explicit approval.
2. **Nothing runs on the user's Mac.** Models run on HF **ZeroGPU**. The UI is a **static HF Space**. Tests run in **free GitHub Actions CI**.
3. **Privacy by design.**
   - Photos are downscaled and stripped of metadata **in the browser**.
   - Photos are processed in memory and **never stored or logged** by the engine.
   - Nothing is kept server-side (see docs/07).
4. **Honesty.**
   - "Powered by Jev-Omni, an open Jev-style model (not TypeSafe's Jev)."
   - Show measured accuracy, including failures.
   - **"This is a demo, not a safety system"** is visible wherever results appear.

## Concept in one paragraph
Pick what you're checking: **Store, Home, Kitchen, Garden, Rental or Vehicle** (working product name "Snap Check"; Store Sentinel is the first domain). Point your phone at the area and tap **Check**. Within a few seconds, **Jev-Omni** answers ~8 typed questions from that domain's checklist (e.g. spill? loose rug? raw meat above salad? leaf spots? wall scuffs? low tire?). Each answer is a **calibrated probability**, not a paragraph. Every snapshot joins a **session timeline**. **Alert rules** (sliders for how costly a miss is vs. a false alarm, and how many snapshots must agree) re-decide every past snapshot **instantly with zero new model calls**. A small language model (SLM) wakes up **only when an alert fires** and writes a one-line incident note. Visitors without a camera can use a **sample gallery** with precomputed results.

**Why it shows off Jev:**
- Many typed questions per photo.
- Calibrated probabilities feeding alert math.
- Rules change without re-running the model.
- Typed outputs that can't be malformed.
- An SLM invoked only rarely.

Clickable UI reference: [web/mockup.html](web/mockup.html) (sample data only).

## Document map
### Reference docs (read before any phase)
| File | Contents |
|---|---|
| [docs/01-key-facts.md](docs/01-key-facts.md) | Jev-Omni, ZeroGPU, browser camera APIs, quotas, budgets |
| [docs/02-architecture.md](docs/02-architecture.md) | System diagram, folder layout, request flow, Space budget |
| [docs/03-question-packs.md](docs/03-question-packs.md) | Domains, areas, questions, severities, per-domain wording and disclaimers |
| [docs/04-policy-engine.md](docs/04-policy-engine.md) | Fusion across snapshots, cost-sensitive thresholds, alert levels |
| [docs/05-data-contracts.md](docs/05-data-contracts.md) | Engine API, session JSON, gallery JSON, export |
| [docs/06-ui-spec.md](docs/06-ui-spec.md) | Mobile-first screens, friendly copy, states, accessibility |
| [docs/07-privacy-safety.md](docs/07-privacy-safety.md) | Image handling, face blur, consent, disclaimers, abuse limits |
| [docs/08-evaluation.md](docs/08-evaluation.md) | Test photo set, metrics, GO criteria, report |
| [docs/09-risks.md](docs/09-risks.md) | Risks, mitigations, pivots |

### Phases (execute in order)
| # | File | Goal | Gate |
|---|---|---|---|
| 0 | [phases/phase-0-setup.md](phases/phase-0-setup.md) | Approvals, repo, CI, Space names | CI green; approvals logged |
| 1 | [phases/phase-1-feasibility.md](phases/phase-1-feasibility.md) | Minimal engine + **GO/NO-GO per domain** on ~60 real photos each (tier 1 first) | Store + ≥ 1 other domain pass (docs/08) |
| 2 | [phases/phase-2-engine.md](phases/phase-2-engine.md) | Production engine API (analyze, note, limits) | Latency and quota budget met |
| 3 | [phases/phase-3-capture-ui.md](phases/phase-3-capture-ui.md) | Camera capture → results card | Works on iOS Safari, Android Chrome, desktop |
| 4 | [phases/phase-4-shift-and-alerts.md](phases/phase-4-shift-and-alerts.md) | Shift timeline, alert rules, SLM notes | Policy tests; alerts re-decide instantly |
| 5 | [phases/phase-5-gallery-onboarding.md](phases/phase-5-gallery-onboarding.md) | Sample gallery, onboarding, "how it works" | No-camera path complete |
| 6 | [phases/phase-6-hardening.md](phases/phase-6-hardening.md) | Privacy, security, a11y, cross-device QA | Audit checklist passes |
| 7 | [phases/phase-7-deploy.md](phases/phase-7-deploy.md) | Publish, README, write-up | Public URL; $0/month verified |

## Execution protocol for the agent
1. Re-read the phase file and its linked docs at the start of each phase.
2. Keep `LOG.md` up to date (date, phase, actions, decisions, measurements, blockers).
3. When a phase passes, tick its checklist and add the evidence to `LOG.md`.
4. When blocked, **stop and report** with data. Never silently lower acceptance bars.
5. Never commit secrets, model weights or user photos. Pin model SHAs in `models.lock.json`.

## Definition of done
- [ ] Feasibility REPORT with a per-domain verdict; Store + ≥ 1 other domain launched (or a user-approved pivot)
- [ ] Engine live on ZeroGPU, pinned models, meets the latency/quota budget, stores nothing
- [ ] Capture → results works on iOS Safari, Android Chrome and desktop Chrome/Firefox/Safari
- [ ] Shift timeline + alert rules re-decide instantly; SLM notes only on alerts
- [ ] Sample gallery works with no camera and no quota
- [ ] Privacy/security/a11y audit passed; disclaimers visible
- [ ] Public static Space + README with results, limitations and credits; $0/month verified
