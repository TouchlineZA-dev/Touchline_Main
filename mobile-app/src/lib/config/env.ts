import { Platform } from 'react-native';

const isReleaseBuild = process.env.NODE_ENV === 'production';
const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const trimSlash = (url: string) => url.replace(/\/+$/, '');
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiBaseUrl || (isReleaseBuild ? '' : `http://${devHost}:5147/api/v1`);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const hasSupabaseConfiguration =
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 0 &&
  !supabaseAnonKey.toLowerCase().includes('placeholder') &&
  !supabaseAnonKey.toLowerCase().includes('your_');

if (isReleaseBuild) {
  const missing: string[] = [];
  if (!configuredApiBaseUrl || !configuredApiBaseUrl.startsWith('https://')) {
    missing.push('EXPO_PUBLIC_API_BASE_URL must be an HTTPS URL');
  }
  if (!hasSupabaseConfiguration) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (missing.length > 0) {
    throw new Error(`Release build configuration is incomplete: ${missing.join('; ')}`);
  }
}

export const AppConfig = {
  apiBaseUrl: trimSlash(apiBaseUrl),
  // Keep the separate news service until the ASP.NET API exposes the central news contract.
  newsApiBaseUrl: trimSlash(process.env.EXPO_PUBLIC_NEWS_API_BASE_URL || `http://${devHost}:3000/api`),
  requestTimeoutMs: 20000,
  supabaseUrl,
  supabaseAnonKey,
  hasSupabaseConfiguration,
};
