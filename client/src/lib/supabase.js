import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gyyvjswwdhegfqxizdvl.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5eXZqc3d3ZGhlZ2ZxeGl6ZHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODkzNDYsImV4cCI6MjEwNjc2NTM0Nn0.mAQj8lvmvlja0_CdpbzAb5cLeSzL6YKgA3ZeoYzoLVs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
