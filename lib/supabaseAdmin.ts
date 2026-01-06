import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client using service role key.
 * This bypasses RLS and should ONLY be used in server-side code (API routes).
 * 
 * REQUIRED ENV VAR: SUPABASE_SERVICE_ROLE_KEY
 * 
 * The service role key has full access to your database, so:
 * - NEVER expose this in client code
 * - NEVER log this key
 * - Only use in /app/api/* routes
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Create service role client only if env vars are available
export const supabaseAdmin: SupabaseClient | null = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
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
