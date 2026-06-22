import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isValidConfig = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-supabase-project-url';

// Browser-safe Supabase client (build-safe fallback)
export const supabase = isValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Server-side admin client (build-safe fallback, bypasses RLS using the service role key)
export const createServerSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  const isServerValid = supabaseUrl && supabaseServiceKey && supabaseUrl !== 'your-supabase-project-url';

  if (!isServerValid) {
    console.warn('Supabase URL or Service Key is missing. Admin database actions will be disabled.');
    return null as any;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
};
