import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = 'force-dynamic'

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "supabase not configured" })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "not logged in" })
    }

    const userEmail = session.user.email

    // Get all pipelines
    const { data: pipelines, error: pErr } = await supabaseAdmin
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    if (pErr || !pipelines) {
      return NextResponse.json({ error: `query failed: ${pErr?.message}` })
    }

    // Group by fuzzy company name (substring matching)
    // "Chalk" and "Chalk.ai" should be in the same group
    const groups: any[][] = []
    const assigned = new Set<string>()

    for (const p of pipelines) {
      if (assigned.has(p.id)) continue
      const pNorm = normalize(p.company)
      if (!pNorm) continue

      const group = [p]
      assigned.add(p.id)

      for (const q of pipelines) {
        if (assigned.has(q.id)) continue
        const qNorm = normalize(q.company)
        if (!qNorm) continue

        // Match if one name contains the other (fuzzy)
        if (pNorm.includes(qNorm) || qNorm.includes(pNorm)) {
          group.push(q)
          assigned.add(q.id)
        }
      }

      groups.push(group)
    }

    const results: any[] = []

    for (const group of groups) {
      if (group.length <= 1) continue // no duplicates

      // Sort by prep richness (most content first), then by updated_at
      group.sort((a, b) => {
        const richness = (p: any) => {
          const prep = p.prep_json || {}
          let s = 0
          if (prep.narrative) s += 3
          if (prep.spicyOpinion || prep.spicy_opinion) s += 2
          if (prep.questionsTheyMightAsk?.length || prep.questions_they_ask?.length) s += 2
          if (prep.questionsYouShouldAsk?.length || prep.questions_you_ask?.length) s += 2
          if (prep.primitives?.length) s += 2
          if (prep.proofStories?.length || prep.proof_stories?.length) s += 2
          if (prep.whatToEmphasize?.length || prep.what_to_emphasize?.length) s += 1
          s += (p.prep_json ? JSON.stringify(p.prep_json).length : 0) / 1000
          return s
        }
        return richness(b) - richness(a)
      })

      const keeper = group[0]
      const duplicates = group.slice(1)

      // Move all emails from duplicates to keeper
      for (const dup of duplicates) {
        const { error: moveErr } = await supabaseAdmin
          .from("emails")
          .update({ pipeline_id: keeper.id })
          .eq("pipeline_id", dup.id)

        if (moveErr) {
          results.push({ company: keeper.company, action: "email_move_failed", error: moveErr.message })
          continue
        }

        // Delete the duplicate pipeline
        const { error: delErr } = await supabaseAdmin
          .from("pipelines")
          .delete()
          .eq("id", dup.id)

        if (delErr) {
          results.push({ company: keeper.company, action: "delete_failed", dupId: dup.id, error: delErr.message })
        } else {
          results.push({
            company: keeper.company,
            action: "merged",
            kept: keeper.id,
            deleted: dup.id,
            keeper_prep_size: keeper.prep_json ? JSON.stringify(keeper.prep_json).length : 0,
            deleted_prep_size: dup.prep_json ? JSON.stringify(dup.prep_json).length : 0,
          })
        }
      }
    }

    // Get final count
    const { data: remaining } = await supabaseAdmin
      .from("pipelines")
      .select("id, company")
      .eq("user_email", userEmail)

    return NextResponse.json({
      message: results.length > 0 ? "Duplicates merged!" : "No duplicates found.",
      actions: results,
      pipelines_remaining: (remaining || []).length,
      companies: (remaining || []).map((p: any) => p.company),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
