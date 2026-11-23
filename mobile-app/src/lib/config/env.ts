import { Platform } from 'react-native';

/**
 * Local development defaults.
 *
 * The Touchline API (ASP.NET) listens on http://localhost:5147 and the news service on
 * http://localhost:3000. The Android emulator cannot see the host's "localhost", so it uses
 * 10.0.2.2 instead. On a physical device, set EXPO_PUBLIC_API_BASE_URL (and
 * EXPO_PUBLIC_NEWS_API_BASE_URL) to your machine's LAN IP in .env.
 */
const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const AppConfig = {
  apiBaseUrl: trimSlash(process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:5147/api/v1`),
  newsApiBaseUrl: trimSlash(process.env.EXPO_PUBLIC_NEWS_API_BASE_URL || `http://${devHost}:3000/api`),
  requestTimeoutMs: 20000,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://exyzbdbitrsidompguda.supabase.co',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
};
