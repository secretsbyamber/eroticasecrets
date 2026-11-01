
const SUPABASE_URL = "https://peagrwvpnxkyphnfweon.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QTUI0u22tUywU6PRQWl6mQ_B0bXghOl";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
