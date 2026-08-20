import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { format } from 'date-fns';
import {
  ArrowLeft, Mail, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Star, Tag, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PriorityBadge from '@/components/PriorityBadge';
import CategoryBadge from '@/components/CategoryBadge';
import ReplyEditor from '@/components/ReplyEditor';
import { emailsApi } from '@/lib/api';
import type { Email } from '@/lib/types';

const AVATAR_GRADIENTS = [
  'from-primary-400 to-primary-600', 'from-emerald-400 to-emerald-600',
  'from-rose-400 to-rose-600', 'from-amber-400 to-amber-600',
  'from-cyan-400 to-cyan-600', 'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600', 'from-olive-400 to-olive-600',
];
function gradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function EmailBodyFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(200);
  const doc = `<!DOCTYPE html><html><head><base target="_blank"><meta charset="utf-8">
  <style>body{margin:0;padding:8px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#202124;word-break:break-word;}
  a{color:#1a73e8;}img{max-width:100%;height:auto;}*{box-sizing:border-box;}</style></head>
  <body>${html}</body>
  <script>document.addEventListener('DOMContentLoaded',()=>{window.parent.postMessage({type:'resize',h:document.body.scrollHeight},'*');});</script>
  </html>`;
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'resize') setHeight(Math.max(e.data.h + 32, 100));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  return (
    <iframe
      srcDoc={doc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      title="Email body"
    />
  );
}

function ThreadEmail({ email, index, defaultOpen }: { email: Email; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [replyOpen, setReplyOpen] = useState(false);
  const analysis = email.ai_analysis;
  const senderName = email.from_name || email.from_email || '?';
  const grad = gradient(senderName);
  const priorityColor =
    analysis?.priority_level === 'high'   ? 'border-l-red-500' :
    analysis?.priority_level === 'medium' ? 'border-l-amber-400' :
    analysis?.priority_level === 'low'    ? 'border-l-emerald-400' : 'border-l-gray-200 dark:border-l-gray-700';

  return (
    <div className={clsx('card border-l-4 overflow-hidden', priorityColor)}>
      {/* Header — always visible, click to expand/collapse */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-semibold shadow-sm`}>
          {senderName[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{senderName}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {format(new Date(email.received_at), 'MMM d, yyyy · h:mm a')}
            </span>
            {index === 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">Original</span>}
          </div>
          <p className={clsx('mt-0.5 text-sm truncate', open ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400')}>
            {open ? email.from_email : (email.snippet || email.subject)}
          </p>
          {!open && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {analysis?.category && <CategoryBadge category={analysis.category} size="sm" />}
              {analysis?.priority_level && <PriorityBadge level={analysis.priority_level} size="sm" />}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* AI summary */}
          {analysis?.summary && (
            <div className="mx-4 mt-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 p-3">
              <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">AI Summary</p>
              <p className="text-sm text-primary-800 dark:text-primary-200">{analysis.summary}</p>
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap px-4 py-2">
            {analysis?.category && <CategoryBadge category={analysis.category} size="sm" />}
            {analysis?.priority_level && <PriorityBadge level={analysis.priority_level} size="sm" />}
            {email.is_starred && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-200"><Star className="h-3 w-3 fill-amber-400" />Starred</span>}
            {(email.labels ?? []).includes('__followup__') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-olive-50 dark:bg-olive-600/20 px-2 py-0.5 text-xs font-medium text-olive-600 dark:text-olive-400 border border-olive-100 dark:border-olive-600">
                <Clock className="h-3 w-3" />Waiting
              </span>
            )}
          </div>

          {/* Email body */}
          <div className="px-4 pb-2">
            {email.body_html ? (
              <EmailBodyFrame html={email.body_html} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">{email.body_text}</pre>
            )}
          </div>

          {/* Reply */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-4">
            {replyOpen ? (
              <ReplyEditor
                emailId={email.id}
                onSent={() => { setReplyOpen(false); toast.success('Reply sent!'); }}
                onCancel={() => setReplyOpen(false)}
              />
            ) : (
              <button
                onClick={() => setReplyOpen(true)}
                className="btn-primary text-sm"
              >
                <Mail className="h-4 w-4" />
                Reply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ThreadViewPage() {
  const router = useRouter();
  const { threadId } = router.query;
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (!threadId || typeof threadId !== 'string') return;
    setLoading(true);
    emailsApi.getThread(threadId)
      .then(setEmails)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [threadId]);

  if (sessionLoading) return <LoadingSpinner fullPage />;
  if (!session) return null;

  const subject = emails[0]?.subject ?? 'Thread';
  const threadTitle = subject.replace(/^(Re|Fwd?):\s*/i, '').trim();

  return (
    <>
      <Head><title>{threadTitle} — Mailair</title></Head>
      <Layout title="Thread">
        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-secondary text-sm">
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{threadTitle}</h1>
              {!loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {emails.length} message{emails.length !== 1 ? 's' : ''} in thread
                </p>
              )}
            </div>
          </div>

          {/* Thread */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="card p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load thread.</p>
              <button onClick={() => router.back()} className="btn-secondary text-sm mt-4">Go back</button>
            </div>
          ) : emails.length === 0 ? (
            <div className="card p-8 text-center">
              <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No emails found in this thread.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email, idx) => (
                <ThreadEmail
                  key={email.id}
                  email={email}
                  index={idx}
                  defaultOpen={idx === emails.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
