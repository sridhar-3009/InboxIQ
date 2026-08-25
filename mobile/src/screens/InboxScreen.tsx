import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { emailsApi, apiErrorMessage } from '../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'needs_response', label: 'Needs Reply' },
  { key: 'follow_up', label: 'Follow Up' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: '#b5432f',
  medium: '#b3812c',
  low: '#5c7a4a',
};

function EmailItem({ item, onPress }: { item: any; onPress: () => void }) {
  const priority = item.ai_analysis?.priority_level;
  const unread = !item.is_read;
  return (
    <TouchableOpacity style={[styles.emailItem, unread && styles.emailUnread]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.emailLeft}>
        <View style={[styles.avatar, { backgroundColor: stringToColor(item.from_name || item.from_email) }]}>
          <Text style={styles.avatarText}>{(item.from_name || item.from_email || '?')[0].toUpperCase()}</Text>
        </View>
        {priority && <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[priority] }]} />}
      </View>
      <View style={styles.emailBody}>
        <View style={styles.emailHeader}>
          <Text style={[styles.sender, unread && styles.senderBold]} numberOfLines={1}>{item.from_name || item.from_email}</Text>
          <Text style={styles.time}>{formatTime(item.received_at)}</Text>
        </View>
        <Text style={[styles.subject, unread && styles.subjectBold]} numberOfLines={1}>{item.subject}</Text>
        <Text style={styles.snippet} numberOfLines={1}>{item.ai_analysis?.summary || item.snippet}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (cat = category, q = search) => {
    try {
      const data = await emailsApi.getEmails({ category: cat || undefined, search: q || undefined });
      setEmails(data.emails || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load emails'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, search]);

  useEffect(() => { load(); }, [category]);

  useEffect(() => {
    const t = setTimeout(() => load(category, search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color="#e17c4e" size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#83745e" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search emails..."
          placeholderTextColor="#83745e"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#83745e" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={i => i.key}
        style={styles.tabs}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, category === item.key && styles.tabActive]}
            onPress={() => setCategory(item.key)}>
            <Text style={[styles.tabText, category === item.key && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={emails}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <EmailItem item={item} onPress={() => navigation.navigate('EmailDetail', { emailId: item.id })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e17c4e" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="mail-outline" size={48} color="#4a4033" />
              <Text style={styles.emptyText}>No emails</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function stringToColor(str: string) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#3b82f6','#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#332b22',
    marginHorizontal: 16, marginTop: 8, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#4a4033',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  tabs: { maxHeight: 48, marginTop: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#332b22', borderWidth: 1, borderColor: '#4a4033',
  },
  tabActive: { backgroundColor: '#b04723', borderColor: '#b04723' },
  tabText: { color: '#a99b83', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  emailItem: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#332b22',
  },
  emailUnread: { backgroundColor: '#221c16' },
  emailLeft: { marginRight: 12, alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  priorityDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  emailBody: { flex: 1 },
  emailHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  sender: { color: '#a99b83', fontSize: 14, flex: 1, marginRight: 8 },
  senderBold: { color: '#fff', fontWeight: '700' },
  time: { color: '#635646', fontSize: 12 },
  subject: { color: '#a99b83', fontSize: 14, marginBottom: 2 },
  subjectBold: { color: '#e7e0d4', fontWeight: '600' },
  snippet: { color: '#635646', fontSize: 13 },
  errorBox: { margin: 16, backgroundColor: '#332b22', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },
});
