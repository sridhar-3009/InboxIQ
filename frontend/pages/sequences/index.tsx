import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { Repeat2, Plus, Trash2, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { sequencesApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { FollowUpSequence, SequenceEnrollment } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  completed: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through',
  failed:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const DEFAULT_STEPS = [
  { delay_days: 3, subject_template: 'Following up on my last message', body_template: 'Hi,\n\nI wanted to follow up on my previous email. Would love to connect when you have a moment.\n\nBest regards' },
  { delay_days: 7, subject_template: 'Quick check-in', body_template: 'Hi,\n\nJust a quick check-in — have you had a chance to review my previous message?\n\nHappy to jump on a quick call if helpful.\n\nBest regards' },
];

export default function SequencesPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState(DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      const [seqData, enrollData] = await Promise.all([sequencesApi.getAll(), sequencesApi.getEnrollments()]);
      setSequences(seqData.sequences || []);
      setEnrollments(enrollData.enrollments || []);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, 'Failed to load sequences'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleCreate = async () => {
    if (!newName) return toast.error('Name required');
    if (newSteps.length === 0) return toast.error('Add at least one step');
    setSaving(true);
    try {
      await sequencesApi.create(newName, newSteps);
      toast.success('Sequence created');
      setShowCreate(false);
      setNewName('');
      setNewSteps(DEFAULT_STEPS);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create sequence'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sequencesApi.delete(id);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Delete failed'));
    }
  };

  const handleCancelEnrollment = async (id: string) => {
    try {
      await sequencesApi.cancelEnrollment(id);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Cancel failed'));
    }
  };

  const updateStep = (i: number, field: string, value: string | number) => {
    setNewSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;
  if (loadError && sequences.length === 0) return (
    <Layout title="Follow-up Sequences">
      <PageError message="Couldn't load sequences" onRetry={() => { setLoadError(false); load(); }} />
    </Layout>
  );

  const activeEnrollments = enrollments.filter(e => e.status === 'active');

  return (
    <>
      <Head><title>Follow-up Sequences — Mailair</title></Head>
      <Layout title="Follow-up Sequences">
        <div className="max-w-4xl mx-auto space-y-6">

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Automated multi-step follow-up campaigns</p>
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> New Sequence
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Follow-up Sequence</h3>
              <div>
                <label className="text-xs font-medium text-gray-500">Sequence Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Cold Outreach Follow-up" className="input mt-1 w-full" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Steps</label>
                  <button type="button" onClick={() => setNewSteps(prev => [...prev, { delay_days: 7, subject_template: '', body_template: '' }])} className="text-xs text-primary-600 hover:underline">
                    + Add Step
                  </button>
                </div>
                {newSteps.map((step, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">Step {i + 1}</span>
                      {newSteps.length > 1 && (
                        <button onClick={() => setNewSteps(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-400">Send after (days)</label>
                        <input type="number" value={step.delay_days} onChange={e => updateStep(i, 'delay_days', Number(e.target.value))} className="input mt-1 w-full text-sm" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400">Subject</label>
                        <input value={step.subject_template} onChange={e => updateStep(i, 'subject_template', e.target.value)} className="input mt-1 w-full text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Email body</label>
                      <textarea value={step.body_template} onChange={e => updateStep(i, 'body_template', e.target.value)} rows={3} className="input mt-1 w-full text-sm resize-none" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Creating…' : 'Create Sequence'}
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Sequences list */}
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 animate-pulse h-16" />)}</div>
          ) : sequences.length === 0 ? (
            <div className="card p-12 text-center">
              <Repeat2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">No sequences yet.</p>
              <p className="text-sm text-gray-400">Create a sequence, then enroll contacts from email view.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sequences.map(seq => (
                <div key={seq.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setExpandedSeq(expandedSeq === seq.id ? null : seq.id)}>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{seq.name}</p>
                        <p className="text-xs text-gray-500">{seq.steps.length} steps · {seq.active_enrollments} active enrollments</p>
                      </div>
                      {expandedSeq === seq.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    <button onClick={() => handleDelete(seq.id)} className="text-gray-400 hover:text-red-500 p-1.5 ml-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {expandedSeq === seq.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-2">
                      {seq.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Day {step.delay_days}: {step.subject_template}</p>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{step.body_template}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Active enrollments */}
          {activeEnrollments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Active Enrollments ({activeEnrollments.length})</h3>
              <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                {activeEnrollments.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.contact_email}</p>
                      <p className="text-xs text-gray-500">
                        {e.follow_up_sequences?.name} · Step {e.current_step + 1} · Next: {new Date(e.next_send_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}>{e.status}</span>
                      <button onClick={() => handleCancelEnrollment(e.id)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
