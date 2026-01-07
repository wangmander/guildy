import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client.
 * 
 * Uses service role key if available (bypasses RLS).
 * Falls back to anon key if service role key not set.
 * 
 * The service role key has full access to your database, so:
 * - NEVER expose this in client code
 * - NEVER log this key
 * - Only use in /app/api/* routes
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Prefer service role key, fall back to anon key
const keyToUse = serviceRoleKey || anonKey

// Create client if we have URL and any key
export const supabaseAdmin: SupabaseClient | null = supabaseUrl && keyToUse
    ? createClient(supabaseUrl, keyToUse, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null

// Helper to check if the admin client is configured
export function isSupabaseAdminConfigured(): boolean {
    return supabaseAdmin !== null
}

// Log which key is being used (for debugging, not the actual key)
if (typeof window === 'undefined') {
    console.log(`[SUPABASE] Using ${serviceRoleKey ? 'service_role' : anonKey ? 'anon' : 'NO'} key`)
}
