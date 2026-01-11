
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        console.log("Fetching debug logs...")

        const { data: logs, error } = await supabaseAdmin
            .from('email_processing_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ logs })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
