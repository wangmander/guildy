import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create client only if env vars are available (prevents build-time errors)
const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export async function GET() {
    try {
        if (!supabase) {
            return NextResponse.json({
                error: "NOT_CONFIGURED",
                lastSync: null,
                recentRuns: [],
                totals: { detected: 0, rejected: 0, errors: 0 },
            })
        }

        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
        }

        const userEmail = session.user.email

        // Get the last 5 sync runs
        const { data: syncRuns, error: syncError } = await supabase
            .from("sync_runs")
            .select("*")
            .eq("user_email", userEmail)
            .order("started_at", { ascending: false })
            .limit(5)

        if (syncError) {
            console.error("[SYNC_STATUS] Error fetching sync_runs:", syncError)
            // Return empty if table doesn't exist yet
            return NextResponse.json({
                lastSync: null,
                recentRuns: [],
                totals: { detected: 0, rejected: 0, errors: 0 },
            })
        }

        // Get recent processing log stats (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { data: recentLogs, error: logError } = await supabase
            .from("email_processing_log")
            .select("detected, rejection_reason, action_taken")
            .eq("user_email", userEmail)
            .gte("created_at", oneDayAgo)

        let totals = { detected: 0, rejected: 0, errors: 0 }

        if (!logError && recentLogs) {
            totals = {
                detected: recentLogs.filter(l => l.detected).length,
                rejected: recentLogs.filter(l => !l.detected && l.action_taken === "rejected").length,
                errors: recentLogs.filter(l => l.action_taken === "error").length,
            }
        }

        const lastRun = syncRuns?.[0] || null

        return NextResponse.json({
            lastSync: lastRun ? {
                id: lastRun.id,
                startedAt: lastRun.started_at,
                completedAt: lastRun.completed_at,
                status: lastRun.status,
                scanned: lastRun.scanned,
                detected: lastRun.detected,
                inserted: lastRun.inserted,
                updated: lastRun.updated,
                skipped: lastRun.skipped,
                rejected: lastRun.rejected,
                errors: lastRun.errors,
                errorMessage: lastRun.error_message,
            } : null,
            recentRuns: (syncRuns || []).map(r => ({
                id: r.id,
                startedAt: r.started_at,
                status: r.status,
                scanned: r.scanned,
                detected: r.detected,
            })),
            totals,
        })

    } catch (err: any) {
        console.error("[SYNC_STATUS] Error:", err)
        return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
    }
}
