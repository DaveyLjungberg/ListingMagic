import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client - uses @supabase/ssr for proper cookie handling
let _supabase = null

export const supabase = (() => {
  return new Proxy({}, {
    get(target, prop) {
      if (!_supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!url || !key) {
          if (typeof window === 'undefined') {
            return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
          }
          throw new Error('Missing Supabase environment variables')
        }

        // Use createBrowserClient for proper cookie handling in Next.js
        _supabase = createBrowserClient(url, key)
      }

      const value = _supabase[prop]
      return typeof value === 'function' ? value.bind(_supabase) : value
    }
  })
})()

// Server/Admin client - uses service_role key
let _supabaseAdmin = null

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables')
    }

    _supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return _supabaseAdmin
}

export const supabaseAdmin = new Proxy({}, {
  get(target, prop) {
    const admin = getSupabaseAdmin()
    const value = admin[prop]
    return typeof value === 'function' ? value.bind(admin) : value
  }
})
