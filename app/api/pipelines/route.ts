import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { DEMO_PIPELINES } from "@/lib/demo-pipelines"

// ─── DEMO MODE ────────────────────────────────────────────────
// Set to true before recording, false when done. No DB is touched.
const DEMO_MODE = false
// ─────────────────────────────────────────────────────────────

// Service role client (bypasses RLS)
const supabase = supabaseAdmin

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ pipelines: DEMO_PIPELINES })
  }
    try {
        if (!supabase) {
            return NextResponse.json({
                error: "NOT_CONFIGURED",
                pipelines: [],
            })
        }

        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
        }

        const userEmail = session.user.email

        // Fetch dismissed thread IDs for this user so we can exclude any pipeline
        // whose thread was dismissed (e.g. duplicate pipelines from same company).
        const { data: dismissedRows } = await supabase
            .from("dismissed_threads")
            .select("gmail_thread_id")
            .eq("user_email", userEmail)

        const dismissedThreadIds = new Set<string>(
            (dismissedRows ?? []).map((r: any) => r.gmail_thread_id).filter(Boolean)
        )

        const { data, error } = await supabase
            .from("pipelines")
            .select("*")
            .eq("user_email", userEmail)
            .order("last_email_at", { ascending: false })

        if (error) {
            console.error("[PIPELINES] Error fetching pipelines:", error)
            return NextResponse.json({
                error: "FETCH_ERROR",
                message: error.message,
                pipelines: [],
            }, { status: 500 })
        }

        // Filter out any pipeline whose primary thread was dismissed.
        // This is the safety net: if a duplicate pipeline survived deletion
        // (e.g. different thread, same company), it won't show in the UI.
        const pipelines = (data ?? []).filter(
            (p: any) => !p.gmail_thread_id || !dismissedThreadIds.has(p.gmail_thread_id)
        )

        return NextResponse.json({
            pipelines,
        })

    } catch (err: any) {
        console.error("[PIPELINES] Error:", err)
        return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
    }
}
