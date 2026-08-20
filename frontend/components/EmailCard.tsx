import { useState } from 'react';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronRight, CheckSquare, Paperclip, X, Star, AlarmClock, Zap, Loader2,
  MailMinus, Clock, Reply, MailCheck, RefreshCw, Pin,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import type { Email } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import CategoryBadge from './CategoryBadge';
import { emailsApi } from '@/lib/api';
import SnoozeModal from './SnoozeModal';

type Density = 'compact' | 'comfortable' | 'spacious';

interface EmailCardProps {
  email: Email;
  className?: string;
  density?: Density;
  recurringCount?: number;
  onDismiss?: (id: string) => void;
  onProcessed?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  onReadingPaneSelect?: () => void;
  readingPaneActive?: boolean;
}

const AVATAR_GRADIENTS = [
  'from-primary-400 to-primary-600',
  'from-primary-400 to-primary-600',
  'from-emerald-400 to-emerald-600',
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
  'from-cyan-400 to-cyan-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
];

function getGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default function EmailCard({
  email, className, density = 'comfortable', recurringCount = 0,
  onDismiss, onProcessed, selected, onToggleSelect, onReadingPaneSelect, readingPaneActive,
}: EmailCardProps) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [starred, setStarred] = useState(email.is_starred);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);

  const handleClick = () => {
    if (onToggleSelect) return;
    if (onReadingPaneSelect) { onReadingPaneSelect(); return; }
    router.push(`/email/${email.id}`);
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissing(true);
    try {
      await emailsApi.deleteEmail(email.id);
      onDismiss?.(email.id);
      toast.success('Email removed');
    } catch {
      toast.error('Failed to remove email');
      setDismissing(false);
    }
  };

  const handleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !starred;
    setStarred(next);
    try {
      await emailsApi.starEmail(email.id, next);
    } catch {
      setStarred(!next);
      toast.error('Failed to update star');
    }
  };

  const handleProcess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    try {
      await emailsApi.processEmail(email.id);
      toast.success('Processing with AI…');
      onProcessed?.();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 402) {
        toast.error('Monthly limit reached. Upgrade to Pro for unlimited processing.', { duration: 6000, icon: '⚡' });
      } else {
        toast.error(msg || 'Failed to process email');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSnoozeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSnoozeOpen(true);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/email/${email.id}?reply=1`);
  };

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.is_read) return;
    setMarkingRead(true);
    try {
      await emailsApi.markAsRead(email.id);
      onDismiss?.(email.id);
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(false);
    }
  };

  const analysis = email.ai_analysis;
  const senderName = email.from_name || email.from_email || '?';
  const timeAgo = formatDistanceToNow(new Date(email.received_at), { addSuffix: true });
  const gradient = getGradient(senderName);
  const isSnoozed = !!(email.snooze_until);
  const unsubscribeUrl = (email.labels ?? []).find((l) => l.startsWith('__unsub__:'))?.slice('__unsub__:'.length);
  const isWaitingReply = (email.labels ?? []).includes('__followup__');
  const readTime = estimateReadTime(email.body_text || email.snippet || '');

  const isCompact = density === 'compact';
  const isSpaciou = density === 'spacious';
  const isPinned = (email.labels ?? []).includes('__pinned__');

  return (
    <>
      <div
        onClick={onToggleSelect ? onToggleSelect : handleClick}
        className={clsx(
          'card card-hover group flex cursor-pointer items-start gap-3 sm:gap-4 relative',
          isCompact ? 'p-2 sm:p-3' : isSpaciou ? 'p-4 sm:p-5' : 'p-3 sm:p-4',
          analysis?.priority_level === 'high'   ? 'border-l-4 border-l-red-500' :
          analysis?.priority_level === 'medium' ? 'border-l-4 border-l-amber-400' :
          analysis?.priority_level === 'low'    ? 'border-l-4 border-l-emerald-400' :
          !email.is_read                        ? 'border-l-4 border-l-primary-400' : '',
          dismissing && 'opacity-40 pointer-events-none',
          selected && 'ring-2 ring-primary-500 bg-primary-50/50',
          readingPaneActive && 'ring-2 ring-primary-400 bg-primary-50/30 dark:bg-primary-900/10',
          className
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && (onToggleSelect ? onToggleSelect() : handleClick())}
      >
        {/* Checkbox (selection mode) */}
        {onToggleSelect && (
          <div className="flex-shrink-0 flex items-center mt-1" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Sender Avatar + Profile Card */}
        {!isCompact && (
          <div
            className="relative flex-shrink-0 mt-0.5"
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
          >
            <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-sm cursor-default`}>
              {senderName[0].toUpperCase()}
            </div>
            {avatarHovered && (
              <div
                className="absolute left-0 top-full mt-1.5 z-40 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-3 space-y-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold mb-1`}>
                  {senderName[0].toUpperCase()}
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{senderName}</p>
                {email.from_email && senderName !== email.from_email && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{email.from_email}</p>
                )}
                {recurringCount >= 3 && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {recurringCount} emails in last 30 days
                  </p>
                )}
                {isPinned && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    Email pinned
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={clsx(
                  'text-sm truncate max-w-[160px] sm:max-w-none',
                  !email.is_read ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-semibold text-gray-700 dark:text-gray-300'
                )}>
                  {senderName}
                </span>
                {recurringCount >= 3 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700">
                    <RefreshCw className="h-2.5 w-2.5" />
                    {recurringCount >= 10 ? 'Frequent' : 'Regular'}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">{timeAgo}</span>
              </div>
              <p className={clsx(
                'mt-0.5 text-sm leading-snug',
                isCompact ? 'truncate' : 'line-clamp-1',
                !email.is_read ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'
              )}>
                {email.subject}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{timeAgo}</span>

              {/* Inline quick actions (hover) */}
              <button
                onClick={handleReply}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300 dark:text-gray-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-150"
                title="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {!email.is_read && (
                <button
                  onClick={handleMarkRead}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300 dark:text-gray-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-150"
                  title="Mark as read"
                >
                  {markingRead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Star button */}
              <button
                onClick={handleStar}
                className={clsx(
                  'rounded p-0.5 transition-all duration-150',
                  starred
                    ? 'text-amber-400'
                    : 'opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 hover:text-amber-400'
                )}
                title={starred ? 'Unstar' : 'Star'}
              >
                <Star className={clsx('h-3.5 w-3.5', starred && 'fill-amber-400')} />
              </button>
              {/* Snooze button */}
              <button
                onClick={handleSnoozeClick}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300 dark:text-gray-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-150"
                title="Snooze"
              >
                <AlarmClock className="h-3.5 w-3.5" />
              </button>
              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 transition-all duration-150 group-hover:translate-x-0.5" />
            </div>
          </div>

          {/* AI Summary — hidden in compact mode */}
          {!isCompact && analysis?.summary && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed hidden sm:block">
              {analysis.summary}
            </p>
          )}

          {/* Badges row */}
          {!isCompact && (
            <div className="mt-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {!email.processed && !email.ai_analysis && (
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                >
                  {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  {processing ? 'Processing…' : 'Process with AI'}
                </button>
              )}
              {analysis?.category && <CategoryBadge category={analysis.category} size="sm" />}
              {analysis?.priority_level && <PriorityBadge level={analysis.priority_level} size="sm" />}
              {(email.action_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 border border-primary-100">
                  <CheckSquare className="h-3 w-3" />
                  {email.action_count}
                </span>
              )}
              {!!(email as unknown as Record<string, unknown>).has_attachments && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  <Paperclip className="h-3 w-3" />
                  Attachments
                </span>
              )}
              {isSnoozed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 border border-primary-100">
                  <AlarmClock className="h-3 w-3" />
                  Snoozed
                </span>
              )}
              {isWaitingReply && (
                <span className="inline-flex items-center gap-1 rounded-full bg-olive-50 dark:bg-olive-600/20 px-2 py-0.5 text-xs font-medium text-olive-600 dark:text-olive-400 border border-olive-100 dark:border-olive-600/40">
                  <Clock className="h-3 w-3" />
                  Waiting
                </span>
              )}
              {isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                  <Pin className="h-3 w-3" />
                  Pinned
                </span>
              )}
              {unsubscribeUrl && (
                <a
                  href={unsubscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 text-xs font-medium text-rose-500 dark:text-rose-400 border border-rose-200 dark:border-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <MailMinus className="h-3 w-3" />
                  Unsubscribe
                </a>
              )}
              {isSpaciou && readTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 text-xs text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700">
                  <Clock className="h-3 w-3" />
                  ~{readTime} min
                </span>
              )}
            </div>
          )}

          {/* Compact mode: inline badges */}
          {isCompact && (analysis?.category || analysis?.priority_level) && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {analysis?.category && <CategoryBadge category={analysis.category} size="sm" />}
              {analysis?.priority_level && <PriorityBadge level={analysis.priority_level} size="sm" />}
            </div>
          )}
        </div>
      </div>

      {snoozeOpen && (
        <SnoozeModal
          emailId={email.id}
          currentSnooze={email.snooze_until ?? null}
          onSnoozed={() => {
            setSnoozeOpen(false);
            onDismiss?.(email.id);
          }}
          onClose={() => setSnoozeOpen(false)}
        />
      )}
    </>
  );
}
