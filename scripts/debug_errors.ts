import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
        env[key] = val;
    }
})

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    console.log("Fetching recent errors...")
    const { data, error } = await sb
        .from('email_processing_log')
        .select('user_email, rejection_reason, created_at')
        .eq('action_taken', 'error')
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error("DB Error:", error)
    }
    else console.table(data)
}

run()
