import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { notificationsApi, apiErrorMessage } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mention: 'at-outline',
  reply: 'arrow-undo-outline',
  debt: 'time-outline',
  billing: 'card-outline',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { notifications } = await notificationsApi.list();
      setItems(notifications || []);
      if ((notifications || []).some((n: any) => !n.is_read)) {
        await notificationsApi.markAllRead();
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load notifications') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLink = (link: string | null) => {
    if (!link) return;
    const emailMatch = link.match(/^\/email\/([^/?]+)/);
    if (emailMatch) {
      navigation.navigate('EmailDetail', { emailId: emailMatch[1] });
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.is_read && styles.rowUnread]}
            onPress={() => openLink(item.link)}
            activeOpacity={item.link ? 0.7 : 1}
          >
            <View style={styles.iconBox}>
              <Ionicons name={TYPE_ICON[item.type] || 'notifications-outline'} size={18} color="#e17c4e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
              <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="notifications-outline" size={48} color="#4a4033" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#635646', marginTop: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#332b22' },
  rowUnread: { backgroundColor: '#2a2119' },
  iconBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4a231c', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { color: '#e7e0d4', fontSize: 14, fontWeight: '600' },
  body: { color: '#a99b83', fontSize: 13, marginTop: 2 },
  date: { color: '#635646', fontSize: 11, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e17c4e', marginLeft: 8, marginTop: 6 },
});
