# 07: Privacy and Safety

## Image handling
| Stage | Rule |
|---|---|
| Capture | Only on explicit user action (tap). No auto-capture in the MVP |
| Browser | Downscale ≤ 768 px, re-encode JPEG (drops EXIF/GPS). Optional face blur (default on) **before** upload |
| Transport | HTTPS to the HF Space only. No third-party endpoints |
| Engine | Decode in memory. Write to a temp file only if Jev-Omni's API requires a path, then delete it in `finally`. **No logging of images or custom question text.** Log only counts, latency and error codes |
| Storage | None server-side. Browser storage is opt-in and thumbnails-only |

**Verification:** Phase 6 includes a code review for any `save`, `logging` or `print` of image data, plus a test that the temp directory is empty after 100 requests.

## Domain-specific rules
| Domain | Extra rule |
|---|---|
| home | Encourage photographing **spaces, not people**. Children are a key audience for the "toddlers" focus, so the consent notice reads "Don't photograph children". Face blur stays on by default |
| kitchen | Questions are about the space, never about individual staff (no per-person hygiene or glove checks) |
| rental | Warn that photos may contain personal documents or belongings: "Check the frame for letters, IDs or screens before sending." |
| vehicle | **License plates are blurred in the browser** along with faces (validate the detector in Phase 3; fall back to a manual blur brush). Never add questions that read plates or VINs |
| garden | Low privacy risk. Still blur faces (people in the background) |

## Consent and notices
- Welcome screen + a persistent footer: "Photos aren't stored. Don't photograph people without their consent."
- The face blur toggle defaults to on. The results card notes "Faces were blurred before sending" when applicable.

## Disclaimers (visible wherever results appear)
- "Demo only, not a safety or security system. Always follow your store's procedures."
- "Powered by Jev-Omni, an open Jev-style model (not affiliated with TypeSafe AI)."

## Abuse and limits
- Input validation: JPEG/PNG only, ≤ 2 MB after client downscale (server limit 10 MB raw), ≤ 1024 px.
- Custom question: ≤ 120 chars, plain text, no URLs.
- Rate limits: Gradio queue (`max_size ≈ 30`) plus a per-session client cooldown of 3 s between checks. ZeroGPU quotas cap per-user GPU time.
- **No identification features.** Never add questions that identify, profile or track people (no "who is this", age, gender or ethnicity). The `person_down` question is about safety only.
- The SLM receives no images and no free text from users except the custom question id (not its text).

## Gallery and eval photos
- Staged by the project author, or permissively licensed (CC0/CC BY with attribution). Record them in `eval/photos/SOURCES.md` and `web/data/gallery/index.json`.
- No identifiable faces unless the subject gave written consent. Blur otherwise.
