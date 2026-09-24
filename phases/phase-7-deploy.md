# Phase 7: Deploy and Write-up

**Goal:** public, documented, $0/month.

## Steps
1. **ASK THE USER** before making `ss-site` (and `ss-engine`) public. `web/README.md` front-matter: `sdk: static`, `app_file: index.html`, a title like "Store Sentinel (demo)".
2. README (repo + Spaces):
   - one-paragraph pitch + a screenshot/GIF of check → results → rules
   - how it works (diagram)
   - **results from REPORT.md**, including dropped questions and failure examples
   - privacy summary
   - limitations: demo only, open clone not TypeSafe's Jev, small eval set, phone-photo variance, quota-dependent
   - credits and licenses: Jev-Omni (author, Apache-2.0, Gemma terms), the SLM, the face detector, gallery photo sources
3. Verify $0: static Space on free hardware, engine on ZeroGPU, no paid add-ons. Log settings screenshots.
4. Optional `POST.md`: "A second pair of eyes for your shift: calibrated checks in a few seconds, alerts only when it matters."
5. Final `LOG.md` entry: URLs, SHAs, metrics, open issues.

## Acceptance
- [ ] Public URL works logged-out on phone and desktop
- [ ] README numbers match REPORT.md
- [ ] $0/month verified
- [ ] PLAN.md definition of done all ticked
