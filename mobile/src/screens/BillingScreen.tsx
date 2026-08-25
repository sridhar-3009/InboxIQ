import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { billingApi, apiErrorMessage } from '../lib/api';

const PLAN_CONFIG: Record<string, {
  border: string; icon: string; color: string;
  title: string; features: string[]; price: string;
}> = {
  free: {
    border: '#4a4033', icon: '📧', color: '#a99b83', title: 'Free',
    price: '₹0/month',
    features: ['100 emails/month', 'AI summaries', '3 actions/day', 'Basic inbox'],
  },
  pro: {
    border: '#b04723', icon: '⚡', color: '#e17c4e', title: 'Pro',
    price: '₹999/month',
    features: ['2,000 emails/month', 'AI reply generation', 'Unlimited actions',
      'Revenue tracking', 'Relationships', 'Knowledge base', 'Sequences'],
  },
  agency: {
    border: '#7c3aed', icon: '🏢', color: '#c4b5fd', title: 'Agency',
    price: '₹2,999/month',
    features: ['Unlimited emails', 'Team management', 'Custom sequences',
      'Priority support', 'API access', 'All Pro features'],
  },
};

const UPGRADE_PLANS: Array<{ key: string; name: string; price: string; color: string; features: string[] }> = [
  {
    key: 'pro', name: 'Pro', price: '₹999/month', color: '#b04723',
    features: ['2,000 emails/month', 'AI reply generation', 'Revenue tracking', 'Knowledge base'],
  },
  {
    key: 'agency', name: 'Agency', price: '₹2,999/month', color: '#7c3aed',
    features: ['Unlimited emails', 'Team management', 'Priority support', 'All Pro features'],
  },
];

export default function BillingScreen() {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await billingApi.getStatus();
      setBilling(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load billing info'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const plan = billing?.plan || 'free';
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

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
      {/* Current plan */}
      <View style={[styles.planCard, { borderColor: cfg.border }]}>
        <View style={styles.planHeader}>
          <Text style={styles.planIcon}>{cfg.icon}</Text>
          <View style={styles.planInfo}>
            <Text style={styles.planTitle}>{cfg.title} Plan</Text>
            <Text style={styles.planPrice}>{cfg.price}</Text>
          </View>
          <View style={[styles.activeBadge, { backgroundColor: cfg.border + '40', borderColor: cfg.border }]}>
            <Text style={[styles.activeBadgeText, { color: cfg.color }]}>Active</Text>
          </View>
        </View>

        {billing?.current_period_end && (
          <Text style={styles.renewDate}>
            Renews {new Date(billing.current_period_end).toLocaleDateString()}
          </Text>
        )}

        <View style={styles.featureList}>
          {cfg.features.map(f => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#5c7a4a" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Usage */}
      {billing?.usage && Object.keys(billing.usage).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage This Month</Text>
          {Object.entries(billing.usage as Record<string, unknown>).map(([key, val]) => (
            <View key={key} style={styles.usageRow}>
              <Text style={styles.usageLabel}>{key.replace(/_/g, ' ')}</Text>
              <Text style={styles.usageVal}>{String(val)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Upgrade plans */}
      {plan !== 'agency' && (
        <>
          <Text style={styles.upgradeHeading}>Upgrade Your Plan</Text>
          {UPGRADE_PLANS.filter(p => p.key !== plan).map(p => (
            <View key={p.key} style={[styles.upgradeCard, { borderColor: p.color + '60' }]}>
              <View style={styles.upgradeHeader}>
                <Text style={[styles.upgradeName, { color: p.color }]}>{p.name}</Text>
                <Text style={styles.upgradePrice}>{p.price}</Text>
              </View>
              {p.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={p.color} />
                  <Text style={styles.upgradeFeatureText}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.upgradeBtn, { backgroundColor: p.color }]}
                onPress={() => Linking.openURL('https://mailair.company/billing')}
              >
                <Text style={styles.upgradeBtnText}>Upgrade to {p.name} — mailair.company</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Manage link */}
      <TouchableOpacity
        style={styles.manageBtn}
        onPress={() => Linking.openURL('https://mailair.company/billing')}
      >
        <Ionicons name="open-outline" size={16} color="#83745e" />
        <Text style={styles.manageText}>Manage subscription, invoices & payments — mailair.company</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#221c16' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#b5432f', marginTop: 12, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: '#332b22', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#e17c4e', fontWeight: '600' },
  planCard: { backgroundColor: '#332b22', borderRadius: 18, padding: 18, borderWidth: 2, marginBottom: 20 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  planIcon: { fontSize: 28 },
  planInfo: { flex: 1 },
  planTitle: { color: '#f3efe8', fontSize: 18, fontWeight: '800' },
  planPrice: { color: '#83745e', fontSize: 13, marginTop: 2 },
  activeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  renewDate: { color: '#635646', fontSize: 12, marginBottom: 14 },
  featureList: { gap: 8, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: '#d3c7b4', fontSize: 14 },
  section: { backgroundColor: '#332b22', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4a4033', marginBottom: 20 },
  sectionTitle: { color: '#83745e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#221c16' },
  usageLabel: { color: '#a99b83', fontSize: 14, textTransform: 'capitalize' },
  usageVal: { color: '#f3efe8', fontSize: 14, fontWeight: '700' },
  upgradeHeading: { color: '#a99b83', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  upgradeCard: { backgroundColor: '#332b22', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 14, gap: 8 },
  upgradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  upgradeName: { fontSize: 18, fontWeight: '800' },
  upgradePrice: { color: '#a99b83', fontSize: 14, fontWeight: '600' },
  upgradeFeatureText: { color: '#a99b83', fontSize: 13 },
  upgradeBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  manageText: { color: '#635646', fontSize: 12, textAlign: 'center', flex: 1 },
});
