import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { AppConfig } from '../config/env';
import { SecureStorageAdapter } from './secureStorage';

export const supabase = AppConfig.hasSupabaseConfiguration
  ? createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey, {
      auth: {
        storage: SecureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        // Browser OAuth returns the session in the callback URL. Native builds
        // use secure storage and do not parse browser URL fragments.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
