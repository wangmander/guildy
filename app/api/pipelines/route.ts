import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { DEMO_PIPELINES } from "@/lib/demo-pipelines"

// ─── DEMO MODE ────────────────────────────────────────────────
// Set to true before recording, false when done. No DB is touched.
const DEMO_MODE = true
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

        return NextResponse.json({
            pipelines: data ?? [],
        })

    } catch (err: any) {
        console.error("[PIPELINES] Error:", err)
        return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
    }
}
