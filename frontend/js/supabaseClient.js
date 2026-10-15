/**
 * ============================================================================
 * FRONTEND SUPABASE CLIENT MODULE
 * ============================================================================
 * ARCHITECTURAL ROLE:
 * Connects the browser client to Supabase using the PUBLIC Anon Key.
 * Row Level Security (RLS) protects data access.
 *
 * Notice: The backend has its own separate Supabase service which can use the
 * private Service Role Key for server-side persistence.
 * ============================================================================
 */

let supabaseInstance = null;
let envConfig = {
  supabaseUrl: window.__ENV__?.SUPABASE_URL || '',
  supabaseAnonKey: window.__ENV__?.SUPABASE_ANON_KEY || '',
  backendApiUrl: window.__ENV__?.BACKEND_API_URL || 'http://localhost:5000'
};

/**
 * Loads configuration from backend /api/config/public if not yet present in window.__ENV__.
 */
export async function initConfig() {
  if (!envConfig.supabaseUrl || !envConfig.supabaseAnonKey) {
    try {
      const res = await fetch('/api/config/public');
      if (res.ok) {
        const data = await res.json();
        envConfig.supabaseUrl = data.supabaseUrl || envConfig.supabaseUrl;
        envConfig.supabaseAnonKey = data.supabaseAnonKey || envConfig.supabaseAnonKey;
        envConfig.backendApiUrl = data.backendApiUrl || envConfig.backendApiUrl;
      }
    } catch (err) {
      console.warn('[Frontend Supabase] Could not fetch public config from backend:', err);
    }
  }
  return envConfig;
}

/**
 * Retrieves or initializes the frontend Supabase client.
 */
export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  await initConfig();

  const url = envConfig.supabaseUrl;
  const key = envConfig.supabaseAnonKey;

  if (url && key && url.startsWith('http') && !url.includes('your-project-ref')) {
    try {
      // Dynamic import from CDN ESM
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch (err) {
      console.warn('[Frontend Supabase] Failed to initialize client:', err);
      return null;
    }
  }
  return null;
}

/**
 * Tests connection to Supabase from the browser.
 */
export async function testSupabaseConnection() {
  const client = await getSupabase();
  if (!client) {
    return {
      connected: false,
      message: 'Supabase credentials missing or invalid in frontend/.env'
    };
  }

  try {
    const { data, error } = await client.from('chats').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          connected: true,
          tablesMissing: true,
          message: 'Connected to Supabase, but "chats" table is missing. Run supabase_schema.sql in SQL Editor.'
        };
      }
      return { connected: false, message: error.message };
    }
    return { connected: true, message: 'Connected to Supabase from frontend successfully!' };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

export function getPublicConfig() {
  return envConfig;
}
