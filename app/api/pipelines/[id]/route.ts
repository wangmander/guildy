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
      .select("id, gmail_thread_id, user_email")
      .eq("id", pipelineId)
      .eq("user_email", userEmail)
      .maybeSingle()

    if (fetchErr || !pipeline) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    // Collect ALL thread IDs linked to this pipeline so we can suppress them all.
    // A single pipeline can accumulate multiple threads from the same company.
    const threadIds = new Set<string>()
    if (pipeline.gmail_thread_id) threadIds.add(pipeline.gmail_thread_id)

    const { data: linkedEmails } = await supabase
      .from("emails")
      .select("gmail_thread_id")
      .eq("pipeline_id", pipelineId)
      .not("gmail_thread_id", "is", null)

    for (const row of linkedEmails ?? []) {
      if (row.gmail_thread_id) threadIds.add(row.gmail_thread_id)
    }

    // Insert dismissed thread records — non-fatal if table doesn't exist yet
    if (threadIds.size > 0) {
      try {
        const rows = Array.from(threadIds).map((tid) => ({
          user_email: userEmail,
          gmail_thread_id: tid,
        }))
        await supabase
          .from("dismissed_threads")
          .upsert(rows, { onConflict: "user_email,gmail_thread_id" })
      } catch (e) {
        console.warn("[DELETE] dismissed_threads upsert failed (table may not exist yet):", e)
      }
    }

    // Hard delete — cascade removes linked emails + stage_history
    const { error: delErr } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", pipelineId)
      .eq("user_email", userEmail)

    if (delErr) {
      console.error("[DELETE] Pipeline delete failed:", delErr.message)
      return NextResponse.json({ error: "DELETE_FAILED", message: delErr.message }, { status: 500 })
    }

    console.log(`[DELETE] Pipeline ${pipelineId} deleted. Suppressed ${threadIds.size} threads.`)
    return NextResponse.json({ success: true, suppressedThreads: threadIds.size })

  } catch (err: any) {
    console.error("[DELETE] Exception:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 })
  }
}
