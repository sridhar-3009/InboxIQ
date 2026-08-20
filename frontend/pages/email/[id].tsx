import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Mail,
  Calendar,
  User,
  Brain,
  Tag,
  List,
  MessageSquare,
  Trash2,
  CheckSquare,
  Send,
  UserCheck,
  StickyNote,
  Paperclip,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Star,
  AlarmClock,
  FileEdit,
  CalendarCheck,
  ClipboardCopy,
  X,
  Layers,
  CalendarPlus,
  Pin,
  PinOff,
  BellOff,
  Lightbulb,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '@/components/Layout';
import PriorityBadge from '@/components/PriorityBadge';
import CategoryBadge from '@/components/CategoryBadge';
import ActionItem from '@/components/ActionItem';
import ReplyEditor from '@/components/ReplyEditor';
import LoadingSpinner from '@/components/LoadingSpinner';
import AttachmentViewer from '@/components/AttachmentViewer';
import SnoozeModal from '@/components/SnoozeModal';
import { useEmail, useEmailActions, useReplyDraft } from '@/lib/hooks';
import { emailsApi, teamsApi, calendarApi } from '@/lib/api';
import { loadTags, getEmailTags, setEmailTags, createTag, saveTags, getNextColor } from '@/lib/tags';
import { supabase } from '@/lib/supabase';
import type { Action, QuoteData, MeetingInfo, InternalNote, OrgMember } from '@/lib/types';

type Attachment = {
  attachment_id: string;
  message_id: string;
  filename: string;
  mime_type: string;
  size: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))              return ImageIcon;
  if (mimeType.includes('pdf'))                   return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  return File;
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/'))   return 'text-pink-500 bg-pink-50';
  if (mimeType.includes('pdf'))        return 'text-red-500 bg-red-50';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-600 bg-green-50';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'text-primary-600 bg-primary-50';
  return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
}

// Renders HTML email inside a sandboxed iframe that auto-resizes — links open in new tab
function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  const doc = `<!DOCTYPE html>
<html>
<head>
<base target="_blank">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.65;
    color: #332b22;
    word-break: break-word;
    overflow-wrap: anywhere;
    padding: 20px 24px 28px;
  }
  * { box-sizing: border-box; }
  a { color: #b04723; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100% !important; height: auto !important; display: inline-block; }
  table { max-width: 100% !important; border-collapse: collapse; }
  td, th { word-break: break-word; }
  p { margin: 0 0 0.75em; }
  blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid #d3c7b4;
    color: #83745e;
    background: #faf8f5;
    border-radius: 0 6px 6px 0;
  }
  pre, code {
    font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
    font-size: 13px;
    background: #f3efe8;
    border-radius: 4px;
    padding: 2px 5px;
  }
  pre { padding: 12px 16px; overflow-x: auto; }
  hr { border: none; border-top: 1px solid #e7e0d4; margin: 16px 0; }
  /* Gmail quote collapse */
  .gmail_quote, .gmail_extra { color: #83745e; }
  div[style*="color:#888"], div[style*="color: #888"] { color: #a99b83 !important; }
</style>
</head>
<body>${html}</body>
</html>`;

  const handleLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const body = iframe.contentDocument?.body;
      if (body) {
        const h = Math.max(body.scrollHeight, 200);
        setHeight(h + 32);
      }
    } catch {}
  };

  return (
    <iframe
      ref={iframeRef}
      srcDoc={doc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={handleLoad}
      style={{ width: '100%', height, border: 'none', display: 'block', borderRadius: '0 0 12px 12px' }}
      title="Email body"
    />
  );
}

export default function EmailDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const emailId = typeof id === 'string' ? id : undefined;

  const { session, isLoading: sessionLoading } = useSessionContext();
  const [isReprocessing, setIsReprocessing]   = useState(false);
  const [isDeleting, setIsDeleting]           = useState(false);
  const [isStarring, setIsStarring]           = useState(false);
  const [isStarred, setIsStarred]             = useState<boolean | null>(null);
  const [snoozeOpen, setSnoozeOpen]           = useState(false);
  const [isTogglingFollowUp, setIsTogglingFollowUp] = useState(false);
  const [isForwardingSlack, setIsForwardingSlack] = useState(false);
  const [askAIOpen, setAskAIOpen] = useState(false);
  const [askAIQuestion, setAskAIQuestion] = useState('');
  const [askAIAnswer, setAskAIAnswer] = useState('');
  const [askAILoading, setAskAILoading] = useState(false);
  const [actions, setActions]                 = useState<Action[]>([]);
  const [attachments, setAttachments]         = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [attachmentSummaries, setAttachmentSummaries] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  // Quote generator state
  const [quoteModalOpen, setQuoteModalOpen]       = useState(false);
  const [quoteProjectDesc, setQuoteProjectDesc]   = useState('');
  const [quoteBudgetHint, setQuoteBudgetHint]     = useState('');
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [generatedQuote, setGeneratedQuote]       = useState<QuoteData | null>(null);

  // Meeting detection state
  const [meetingInfo, setMeetingInfo]       = useState<MeetingInfo | null>(null);
  const [gcalConnected, setGcalConnected]   = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  // Team collaboration state
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Thread summary state
  const [threadSummary, setThreadSummary] = useState<{
    thread_length: number; summary: string | null; key_points: string[];
    next_action: string | null; sentiment: string; status: string;
  } | null>(null);
  const [loadingThreadSummary, setLoadingThreadSummary] = useState(false);

  // Pin / Mute / Smart replies
  const [isPinning, setIsPinning] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingSmartReplies, setLoadingSmartReplies] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState<string | null>(null);

  // Custom tags
  const [allTags, setAllTags] = useState(() => loadTags());
  const [emailTagIds, setEmailTagIds] = useState<string[]>(() => emailId ? getEmailTags(emailId) : []);
  const [newTagName, setNewTagName] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);

  const handleAddTag = () => {
    if (!newTagName.trim() || !emailId) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    let tagId: string;
    if (existing) {
      tagId = existing.id;
    } else {
      const tag = createTag(newTagName.trim(), getNextColor(allTags));
      const updated = [...allTags, tag];
      setAllTags(updated);
      saveTags(updated);
      tagId = tag.id;
    }
    if (!emailTagIds.includes(tagId)) {
      const next = [...emailTagIds, tagId];
      setEmailTagIds(next);
      setEmailTags(emailId, next);
    }
    setNewTagName('');
  };

  const handleRemoveEmailTag = (tagId: string) => {
    if (!emailId) return;
    const next = emailTagIds.filter((id) => id !== tagId);
    setEmailTagIds(next);
    setEmailTags(emailId, next);
  };

  const { data: email, error: emailError, isLoading: emailLoading, mutate: mutateEmail } = useEmail(emailId);
  const { data: rawActions, isLoading: actionsLoading } = useEmailActions(emailId);
  const { data: replyDraft } = useReplyDraft(emailId);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (rawActions) setActions(rawActions);
  }, [rawActions]);

  // Mark email as read when opened
  useEffect(() => {
    if (!emailId || !email) return;
    emailsApi.markAsRead(emailId).catch(() => {});
  }, [emailId, email?.id]);

  // Mark onboarding "reply" step done when user views an email with an AI draft
  useEffect(() => {
    if (replyDraft && typeof window !== 'undefined') {
      localStorage.setItem('onboarding_reply_done', 'true');
    }
  }, [replyDraft]);

  // Load attachments once email is loaded
  useEffect(() => {
    if (!emailId || !email) return;
    setAttachmentsLoading(true);
    emailsApi.getAttachments(emailId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setAttachmentsLoading(false));
  }, [emailId, email]);

  // Meeting detection: run when email loads (skip spam/newsletters)
  useEffect(() => {
    if (!emailId || !email) return;
    const cat = email.ai_analysis?.category;
    if (cat === 'spam' || cat === 'newsletter') return;
    emailsApi.getMeetingInfo(emailId)
      .then((info) => { if (info.is_meeting_request) setMeetingInfo(info); })
      .catch(() => {});
    calendarApi.getStatus().then((s) => setGcalConnected(s.connected)).catch(() => {});
  }, [emailId, email?.id]);

  // Load team notes + org members when email is available
  useEffect(() => {
    if (!emailId || !session) return;
    teamsApi.getNotes(emailId).then(setNotes).catch(() => {});
    teamsApi.getOrg().then((d) => setOrgMembers(d.members.filter((m) => m.status === 'active'))).catch(() => {});
    teamsApi.getAssignment(emailId).then((a) => { if (a?.assigned_to) setAssignedTo(a.assigned_to); }).catch(() => {});
  }, [emailId, session]);

  if (sessionLoading) return <LoadingSpinner fullPage />;
  if (!session)       return null;

  const handleAddNote = async () => {
    if (!emailId || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const note = await teamsApi.addNote(emailId, noteText.trim());
      setNotes((prev) => [...prev, note]);
      setNoteText('');
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
    finally { setAddingNote(false); }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await teamsApi.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { toast.error('Failed to delete note'); }
  };

  const handleAssign = async (userId: string) => {
    if (!emailId) return;
    setAssigning(true);
    try {
      await teamsApi.assignEmail(emailId, userId || null);
      setAssignedTo(userId);
      toast.success(userId ? 'Email assigned' : 'Assignment cleared');
    } catch { toast.error('Failed to assign email'); }
    finally { setAssigning(false); }
  };

  const handleReprocess = async () => {
    if (!emailId) return;
    setIsReprocessing(true);
    try {
      await emailsApi.processEmail(emailId);
      await mutateEmail();
      toast.success('Email re-processed with AI');
    } catch {
      toast.error('Failed to re-process email');
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleStar = async () => {
    if (!emailId || !email) return;
    const currentStarred = isStarred !== null ? isStarred : email.is_starred;
    const next = !currentStarred;
    setIsStarred(next); // optimistic
    setIsStarring(true);
    try {
      await emailsApi.starEmail(emailId, next);
      await mutateEmail();
    } catch {
      setIsStarred(currentStarred); // revert
      toast.error('Failed to update star');
    } finally {
      setIsStarring(false);
    }
  };

  const handleToggleFollowUp = async () => {
    if (!emailId || !email) return;
    const isWaiting = (email.labels ?? []).includes('__followup__');
    setIsTogglingFollowUp(true);
    try {
      await emailsApi.toggleFollowUp(emailId, !isWaiting);
      await mutateEmail();
      toast.success(!isWaiting ? 'Marked as waiting for reply' : 'Follow-up cleared');
    } catch {
      toast.error('Failed to update follow-up status');
    } finally {
      setIsTogglingFollowUp(false);
    }
  };

  const handleForwardToSlack = async () => {
    if (!emailId) return;
    setIsForwardingSlack(true);
    try {
      await emailsApi.forwardToSlack(emailId);
      toast.success('Forwarded to Slack!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to forward to Slack. Check your webhook in Settings.');
    } finally {
      setIsForwardingSlack(false);
    }
  };

  const handleAskAI = async () => {
    if (!emailId || !askAIQuestion.trim()) return;
    setAskAILoading(true);
    setAskAIAnswer('');
    try {
      const { answer } = await emailsApi.askAI(emailId, askAIQuestion.trim());
      setAskAIAnswer(answer);
    } catch {
      toast.error('AI request failed');
    } finally {
      setAskAILoading(false);
    }
  };

  const handleDelete = async () => {
    if (!emailId) return;
    if (!confirm('Remove this email from Mailair? It will not be synced again.')) return;
    setIsDeleting(true);
    try {
      await emailsApi.deleteEmail(emailId);
      toast.success('Email removed — won\'t sync again');
      router.push('/dashboard');
    } catch {
      toast.error('Failed to delete email');
      setIsDeleting(false);
    }
  };

  const handleSummarizeAttachment = async (att: Attachment) => {
    setSummarizingId(att.attachment_id);
    try {
      const result = await emailsApi.summarizeAttachment(emailId as string, att.attachment_id, att.filename, att.mime_type);
      setAttachmentSummaries(prev => ({ ...prev, [att.attachment_id]: result.summary }));
    } catch {
      toast.error('Failed to summarize attachment');
    } finally {
      setSummarizingId(null);
    }
  };

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true);
    try {
      const result = await emailsApi.unsubscribe(emailId as string);
      if (result.success) {
        toast.success('Unsubscribed successfully');
      } else {
        toast.error(result.error || 'Unsubscribe failed — try visiting the link manually');
      }
    } catch {
      toast.error('Failed to unsubscribe');
    } finally {
      setIsUnsubscribing(false);
    }
  };

  const handleDownloadAttachment = async (att: Attachment) => {
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = `${base}/api/emails/${emailId}/attachments/${att.attachment_id}/download?filename=${encodeURIComponent(att.filename)}&mime_type=${encodeURIComponent(att.mime_type)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${sess?.access_token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Failed to download attachment');
    }
  };

  const isPinned = (email?.labels ?? []).includes('__pinned__');

  const handlePin = async () => {
    if (!emailId || !email) return;
    setIsPinning(true);
    try {
      await emailsApi.pinEmail(emailId, !isPinned);
      await mutateEmail();
      toast.success(!isPinned ? 'Email pinned' : 'Email unpinned');
    } catch {
      toast.error('Failed to update pin');
    } finally {
      setIsPinning(false);
    }
  };

  const handleMute = async () => {
    if (!emailId || !email) return;
    setIsMuting(true);
    try {
      await emailsApi.muteEmail(emailId, true);
      toast.success(`Muted emails from ${email.from_name || email.from_email}`);
      router.push('/email');
    } catch {
      toast.error('Failed to mute sender');
    } finally {
      setIsMuting(false);
    }
  };

  const handleSmartReplies = async () => {
    if (!emailId) return;
    setLoadingSmartReplies(true);
    try {
      const replies = await emailsApi.getSmartReplies(emailId);
      setSmartReplies(replies);
    } catch {
      toast.error('Failed to generate smart replies');
    } finally {
      setLoadingSmartReplies(false);
    }
  };

  const handleGenerateQuote = async () => {
    if (!emailId) return;
    setIsGeneratingQuote(true);
    try {
      const result = await emailsApi.generateQuote(emailId, {
        project_description: quoteProjectDesc || undefined,
        budget_hint: quoteBudgetHint || undefined,
      });
      setGeneratedQuote(result.quote);
      toast.success('Quote generated!');
    } catch {
      toast.error('Failed to generate quote');
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleThreadSummary = async () => {
    if (!emailId) return;
    setLoadingThreadSummary(true);
    try {
      const result = await emailsApi.getThreadSummary(emailId);
      if (result.status === 'single_email') {
        toast('This email has no thread to summarize.', { icon: 'ℹ️' });
      } else {
        setThreadSummary(result);
      }
    } catch {
      toast.error('Failed to generate thread summary');
    } finally {
      setLoadingThreadSummary(false);
    }
  };

  const handleCopyQuote = () => {
    if (!generatedQuote) return;
    const lines = [
      `PROJECT QUOTE: ${generatedQuote.project_title}`,
      '',
      generatedQuote.project_description,
      '',
      'DELIVERABLES:',
      ...generatedQuote.deliverables.map((d) => `• ${d}`),
      '',
      `Timeline: ${generatedQuote.timeline}`,
      `Price Estimate: ${generatedQuote.price_estimate}`,
      `Payment Terms: ${generatedQuote.payment_terms}`,
      `Validity: ${generatedQuote.validity}`,
      ...(generatedQuote.notes ? ['', `Notes: ${generatedQuote.notes}`] : []),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Quote copied to clipboard');
  };

  if (emailLoading) {
    return (
      <Layout title="Loading…">
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      </Layout>
    );
  }

  if (emailError || !email) {
    return (
      <Layout title="Email not found">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.back()} className="btn-secondary text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span>
          </button>
          <div className="card p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Email not found</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">This email may have been deleted or is not accessible.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const analysis = email.ai_analysis;

  return (
    <>
      {viewingAttachment && emailId && (
        <AttachmentViewer
          attachment={viewingAttachment}
          emailId={emailId}
          onClose={() => setViewingAttachment(null)}
        />
      )}
      {snoozeOpen && emailId && (
        <SnoozeModal
          emailId={emailId}
          currentSnooze={email?.snooze_until ?? null}
          onSnoozed={() => { setSnoozeOpen(false); mutateEmail(); }}
          onClose={() => setSnoozeOpen(false)}
        />
      )}

      {/* Quote Generator Modal */}
      {quoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Generate Project Quote</h2>
              </div>
              <button
                onClick={() => { setQuoteModalOpen(false); setGeneratedQuote(null); setQuoteProjectDesc(''); setQuoteBudgetHint(''); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!generatedQuote ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Optionally provide extra context to improve the quote.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Project Description <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={quoteProjectDesc}
                      onChange={(e) => setQuoteProjectDesc(e.target.value)}
                      placeholder="Describe the project scope or any extra details..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Budget Hint <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={quoteBudgetHint}
                      onChange={(e) => setQuoteBudgetHint(e.target.value)}
                      placeholder="e.g. $500–$1000 or client mentioned a tight budget"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleGenerateQuote}
                      disabled={isGeneratingQuote}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGeneratingQuote ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                      ) : (
                        <><FileEdit className="h-4 w-4" />Generate Quote</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Generated Quote Card */}
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-3">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{generatedQuote.project_title}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{generatedQuote.project_description}</p>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Deliverables</p>
                      <ul className="space-y-1">
                        {generatedQuote.deliverables.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Timeline</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{generatedQuote.timeline}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Price Estimate</p>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">{generatedQuote.price_estimate}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Terms</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{generatedQuote.payment_terms}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Validity</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{generatedQuote.validity}</p>
                      </div>
                    </div>

                    {generatedQuote.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">{generatedQuote.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-between">
                    <button
                      onClick={() => setGeneratedQuote(null)}
                      className="btn-secondary text-sm"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={handleCopyQuote}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      Copy to Clipboard
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Head><title>{email.subject} — Mailair</title></Head>
      <Layout title="Email Detail">
        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">

          {/* Top bar */}
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="btn-secondary shrink-0">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0 pb-0.5">
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="btn-secondary shrink-0"
                title="Re-process with AI"
              >
                {isReprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-primary-600" />}
                <span className="hidden sm:inline">{isReprocessing ? 'Processing…' : 'Reprocess'}</span>
              </button>

              {/* Star button */}
              <button
                onClick={handleStar}
                disabled={isStarring}
                className="btn-secondary text-sm"
                title={(isStarred !== null ? isStarred : email.is_starred) ? 'Unstar' : 'Star'}
              >
                <Star
                  className={clsx(
                    'h-4 w-4',
                    (isStarred !== null ? isStarred : email.is_starred)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-400'
                  )}
                />
                <span className="hidden sm:inline">
                  {(isStarred !== null ? isStarred : email.is_starred) ? 'Starred' : 'Star'}
                </span>
              </button>

              {/* Pin */}
              <button
                onClick={handlePin}
                disabled={isPinning}
                className={clsx('btn-secondary text-sm', isPinned && 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300')}
                title={isPinned ? 'Unpin email' : 'Pin email'}
              >
                {isPinning ? <Loader2 className="h-4 w-4 animate-spin" /> : isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                <span className="hidden sm:inline">{isPinned ? 'Unpin' : 'Pin'}</span>
              </button>

              {/* Mute sender */}
              <button
                onClick={handleMute}
                disabled={isMuting}
                className="btn-secondary text-sm"
                title="Mute sender — stop syncing their emails"
              >
                {isMuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4 text-gray-500" />}
                <span className="hidden sm:inline">Mute</span>
              </button>

              {/* Follow-up / Waiting for reply */}
              <button
                onClick={handleToggleFollowUp}
                disabled={isTogglingFollowUp}
                className={clsx(
                  'btn-secondary text-sm',
                  (email.labels ?? []).includes('__followup__') && 'bg-olive-50 border-olive-400 text-olive-600 dark:bg-olive-600/20 dark:border-olive-600 dark:text-olive-400'
                )}
                title="Mark as waiting for reply"
              >
                {isTogglingFollowUp
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <StickyNote className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {(email.labels ?? []).includes('__followup__') ? 'Waiting' : 'Follow-up'}
                </span>
              </button>

              {/* Snooze button */}
              <button
                onClick={() => setSnoozeOpen(true)}
                className="btn-secondary text-sm"
                title="Snooze"
              >
                <AlarmClock className="h-4 w-4 text-primary-500" />
                <span className="hidden sm:inline">Snooze</span>
              </button>

              {/* Summarize Thread button */}
              <button
                onClick={handleThreadSummary}
                disabled={loadingThreadSummary}
                className="btn-secondary text-sm"
                title="Summarize Thread"
              >
                {loadingThreadSummary
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Layers className="h-4 w-4 text-primary-500" />}
                <span className="hidden sm:inline">Summary</span>
              </button>

              {/* View full thread */}
              {email.gmail_thread_id && (
                <button
                  onClick={() => router.push(`/email/thread/${email.gmail_thread_id}`)}
                  className="btn-secondary text-sm"
                  title="View full thread"
                >
                  <Layers className="h-4 w-4 text-olive-500" />
                  <span className="hidden sm:inline">Thread</span>
                </button>
              )}

              {/* Generate Quote button — shown for quote_request emails */}
              {(String(analysis?.category ?? '').toLowerCase().includes('quote') || String(analysis?.category ?? '') === 'needs_response') && (
                <button
                  onClick={() => { setQuoteModalOpen(true); setGeneratedQuote(null); }}
                  className="btn-secondary text-sm"
                  title="Generate Quote"
                >
                  <FileEdit className="h-4 w-4 text-emerald-500" />
                  <span className="hidden sm:inline">Generate Quote</span>
                </button>
              )}

              {/* Forward to Slack */}
              <button
                onClick={handleForwardToSlack}
                disabled={isForwardingSlack}
                className="btn-secondary text-sm"
                title="Forward to Slack"
              >
                {isForwardingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 text-green-500" />}
                <span className="hidden sm:inline">Slack</span>
              </button>

              {/* Ask AI */}
              <button
                onClick={() => setAskAIOpen((v) => !v)}
                className={clsx('btn-secondary text-sm', askAIOpen && 'bg-olive-50 border-olive-400 text-olive-600 dark:bg-olive-600/20 dark:border-olive-600 dark:text-olive-400')}
                title="Ask AI about this email"
              >
                <Brain className="h-4 w-4 text-olive-500" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>

              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>

          {/* Ask AI panel */}
          {askAIOpen && (
            <div className="card p-4 border border-olive-100 dark:border-olive-600 bg-olive-50/50 dark:bg-olive-600/10 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-olive-600 dark:text-olive-400" />
                <h3 className="text-sm font-semibold text-olive-600 dark:text-olive-100">Ask AI about this email</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={askAIQuestion}
                  onChange={(e) => setAskAIQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  placeholder="e.g. Draft a polite decline, Summarize into 3 bullets, What action is needed?"
                  className="input-field flex-1 text-sm"
                />
                <button
                  onClick={handleAskAI}
                  disabled={askAILoading || !askAIQuestion.trim()}
                  className="btn-primary text-sm shrink-0"
                >
                  {askAILoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  <span>Ask</span>
                </button>
              </div>
              {askAIAnswer && (
                <div className="mt-3 rounded-lg bg-white dark:bg-gray-800 border border-olive-100 dark:border-olive-600 p-3">
                  <p className="text-xs font-medium text-olive-600 dark:text-olive-400 mb-1.5">AI Answer</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{askAIAnswer}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(askAIAnswer); toast.success('Copied!'); }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      <ClipboardCopy className="h-3 w-3" />Copy
                    </button>
                    <button onClick={() => { setAskAIAnswer(''); setAskAIQuestion(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email header card */}
          <div className="card p-4 sm:p-6 animate-slide-up">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-base font-bold shadow-sm">
                {(email.from_name || email.from_email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug break-words">
                  {email.subject}
                </h1>
                <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <strong className="font-medium text-gray-900 dark:text-gray-100 truncate">{email.from_name || email.from_email}</strong>
                    {email.from_name && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs hidden sm:inline">({email.from_email})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">{format(new Date(email.received_at), 'MMM d, yyyy · h:mm a')}</span>
                  </span>
                  {email.to_email && (
                    <span className="flex items-center gap-1.5 hidden sm:flex">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-500 dark:text-gray-400 text-sm truncate max-w-[200px]">{email.to_email}</span>
                    </span>
                  )}
                </div>
                {(analysis?.category || analysis?.priority_level) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.category && <CategoryBadge category={analysis.category} />}
                    {analysis.priority_level && (
                      <PriorityBadge level={analysis.priority_level} score={analysis.priority_score} showScore />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Meeting Detection Banner */}
            {meetingInfo && meetingInfo.is_meeting_request && (
              <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <CalendarCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Meeting Request Detected
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                        {meetingInfo.meeting_type && (
                          <span className="capitalize">{meetingInfo.meeting_type.replace('_', ' ')}</span>
                        )}
                        {meetingInfo.duration_hint && <span>{meetingInfo.duration_hint}</span>}
                        {meetingInfo.proposed_times && meetingInfo.proposed_times.length > 0 && (
                          <span>Proposed: {meetingInfo.proposed_times.join(', ')}</span>
                        )}
                      </div>
                      {meetingInfo.agenda && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{meetingInfo.agenda}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      disabled={addingToCalendar}
                      onClick={async () => {
                        if (gcalConnected) {
                          setAddingToCalendar(true);
                          try {
                            const result = await calendarApi.createEvent({
                              title: email.subject || 'Meeting',
                              description: `${meetingInfo.agenda || ''}\n\nFrom: ${email.from_name || email.from_email}\nProposed: ${(meetingInfo.proposed_times || []).join(', ')}`,
                              duration_hours: meetingInfo.duration_hint?.includes('30') ? 0.5 : 1,
                            });
                            toast.success(
                              result.html_link
                                ? <span>Event created! <a href={result.html_link} target="_blank" rel="noopener noreferrer" className="underline font-semibold">View in Calendar →</a></span>
                                : 'Event added to Google Calendar!'
                            );
                          } catch {
                            toast.error('Failed to create event. Try again.');
                          } finally {
                            setAddingToCalendar(false);
                          }
                        } else {
                          const title = encodeURIComponent(email.subject || 'Meeting');
                          const details = encodeURIComponent(meetingInfo.agenda || '');
                          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`, '_blank', 'noopener');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-800/30 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/40 transition-colors disabled:opacity-50"
                      title={gcalConnected ? 'Create event in Google Calendar' : 'Add to Google Calendar (connect in Settings for auto-create)'}
                    >
                      {addingToCalendar ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />}
                      {gcalConnected ? 'Create Event' : 'Add to Calendar'}
                    </button>
                    <button
                      onClick={() => setMeetingInfo(null)}
                      className="p-1 rounded text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {meetingInfo.suggested_reply_snippet && (
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-700 flex items-start justify-between gap-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400 italic flex-1">{meetingInfo.suggested_reply_snippet}</p>
                    <button
                      onClick={() => {
                        // Dispatch a custom event that ReplyEditor could listen to, or simply copy to clipboard
                        if (meetingInfo.suggested_reply_snippet) {
                          navigator.clipboard.writeText(meetingInfo.suggested_reply_snippet);
                          toast.success('Suggested reply copied to clipboard');
                        }
                      }}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-800/30 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/40 transition-colors whitespace-nowrap"
                    >
                      <ClipboardCopy className="h-3 w-3" />
                      Copy Reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Invoice Banner */}
            {analysis?.is_invoice && (
              <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">💳 Invoice detected</span>
                  {analysis.invoice_vendor && <span className="text-xs text-amber-700 dark:text-amber-400">From: {analysis.invoice_vendor}</span>}
                  {analysis.invoice_amount && <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">{analysis.invoice_amount}</span>}
                  {analysis.invoice_due_date && <span className="text-xs text-amber-700 dark:text-amber-400">Due: {analysis.invoice_due_date}</span>}
                </div>
              </div>
            )}

            {/* Unsubscribe Banner */}
            {(email?.labels ?? []).some((l: string) => l.startsWith('__unsub__:')) && (
              <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-600 dark:text-gray-400">This email has an unsubscribe link.</span>
                <button
                  onClick={handleUnsubscribe}
                  disabled={isUnsubscribing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                >
                  {isUnsubscribing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {isUnsubscribing ? 'Unsubscribing…' : 'Unsubscribe'}
                </button>
              </div>
            )}

            {/* Phishing Warning Banner */}
            {analysis?.is_phishing && (
              <div className="mt-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      Potential Phishing / Social Engineering Detected
                    </p>
                    <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                      Do not click any links or provide personal information. Verify the sender independently.
                    </p>
                    {analysis.phishing_indicators && analysis.phishing_indicators.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {analysis.phishing_indicators.map((indicator, i) => (
                          <li key={i} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5">
                            <span className="flex-shrink-0 mt-0.5">•</span>
                            {indicator}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Thread Summary Card */}
            {threadSummary && threadSummary.status === 'summarized' && (
              <div className="mt-4 rounded-lg border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <Layers className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">
                        Thread Summary ({threadSummary.thread_length} emails)
                      </p>
                      <p className="mt-1 text-xs text-primary-700 dark:text-primary-400 leading-relaxed">
                        {threadSummary.summary}
                      </p>
                      {threadSummary.key_points.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {threadSummary.key_points.map((pt, i) => (
                            <li key={i} className="text-xs text-primary-700 dark:text-primary-400 flex items-start gap-1.5">
                              <span className="flex-shrink-0 mt-0.5">•</span>{pt}
                            </li>
                          ))}
                        </ul>
                      )}
                      {threadSummary.next_action && (
                        <p className="mt-2 text-xs font-medium text-primary-800 dark:text-primary-300">
                          Next: {threadSummary.next_action}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setThreadSummary(null)}
                    className="flex-shrink-0 p-1 rounded text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800/40 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Email body */}
            <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5">
              {email.body_html ? (
                <EmailBodyFrame html={email.body_html} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                  {(email.body_text || email.snippet || '').replace(
                    /(https?:\/\/[^\s]+)/g,
                    '$1'
                  ).split(/(https?:\/\/[^\s]+)/).map((part, i) =>
                    /^https?:\/\//.test(part)
                      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline break-all">{part}</a>
                      : part
                  )}
                </pre>
              )}
            </div>

            {/* Attachments */}
            {(attachmentsLoading || attachments.length > 0) && (
              <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Attachments {attachments.length > 0 && `(${attachments.length})`}
                  </span>
                </div>
                {attachmentsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading attachments…
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {attachments.map((att) => {
                      const FileIcon = getFileIcon(att.mime_type);
                      const colorClass = getFileColor(att.mime_type);
                      return (
                        <div key={att.attachment_id} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 group hover:border-primary-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                              <FileIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{att.filename}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(att.size)}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleSummarizeAttachment(att)}
                                disabled={summarizingId === att.attachment_id}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                title="AI Summarize"
                              >
                                {summarizingId === att.attachment_id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Brain className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => setViewingAttachment(att)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-100 transition-colors"
                                title="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownloadAttachment(att)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-100 transition-colors"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {attachmentSummaries[att.attachment_id] && (
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed whitespace-pre-line">
                              {attachmentSummaries[att.attachment_id]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Analysis + Action Items — stacked on mobile, side-by-side on lg */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* AI Analysis Panel */}
            {analysis && (
              <div className="card p-4 sm:p-5 animate-slide-up stagger-2">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Analysis</h2>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Summary</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Priority Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            analysis.priority_score >= 7 ? 'bg-red-500'
                            : analysis.priority_score >= 4 ? 'bg-amber-500'
                            : 'bg-green-500'
                          }`}
                          style={{ width: `${(analysis.priority_score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-8 text-right">
                        {analysis.priority_score}/10
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Sentiment</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      analysis.sentiment === 'positive' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                      : analysis.sentiment === 'negative' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}>
                      {analysis.sentiment}
                    </span>
                  </div>
                  {analysis.key_topics && analysis.key_topics.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Key Topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.key_topics.map((topic) => (
                          <span key={topic} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <Tag className="h-3 w-3" />{topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Items */}
            <div className="card p-4 sm:p-5 animate-slide-up stagger-3">
              <div className="flex items-center gap-2 mb-4">
                <List className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Action Items</h2>
                <span className="ml-auto rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {actions.length}
                </span>
              </div>
              {actionsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : actions.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckSquare className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No action items extracted</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Re-process the email to generate action items</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actions.map((action) => (
                    <ActionItem key={action.id} action={action} onUpdate={(updated) =>
                      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                    } />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom Tags */}
          <div className="card p-4 sm:p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Custom Tags</h2>
              <button
                onClick={() => setTagsOpen((v) => !v)}
                className="ml-auto text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {tagsOpen ? 'Done' : 'Add tag'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {emailTagIds.map((id) => {
                const tag = allTags.find((t) => t.id === id);
                if (!tag) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button onClick={() => handleRemoveEmailTag(id)} className="ml-0.5 hover:opacity-70 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {emailTagIds.length === 0 && !tagsOpen && (
                <span className="text-xs text-gray-400 dark:text-gray-500">No tags yet — click "Add tag" to label this email</span>
              )}
            </div>
            {tagsOpen && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Tag name (e.g. VIP, Follow-up)"
                    className="input-field flex-1 text-sm py-1.5"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!newTagName.trim()}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Add
                  </button>
                </div>
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.filter((t) => !emailTagIds.includes(t.id)).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          if (!emailId) return;
                          const next = [...emailTagIds, tag.id];
                          setEmailTagIds(next);
                          setEmailTags(emailId, next);
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: tag.color }}
                      >
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Team Collaboration Panel — shown only when org exists (members list is non-empty) */}
          {orgMembers.length > 0 && (
            <div className="card p-4 sm:p-5 animate-slide-up stagger-4 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Team</h2>
              </div>

              {/* Assign */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Assigned to</label>
                <select
                  value={assignedTo}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={assigning}
                  className="input-field flex-1 text-sm py-1.5"
                >
                  <option value="">— Unassigned —</option>
                  {orgMembers.map((m) => {
                    const name = m.user_profiles?.name || m.invited_email || m.user_id || 'Unknown';
                    const val = m.user_profiles?.id || m.user_id || '';
                    return val ? <option key={m.id} value={val}>{name}</option> : null;
                  })}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Internal Notes</span>
                </div>
                {notes.length > 0 && (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap break-words">{n.note}</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            {n.user_profiles?.name || 'You'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="flex-shrink-0 p-0.5 text-amber-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                    placeholder="Add a team note..."
                    className="input-field flex-1 text-sm py-1.5"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Smart Replies */}
          <div className="animate-slide-up stagger-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Smart Replies</h2>
              <button
                onClick={handleSmartReplies}
                disabled={loadingSmartReplies}
                className="ml-auto btn-secondary text-xs py-1"
              >
                {loadingSmartReplies
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                {smartReplies.length > 0 ? 'Refresh' : 'Generate'}
              </button>
            </div>
            {smartReplies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => setSuggestedReply(reply)}
                    className="rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left max-w-xs truncate"
                    title={reply}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply Editor */}
          <div className="animate-slide-up stagger-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-primary-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">AI Reply Draft</h2>
            </div>
            <ReplyEditor
              emailId={email.id}
              draft={replyDraft}
              suggestedReply={suggestedReply}
              senderName={email.from_name || email.from_email}
              onSent={() => { mutateEmail(); setSuggestedReply(null); }}
            />
          </div>

        </div>
      </Layout>
    </>
  );
}
