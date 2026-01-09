
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
import OpenAI from 'openai'

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local')
const envLocal = fs.readFileSync(envLocalPath, 'utf8')
const envParsed: Record<string, string> = {}
envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        envParsed[key] = value
    }
})

const supabase = createClient(envParsed.NEXT_PUBLIC_SUPABASE_URL!, envParsed.SUPABASE_SERVICE_ROLE_KEY!)
const openai = new OpenAI({ apiKey: envParsed.OPENAI_API_KEY })

const SYSTEM_PROMPT = `IDENTITY:
You are a WORLD-CLASS TECHNICAL INTERVIEW COACH and STRATEGIST. You do not give generic advice. You are "spicy", opinionated, and highly specific. You reverse-engineer the company's culture, stack, and hidden challenges to give the candidate an UNFAIR ADVANTAGE.

GOLD STANDARD EXAMPLE (This is the quality bar. Match this depth and tone):
If analyzing a "Founding Designer" role for an AI Hardware/EDA tool:
{
  "narrative": "I design AI-native technical workflows where the UI is a reasoning surface: constraints → exploration → verification. I’ve led platform redesigns for engineer-heavy products, and I’m strongest where correctness and trust matter.",
  "proof_stories": [
    { "title": "Systems Design", "detail": "Redesigned a complex workflow (entities, pipelines, debugging) merging 5 tools into 1." },
    { "title": "Trust + AI", "detail": "Handled automation risk: confidence scores, human override, and audit trails for high-stakes decisions." }
  ],
  "primitives": [
    { "name": "Constraint Editor", "description": "Source of truth, validation, diffs" },
    { "name": "Verification View", "description": "Pass/fail evidence, repro, rollback" }
  ],
  "spicy_opinion": "For high-stakes design, the AI must always be verifiable: it can propose, but it must attach the evidence trail. Chat interfaces are often the wrong primitive for architectural work.",
  "questions_they_ask": [
    { "category": "Founder Reality", "question": "How do you prioritize when founders pull in different directions?" },
    { "category": "Domain", "question": "How do you design for users far more technical than you (ASIC engineers)?" }
  ],
  "questions_you_ask": [
    { "category": "Product Wedge", "question": "What’s the first product moment you’re betting on—spec→constraints or verification and why?" },
    { "category": "Trust", "question": "When the AI proposes a design, what evidence must it attach—sim results, formal checks, or citations?" }
  ]
}

TASK:
Analyze the email thread. Determine if it is a recruiting email. If yes, generate a BESPOKE prep playbook matching the depth and "spice" of the example above.

GUIDELINES:
1. **NO GENERIC FLUFF**: Never say "Show team spirit" or "Be yourself".
2. **BE SPICY**: Give opinions that might be controversial but show seniority (e.g., "Chatbots are bad for X").
3. **INFER DEEPLY**: Guess the stack/challenges.
4. **NARRATIVE**: Write the 30-second intro pitch in the FIRST PERSON ("I...").
5. **PRIMITIVES**: Noun-oriented concepts specific to this domain.

OUTPUT FORMAT (JSON ONLY):
{
  "is_recruiting": boolean,
  "company": string,
  "role": string,
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": string,
  "predicted_stages": string[],
  "action_needed": string | null,
  "insights": {
    "stageReason": string,
    "waitingOn": "you" | "them",
    "nextAction": string,
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "stageFocus": string,
    "narrative": string,
    "proof_stories": [{ "title": string, "detail": string }],
    "primitives": [{ "name": string, "description": string }],
    "spicy_opinion": string,
    "questions_they_ask": [{ "category": string, "question": string }], // 8 items
    "questions_you_ask": [{ "category": string, "question": string }], // 8 items
    "companyIntel": {
      "summary": string,
      "recentNews": string[]
    }
  }
}`

async function run() {
    console.log("Searching for Listen Labs pipeline...")
    const { data: pipelines } = await supabase
        .from('pipelines')
        .select('*')
        .ilike('company', '%Listen Labs%')

    if (!pipelines || pipelines.length === 0) {
        console.error("No pipeline found for Listen Labs!")
        return
    }

    const pipeline = pipelines[0]
    console.log(`Found pipeline: ${pipeline.company} (${pipeline.id})`)

    // Construct a strong user prompt to simulate the context
    const userPrompt = `
  Context:
  Role: Product Designer at Listen Labs
  Company: Listen Labs (AI audio/voice generation space likely, or audio analytics)
  
  Please generate the God-Tier prep for this role.
  `

    console.log("Calling OpenAI GPT-4o...")
    const res = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.5,
        max_tokens: 2500,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
        ],
    })

    const content = res.choices[0].message.content
    if (!content) {
        console.error("No content generated!")
        return
    }

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        console.error("No JSCO found in output")
        console.log(content)
        return
    }

    const data = JSON.parse(jsonMatch[0])
    console.log("Generated Prep:", JSON.stringify(data.prep, null, 2))

    console.log("Updating database...")
    const { error } = await supabase
        .from('pipelines')
        .update({
            prep_json: data.prep,
            updated_at: new Date().toISOString()
        })
        .eq('id', pipeline.id)

    if (error) {
        console.error("Update failed:", error)
    } else {
        console.log("SUCCESS! Pipeline updated with God Mode prep.")
    }
}

run()
