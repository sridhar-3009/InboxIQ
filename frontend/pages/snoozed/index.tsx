import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import useSWR from 'swr';
import { AlarmClock } from 'lucide-react';
import Layout from '@/components/Layout';
import EmailCard from '@/components/EmailCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { InboxSkeleton } from '@/components/SkeletonLoader';
import { ErrorCard } from '@/components/ErrorBoundary';
import { emailsApi } from '@/lib/api';
import type { Email } from '@/lib/types';

export default function SnoozedPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();

  const { data: emails, isLoading, error, mutate } = useSWR<Email[]>(
    session ? 'snoozed-emails' : null,
    () => emailsApi.getSnoozed(),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace('/auth/signin');
    }
  }, [session, sessionLoading, router]);

  if (sessionLoading) return <LoadingSpinner fullPage />;
  if (!session) return null;

  const list = emails ?? [];

  return (
    <>
      <Head>
        <title>Snoozed — Mailair</title>
      </Head>
      <Layout title="Snoozed">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Snoozed Emails</h1>
            <span className="rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
              {list.length}
            </span>
          </div>

          {isLoading ? (
            <InboxSkeleton />
          ) : error ? (
            <ErrorCard message="Failed to load snoozed emails." onRetry={() => mutate()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={AlarmClock}
              title="No snoozed emails"
              description="Emails you snooze will appear here until their reminder time."
              className="card py-16"
            />
          ) : (
            <div className="space-y-2">
              {list.map((email: Email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onDismiss={() => mutate()}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
