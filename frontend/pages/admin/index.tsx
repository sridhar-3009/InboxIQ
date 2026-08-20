import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  Users, Mail, TrendingUp, RefreshCw, Loader2, Shield,
  CreditCard, Zap, Crown, AlertTriangle, CheckCircle,
  Activity, IndianRupee, UserCheck, BarChart2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { adminApi } from '@/lib/api';
import clsx from 'clsx';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'saisridhart@gmail.com';

// ── Types ──────────────────────────────────────────────────────────────────

interface PlatformStats {
  total_users: number;
  paying_users: number;
  pro_users: number;
  agency_users: number;
  free_users: number;
  mrr_inr: number;
  emails_this_month: number;
  total_processed_emails: number;
  new_users_this_month: number;
}

interface AdminUser {
  id: string;
  email: string;
  plan: string;
  subscription_status: string | null;
  subscription_id: string | null;
  created_at: string;
  emails_used_this_month: number;
  total_emails: number;
}

interface WebhookLog {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
  status?: string;
}

// ── Small components ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, prefix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  prefix?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const PLAN_BADGE: Record<string, string> = {
  free:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  pro:    'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  agency: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

const PLAN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  free:   CreditCard,
  pro:    Zap,
  agency: Crown,
};

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  halted:   'bg-amber-100 text-amber-700',
  expired:  'bg-gray-100 text-gray-600',
};

function PlanBadge({ plan }: { plan: string }) {
  const Icon = PLAN_ICON[plan] ?? CreditCard;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize', PLAN_BADGE[plan] ?? PLAN_BADGE.free)}>
      <Icon className="h-3 w-3" />
      {plan}
    </span>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-green-600 font-medium">Unlimited</span>;
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">{used}/{limit}</span>
    </div>
  );
}

const PLAN_LIMITS: Record<string, number | null> = { free: 5, pro: null, agency: null };

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();

  const [stats, setStats]       = useState<PlatformStats | null>(null);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [logs, setLogs]         = useState<WebhookLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [tab, setTab]           = useState<'overview' | 'users' | 'webhooks'>('overview');
  const [search, setSearch]     = useState('');

  const userEmail = session?.user?.email ?? '';
  const isAdmin = userEmail === ADMIN_EMAIL;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, usersData, logsData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers(),
        adminApi.getWebhookLogs(),
      ]);
      setStats(statsData);
      setUsers(usersData.users ?? []);
      setLogs(logsData.logs ?? []);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session && isAdmin) loadAll();
    else if (session && !isAdmin) setLoading(false);
  }, [session, isAdmin, loadAll]);

  const handlePlanChange = async (userId: string, plan: string) => {
    setPlanLoading(userId);
    try {
      await adminApi.updateUserPlan(userId, plan);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan } : u));
      toast.success(`Plan updated to ${plan}`);
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setPlanLoading(null);
    }
  };

  if (sessionLoading || loading) return <LoadingSpinner fullPage />;

  // Not admin — show access denied
  if (!isAdmin) {
    return (
      <>
        <Head><title>Access Denied — Mailair</title></Head>
        <Layout title="Admin">
          <div className="max-w-md mx-auto mt-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This page is restricted to platform administrators only.</p>
            <button onClick={() => router.push('/dashboard')} className="mt-6 btn-primary">Back to Dashboard</button>
          </div>
        </Layout>
      </>
    );
  }

  const filteredUsers = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'users',    label: `Users (${users.length})`, icon: Users },
    { id: 'webhooks', label: `Webhooks (${logs.length})`, icon: Activity },
  ] as const;

  return (
    <>
      <Head><title>Admin — Mailair</title></Head>
      <Layout title="Platform Admin">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Platform Admin</h1>
                <p className="text-xs text-gray-400 dark:text-gray-500">Signed in as {userEmail}</p>
              </div>
            </div>
            <button onClick={loadAll} disabled={loading} className="btn-secondary text-sm gap-2">
              <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  tab === id
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && stats && (
            <div className="space-y-6">
              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users}       label="Total Users"     value={stats.total_users}           color="bg-primary-600" sub={`${stats.new_users_this_month} new this month`} />
                <StatCard icon={UserCheck}   label="Paying Users"    value={stats.paying_users}          color="bg-emerald-600" sub={`${stats.pro_users} Pro · ${stats.agency_users} Agency`} />
                <StatCard icon={IndianRupee} label="MRR"             value={`₹${stats.mrr_inr.toLocaleString()}`} color="bg-primary-600" sub="Monthly recurring revenue" />
                <StatCard icon={Mail}        label="Emails Processed" value={stats.total_processed_emails} color="bg-purple-600" sub={`${stats.emails_this_month} this month`} />
              </div>

              {/* Plan breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { plan: 'free',   count: stats.free_users,   color: 'bg-gray-400',    pct: stats.total_users ? Math.round((stats.free_users / stats.total_users) * 100) : 0 },
                  { plan: 'pro',    count: stats.pro_users,    color: 'bg-primary-500',    pct: stats.total_users ? Math.round((stats.pro_users / stats.total_users) * 100) : 0 },
                  { plan: 'agency', count: stats.agency_users, color: 'bg-purple-500',  pct: stats.total_users ? Math.round((stats.agency_users / stats.total_users) * 100) : 0 },
                ].map(({ plan, count, color, pct }) => (
                  <div key={plan} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <PlanBadge plan={plan} />
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{pct}% of users</p>
                  </div>
                ))}
              </div>

              {/* Revenue card */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Revenue Breakdown</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pro MRR</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">₹{(stats.pro_users * 199).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{stats.pro_users} × ₹199</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Agency MRR</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">₹{(stats.agency_users * 1499).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{stats.agency_users} × ₹1499</p>
                  </div>
                  <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-4 border border-primary-200 dark:border-primary-800">
                    <p className="text-xs text-primary-600 dark:text-primary-400">Total MRR</p>
                    <p className="text-lg font-bold text-primary-700 dark:text-primary-300">₹{stats.mrr_inr.toLocaleString()}</p>
                    <p className="text-xs text-primary-500">per month</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">ARR (est.)</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">₹{(stats.mrr_inr * 12).toLocaleString()}</p>
                    <p className="text-xs text-emerald-500">annualised</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS TAB ── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="input-field max-w-sm"
              />
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Usage / mo</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Emails</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Joined</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Change Plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                            No users found.
                          </td>
                        </tr>
                      ) : filteredUsers.map((user) => {
                        const limit = PLAN_LIMITS[user.plan ?? 'free'];
                        const status = user.subscription_status;
                        return (
                          <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
                                  {(user.email?.[0] ?? '?').toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{user.email || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <PlanBadge plan={user.plan ?? 'free'} />
                            </td>
                            <td className="px-4 py-3">
                              {status ? (
                                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600')}>
                                  {status === 'active' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                  {status}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <UsageBar used={user.emails_used_this_month} limit={limit} />
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                              {user.total_emails.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                              {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy') : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {planLoading === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              ) : (
                                <select
                                  value={user.plan ?? 'free'}
                                  onChange={(e) => handlePlanChange(user.id, e.target.value)}
                                  className="text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 focus:ring-1 focus:ring-primary-500"
                                >
                                  <option value="free">Free</option>
                                  <option value="pro">Pro</option>
                                  <option value="agency">Agency</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── WEBHOOKS TAB ── */}
          {tab === 'webhooks' && (
            <div className="card overflow-hidden">
              {logs.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No webhook events recorded yet.</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Events will appear here after your first Razorpay payment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Event</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                              {log.event}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                              log.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            )}>
                              {log.status === 'processed'
                                ? <CheckCircle className="h-3 w-3" />
                                : <Activity className="h-3 w-3" />}
                              {log.status ?? 'received'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {log.created_at
                              ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </Layout>
    </>
  );
}
