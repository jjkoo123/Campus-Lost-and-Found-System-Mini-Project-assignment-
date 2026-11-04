// =====================================================
// Supabase client (shared by every page)
// Get these 2 values from: Supabase Dashboard > Project Settings > API
// The "anon public" key is safe to put in the browser - RLS protects the data.
// =====================================================
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

// "supabase" comes from the CDN script loaded before this file.
// We call our client "sb" so it does not clash with that name.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
