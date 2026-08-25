import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { actionsApi, apiErrorMessage } from '../lib/api';

const STATUS_ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  pending:     { name: 'ellipse-outline', color: '#b3812c' },
  in_progress: { name: 'time-outline', color: '#e17c4e' },
  completed:   { name: 'checkmark-circle', color: '#5c7a4a' },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: '#b5432f', medium: '#b3812c', low: '#5c7a4a',
};

function ActionItem({ item, onToggle }: { item: any; onToggle: () => void }) {
  const overdue = item.status === 'pending' && item.deadline && new Date(item.deadline) < new Date();
  const si = STATUS_ICON[item.status] || STATUS_ICON.pending;
  return (
    <View style={[styles.item, overdue && styles.itemOverdue]}>
      <TouchableOpacity onPress={onToggle} style={styles.statusBtn}>
        <Ionicons name={si.name} size={22} color={si.color} />
      </TouchableOpacity>
      <View style={styles.itemBody}>
        <Text style={[styles.title, item.status === 'completed' && styles.titleDone]}>{item.title}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        <View style={styles.metaRow}>
          {item.priority && (
            <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
          )}
          {item.deadline && (
            <Text style={[styles.deadline, overdue && styles.deadlineOverdue]}>
              <Ionicons name="time-outline" size={11} /> {new Date(item.deadline).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ActionsScreen() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const load = useCallback(async () => {
    try {
      const data = await actionsApi.getActions();
      setActions(Array.isArray(data) ? data : data.actions || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load actions'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleToggle = async (action: any) => {
    const newStatus = action.status === 'completed' ? 'pending' : 'completed';
    setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: newStatus } : a));
    try {
      await actionsApi.updateAction(action.id, { status: newStatus });
    } catch (err) {
      setActions(prev => prev.map(a => a.id === action.id ? { ...a, status: action.status } : a));
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Update failed') });
    }
  };

  const filtered = actions.filter(a => filter === 'all' ? true : a.status === filter);
  const pending = actions.filter(a => a.status === 'pending').length;
  const overdue = actions.filter(a => a.status === 'pending' && a.deadline && new Date(a.deadline) < new Date()).length;

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        {overdue > 0 && (
          <View style={[styles.stat, styles.statOverdue]}>
            <Text style={[styles.statNum, { color: '#b5432f' }]}>{overdue}</Text>
            <Text style={[styles.statLabel, { color: '#b5432f' }]}>Overdue</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statNum}>{actions.filter(a => a.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ActionItem item={item} onToggle={() => handleToggle(item)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="checkmark-done-outline" size={48} color="#4a4033" />
              <Text style={styles.emptyText}>No actions</Text>
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
  stats: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  stat: { flex: 1, backgroundColor: '#332b22', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4a4033' },
  statOverdue: { borderColor: '#4a231c', backgroundColor: '#1c0a0a' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#83745e', fontSize: 12, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: '#332b22', alignItems: 'center', borderWidth: 1, borderColor: '#4a4033' },
  filterActive: { backgroundColor: '#5e2a1a', borderColor: '#b04723' },
  filterText: { color: '#83745e', fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: '#e17c4e' },
  item: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#332b22' },
  itemOverdue: { backgroundColor: '#0c0a0a' },
  statusBtn: { marginRight: 12, paddingTop: 2 },
  itemBody: { flex: 1 },
  title: { color: '#e7e0d4', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  titleDone: { color: '#635646', textDecorationLine: 'line-through' },
  desc: { color: '#83745e', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  deadline: { color: '#83745e', fontSize: 12 },
  deadlineOverdue: { color: '#b5432f' },
  errorBox: { margin: 16, backgroundColor: '#332b22', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },
});
