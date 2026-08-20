import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Timer, ArrowRight } from 'lucide-react';
import { benchmarksApi } from '@/lib/api';
import type { Benchmark } from '@/lib/types';

export default function BenchmarksPage() {
  const [industries, setIndustries] = useState<{ industry: string; count: number }[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    benchmarksApi.industries().then((r) => setIndustries(r.industries)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    benchmarksApi.get(selected).then(setBenchmark).catch(() => setBenchmark(null)).finally(() => setLoading(false));
  }, [selected]);

  return (
    <>
      <Head>
        <title>Response Time Benchmarks — Mailair</title>
        <meta name="description" content="See real, anonymized average email response times across service businesses using Mailair." />
      </Head>

      <nav className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/"><img src="/logo.svg" alt="Mailair" className="h-8 w-auto" /></Link>
            <Link href="/auth/signup" className="rounded-md bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors">Start free</Link>
          </div>
        </div>
      </nav>

      <main className="px-5 sm:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 mb-3">Real data, no averages made up</p>
          <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-tight">
            How fast do service businesses actually reply?
          </h1>
          <p className="mt-5 text-lg text-gray-600 leading-relaxed">
            Computed from real, anonymized reply timestamps of Mailair users who&apos;ve opted in. No self-reported numbers.
          </p>
        </div>

        <div className="mx-auto max-w-2xl mt-12">
          {industries.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              <button
                onClick={() => setSelected(undefined)}
                className={!selected ? 'rounded-full bg-primary-600 text-white text-sm font-medium px-4 py-1.5' : 'rounded-full bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 hover:border-gray-300'}
              >
                All industries
              </button>
              {industries.map((i) => (
                <button
                  key={i.industry}
                  onClick={() => setSelected(i.industry)}
                  className={selected === i.industry ? 'rounded-full bg-primary-600 text-white text-sm font-medium px-4 py-1.5' : 'rounded-full bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 hover:border-gray-300'}
                >
                  {i.industry}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white shadow-warm-lg p-10 text-center">
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
              </div>
            ) : benchmark?.median_response_time ? (
              <>
                <Timer className="h-8 w-8 text-primary-600 mx-auto mb-4" />
                <div className="font-serif text-6xl text-gray-900">{benchmark.median_response_time}</div>
                <p className="mt-3 text-sm text-gray-500">
                  median response time{selected ? ` — ${selected}` : ' across all users'}, from {benchmark.cohort_size} opted-in businesses
                </p>
                {benchmark.fastest_quartile_hours && (
                  <p className="mt-1 text-xs text-gray-400">
                    Top 25% respond within {benchmark.fastest_quartile_hours}h
                  </p>
                )}
              </>
            ) : (
              <>
                <Timer className="h-8 w-8 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {benchmark?.message || 'Not enough opted-in data yet for this cohort.'}
                </p>
              </>
            )}
          </div>

          <div className="mt-10 text-center">
            <Link href="/auth/signup" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800">
              See how your own response time compares
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
