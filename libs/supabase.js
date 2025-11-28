import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Lazy browser client - created on first use
let _supabase = null

export const supabase = new Proxy({}, {
  get: function(target, prop) {
    // Create client on first access if in browser
    if (typeof window !== 'undefined' && !_supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!url || !key) {
        console.error('Missing Supabase environment variables')
        return undefined
      }
      
      _supabase = createBrowserClient(url, key)
    }
    
    // Return the method/property from the real client
    return _supabase?.[prop]
  }
})

// Server/Admin client for API routes
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Legacy export
export const supabaseAdmin = getSupabaseAdmin()
