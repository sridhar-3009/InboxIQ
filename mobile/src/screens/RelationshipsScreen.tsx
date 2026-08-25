import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { relationshipsApi, apiErrorMessage } from '../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

function firstName(name: string): string {
  return (name || '').split(' ')[0] || name;
}

function EmailDebtWidget({ debts, onPress }: { debts: any[]; onPress: (emailId: string) => void }) {
  if (!debts.length) return null;
  const top = debts.slice(0, 5);
  return (
    <View style={styles.debtCard}>
      <View style={styles.debtHeaderRow}>
        <Ionicons name="time-outline" size={16} color="#e17c4e" />
        <Text style={styles.debtTitle}>You owe these people a reply</Text>
      </View>
      <Text style={styles.debtSub}>Oldest un-replied emails that still need you.</Text>
      {top.map((d) => (
        <TouchableOpacity key={d.email_id} style={styles.debtRow} onPress={() => onPress(d.email_id)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.debtName} numberOfLines={1}>{firstName(d.contact_name)}</Text>
            <Text style={styles.debtSubject} numberOfLines={1}>{d.subject}</Text>
          </View>
          <Text style={[styles.debtBadge, d.days_owed >= 7 ? styles.debtBadgeUrgent : styles.debtBadgeWarning]}>
            {d.days_owed}d owed
          </Text>
        </TouchableOpacity>
      ))}
      {debts.length > top.length && (
        <Text style={styles.debtMore}>+{debts.length - top.length} more waiting on you</Text>
      )}
    </View>
  );
}

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return '#5c7a4a';
  if (score >= 40) return '#b3812c';
  return '#b5432f';
};

function ContactRow({ item, onPress }: { item: any; onPress: () => void }) {
  const score = item.relationship_score ?? 0;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: avatarColor(item.contact_email) }]}>
        <Text style={styles.avatarText}>{(item.contact_name || item.contact_email || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.contact_name || item.contact_email}</Text>
        <Text style={styles.email} numberOfLines={1}>{item.contact_email}</Text>
        {item.last_interaction && (
          <Text style={styles.last}>Last: {new Date(item.last_interaction).toLocaleDateString()}</Text>
        )}
      </View>
      <View style={styles.scoreBox}>
        <Text style={[styles.score, { color: SCORE_COLOR(score) }]}>{score}</Text>
        <Text style={styles.scoreLabel}>score</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RelationshipsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [contacts, setContacts] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await relationshipsApi.getAll();
      setContacts(Array.isArray(data) ? data : data.contacts || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load relationships'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    try {
      const { debts } = await relationshipsApi.getDebt();
      setDebts(debts || []);
    } catch {
      // non-critical widget, fail silently
    }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = contacts.filter(c =>
    !search ||
    (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#83745e" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#83745e"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#83745e" /></TouchableOpacity> : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.contact_email}
          ListHeaderComponent={
            <EmailDebtWidget
              debts={debts}
              onPress={(emailId) => navigation.navigate('EmailDetail', { emailId })}
            />
          }
          renderItem={({ item }) => (
            <ContactRow
              item={item}
              onPress={() => navigation.navigate('ContactDetail', {
                contactEmail: item.contact_email,
                contactName: item.contact_name || item.contact_email,
              })}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color="#4a4033" />
              <Text style={styles.emptyText}>No contacts yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function avatarColor(str: string) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#332b22',
    marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#4a4033',
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#332b22' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  name: { color: '#e7e0d4', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  email: { color: '#83745e', fontSize: 12, marginBottom: 2 },
  last: { color: '#635646', fontSize: 11 },
  scoreBox: { alignItems: 'center', minWidth: 44 },
  score: { fontSize: 20, fontWeight: '800' },
  scoreLabel: { color: '#635646', fontSize: 10 },
  errorBox: { margin: 16, backgroundColor: '#332b22', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },

  debtCard: { backgroundColor: '#332b22', borderRadius: 16, borderWidth: 1, borderColor: '#4a4033', marginHorizontal: 16, marginTop: 10, marginBottom: 6, padding: 16 },
  debtHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  debtTitle: { color: '#e7e0d4', fontSize: 15, fontWeight: '700' },
  debtSub: { color: '#83745e', fontSize: 12, marginBottom: 12 },
  debtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: '#4a4033', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  debtName: { color: '#e7e0d4', fontSize: 13, fontWeight: '600' },
  debtSubject: { color: '#83745e', fontSize: 12, marginTop: 1 },
  debtBadge: { fontSize: 11, fontWeight: '700', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  debtBadgeUrgent: { color: '#e0a89a', backgroundColor: '#4a231c', borderWidth: 1, borderColor: '#b5432f' },
  debtBadgeWarning: { color: '#e0c48a', backgroundColor: '#3a1c14', borderWidth: 1, borderColor: '#b3812c' },
  debtMore: { color: '#635646', fontSize: 11, marginTop: 2 },
});
