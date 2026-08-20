import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { TrendingUp, ChevronDown, ChevronUp, Loader2, Check, X, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { quotesApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { Quote } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  sent:     'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  accepted: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

function QuoteCard({ quote, onStatusChange }: { quote: Quote; onStatusChange: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-start justify-between p-5 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{quote.project_title}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[quote.status]}`}>{quote.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{quote.client_name} · {quote.client_email}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">₹{quote.total.toLocaleString()}</span>
            <span>Valid {quote.validity_days} days</span>
            <span>{formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{quote.scope_summary}</p>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Description</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Qty</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Unit</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Price</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.line_items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{item.description}</td>
                    <td className="py-2 text-right text-gray-500">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-500">{item.unit}</td>
                    <td className="py-2 text-right text-gray-500">₹{item.unit_price.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">₹{(item.quantity * item.unit_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="pt-2 text-right text-xs text-gray-500">Subtotal</td><td className="pt-2 text-right text-sm text-gray-700 dark:text-gray-300">₹{quote.subtotal.toLocaleString()}</td></tr>
                <tr><td colSpan={4} className="text-right text-xs text-gray-500">GST (18%)</td><td className="text-right text-sm text-gray-500">₹{quote.tax.toLocaleString()}</td></tr>
                <tr><td colSpan={4} className="text-right font-bold text-gray-900 dark:text-gray-100">Total</td><td className="text-right font-bold text-emerald-600 dark:text-emerald-400">₹{quote.total.toLocaleString()}</td></tr>
              </tfoot>
            </table>
          </div>

          {quote.notes && <p className="text-xs text-gray-500 italic">{quote.notes}</p>}
          {quote.payment_terms && <p className="text-xs text-gray-500">Payment: {quote.payment_terms}</p>}

          <div className="flex gap-2 pt-2">
            {quote.status === 'draft' && (
              <button onClick={() => onStatusChange(quote.id, 'sent')} className="inline-flex items-center gap-1.5 btn-primary text-xs">
                <Send className="h-3.5 w-3.5" /> Mark as Sent
              </button>
            )}
            {quote.status === 'sent' && (
              <>
                <button onClick={() => onStatusChange(quote.id, 'accepted')} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">
                  <Check className="h-3.5 w-3.5" /> Won
                </button>
                <button onClick={() => onStatusChange(quote.id, 'rejected')} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100">
                  <X className="h-3.5 w-3.5" /> Lost
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async () => {
    try {
      const data = await quotesApi.getAll();
      setQuotes(data.quotes || []);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, 'Failed to load quotes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await quotesApi.updateStatus(id, status);
      await load();
      toast.success(`Quote marked as ${status}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Update failed'));
    }
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;
  if (loadError && quotes.length === 0) return (
    <Layout title="Quotes">
      <PageError message="Couldn't load quotes" onRetry={() => { setLoadError(false); load(); }} />
    </Layout>
  );

  const filtered = statusFilter ? quotes.filter(q => q.status === statusFilter) : quotes;
  const totalPipeline = quotes.filter(q => q.status !== 'rejected').reduce((s, q) => s + q.total, 0);
  const wonTotal = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0);

  return (
    <>
      <Head><title>Quotes — Mailair</title></Head>
      <Layout title="Quotes & Proposals">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Quotes', value: quotes.length, color: 'text-gray-900 dark:text-gray-100' },
              { label: 'Pipeline Value', value: `₹${totalPipeline.toLocaleString()}`, color: 'text-primary-600' },
              { label: 'Won', value: `₹${wonTotal.toLocaleString()}`, color: 'text-emerald-600' },
              { label: 'Awaiting Reply', value: quotes.filter(q => q.status === 'sent').length, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quotes are auto-generated from emails. Go to an email and click the quote icon to generate one.
          </p>

          {/* Filter */}
          <div className="flex gap-2">
            {['', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card p-5 animate-pulse h-24" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No quotes yet. Open an email with a project inquiry and generate a quote from there.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(q => <QuoteCard key={q.id} quote={q} onStatusChange={handleStatusChange} />)}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
