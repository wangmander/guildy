
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
        }

        const { data: logs, error } = await supabaseAdmin
            .from('email_processing_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            // Table might not exist — return empty logs instead of crashing
            if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
                return NextResponse.json({ logs: [] })
            }
            return NextResponse.json({ error: `DB Error: ${error.message} (${error.code})` }, { status: 500 })
        }

        return NextResponse.json({ logs: logs || [] })
    } catch (err: any) {
        return NextResponse.json({ logs: [] })
    }
}
