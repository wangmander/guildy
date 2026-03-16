import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const supabase = supabaseAdmin

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
    }

    const userEmail = session.user.email
    const pipelineId = params.id

    // Verify ownership
    const { data: pipeline, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id, company, user_email")
      .eq("id", pipelineId)
      .eq("user_email", userEmail)
      .maybeSingle()

    if (fetchErr || !pipeline) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    // Find ALL pipelines for the same company+user (dedup cleanup).
    // If two threads from the same company created duplicate pipelines,
    // dismissing one must also kill the others so they don't reappear.
    const { data: siblingPipelines } = await supabase
      .from("pipelines")
      .select("id")
      .eq("user_email", userEmail)
      .eq("company", pipeline.company)

    const allPipelineIds = new Set<string>()
    for (const p of [pipeline, ...(siblingPipelines ?? [])]) {
      allPipelineIds.add(p.id)
    }

    const allPipelineIdArr = Array.from(allPipelineIds)

    // Collect thread IDs from pipeline_threads table (V3 source of truth)
    const { data: ptThreads } = await supabase
      .from("pipeline_threads")
      .select("gmail_thread_id")
      .in("pipeline_id", allPipelineIdArr)

    // Also collect from emails table (catches any threads not yet in pipeline_threads)
    const { data: emailThreads } = await supabase
      .from("emails")
      .select("gmail_thread_id")
      .in("pipeline_id", allPipelineIdArr)
      .not("gmail_thread_id", "is", null)

    const allThreadIds = new Set<string>([
      ...(ptThreads || []).map((t: any) => t.gmail_thread_id).filter(Boolean),
      ...(emailThreads || []).map((t: any) => t.gmail_thread_id).filter(Boolean),
    ])

    // Insert dismissed thread records — suppresses re-creation on resync.
    // If this fails, abort so the user can retry.
    if (allThreadIds.size > 0) {
      const rows = Array.from(allThreadIds).map((tid) => ({
        user_email: userEmail,
        gmail_thread_id: tid,
      }))
      const { error: dismissErr } = await supabase
        .from("dismissed_threads")
        .upsert(rows, { onConflict: "user_email,gmail_thread_id" })
      if (dismissErr) {
        console.error("[DELETE] dismissed_threads upsert failed:", dismissErr.message)
        return NextResponse.json({ error: "DISMISS_FAILED", message: dismissErr.message }, { status: 500 })
      }
    }

    // Hard delete all sibling pipelines — CASCADE removes:
    // emails, stage_history, pipeline_threads (via FK ON DELETE CASCADE)
    const { error: delErr } = await supabase
      .from("pipelines")
      .delete()
      .in("id", allPipelineIdArr)
      .eq("user_email", userEmail)

    if (delErr) {
      console.error("[DELETE] Pipeline delete failed:", delErr.message)
      return NextResponse.json({ error: "DELETE_FAILED", message: delErr.message }, { status: 500 })
    }

    console.log(`[DELETE] Deleted ${allPipelineIds.size} pipeline(s) for "${pipeline.company}". Suppressed ${allThreadIds.size} threads.`)
    return NextResponse.json({
      success: true,
      deletedPipelines: allPipelineIds.size,
      suppressedThreads: allThreadIds.size,
    })

  } catch (err: any) {
    console.error("[DELETE] Exception:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 })
  }
}
