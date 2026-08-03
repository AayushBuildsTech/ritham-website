/* ─────────────────────────────────────────────────────────────
   Ritham puja — public config.
   The anon key is a PUBLIC key (safe to ship) — all access is
   enforced server-side by Supabase Row Level Security.
   ───────────────────────────────────────────────────────────── */
window.RITHAM_SUPABASE = {
  url: 'https://eaxdqizerkuqkujxacru.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheGRxaXplcmt1cWt1anhhY3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTU2MjksImV4cCI6MjA5ODQ5MTYyOX0.TB2A8e_7sl1rhH7aRi3QVJ5Q-QMgNlHnygK9TAiSFzI'
};

// Payments. Flip `live` to true ONLY after the sawan-create-order /
// sawan-verify-payment edge functions are deployed (and migration 032 applied).
// While false, checkout runs the TEST simulator (no real charge).
window.RITHAM_PAY = {
  live: true
};
