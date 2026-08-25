import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ scheme: 'mailair', path: 'auth/callback' });

async function createSessionFromUrl(url: string) {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams as Record<string, string> | undefined;
  const access_token = params?.access_token;
  const refresh_token = params?.refresh_token;
  if (!access_token || !refresh_token) return;
  await supabase.auth.setSession({ access_token, refresh_token });
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('access_token')) createSessionFromUrl(url);
    });
    return () => sub.remove();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert('Error', 'Email and password required'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('Sign in failed', error.message);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) {
          Alert.alert('Sign up failed', error.message);
        } else {
          Alert.alert(
            'Check your email',
            `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`,
          );
          setMode('signin');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) { Alert.alert('Google sign in failed', error.message); return; }
      if (!data.url) return;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
      }
    } catch {
      Alert.alert('Error', 'Google sign in failed. Try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Mail<Text style={styles.logoBlue}>air</Text></Text>
          <Text style={styles.subtitle}>AI-powered email management</Text>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#83745e"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#83745e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleAuth}
          />

          <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.toggle}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#221c16' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  logo: { fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  logoBlue: { color: '#e17c4e' },
  subtitle: { color: '#83745e', textAlign: 'center', marginBottom: 32, fontSize: 15 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#332b22', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#4a4033', marginBottom: 16,
  },
  googleIcon: { color: '#ea4335', fontWeight: '900', fontSize: 18 },
  googleText: { color: '#e7e0d4', fontWeight: '600', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#332b22' },
  dividerText: { color: '#635646', fontSize: 13 },
  input: {
    backgroundColor: '#332b22', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#4a4033',
  },
  btn: {
    backgroundColor: '#b04723', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  toggle: { color: '#e17c4e', textAlign: 'center', fontSize: 14 },
});
