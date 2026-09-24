# Phase 0: Setup

**Goal:** approvals, repo, CI and names in place.
**Read first:** [PLAN.md](../PLAN.md), [docs/01](../docs/01-key-facts.md), [docs/02](../docs/02-architecture.md), [docs/07](../docs/07-privacy-safety.md).

## Steps
1. **ASK THE USER** to confirm:
   - The HF account is > 30 days old with a verified email (ZeroGPU eligibility).
   - Space names: `<hf-user>/ss-engine` (ZeroGPU Gradio) and `<hf-user>/ss-site` (static).
   - If Who's Lying is also planned: separate engines or a shared engine (docs/02 "Space budget").
   - GitHub repo name and visibility.
   - Credentials are configured **by the user** locally or as GitHub Actions secrets. The agent never asks for tokens in chat.
   - Whether the user will stage feasibility photos (docs/08 source 1).
2. Scaffold the docs/02 layout. Create `LOG.md`, `models.lock.json` (`{}`) and `shared/question-packs.json` from docs/03.
3. `.gitignore`: `.venv/`, `__pycache__/`, `*.safetensors`, `*.pt`, `.env`, `*.key`, `eval/photos/private/`.
4. CI (`.github/workflows/ci.yml`):
   - `node --test tests/` for policy
   - `pytest tests/engine` with mocked models, CPU only
   - a JSON-schema check of the question packs
5. **ASK THE USER**, then create the GitHub repo and push.

## Acceptance
- [ ] CI green
- [ ] All approvals and answers logged in `LOG.md`
- [ ] No secrets in the repo

## Fallbacks
Account not ZeroGPU-eligible yet → continue building the web UI against a **mock engine** (`web/live.js` mock mode using gallery results), then ASK THE USER how to proceed.
