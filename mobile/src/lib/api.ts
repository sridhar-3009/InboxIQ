import axios from 'axios';
import { supabase } from './supabase';
import { API_URL } from './config';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response;
    if (res?.data?.detail) return res.data.detail;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const emailsApi = {
  getEmails: async (params?: { category?: string; is_read?: boolean; search?: string }) => {
    const { data } = await api.get('/api/emails', { params });
    return data;
  },
  getEmail: async (id: string) => {
    const { data } = await api.get(`/api/emails/${id}`);
    return data;
  },
  markRead: async (id: string) => {
    const { data } = await api.patch(`/api/emails/${id}/read`);
    return data;
  },
  markUnread: async (id: string) => {
    const { data } = await api.patch(`/api/emails/${id}/unread`);
    return data;
  },
  star: async (id: string) => {
    const { data } = await api.patch(`/api/emails/${id}/star`);
    return data;
  },
  archive: async (id: string) => {
    const { data } = await api.patch(`/api/emails/${id}/archive`);
    return data;
  },
  generateReply: async (id: string) => {
    const { data } = await api.post(`/api/emails/${id}/generate-reply`);
    return data;
  },
};

export const actionsApi = {
  getActions: async () => {
    const { data } = await api.get('/api/actions');
    return data;
  },
  updateAction: async (id: string, updates: Record<string, unknown>) => {
    const { data } = await api.patch(`/api/actions/${id}`, updates);
    return data;
  },
};

export const repliesApi = {
  getDraft: async (emailId: string) => {
    const { data } = await api.get(`/api/replies/email/${emailId}`);
    return data;
  },
  updateDraft: async (draftId: string, body: string) => {
    const { data } = await api.put(`/api/replies/${draftId}`, { body });
    return data;
  },
  sendDraft: async (draftId: string) => {
    const { data } = await api.post(`/api/replies/${draftId}/send`);
    return data;
  },
};

export const relationshipsApi = {
  getAll: async () => {
    const { data } = await api.get('/api/relationships');
    return data;
  },
  getSentiment: async (email: string) => {
    const { data } = await api.get(`/api/relationships/${encodeURIComponent(email)}/sentiment`);
    return data;
  },
  getDebt: async () => {
    const { data } = await api.get('/api/relationships/debt');
    return data;
  },
};

export const revenueApi = {
  getSummary: async () => {
    const { data } = await api.get('/api/revenue/summary');
    return data;
  },
  scan: async () => {
    const { data } = await api.post('/api/revenue/scan');
    return data;
  },
};

export const knowledgeApi = {
  getAll: async (params?: { search?: string; category?: string }) => {
    const { data } = await api.get('/api/knowledge', { params });
    return data;
  },
  deleteEntry: async (id: string) => {
    await api.delete(`/api/knowledge/${id}`);
  },
  extractFromEmail: async (emailId: string) => {
    const { data } = await api.post(`/api/knowledge/extract/${emailId}`);
    return data;
  },
};

export const sequencesApi = {
  getAll: async () => {
    const { data } = await api.get('/api/sequences');
    return data;
  },
  create: async (payload: { name: string; steps: unknown[] }) => {
    const { data } = await api.post('/api/sequences', payload);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/sequences/${id}`);
  },
  getEnrollments: async () => {
    const { data } = await api.get('/api/sequences/enrollments');
    return data;
  },
};

export const briefsApi = {
  getAll: async () => {
    const { data } = await api.get('/api/briefs');
    return data;
  },
  generateFromEmail: async (emailId: string) => {
    const { data } = await api.post('/api/briefs', { email_id: emailId });
    return data;
  },
};

export const quotesApi = {
  getAll: async () => {
    const { data } = await api.get('/api/quotes');
    return data;
  },
  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch(`/api/quotes/${id}/status`, { status });
    return data;
  },
};

export const slaApi = {
  getSummary: async () => {
    const { data } = await api.get('/api/sla/summary');
    return data;
  },
  getStatus: async () => {
    const { data } = await api.get('/api/sla/status');
    return data;
  },
  getConfigs: async () => {
    const { data } = await api.get('/api/sla/configs');
    return data;
  },
};

export const billingApi = {
  getStatus: async () => {
    const { data } = await api.get('/api/billing/status');
    return data;
  },
};

export const settingsApi = {
  getProfile: async () => {
    const { data } = await api.get('/api/settings/profile');
    return data;
  },
  updateProfile: async (payload: Record<string, unknown>) => {
    const { data } = await api.put('/api/settings/profile', payload);
    return data;
  },
};

export const contactsApi = {
  getAll: async () => {
    const { data } = await api.get('/api/contacts');
    return data;
  },
  getContact: async (email: string) => {
    const { data } = await api.get(`/api/contacts/${encodeURIComponent(email)}`);
    return data;
  },
};

export const notificationsApi = {
  list: async () => {
    const { data } = await api.get('/api/notifications');
    return data;
  },
  markRead: async (id: string) => {
    await api.post(`/api/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await api.post('/api/notifications/read-all');
  },
};

export const workspaceApi = {
  listDocs: async () => {
    const { data } = await api.get('/api/workspace/docs');
    return data;
  },
  getDoc: async (id: string) => {
    const { data } = await api.get(`/api/workspace/docs/${id}`);
    return data;
  },
  createDoc: async (title: string, content = '', folder?: string) => {
    const { data } = await api.post('/api/workspace/docs', { title, content, folder });
    return data;
  },
  updateDoc: async (id: string, body: { title?: string; content?: string; folder?: string }) => {
    const { data } = await api.put(`/api/workspace/docs/${id}`, body);
    return data;
  },
  deleteDoc: async (id: string) => {
    await api.delete(`/api/workspace/docs/${id}`);
  },
  restoreDoc: async (id: string) => {
    const { data } = await api.post(`/api/workspace/docs/${id}/restore`);
    return data;
  },

  listFiles: async () => {
    const { data } = await api.get('/api/workspace/files');
    return data;
  },
  uploadFile: async (fileUri: string, filename: string, mimeType: string, folder?: string) => {
    const form = new FormData();
    // React Native FormData file shape — not a browser File object.
    form.append('file', { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);
    if (folder) form.append('folder', folder);
    const { data } = await api.post('/api/workspace/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  downloadFile: async (id: string) => {
    const { data } = await api.get(`/api/workspace/files/${id}/download`);
    return data;
  },
  deleteFile: async (id: string) => {
    await api.delete(`/api/workspace/files/${id}`);
  },

  listChannels: async () => {
    const { data } = await api.get('/api/workspace/channels');
    return data;
  },
  createChannel: async (name: string) => {
    const { data } = await api.post('/api/workspace/channels', { name });
    return data;
  },
  listMessages: async (channelId: string) => {
    const { data } = await api.get(`/api/workspace/channels/${channelId}/messages`);
    return data;
  },
  sendMessage: async (channelId: string, content: string) => {
    const { data } = await api.post(`/api/workspace/channels/${channelId}/messages`, { content });
    return data;
  },

  getSettings: async () => {
    const { data } = await api.get('/api/workspace/settings');
    return data;
  },
  updateSettings: async (body: { allowed_email_domains?: string[] }) => {
    const { data } = await api.put('/api/workspace/settings', body);
    return data;
  },
};

export default api;
