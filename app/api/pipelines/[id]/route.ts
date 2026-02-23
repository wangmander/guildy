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
      .select("id, company, gmail_thread_id, user_email")
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
      .select("id, gmail_thread_id")
      .eq("user_email", userEmail)
      .eq("company", pipeline.company)

    const allPipelineIds = new Set<string>()
    const threadIds = new Set<string>()

    for (const p of [pipeline, ...(siblingPipelines ?? [])]) {
      allPipelineIds.add(p.id)
      if (p.gmail_thread_id) threadIds.add(p.gmail_thread_id)
    }

    // Collect all thread IDs from emails linked to any of these pipelines
    const { data: linkedEmails } = await supabase
      .from("emails")
      .select("gmail_thread_id")
      .in("pipeline_id", Array.from(allPipelineIds))
      .not("gmail_thread_id", "is", null)

    for (const row of linkedEmails ?? []) {
      if (row.gmail_thread_id) threadIds.add(row.gmail_thread_id)
    }

    // Insert dismissed thread records — required for suppressing re-creation on resync.
    // If this fails the pipeline delete is aborted so the user can retry.
    if (threadIds.size > 0) {
      const rows = Array.from(threadIds).map((tid) => ({
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

    // Hard delete all sibling pipelines — cascade removes linked emails + stage_history
    const { error: delErr } = await supabase
      .from("pipelines")
      .delete()
      .in("id", Array.from(allPipelineIds))
      .eq("user_email", userEmail)

    if (delErr) {
      console.error("[DELETE] Pipeline delete failed:", delErr.message)
      return NextResponse.json({ error: "DELETE_FAILED", message: delErr.message }, { status: 500 })
    }

    console.log(`[DELETE] Deleted ${allPipelineIds.size} pipeline(s) for "${pipeline.company}". Suppressed ${threadIds.size} threads.`)
    return NextResponse.json({ success: true, deletedPipelines: allPipelineIds.size, suppressedThreads: threadIds.size })

  } catch (err: any) {
    console.error("[DELETE] Exception:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 })
  }
}
