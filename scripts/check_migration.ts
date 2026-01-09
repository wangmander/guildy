
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local')
const envLocal = fs.readFileSync(envLocalPath, 'utf8')

// Simple manual parser
const envParsed: Record<string, string> = {}
envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1)
        }
        envParsed[key] = value
    }
})

const supabaseUrl = envParsed.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envParsed.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env.local")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
    console.log("Checking for predicted_stages column...")

    // Try to select the column from a single row
    const { data, error } = await supabase
        .from('pipelines')
        .select('predicted_stages')
        .limit(1)

    if (error) {
        console.error("Error selecting predicted_stages:", error.message)
        if (error.message.includes("does not exist")) {
            console.log("MIGRATION_MISSING")
        } else {
            console.log("UNKNOWN_ERROR")
        }
    } else {
        console.log("MIGRATION_PRESENT")
    }
}

check()
