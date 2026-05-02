import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { ok: false, error: 'supabase_admin_not_configured' },
      { status: 500 }
    )
  }
  const { error } = await supabaseAdmin.from('user_profiles').select('id').limit(1)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
