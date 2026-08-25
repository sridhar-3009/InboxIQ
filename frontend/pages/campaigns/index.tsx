import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  Megaphone, Users, Plus, Trash2, Send, X, Loader2, Mail, UsersRound,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { campaignsApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { MarketingAudience, MarketingContact, MarketingCampaign, MarketingUsage } from '@/lib/types';

type Tab = 'campaigns' | 'audiences';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', growth: 'Growth', scale: 'Scale', pro: 'Pro',
};

// ─── Usage bar ──────────────────────────────────────────────────────────────

function UsageBar() {
  const [usage, setUsage] = useState<MarketingUsage | null>(null);

  useEffect(() => { campaignsApi.getUsage().then(setUsage).catch(() => {}); }, []);

  if (!usage) return null;
  const pct = Math.min(100, (usage.sent / usage.limit) * 100);

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{PLAN_LABELS[usage.plan] || usage.plan} plan</span>
          <span className="text-xs text-gray-400 ml-2">{usage.sent.toLocaleString()} / {usage.limit.toLocaleString()} emails this month</span>
        </div>
        {pct >= 80 && <span className="text-xs font-medium text-warning">Paid tiers coming soon</span>}
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={clsx('h-full rounded-full', pct >= 90 ? 'bg-urgent' : pct >= 70 ? 'bg-warning' : 'bg-primary-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Audiences ──────────────────────────────────────────────────────────────

function AudiencesTab() {
  const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [activeAudience, setActiveAudience] = useState<MarketingAudience | null>(null);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [pasteBox, setPasteBox] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const { audiences } = await campaignsApi.listAudiences();
      setAudiences(audiences);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load audiences'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      await campaignsApi.createAudience(newName.trim());
      setNewName('');
      setShowNew(false);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create audience'));
    }
  };

  const openAudience = async (a: MarketingAudience) => {
    setActiveAudience(a);
    try {
      const { contacts } = await campaignsApi.listContacts(a.id);
      setContacts(contacts);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load contacts'));
    }
  };

  const addContacts = async () => {
    if (!activeAudience || !pasteBox.trim()) return;
    setAdding(true);
    try {
      const { added } = await campaignsApi.addContacts(activeAudience.id, pasteBox);
      toast.success(`Added ${added} contact${added === 1 ? '' : 's'}`);
      setPasteBox('');
      const { contacts } = await campaignsApi.listContacts(activeAudience.id);
      setContacts(contacts);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to add contacts'));
    } finally {
      setAdding(false);
    }
  };

  const removeContact = async (contactId: string) => {
    if (!activeAudience) return;
    try {
      await campaignsApi.removeContact(activeAudience.id, contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to remove contact'));
    }
  };

  const deleteAudience = async (id: string) => {
    if (!confirm('Delete this audience and all its contacts?')) return;
    try {
      await campaignsApi.deleteAudience(id);
      if (activeAudience?.id === id) setActiveAudience(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete audience'));
    }
  };

  if (loading) return <LoadingSpinner />;

  if (activeAudience) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActiveAudience(null)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            ← Audiences
          </button>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{activeAudience.name}</span>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add contacts</label>
          <textarea
            value={pasteBox}
            onChange={(e) => setPasteBox(e.target.value)}
            placeholder={'One per line, e.g.\njane@company.com\nJane Doe <jane@company.com>'}
            className="input-field mt-1.5 h-24 text-sm font-mono"
          />
          <button onClick={addContacts} disabled={adding || !pasteBox.trim()} className="btn-primary mt-2 text-sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to audience'}
          </button>
        </div>

        <div className="space-y-1">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{c.name || c.email}</p>
                {c.name && <p className="text-xs text-gray-400 truncate">{c.email}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {!c.subscribed && <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">unsubscribed</span>}
                <button onClick={() => removeContact(c.id)} className="text-gray-300 hover:text-urgent"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No contacts yet — paste some above.</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        {showNew ? (
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Audience name" className="input-field h-9 text-sm" autoFocus />
            <button onClick={create} className="btn-primary text-sm">Create</button>
            <button onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> New audience</button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {audiences.map((a) => (
          <button key={a.id} onClick={() => openAudience(a)} className="card p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary-600" />
                <span className="font-medium text-gray-800 dark:text-gray-200">{a.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteAudience(a.id); }} className="text-gray-300 hover:text-urgent"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{a.contact_count} contact{a.contact_count === 1 ? '' : 's'}</p>
          </button>
        ))}
        {audiences.length === 0 && <p className="text-sm text-gray-400 col-span-2 text-center py-10">No audiences yet. Create one to start building a list.</p>}
      </div>
    </div>
  );
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

function ComposeModal({ audiences, onClose, onSaved }: { audiences: MarketingAudience[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [audienceId, setAudienceId] = useState(audiences[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !audienceId || !subject.trim() || !body.trim()) {
      toast.error('Fill in every field.');
      return;
    }
    setSaving(true);
    try {
      await campaignsApi.createCampaign({ name, audience_id: audienceId, subject, body_html: body.replace(/\n/g, '<br/>') });
      toast.success('Campaign saved as draft');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save campaign'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-gray-900 dark:text-gray-100">New campaign</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Internal campaign name" className="input-field text-sm" />
          <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)} className="input-field text-sm">
            {audiences.length === 0 && <option value="">Create an audience first</option>}
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.contact_count})</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="input-field text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email body..." className="input-field h-40 text-sm" />
        </div>
        <button onClick={save} disabled={saving || !audiences.length} className="btn-primary w-full mt-4 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save as draft'}
        </button>
      </div>
    </div>
  );
}

function CampaignsTab({ audiences }: { audiences: MarketingAudience[] }) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { campaigns } = await campaignsApi.listCampaigns();
      setCampaigns(campaigns);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load campaigns'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const send = async (id: string) => {
    if (!confirm('Send this campaign now? This cannot be undone.')) return;
    setSendingId(id);
    try {
      const result = await campaignsApi.sendCampaign(id);
      toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}`);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to send campaign'));
    } finally {
      setSendingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await campaignsApi.deleteCampaign(id);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete campaign'));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCompose(true)} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> New campaign</button>
      </div>

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={clsx(
                'text-[10px] font-semibold rounded-full px-2 py-0.5 uppercase',
                c.status === 'sent' && 'bg-success/10 text-success',
                c.status === 'draft' && 'bg-gray-100 dark:bg-gray-800 text-gray-500',
                c.status === 'sending' && 'bg-warning/10 text-warning',
                c.status === 'failed' && 'bg-urgent/10 text-urgent',
              )}>
                {c.status}
              </span>
              <span className="text-xs text-gray-400 hidden sm:inline">
                {c.sent_at ? formatDistanceToNow(new Date(c.sent_at), { addSuffix: true }) : formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
              {c.status === 'draft' && (
                <button onClick={() => send(c.id)} disabled={sendingId === c.id} className="text-primary-600 hover:text-primary-700" title="Send">
                  {sendingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
              <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-urgent"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-gray-400 text-center py-10">No campaigns yet. Create one to send your first send.</p>}
      </div>

      {showCompose && <ComposeModal audiences={audiences} onClose={() => setShowCompose(false)} onSaved={load} />}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function NoOrgPrompt() {
  return (
    <div className="card p-10 text-center max-w-md mx-auto">
      <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
        <UsersRound className="h-6 w-6 text-primary-600" />
      </div>
      <h3 className="font-serif text-lg text-gray-900 dark:text-gray-100 mb-2">Create a team to send campaigns</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Campaigns, audiences, and usage all live under a team. Set one up — it takes a few seconds — then come back here.
      </p>
      <Link href="/team" className="btn-primary inline-flex items-center gap-1.5 text-sm">
        Go to Team
      </Link>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
  const [orgStatus, setOrgStatus] = useState<'checking' | 'ok' | 'no-org'>('checking');

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (!session) return;
    campaignsApi.getUsage()
      .then(() => setOrgStatus('ok'))
      .catch((err) => setOrgStatus(err?.response?.status === 404 ? 'no-org' : 'ok'));
  }, [session]);

  useEffect(() => {
    if (session && orgStatus === 'ok') campaignsApi.listAudiences().then((r) => setAudiences(r.audiences)).catch(() => {});
  }, [session, orgStatus, activeTab]);

  if (sessionLoading || !session || orgStatus === 'checking') return <LoadingSpinner fullPage />;

  const tabs: { id: Tab; label: string; icon: typeof Megaphone }[] = [
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'audiences', label: 'Audiences', icon: Users },
  ];

  return (
    <>
      <Head><title>Campaigns — Mailair</title></Head>
      <Layout title="Campaigns">
        <div className="max-w-4xl mx-auto">
          {orgStatus === 'no-org' ? (
            <NoOrgPrompt />
          ) : (
            <>
              <UsageBar />

              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit mb-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'campaigns' && <CampaignsTab audiences={audiences} />}
              {activeTab === 'audiences' && <AudiencesTab />}
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
