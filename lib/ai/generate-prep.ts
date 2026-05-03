import "server-only"

import type {
  PrepInput,
  PrepOutput,
  PrepStage,
  PrepCriterion,
  PrepFrame,
  PrepRiskItem,
  PrepQuestionThey,
  PrepQuestionYou,
} from "./prep-types"

// Phase 4b-1: mock implementation. Returns hardcoded JSON tailored slightly
// per stage and lightly references company + role so the rendered output
// feels grounded. Phase 4b-2 swaps the body for a real GPT-5.4 nano call;
// the signature stays.
export async function generatePrep(input: PrepInput): Promise<PrepOutput> {
  await sleep(500)

  const { stage, company_name, role_title, interviewer_name, tier } = input
  const company = company_name
  const role = role_title
  const them = interviewer_name ?? `the ${stageLabel(stage)} interviewer`
  const isDeep = tier === "deep"

  return {
    stage,
    purpose: purposeFor(stage, company, role),
    positioning: positioningFor(stage, company, role, them),
    risks: risksFor(stage, role, isDeep),
    prep_checklist: checklistFor(stage),
    questions_they_ask: questionsTheyAsk(stage, company, role, isDeep),
    questions_you_ask: questionsYouAsk(stage, company),
    interviewer_insights: isDeep ? null : null, // Deep-only — Phase 4c populates
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stageLabel(stage: PrepStage): string {
  switch (stage) {
    case "screen":
      return "recruiter screen"
    case "hiring_manager":
      return "hiring manager"
    case "interview_loop":
      return "panel"
    case "offer":
      return "offer call"
  }
}

function purposeFor(stage: PrepStage, company: string, role: string) {
  const summaryByStage: Record<PrepStage, string> = {
    screen: `${company} uses the screen to confirm baseline fit and that you're worth a hiring-manager slot. Recruiters score communication, scope sense, and clarity on why this ${role} role.`,
    hiring_manager: `The ${role} hiring manager at ${company} is testing whether your scope, judgment, and recent work map to the team they need. Expect more depth than the screen and sharper probes on tradeoffs.`,
    interview_loop: `The ${company} panel rounds stress-test how you operate end-to-end as a ${role}. Each interviewer carries a different rubric — communication, craft, collaboration, impact.`,
    offer: `The offer conversation at ${company} is closing-stage. They want signal that you're motivated, that comp expectations are workable, and that timing won't slip.`,
  }

  const criteriaByStage: Record<PrepStage, PrepCriterion[]> = {
    screen: [
      {
        name: "Communication",
        weight: 35,
        description: "Crisp, structured answers without rambling.",
      },
      {
        name: "Scope sense",
        weight: 30,
        description: `Can you describe the kind of ${role} work that fits this team?`,
      },
      {
        name: "Process clarity",
        weight: 20,
        description: "How you frame your last 1-2 projects in 2-3 minutes.",
      },
      {
        name: "Fit signal",
        weight: 15,
        description: `Why ${company}, not just any company.`,
      },
    ],
    hiring_manager: [
      {
        name: "Judgment",
        weight: 35,
        description: "How you choose what to do and what to drop.",
      },
      {
        name: "Craft depth",
        weight: 30,
        description: `Specifics behind ${role}-level decisions.`,
      },
      {
        name: "Collaboration",
        weight: 20,
        description: "How you work with PMs, eng, and leadership.",
      },
      {
        name: "Outcome ownership",
        weight: 15,
        description: "Whether the work you describe shipped and moved a metric.",
      },
    ],
    interview_loop: [
      {
        name: "Craft",
        weight: 30,
        description: "Direct evidence of your skill on representative work.",
      },
      {
        name: "Process",
        weight: 25,
        description: "How you run a project from ambiguous start to ship.",
      },
      {
        name: "Collaboration",
        weight: 25,
        description: "Stories that show influence without authority.",
      },
      {
        name: "Impact",
        weight: 20,
        description: "Numbers, scope, and what changed because of you.",
      },
    ],
    offer: [
      {
        name: "Motivation",
        weight: 50,
        description: `Is ${company} your top choice or a leverage play?`,
      },
      {
        name: "Comp alignment",
        weight: 30,
        description: "Are your numbers in their band, or will it take a stretch?",
      },
      {
        name: "Timing",
        weight: 20,
        description: "Start date, competing offers, and decision window.",
      },
    ],
  }

  return {
    headline: "What this round is really testing",
    summary: summaryByStage[stage],
    criteria: criteriaByStage[stage],
  }
}

function positioningFor(
  stage: PrepStage,
  company: string,
  role: string,
  them: string
) {
  const framesByStage: Record<PrepStage, PrepFrame[]> = {
    screen: [
      {
        title: `Lead with why ${role}`,
        description: `Open with one sentence on what kind of ${role} you are, then one sentence on why ${company} fits.`,
      },
      {
        title: "Anchor on a recent shipped project",
        description:
          "Pick one project from the last 12 months you can describe in 90 seconds end-to-end.",
      },
      {
        title: "Skip the resume walkthrough",
        description: `${them} has the resume. Spend the time on selection, not enumeration.`,
      },
      {
        title: "Show one specific reason for this company",
        description: `Reference a product, post, or recent move from ${company}, not generic praise.`,
      },
    ],
    hiring_manager: [
      {
        title: "Open with a scope-matched story",
        description: `Pick a project at the same scope ${company} expects from a ${role} on this team.`,
      },
      {
        title: "Show one explicit tradeoff",
        description:
          "Hiring managers care about the cuts, not the wins. Name one thing you de-prioritized and why.",
      },
      {
        title: "Map your work to their stack/team shape",
        description: `Reference how your last team's shape compares to what ${company} likely runs.`,
      },
      {
        title: "Be ready to defend a decision",
        description:
          "Pick a call that didn't go your way and have a real, non-defensive read of it.",
      },
    ],
    interview_loop: [
      {
        title: "One spine story, multiple angles",
        description:
          "Choose one big project as your spine. Different interviewers will probe different facets — craft, process, collaboration, impact.",
      },
      {
        title: "Lead each answer with the decision",
        description:
          "Don't recap context for 60 seconds. Open with the choice you made, then unpack it.",
      },
      {
        title: "Name names where appropriate",
        description:
          "Concrete teammates, PMs, and stakeholders signal real cross-functional work.",
      },
      {
        title: "Land the impact line",
        description: "Every story needs a one-line outcome, not a paragraph.",
      },
    ],
    offer: [
      {
        title: "Confirm motivation early",
        description: `Open with the specific reason ${company} is your top choice. Recruiters relay this to the hiring manager.`,
      },
      {
        title: "Anchor comp by total target",
        description:
          "Give a single TC number, not a range, and let them work back to base/equity/bonus.",
      },
      {
        title: "Give a real timeline",
        description: "If you have other processes running, name them in vague terms but give a realistic decide-by date.",
      },
    ],
  }

  return {
    headline: "How to position yourself",
    summary: `Three to four framing moves for a ${role} at ${company}, ${stageLabel(
      stage
    )} round.`,
    frames: framesByStage[stage],
  }
}

function risksFor(
  stage: PrepStage,
  role: string,
  isDeep: boolean
): PrepOutput["risks"] {
  const itemsByStage: Record<PrepStage, PrepRiskItem[]> = {
    screen: [
      {
        risk: "Rambling on the 'tell me about yourself' question",
        counter: isDeep
          ? "Cap the answer at 90 seconds. Three beats: what kind of designer/engineer you are, the most relevant recent project, why this company."
          : null,
      },
      {
        risk: "Sounding generic on 'why this company'",
        counter: isDeep
          ? "Name one specific signal — a product change, a public post, a recent hire — and what about it interests you."
          : null,
      },
      {
        risk: "Vague on comp expectations",
        counter: isDeep
          ? "Have a clean TC range with the floor at +10% over current and the ceiling at market p75 for the role and level."
          : null,
      },
    ],
    hiring_manager: [
      {
        risk: "Describing team work as solo work",
        counter: isDeep
          ? "Name PMs, engineers, and stakeholders by role. Show where your work started and where someone else picked it up."
          : null,
      },
      {
        risk: "Defending a bad call instead of owning it",
        counter: isDeep
          ? "If a decision didn't work, lead with what you'd do differently. Don't relitigate the original tradeoff."
          : null,
      },
      {
        risk: `Scope mismatch with the ${role} level`,
        counter: isDeep
          ? "Pick stories at one level above the IC role and one at the level — show range without overshooting."
          : null,
      },
    ],
    interview_loop: [
      {
        risk: "Different stories with different interviewers",
        counter: isDeep
          ? "Use one spine project across panels. Repeating beats consistency in their debrief."
          : null,
      },
      {
        risk: "Process answers without specifics",
        counter: isDeep
          ? "Reference real artifacts: a doc you wrote, a meeting you ran, a ticket you closed."
          : null,
      },
      {
        risk: "Soft on impact",
        counter: isDeep
          ? "Quantify with whatever metric you owned — even directional numbers beat 'lots of users.'"
          : null,
      },
    ],
    offer: [
      {
        risk: "Overplaying competing offers",
        counter: isDeep
          ? "Reference other processes only if they're real and roughly aligned in timing. Don't bluff."
          : null,
      },
      {
        risk: "Mismatched expectations on start date",
        counter: isDeep
          ? "Have a real number for notice period and any blockers. 4 weeks is the default ceiling without a story."
          : null,
      },
    ],
  }

  return {
    headline: "Where they'll push",
    summary: `${
      isDeep ? "Likely concerns with prepared counters" : "Light reminders"
    } for the ${stageLabel(stage)} round.`,
    items: itemsByStage[stage],
  }
}

function checklistFor(stage: PrepStage): PrepOutput["prep_checklist"] {
  const byStage: Record<PrepStage, string[]> = {
    screen: [
      "90-second self-intro rehearsed",
      "One reason this company, one reason this role",
      "Comp range ready",
      "Two questions to ask the recruiter",
    ],
    hiring_manager: [
      "Spine project chosen and timed at 4-5 minutes",
      "One tradeoff story ready",
      "One disagreement story ready",
      "Three questions about scope and expectations",
    ],
    interview_loop: [
      "Spine project rehearsed across craft / process / collab / impact angles",
      "Two backup stories chosen",
      "One question per interviewer prepared",
      "Reset routine between panels (water, 10 deep breaths)",
    ],
    offer: [
      "Single TC target number",
      "Decide-by date set",
      "Reference checks lined up",
      "Resignation logistics planned",
    ],
  }

  return byStage[stage].map((item) => ({ item, done: false }))
}

function questionsTheyAsk(
  stage: PrepStage,
  company: string,
  role: string,
  isDeep: boolean
): PrepQuestionThey[] {
  const planIfDeep = (plan: string): string | null => (isDeep ? plan : null)

  const byStage: Record<PrepStage, PrepQuestionThey[]> = {
    screen: [
      {
        category: "Opening",
        question: "Tell me a bit about yourself.",
        answer_plan: planIfDeep(
          "Three beats in 90 seconds: identity (1 line), most relevant project (45s), why this company (15s)."
        ),
      },
      {
        category: "Method",
        question: "Walk me through a project you're proud of.",
        answer_plan: planIfDeep(
          "Open with the decision, not the context. Decision → tradeoff → outcome. 3-4 minutes."
        ),
      },
      {
        category: "Fit",
        question: `Why ${company}?`,
        answer_plan: planIfDeep(
          "One specific signal you noticed (product, post, hire), one personal reason that ties to it."
        ),
      },
      {
        category: "Logistics",
        question: "What's your comp expectation?",
        answer_plan: planIfDeep(
          "Give a single TC number with a small range. Anchor at +10% over current."
        ),
      },
    ],
    hiring_manager: [
      {
        category: "Opening",
        question: `What kind of ${role} are you?`,
        answer_plan: planIfDeep(
          "Two adjectives that match the job description. Then one sentence on the kind of work you're best at."
        ),
      },
      {
        category: "Method",
        question: "Tell me about a hard tradeoff you made.",
        answer_plan: planIfDeep(
          "Pick one with a clear loser. Lead with the cut, not the win."
        ),
      },
      {
        category: "Collab",
        question: "Walk me through a disagreement with a peer.",
        answer_plan: planIfDeep(
          "Name the peer's role, the disagreement, the resolution path. Don't villainize them."
        ),
      },
      {
        category: "Impact",
        question: "What's the work you're most known for?",
        answer_plan: planIfDeep(
          "One project. Quantified outcome. Who else picked it up after you."
        ),
      },
    ],
    interview_loop: [
      {
        category: "Craft",
        question: "Show me a recent piece of work end-to-end.",
        answer_plan: planIfDeep(
          "Pick the spine project. 5 minutes max. Open with the brief, end with what shipped."
        ),
      },
      {
        category: "Process",
        question: "How do you decide what not to do?",
        answer_plan: planIfDeep(
          "Use a real cut from the spine project. Name the criteria and what you preserved by cutting."
        ),
      },
      {
        category: "Collab",
        question: "Tell me about a time you disagreed with a stakeholder.",
        answer_plan: planIfDeep(
          "PM or exec disagreement. Lead with their concern, not yours."
        ),
      },
      {
        category: "Impact",
        question: "What's the largest scope you've owned?",
        answer_plan: planIfDeep(
          "Anchor on team size, surface area, and the metric you moved. Be specific or skip the number."
        ),
      },
      {
        category: "Failure",
        question: "Tell me about a time you failed.",
        answer_plan: planIfDeep(
          "Real failure, not a humble brag. What you learned and what you do differently now."
        ),
      },
    ],
    offer: [
      {
        category: "Motivation",
        question: `What's making this decision hard?`,
        answer_plan: planIfDeep(
          `Honest answer: timing of competing processes, or specific concerns about ${company}. Don't bluff.`
        ),
      },
      {
        category: "Logistics",
        question: "When can you start?",
        answer_plan: planIfDeep(
          "Give a real date. Subtract weekends and known PTO. 4 weeks is the default ceiling."
        ),
      },
      {
        category: "Comp",
        question: "Are these numbers workable?",
        answer_plan: planIfDeep(
          "Reflect back the TC, then name the one component (base / equity / sign-on) you'd want adjusted."
        ),
      },
    ],
  }

  return byStage[stage]
}

function questionsYouAsk(
  stage: PrepStage,
  company: string
): PrepQuestionYou[] {
  const byStage: Record<PrepStage, PrepQuestionYou[]> = {
    screen: [
      {
        category: "Process",
        question: `What does the rest of the loop look like at ${company}?`,
      },
      {
        category: "Process",
        question: "What's the typical timeline from screen to offer?",
      },
      {
        category: "Team",
        question: "Who would I be talking to next?",
      },
    ],
    hiring_manager: [
      {
        category: "Role",
        question: "What does success look like in the first 90 days?",
      },
      {
        category: "Team",
        question: "What's the team's biggest unsolved problem right now?",
      },
      {
        category: "Manager",
        question: "How do you like to give feedback?",
      },
    ],
    interview_loop: [
      {
        category: "Craft",
        question: "What's the work you'd want me doing in month one?",
      },
      {
        category: "Org",
        question: "How are decisions made between this team and adjacent ones?",
      },
      {
        category: "Culture",
        question: "What's something about working here that surprised you?",
      },
    ],
    offer: [
      {
        category: "Comp",
        question: "Is there flexibility in any one component of the offer?",
      },
      {
        category: "Logistics",
        question: "What's the expected first-week ramp?",
      },
    ],
  }

  return byStage[stage]
}
