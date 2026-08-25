import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { sequencesApi, apiErrorMessage } from '../lib/api';

function SequenceItem({ item, onDelete, onPress }: { item: any; onDelete: () => void; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemLeft}>
        <View style={styles.iconBox}>
          <Ionicons name="git-branch-outline" size={18} color="#e17c4e" />
        </View>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.steps?.length ?? 0} steps · {item.enrolled_count ?? 0} enrolled</Text>
        {item.created_at && (
          <Text style={styles.date}>Created {new Date(item.created_at).toLocaleDateString()}</Text>
        )}
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#635646" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SequencesScreen() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await sequencesApi.getAll();
      setSequences(Array.isArray(data) ? data : data.sequences || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load sequences'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Sequence', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await sequencesApi.delete(id);
            setSequences(prev => prev.filter(s => s.id !== id));
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
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sequences}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <SequenceItem
              item={item}
              onDelete={() => handleDelete(item.id, item.name)}
              onPress={() => {}}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="git-branch-outline" size={48} color="#4a4033" />
              <Text style={styles.emptyText}>No sequences yet</Text>
              <Text style={styles.emptySub}>Create sequences from the web app</Text>
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
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#332b22' },
  itemLeft: { marginRight: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#5e2a1a', justifyContent: 'center', alignItems: 'center' },
  itemBody: { flex: 1 },
  name: { color: '#e7e0d4', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  meta: { color: '#83745e', fontSize: 13, marginBottom: 2 },
  date: { color: '#635646', fontSize: 11 },
  deleteBtn: { padding: 8 },
  errorBox: { margin: 16, backgroundColor: '#332b22', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },
  emptySub: { color: '#4a4033', fontSize: 13, marginTop: 4 },
});
