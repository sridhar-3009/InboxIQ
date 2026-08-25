import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { revenueApi, apiErrorMessage } from '../lib/api';

export default function RevenueScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await revenueApi.getSummary();
      setData(d);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load revenue'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await revenueApi.scan();
      Toast.show({ type: 'success', text1: 'Revenue scan started' });
      await load();
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Scan failed') });
    } finally {
      setScanning(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  if (error) return (
    <View style={styles.centered}>
      <Ionicons name="wifi-outline" size={48} color="#4a4033" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
    >
      <TouchableOpacity style={[styles.scanBtn, scanning && styles.btnDisabled]} onPress={handleScan} disabled={scanning}>
        {scanning
          ? <ActivityIndicator color="#fff" size="small" />
          : <><Ionicons name="scan-outline" size={16} color="#fff" /><Text style={styles.scanText}>Scan Emails for Revenue</Text></>
        }
      </TouchableOpacity>

      {data && (
        <>
          <View style={styles.row}>
            <MetricCard label="Total Revenue" value={fmt(data.total_revenue)} color="#5c7a4a" icon="cash-outline" />
            <MetricCard label="This Month" value={fmt(data.monthly_revenue)} color="#e17c4e" icon="calendar-outline" />
          </View>
          <View style={styles.row}>
            <MetricCard label="Pipeline" value={fmt(data.pipeline_value)} color="#93a06a" icon="trending-up-outline" />
            <MetricCard label="Clients" value={data.client_count ?? 0} color="#f97316" icon="people-outline" />
          </View>

          {data.recent_signals?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Revenue Signals</Text>
              {data.recent_signals.map((s: any, i: number) => (
                <View key={i} style={styles.signal}>
                  <View style={[styles.signalDot, { backgroundColor: SIGNAL_COLORS[s.signal_type] || '#83745e' }]} />
                  <View style={styles.signalBody}>
                    <Text style={styles.signalType}>{s.signal_type?.replace(/_/g, ' ')}</Text>
                    {s.amount && <Text style={styles.signalAmount}>{fmt(s.amount)}</Text>}
                  </View>
                  <Text style={styles.signalDate}>{new Date(s.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const SIGNAL_COLORS: Record<string, string> = {
  payment_received: '#5c7a4a',
  invoice_sent: '#e17c4e',
  quote_accepted: '#93a06a',
  new_client: '#f97316',
  renewal: '#b3812c',
};

function fmt(v: number) {
  if (!v) return '₹0';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#b04723', borderRadius: 14, paddingVertical: 13, marginBottom: 20,
  },
  scanText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#332b22', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#4a4033' },
  iconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardValue: { color: '#f3efe8', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  cardLabel: { color: '#83745e', fontSize: 12 },
  section: { backgroundColor: '#332b22', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4a4033', marginTop: 10 },
  sectionTitle: { color: '#a99b83', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  signalDot: { width: 8, height: 8, borderRadius: 4 },
  signalBody: { flex: 1 },
  signalType: { color: '#d3c7b4', fontSize: 13, textTransform: 'capitalize' },
  signalAmount: { color: '#5c7a4a', fontSize: 12, marginTop: 1 },
  signalDate: { color: '#635646', fontSize: 11 },
  errorText: { color: '#b5432f', marginTop: 12, marginBottom: 12, textAlign: 'center' },
  retryBtn: { backgroundColor: '#332b22', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
});
