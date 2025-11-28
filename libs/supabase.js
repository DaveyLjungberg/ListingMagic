import { createClient } from "@supabase/supabase-js";

// Browser client - uses anon key, safe for client-side
// Created lazily to avoid issues during SSG/build time
let _supabase = null;

export const supabase = (() => {
  // Return a proxy that lazily initializes the client
  return new Proxy({}, {
    get(target, prop) {
      if (!_supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
          // During build/SSG, return a mock that won't break
          if (typeof window === 'undefined') {
            return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') });
          }
          throw new Error('Missing Supabase environment variables');
        }

        _supabase = createClient(url, key);
      }

      const value = _supabase[prop];
      return typeof value === 'function' ? value.bind(_supabase) : value;
    }
  });
})();

// Server/Admin client - uses service_role key, server-side only
// This should only be used in API routes, not during SSG
let _supabaseAdmin = null;

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase environment variables");
    }

    _supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _supabaseAdmin;
}

// Legacy export for backwards compatibility - lazily initialized
export const supabaseAdmin = new Proxy({}, {
  get(target, prop) {
    const admin = getSupabaseAdmin();
    const value = admin[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  }
});
