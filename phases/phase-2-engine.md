# Phase 2: Production Engine

**Goal:** a complete, safe, stateless engine: all packs, custom question, SLM notes, limits, health.
**Read first:** [docs/03](../docs/03-question-packs.md), [docs/05](../docs/05-data-contracts.md), [docs/07](../docs/07-privacy-safety.md).

## Steps
1. `packs.py`: load `shared/question-packs.json` (the version surviving Phase 1); validate the schema.
2. `/analyze`:
   - all **launched** domains and their areas + context chips + the optional custom yes/no question
   - input validation (`limits.py`)
   - temp-file handling with `finally` cleanup
   - no image or question-text logging
3. Pick and pin the SLM (docs/01). `notes.py`:
   - prompt from structured fields only
   - ≤ 40 words
   - post-check that every number in the note appears in the input, otherwise regenerate once, then use the template
4. `/note` endpoint (`@spaces.GPU(duration=15)`), `/health` endpoint (CPU).
5. Queue config: `max_size≈30`, concurrency 1 per GPU function.
6. Engine unit tests (CPU, models mocked): validation errors, response schema, note post-check, temp-dir cleanup.
7. Deploy. In a CI `workflow_dispatch` job, call 20 gallery-candidate photos + 5 notes. Measure latency and GPU ms, and log them.

## Acceptance
- [ ] Schema-valid responses for every launched domain/area, custom questions and errors
- [ ] Median `/analyze` ≤ 4 s GPU, p95 ≤ 8 s; `/note` ≤ 3 s
- [ ] Temp dir empty after 100 requests; grep shows no image or question-text logging
- [ ] Notes contain no invented numbers (automated check over 20 notes)

## Fallbacks
- Too slow → a "Quick check" pack (top 4 questions) by default, full pack on demand.
- Out of memory with the SLM → a smaller SLM, or template-only notes (the UI labels them "template").
