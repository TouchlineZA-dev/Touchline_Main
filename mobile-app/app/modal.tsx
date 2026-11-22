import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { supabase } from '@/src/lib/auth/supabaseClient';
import { Brand, Fonts } from '@/src/theme/design';

type Mode = 'start' | 'login' | 'register';
type OAuthProvider = 'google' | 'apple' | 'facebook';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const { user, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('start');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const oauth = async (provider: OAuthProvider) => {
    setMessage(null);
    if (Platform.OS !== 'web') {
      setMessage({ text: 'Social sign-in is available on web for now. Use email to log in.', error: true });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setMessage({ text: error.message, error: true });
  };

  const submit = async () => {
    if (mode === 'start') {
      setMode('login');
      return;
    }
    if (!email || !password) {
      setMessage({ text: 'Please enter your email and password.', error: true });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setMessage({ text: error.message, error: true });
        else close();
      } else {
        const { error } = await signUp(email, password, username || undefined);
        if (error) setMessage({ text: error.message, error: true });
        else {
          setMessage({ text: 'Account created. Check your email to confirm, then log in.', error: false });
          setMode('login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
        {/* Green hero with curved bottom */}
        <View style={styles.heroClip}>
          <View style={[styles.hero, { paddingTop: Math.max(insets.top, 16) + 24 }]}>
            <TouchableOpacity style={[styles.closeButton, { top: Math.max(insets.top, 16) }]} onPress={close}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.logoWrap}>
              <View style={styles.swoosh} />
              <MaterialCommunityIcons name="soccer" size={84} color="#F4F4F4" />
              <Ionicons name="star" size={12} color="#F4F4F4" style={styles.logoStar} />
            </View>
            <Text style={styles.brand}>TOUCHLINE SA</Text>
            <Text style={styles.tagline}>Bringing Soccer Back to{'\n'}South Africa</Text>
          </View>
        </View>

        <View style={styles.body}>
          {user ? (
            <>
              <Text style={styles.signedInText}>Signed in as</Text>
              <Text style={styles.signedInEmail}>{user.email}</Text>
              <TouchableOpacity style={styles.loginButton} onPress={close}>
                <Text style={styles.loginText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => signOut()}>
                <Text style={styles.footerText}>
                  Not you? <Text style={styles.footerLink}>Sign Out</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {mode === 'start' ? (
                <>
                  <PillButton label="Google Account" onPress={() => oauth('google')} />
                  <PillButton label="Apple Account" onPress={() => oauth('apple')} />
                  <PillButton label="Facebook Account" onPress={() => oauth('facebook')} />
                </>
              ) : (
                <>
                  {mode === 'register' && (
                    <PillInput placeholder="Username" value={username} onChangeText={setUsername} />
                  )}
                  <PillInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                  <PillInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
                </>
              )}

              {message ? (
                <Text style={[styles.message, message.error ? styles.messageError : styles.messageOk]}>
                  {message.text}
                </Text>
              ) : null}

              <TouchableOpacity style={styles.loginButton} onPress={submit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginText}>{mode === 'register' ? 'Register' : 'Login'}</Text>
                )}
              </TouchableOpacity>

              {mode === 'register' ? (
                <TouchableOpacity onPress={() => { setMode('login'); setMessage(null); }}>
                  <Text style={styles.footerText}>
                    Already have an account? <Text style={styles.footerLink}>Login Here</Text>
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setMode('register'); setMessage(null); }}>
                  <Text style={styles.footerText}>
                    Don’t have an account? <Text style={styles.footerLink}>Register Here</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode !== 'start' && (
                <TouchableOpacity onPress={() => { setMode('start'); setMessage(null); }}>
                  <Text style={[styles.footerText, { marginTop: 10 }]}>Other sign-in options</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

function PillInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={[styles.pill, styles.pillInput]}
      placeholderTextColor="#2E7D46"
      autoCapitalize="none"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flexGrow: 1,
  },
  heroClip: {
    overflow: 'hidden',
    borderBottomLeftRadius: 260,
    borderBottomRightRadius: 260,
    marginHorizontal: -120,
    paddingHorizontal: 120,
    backgroundColor: Brand.green,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 56,
    paddingHorizontal: 16,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    padding: 4,
  },
  logoWrap: {
    width: 150,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  swoosh: {
    position: 'absolute',
    bottom: 10,
    left: 4,
    width: 120,
    height: 40,
    borderBottomWidth: 6,
    borderLeftWidth: 2,
    borderColor: '#1E6B35',
    borderBottomLeftRadius: 60,
    transform: [{ rotate: '-18deg' }],
  },
  logoStar: {
    position: 'absolute',
    left: 22,
    bottom: 18,
  },
  brand: {
    fontFamily: Fonts.display,
    fontSize: 64,
    lineHeight: 68,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tagline: {
    alignSelf: 'flex-end',
    textAlign: 'right',
    fontFamily: Fonts.bodySemi,
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
    marginTop: 8,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 40,
  },
  pill: {
    width: '100%',
    maxWidth: 260,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9C9C9C',
    backgroundColor: '#E7E7E7',
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  pillText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Brand.greenText,
  },
  pillInput: {
    textAlign: 'center',
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Brand.ink,
    paddingVertical: 8,
  },
  loginButton: {
    backgroundColor: Brand.green,
    borderRadius: 24,
    minWidth: 150,
    paddingHorizontal: 28,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  loginText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 24,
    color: '#FFFFFF',
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Brand.ink,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: Fonts.bodySemi,
    color: Brand.greenText,
  },
  message: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  messageError: {
    color: '#B91C1C',
  },
  messageOk: {
    color: Brand.greenText,
  },
  signedInText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Brand.muted,
  },
  signedInEmail: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Brand.ink,
    marginTop: 4,
  },
});
