import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { BarChart2, TrendingUp, Mail, CheckCircle, Inbox, RefreshCw, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Layout from '@/components/Layout';
import { StatsCardSkeleton } from '@/components/SkeletonLoader';
import { ErrorCard } from '@/components/ErrorBoundary';
import { emailsApi } from '@/lib/api';
import toast from 'react-hot-toast';

type ResponseTimeData = {
  overall_avg_hours: number;
  by_category: Record<string, number>;
  daily_trend: Array<{ day: string; avg_hours: number }>;
  total_replied: number;
};

type Analytics = {
  total_emails: number;
  processed_emails: number;
  unread_emails: number;
  processing_rate: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  emails_per_day: Array<{ day: string; count: number }>;
};

type SenderInsight = {
  sender_email: string;
  sender_name: string;
  count: number;
  last_email_at: string;
  categories: Record<string, number>;
};

const SENDER_GRADIENTS = [
  'from-primary-400 to-primary-600',
  'from-primary-400 to-primary-600',
  'from-emerald-400 to-emerald-600',
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
  'from-cyan-400 to-cyan-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
];
function senderGradient(name: string) {
  const code = (name.charCodeAt(0) || 0) % SENDER_GRADIENTS.length;
  return SENDER_GRADIENTS[code];
}

const CATEGORY_COLORS: Record<string, string> = {
  urgent:         '#ef4444',
  needs_response: '#f59e0b',
  follow_up:      '#cf5d2e',
  fyi:            '#8b5cf6',
  newsletter:     '#10b981',
  spam:           '#83745e',
  other:          '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  urgent:         'Urgent',
  needs_response: 'Needs Response',
  follow_up:      'Follow Up',
  fyi:            'FYI',
  newsletter:     'Newsletter',
  spam:           'Spam',
  other:          'Other',
};

function DonutChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">No data yet</div>
  );

  // Build conic-gradient
  let cumulative = 0;
  const segments = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      const pct = (value / total) * 100;
      const start = cumulative;
      cumulative += pct;
      return { key, value, pct, start, color: CATEGORY_COLORS[key] || '#94a3b8' };
    });

  const gradient = segments
    .map(s => `${s.color} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`)
    .join(', ');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative flex-shrink-0">
        <div
          className="h-36 w-36 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">total</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 grid grid-cols-1 gap-1.5 w-full">
        {segments.map(s => (
          <div key={s.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{CATEGORY_LABELS[s.key] || s.key}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{s.value}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right">{s.pct.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChartComponent({ data }: { data: Array<{ day: string; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end justify-between gap-1 h-32 px-1">
      {data.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{d.count > 0 ? d.count : ''}</span>
          <div className="w-full flex items-end justify-center">
            <div
              className="w-full rounded-t-md bg-primary-500 transition-all duration-700 hover:bg-primary-600 min-h-[4px]"
              style={{ height: `${Math.max((d.count / max) * 96, d.count > 0 ? 4 : 2)}px` }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function PriorityBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">{value} <span className="text-gray-400 dark:text-gray-500">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [senderInsights, setSenderInsights] = useState<SenderInsight[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      setError(false);
      const [data, insights, rt] = await Promise.all([
        emailsApi.getAnalytics(),
        emailsApi.getSenderInsights().catch(() => []),
        emailsApi.getResponseTimeAnalytics().catch(() => null),
      ]);
      setAnalytics(data);
      setSenderInsights(insights);
      setResponseTime(rt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    toast.success('Analytics refreshed');
  };

  if (sessionLoading) return null;

  const p = analytics?.by_priority ?? {};
  const priorityTotal = (p.high ?? 0) + (p.medium ?? 0) + (p.low ?? 0);

  return (
    <>
      <Head><title>Analytics — Mailair</title></Head>
      <Layout title="Analytics">
        <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Email Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights into your inbox patterns</p>
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary text-sm">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && <ErrorCard message="Failed to load analytics" onRetry={load} />}

          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {loading ? [...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />) : (
              <>
                {[
                  { label: 'Total Emails', value: analytics?.total_emails ?? 0, icon: Mail, color: 'text-primary-600', bg: 'bg-primary-50' },
                  { label: 'Processed', value: analytics?.processed_emails ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Unread', value: analytics?.unread_emails ?? 0, icon: Inbox, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'AI Rate', value: `${analytics?.processing_rate ?? 0}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className={`card p-4 animate-slide-up stagger-${i + 1}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                          <Icon className={`h-4 w-4 ${stat.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Emails by category donut */}
            <div className="card p-5 animate-slide-up stagger-2">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="h-4 w-4 text-primary-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Emails by Category</h2>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="skeleton h-3 w-3 rounded-full" />
                      <div className="skeleton h-3 flex-1 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <DonutChart data={analytics?.by_category ?? {}} />
              )}
            </div>

            {/* Emails per day bar chart */}
            <div className="card p-5 animate-slide-up stagger-3">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Emails Last 7 Days</h2>
              </div>
              {loading ? (
                <div className="flex items-end gap-1 h-32">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                      <div className="skeleton w-full rounded" style={{ height: `${20 + Math.random() * 60}px` }} />
                      <div className="skeleton h-3 w-6 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <BarChartComponent data={analytics?.emails_per_day ?? []} />
              )}
            </div>
          </div>

          {/* Priority breakdown */}
          <div className="card p-5 animate-slide-up stagger-4">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Priority Breakdown</h2>
            </div>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-6 w-full rounded" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <PriorityBar label="High Priority" value={p.high ?? 0} total={priorityTotal} color="#ef4444" />
                <PriorityBar label="Medium Priority" value={p.medium ?? 0} total={priorityTotal} color="#f59e0b" />
                <PriorityBar label="Low Priority" value={p.low ?? 0} total={priorityTotal} color="#10b981" />
              </div>
            )}
          </div>

          {/* Top Senders */}
          {(loading || senderInsights.length > 0) && (
            <div className="card p-5 animate-slide-up stagger-5">
              <div className="flex items-center gap-2 mb-5">
                <Users className="h-4 w-4 text-primary-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Senders</h2>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="skeleton h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-3.5 w-1/3 rounded" />
                        <div className="skeleton h-3 w-1/2 rounded" />
                      </div>
                      <div className="skeleton h-6 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {senderInsights.slice(0, 10).map((sender, i) => {
                    const topCategory = Object.entries(sender.categories).sort((a, b) => b[1] - a[1])[0]?.[0];
                    const gradient = senderGradient(sender.sender_name || sender.sender_email);
                    return (
                      <div
                        key={sender.sender_email}
                        className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 shrink-0">{i + 1}</span>
                        <div className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-sm`}>
                          {(sender.sender_name || sender.sender_email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {sender.sender_name || sender.sender_email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sender.sender_email}</p>
                        </div>
                        {topCategory && (
                          <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 capitalize hidden sm:inline">
                            {topCategory.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">
                          {formatDistanceToNow(new Date(sender.last_email_at), { addSuffix: true })}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700">
                          {sender.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Response Time Analytics */}
          {(loading || responseTime) && (
            <div className="card p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-4 w-4 text-primary-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response Time Analytics</h2>
                {responseTime && (
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {responseTime.total_replied} replied • avg {responseTime.overall_avg_hours.toFixed(1)}h
                  </span>
                )}
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-5 w-full rounded" />)}
                </div>
              ) : responseTime && responseTime.total_replied > 0 ? (
                <div className="space-y-4">
                  {/* By category */}
                  <div className="space-y-2">
                    {Object.entries(responseTime.by_category).sort((a, b) => b[1] - a[1]).map(([cat, hours]) => (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{cat.replace(/_/g, ' ')}</span>
                          <span className="text-gray-500 dark:text-gray-400">{hours.toFixed(1)}h avg</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all duration-700"
                            style={{ width: `${Math.min((hours / (responseTime.overall_avg_hours * 2 || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Send some replies to see response time data</p>
              )}
            </div>
          )}

        </div>
      </Layout>
    </>
  );
}
