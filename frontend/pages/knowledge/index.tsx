import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { BookOpen, Search, Zap, Trash2, Loader2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { knowledgeApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { KnowledgeEntry } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  decision:     'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  agreement:    'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  price:        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  commitment:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  deadline:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  contact_info: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  process:      'bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-400',
};

const ENTRY_TYPES = ['decision', 'agreement', 'price', 'commitment', 'deadline', 'contact_info', 'process'];

export default function KnowledgePage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/auth/signin');
  }, [session, sessionLoading, router]);

  const load = async (q?: string, type?: string) => {
    setLoading(true);
    try {
      const data = await knowledgeApi.getAll(q || undefined, type || undefined);
      setEntries(data.entries || []);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, 'Failed to load knowledge base'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(query, typeFilter);
  };

  const handleBulkExtract = async () => {
    setExtracting(true);
    try {
      const result = await knowledgeApi.bulkExtract();
      toast.success(`Extracted ${result.extracted} knowledge entries`);
      await load(query, typeFilter);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Extraction failed'));
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await knowledgeApi.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Delete failed'));
    } finally {
      setDeletingId(null);
    }
  };

  if (sessionLoading || !session) return <LoadingSpinner fullPage />;
  if (loadError && entries.length === 0 && !query && !typeFilter) return (
    <Layout title="Knowledge Base">
      <PageError message="Couldn't load knowledge base" onRetry={() => { setLoadError(false); load(); }} />
    </Layout>
  );

  return (
    <>
      <Head><title>Knowledge Base — Mailair</title></Head>
      <Layout title="Knowledge Base">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Search + actions */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search decisions, agreements, prices…"
                className="input pl-9 w-full"
              />
            </div>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); load(query, e.target.value); }} className="input w-auto">
              <option value="">All types</option>
              {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="submit" className="btn-secondary text-sm">Search</button>
            <button type="button" onClick={handleBulkExtract} disabled={extracting} className="btn-primary text-sm">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {extracting ? 'Extracting…' : 'Extract from Emails'}
            </button>
          </form>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setTypeFilter(''); load(query, ''); }} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!typeFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              All
            </button>
            {ENTRY_TYPES.map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); load(query, t); }} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === t ? 'bg-primary-600 text-white' : TYPE_COLORS[t]}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Entries */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">Knowledge base is empty.</p>
              <p className="text-sm text-gray-400">Click "Extract from Emails" to automatically extract decisions, agreements, and more.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entries.map(entry => (
                <div key={entry.id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[entry.entry_type] || 'bg-gray-100 text-gray-600'}`}>
                        {entry.entry_type}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id} className="text-gray-300 hover:text-red-500 p-0.5 flex-shrink-0">
                      {deletingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{entry.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{entry.content}</p>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {entry.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-0.5 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-0.5">
                          <Tag className="h-2.5 w-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-3 truncate">From: {entry.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
