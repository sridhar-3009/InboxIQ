import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, ExternalLink, Star, Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { emailsApi } from '@/lib/api';
import type { Email } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import CategoryBadge from './CategoryBadge';

interface ReadingPaneProps {
  emailId: string;
  onClose: () => void;
  onMutate?: () => void;
}

function EmailBodyFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(300);
  const doc = `<!DOCTYPE html><html><head><base target="_blank"><meta charset="utf-8">
  <style>body{margin:0;padding:8px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#202124;word-break:break-word;}
  a{color:#1a73e8;}img{max-width:100%;height:auto;}*{box-sizing:border-box;}</style></head>
  <body>${html}</body>
  <script>document.addEventListener('DOMContentLoaded',()=>{window.parent.postMessage({type:'resize',h:document.body.scrollHeight},'*');});<\/script>
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

export default function ReadingPane({ emailId, onClose, onMutate }: ReadingPaneProps) {
  const router = useRouter();
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setEmail(null);
    emailsApi.getEmail(emailId)
      .then((e) => {
        setEmail(e);
        setStarred(e.is_starred);
        if (!e.is_read) {
          emailsApi.markAsRead(emailId).catch(() => {});
          onMutate?.();
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [emailId]);

  const handleStar = async () => {
    if (!email) return;
    const next = !starred;
    setStarred(next);
    try { await emailsApi.starEmail(email.id, next); }
    catch { setStarred(!next); toast.error('Failed to update star'); }
  };

  const analysis = email?.ai_analysis;
  const priorityColor =
    analysis?.priority_level === 'high'   ? 'border-l-red-500' :
    analysis?.priority_level === 'medium' ? 'border-l-amber-400' :
    analysis?.priority_level === 'low'    ? 'border-l-emerald-400' : 'border-l-gray-200 dark:border-l-gray-700';

  return (
    <div className={clsx('card border-l-4 overflow-hidden animate-fade-in', priorityColor)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={handleStar}
          className="flex-shrink-0 rounded p-0.5 transition-colors"
          title={starred ? 'Unstar' : 'Star'}
        >
          <Star className={clsx('h-4 w-4', starred ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400')} />
        </button>
        <div className="flex-1 min-w-0">
          {email && (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {email.from_name || email.from_email} ·{' '}
              {format(new Date(email.received_at), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
        <button
          onClick={() => email && router.push(`/email/${email.id}`)}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          title="Open full view"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        </div>
      )}

      {error && (
        <div className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load email.</p>
        </div>
      )}

      {email && !loading && (
        <div className="p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {email.subject}
          </h2>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {analysis?.category && <CategoryBadge category={analysis.category} size="sm" />}
            {analysis?.priority_level && <PriorityBadge level={analysis.priority_level} size="sm" />}
            {email.is_starred && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-200">
                <Star className="h-3 w-3 fill-amber-400" />Starred
              </span>
            )}
            {(email.labels ?? []).includes('__followup__') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-olive-50 dark:bg-olive-600/20 px-2 py-0.5 text-xs font-medium text-olive-600 dark:text-olive-400 border border-olive-100 dark:border-olive-600/40">
                <Clock className="h-3 w-3" />Waiting
              </span>
            )}
          </div>

          {/* AI Summary */}
          {analysis?.summary && (
            <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 p-3">
              <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">AI Summary</p>
              <p className="text-sm text-primary-800 dark:text-primary-200">{analysis.summary}</p>
            </div>
          )}

          {/* Body */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            {email.body_html ? (
              <EmailBodyFrame html={email.body_html} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                {email.body_text || email.snippet}
              </pre>
            )}
          </div>

          {/* Quick reply link */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <button
              onClick={() => router.push(`/email/${email.id}?reply=1`)}
              className="btn-primary text-sm"
            >
              <Mail className="h-4 w-4" />
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
