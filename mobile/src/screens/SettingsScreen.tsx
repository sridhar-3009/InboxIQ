import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { settingsApi, apiErrorMessage } from '../lib/api';

export default function SettingsScreen() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editName, setEditName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email || '');
    });
    settingsApi.getProfile()
      .then(p => setDisplayName(p.display_name || p.full_name || ''))
      .catch(() => {});
  }, []);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await settingsApi.updateProfile({ display_name: displayName });
      Toast.show({ type: 'success', text1: 'Name updated' });
      setEditName(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Update failed') });
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          setSignOutLoading(true);
          await supabase.auth.signOut();
          setSignOutLoading(false);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(displayName || email || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            <Text style={styles.profileSub}>Signed in via Supabase</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.fieldLabel}>Display Name</Text>
        {editName ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#635646"
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName} disabled={savingName}>
              {savingName ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditName(false)}>
              <Ionicons name="close" size={18} color="#83745e" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.fieldRow} onPress={() => setEditName(true)}>
            <Text style={styles.fieldValue}>{displayName || 'Tap to set name'}</Text>
            <Ionicons name="pencil-outline" size={16} color="#635646" />
          </TouchableOpacity>
        )}
      </View>

      {/* App info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>React Native / Expo</Text>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signoutBtn} onPress={handleSignOut} disabled={signOutLoading}>
        {signOutLoading
          ? <ActivityIndicator color="#b5432f" size="small" />
          : <>
              <Ionicons name="log-out-outline" size={18} color="#b5432f" />
              <Text style={styles.signoutText}>Sign Out</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#332b22', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#4a4033', marginBottom: 16 },
  cardTitle: { color: '#83745e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#5e2a1a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#e17c4e', fontWeight: '800', fontSize: 20 },
  profileInfo: { flex: 1 },
  profileEmail: { color: '#e7e0d4', fontSize: 14, fontWeight: '600' },
  profileSub: { color: '#635646', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#221c16', marginVertical: 12 },
  fieldLabel: { color: '#83745e', fontSize: 12, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { color: '#d3c7b4', fontSize: 15 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, backgroundColor: '#221c16', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#4a4033' },
  saveBtn: { backgroundColor: '#b04723', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn: { padding: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: '#83745e', fontSize: 14 },
  infoValue: { color: '#a99b83', fontSize: 14 },
  signoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#332b22', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#3a1c14',
  },
  signoutText: { color: '#b5432f', fontWeight: '700', fontSize: 15 },
});
