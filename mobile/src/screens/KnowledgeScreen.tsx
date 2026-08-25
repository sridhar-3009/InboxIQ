import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { knowledgeApi, apiErrorMessage } from '../lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  product: '#6366f1',
  pricing: '#5c7a4a',
  process: '#b3812c',
  contact: '#e17c4e',
  preference: '#93a06a',
};

function KnowledgeItem({ item, onDelete }: { item: any; onDelete: () => void }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        {item.category && (
          <View style={[styles.catBadge, { backgroundColor: (CATEGORY_COLORS[item.category] || '#83745e') + '20' }]}>
            <Text style={[styles.catText, { color: CATEGORY_COLORS[item.category] || '#a99b83' }]}>{item.category}</Text>
          </View>
        )}
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color="#83745e" />
        </TouchableOpacity>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {item.source_email_subject && (
        <Text style={styles.source} numberOfLines={1}>From: {item.source_email_subject}</Text>
      )}
    </View>
  );
}

export default function KnowledgeScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (q?: string) => {
    try {
      const data = await knowledgeApi.getAll(q ? { search: q } : undefined);
      setEntries(Array.isArray(data) ? data : data.entries || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load knowledge'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Delete this knowledge entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await knowledgeApi.deleteEntry(id);
            setEntries(prev => prev.filter(e => e.id !== id));
          } catch (err) {
            Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Delete failed') });
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#83745e" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search knowledge..."
          placeholderTextColor="#83745e"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#83745e" /></TouchableOpacity> : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <KnowledgeItem item={item} onDelete={() => handleDelete(item.id)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(search); }} tintColor="#e17c4e" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="library-outline" size={48} color="#4a4033" />
              <Text style={styles.emptyText}>No knowledge entries</Text>
            </View>
          }
        />
      )}
    </View>
  );
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
  item: { padding: 14, marginHorizontal: 16, marginVertical: 6, backgroundColor: '#332b22', borderRadius: 14, borderWidth: 1, borderColor: '#4a4033' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  catText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  deleteBtn: { padding: 4 },
  content: { color: '#e7e0d4', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  source: { color: '#635646', fontSize: 12 },
  errorBox: { margin: 16, backgroundColor: '#332b22', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },
});
