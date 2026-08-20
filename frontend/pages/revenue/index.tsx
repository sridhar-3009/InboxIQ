import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { DollarSign, AlertTriangle, RefreshCw, Loader2, Check, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { revenueApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { RevenueSummary, RevenueSignal, RevenueAtRisk } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  quote:       'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  invoice:     'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  unpaid:      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  renewal:     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  upsell:      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  opportunity: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  contract:    'bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-400',
};

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

function fmt(amount: number | null, currency = 'INR') {
  if (!amount) return null;
  return currency === 'INR' ? `₹${amount.toLocaleString()}` : `$${amount.toLocaleString()}`;
}

export default function RevenuePage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [atRisk, setAtRisk] = useState<RevenueAtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      const [summaryData, riskData] = await Promise.all([
        revenueApi.getSummary(),
        revenueApi.getAtRisk().catch(() => ({ at_risk: [] })),
      ]);
      setSummary(summaryData);
      setAtRisk(riskData.at_risk || []);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, 'Failed to load revenue data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await revenueApi.scan();
      toast.success(`Found ${result.signals_found} new signals`);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Scan failed'));
    } finally {
      setScanning(false);
    }
  };

  const handleStatus = async (signal: RevenueSignal, status: string) => {
    setUpdatingId(signal.id);
    try {
      await revenueApi.updateSignal(signal.id, status);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Update failed'));
    } finally {
      setUpdatingId(null);
    }
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;
  if (loadError && !summary) return (
    <Layout title="Revenue Signals">
      <PageError message="Couldn't load revenue data" onRetry={() => { setLoadError(false); load(); }} />
    </Layout>
  );

  return (
    <>
      <Head><title>Revenue Signals — Mailair</title></Head>
      <Layout title="Revenue Signals">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Header actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">AI-detected quotes, invoices, and opportunities from your emails</p>
            <button onClick={handleScan} disabled={scanning} className="btn-primary text-sm">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {scanning ? 'Scanning…' : 'Scan Emails'}
            </button>
          </div>

          {loading ? (
            <div className="card p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !summary ? null : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pipeline Value</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                    {summary.total_pipeline_value > 0 ? `₹${summary.total_pipeline_value.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="card p-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Open Signals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{summary.total_signals}</p>
                </div>
                <div className="card p-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">High Urgency</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{summary.high_urgency_count}</p>
                </div>
                <div className="card p-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Types Found</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{Object.keys(summary.by_type).length}</p>
                </div>
              </div>

              {/* Type breakdown */}
              {Object.keys(summary.by_type).length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.by_type).map(([type, count]) => (
                      <span key={type} className={`rounded-full px-3 py-1 text-xs font-semibold ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'}`}>
                        {type} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue at risk */}
              {atRisk.length > 0 && (
                <div className="card p-5 border-urgent/30">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-urgent" />
                    <h3 className="font-serif text-lg text-gray-900 dark:text-gray-100">Revenue at risk</h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Open deals tied to clients whose relationship is fading — worth a check-in before the money follows.
                  </p>
                  <div className="space-y-2.5">
                    {atRisk.map((r) => (
                      <div
                        key={r.contact_email}
                        className="flex items-center justify-between gap-3 rounded-lg border border-urgent/20 bg-urgent/5 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.contact_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {r.signal_count} open signal{r.signal_count !== 1 ? 's' : ''} · {r.trend === 'declining' ? 'declining contact' : `${r.health_label.replace('_', ' ')} health`} · last email {r.days_since_last_email}d ago
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-urgent">
                          {fmt(r.total_amount, r.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signal list */}
              <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                <div className="px-5 py-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open Signals</h3>
                </div>
                {summary.signals.length === 0 ? (
                  <div className="px-5 py-10 text-center text-gray-400">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No signals yet. Click "Scan Emails" to detect revenue opportunities.</p>
                  </div>
                ) : (
                  summary.signals.map(signal => (
                    <div key={signal.id} className="px-5 py-4 flex items-start gap-4">
                      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${URGENCY_DOT[signal.urgency]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{signal.subject}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{signal.sender}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {signal.amount && (
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {fmt(signal.amount, signal.currency)}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[signal.signal_type] || ''}`}>
                              {signal.signal_type}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{signal.description}</p>
                        {signal.action_needed && (
                          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium">→ {signal.action_needed}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleStatus(signal, 'won')}
                            disabled={updatingId === signal.id}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                          >
                            <Check className="h-3 w-3" /> Won
                          </button>
                          <button
                            onClick={() => handleStatus(signal, 'dismissed')}
                            disabled={updatingId === signal.id}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 transition-colors"
                          >
                            <X className="h-3 w-3" /> Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
