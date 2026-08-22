import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { Users, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamsApi } from '@/lib/api';

export default function JoinOrgPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const token = typeof router.query.token === 'string' ? router.query.token : '';

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace(`/auth/signin?redirect=/team/join?token=${token}`);
    }
  }, [session, sessionLoading, router, token]);

  const handleJoin = async () => {
    if (!token) { setError('No invite token provided.'); return; }
    setJoining(true);
    setError('');
    try {
      await teamsApi.joinOrg(token);
      setJoined(true);
      toast.success('You have joined the organization!');
      try { localStorage.setItem('mailair_new_member_joined_at', Date.now().toString()); } catch { /* ignore */ }
      setTimeout(() => router.push('/workspace'), 2000);
    } catch {
      setError('This invite token is invalid or has expired.');
      toast.error('Invalid or expired invite token');
    } finally {
      setJoining(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <>
      <Head><title>Join Organization — Mailair</title></Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center space-y-5">
            {joined ? (
              <>
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">You&apos;re in!</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You have successfully joined the organization. Redirecting…
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/20">
                    <Users className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Join Organization</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You&apos;ve been invited to join an Mailair team workspace.
                </p>

                {token ? (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{token}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400">No invite token found in this URL.</p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <button
                  onClick={handleJoin}
                  disabled={joining || !token}
                  className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  {joining ? 'Joining…' : 'Accept Invitation'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
