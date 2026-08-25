import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { slaApi, apiErrorMessage } from '../lib/api';

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function SLAScreen() {
  const [status, setStatus] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([slaApi.getStatus(), slaApi.getConfigs()]);
      setStatus(s);
      setConfigs(Array.isArray(c) ? c : c.configs || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load SLA data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>;

  if (error) return (
    <View style={styles.centered}>
      <Ionicons name="wifi-outline" size={48} color="#4a4033" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
    </View>
  );

  const compliance = Math.round((status?.compliance_rate ?? 0) * 100);
  const complianceColor = compliance >= 90 ? '#5c7a4a' : compliance >= 70 ? '#b3812c' : '#b5432f';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#e17c4e" />}
    >
      {/* Compliance card */}
      <View style={[styles.complianceCard, { borderColor: complianceColor + '60' }]}>
        <Text style={[styles.compliancePct, { color: complianceColor }]}>{compliance}%</Text>
        <Text style={styles.complianceLabel}>SLA Compliance</Text>
        <ProgressBar value={compliance} color={complianceColor} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{Math.round(status?.avg_response_hours ?? 0)}h</Text>
          <Text style={styles.statLabel}>Avg Response</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#b5432f' }]}>{status?.breaches ?? 0}</Text>
          <Text style={styles.statLabel}>Breaches</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#b3812c' }]}>{status?.at_risk ?? 0}</Text>
          <Text style={styles.statLabel}>At Risk</Text>
        </View>
      </View>

      {/* SLA configs */}
      {configs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SLA Rules</Text>
          {configs.map((cfg: any, i: number) => (
            <View key={cfg.id || i} style={styles.configRow}>
              <View style={styles.configLeft}>
                <Text style={styles.configName}>{cfg.name || cfg.category || 'Rule'}</Text>
                <Text style={styles.configSub}>{cfg.target_hours}h response target</Text>
              </View>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[cfg.priority] || '#83745e' }]} />
            </View>
          ))}
        </View>
      )}

      {/* Breached emails */}
      {status?.breached_emails?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#e0a89a' }]}>SLA Breaches</Text>
          {status.breached_emails.map((e: any, i: number) => (
            <View key={i} style={styles.breachRow}>
              <Ionicons name="warning-outline" size={16} color="#b5432f" />
              <View style={{ flex: 1 }}>
                <Text style={styles.breachSubject} numberOfLines={1}>{e.subject}</Text>
                <Text style={styles.breachMeta}>{e.from_email} · {Math.round(e.hours_overdue)}h overdue</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#b5432f', medium: '#b3812c', low: '#5c7a4a',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#b5432f', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: '#332b22', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  complianceCard: { backgroundColor: '#332b22', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 2, marginBottom: 16 },
  compliancePct: { fontSize: 52, fontWeight: '800' },
  complianceLabel: { color: '#83745e', fontSize: 13, marginBottom: 14, marginTop: 2 },
  progressBg: { width: '100%', height: 8, backgroundColor: '#221c16', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#332b22', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#4a4033' },
  statNum: { color: '#f3efe8', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { color: '#83745e', fontSize: 11 },
  section: { backgroundColor: '#332b22', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4a4033', marginBottom: 16 },
  sectionTitle: { color: '#a99b83', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  configRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#221c16' },
  configLeft: { flex: 1 },
  configName: { color: '#e7e0d4', fontSize: 14, fontWeight: '600' },
  configSub: { color: '#83745e', fontSize: 12, marginTop: 2 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  breachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#221c16' },
  breachSubject: { color: '#e0a89a', fontSize: 13, fontWeight: '600' },
  breachMeta: { color: '#83745e', fontSize: 11, marginTop: 2 },
});
