import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = 'force-dynamic'

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

    // Get all pipelines with prep status
    const { data: pipelines, error: pErr } = await supabaseAdmin
      .from("pipelines")
      .select("id, company, role, stage, stage_detail, prep_json, insights_json, created_at, updated_at, last_email_at")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (pErr) {
      return NextResponse.json({ error: `pipelines query failed: ${pErr.message}` })
    }

    // Get email count
    const { data: emails, error: eErr } = await supabaseAdmin
      .from("emails")
      .select("id, pipeline_id, subject, from_email, is_recruiting, created_at")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(30)

    // Check which tables exist
    const tables: Record<string, boolean> = {}
    for (const t of ["pipelines", "emails", "email_processing_log", "sync_runs"]) {
      const { error } = await supabaseAdmin.from(t).select("id").limit(1)
      tables[t] = !error
    }

    // Get column info for pipelines table
    const { data: cols } = await supabaseAdmin.rpc("get_columns", { table_name: "pipelines" }).catch(() => ({ data: null }))

    const pipelineSummary = (pipelines || []).map((p: any) => ({
      id: p.id,
      company: p.company,
      role: p.role,
      stage: p.stage,
      has_prep_json: !!p.prep_json,
      prep_json_type: p.prep_json === null ? "null" : typeof p.prep_json,
      prep_has_narrative: !!p.prep_json?.narrative,
      prep_has_questions: !!(p.prep_json?.questionsTheyMightAsk?.length || p.prep_json?.questions_they_ask?.length),
      prep_has_primitives: !!(p.prep_json?.primitives?.length),
      prep_keys: p.prep_json ? Object.keys(p.prep_json) : [],
      has_insights: !!p.insights_json,
      updated_at: p.updated_at,
      last_email_at: p.last_email_at,
    }))

    return NextResponse.json({
      user: userEmail,
      tables_exist: tables,
      pipeline_count: (pipelines || []).length,
      email_count: (emails || []).length,
      pipelines: pipelineSummary,
      recent_emails: (emails || []).slice(0, 10).map((e: any) => ({
        subject: e.subject,
        from: e.from_email,
        pipeline_id: e.pipeline_id,
        is_recruiting: e.is_recruiting,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
