import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  User,
  Link2,
  Bell,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  TestTube2,
  Mail,
  Plane,
  Filter,
  FileText,
  Shield,
  PenLine,
  Plus,
  Download,
  RefreshCw,
  Copy,
  BadgeCheck,
  Puzzle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import RulesManager from '@/components/RulesManager';
import { useSettings, useGmailStatus } from '@/lib/hooks';
import { apiErrorMessage } from '@/lib/apiError';
import { settingsApi, integrationsApi, outlookApi, calendarApi, gdprApi, webhooksApi, crmApi, pushApi, newsletterApi, emailsApi, type Webhook } from '@/lib/api';
import { registerPushSubscription, unregisterPushSubscription } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { loadTemplates, saveTemplates, createTemplate, type EmailTemplate } from '@/lib/templates';
import type { UserSettings, TonePreference, NotificationFrequency } from '@/lib/types';
import clsx from 'clsx';

type Tab = 'profile' | 'integrations' | 'notifications' | 'vacation' | 'rules' | 'templates' | 'webhooks' | 'data';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile & AI', icon: User },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'vacation', label: 'Vacation', icon: Plane },
  { id: 'rules', label: 'Rules', icon: Filter },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'webhooks', label: 'Webhooks', icon: Link2 },
  { id: 'data', label: 'Data & Privacy', icon: Shield },
];

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (data: Partial<UserSettings>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    company_description: settings.company_description ?? '',
    tone_preference: settings.tone_preference ?? 'professional',
    email_signature: settings.email_signature ?? '',
    industry: settings.industry ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState(settings.badge_enabled ?? false);
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(settings.benchmark_opt_in ?? false);
  const [benchmarkSaving, setBenchmarkSaving] = useState(false);

  const handleBenchmarkToggle = async () => {
    const next = !benchmarkOptIn;
    setBenchmarkOptIn(next);
    setBenchmarkSaving(true);
    try {
      await onSave({ benchmark_opt_in: next });
    } catch {
      setBenchmarkOptIn(!next);
    } finally {
      setBenchmarkSaving(false);
    }
  };

  const INDUSTRIES = [
    'Web / Design Agency',
    'Marketing Agency',
    'Consulting',
    'Freelance / Solo',
    'Real Estate',
    'Legal',
    'Accounting / Finance',
    'Other',
  ];

  const badgeUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/public/badge/${settings.id}/response-time.svg`;
  const badgeEmbed = `<a href="https://mailair.company"><img src="${badgeUrl}" alt="Mailair response time badge" /></a>`;

  const handleBadgeToggle = async () => {
    const next = !badgeEnabled;
    setBadgeEnabled(next);
    setBadgeSaving(true);
    try {
      await onSave({ badge_enabled: next });
    } catch {
      setBadgeEnabled(!next);
    } finally {
      setBadgeSaving(false);
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(badgeEmbed);
      toast.success('Embed code copied');
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const copyExtensionToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error('No active session — try signing in again');
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      toast.success('Token copied — paste into the extension. It expires after about an hour, so re-copy if it stops working.');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  const tones: { value: TonePreference; label: string; description: string }[] = [
    { value: 'professional', label: 'Professional', description: 'Formal, business-appropriate tone' },
    { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
    { value: 'concise', label: 'Concise', description: 'Short and to the point' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Business Context</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Company / Business Description
            </label>
            <textarea
              value={form.company_description}
              onChange={(e) => setForm({ ...form, company_description: e.target.value })}
              rows={4}
              className="input-field resize-none"
              placeholder="Describe your business so AI can draft better replies... e.g. 'We are a web design agency specializing in e-commerce for small businesses. We value quick responses and professional communication.'"
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              This context helps AI draft better replies and understand your email priorities.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Industry
            </label>
            <select
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="input-field"
            >
              <option value="">Not set</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Used to group you into the right cohort for response-time benchmarks.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Reply Tone Preference</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">How should AI draft your email replies?</p>
        <div className="space-y-3">
          {tones.map((tone) => (
            <label
              key={tone.value}
              className={clsx(
                'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors',
                form.tone_preference === tone.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              )}
            >
              <input
                type="radio"
                name="tone"
                value={tone.value}
                checked={form.tone_preference === tone.value}
                onChange={() => setForm({ ...form, tone_preference: tone.value })}
                className="mt-0.5 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tone.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tone.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Email Signature</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Automatically appended to AI-generated reply drafts.</p>
        <textarea
          value={form.email_signature}
          onChange={(e) => setForm({ ...form, email_signature: e.target.value })}
          rows={4}
          className="input-field resize-none"
          placeholder="Best regards,&#10;Your Name&#10;Company | +1 555-0100"
        />
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary-600" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Public Response-Time Badge</h3>
          </div>
          <button
            type="button"
            onClick={handleBadgeToggle}
            disabled={badgeSaving}
            className={clsx(
              'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50',
              badgeEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                badgeEnabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Show a live &quot;avg response time&quot; badge on your own site, computed from your real reply history. Nothing else about your inbox is exposed.
        </p>
        {badgeEnabled && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Embed on your website</p>
              <button type="button" onClick={copyEmbed} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <code className="block text-xs text-gray-600 dark:text-gray-300 break-all font-mono">{badgeEmbed}</code>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="Response time badge preview" className="mt-3" />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Contribute to industry benchmarks</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">
              Anonymously include your response time in the public {form.industry || 'industry'} benchmark on{' '}
              <Link href="/benchmarks" className="text-primary-600 hover:underline">mailair.company/benchmarks</Link>. Never shown individually.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBenchmarkToggle}
            disabled={benchmarkSaving}
            className={clsx(
              'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50',
              benchmarkOptIn ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                benchmarkOptIn ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Puzzle className="h-4 w-4 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browser Extension</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Draft and send AI replies from Gmail or LinkedIn, and see a live priority panel in Gmail. Load the extension, then paste in these two values.
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3.5 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API URL</p>
            <code className="block text-xs text-gray-700 dark:text-gray-300 font-mono">
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            </code>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">API Token</p>
              <button type="button" onClick={copyExtensionToken} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                <Copy className="h-3.5 w-3.5" /> Copy token
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Copies your current session token. It expires after about an hour — come back here and copy a fresh one if the extension stops working.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className="btn-primary gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// ─── Outlook Integration ──────────────────────────────────────────────────────
function OutlookIntegration() {
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    outlookApi.getStatus().then(setStatus).catch(() => setStatus({ connected: false })).finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await outlookApi.connect();
      window.location.href = auth_url;
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to connect Outlook')); setConnecting(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await outlookApi.sync();
      toast.success('Outlook sync started');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to start sync')); }
    finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Outlook?')) return;
    setDisconnecting(true);
    try {
      await outlookApi.disconnect();
      setStatus({ connected: false });
      toast.success('Outlook disconnected');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to disconnect')); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
            <Mail className="h-5 w-5 text-primary-500 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Outlook / Microsoft 365</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect your Microsoft inbox to sync emails</p>
          </div>
        </div>
        {!loading && (
          status?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AlertCircle className="h-3.5 w-3.5" />Not connected
            </span>
          )
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          {status.email && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300">
              <p><span className="font-medium">Account:</span> {status.email}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSync} disabled={syncing} className="btn-secondary text-sm gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleConnect} disabled={connecting} className="btn-primary text-sm gap-2">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Connect Microsoft Account
        </button>
      )}
    </div>
  );
}

// ─── Google Calendar Integration ──────────────────────────────────────────────
function CalendarIntegration() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    calendarApi.getStatus().then(setStatus).catch(() => setStatus({ connected: false })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (router.query.gcal_connected === 'true') {
      setStatus({ connected: true });
      toast.success('Google Calendar connected!');
      router.replace('/settings', undefined, { shallow: true });
    } else if (router.query.gcal_error === 'true') {
      toast.error('Failed to connect Google Calendar. Please try again.');
      router.replace('/settings', undefined, { shallow: true });
    }
  }, [router.query]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await calendarApi.connect();
      window.location.href = auth_url;
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to connect Google Calendar')); setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    setDisconnecting(true);
    try {
      await calendarApi.disconnect();
      setStatus({ connected: false });
      toast.success('Google Calendar disconnected');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to disconnect')); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <PenLine className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Google Calendar</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Detect meeting requests and create calendar events</p>
          </div>
        </div>
        {!loading && (
          status?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AlertCircle className="h-3.5 w-3.5" />Not connected
            </span>
          )
        )}
      </div>

      {status?.connected ? (
        <button onClick={handleDisconnect} disabled={disconnecting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Disconnect Calendar
        </button>
      ) : (
        <button onClick={handleConnect} disabled={connecting} className="btn-primary text-sm gap-2">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Connect Google Calendar
        </button>
      )}
    </div>
  );
}

// ─── HubSpot Integration ──────────────────────────────────────────────────────
function HubSpotIntegration() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    crmApi.hubspot.getStatus().then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      await crmApi.hubspot.connect(apiKey.trim());
      setStatus({ connected: true });
      setShowForm(false);
      setApiKey('');
      toast.success('HubSpot connected!');
    } catch (err) { toast.error(apiErrorMessage(err, 'Connection failed — check your Private App token.')); }
    finally { setConnecting(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await crmApi.hubspot.test();
      r.success ? toast.success('HubSpot connection is working!') : toast.error('HubSpot test failed');
    } catch (err) { toast.error(apiErrorMessage(err, 'Test failed')); }
    finally { setTesting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect HubSpot?')) return;
    setDisconnecting(true);
    try {
      await crmApi.hubspot.disconnect();
      setStatus({ connected: false });
      toast.success('HubSpot disconnected');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to disconnect')); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20">
            <span className="text-lg font-bold text-orange-500">HS</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">HubSpot CRM</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Auto-sync contacts and notes when emails are processed</p>
          </div>
        </div>
        {status && (
          status.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AlertCircle className="h-3.5 w-3.5" />Not connected
            </span>
          )
        )}
      </div>

      {status?.connected ? (
        <div className="flex gap-2">
          <button onClick={handleTest} disabled={testing} className="btn-secondary text-sm gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}Test
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Disconnect
          </button>
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">HubSpot Private App Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
              className="input-field"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Create a Private App in HubSpot → Settings → Integrations → Private Apps
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={connecting} className="btn-primary text-sm gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}Connect
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm gap-2">
          <ExternalLink className="h-4 w-4" />Connect HubSpot
        </button>
      )}
    </div>
  );
}

// ─── Salesforce Integration ────────────────────────────────────────────────────
function SalesforceIntegration() {
  const [status, setStatus] = useState<{ connected: boolean; username?: string } | null>(null);
  const [form, setForm] = useState({ consumer_key: '', consumer_secret: '', username: '', password: '', security_token: '' });
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    crmApi.salesforce.getStatus().then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      await crmApi.salesforce.connect(form);
      setStatus({ connected: true, username: form.username });
      setShowForm(false);
      setForm({ consumer_key: '', consumer_secret: '', username: '', password: '', security_token: '' });
      toast.success('Salesforce connected!');
    } catch (err) { toast.error(apiErrorMessage(err, 'Connection failed — check your credentials.')); }
    finally { setConnecting(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await crmApi.salesforce.test();
      r.success ? toast.success('Salesforce connection is working!') : toast.error('Salesforce test failed');
    } catch (err) { toast.error(apiErrorMessage(err, 'Test failed')); }
    finally { setTesting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Salesforce?')) return;
    setDisconnecting(true);
    try {
      await crmApi.salesforce.disconnect();
      setStatus({ connected: false });
      toast.success('Salesforce disconnected');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to disconnect')); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/20">
            <span className="text-lg font-bold text-sky-500">SF</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Salesforce CRM</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Push contacts and tasks to Salesforce automatically</p>
          </div>
        </div>
        {status && (
          status.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AlertCircle className="h-3.5 w-3.5" />Not connected
            </span>
          )
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          {status.username && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Account:</span> {status.username}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleTest} disabled={testing} className="btn-secondary text-sm gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}Test
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Disconnect
            </button>
          </div>
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Consumer Key</label>
              <input type="text" value={form.consumer_key} onChange={(e) => setForm({ ...form, consumer_key: e.target.value })} required className="input-field" placeholder="Connected App Consumer Key" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Consumer Secret</label>
              <input type="password" value={form.consumer_secret} onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })} required className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input type="email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required className="input-field" placeholder="user@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Security Token</label>
              <input type="password" value={form.security_token} onChange={(e) => setForm({ ...form, security_token: e.target.value })} className="input-field" placeholder="From Salesforce → My Settings → Security Token" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Requires a Connected App in Salesforce Setup → Apps → App Manager
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={connecting} className="btn-primary text-sm gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}Connect
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm gap-2">
          <ExternalLink className="h-4 w-4" />Connect Salesforce
        </button>
      )}
    </div>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────
function IntegrationsTab({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (data: Partial<UserSettings>) => Promise<void>;
}) {
  const router = useRouter();
  const { data: gmailStatus, mutate: mutateGmail } = useGmailStatus();
  const [slackWebhook, setSlackWebhook] = useState(settings.slack_webhook_url ?? '');
  const [isSavingSlack, setIsSavingSlack] = useState(false);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isDisconnectingGmail, setIsDisconnectingGmail] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  useEffect(() => {
    if (router.query.gmail === 'connected') {
      toast.success('Gmail connected! Syncing your inbox...');
      emailsApi.syncEmails().then(() => mutateGmail()).catch(() => {});
      router.replace('/settings', undefined, { shallow: true });
    }
  }, [router.query]);

  // Sync filter state
  const [showSyncFilters, setShowSyncFilters] = useState(false);
  const [isSavingFilters, setIsSavingFilters] = useState(false);
  const LABEL_OPTIONS = [
    { value: 'INBOX', label: 'Inbox' },
    { value: 'CATEGORY_PROMOTIONS', label: 'Promotions' },
    { value: 'CATEGORY_SOCIAL', label: 'Social' },
    { value: 'CATEGORY_UPDATES', label: 'Updates' },
    { value: 'CATEGORY_FORUMS', label: 'Forums' },
    { value: 'SENT', label: 'Sent' },
  ];
  const [syncLabels, setSyncLabels] = useState<string[]>(settings.sync_labels ?? ['INBOX']);
  const [syncMaxEmails, setSyncMaxEmails] = useState<number>(settings.sync_max_emails ?? 50);
  const [syncDaysBack, setSyncDaysBack] = useState<number>(settings.sync_days_back ?? 0);
  const [syncAllowlist, setSyncAllowlist] = useState<string>(
    (settings.sync_sender_allowlist ?? []).join(', ')
  );
  const [syncBlocklist, setSyncBlocklist] = useState<string>(
    (settings.sync_sender_blocklist ?? []).join(', ')
  );

  const handleSaveSyncFilters = async () => {
    setIsSavingFilters(true);
    try {
      const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
      await onSave({
        sync_labels: syncLabels.length > 0 ? syncLabels : null,
        sync_max_emails: syncMaxEmails,
        sync_days_back: syncDaysBack > 0 ? syncDaysBack : null,
        sync_sender_allowlist: parseCsv(syncAllowlist).length > 0 ? parseCsv(syncAllowlist) : null,
        sync_sender_blocklist: parseCsv(syncBlocklist).length > 0 ? parseCsv(syncBlocklist) : null,
      });
      toast.success('Sync filters saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save sync filters'));
    } finally {
      setIsSavingFilters(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    try {
      const { auth_url } = await integrationsApi.connectGmail();
      window.location.href = auth_url;
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to initiate Gmail connection'));
      setIsConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async (deleteEmails: boolean) => {
    setShowDisconnectModal(false);
    setIsDisconnectingGmail(true);
    try {
      await integrationsApi.disconnectGmail(deleteEmails);
      await mutateGmail();
      toast.success(deleteEmails ? 'Gmail disconnected and emails deleted' : 'Gmail disconnected');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to disconnect Gmail'));
    } finally {
      setIsDisconnectingGmail(false);
    }
  };

  const handleSaveSlack = async () => {
    setIsSavingSlack(true);
    try {
      await integrationsApi.saveSlackWebhook(slackWebhook);
      await onSave({ slack_webhook_url: slackWebhook });
      toast.success('Slack webhook saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save Slack webhook'));
    } finally {
      setIsSavingSlack(false);
    }
  };

  const handleTestSlack = async () => {
    if (!slackWebhook) {
      toast.error('Enter a webhook URL first');
      return;
    }
    setIsTestingSlack(true);
    try {
      const result = await integrationsApi.testSlackWebhook();
      if (result.success) {
        toast.success('Test message sent to Slack!');
      } else {
        toast.error(result.message || 'Slack test failed');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to send test message'));
    } finally {
      setIsTestingSlack(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Gmail */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <Mail className="h-5 w-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Gmail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect Gmail to sync and process emails</p>
            </div>
          </div>
          {gmailStatus?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AlertCircle className="h-3.5 w-3.5" />
              Not connected
            </span>
          )}
        </div>

        {gmailStatus?.connected ? (
          <>
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300">
                <p><span className="font-medium">Account:</span> {gmailStatus.email}</p>
                {gmailStatus.last_sync && (
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    Last synced: {new Date(gmailStatus.last_sync).toLocaleString()}
                  </p>
                )}
                {gmailStatus.total_synced != null && (
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">Total emails synced: {gmailStatus.total_synced?.toLocaleString()}</p>
                )}
              </div>
              <button
                onClick={() => setShowDisconnectModal(true)}
                disabled={isDisconnectingGmail}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isDisconnectingGmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Disconnect Gmail
              </button>
            </div>

            {/* Sync Filters */}
            <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
              <button
                onClick={() => setShowSyncFilters((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  Sync Filters
                  <span className="rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-700 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                    {syncLabels.length} label{syncLabels.length !== 1 ? 's' : ''} · {syncMaxEmails} emails
                  </span>
                </span>
                <span className="text-gray-400">{showSyncFilters ? '▲' : '▼'}</span>
              </button>

              {showSyncFilters && (
                <div className="mt-4 space-y-4">
                  {/* Label selector */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Sync from these folders</p>
                    <div className="flex flex-wrap gap-2">
                      {LABEL_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={syncLabels.includes(opt.value)}
                            onChange={(e) =>
                              setSyncLabels((prev) =>
                                e.target.checked
                                  ? [...prev, opt.value]
                                  : prev.filter((l) => l !== opt.value)
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Max emails + days back */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Max emails per sync
                      </label>
                      <select
                        value={syncMaxEmails}
                        onChange={(e) => setSyncMaxEmails(Number(e.target.value))}
                        className="input-field py-1.5 text-sm"
                      >
                        {[10, 25, 50, 100, 200].map((n) => (
                          <option key={n} value={n}>{n} emails</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Only fetch emails newer than
                      </label>
                      <select
                        value={syncDaysBack}
                        onChange={(e) => setSyncDaysBack(Number(e.target.value))}
                        className="input-field py-1.5 text-sm"
                      >
                        <option value={0}>All time</option>
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                      </select>
                    </div>
                  </div>

                  {/* Sender allow/block lists */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Only sync from (allowlist) — comma-separated emails/domains
                    </label>
                    <input
                      type="text"
                      value={syncAllowlist}
                      onChange={(e) => setSyncAllowlist(e.target.value)}
                      placeholder="e.g. client@company.com, @important.com"
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Never sync from (blocklist) — comma-separated emails/domains
                    </label>
                    <input
                      type="text"
                      value={syncBlocklist}
                      onChange={(e) => setSyncBlocklist(e.target.value)}
                      placeholder="e.g. noreply@, @newsletter.com"
                      className="input-field text-sm"
                    />
                  </div>

                  <button
                    onClick={handleSaveSyncFilters}
                    disabled={isSavingFilters}
                    className="btn-primary text-sm gap-2"
                  >
                    {isSavingFilters ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Sync Filters
                  </button>
                </div>
              )}
            </div>

            {showDisconnectModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Disconnect Gmail</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    What would you like to do with your existing emails in Mailair?
                  </p>
                  <div className="space-y-3 mb-6">
                    <button
                      onClick={() => handleDisconnectGmail(false)}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Keep my emails</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Disconnect Gmail but keep all synced emails in Mailair.</p>
                    </button>
                    <button
                      onClick={() => handleDisconnectGmail(true)}
                      className="w-full rounded-xl border border-red-200 dark:border-red-800 p-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete my emails</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Disconnect Gmail and permanently delete all synced emails.</p>
                    </button>
                  </div>
                  <button
                    onClick={() => setShowDisconnectModal(false)}
                    className="w-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={handleConnectGmail}
            disabled={isConnectingGmail}
            className="btn-primary text-sm gap-2"
          >
            {isConnectingGmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Connect Gmail Account
          </button>
        )}
      </div>

      {/* Outlook / Microsoft 365 */}
      <OutlookIntegration />

      {/* Google Calendar */}
      <CalendarIntegration />

      {/* HubSpot CRM */}
      <HubSpotIntegration />

      {/* Salesforce CRM */}
      <SalesforceIntegration />

      {/* Slack */}
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <Bell className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Slack Notifications</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get notified in Slack for urgent emails</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Slack Webhook URL
            </label>
            <input
              type="url"
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="input-field"
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Create a webhook at{' '}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                api.slack.com/messaging/webhooks
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSlack}
              disabled={isSavingSlack}
              className="btn-primary text-sm gap-2"
            >
              {isSavingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Webhook
            </button>
            <button
              onClick={handleTestSlack}
              disabled={isTestingSlack || !slackWebhook}
              className="btn-secondary text-sm gap-2"
            >
              {isTestingSlack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4" />
              )}
              Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (data: Partial<UserSettings>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    email_notifications: settings.email_notifications,
    slack_notifications: settings.slack_notifications,
    notification_frequency: settings.notification_frequency ?? 'instant',
    auto_process_emails: settings.auto_process_emails,
    priority_threshold: settings.priority_threshold ?? 7,
    digest_enabled: settings.digest_enabled ?? false,
    digest_frequency: settings.digest_frequency ?? 'daily',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  useEffect(() => {
    newsletterApi.getStatus().then((s) => setNewsletterSubscribed(s.subscribed)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub))
    ).catch(() => {});
  }, []);

  const handleTogglePush = async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const sub = await registerPushSubscription();
        if (sub) {
          await pushApi.subscribe(sub);
          setPushEnabled(true);
          toast.success('Push notifications enabled');
        } else {
          toast.error('Push notifications not supported or permission denied');
        }
      } else {
        await unregisterPushSubscription();
        await pushApi.unsubscribe();
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update push notifications'));
    } finally {
      setPushLoading(false);
    }
  };

  const handleToggleNewsletter = async (enabled: boolean) => {
    setNewsletterLoading(true);
    try {
      if (enabled) {
        await newsletterApi.subscribe();
        setNewsletterSubscribed(true);
        toast.success('Subscribed to AI Pulse newsletter!');
      } else {
        await newsletterApi.unsubscribe();
        setNewsletterSubscribed(false);
        toast.success('Unsubscribed from newsletter');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update newsletter subscription'));
    } finally {
      setNewsletterLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  const frequencies: { value: NotificationFrequency; label: string }[] = [
    { value: 'instant', label: 'Instantly' },
    { value: 'hourly', label: 'Hourly digest' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'never', label: 'Never' },
  ];

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange?: (v: boolean) => void;
  }) => (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange?.(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          checked ? 'bg-primary-600' : 'bg-gray-200'
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={clsx(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Notification Preferences</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Control how and when Mailair notifies you.</p>

        <ToggleRow
          label="Email Notifications"
          description="Receive notification emails for urgent messages"
          checked={form.email_notifications}
          onChange={(v) => setForm({ ...form, email_notifications: v })}
        />
        <ToggleRow
          label="Slack Notifications"
          description="Send urgent email alerts to your Slack channel"
          checked={form.slack_notifications}
          onChange={(v) => setForm({ ...form, slack_notifications: v })}
        />
        {/* Email digest */}
        <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <ToggleRow
            label="Email Digest"
            description="Receive a summary of your most important emails in your inbox"
            checked={form.digest_enabled}
            onChange={(v) => setForm({ ...form, digest_enabled: v })}
          />
          {form.digest_enabled && (
            <div className="flex gap-3 pl-1">
              {(['daily', 'weekly'] as const).map((freq) => (
                <label key={freq} className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm',
                  form.digest_frequency === freq
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                )}>
                  <input
                    type="radio"
                    name="digest_frequency"
                    value={freq}
                    checked={form.digest_frequency === freq}
                    onChange={() => setForm({ ...form, digest_frequency: freq })}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  {freq === 'daily' ? 'Daily (8am UTC)' : 'Weekly (Mon 8am)'}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Browser push */}
        <ToggleRow
          label="Browser Push Notifications"
          description="Get notified instantly when an urgent email arrives (priority 8+)"
          checked={pushEnabled}
          onChange={pushLoading ? undefined : handleTogglePush}
        />

        <ToggleRow
          label="Auto-process Emails"
          description="Automatically run AI analysis on new emails as they arrive"
          checked={form.auto_process_emails}
          onChange={(v) => setForm({ ...form, auto_process_emails: v })}
        />
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Frequency</h3>
        <div className="grid grid-cols-2 gap-2">
          {frequencies.map((freq) => (
            <label
              key={freq.value}
              className={clsx(
                'flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
                form.notification_frequency === freq.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <input
                type="radio"
                name="frequency"
                value={freq.value}
                checked={form.notification_frequency === freq.value}
                onChange={() => setForm({ ...form, notification_frequency: freq.value })}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{freq.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Priority Threshold</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Emails scoring above this threshold will be flagged as urgent.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={10}
            value={form.priority_threshold}
            onChange={(e) => setForm({ ...form, priority_threshold: Number(e.target.value) })}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary-600"
          />
          <span className="w-16 text-center rounded-lg bg-primary-50 border border-primary-200 px-3 py-1.5 text-sm font-bold text-primary-700">
            {form.priority_threshold}/10
          </span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>More alerts (1)</span>
          <span>Fewer alerts (10)</span>
        </div>
      </div>

      {/* AI Pulse Newsletter */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">AI Pulse Newsletter</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Weekly digest of AI trends, new tools, and industry news — delivered every Monday morning.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['AI advancements', 'New LLM releases', 'Business AI tools', 'Industry trends'].map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/20 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-700">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={newsletterLoading}
            onClick={() => handleToggleNewsletter(!newsletterSubscribed)}
            className={clsx(
              'flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              newsletterSubscribed ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <span className={clsx(
              'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              newsletterSubscribed ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>
        </div>
        {newsletterSubscribed && (
          <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Subscribed — you&apos;ll receive your first issue next Monday.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className="btn-primary gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}

// ─── Vacation Tab ─────────────────────────────────────────────────────────────
function VacationTab({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (data: Partial<UserSettings>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    vacation_mode: settings.vacation_mode ?? false,
    vacation_message: settings.vacation_message ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
            <Plane className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Vacation / Out of Office</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Automatically reply to emails while you&apos;re away</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable vacation auto-reply</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Send automatic replies to incoming emails</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, vacation_mode: !form.vacation_mode })}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                form.vacation_mode ? 'bg-primary-600' : 'bg-gray-200'
              )}
              role="switch"
              aria-checked={form.vacation_mode}
            >
              <span
                className={clsx(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
                  form.vacation_mode ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Auto-reply message
            </label>
            <textarea
              value={form.vacation_message}
              onChange={(e) => setForm({ ...form, vacation_message: e.target.value })}
              rows={5}
              className="input-field resize-none"
              placeholder="Hi, I'm currently out of office and will return on [date]. I'll reply to your email as soon as possible."
              disabled={!form.vacation_mode}
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              This message will be sent automatically when vacation mode is enabled.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSaving} className="btn-primary gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────
function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { setTemplates(loadTemplates()); }, []);

  const handleAdd = () => {
    if (!newName.trim() || !newBody.trim()) { toast.error('Name and body are required'); return; }
    const t = createTemplate(newName.trim(), newBody.trim());
    const updated = [...templates, t];
    saveTemplates(updated);
    setTemplates(updated);
    setNewName(''); setNewBody(''); setAdding(false);
    toast.success('Template saved');
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  };

  const DEFAULT_IDS = new Set(['tpl_following_up', 'tpl_decline', 'tpl_meeting_confirm', 'tpl_request_info']);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Quick-insert templates for the reply editor.
        </p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-3 py-2 text-sm font-medium text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {adding && (
        <div className="card p-5 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="input-field"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Template body..."
            rows={5}
            className="input-field resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleAdd} className="btn-primary text-sm gap-2">
              <Save className="h-4 w-4" />Save
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.name}</p>
                  {DEFAULT_IDS.has(t.id) && (
                    <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-gray-500 dark:text-gray-400">Default</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 whitespace-pre-line">{t.body}</p>
              </div>
              {!DEFAULT_IDS.has(t.id) && (
                <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────
function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', event: 'urgent_email', secret: '' });

  useEffect(() => {
    webhooksApi.list().then(setWebhooks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const wh = await webhooksApi.create({ ...form, secret: form.secret || undefined });
      setWebhooks((prev) => [wh, ...prev]);
      setForm({ name: '', url: '', event: 'urgent_email', secret: '' });
      setAdding(false);
      toast.success('Webhook created');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to create webhook. URL must use HTTPS.')); }
    finally { setSaving(false); }
  };

  const handleToggle = async (wh: Webhook) => {
    try {
      const updated = await webhooksApi.update(wh.id, { is_active: !wh.is_active });
      setWebhooks((prev) => prev.map((w) => w.id === wh.id ? updated : w));
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to update webhook')); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await webhooksApi.remove(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to delete webhook')); }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await webhooksApi.test(id);
      if (result.success) toast.success(`Test delivered (${result.status_code})`);
      else toast.error(result.error || `Delivery failed (${result.status_code})`);
    } catch (err) { toast.error(apiErrorMessage(err, 'Test failed')); }
    finally { setTesting(null); }
  };

  const EVENT_LABELS: Record<string, string> = {
    urgent_email: 'Urgent Email',
    reply_sent: 'Reply Sent',
    action_created: 'Action Created',
    all: 'All Events',
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Receive HTTP POST notifications when events occur in Mailair.
        </p>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-3 py-2 text-sm font-medium text-white transition-colors">
          <Plus className="h-4 w-4" />Add Webhook
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Webhook</h3>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. My Zapier hook)" required className="input-field" />
          <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." required className="input-field" />
          <select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className="input-field">
            {Object.entries(EVENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="text" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="Secret (optional, sent as X-Mailair-Secret header)" className="input-field" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : webhooks.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No webhooks configured yet. Add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{wh.name}</p>
                  <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-gray-500 dark:text-gray-400">
                    {EVENT_LABELS[wh.event] ?? wh.event}
                  </span>
                  {!wh.is_active && (
                    <span className="text-xs rounded-full bg-red-100 dark:bg-red-900/20 px-2 py-0.5 text-red-600 dark:text-red-400">Disabled</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{wh.url}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleTest(wh.id)}
                  disabled={testing === wh.id}
                  className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                  title="Send test"
                >
                  {testing === wh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleToggle(wh)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${wh.is_active ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                  title={wh.is_active ? 'Disable' : 'Enable'}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${wh.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <button onClick={() => handleDelete(wh.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Data & Privacy Tab ───────────────────────────────────────────────────────
function DataTab() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await gdprApi.exportData();
      toast.success('Data exported!');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to export data'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('This will permanently delete your account and ALL your data. This cannot be undone. Are you sure?')) return;
    if (!confirm('Final confirmation: Delete my account and all my data?')) return;
    setDeleting(true);
    try {
      await gdprApi.deleteAccount();
      toast.success('Account deleted. Redirecting...');
      setTimeout(() => { window.location.href = '/auth/signin'; }, 2000);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete account'));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20">
            <Download className="h-5 w-5 text-primary-500 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Export My Data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Download all your emails, actions, and settings as a JSON file.
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Exporting...' : 'Download My Data'}
        </button>
      </div>

      <div className="card p-6 border-red-200 dark:border-red-800">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
            <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-red-700 dark:text-red-400">Delete Account</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Permanently delete your account and all associated data. This action is irreversible.
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {deleting ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const { data: settings, isLoading: settingsLoading, error: settingsError, mutate } = useSettings();

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace('/auth/signin');
    }
  }, [session, sessionLoading, router]);

  if (sessionLoading || settingsLoading) return <LoadingSpinner fullPage />;
  if (!session) return null;
  if (settingsError) return (
    <Layout title="Settings">
      <PageError message="Couldn't load your settings" onRetry={() => mutate()} />
    </Layout>
  );

  const handleSave = async (updates: Partial<UserSettings>) => {
    try {
      const updated = await settingsApi.updateSettings(updates);
      await mutate(updated, false);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save settings'));
      throw new Error('Save failed');
    }
  };

  return (
    <>
      <Head>
        <title>Settings — Mailair</title>
      </Head>
      <Layout title="Settings">
        <div className="max-w-4xl mx-auto">
          {/* Tab nav */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const { icon: Icon } = tab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all flex-shrink-0',
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

          {/* Tab content */}
          {settings ? (
            <>
              {activeTab === 'profile' && (
                <ProfileTab settings={settings} onSave={handleSave} />
              )}
              {activeTab === 'integrations' && (
                <IntegrationsTab settings={settings} onSave={handleSave} />
              )}
              {activeTab === 'notifications' && (
                <NotificationsTab settings={settings} onSave={handleSave} />
              )}
              {activeTab === 'vacation' && (
                <VacationTab settings={settings} onSave={handleSave} />
              )}
              {activeTab === 'rules' && <RulesManager />}
              {activeTab === 'templates' && <TemplatesTab />}
              {activeTab === 'webhooks' && <WebhooksTab />}
              {activeTab === 'data' && <DataTab />}
            </>
          ) : (
            <div className="card p-12 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Could not load settings. Please refresh the page.</p>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
