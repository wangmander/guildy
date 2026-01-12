
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
        }

        console.log("Fetching debug logs...")

        const { data: logs, error } = await supabaseAdmin
            .from('email_processing_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            console.error("Error fetching logs:", error)
            return NextResponse.json({ error: `DB Error: ${error.message} (${error.code})` }, { status: 500 })
        }

        return NextResponse.json({ logs })
    } catch (err: any) {
        console.error("Exception fetching logs:", err)
        return NextResponse.json({ error: `Exception: ${err.message}` }, { status: 500 })
    }
}
