import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from './supabase';
import type {
  Email,
  EmailStats,
  PriorityInbox,
  Action,
  ReplyDraft,
  UserSettings,
  GmailStatus,
  BillingStatus,
  PaginatedResponse,
  EmailFilters,
  ActionFilters,
  ActionStatus,
  ContactProfile,
  ContactDetail,
  QuoteData,
  MeetingInfo,
  Organization,
  OrgMember,
  EmailAssignment,
  InternalNote,
  ActivityLogEntry,
  AdminStats,
  CalendarEvent,
  VoiceMatchSummary,
  ClientTouchpoint,
  Benchmark,
  TeamDoc,
  TeamFile,
  TeamChannel,
  TeamMessage,
  WorkspaceSettings,
} from './types';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Request interceptor: inject Supabase auth token
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do NOT call signOut() here — that would wipe the localStorage session
    // on any transient 401 (e.g. token not yet attached when SWR fires on mount),
    // causing an infinite signout→redirect→signin loop.
    // The Layout auth guard handles redirecting unauthenticated users.
    return Promise.reject(error);
  }
);

// ─── Email Endpoints ──────────────────────────────────────────────────────────

export const emailsApi = {
  getEmails: async (filters: EmailFilters = {}): Promise<PaginatedResponse<Email>> => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.priority_level) params.set('priority_level', filters.priority_level);
    if (filters.is_read !== undefined) params.set('is_read', String(filters.is_read));
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.page_size) params.set('page_size', String(filters.page_size));
    if (filters.sort_by) params.set('sort_by', filters.sort_by);
    if (filters.sort_order) params.set('sort_order', filters.sort_order);
    const { data } = await api.get(`/api/emails?${params.toString()}`);
    return data;
  },

  getEmail: async (id: string): Promise<Email> => {
    const { data } = await api.get(`/api/emails/${id}`);
    return data;
  },

  getEmailStats: async (): Promise<EmailStats> => {
    const { data } = await api.get('/api/emails/stats');
    return data;
  },

  getPriorityInbox: async (): Promise<PriorityInbox> => {
    const { data } = await api.get('/api/emails/priority-inbox');
    return data;
  },

  processEmail: async (id: string): Promise<Email> => {
    const { data } = await api.post(`/api/emails/${id}/process`);
    return data;
  },

  deleteEmail: async (id: string): Promise<void> => {
    await api.delete(`/api/emails/${id}`);
  },

  syncEmails: async (): Promise<void> => {
    await api.post('/api/emails/sync');
  },

  bulkProcess: async (): Promise<{ count: number }> => {
    const { data } = await api.post('/api/emails/bulk-process');
    return data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.patch(`/api/emails/${id}/read`);
  },

  getAnalytics: async (): Promise<{
    total_emails: number;
    processed_emails: number;
    unread_emails: number;
    processing_rate: number;
    by_category: Record<string, number>;
    by_priority: Record<string, number>;
    emails_per_day: Array<{ day: string; count: number }>;
  }> => {
    const { data } = await api.get('/api/emails/analytics');
    return data;
  },

  generateReply: async (id: string, instructions: string): Promise<{ draft_content: string; confidence_score: number }> => {
    const { data } = await api.post(`/api/emails/${id}/generate-reply`, { instructions });
    return data;
  },

  getAttachments: async (id: string): Promise<Array<{ attachment_id: string; message_id: string; filename: string; mime_type: string; size: number }>> => {
    const { data } = await api.get(`/api/emails/${id}/attachments`);
    return data;
  },

  summarizeAttachment: async (id: string, attachmentId: string, filename: string, mimeType: string): Promise<{ summary: string; filename: string }> => {
    const { data } = await api.post(`/api/emails/${id}/attachments/${attachmentId}/summarize?filename=${encodeURIComponent(filename)}&mime_type=${encodeURIComponent(mimeType)}`);
    return data;
  },

  unsubscribe: async (id: string): Promise<{ success: boolean; url: string; error?: string }> => {
    const { data } = await api.post(`/api/emails/${id}/unsubscribe`);
    return data;
  },

  getAttachmentDownloadUrl: (id: string, attachmentId: string, filename: string, mimeType: string): string => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${base}/api/emails/${id}/attachments/${attachmentId}/download?filename=${encodeURIComponent(filename)}&mime_type=${encodeURIComponent(mimeType)}`;
  },

  starEmail: async (id: string, starred: boolean): Promise<void> => {
    await api.patch(`/api/emails/${id}/star`, { starred });
  },

  snoozeEmail: async (id: string, snoozeUntil: string | null): Promise<void> => {
    await api.patch(`/api/emails/${id}/snooze`, { snooze_until: snoozeUntil });
  },

  toggleFollowUp: async (id: string, waiting: boolean): Promise<void> => {
    await api.patch(`/api/emails/${id}/follow-up`, { waiting });
  },

  getSnoozed: async (): Promise<Email[]> => {
    const { data } = await api.get('/api/emails/snoozed');
    return data;
  },

  getThread: async (threadId: string): Promise<Email[]> => {
    const { data } = await api.get(`/api/emails/thread/${threadId}`);
    return data;
  },

  forwardToSlack: async (id: string): Promise<void> => {
    await api.post(`/api/emails/${id}/forward-to-slack`);
  },

  askAI: async (id: string, question: string): Promise<{ answer: string }> => {
    const { data } = await api.post(`/api/emails/${id}/ask`, { question });
    return data;
  },

  inboxZero: async (): Promise<{ dismissed: number; message: string }> => {
    const { data } = await api.post('/api/emails/inbox-zero');
    return data;
  },

  bulkSummarize: async (ids: string[]): Promise<Array<{ id: string; summary: string }>> => {
    const { data } = await api.post('/api/emails/bulk-summarize', { email_ids: ids });
    return data;
  },

  bulkDismiss: async (ids: string[]): Promise<{ dismissed: number }> => {
    const { data } = await api.post('/api/emails/bulk-dismiss', { email_ids: ids });
    return data;
  },

  bulkMarkRead: async (ids: string[]): Promise<{ updated: number }> => {
    const { data } = await api.post('/api/emails/bulk-read', { email_ids: ids });
    return data;
  },

  getFollowUps: async (): Promise<Email[]> => {
    const { data } = await api.get('/api/emails/follow-ups');
    return data;
  },

  getSenderInsights: async (): Promise<Array<{
    sender_email: string;
    sender_name: string;
    count: number;
    last_email_at: string;
    categories: Record<string, number>;
  }>> => {
    const { data } = await api.get('/api/emails/sender-insights');
    return data;
  },

  getResponseTimeAnalytics: async (): Promise<{
    overall_avg_hours: number;
    by_category: Record<string, number>;
    daily_trend: Array<{ day: string; avg_hours: number }>;
    total_replied: number;
  }> => {
    const { data } = await api.get('/api/emails/response-time');
    return data;
  },

  exportCSV: async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${base}/api/emails/export`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailair-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  generateQuote: async (
    id: string,
    body: { project_description?: string; budget_hint?: string }
  ): Promise<{ quote: QuoteData; email_id: string }> => {
    const { data } = await api.post(`/api/emails/${id}/generate-quote`, body);
    return data;
  },

  getMeetingInfo: async (id: string): Promise<MeetingInfo> => {
    const { data } = await api.get(`/api/emails/${id}/meeting-info`);
    return data;
  },

  getRecurringSenders: async (): Promise<Record<string, number>> => {
    const { data } = await api.get('/api/emails/recurring-senders');
    return data;
  },

  bulkCategorize: async (ids: string[], category: string): Promise<{ updated: number }> => {
    const { data } = await api.post('/api/emails/bulk-categorize', { email_ids: ids, category });
    return data;
  },

  getThreadSummary: async (id: string): Promise<{
    thread_length: number;
    summary: string | null;
    key_points: string[];
    next_action: string | null;
    sentiment: string;
    status: string;
  }> => {
    const { data } = await api.get(`/api/emails/${id}/thread-summary`);
    return data;
  },

  pinEmail: async (id: string, pinned: boolean): Promise<void> => {
    await api.patch(`/api/emails/${id}/pin`, { pinned });
  },

  muteEmail: async (id: string, muted: boolean): Promise<void> => {
    await api.patch(`/api/emails/${id}/mute`, { muted });
  },

  getSmartReplies: async (id: string): Promise<string[]> => {
    const { data } = await api.post(`/api/emails/${id}/smart-replies`);
    return data.suggestions || [];
  },

  composeEmail: async (to: string, subject: string, body: string): Promise<void> => {
    await api.post('/api/emails/compose', { to, subject, body });
  },

  aiDraft: async (to: string, subject: string, context: string): Promise<{ draft: string }> => {
    const { data } = await api.post('/api/emails/ai-draft', { to, subject, context });
    return data;
  },

  aiSearch: async (query: string, page = 1, pageSize = 20): Promise<{ items: Email[]; total: number; parsed_query: Record<string, unknown>; original_query: string }> => {
    const { data } = await api.post('/api/emails/ai-search', { query, page, page_size: pageSize });
    return data;
  },

  healthScore: async (): Promise<{ score: number; grade: string; breakdown: Record<string, number>; tips: string[] }> => {
    const { data } = await api.get('/api/emails/health-score');
    return data;
  },

  scheduleSend: async (to: string, subject: string, body: string, sendAt: string): Promise<{ id: string }> => {
    const { data } = await api.post('/api/scheduled-sends', { to, subject, body, send_at: sendAt });
    return data;
  },

  listScheduled: async (): Promise<{ items: Array<{ id: string; to_email: string; subject: string; send_at: string; status: string }> }> => {
    const { data } = await api.get('/api/scheduled-sends');
    return data;
  },

  cancelScheduled: async (id: string): Promise<void> => {
    await api.delete(`/api/scheduled-sends/${id}`);
  },
};

// ─── Actions Endpoints ────────────────────────────────────────────────────────

export const actionsApi = {
  getActions: async (filters: ActionFilters = {}): Promise<Action[]> => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.email_id) params.set('email_id', filters.email_id);
    const { data } = await api.get(`/api/actions?${params.toString()}`);
    return data;
  },

  getEmailActions: async (emailId: string): Promise<Action[]> => {
    const { data } = await api.get(`/api/actions/email/${emailId}`);
    return data;
  },

  updateAction: async (
    id: string,
    updates: { status?: ActionStatus; notes?: string; deadline?: string }
  ): Promise<Action> => {
    const { data } = await api.put(`/api/actions/${id}`, updates);
    return data;
  },

  createAction: async (body: {
    task: string;
    priority?: string;
    deadline?: string;
    notes?: string;
    email_id?: string;
  }): Promise<Action> => {
    const { data } = await api.post('/api/actions', body);
    return data;
  },

  deleteAction: async (id: string): Promise<void> => {
    await api.delete(`/api/actions/${id}`);
  },
};

// ─── Replies Endpoints ────────────────────────────────────────────────────────

export const repliesApi = {
  getReplyDraft: async (emailId: string): Promise<ReplyDraft> => {
    const { data } = await api.get(`/api/emails/${emailId}/reply-draft`);
    return data;
  },

  updateReplyDraft: async (
    emailId: string,
    content: string
  ): Promise<ReplyDraft> => {
    const { data } = await api.patch(`/api/emails/${emailId}/reply-draft`, {
      draft_content: content,
    });
    return data;
  },

  sendReply: async (emailId: string, content: string): Promise<{ success: boolean; message_id?: string }> => {
    const { data } = await api.post(`/api/emails/${emailId}/send-reply`, {
      content,
    });
    return data;
  },

  getVoiceMatch: async (): Promise<VoiceMatchSummary> => {
    const { data } = await api.get('/api/replies/voice-match');
    return data;
  },
};

// ─── Integrations Endpoints ───────────────────────────────────────────────────

export const integrationsApi = {
  getGmailStatus: async (): Promise<GmailStatus> => {
    const { data } = await api.get('/api/integrations/gmail/status');
    // backend returns { gmail_connected } — normalise to { connected }
    return { connected: data.gmail_connected, email: data.gmail_address, last_sync: data.last_sync, total_synced: data.total_synced };
  },

  connectGmail: async (): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/api/integrations/gmail/connect');
    return data;
  },

  disconnectGmail: async (deleteEmails = false): Promise<void> => {
    await api.delete('/api/integrations/gmail/disconnect', { params: { delete_emails: deleteEmails } });
  },

  saveSlackWebhook: async (webhookUrl: string): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/integrations/slack/webhook', {
      webhook_url: webhookUrl,
    });
    return { success: true, ...data };
  },

  testSlackWebhook: async (): Promise<{ success: boolean; message?: string }> => {
    const { data } = await api.post('/api/integrations/slack/test');
    return data;
  },
};

// ─── Settings Endpoints ───────────────────────────────────────────────────────

export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const { data } = await api.get('/api/settings');
    return data;
  },

  updateSettings: async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    const { data } = await api.put('/api/settings', settings);
    return data;
  },
};

// ─── Billing Endpoints ────────────────────────────────────────────────────────

export const billingApi = {
  getBillingStatus: async (): Promise<BillingStatus> => {
    const { data } = await api.get('/api/billing/status');
    return data;
  },

  createCheckoutSession: async (
    planId: string,
    interval: 'monthly' | 'yearly' = 'monthly',
  ): Promise<{ checkout_url: string }> => {
    const { data } = await api.post('/api/billing/checkout', {
      plan_id: planId,
      interval,
    });
    return data;
  },

  cancelSubscription: async (): Promise<void> => {
    await api.post('/api/billing/cancel');
  },
};

// ─── Platform Admin Endpoints ──────────────────────────────────────────────

export const adminApi = {
  getStats: async () => {
    const { data } = await api.get('/api/admin/stats');
    return data;
  },
  getUsers: async () => {
    const { data } = await api.get('/api/admin/users');
    return data;
  },
  updateUserPlan: async (userId: string, plan: string) => {
    const { data } = await api.patch(`/api/admin/users/${userId}/plan`, { plan });
    return data;
  },
  getWebhookLogs: async () => {
    const { data } = await api.get('/api/admin/webhooks');
    return data;
  },
};

// ─── Outlook Endpoints ────────────────────────────────────────────────────────

export const outlookApi = {
  getStatus: async (): Promise<{ connected: boolean; email?: string }> => {
    const { data } = await api.get('/api/integrations/outlook/status');
    return data;
  },
  connect: async (): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/api/integrations/outlook/connect');
    return data;
  },
  sync: async (): Promise<void> => {
    await api.post('/api/integrations/outlook/sync');
  },
  disconnect: async (): Promise<void> => {
    await api.delete('/api/integrations/outlook/disconnect');
  },
};

// ─── Google Calendar Endpoints ────────────────────────────────────────────────

export const calendarApi = {
  getStatus: async (): Promise<{ connected: boolean }> => {
    const { data } = await api.get('/api/integrations/calendar/status');
    return data;
  },
  connect: async (): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/api/integrations/calendar/connect');
    return data;
  },
  disconnect: async (): Promise<void> => {
    await api.delete('/api/integrations/calendar/disconnect');
  },
  getEvents: async (maxResults = 10): Promise<{ events: CalendarEvent[] }> => {
    const { data } = await api.get(`/api/integrations/calendar/events?max_results=${maxResults}`);
    return data;
  },
  createEvent: async (body: { title: string; description?: string; start_datetime?: string; duration_hours?: number }): Promise<{ event: CalendarEvent; html_link?: string }> => {
    const { data } = await api.post('/api/integrations/calendar/events', body);
    return data;
  },
};

// ─── Teams Endpoints ──────────────────────────────────────────────────────────

export const teamsApi = {
  createOrg: async (name: string): Promise<Organization> => {
    const { data } = await api.post('/api/teams/org', { name });
    return data;
  },
  getOrg: async (): Promise<{ org: Organization; members: OrgMember[]; your_role: string }> => {
    const { data } = await api.get('/api/teams/org');
    return data;
  },
  inviteMember: async (email: string, role = 'member'): Promise<{ message: string; invite_token: string }> => {
    const { data } = await api.post('/api/teams/org/invite', { email, role });
    return data;
  },
  joinOrg: async (token: string): Promise<void> => {
    await api.post(`/api/teams/org/join/${token}`);
  },
  removeMember: async (userId: string): Promise<void> => {
    await api.delete(`/api/teams/org/members/${userId}`);
  },
  getAssignment: async (emailId: string): Promise<EmailAssignment | null> => {
    const { data } = await api.get(`/api/teams/assignments/${emailId}`);
    return data;
  },
  assignEmail: async (emailId: string, assignedTo: string | null): Promise<void> => {
    await api.post(`/api/teams/assignments/${emailId}`, { assigned_to: assignedTo });
  },
  getNotes: async (emailId: string): Promise<InternalNote[]> => {
    const { data } = await api.get(`/api/teams/notes/${emailId}`);
    return data;
  },
  addNote: async (emailId: string, note: string): Promise<InternalNote> => {
    const { data } = await api.post(`/api/teams/notes/${emailId}`, { note });
    return data;
  },
  deleteNote: async (noteId: string): Promise<void> => {
    await api.delete(`/api/teams/notes/${noteId}`);
  },
  getActivity: async (limit = 50): Promise<ActivityLogEntry[]> => {
    const { data } = await api.get(`/api/teams/activity?limit=${limit}`);
    return data;
  },
  getAdminStats: async (): Promise<AdminStats> => {
    const { data } = await api.get('/api/teams/admin/stats');
    return data;
  },
};

// ─── CRM Integration Endpoints ────────────────────────────────────────────────

export const crmApi = {
  hubspot: {
    getStatus: async (): Promise<{ connected: boolean; has_key: boolean }> => {
      const { data } = await api.get('/api/integrations/crm/hubspot/status');
      return data;
    },
    connect: async (api_key: string): Promise<{ connected: boolean }> => {
      const { data } = await api.post('/api/integrations/crm/hubspot/connect', { api_key });
      return data;
    },
    test: async (): Promise<{ success: boolean }> => {
      const { data } = await api.post('/api/integrations/crm/hubspot/test');
      return data;
    },
    disconnect: async (): Promise<void> => {
      await api.delete('/api/integrations/crm/hubspot/disconnect');
    },
  },
  salesforce: {
    getStatus: async (): Promise<{ connected: boolean; username?: string }> => {
      const { data } = await api.get('/api/integrations/crm/salesforce/status');
      return data;
    },
    connect: async (body: {
      consumer_key: string; consumer_secret: string;
      username: string; password: string; security_token: string;
    }): Promise<{ connected: boolean }> => {
      const { data } = await api.post('/api/integrations/crm/salesforce/connect', body);
      return data;
    },
    test: async (): Promise<{ success: boolean }> => {
      const { data } = await api.post('/api/integrations/crm/salesforce/test');
      return data;
    },
    disconnect: async (): Promise<void> => {
      await api.delete('/api/integrations/crm/salesforce/disconnect');
    },
  },
};

// ─── Auto-Assign Rules Endpoints ─────────────────────────────────────────────

export interface AutoAssignRule {
  id: string;
  org_id: string;
  condition_type: 'sender_domain' | 'category' | 'priority_gte';
  condition_value: string;
  assign_to_user_id: string;
  is_active: boolean;
  created_at: string;
  user_profiles?: { id: string; name: string; email: string };
}

export const autoAssignApi = {
  list: async (): Promise<AutoAssignRule[]> => {
    const { data } = await api.get('/api/teams/auto-assign');
    return data;
  },
  create: async (body: Omit<AutoAssignRule, 'id' | 'org_id' | 'created_at' | 'user_profiles'>): Promise<AutoAssignRule> => {
    const { data } = await api.post('/api/teams/auto-assign', body);
    return data;
  },
  update: async (id: string, body: Partial<AutoAssignRule>): Promise<AutoAssignRule> => {
    const { data } = await api.patch(`/api/teams/auto-assign/${id}`, body);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/teams/auto-assign/${id}`);
  },
};

// ─── Webhooks Endpoints ───────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  event: 'urgent_email' | 'reply_sent' | 'action_created' | 'all';
  secret?: string;
  is_active: boolean;
  created_at: string;
}

export const webhooksApi = {
  list: async (): Promise<Webhook[]> => {
    const { data } = await api.get('/api/webhooks');
    return data;
  },
  create: async (body: { name: string; url: string; event: string; secret?: string }): Promise<Webhook> => {
    const { data } = await api.post('/api/webhooks', body);
    return data;
  },
  update: async (id: string, body: Partial<Webhook>): Promise<Webhook> => {
    const { data } = await api.patch(`/api/webhooks/${id}`, body);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/webhooks/${id}`);
  },
  test: async (id: string): Promise<{ success: boolean; status_code?: number; error?: string }> => {
    const { data } = await api.post(`/api/webhooks/${id}/test`);
    return data;
  },
};

// ─── Push Notification Endpoints ─────────────────────────────────────────────

export const pushApi = {
  getVapidKey: async (): Promise<string> => {
    const { data } = await api.get('/api/push/vapid-key');
    return data.public_key || '';
  },
  subscribe: async (sub: PushSubscription): Promise<void> => {
    const json = sub.toJSON();
    await api.post('/api/push/subscribe', {
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
    });
  },
  unsubscribe: async (): Promise<void> => {
    await api.delete('/api/push/subscribe');
  },
};

// ─── GDPR / Data Endpoints ────────────────────────────────────────────────────

export const gdprApi = {
  exportData: async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${base}/api/settings/export-data`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailair-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  deleteAccount: async (): Promise<void> => {
    await api.delete('/api/settings/delete-account');
  },
};

// ─── Contacts (Mini CRM) Endpoints ───────────────────────────────────────────

export const contactsApi = {
  getContacts: async (search?: string): Promise<ContactProfile[]> => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const { data } = await api.get(`/api/contacts${params}`);
    return data;
  },
  getContact: async (email: string): Promise<ContactDetail> => {
    const { data } = await api.get(`/api/contacts/${encodeURIComponent(email)}`);
    return data;
  },
};

// ─── Relationship Endpoints ───────────────────────────────────────────────────

export const relationshipsApi = {
  getAll: async () => { const { data } = await api.get('/api/relationships'); return data; },
  getSentiment: async (email: string, days = 90) => { const { data } = await api.get(`/api/relationships/${encodeURIComponent(email)}/sentiment?days=${days}`); return data; },
  getDebt: async () => { const { data } = await api.get('/api/relationships/debt'); return data; },
};

// ─── Touchpoint Endpoints (calls / SMS / WhatsApp / meetings) ─────────────────

export const touchpointsApi = {
  list: async (contactEmail: string): Promise<{ touchpoints: ClientTouchpoint[]; total: number }> => {
    const { data } = await api.get('/api/touchpoints', { params: { contact_email: contactEmail } });
    return data;
  },
  log: async (payload: {
    contact_email: string;
    contact_name?: string;
    channel: ClientTouchpoint['channel'];
    direction: ClientTouchpoint['direction'];
    summary?: string;
    duration_minutes?: number;
    occurred_at?: string;
  }): Promise<ClientTouchpoint> => {
    const { data } = await api.post('/api/touchpoints', payload);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/touchpoints/${id}`);
  },
};

// ─── Public Benchmark Endpoints ────────────────────────────────────────────────

export const benchmarksApi = {
  get: async (industry?: string): Promise<Benchmark> => {
    const { data } = await api.get('/api/public/benchmarks', { params: industry ? { industry } : {} });
    return data;
  },
  industries: async (): Promise<{ industries: { industry: string; count: number }[] }> => {
    const { data } = await api.get('/api/public/benchmarks/industries');
    return data;
  },
};

// ─── Revenue Endpoints ────────────────────────────────────────────────────────

export const revenueApi = {
  getSummary: async () => { const { data } = await api.get('/api/revenue/summary'); return data; },
  scan: async () => { const { data } = await api.post('/api/revenue/scan'); return data; },
  extractFromEmail: async (emailId: string) => { const { data } = await api.post(`/api/revenue/signals/${emailId}`); return data; },
  updateSignal: async (signalId: string, status: string) => { const { data } = await api.patch(`/api/revenue/signals/${signalId}`, { status }); return data; },
  getAtRisk: async () => { const { data } = await api.get('/api/revenue/at-risk'); return data; },
};

// ─── SLA Endpoints ────────────────────────────────────────────────────────────

export const slaApi = {
  getStatus: async () => { const { data } = await api.get('/api/sla/status'); return data; },
  getConfigs: async () => { const { data } = await api.get('/api/sla/configs'); return data; },
  createConfig: async (tierName: string, maxHours: number, patterns: string[]) => {
    const { data } = await api.post('/api/sla/configs', { tier_name: tierName, max_response_hours: maxHours, sender_patterns: patterns });
    return data;
  },
  deleteConfig: async (id: string) => { await api.delete(`/api/sla/configs/${id}`); },
};

// ─── Sequence Endpoints ───────────────────────────────────────────────────────

export const sequencesApi = {
  getAll: async () => { const { data } = await api.get('/api/sequences'); return data; },
  create: async (name: string, steps: object[]) => { const { data } = await api.post('/api/sequences', { name, steps }); return data; },
  delete: async (id: string) => { await api.delete(`/api/sequences/${id}`); },
  enroll: async (seqId: string, contactEmail: string, emailId?: string) => {
    const { data } = await api.post(`/api/sequences/${seqId}/enroll`, { contact_email: contactEmail, email_id: emailId });
    return data;
  },
  getEnrollments: async () => { const { data } = await api.get('/api/sequences/enrollments'); return data; },
  cancelEnrollment: async (id: string) => { await api.post(`/api/sequences/enrollments/${id}/cancel`); },
};

// ─── Knowledge Endpoints ──────────────────────────────────────────────────────

export const knowledgeApi = {
  getAll: async (q?: string, type?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('entry_type', type);
    const { data } = await api.get(`/api/knowledge?${params}`);
    return data;
  },
  extractFromEmail: async (emailId: string) => { const { data } = await api.post(`/api/knowledge/extract/${emailId}`); return data; },
  bulkExtract: async () => { const { data } = await api.post('/api/knowledge/bulk-extract'); return data; },
  delete: async (id: string) => { await api.delete(`/api/knowledge/${id}`); },
};

// ─── Brief Endpoints ──────────────────────────────────────────────────────────

export const briefsApi = {
  getAll: async () => { const { data } = await api.get('/api/briefs'); return data; },
  generate: async (title: string, startTime: string, attendeeEmails: string[], description?: string) => {
    const { data } = await api.post('/api/briefs', { title, start_time: startTime, attendee_emails: attendeeEmails, description });
    return data;
  },
};

// ─── Quote Endpoints ──────────────────────────────────────────────────────────

export const quotesApi = {
  getAll: async () => { const { data } = await api.get('/api/quotes'); return data; },
  generate: async (emailId: string) => { const { data } = await api.post(`/api/quotes/generate/${emailId}`); return data; },
  updateStatus: async (id: string, status: string) => { const { data } = await api.patch(`/api/quotes/${id}/status`, { status }); return data; },
};

// ─── Shop Endpoints ───────────────────────────────────────────────────────────

export const shopApi = {
  listProducts: async (category?: string) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const { data } = await api.get(`/api/shop/products${params}`);
    return data;
  },
  getProduct: async (id: string) => {
    const { data } = await api.get(`/api/shop/products/${id}`);
    return data;
  },
  createOrder: async (body: {
    items: { product_id: string; variant?: string | null; quantity: number; unit_price: number; customization?: string | null }[];
    shipping: { name: string; email: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
    notes?: string;
  }) => {
    const { data } = await api.post('/api/shop/orders', body);
    return data;
  },
  verifyPayment: async (body: { order_id: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    const { data } = await api.post('/api/shop/orders/verify', body);
    return data;
  },
  getOrder: async (orderId: string, email: string) => {
    const { data } = await api.get(`/api/shop/orders/${orderId}?email=${encodeURIComponent(email)}`);
    return data;
  },
};

// ─── Newsletter Endpoints ─────────────────────────────────────────────────────

export const newsletterApi = {
  getStatus: async (): Promise<{ subscribed: boolean }> => {
    const { data } = await api.get('/api/newsletter/status');
    return data;
  },
  subscribe: async (): Promise<void> => {
    await api.post('/api/newsletter/subscribe');
  },
  unsubscribe: async (): Promise<void> => {
    await api.post('/api/newsletter/unsubscribe');
  },
};

// ─── Workspace Endpoints (docs / files / chat / settings) ─────────────────────

export const workspaceApi = {
  listDocs: async (): Promise<{ docs: TeamDoc[] }> => { const { data } = await api.get('/api/workspace/docs'); return data; },
  createDoc: async (title: string, content = ''): Promise<TeamDoc> => { const { data } = await api.post('/api/workspace/docs', { title, content }); return data; },
  getDoc: async (id: string): Promise<TeamDoc> => { const { data } = await api.get(`/api/workspace/docs/${id}`); return data; },
  updateDoc: async (id: string, body: { title?: string; content?: string }): Promise<TeamDoc> => { const { data } = await api.put(`/api/workspace/docs/${id}`, body); return data; },
  deleteDoc: async (id: string): Promise<void> => { await api.delete(`/api/workspace/docs/${id}`); },

  listFiles: async (): Promise<{ files: TeamFile[] }> => { const { data } = await api.get('/api/workspace/files'); return data; },
  uploadFile: async (file: File): Promise<TeamFile> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/api/workspace/files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
  downloadFile: async (id: string): Promise<{ url: string; filename: string }> => { const { data } = await api.get(`/api/workspace/files/${id}/download`); return data; },
  deleteFile: async (id: string): Promise<void> => { await api.delete(`/api/workspace/files/${id}`); },

  listChannels: async (): Promise<{ channels: TeamChannel[] }> => { const { data } = await api.get('/api/workspace/channels'); return data; },
  createChannel: async (name: string): Promise<TeamChannel> => { const { data } = await api.post('/api/workspace/channels', { name }); return data; },
  listMessages: async (channelId: string): Promise<{ messages: TeamMessage[] }> => { const { data } = await api.get(`/api/workspace/channels/${channelId}/messages`); return data; },
  sendMessage: async (channelId: string, content: string): Promise<TeamMessage> => { const { data } = await api.post(`/api/workspace/channels/${channelId}/messages`, { content }); return data; },

  getSettings: async (): Promise<WorkspaceSettings> => { const { data } = await api.get('/api/workspace/settings'); return data; },
  updateSettings: async (body: { allowed_email_domains?: string[] }): Promise<WorkspaceSettings> => { const { data } = await api.put('/api/workspace/settings', body); return data; },
};

export default api;
