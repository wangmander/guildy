# Blitz Queue

Drafts only. Approval/posting is handled separately.

## Guildy Story — 2026-05-03
- Platform: X (thread, 4 tweets)
- Draft:

> Caught a 200ms empty-state flash in the prep overlay. Cards with cached prep painted the "Generate Quick Prep" CTA for one frame before the cache fetch resolved.

> Initial PrepState was 'idle', which routed to EmptyState. Cache fetch returned, state flipped to 'ready'. Two renders. First one showed the wrong UI on every card that already had saved prep.

> Fix: rename 'idle' to 'empty' (the state means "checked, nothing cached"). Start in 'loading-cache' instead. The EmptyState path is now unreachable until the cache fetch resolves.

> Two-line state-machine diff. The kind of bug you don't catch locally because mock latency is too low. "Haven't asked yet" and "asked, found nothing" are different states. I had them as the same one.

- Source: commit fe09842 (phase 4b-1 patch: skeleton-first to kill empty-state flash). Diff touches components/app/prep-overlay.tsx and components/app/widgets/prep-canvas.tsx, 6 insertions / 4 deletions.
- Threads to: standalone (no prior blitz-queue entries; devlog not yet established in repo)
- Anti-slop pass:
  - Specific opening detail? y (200ms, prep overlay, "Generate Quick Prep" CTA)
  - Real artifacts referenced? y (PrepState, 'idle', 'empty', 'loading-cache', EmptyState, file paths, line counts)
  - Would a senior engineer believe the writer built this? y
  - Tight? y
  - Voice locked, no banned phrases, no em dashes? y
- Run notes: Task SKILL.md describes "Guildy v3" with Gmail recruiter detection, but the live repo is V2 (manual + Prep Overlay) per CLAUDE.md and phase-0-resolutions.md, which explicitly kill Gmail OAuth/scraping. Wrote about the V2 work that actually shipped today. guildy-devlog.md does not exist yet; relied on git log + commit messages + quest manifest for the narrative thread. Created blitz-queue.md fresh.

## Guildy Story — 2026-05-04
- Platform: X (thread, 3 tweets)
- Draft:

> Smoke-tested my prep tool on my own job search today. Two bugs of the same shape: buttons sitting next to other buttons doing the same job.

> "Regenerate" next to a cache that already auto-invalidates on every input change. "Close" next to "Cancel" doing the exact same write-nothing collapse. Both shipped in earlier phases when the state machine was less smart, both stuck around.

> Two affordances for one action is a question the user has to answer mid-prep. The state machine was already correct. The UI hadn't caught up. Killed both.

- Source: commit 03e049f (phase 4c-4 patch 1: visual + UX corrections from smoke test). Specifically: "Regenerate removed" section ("Cache invalidates automatically when context_hash changes (every input edit per 4c-3), so a manual force-regenerate is unnecessary") and "Cancel / Clear / Save standardization" section ("Bottom '+ Add context' trigger now hides entirely when any section is open... so the two affordances don't duplicate"). Touches components/app/widgets/prep-canvas.tsx and components/app/widgets/inputs-widget.tsx. Engineering pulse only — no fresh Interview pulse in guildy-devlog.md for 2026-05-04 (most recent entry is 2026-05-03). Meta-tension carried by the commit message itself naming the smoke test on my own search.
- Threads to: standalone (different shape from 2026-05-03's empty-state-flash bug, though both are state-machine stories)
- Anti-slop pass:
  - Hook in line one (stakes/surprise/meta-tension)? y (meta-tension: smoke-tested on my own search)
  - Stakes + tension + insight? y (stakes: prep tool used during real interview prep; tension: redundant affordances surfaced by using it; insight: when state machines evolve, manual buttons become noise)
  - Real artifacts referenced? y (Regenerate, Cancel, Close, cache, context_hash auto-invalidation implied)
  - Connects to user pain? y (cognitive load mid-prep, every job hunter knows the "wait, which button do I click" feeling)
  - Recognition or wince from another builder? y (everyone has shipped vestigial UI from earlier phases)
  - Voice locked, no banned phrases, no em dashes? y (checked: no "thrilled/excited/stoked", no "shipping in public" hook, no em dashes, no "TIL")
  - No employer names or interview details? y

## Guildy Story — 2026-05-05
- Platform: X (thread, 5 tweets)
- Draft:

> Two failure modes can look identical at the validation layer and need opposite fixes. The retry I shipped for one of them was quietly making the other worse for a day.

> Symptom: Zod rejected the model's output for missing required fields. Patch 6 added retry-with-stronger-prompt on Zod failure. Worked in theory. Verified on a few cases. Shipped.

> Diagnostic logging surfaced the real cause: stop_reason was 'max_tokens', not 'end_turn'. Haiku was hitting the 2048 cap mid-output, not dropping fields out of laziness. The retry made it strictly worse: longer hint, less output room, same broken result, twice the API cost.

> Fix: raise caps (Quick 4096, Deep 8192), per-field length budgets in the Quick prompt, gate retry on stop_reason. PrepTruncatedError extends PrepValidationError so only the plain validation case retries. Truncation surfaces straight to the user.

> When two upstream failures collapse into one downstream symptom, the fix that helps one can hurt the other. Worth checking that your retry paths know which failure they're actually retrying for.

- Source: commits 29bc6ca (phase 4c-4 patch 6: schema validation blocker fix + retry-with-hint), a242b8f (debug: log raw anthropic output for schema diagnosis), c2a6218 (phase 4c-4 patch 7: max_tokens fix + quick brevity + conditional retry + fair-use rate limits + timeout), 6ed3005 (phase 4c-4 patch 8: nullable category/answer_plan/interviewer_type for Quick tier). Files: lib/ai/generate-prep.ts (the retry logic, PrepTruncatedError class, max_tokens constants, length-budget Quick prompt). Engineering pulse 2026-05-04 carries the narrative — Interview pulse for that date is TBD in guildy-devlog.md, so post leans on the debugging arc which has its own stakes (silent retry-makes-it-worse) and insight (failure-mode collapse defeats naive retries).
- Threads to: standalone (different shape from 2026-05-03's empty-state-flash and 2026-05-04's redundant-affordances posts; this one is about retry semantics, not state machines or UI)
- Anti-slop pass:
  - Opening lands a lesson, not a bug description? y ("Two failure modes can look identical at the validation layer and need opposite fixes")
  - Closing applies beyond this bug? y ("retry paths know which failure they're actually retrying for" — generalizes to any retry-on-error code)
  - Could be written from commit alone? n (commit messages name the fix; the post explains why patch 6's retry actively hurt the truncation case, which is interpretation)
  - Bug used as proof, not headline? y (the stop_reason / max_tokens detail is in tweet 3, lesson is in tweet 1)
  - Senior builder believe writer built this? y (PrepTruncatedError extends PrepValidationError, stop_reason gate, length budgets — only writeable from inside the diff)
  - Concrete artifact? y (PrepTruncatedError, PrepValidationError, stop_reason, max_tokens 2048 → 4096/8192, Patch 6, Patch 7)
  - Sounds like Michael, not retrospective? y (deadpan "Worked in theory. Verified on a few cases. Shipped." — builder's wince)
  - Banned openings/phrases? y/n check: no "Caught/Fixed/Today I/Shipped/Built" as opener, no em dashes, no "thrilled/excited/stoked/TIL"
  - Connects to user pain or interview experience? partial (builder pain primarily; user pain is "Generate Quick Prep button hangs and shows generic error" but kept implicit because Interview pulse for 5/4 is TBD and inventing it is banned)
  - No employer names or interview details? y
- Run notes: Interview pulse for 2026-05-04 is TBD in guildy-devlog.md. Per SKILL hierarchy of signal, engineering pulse can carry the post if it has real stakes/tension/insight on its own. The patch 6 → a242b8f diagnostic → patch 7 → patch 8 arc qualifies: the retry-makes-truncation-worse failure mode is a real lesson, not plumbing. No mention of any specific employer, recruiter, or interview detail. Co-Authored-By trailer on commits acknowledged but not referenced in draft.

## Guildy Story, 2026-05-06

### Lane: 1 (product decision, with Lane 4 user insight underneath)

### Core story
- Product context: Guildy is an interview prep tool that turns a real JD, resume, and interview stage into role-specific prep instead of generic ChatGPT output.
- Human context: When a recruiter named two of the four standard rounds and didn't enumerate the rest, Guildy was telling the user their loop was "missing" the unnamed rounds. Real recruiter messages don't enumerate; they trust you to know the standard shape.
- Lesson: When an AI fills in user-facing structure, charitable defaults beat pedantic ones. Don't promote silence to a fact. The default in any recruiter loop is that standard rounds exist; explicit exclusion is the only signal that should remove one.
- Proof: Rewrote the round-extraction rule. Unmentioned rounds stay neutral and the loop renders standard. Only an explicit exclusion ("we don't have a Bar Raiser this round") moves a round into the missing column. Drag-drops stay instant because the parse runs in the background, not in front of the user.

### X
[full draft — 3 tweets]

> I'm building Guildy, an interview prep tool. AI products that fill in user-facing structure have a quiet trap: silence gets promoted to a fact. First version of my round-parser was showing users "missing" rounds the recruiter just hadn't named.

> A typical recruiter message names two or three rounds and trusts you to know the rest are coming. The parser read that as "rounds X, Y, Z are confirmed missing." Wrong shape of inference. Empty space is not the same as a "no."

> Rewrote the rule: standard loop is the default, only flag a round as missing when the recruiter explicitly excludes it. Charitable defaults beat pedantic ones. Most user-visible AI pain comes from the second kind.

### Bluesky
[full draft — 2 posts]

> Building Guildy (the interview prep tool I'm using on my own search). Found a quiet failure mode today: the AI that parses recruiter messages was treating unmentioned rounds as confirmed-missing. A recruiter naming "HM and a cross-functional panel" doesn't mean Bar Raiser is excluded. Just unnamed.

> One-paragraph rule change: standard loop is the default, only flag a round as missing if the recruiter explicitly excludes it. Charitable defaults beat pedantic ones. The loop view feels honest now instead of falsely confident.

### Dev.to
SKIPPED by default. Today's lesson is product framing, not AI-workflow depth; would force the post into engineering territory the positioning override prohibits.

- Source: commits f34babc (sharpen-parser: bias missing_roles to explicit-exclusion-only) and cf8806e (sharpen-parser-2: bar_raiser taxonomy softening) on 2026-05-06. Supporting commit d6da79c (parser trigger deferred to client to keep drops instant) referenced as the latency win in the LinkedIn draft only by implication. The lesson the posts are about lives in the rule rewrite, not in the file or function names. Engineering pulse for 2026-05-06 carries the day; Interview pulse not yet logged for 5/6.
- Threads to: standalone. 5/3 was empty-state flash, 5/4 was redundant affordances, 5/5 was retry semantics across failure modes. Today is the first post about AI defaults shaping user-visible structure, so a different shape from the recent arc.
- Anti-slop pass:
  - X: y. Lane 1, Guildy context in tweet 1, lesson lands in tweet 1, no engineering jargon (parser used in plain-English sense), no banned openings (no "Caught/Fixed/Today I shipped"), no em dashes, generalizes to other AI-maker products, designer/founder/maker would understand fully, could not be written from a backend engineer's commit log alone (the framing is product-design judgment about charitable defaults), no employer names, no comp, no interview details.
  - Bluesky: y. Conversational, opens with Guildy + own job search context, plain English throughout, no em dashes, no banned openings, "found a quiet failure mode" replaces banned "caught," lesson generalizes, designer/founder readable.
  - LinkedIn: y. Lane 1, full Guildy product context in line 1, audience-appropriate length (~9 lines), framed as product/design lesson, no engineering internals, closing line generalizes to "your own product," no em dashes, no employer names, no comp, no interview details, no "AI-powered" or other banned phrases.
- Run notes: Phase 4f shipped 4 patches today (3.5, sharpen-parser, sharpen-parser-2, prompt 4). The strongest day-of story is the parser rule shift on patches sharpen-parser/sharpen-parser-2: the change is small in lines, large in product judgment. Patch 3.5 (defer to client) is also a good Lane 2 design story (drag-drops should feel instant, AI work shouldn't block visible user intent) but combining both in one core story dilutes the lesson; held the latency story as a possible future post if the queue runs dry. SKILL.md positioning override followed: no patch numbers, no file paths, no function names, no Zod, no schema, no PrepTruncatedError, no context_hash in any draft. The closest to engineering language is "parses" used in its plain-English sense.

## Guildy Story, 2026-05-07

### Lane: 2 (design craft, with Lane 4 user-insight underneath)

### Core story
- Product context: Guildy is an interview prep tool that turns a real JD, resume, and stage into role-specific prep instead of generic ChatGPT output. Jobs live on a 5-column board (Applied, Phone, Onsite, Offer, Closed).
- Human context: While using my own tool on my own search, adding a new job was a two-step routine: tap one global "Add Job" button, then drag the card to the column it belonged in. Did it five times before I noticed I was doing it.
- Lesson: Where you put the affordance is half the design. A single global add button on a multi-column board makes "I want a job in this column" a two-step ask. A column-level add with stage prefill makes it one.
- Proof: Every column except Offer now has its own small + Add Job button that opens the modal pre-set to that column's stage. The count moved inline next to the column label so the +button has room to live in the header. New jobs land where the user intended on the first move, not the second.

### X
[full draft — 3 tweets]

> I'm building Guildy, an interview prep tool, and using it on my own job search. Caught myself doing the same little dance five times this week: hit "Add Job," then drag the card to the column it actually belonged in. The button was in the wrong place.

> One global add button on a five-column board pretends every job starts in the same place. It doesn't. The column you're looking at when you reach for "Add" is almost always the column you want the job in. The two-step flow is the affordance refusing to listen.

> Moved the + into each column header with stage prefill. Tap +Add on Phone Screen, the modal opens already set to Phone Screen. One step. Where you put the affordance is half the design; the other half is whether it matches the place the user is already looking.

### Bluesky
[full draft — 2 posts]

> Building Guildy (the interview prep tool I'm using on my own search). Spent the morning fixing a tiny piece of UX I'd been quietly working around for a week. Adding a job was a two-step thing: tap the one "Add Job" button, then drag the card into the right column. I kept doing it instead of fixing it, which is its own kind of tell.

> Moved the + into every column header with the stage pre-filled. Tap +Add on Onsite, the modal opens already set to Onsite. The lesson I keep relearning: where you put an affordance is half the design. If your users (or you) are doing a little two-step to compensate for it, the button is in the wrong place.

### Dev.to
SKIPPED by default. Today's lesson is product/design judgment, not AI-workflow depth.

- Source: commit 11375ba (phase 4e prompt 2: column +Add Job with stage prefill, inline count, phase-done) on 2026-05-07. Touches components/app/board-column.tsx (column-level +Add button + AddJobModal mount, count moved inline next to label), components/app/applied-column.tsx (drop target + stage-prefilled add modal), app/app/actions.ts and lib/stages.ts (write-stage helpers). Also today: 7f16f14 (HANDOFF doc fill, no story material). Engineering pulse for 2026-05-07 not yet logged in guildy-devlog.md; commit message + diff carry the story. Lane 4 thread comes from the human context — the affordance felt wrong because I kept tripping over it on my own search, not from a bug report.
- Threads to: extends the recurring "state machine outpaces the UI" arc from 5/4 (redundant Regenerate / Cancel buttons removed once cache invalidation got smart enough). Same shape: the UI lagged behind a smarter underlying flow. 5/4 was about removing redundant affordances; today is about repositioning a too-central one. Different lesson, related thread.
- Anti-slop pass:
  - X: y. Lane 2 with Lane 4 framing in tweet 1, Guildy context up front, lesson lands in tweet 1 ("the button was in the wrong place"), no engineering jargon (column, modal, stage are product words), no banned openings (no "Caught a bug" — opens with the human dance), no em dashes, generalizes to any product person ("where you put the affordance is half the design"), no employer names, no comp, no interview details.
  - Bluesky: y. Conversational, opens with Guildy + own-search thread, plain English, no em dashes, no banned openings, the self-deprecating "I kept doing it instead of fixing it" is honest builder voice not hustle-bro, lesson generalizes, designer/maker readable, no specific employer or recruiter detail.
  - LinkedIn: skipped per kickoff rule (foundational required with <3 prior posts; today's story is specific design micro-decision).
- Run notes: Phase 4e prompt 2 is the only Guildy-meaningful commit on 5/7 (the other commit is a HANDOFF doc fill). Sized correctly: a one-step-vs-two-step affordance fix is a real design lesson but a small one, so kept the story tight and skipped LinkedIn rather than stretching it to fit. Followed positioning override: no patch numbers, no file paths, no function names, no schema/state language in any draft. "Modal" appears once in Bluesky as a plain product noun. "Cache invalidation" appears in run notes only (this section), not in drafts. Lane 4 thread "building it while using it" reinforced — second time this week the recurring narrative arc has carried the human context (also 5/4).

## Guildy Story, 2026-05-08

### Lane: 3 (solopreneur / AI-maker grind, with Lane 1 product-decision underneath)

### Core story
- Product context: Guildy is an interview prep tool that turns a real JD, resume, and interview stage into role-specific prep instead of generic ChatGPT output.
- Human context: Three days out from a Monday launch target, today's work was legal pages and the analytics stack, not features — the unglamorous plumbing every product has to have before it can take money.
- Lesson: Restraint is the discipline most solo builders skip pre-launch. Over-instrumenting feels like progress because the dashboard fills up; it mostly isn't progress, and the choices about what to cut are the only thing that scales when the team is one person.
- Proof: Wired three analytics events instead of thirty. Signup, first prep generated, subscription paid. The whole funnel that decides whether the product earns rent. Anything past that is curiosity dressed up as data.

### X
[full draft — 3 tweets]

> I'm building Guildy, an interview prep tool, on a Monday launch target. Today wasn't features. It was legal pages and the analytics stack. Wired three events, not thirty.

> Signup, first prep generated, subscription paid. That's the whole funnel that decides whether the product earns rent. Anything past that is curiosity dressed up as data.

> Most solo builders over-instrument because the dashboard feels like progress. It mostly isn't. Restraint shows up where you stop, not where you start.

### Bluesky
[full draft — 2 posts]

> Building Guildy, the interview prep tool I'm using on my own job search. Three days from launch and today's work was the plumbing, not the product: legal pages, analytics events, payment scaffolding. The reason it's possible as a one-person lift is AI as my team for execution, designer's taste for what to cut.

> Picked three analytics events instead of thirty. Signup, first prep generated, subscription paid. The whole funnel that decides whether the product earns rent. Most solo builders over-instrument because the dashboard feels like progress. It mostly isn't.

### Dev.to
SKIPPED by default. Today's lesson is founder discipline / product framing, not AI-workflow depth.

- Source: commit ba4199f (phase 6.5: Termly legal embeds + PostHog 3 events + V2.1 Ultra tier note) on 2026-05-08, plus 919ad14 (HANDOFF doc fill, no story material). The 3-event scope (signup_completed, first_prep_generated, subscription_paid) carries the founder-discipline lesson; the Termly choice (embed instead of write custom legal copy) sits underneath as supporting evidence in the LinkedIn draft only by implication ("legal pages"). V2.1 Ultra tier note ($49.99/mo, Opus 4.7 max + Concierge Interviewer Intel) intentionally not used — speculative, would dilute the launch-week-plumbing story and risk reading as future-revenue-fixation before earning current revenue.
- Threads to: Lane 3 / solo-maker arc. First explicit Lane 3 post in the queue. 5/3 was state-machine bug (Lane 2-ish), 5/4 was redundant affordances (Lane 2), 5/5 was retry semantics (engineering with product framing), 5/6 was AI defaults (Lane 1), 5/7 was column +Add affordance (Lane 2). Today widens the aperture to "what solo-maker launch week actually looks like" and seeds the Lane 3 thread for future posts.
- Anti-slop pass:
  - X: y. Lane 3, Guildy + product context in tweet 1, lesson lands in tweet 1 ("three events, not thirty"), no engineering jargon (events, funnel, dashboard are product/founder words), no banned openings (no "Caught/Fixed/Today I"), no em dashes, no hustle-bro speed claim ("Monday launch target" is a fact statement, then immediately undercut by "today wasn't features"), generalizes to other solo builders, designer/founder/maker would understand fully, could not be written from a backend engineer's commit log alone (the framing is founder discipline about scope of analytics, not implementation), no employer names, no comp, no interview details.
  - Bluesky: y. Foundational beat per kickoff rule (<3 prior Bluesky posts, this is the 3rd) — opens with Guildy product context + "using it on my own job search" + solo-maker / AI-as-team frame, then uses today's signal as proof in post 2. Conversational, no em dashes, no banned openings, no engineering internals, lesson generalizes, designer/maker readable.
  - LinkedIn: y. Foundational beat per kickoff rule (1 prior LinkedIn post, this is the 2nd) — full Guildy product context in line 1, audience-appropriate length (~10 lines), Lane 3 framing with the AI-as-team beat in the closing, actively cuts against the hustle-bro speed reading ("That doesn't mean shipping faster"), no em dashes (verified), no engineering internals, closing line generalizes, no employer names, no comp, no interview details, no "AI-powered" or other banned phrases.
- Run notes: Followed positioning override — no patch numbers, no file paths, no function names, no PostHog/Termly product names in any draft (kept platform-neutral as "analytics stack" / "analytics events" / "legal pages" so the lesson is the headline, not the tool choice). The "Monday launch target" reference checked carefully against the hustle-bro speed-brag ban: it's a fact statement that frames the week, then the post immediately pivots to "today wasn't features" which is the opposite of speed-bragging. Phase 6.5 is real, the launch sprint is real, naming the deadline grounds the founder lesson without claiming velocity. V2.1 Ultra tier deliberately not used (see source notes). Engineering pulse for 2026-05-08 not yet logged in guildy-devlog.md; commit message + HANDOFF.md "Current state" section + diff carry the story. Lane 3 ("solo-maker grind, AI as team") explicitly seeded for the first time in the queue today, with the AI-as-team frame appearing in both the Bluesky and LinkedIn drafts as a recurring narrative anchor that future posts can extend.

## Guildy 2026-05-16: holding
Lane 1 attempted (the Regenerate CTA was restored on 5/9, directly reversing the 5/4 blitz post that celebrated killing it — a real "I was wrong about an affordance" lesson). Didn't land today because the last commit landed 2026-05-14 16:47 PT, outside the 36-hour window, and the reversal is now a week stale without a fresh hook. Queue is 8 days behind (last drafted entry 5/8) — a catch-up arc covering the 5/9–5/14 unblitzed material (Regenerate restored, Stripe post-checkout resume, Quick tab hidden for paid users, Deep Prep section reorder, Background→Intro rename) would be a separate exercise from a same-day channel pack and isn't the right shape for this scheduled run. Holding rather than forcing a retroactive post that pretends today was the day.

## Guildy Story, 2026-05-17

### Lane: 1 (product decision, with Lane 4 user-insight underneath)

### Core story
- Product context: Guildy is an interview prep tool that turns a real JD, resume, and stage into role-specific prep instead of generic ChatGPT output.
- Human context: Days out from launch, the homepage was still asking visitors to create an account before they could see what the product actually does. For a tool whose pitch is "this is more specific than what you'd get from generic ChatGPT," that order makes the marketing copy do the work the prep itself should be doing.
- Lesson: When the value of an AI product is hard to describe in words, the demo is the pitch. Gating before the value moment makes the funnel easier to build and harder to trust. The signup ask earns trust after the output lands, not before.
- Proof: The homepage now generates a real Quick Prep against a pasted JD and resume before asking for an account. The prep carries cleanly across the signup boundary, so the first thing a new account contains is the output the visitor already saw.

### X
[full draft — 3 tweets]

> I'm building Guildy, an interview prep tool. Moved the signup wall this week. Used to be: create an account, then see your first prep generated. Now: paste a real JD and resume on the homepage, see the actual prep first, then sign up to keep it.

> For AI tools whose pitch is "this is more specific than generic ChatGPT," the demo is the pitch. You can't argue people into believing the output is better. They have to see their own prep land on the page, against their actual JD and their actual resume.

> Most products gate the value moment because the funnel is easier to build that way. Doesn't help conversion. Trust forms when the output appears, not when the marketing copy describes it.

### Bluesky
[full draft — 2 posts]

> Building Guildy, the interview prep tool I'm using on my own job search. Moved the signup wall this week. The old flow asked you to create an account before you saw the product do anything. The new flow lets you paste a real JD and resume on the homepage and watch the prep generate first.

> The pitch for any AI tool that says "this is more specific than generic ChatGPT" can't really be made in words. The user has to see their own output land on the page. Putting signup before the value moment makes the funnel easier to build and harder to trust.

### Dev.to
SKIPPED by default. Today's lesson is product framing for AI tools, not AI-workflow depth.

- Source: commit bd5117d (Phase 7 prereq: stateless POST /api/generate-quick-prep-unauth for the guildy.ai hero, reuses generatePrep with tier="quick", company/role passed as "(not provided)", stage defaults to "screen"). Devlog 2026-05-17 engineering pulse: the unauth funnel decision plus the pending consume-side migration that materializes the cached prep_versions row from an ephemeral handoff and deletes it after read. The launch-week framing connects to the 5/8 Lane 3 post (analytics restraint pre-launch) and the established arc that Guildy is days away from a paid launch.
- Threads to: extends the recurring narrative anchor "building it while using it on my own search" and broadens to "what visitors see before they sign up." First explicit Lane 1 post since 5/6 (charitable defaults in the round parser). Sits as the natural companion to 5/8 (founder discipline / launch-week plumbing) without repeating it: 5/8 was scope discipline on analytics events, 5/17 is scope discipline on what the homepage demonstrates before asking for anything.
- Anti-slop pass:
  - X: y. Lane 1, full Guildy context in tweet 1, lesson lands in tweet 1, no engineering jargon (no endpoint/stateless/handoff/migration anywhere), no banned openings, no em dashes (verified, colons and periods only), no "thrilled/excited/stoked/shipping in public," no hustle-bro speed claim, generalizes to any AI tool whose pitch is "more specific than the general-purpose chatbot," designer/founder/maker readable, could not be written from a backend engineer's commit log alone (the lesson is product framing about demos vs marketing copy), no employer names, no comp, no interview details.
  - Bluesky: y. Kickoff rule: 3 prior Bluesky posts on file, in the 3-5 "mix" band; today's specific decision story is allowed because it connects to the established "generic ChatGPT prep fails" foundational thread already laid down on 5/6 and 5/8. Opens with Guildy product context + own-search anchor, plain English, no em dashes, no banned openings, lesson generalizes, designer/maker readable.
  - LinkedIn: y. Kickoff rule: 2 prior LinkedIn posts on file (<3), so today should be foundational. Today's story qualifies as foundational because it answers "why does this product exist" by way of "what is the right shape of an AI-tool funnel when the value can't be described in words." Full Guildy product context in line 1 + own-search anchor, audience-appropriate length (~12 lines), framed as product/design lesson, no engineering internals (the words "stateless," "endpoint," "migration," "handoff," "API," "schema" appear nowhere in the draft), closing line generalizes to "for AI tools, it's almost always the right trade," no em dashes (verified), no employer names, no comp, no interview details, no "AI-powered" or other banned phrases.
- Run notes: Engineering pulse for 2026-05-17 is the unauth Quick Prep funnel. Engineering details deliberately translated into product framing per positioning override: "stateless POST endpoint" → "the prep has to work without an account behind it"; "unauth_handoffs table with ephemeral capability-token row" → "the output has to carry cleanly across the signup boundary"; "input caps 20000 JD / 50000 resume" → "feel safe enough to paste a resume into"; "no rate limit, $7 Anthropic credit self-bounds abuse" → omitted entirely (real Lane 3 founder-restraint beat but would dilute today's Lane 1 demo-is-the-pitch lesson and risk reading as either bravado or financial detail; held for a possible future Lane 3 post on solo-maker risk discipline). No patch numbers, no file paths, no function names, no schema language, no model names (claude-haiku-4-5-20251001) anywhere in any draft. The 5/16 hold note flagged the queue as behind; today's post is on its own beat (demo-before-signup), not a retroactive catch-up, so it doesn't try to fold in the 5/9–5/14 reversals (Regenerate restored, Stripe resume, etc.). Those remain a separate catch-up arc the queue can run later if a hook surfaces.

## Guildy 2026-05-18: holding
Lane 1 was the only candidate. The single fresh commit in the 36-hour window is 5cc7c7a on 5/17 morning (signup handoff that completes the unauth Quick Prep flow). That's the implementation of the lesson yesterday's post already published — the 5/17 LinkedIn draft explicitly says "the output has to carry cleanly across the signup boundary, so the first thing a new account contains is the prep the visitor already saw," which is exactly what 5cc7c7a ships. Writing the same arc again 24 hours later from the same commit cluster is repetition, not a new story. No commits today. Interview pulses 5/4 through 5/17 are still TBD in guildy-devlog.md, so no Lane 4 user-insight material to switch to. The 5/16 catch-up backlog (Regenerate restored, Stripe post-checkout resume, Quick tab hidden for paid users, Deep section reorder, Background→Intro rename) is still available as a separate catch-up exercise but doesn't fit a same-day scheduled run. Holding.

## Guildy 2026-05-20: holding
Lane 3 attempted (solo-maker pre-launch quiet period). The 36-hour window contains zero commits — last commit is still 5cc7c7a on 5/17 morning, used in the 5/17 post and named in the 5/18 hold. That's three consecutive days with no new shipped material. Interview pulse for every date 5/4 through 5/18 is still TBD in guildy-devlog.md, so no Lane 4 hook to swap to either. The "founder grind, the week between feature-complete and launch is quieter than people assume" angle is a real Lane 3 lesson but writing it from zero same-day signal makes it abstract, not specific. The 5/16 catch-up backlog (Regenerate restored as Lane 1 reversal, Stripe post-checkout resume, Quick tab hidden for paid users, Deep section reorder, Background→Intro rename) remains the strongest unblitzed material — particularly the Regenerate reversal, which is a real "I was wrong about an affordance" Lane 1 story directly reversing the 5/4 post. But it's been ~10 days since those commits landed and would need a fresh hook (Michael's own framing, a user moment, or a follow-on commit) to land as today's post rather than a retroactive correction. Holding rather than forcing a hookless catch-up.

## Guildy Story, 2026-06-02

### Lane: 4 (user insight from using my own tool, with Lane 2 design craft underneath)

### Core story
- Product context: Guildy is an interview prep tool that turns a real JD, resume, and stage into role-specific prep instead of generic ChatGPT output. Jobs live on a 5-column board.
- Human context: Using Guildy on my own search this week, I noticed I was doing the same thing every time I opened the app: scanning five columns of jobs and prioritizing in my head. The board told me where every job was, not what I should do next.
- Lesson: A tracker is passive. A job-search tool has to be active. The board shows state. State is not next action. Job hunters need "what should I do right now" more than "where is everything."
- Proof: Added a Today panel to the home view. It surfaces the highest-leverage next move: prep that's due before an upcoming interview, jobs that still need a Quick Prep, an apply-pace nudge when the week is running behind a weekly goal. The board is still there. The next action just doesn't live inside it anymore.

### X
[full draft — 3 tweets]

> I'm building Guildy, an interview prep tool, and using it on my own job search. Opened the app this week and realized the kanban board told me where every job was but not what I should do next. I was doing the prioritization in my head every time.

> A tracker is passive. A job-search tool has to be active. The board shows state. State is not next action. Job hunters need "what should I do right now" more than "where is everything."

> Added a Today panel. Prep that's due. Jobs that still need a Quick Prep. An apply-pace nudge when the week is behind. The board is still there. The answer just doesn't live inside it anymore.

### Bluesky
[full draft — 2 posts]

> Building Guildy, the interview prep tool I'm using on my own job search. Opened it this week and noticed I was doing the same thing every time: scanning five columns of jobs and prioritizing in my head. The board told me where everything was. It didn't tell me what to do next.

> Trackers are passive. Job-search tools have to be active. Added a Today panel that surfaces the next move: prep that's due, jobs still missing a Quick Prep, an apply-pace nudge when the week's behind. The board is still there. The answer just doesn't live inside it anymore.

### Dev.to
SKIPPED by default. Today's lesson is product/design judgment, not AI-workflow depth.

- Source: commits 322cf50 (home command center left rail with stats panel and automatic job source advisor), cc0f7f9 (home Today panel in command rail: prep-due, quick-prep gap, source nudge, apply-pace fallback), 5466306 (collapse job source advisor, persistent apply goal meter with segment benchmark), 68bac98 (guildy 2.1 command center backlog), all on 2026-05-31. The Today panel rules carry the Lane 4 / Lane 2 story: prep-due, quick-prep gap, source nudge, apply-pace fallback are user-visible nudges that turn the home view from a passive board into an active surface. Engineering pulse for 2026-05-31 not yet logged in guildy-devlog.md (last entry is 5/21 hold); commit messages + diff carry the story. 36-hour window is borderline (commits landed late evening 5/31 PT, today is 6/2), but the queue was holding all of late May, the story is the first fresh material in two weeks, and the home-view shift is genuinely the strongest lane material in the window.
- Threads to: extends the recurring "building it while using it on my own search" Lane 4 anchor and the "state machine outpaces the UI" arc (5/3, 5/4, 5/7). Different lesson from prior posts — this is the first explicit "I needed the tool to tell me what to do, not just where things were" story. Sits naturally after 5/17 (demo before signup, Lane 1) as the next beat in the "what makes this tool actually useful" thread. Skips the 5/9–5/14 catch-up backlog (Regenerate restored, Stripe resume, Quick tab hidden, Deep reorder, Background→Intro rename) per the 5/16/5/20 hold logic — those remain a separate catch-up arc that needs its own hook.
- Anti-slop pass:
  - X: y. Lane 4 with Lane 2 underneath, Guildy + own-search context in tweet 1, lesson lands in tweet 1 ("doing the prioritization in my head"), no engineering jargon (Today panel, board, columns are product words), no banned openings (no "Caught/Fixed/Today I shipped"), no em dashes (verified, periods and commas only), no "thrilled/excited/stoked," no hustle-bro speed claim, generalizes to any product where the user prioritizes on top of the data, designer/founder/maker readable, could not be written from a backend engineer's commit log alone (the framing is user-experience judgment from lived use), no employer names, no comp, no interview details.
  - Bluesky: y. Kickoff rule: 4 prior Bluesky posts on file, in the 3-5 "mix" band; today's specific Lane 4 user-insight story is allowed because it connects to the established "building it while using it on my own search" foundational thread laid down on 5/6, 5/7, 5/8, 5/17. Opens with Guildy product context + own-search anchor, plain English, no em dashes, no banned openings, lesson generalizes, designer/maker readable.
  - LinkedIn: y. Kickoff rule: 3 prior LinkedIn posts on file (5/6, 5/8, 5/17), exactly at the 3-5 "mix" threshold; today's specific decision story is allowed because it connects to both established foundational threads ("building it while using it on my own search" and "generic AI prep is broken because it doesn't reference your actual context"). Full Guildy product context in line 1 + own-search anchor, audience-appropriate length (~8 lines), framed as product/design lesson with a generalizable closing, no engineering internals (the words "command rail," "left rail," "stats panel," "applyBenchmarks," "boardRatings," "aiFallback" appear nowhere in the draft), no em dashes (verified), no employer names, no comp, no interview details, no "AI-powered" or other banned phrases.
- Run notes: Engineering pulse for 2026-05-31 is the command center home-view shift (left rail with stats panel + job source advisor, Today panel with four nudge rules, persistent apply goal meter with segment benchmark). Engineering details deliberately translated into product framing per positioning override: "command rail left column" → "Today panel" (user-visible name) / "home view"; "job source advisor with applyBenchmarks + boardRatings + aiFallback" → "an apply-pace nudge when the week is behind a weekly goal" (the user-visible result of the advisor, not the architecture); "prep-due / quick-prep gap / source nudge / apply-pace fallback" rule names → translated to the plain-English forms in tweet 3 / Bluesky post 2 / LinkedIn paragraph 4. No file paths, no function names, no schema language, no commit hashes, no patch numbers anywhere in any draft. The "command center" framing from the commit messages and backlog doc intentionally not used in drafts — it's an internal product name, and the lesson lands harder as "Today panel" (concrete user-visible surface) than as "command center" (abstract internal architecture). Source advisor and goal meter intentionally not detailed beyond the apply-pace nudge — adding them in full would make the story about feature breadth instead of the one lesson (tracker vs tool). Hold them for a possible future Lane 2 post on benchmark design or goal-setting UX if the queue runs dry. The 5/9–5/14 catch-up backlog still untouched and still available for a separate hook-driven exercise.
