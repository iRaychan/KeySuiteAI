// KeySuite V1.00 secure connection settings.
// The Supabase project URL and publishable/anon key are safe to use in a browser
// only when Row Level Security is correctly enabled.
// NEVER put the service_role key or any secret key in this file.
window.KEYSUITE_CONFIG = {
  supabaseUrl: 'https://skidqdixnnnuhvarekxp.supabase.co',
  supabaseAnonKey: 'sb_publishable_IMqGmdbpVNgqklFyv_2XHQ_1ypRijIA',
  // V4.17.01: Supabase invitation / password reset emails always
  // return to the live KeySuite site, even when testing on localhost.
  authRedirectUrl: 'https://iraychan.github.io/KeySuite/'
};
