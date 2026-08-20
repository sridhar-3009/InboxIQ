import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Send, Save, Zap, Loader2, Sparkles, FileText, ChevronDown, Mic, MicOff, Wand2, X, Brain } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { repliesApi, emailsApi } from '@/lib/api';
import { loadTemplates } from '@/lib/templates';
import type { ReplyDraft } from '@/lib/types';

interface ReplyEditorProps {
  emailId: string;
  draft?: ReplyDraft | null | undefined;
  suggestedReply?: string | null;
  senderName?: string;
  onSent?: () => void;
  onCancel?: () => void;
  className?: string;
}

const MAX_CHARS = 5000;

export default function ReplyEditor({ emailId, draft, suggestedReply, senderName, onSent, onCancel, className }: ReplyEditorProps) {
  const [content, setContent] = useState(draft?.draft_content ?? '');
  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [confidence, setConfidence] = useState(draft?.confidence_score);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sendCountdown, setSendCountdown] = useState<number | null>(null);
  const [toneLoading, setToneLoading] = useState(false);
  const [toneResult, setToneResult] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const templates = loadTemplates();

  useEffect(() => {
    if (draft?.draft_content) {
      setContent(draft.draft_content);
      setConfidence(draft.confidence_score);
      setHasChanges(false);
    }
  }, [draft?.draft_content]);

  useEffect(() => {
    if (suggestedReply) {
      setContent(suggestedReply);
      setHasChanges(true);
    }
  }, [suggestedReply]);

  // Countdown tick
  useEffect(() => {
    if (sendCountdown === null || sendCountdown <= 0) return;
    const t = setTimeout(() => setSendCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [sendCountdown]);

  // When countdown hits 0, send
  useEffect(() => {
    if (sendCountdown !== 0) return;
    setSendCountdown(null);
    doSend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendCountdown]);

  const handleChange = (value: string) => {
    if (value.length <= MAX_CHARS) {
      setContent(value);
      setHasChanges(value !== (draft?.draft_content ?? ''));
    }
  };

  const handleGenerate = async () => {
    if (!instructions.trim()) {
      toast.error('Enter instructions for the AI first');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await emailsApi.generateReply(emailId, instructions.trim());
      setContent(result.draft_content);
      setConfidence(result.confidence_score);
      setHasChanges(true);
      setInstructions('');
      toast.success('New draft generated');
    } catch {
      toast.error('Failed to generate reply');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await repliesApi.updateReplyDraft(emailId, content);
      setHasChanges(false);
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const doSend = async () => {
    setIsSending(true);
    try {
      await repliesApi.sendReply(emailId, content);
      toast.success('Reply sent!');
      onSent?.();
    } catch {
      toast.error('Failed to send reply. Check Gmail connection.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    if (!content.trim()) { toast.error('Reply cannot be empty'); return; }
    setSendCountdown(5);
  };

  const handleUndoSend = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    setSendCountdown(null);
    toast('Send cancelled');
  };

  const handleCheckTone = async () => {
    if (!content.trim()) { toast.error('Write a reply first'); return; }
    setToneLoading(true);
    setToneResult(null);
    try {
      const { answer } = await emailsApi.askAI(
        emailId,
        `Briefly analyze the tone of this email reply in 2-3 sentences. Is it too formal, too casual, aggressive, or just right? Any quick improvements?\n\n${content}`
      );
      setToneResult(answer);
    } catch {
      toast.error('Tone check failed');
    } finally {
      setToneLoading(false);
    }
  };

  // Close template dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplatesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as unknown[])
        .slice(event.resultIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join(' ');
      setContent((prev) => (prev ? prev + ' ' + transcript : transcript));
      setHasChanges(true);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Voice input error. Please try again.');
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    toast('Listening… speak now', { icon: '🎤' });
  };

  const insertTemplate = (body: string) => {
    const now = new Date();
    const substituted = body
      .replace(/\{\{date\}\}/gi, format(now, 'MMMM d, yyyy'))
      .replace(/\{\{name\}\}/gi, senderName || 'there')
      .replace(/\{\{company\}\}/gi, '[Company]')
      .replace(/\{\{month\}\}/gi, format(now, 'MMMM'));
    setContent((prev) => (prev ? prev + '\n\n' + substituted : substituted));
    setHasChanges(true);
    setTemplatesOpen(false);
  };

  const charPercentage = (content.length / MAX_CHARS) * 100;

  return (
    <div className={clsx('card', className)}>
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Reply Draft</h3>
          {confidence !== undefined && (
            <span className="rounded-full bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
        {hasChanges && (
          <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Instruction input */}
        <div className="rounded-lg border border-primary-100 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-3">
          <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-2">Tell AI how to reply</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleGenerate()}
              placeholder='e.g. "Decline politely" or "Ask for more details by Friday"'
              className="flex-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !instructions.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Draft textarea */}
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="AI-generated reply will appear here. Use the field above to guide the AI, or edit directly."
          rows={8}
          className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors placeholder-gray-400 dark:placeholder-gray-500"
        />

        {/* Character count bar */}
        <div className="flex items-center justify-between">
          <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mr-3">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                charPercentage > 90 ? 'bg-red-500' : charPercentage > 70 ? 'bg-amber-500' : 'bg-primary-500'
              )}
              style={{ width: `${Math.min(charPercentage, 100)}%` }}
            />
          </div>
          <span
            className={clsx(
              'text-xs tabular-nums',
              content.length > MAX_CHARS * 0.9 ? 'text-red-500 font-medium' : 'text-gray-400'
            )}
          >
            {content.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
          </span>
        </div>

        {/* Undo send bar */}
        {sendCountdown !== null && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
            <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              Sending in {sendCountdown}s…
            </span>
            <button
              onClick={handleUndoSend}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-600 bg-white dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Undo
            </button>
          </div>
        )}

        {/* Tone check result */}
        {toneResult && (
          <div className="rounded-lg border border-olive-100 dark:border-olive-600/40 bg-olive-50 dark:bg-olive-600/10 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Brain className="h-3.5 w-3.5 text-olive-600 dark:text-olive-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-olive-600 dark:text-olive-200 leading-relaxed">{toneResult}</p>
              </div>
              <button onClick={() => setToneResult(null)} className="flex-shrink-0 text-olive-400 hover:text-olive-600 dark:hover:text-olive-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {/* Tone Coach */}
          <button
            onClick={handleCheckTone}
            disabled={toneLoading || !content.trim()}
            className={clsx(
              'btn-secondary text-sm gap-1.5',
              toneResult && 'border-olive-400 bg-olive-50 text-olive-600 dark:border-olive-600 dark:bg-olive-600/20 dark:text-olive-400'
            )}
            title="Check tone with AI"
          >
            {toneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Tone
          </button>

          {/* Voice input */}
          <button
            onClick={toggleVoice}
            className={clsx(
              'btn-secondary text-sm gap-1.5',
              isListening && 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400'
            )}
            title={isListening ? 'Stop recording' : 'Voice input'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? 'Stop' : 'Voice'}
          </button>

          {/* Templates dropdown */}
          <div className="relative" ref={templateMenuRef}>
            <button
              onClick={() => setTemplatesOpen((v) => !v)}
              className="btn-secondary text-sm gap-1.5"
              title="Insert template"
            >
              <FileText className="h-4 w-4" />
              Templates
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {templatesOpen && (
              <div className="absolute bottom-full mb-1 right-0 z-30 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => insertTemplate(t.body)}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <p className="font-medium text-xs">{t.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">{t.body.split('\n')[0]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="btn-secondary text-sm gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={handleSend}
            disabled={isSending || !content.trim() || sendCountdown !== null}
            className="btn-primary text-sm gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSending ? 'Sending...' : 'Send via Gmail'}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="btn-secondary text-sm">
              Cancel
            </button>
          )}
        </div>

        {draft?.is_sent && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
              Reply sent {draft.sent_at ? `on ${new Date(draft.sent_at).toLocaleDateString()}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
