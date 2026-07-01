import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mvgdkawpxsxlnplpapty.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z2RrYXdweHN4bG5wbHBhcHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDk5MjEsImV4cCI6MjA5NzMyNTkyMX0.K_pUWi7Fgz8Kee4UhQg0L3IFwv70JhNu-GqKzxpgp9o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
