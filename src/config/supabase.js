import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let supabaseClient = null;
let isConfigured = false;

if (
  ENV.SUPABASE_URL &&
  ENV.SUPABASE_URL !== 'https://your-project.supabase.co' &&
  ENV.SUPABASE_SERVICE_ROLE_KEY &&
  ENV.SUPABASE_SERVICE_ROLE_KEY !== 'your-supabase-service-role-key'
) {
  try {
    supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    isConfigured = true;
    console.log('✅ Supabase connected with Service Role key');
  } catch (err) {
    console.error('⚠️ Failed to initialize Supabase client:', err.message);
  }
} else {
  console.warn('⚠️ Supabase credentials not set or using placeholder in .env. Initializing in dev memory mode with seed data.');
}

export { supabaseClient as supabase, isConfigured };
