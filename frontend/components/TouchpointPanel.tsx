import { useState } from 'react';
import { Phone, MessageCircle, Users2, MoreHorizontal, Plus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { touchpointsApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { ClientTouchpoint } from '@/lib/types';

const CHANNEL_ICON: Record<ClientTouchpoint['channel'], React.ComponentType<{ className?: string }>> = {
  call: Phone,
  sms: MessageCircle,
  whatsapp: MessageCircle,
  meeting: Users2,
  other: MoreHorizontal,
};

const CHANNEL_LABEL: Record<ClientTouchpoint['channel'], string> = {
  call: 'Call',
  sms: 'Text',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
  other: 'Other',
};

interface TouchpointPanelProps {
  contactEmail: string;
  contactName?: string;
  touchpoints: ClientTouchpoint[];
}

export default function TouchpointPanel({ contactEmail, contactName, touchpoints: initial }: TouchpointPanelProps) {
  const [touchpoints, setTouchpoints] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<ClientTouchpoint['channel']>('call');
  const [direction, setDirection] = useState<ClientTouchpoint['direction']>('outbound');
  const [summary, setSummary] = useState('');

  const handleLog = async () => {
    setSaving(true);
    try {
      const created = await touchpointsApi.log({
        contact_email: contactEmail,
        contact_name: contactName,
        channel,
        direction,
        summary: summary.trim() || undefined,
      });
      setTouchpoints((prev) => [created, ...prev]);
      setSummary('');
      setFormOpen(false);
      toast.success('Logged');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to log touchpoint'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = touchpoints;
    setTouchpoints((t) => t.filter((tp) => tp.id !== id));
    try {
      await touchpointsApi.remove(id);
    } catch (err) {
      setTouchpoints(prev);
      toast.error(apiErrorMessage(err, 'Failed to remove'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Calls &amp; Other Contact
        </h3>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <Plus className="h-3.5 w-3.5" /> Log
        </button>
      </div>

      {formOpen && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 mb-3 space-y-2.5">
          <div className="flex gap-1.5 flex-wrap">
            {(['call', 'sms', 'whatsapp', 'meeting', 'other'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={
                  channel === c
                    ? 'rounded-full bg-primary-600 text-white text-xs font-medium px-2.5 py-1'
                    : 'rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1'
                }
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['outbound', 'inbound'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={
                  direction === d
                    ? 'flex-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 text-xs font-medium py-1.5'
                    : 'flex-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs font-medium py-1.5'
                }
              >
                {d === 'outbound' ? 'You reached out' : 'They reached out'}
              </button>
            ))}
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Quick note (optional)"
            rows={2}
            className="input-field resize-none text-xs"
          />
          <button onClick={handleLog} disabled={saving} className="btn-primary w-full text-xs py-1.5">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {touchpoints.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No calls or texts logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {touchpoints.map((tp) => {
            const Icon = CHANNEL_ICON[tp.channel];
            return (
              <div
                key={tp.id}
                className="group flex items-start gap-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              >
                <Icon className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{CHANNEL_LABEL[tp.channel]}</span>
                    {tp.direction === 'inbound' ? (
                      <ArrowDownLeft className="h-3 w-3 text-gray-400" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">{format(new Date(tp.occurred_at), 'MMM d, h:mm a')}</span>
                  </div>
                  {tp.summary && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tp.summary}</p>}
                </div>
                <button
                  onClick={() => handleDelete(tp.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
