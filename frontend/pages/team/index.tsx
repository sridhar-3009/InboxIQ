import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  Users, Plus, Mail, Trash2, Crown, Shield, User, Copy, Check,
  Activity, RefreshCw, Loader2, UserPlus, LogIn, Zap, BarChart2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { teamsApi, autoAssignApi, type AutoAssignRule } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { Organization, OrgMember, ActivityLogEntry, WorkloadEntry } from '@/lib/types';

const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, classes: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-700' },
  admin: { label: 'Admin', icon: Shield, classes: 'text-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400 border-primary-200 dark:border-primary-700' },
  member: { label: 'Member', icon: User, classes: 'text-gray-700 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600' },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.member;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', cfg.classes)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }); }
  catch { return d; }
}

const ACTION_LABELS: Record<string, string> = {
  created_org: 'Created the organization',
  invited_member: 'Invited a member',
  joined_org: 'Joined the organization',
  removed_member: 'Removed a member',
  assigned_email: 'Assigned an email',
  added_note: 'Added an internal note',
};

export default function TeamPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [yourRole, setYourRole] = useState('member');
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'workload' | 'activity' | 'rules'>('members');
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [workloadLoading, setWorkloadLoading] = useState(false);

  // Auto-assign rules state
  const [autoRules, setAutoRules] = useState<AutoAssignRule[]>([]);
  const [ruleForm, setRuleForm] = useState({ condition_type: 'sender_domain', condition_value: '', assign_to_user_id: '' });
  const [addingRule, setAddingRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  // Create org form
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  // Join org form
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [lastInviteToken, setLastInviteToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const loadOrg = useCallback(async () => {
    try {
      const data = await teamsApi.getOrg();
      setOrg(data.org);
      setMembers(data.members);
      setYourRole(data.your_role);
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const data = await teamsApi.getActivity(30);
      setActivity(data);
    } catch { /* no org yet */ }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      const data = await autoAssignApi.list();
      setAutoRules(data);
    } catch { /* no org / not admin */ }
  }, []);

  useEffect(() => {
    if (session) { loadOrg(); loadActivity(); loadRules(); }
  }, [session, loadOrg, loadActivity, loadRules]);

  useEffect(() => {
    if (activeTab !== 'workload' || !session) return;
    setWorkloadLoading(true);
    teamsApi.getWorkload()
      .then(({ workload }) => setWorkload(workload))
      .catch((err) => toast.error(apiErrorMessage(err, 'Failed to load workload')))
      .finally(() => setWorkloadLoading(false));
  }, [activeTab, session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      await teamsApi.createOrg(orgName.trim());
      toast.success('Organization created!');
      setOrgName('');
      await loadOrg();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create organization'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    setJoining(true);
    try {
      await teamsApi.joinOrg(joinToken.trim());
      toast.success('Joined organization!');
      setJoinToken('');
      await loadOrg();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Invalid or expired invite token'));
    } finally {
      setJoining(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await teamsApi.inviteMember(inviteEmail.trim(), inviteRole);
      setLastInviteToken(result.invite_token);
      setInviteEmail('');
      toast.success(`Invite created for ${inviteEmail}`);
      await loadOrg();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to send invite'));
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the organization?')) return;
    try {
      await teamsApi.removeMember(memberId);
      toast.success('Member removed');
      await loadOrg();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to remove member'));
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.condition_value.trim() || !ruleForm.assign_to_user_id) return;
    setSavingRule(true);
    try {
      const rule = await autoAssignApi.create({
        condition_type: ruleForm.condition_type as AutoAssignRule['condition_type'],
        condition_value: ruleForm.condition_value.trim(),
        assign_to_user_id: ruleForm.assign_to_user_id,
        is_active: true,
      });
      setAutoRules((prev) => [rule, ...prev]);
      setRuleForm({ condition_type: 'sender_domain', condition_value: '', assign_to_user_id: '' });
      setAddingRule(false);
      toast.success('Auto-assign rule created');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to create rule')); }
    finally { setSavingRule(false); }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this auto-assign rule?')) return;
    try {
      await autoAssignApi.remove(id);
      setAutoRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rule deleted');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to delete rule')); }
  };

  const handleToggleRule = async (rule: AutoAssignRule) => {
    try {
      const updated = await autoAssignApi.update(rule.id, { is_active: !rule.is_active });
      setAutoRules((prev) => prev.map((r) => r.id === rule.id ? updated : r));
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to update rule')); }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/team/join?token=${lastInviteToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = yourRole === 'owner' || yourRole === 'admin';

  if (sessionLoading || loading) return <LoadingSpinner fullPage />;

  return (
    <>
      <Head><title>Team — Mailair</title></Head>
      <Layout title="Team">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

          {!org ? (
            /* ── No org yet ── */
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Create org */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary-600" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Create Organization</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start a new team workspace and invite your colleagues.
                </p>
                <form onSubmit={handleCreate} className="space-y-3">
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Team"
                    required
                    className="input-field"
                  />
                  <button type="submit" disabled={creating} className="btn-primary w-full gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create
                  </button>
                </form>
              </div>

              {/* Join org */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Join Organization</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Have an invite token? Paste it here to join your team.
                </p>
                <form onSubmit={handleJoin} className="space-y-3">
                  <input
                    type="text"
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value)}
                    placeholder="Paste invite token..."
                    required
                    className="input-field"
                  />
                  <button type="submit" disabled={joining} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 gap-2 inline-flex items-center justify-center">
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Join
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* ── Org dashboard ── */
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{org.name}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {members.filter((m) => m.status === 'active').length} active members · <RoleBadge role={yourRole} />
                  </p>
                </div>
                <button onClick={() => { loadOrg(); loadActivity(); }} className="btn-secondary text-sm gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit overflow-x-auto scrollbar-hide">
                {[
                  { id: 'members' as const, label: 'Members', icon: Users },
                  { id: 'workload' as const, label: 'Workload', icon: BarChart2 },
                  { id: 'activity' as const, label: 'Activity', icon: Activity },
                  ...(isAdmin ? [{ id: 'rules' as const, label: 'Auto-Assign', icon: Zap }] : []),
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors flex-shrink-0',
                      activeTab === id
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'members' && (
                <div className="space-y-4">
                  {/* Invite form (admin/owner only) */}
                  {isAdmin && (
                    <div className="card p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary-600" />
                        Invite Member
                      </h3>
                      <form onSubmit={handleInvite} className="flex gap-2 flex-wrap">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          required
                          className="input-field flex-1 min-w-[200px]"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="input-field w-32"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" disabled={inviting} className="btn-primary gap-2">
                          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          Invite
                        </button>
                      </form>
                      {lastInviteToken && (
                        <div className="rounded-lg border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 p-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-primary-700 dark:text-primary-300 truncate flex-1">
                            Share this invite link with your colleague
                          </p>
                          <button
                            onClick={copyInviteLink}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-100"
                          >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Members list */}
                  <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    {members.map((m) => {
                      const name = m.user_profiles?.name || m.invited_email || 'Unknown';
                      const email = m.user_profiles?.email || m.invited_email || '';
                      const initial = name.charAt(0).toUpperCase();
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-xs font-bold">
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <RoleBadge role={m.role} />
                            {m.status === 'pending' && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5 border border-amber-200 dark:border-amber-700">
                                Pending
                              </span>
                            )}
                            {isAdmin && m.role !== 'owner' && m.user_profiles?.id && (
                              <button
                                onClick={() => handleRemove(m.user_profiles!.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'workload' && (
                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                  {workloadLoading ? (
                    <div className="p-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                  ) : workload.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No active members yet.</div>
                  ) : (
                    (() => {
                      const max = Math.max(...workload.map((w) => w.assigned_count), 1);
                      return workload.map((w) => (
                        <div key={w.user_id} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-bold">
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{w.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{w.assigned_count} assigned</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(w.assigned_count / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                  {activity.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No activity yet.</div>
                  ) : activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 mt-0.5">
                        {(entry.actor_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{entry.actor_name || 'Someone'}</span>{' '}
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(entry.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'rules' && isAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Automatically assign emails to team members when AI processing completes.
                    </p>
                    <button onClick={() => setAddingRule(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-3 py-2 text-sm font-medium text-white transition-colors">
                      <Plus className="h-4 w-4" />Add Rule
                    </button>
                  </div>

                  {addingRule && (
                    <form onSubmit={handleAddRule} className="card p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Auto-Assign Rule</h3>
                      <select value={ruleForm.condition_type} onChange={(e) => setRuleForm({ ...ruleForm, condition_type: e.target.value })} className="input-field">
                        <option value="sender_domain">Sender Domain</option>
                        <option value="category">Email Category</option>
                        <option value="priority_gte">Priority ≥</option>
                      </select>
                      <input
                        type="text"
                        value={ruleForm.condition_value}
                        onChange={(e) => setRuleForm({ ...ruleForm, condition_value: e.target.value })}
                        placeholder={
                          ruleForm.condition_type === 'sender_domain' ? 'e.g. client.com' :
                          ruleForm.condition_type === 'category' ? 'e.g. urgent' : 'e.g. 7'
                        }
                        required
                        className="input-field"
                      />
                      <select value={ruleForm.assign_to_user_id} onChange={(e) => setRuleForm({ ...ruleForm, assign_to_user_id: e.target.value })} required className="input-field">
                        <option value="">— Select member —</option>
                        {members.filter((m) => m.status === 'active' && m.user_profiles?.id).map((m) => (
                          <option key={m.id} value={m.user_profiles!.id}>{m.user_profiles!.name || m.user_profiles!.email}</option>
                        ))}
                      </select>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setAddingRule(false)} className="btn-secondary text-sm">Cancel</button>
                        <button type="submit" disabled={savingRule} className="btn-primary text-sm gap-2">
                          {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Save
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    {autoRules.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No rules yet.</div>
                    ) : autoRules.map((rule) => {
                      const COND_LABELS: Record<string, string> = { sender_domain: 'Sender domain', category: 'Category', priority_gte: 'Priority ≥' };
                      return (
                        <div key={rule.id} className="flex items-center gap-3 px-5 py-3">
                          <Zap className={`h-4 w-4 flex-shrink-0 ${rule.is_active ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
                              <span className="text-gray-500 dark:text-gray-400">{COND_LABELS[rule.condition_type]}</span>{' '}
                              <span className="font-mono font-medium">{rule.condition_value}</span>{' → '}
                              <span className="font-medium">{rule.user_profiles?.name || rule.assign_to_user_id}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleToggleRule(rule)}
                              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors cursor-pointer ${rule.is_active ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
