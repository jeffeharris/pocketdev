import { createClient } from '@supabase/supabase-js';

// For local development, we'll use mock data
// Replace these with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For local testing without Supabase, we can use mock data
export const useMockData = !import.meta.env.VITE_SUPABASE_URL;