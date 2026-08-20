import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { Timer, AlertTriangle, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { slaApi } from '@/lib/api';
import type { SLAStatus, SLAEmailEntry } from '@/lib/types';

function SLAEmailRow({ email, variant }: { email: SLAEmailEntry; variant: 'breach' | 'warning' | 'ok' }) {
  const colors = {
    breach: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10',
    ok: 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800',
  };
  const barColors = { breach: 'bg-red-500', warning: 'bg-amber-500', ok: 'bg-emerald-500' };

  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{email.subject}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{email.sender}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{email.age_hours}h old</p>
          <p className="text-xs text-gray-400">/{email.max_response_hours}h SLA</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColors[variant]}`} style={{ width: `${Math.min(100, email.pct_used)}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-500">{email.pct_used}%</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{email.sla_tier}</span>
      </div>
    </div>
  );
}

export default function SLAPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [status, setStatus] = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTier, setNewTier] = useState({ name: '', hours: 24, patterns: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      const data = await slaApi.getStatus();
      setStatus(data);
    } catch {
      toast.error('Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleAddConfig = async () => {
    if (!newTier.name || !newTier.hours) return;
    setSaving(true);
    try {
      const patterns = newTier.patterns.split(',').map(s => s.trim()).filter(Boolean);
      await slaApi.createConfig(newTier.name, newTier.hours, patterns);
      toast.success('SLA tier added');
      setShowAddForm(false);
      setNewTier({ name: '', hours: 24, patterns: '' });
      await load();
    } catch {
      toast.error('Failed to add SLA tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await slaApi.deleteConfig(id);
      await load();
      toast.success('Tier deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;

  return (
    <>
      <Head><title>SLA Tracker — Mailair</title></Head>
      <Layout title="SLA Tracker">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Stats */}
          {status && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5">
                <p className="text-sm text-gray-500">Breached</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{status.breached.length}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm text-gray-500">Warning (&gt;80%)</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{status.warning.length}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm text-gray-500">On Track</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{status.ok.length}</p>
              </div>
            </div>
          )}

          {/* SLA Configs */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response Tiers</h3>
              <button onClick={() => setShowAddForm(!showAddForm)} className="btn-secondary text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
              </button>
            </div>

            {showAddForm && (
              <div className="mb-4 rounded-xl border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tier Name</label>
                    <input value={newTier.name} onChange={e => setNewTier({ ...newTier, name: e.target.value })} placeholder="VIP Client" className="input mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Max Hours</label>
                    <input type="number" value={newTier.hours} onChange={e => setNewTier({ ...newTier, hours: Number(e.target.value) })} className="input mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sender Patterns (comma-separated domains/names)</label>
                  <input value={newTier.patterns} onChange={e => setNewTier({ ...newTier, patterns: e.target.value })} placeholder="acme.com, bigclient.io" className="input mt-1 w-full text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddConfig} disabled={saving} className="btn-primary text-xs">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            )}

            {!status || status.configs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No SLA tiers configured. Add one to start tracking.</p>
            ) : (
              <div className="space-y-2">
                {status.configs.map(config => (
                  <div key={config.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.tier_name}</p>
                      <p className="text-xs text-gray-500">{config.max_response_hours}h SLA · {config.sender_patterns.join(', ') || 'default'}</p>
                    </div>
                    <button onClick={() => handleDeleteConfig(config.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="card p-12 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : status && (
            <>
              {status.breached.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Breached ({status.breached.length})
                  </h3>
                  <div className="space-y-2">{status.breached.map(e => <SLAEmailRow key={e.id} email={e} variant="breach" />)}</div>
                </div>
              )}
              {status.warning.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <Timer className="h-4 w-4" /> Warning — approaching limit ({status.warning.length})
                  </h3>
                  <div className="space-y-2">{status.warning.map(e => <SLAEmailRow key={e.id} email={e} variant="warning" />)}</div>
                </div>
              )}
              {status.ok.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> On Track ({status.ok.length})
                  </h3>
                  <div className="space-y-2">{status.ok.slice(0, 5).map(e => <SLAEmailRow key={e.id} email={e} variant="ok" />)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
