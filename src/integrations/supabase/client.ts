import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Hapus ini dari client-side

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable.');
}
// if (!supabaseServiceRoleKey) { // Hapus ini dari client-side
//   throw new Error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable.');
// }

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Hapus ekspor supabaseAdmin dari client-side karena tidak aman
// export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false,
//   },
// });