# Phase 6: Privacy, Security, Accessibility, QA

**Goal:** it's trustworthy enough to share publicly.
**Read first:** [docs/07](../docs/07-privacy-safety.md), [docs/06 §6.4](../docs/06-ui-spec.md).

## Audit checklist
### Privacy
- [ ] Network payloads contain only the ≤ 768 px JPEG without EXIF (Playwright capture)
- [ ] Engine code has no image or custom-text logging (grep + review); temp dir clean after a load test
- [ ] Face blur on by default; notice shown when faces were blurred
- [ ] localStorage is only used after opt-in; clearing the shift wipes it

### Security
- [ ] Server-side validation of type, size, dims, domain/area enums, context values and custom-question rules (fuzz 200 bad inputs, expect friendly errors, no 500s)
- [ ] No secrets in the repo or client; the CSP-friendly site loads scripts only from the CDNs it uses
- [ ] The engine can't be used as a general image model: only pack questions + one custom yes/no

### Accessibility
- [ ] Keyboard-only run-through; screen reader smoke test (VoiceOver or NVDA) of check → results → rules
- [ ] Contrast in light and dark mode; `prefers-reduced-motion`; 320 px width

### QA matrix
- [ ] iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari: capture, check, rules drawer, export
- [ ] Engine states: cold start, queue, quota exhausted (simulated), engine down (mock)

## Acceptance
All boxes ticked, with evidence (screenshots or test runs) linked in `LOG.md`.
