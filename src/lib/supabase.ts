import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jdkpdvaexwbmnoggkleh.supabase.co';

const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3BkdmFleHdibW5vZ2drbGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTA5MzYsImV4cCI6MjA5NzA2NjkzNn0.lDKDkXIsZL6j_TOA6xOM7h2m1REihqzvU6YgDwhdhro';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);