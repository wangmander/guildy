# Guildy v2 Devlog

## 2026-05-03

### Interview pulse
- What happened today: Guildy Quick Prep moved from mock/demo output toward real AI-generated interview prep.
- User problem this surfaced: Generic prep is not enough. The prep has to reference the actual job description, resume, stage, and user context or it feels like ordinary ChatGPT output.
- Drove Guildy work today: Make Quick Prep real first, then smoke-test quality before building Deep Prep and the paywall.

### Engineering pulse
- Decided: Phase 4b-2 should replace mock Quick Prep generation with a real AI call while preserving existing UI contracts.
- Shipped: lib/ai/generate-prep.ts, lib/ai/prep-types.ts, app/app/actions.ts, and .guildhall/quests.json. Replaced mock prep body with real gpt-4o-mini generation using strict JSON schema fallback, Zod parsing, and existing error handling. Commit dccdcc0.
- Prior context: fe09842 fixed the empty-state flash by changing prep overlay state handling from idle to empty/loading-cache.
- Blocked: Quality is unverified until real jobs with real JDs/resumes are smoke-tested.
- Next: Manually test Generate Quick Prep on 2–3 jobs. If output is specific and useful, move to Phase 4c Deep Prep + paywall. If generic, tighten the system prompt first.
- Signal strength: medium-high

---

## 2026-05-03 (legacy entry, single-section format)
- Decided: Prep stage stored inside prep_versions.output jsonb; no schema migration. Mock generator ships before real AI (4b-2 next). No spec/doc edits in window.
- Shipped: Phase 2 home shell + 5-col board (cc5818f, c4f4302); phase 3a-d job CRUD, activation, drag-and-drop, search closed (fa2e0c0, 9ebe2d4, 4ab8a20, 69bde12); phase 4a Prep Overlay shell + 5 widgets (817961b, 27093a9); phase 4b-1 prep data contract + mock generator (306f228): lib/ai/generate-prep.ts +566, lib/ai/prep-types.ts +96, prep-canvas +337; skeleton-first patch to kill empty-state flash (fe09842). 19 commits.
- Blocked: Nothing blocking.
- Next: 4b-2 swap lib/ai/generate-prep.ts mock body for real GPT-5.4 nano call; signature stays.
- Signal strength: strong
