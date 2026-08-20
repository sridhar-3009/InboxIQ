import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { Heart, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, Loader2, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { relationshipsApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { RelationshipContact } from '@/lib/types';

const HEALTH_COLORS = {
  excellent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
  good: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700',
  fair: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
  at_risk: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
};

const HEALTH_BAR = {
  excellent: 'bg-emerald-500',
  good: 'bg-primary-500',
  fair: 'bg-amber-500',
  at_risk: 'bg-red-500',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'growing') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

export default function RelationshipsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [contacts, setContacts] = useState<RelationshipContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'alert'>('all');

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      const data = await relationshipsApi.getAll();
      setContacts(data.contacts || []);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, 'Failed to load relationships'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;
  if (loadError && contacts.length === 0) return (
    <Layout title="Relationships">
      <PageError message="Couldn't load relationships" onRetry={() => { setLoadError(false); load(); }} />
    </Layout>
  );

  const filtered = contacts.filter(c => {
    if (filter === 'at_risk') return c.health_label === 'at_risk';
    if (filter === 'alert') return c.alert;
    return true;
  });

  const alerts = contacts.filter(c => c.alert);
  const atRisk = contacts.filter(c => c.health_label === 'at_risk');

  return (
    <>
      <Head><title>Relationships — Mailair</title></Head>
      <Layout title="Client Relationships">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Contacts', value: contacts.length, color: 'text-primary-600' },
              { label: 'Excellent Health', value: contacts.filter(c => c.health_label === 'excellent').length, color: 'text-emerald-600' },
              { label: 'At Risk', value: atRisk.length, color: 'text-red-600' },
              { label: 'Alerts', value: alerts.length, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="card p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Alerts banner */}
          {alerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{alerts.length} clients need attention</span>
              </div>
              <div className="space-y-1">
                {alerts.slice(0, 3).map(c => (
                  <p key={c.contact_email} className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>{c.contact_name}</strong> — {c.alert_message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Filter + refresh */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {(['all', 'at_risk', 'alert'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'at_risk' ? 'At Risk' : 'Alerts'}
                  {f === 'at_risk' && atRisk.length > 0 && <span className="ml-1.5 text-xs">({atRisk.length})</span>}
                  {f === 'alert' && alerts.length > 0 && <span className="ml-1.5 text-xs">({alerts.length})</span>}
                </button>
              ))}
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary text-sm">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Contact cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <Heart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No contacts found. Process more emails to build relationship data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(contact => (
                <div key={contact.contact_email} className="card p-5 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {contact.contact_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{contact.contact_name}</p>
                        <p className="text-xs text-gray-500 truncate">{contact.contact_email}</p>
                      </div>
                    </div>
                    <TrendIcon trend={contact.trend} />
                  </div>

                  {/* Health bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Health Score</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${HEALTH_COLORS[contact.health_label]}`}>
                        {contact.health_score}/100
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${HEALTH_BAR[contact.health_label]}`}
                        style={{ width: `${contact.health_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contact.emails_30d} emails (30d)
                    </div>
                    <div>
                      Last: {contact.days_since_last_email === 0 ? 'today' : `${contact.days_since_last_email}d ago`}
                    </div>
                  </div>

                  {/* Alert */}
                  {contact.alert && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{contact.alert_message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
