import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/env';
import { SecureStorageAdapter } from './secureStorage';

export const supabase = createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey, {
  auth: {
    storage: SecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
