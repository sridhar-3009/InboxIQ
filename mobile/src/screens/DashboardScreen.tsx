import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { emailsApi, actionsApi, revenueApi, slaApi, apiErrorMessage } from '../lib/api';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
}

function StatCard({ icon, iconColor, label, value, sub, subColor }: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBg, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {sub ? <Text style={[styles.cardSub, subColor ? { color: subColor } : null]}>{sub}</Text> : null}
    </View>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [emailsData, actionsData, revenueData, slaData] = await Promise.allSettled([
        emailsApi.getEmails({ is_read: false }),
        actionsApi.getActions(),
        revenueApi.getSummary(),
        slaApi.getSummary(),
      ]);

      setData({
        unread: emailsData.status === 'fulfilled' ? (emailsData.value.emails?.length ?? 0) : 0,
        pendingActions: actionsData.status === 'fulfilled'
          ? (Array.isArray(actionsData.value) ? actionsData.value : actionsData.value.actions || [])
              .filter((a: { status: string }) => a.status === 'pending').length
          : 0,
        overdueActions: actionsData.status === 'fulfilled'
          ? (Array.isArray(actionsData.value) ? actionsData.value : actionsData.value.actions || [])
              .filter((a: { status: string; deadline?: string }) =>
                a.status === 'pending' && a.deadline && new Date(a.deadline) < new Date()).length
          : 0,
        revenue: revenueData.status === 'fulfilled' ? revenueData.value : null,
        sla: slaData.status === 'fulfilled' ? slaData.value : null,
      });
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const rev = data.revenue as Record<string, unknown> | null;
  const sla = data.sla as Record<string, unknown> | null;

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator color="#e17c4e" size="large" /></View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e17c4e" />}
    >
      <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
      <Text style={styles.sub}>Here's what needs your attention</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Inbox</Text>
      <View style={styles.row}>
        <StatCard icon="mail-unread-outline" iconColor="#e17c4e" label="Unread" value={data.unread as number ?? 0} />
        <StatCard
          icon="warning-outline"
          iconColor="#b3812c"
          label="Actions"
          value={data.pendingActions as number ?? 0}
          sub={(data.overdueActions as number) > 0 ? `${data.overdueActions} overdue` : undefined}
          subColor="#b5432f"
        />
      </View>

      {rev && (
        <>
          <Text style={styles.sectionLabel}>Revenue</Text>
          <View style={styles.row}>
            <StatCard icon="cash-outline" iconColor="#5c7a4a" label="Total Revenue" value={formatCurrency(rev.total_revenue as number)} />
            <StatCard icon="trending-up-outline" iconColor="#93a06a" label="This Month" value={formatCurrency(rev.monthly_revenue as number)} />
          </View>
          <View style={styles.row}>
            <StatCard icon="briefcase-outline" iconColor="#f97316" label="Pipeline" value={formatCurrency(rev.pipeline_value as number)} />
            <StatCard icon="people-outline" iconColor="#06b6d4" label="Clients" value={rev.client_count as number ?? 0} />
          </View>
        </>
      )}

      {sla && (
        <>
          <Text style={styles.sectionLabel}>SLA</Text>
          <View style={styles.row}>
            <StatCard
              icon="checkmark-circle-outline"
              iconColor="#5c7a4a"
              label="Compliance"
              value={`${Math.round((sla.compliance_rate as number ?? 0) * 100)}%`}
            />
            <StatCard
              icon="time-outline"
              iconColor="#b3812c"
              label="Avg Response"
              value={`${Math.round(sla.avg_response_hours as number ?? 0)}h`}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatCurrency(v: number) {
  if (!v) return '₹0';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { color: '#f3efe8', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub: { color: '#83745e', fontSize: 14, marginBottom: 20 },
  sectionLabel: { color: '#a99b83', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#332b22', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#4a4033' },
  iconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardValue: { color: '#f3efe8', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  cardLabel: { color: '#83745e', fontSize: 12 },
  cardSub: { color: '#a99b83', fontSize: 11, marginTop: 2 },
  errorBox: { backgroundColor: '#332b22', borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' },
  errorText: { color: '#b5432f', marginBottom: 8 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
});
