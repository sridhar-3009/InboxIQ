import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  FileText, Paperclip, MessageSquare, Settings as SettingsIcon,
  Plus, Trash2, Download, Send, Loader2, Save, X, Search,
  CheckCircle2, Circle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import CallPanel from '@/components/CallPanel';
import { workspaceApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { TeamDoc, TeamFile, TeamChannel, TeamMessage, WorkspaceSettings } from '@/lib/types';

type Tab = 'docs' | 'files' | 'chat' | 'settings';
const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Docs ───────────────────────────────────────────────────────────────────

function DocsTab({ query }: { query: string }) {
  const [docs, setDocs] = useState<TeamDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<TeamDoc | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = async () => {
    try {
      const { docs } = await workspaceApi.listDocs();
      setDocs(docs);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load docs'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openDoc = async (id: string) => {
    try {
      const doc = await workspaceApi.getDoc(id);
      setActiveDoc(doc);
      setTitle(doc.title);
      setContent(doc.content || '');
      setFolder(doc.folder || '');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to open doc'));
    }
  };

  const createDoc = async () => {
    try {
      const doc = await workspaceApi.createDoc('Untitled');
      await load();
      openDoc(doc.id);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create doc'));
    }
  };

  const save = async () => {
    if (!activeDoc) return;
    setSaving(true);
    try {
      const updated = await workspaceApi.updateDoc(activeDoc.id, { title, content, folder: folder.trim() || undefined });
      setActiveDoc(updated);
      await load();
      toast.success('Saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!activeDoc) return;
    setRestoring(true);
    try {
      const updated = await workspaceApi.restoreDoc(activeDoc.id);
      setActiveDoc(updated);
      setTitle(updated.title);
      setContent(updated.content || '');
      await load();
      toast.success('Restored previous version');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Nothing to restore'));
    } finally {
      setRestoring(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await workspaceApi.deleteDoc(id);
      if (activeDoc?.id === id) setActiveDoc(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete'));
    }
  };

  if (activeDoc) {
    return (
      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3 gap-3">
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg font-serif text-gray-900 dark:text-gray-100 focus:outline-none"
              placeholder="Untitled"
            />
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full bg-transparent text-xs text-gray-400 dark:text-gray-500 focus:outline-none mt-0.5"
              placeholder="Folder (optional)"
            />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          <button onClick={() => setActiveDoc(null)} className="btn-icon"><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          placeholder="Start writing..."
          className="w-full p-4 bg-transparent text-sm text-gray-800 dark:text-gray-200 resize-none focus:outline-none leading-relaxed"
        />
        {activeDoc.previous_content && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Previous version saved {activeDoc.previous_saved_at ? formatDistanceToNow(new Date(activeDoc.previous_saved_at), { addSuffix: true }) : ''}
            </p>
            <button onClick={restore} disabled={restoring} className="text-xs font-medium text-primary-600 hover:text-primary-700">
              {restoring ? 'Restoring…' : 'Restore previous version'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const filteredDocs = docs.filter((d) => (d.title || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Shared pages for your team — one editor at a time.</p>
        <button onClick={createDoc} className="btn-primary text-sm"><Plus className="h-4 w-4" /> New doc</button>
      </div>
      {loading ? (
        <div className="card p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filteredDocs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{query ? 'No docs match your search.' : 'No docs yet.'}</p>
        </div>
      ) : (
        Object.entries(
          filteredDocs.reduce<Record<string, TeamDoc[]>>((acc, d) => {
            const key = d.folder?.trim() || 'Unsorted';
            (acc[key] = acc[key] || []).push(d);
            return acc;
          }, {})
        ).map(([folderName, folderDocs]) => (
          <div key={folderName} className="mb-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">{folderName}</p>
            <div className="card divide-y divide-gray-100 dark:divide-gray-700">
              {folderDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer group" onClick={() => openDoc(d.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.title || 'Untitled'}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</span>
                    <button onClick={(e) => { e.stopPropagation(); remove(d.id); }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Files ──────────────────────────────────────────────────────────────────

function isPreviewable(contentType: string | null): boolean {
  return !!contentType && (contentType.startsWith('image/') || contentType === 'application/pdf');
}

function FilesTab({ query }: { query: string }) {
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('');
  const [preview, setPreview] = useState<{ url: string; filename: string; contentType: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const { files } = await workspaceApi.listFiles();
      setFiles(files);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load files'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await workspaceApi.uploadFile(file, uploadFolder.trim() || undefined);
      await load();
      toast.success('Uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const { url } = await workspaceApi.downloadFile(id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Download failed'));
    }
  };

  const handleOpen = async (f: TeamFile) => {
    if (!isPreviewable(f.content_type)) return handleDownload(f.id);
    try {
      const { url, filename } = await workspaceApi.downloadFile(f.id);
      setPreview({ url, filename, contentType: f.content_type });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Preview failed'));
    }
  };

  const remove = async (id: string) => {
    try {
      await workspaceApi.deleteFile(id);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Delete failed'));
    }
  };

  const filtered = files.filter((f) => f.filename.toLowerCase().includes(query.toLowerCase()));
  const grouped = filtered.reduce<Record<string, TeamFile[]>>((acc, f) => {
    const key = f.folder?.trim() || 'Unsorted';
    (acc[key] = acc[key] || []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">Shared with your whole team. 25MB per file.</p>
        <div className="flex items-center gap-2">
          <input
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            placeholder="Folder (optional)"
            className="input-field h-9 w-40 text-sm"
          />
          <label className="btn-primary text-sm cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
      {loading ? (
        <div className="card p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{query ? 'No files match your search.' : 'No files yet.'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([folderName, folderFiles]) => (
          <div key={folderName} className="mb-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">{folderName}</p>
            <div className="card divide-y divide-gray-100 dark:divide-gray-700">
              {folderFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3 group">
                  <div
                    className={clsx('flex items-center gap-3 min-w-0', isPreviewable(f.content_type) && 'cursor-pointer')}
                    onClick={() => handleOpen(f)}
                  >
                    <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{f.filename}</p>
                      <p className="text-xs text-gray-400">{fmtSize(f.size_bytes)} &middot; {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleDownload(f.id)} className="btn-icon"><Download className="h-4 w-4" /></button>
                    <button onClick={() => remove(f.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPreview(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden max-w-3xl max-h-[85vh] w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{preview.filename}</p>
              <button onClick={() => setPreview(null)} className="btn-icon"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              {preview.contentType?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.filename} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.filename} className="w-full h-[75vh]" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat ───────────────────────────────────────────────────────────────────

function ChatTab() {
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChannels = async () => {
    try {
      const { channels } = await workspaceApi.listChannels();
      setChannels(channels);
      if (!activeChannel && channels.length > 0) setActiveChannel(channels[0].id);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load channels'));
    }
  };
  useEffect(() => { loadChannels(); }, []);

  const loadMessages = async (channelId: string) => {
    try {
      const { messages } = await workspaceApi.listMessages(channelId);
      setMessages(messages);
    } catch { /* silent on poll */ }
  };

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel);
    const interval = setInterval(() => loadMessages(activeChannel), 4000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || !activeChannel) return;
    const text = input;
    setInput('');
    try {
      await workspaceApi.sendMessage(activeChannel, text);
      await loadMessages(activeChannel);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to send'));
      setInput(text);
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const ch = await workspaceApi.createChannel(newChannelName);
      setNewChannelName('');
      setShowNewChannel(false);
      await loadChannels();
      setActiveChannel(ch.id);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create channel'));
    }
  };

  return (
    <div className="card flex h-[560px] overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Channels</span>
          <button onClick={() => setShowNewChannel((v) => !v)} className="text-gray-400 hover:text-primary-600"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        {showNewChannel && (
          <div className="px-3 pb-2 flex gap-1">
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createChannel()}
              placeholder="channel-name"
              className="input-field text-xs h-7"
              autoFocus
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              className={clsx(
                'w-full text-left px-2 py-1.5 rounded-md text-sm truncate',
                activeChannel === c.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              # {c.name}
            </button>
          ))}
          {channels.length === 0 && <p className="text-xs text-gray-400 px-2 py-2">No channels yet.</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            <div className="px-4 pt-3">
              <CallPanel key={activeChannel} channelId={activeChannel} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.author_name}</span>
                    <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{m.content}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Message the team..."
                className="input-field flex-1"
              />
              <button onClick={send} className="btn-primary"><Send className="h-4 w-4" /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Create a channel to get started.</div>
        )}
      </div>
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [domains, setDomains] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    workspaceApi.getSettings().then((s) => {
      setSettings(s);
      setDomains((s.allowed_email_domains || []).join(', '));
    }).catch((err) => toast.error(apiErrorMessage(err, 'Failed to load settings')));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const list = domains.split(',').map((d) => d.trim()).filter(Boolean);
      await workspaceApi.updateSettings({ allowed_email_domains: list });
      toast.success('Saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="card p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Invite restrictions</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Only admins can invite (that&apos;s already always true). Optionally restrict which email domains can be invited at all.
      </p>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Allowed email domains</label>
      <input
        value={domains}
        onChange={(e) => setDomains(e.target.value)}
        placeholder="yourcompany.com, partner.com"
        className="input-field"
      />
      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Comma-separated. Leave blank to allow any email domain.</p>
      <button onClick={save} disabled={saving} className="btn-primary mt-5 text-sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
      </button>
    </div>
  );
}

// ─── New-member onboarding checklist ───────────────────────────────────────
// Shown for ~14 days after joining a team via invite (join_org flow sets
// the localStorage marker). Purely a per-viewer nudge — no backend state.

const CHECKLIST_ITEMS = [
  { id: 'chat', label: 'Say hi in the team chat', tab: 'chat' as Tab },
  { id: 'docs', label: 'Check the shared docs', tab: 'docs' as Tab },
  { id: 'files', label: 'Browse the team files', tab: 'files' as Tab },
];

function NewMemberChecklist({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const marker = localStorage.getItem('mailair_new_member_joined_at');
      if (!marker) return;
      const joinedAt = parseInt(marker, 10);
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - joinedAt < fourteenDays) {
        setVisible(true);
        const savedDone = JSON.parse(localStorage.getItem('mailair_onboarding_done') || '{}');
        setDone(savedDone);
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  if (!visible) return null;

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try { localStorage.setItem('mailair_onboarding_done', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const dismiss = () => {
    setVisible(false);
    try { localStorage.removeItem('mailair_new_member_joined_at'); } catch { /* ignore */ }
  };

  const completedCount = CHECKLIST_ITEMS.filter((i) => done[i.id]).length;

  return (
    <div className="card p-5 mb-6 border-primary-200 dark:border-primary-800">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg text-gray-900 dark:text-gray-100">Welcome to the team</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{completedCount}/{CHECKLIST_ITEMS.length} done</p>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => { toggle(item.id); onNavigate(item.tab); }}
            className="w-full flex items-center gap-2.5 text-left rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {done[item.id] ? (
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <span className={clsx('text-sm', done[item.id] ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300')}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [activeTab, setActiveTab] = useState<Tab>('docs');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;

  return (
    <>
      <Head><title>Workspace — Mailair</title></Head>
      <Layout title="Workspace">
        <div className="max-w-4xl mx-auto">
          <NewMemberChecklist onNavigate={setActiveTab} />

          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-full sm:w-fit overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
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
            {(activeTab === 'docs' || activeTab === 'files') && (
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="input-field h-9 pl-8 text-sm"
                />
              </div>
            )}
          </div>

          {activeTab === 'docs' && <DocsTab query={query} />}
          {activeTab === 'files' && <FilesTab query={query} />}
          {activeTab === 'chat' && <ChatTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </Layout>
    </>
  );
}
