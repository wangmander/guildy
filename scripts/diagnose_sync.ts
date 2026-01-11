
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local')
const envLocal = fs.readFileSync(envLocalPath, 'utf8')
const envParsed: Record<string, string> = {}
envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        envParsed[key] = value
    }
})

const supabase = createClient(envParsed.NEXT_PUBLIC_SUPABASE_URL!, envParsed.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    console.log("Fetching recent email logs...")

    // Check if table exists first by selecting 1 row
    const { error: checkError } = await supabase.from('email_processing_log').select('id').limit(1)
    if (checkError) {
        console.error("Error accessing email_processing_log:", checkError.message)
        return
    }

    const { data: logs, error } = await supabase
        .from('email_processing_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error("Failed to fetch logs:", error)
        return
    }

    if (!logs || logs.length === 0) {
        console.log("No logs found.")
        return
    }

    console.log(`Found ${logs.length} logs.`)
    console.log("----------------------------------------")

    logs.forEach((log: any) => {
        const status = log.detected ? "✅ MATCH" : "❌ REJECT"
        console.log(`[${new Date(log.created_at).toLocaleTimeString()}] ${status}`)
        console.log(`Subject: ${log.subject}`)
        console.log(`From: ${log.from_email}`)
        console.log(`Score: ${log.score} (Max Hit: ${log.strongest_hit})`)
        console.log(`Reason: ${log.rejection_reason || "N/A"}`)
        if (log.matched_keywords && log.matched_keywords.length > 0) {
            console.log(`Matches: ${JSON.stringify(log.matched_keywords)}`)
        }
        console.log("----------------------------------------")
    })
}

run()
