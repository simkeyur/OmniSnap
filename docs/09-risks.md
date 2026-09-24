# 09: Risks, Mitigations and Pivots

| Risk | Likelihood | Mitigation | Pivot if unresolved |
|---|---|---|---|
| Jev-Omni can't reliably see spills/hazards in phone photos | Medium–High | Phase 1 gate, reworded questions, `--image-tokens`-style detail settings if exposed, drop weak questions | Narrow to what works (e.g. "shelf & tidiness check"), or pivot to a home-safety or "desk tidiness" theme with the same UI |
| Per-snapshot GPU time too high (8 sequential image calls) | Medium | Reuse image features across questions if the API allows; fewer questions per pack; `score` questions only on demand | "Quick check" (4 questions) by default, "Full check" on tap |
| Camera blocked inside the HF iframe | Medium | File-input capture path (works in iframes); link to the direct `*.hf.space` URL | File-input only |
| iOS Safari quirks (HEIC, orientation, memory) | Medium | Canvas re-encode to JPEG handles HEIC and orientation via `createImageBitmap(..., {imageOrientation: "from-image"})`; test on a real device | Server-side decode fallback with Pillow (still in memory) |
| Visitors photograph people or sensitive scenes | Medium | Blur default on, consent notice, no identification questions, nothing stored | Remove the `person_down` question if blur hurts it or it causes discomfort |
| Owner/visitor quota limits | Medium | Gallery path uses zero quota; show cost per check | Ask the user about PRO only if needed |
| 2-ZeroGPU-Space limit clashes with Who's Lying | Medium | Shared engine option (docs/02) | Build one project at a time |
| Upstream repo changes | Low–Medium | Pinned SHA, loader re-review | Mirror the pinned revision (Apache-2.0) after asking |
| Misread as a real safety product | Low | Persistent disclaimers, "demo" in the title | — |
| Some domains fail feasibility (fine details: pest signs, tread wear, small labels) | Medium–High | Per-domain gates; launch only passing domains; drop weak questions | Launch with Store + the best tier-1 domain; show others as "Coming soon" |
| Six domains dilute polish and eval effort | Medium | Tier 1 first; tier 2 only after the Phase 6 audit passes for tier 1 | Keep tier 2 in the mockup only |
