
const SUPABASE_URL = "https://peagrwvpnxkyphnfweon.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_EXISTING_PUBLISHABLE_KEY";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
