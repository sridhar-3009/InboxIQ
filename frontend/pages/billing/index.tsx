import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  CreditCard,
  CheckCircle,
  Zap,
  ArrowRight,
  Loader2,
  AlertTriangle,
  BarChart2,
  ExternalLink,
  Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageError from '@/components/PageError';
import { useBillingStatus } from '@/lib/hooks';
import { billingApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';
import type { PlanId, Plan } from '@/lib/types';
import clsx from 'clsx';

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price_monthly: 0,
    email_limit: 5,
    gmail_accounts: 1,
    features: [
      '5 AI-processed emails/month',
      '1 Gmail account',
      'Basic AI categorization',
      'Action item extraction',
      'Priority inbox',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 199,
    email_limit: null,
    gmail_accounts: 5,
    features: [
      'Unlimited emails',
      '5 Gmail accounts',
      'Advanced AI models',
      'Smart reply drafts',
      'Slack notifications',
      'Priority support',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    price_monthly: 1499,
    email_limit: null,
    gmail_accounts: 999,
    features: [
      'Everything in Pro',
      'Unlimited Gmail accounts',
      'Team member access',
      'Custom AI training',
      'API access',
      'Dedicated support',
    ],
  },
];

const statusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-green-50 text-green-700 border border-green-200' },
  trialing: { label: 'Trial', classes: 'bg-primary-50 text-primary-700 border border-primary-200' },
  past_due: { label: 'Past Due', classes: 'bg-red-50 text-red-700 border border-red-200' },
  canceled: { label: 'Canceled', classes: 'bg-gray-100 text-gray-600 border border-gray-200' },
  none: { label: 'Free', classes: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

export default function BillingPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<Record<string, string | boolean> | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: billing, isLoading: billingLoading, error: billingError } = useBillingStatus();

  // Check Razorpay env var configuration on mount
  useEffect(() => {
    if (!session) return;
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/billing/payment-check')
        .then(r => setPaymentConfig(r.data))
        .catch(() => {});
    });
  }, [session]);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace('/auth/signin');
    }
  }, [session, sessionLoading, router]);

  // Handle Razorpay return
  const { mutate: refreshBilling } = useBillingStatus();
  useEffect(() => {
    const { success } = router.query;
    if (success === 'true') {
      toast.success('Payment successful! Activating your plan...');
      router.replace('/billing', undefined, { shallow: true });
      // Poll every 3s for up to 30s until plan updates via webhook
      let attempts = 0;
      const interval = setInterval(() => {
        refreshBilling();
        attempts++;
        if (attempts >= 10) clearInterval(interval);
      }, 3000);
    }
  }, [router.query.success]);

  if (sessionLoading || billingLoading) return <LoadingSpinner fullPage />;
  if (!session) return null;
  if (billingError) return (
    <Layout title="Billing">
      <PageError message="Couldn't load billing status" onRetry={() => window.location.reload()} />
    </Layout>
  );

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === 'free') return;
    setLoadingPlan(planId);
    try {
      const { checkout_url } = await billingApi.createCheckoutSession(planId, 'monthly');
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = apiErrorMessage(err, 'Failed to start checkout. Please try again.');
      setCheckoutError(msg);
      toast.error(msg, { duration: 8000 });
      console.error('[checkout]', err);
      setLoadingPlan(null);
    }
  };

  const currentPlan = billing?.current_plan ?? 'free';
  const statusInfo = statusConfig[billing?.subscription_status ?? 'none'] ?? statusConfig['none'];
  const emailsUsed = Number(billing?.emails_used_this_month ?? 0);
  const emailLimit = billing?.email_limit ?? null;
  const usagePercent = emailLimit
    ? Math.min((emailsUsed / emailLimit) * 100, 100)
    : 0;

  return (
    <>
      <Head>
        <title>Billing — Mailair</title>
      </Head>
      <Layout title="Billing & Plans">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Razorpay misconfiguration warning */}
          {paymentConfig && (!paymentConfig.RAZORPAY_KEY_ID || paymentConfig.RAZORPAY_PRO_PLAN_ID === 'NOT SET') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Razorpay not fully configured</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Set these environment variables in your <strong>Render dashboard</strong> to enable payments:
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs font-mono text-amber-800 dark:text-amber-300">
                    {!paymentConfig.RAZORPAY_KEY_ID && <li>• RAZORPAY_KEY_ID — missing</li>}
                    {!paymentConfig.RAZORPAY_KEY_SECRET && <li>• RAZORPAY_KEY_SECRET — missing</li>}
                    {paymentConfig.RAZORPAY_PRO_PLAN_ID === 'NOT SET' && <li>• RAZORPAY_PRO_PLAN_ID — missing</li>}
                    {paymentConfig.RAZORPAY_AGENCY_PLAN_ID === 'NOT SET' && <li>• RAZORPAY_AGENCY_PLAN_ID — missing</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Checkout error — persists until dismissed */}
          {checkoutError && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Checkout failed</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">{checkoutError}</p>
                  </div>
                </div>
                <button onClick={() => setCheckoutError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            </div>
          )}

          {/* Current plan card */}
          {billing && (
            <div className="card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {billing.plan_details?.name ?? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                    </h2>
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusInfo.classes)}>
                      {statusInfo.label}
                    </span>
                  </div>
                  {billing.current_period_end && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {billing.cancel_at_period_end ? 'Cancels on' : 'Renews on'}{' '}
                      <strong className="text-gray-700 dark:text-gray-300">
                        {new Date(
                          typeof billing.current_period_end === 'number'
                            ? billing.current_period_end * 1000
                            : billing.current_period_end
                        ).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                    </p>
                  )}
                </div>
                {billing.subscription_id && billing.subscription_status === 'active' && (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) return;
                      try {
                        await billingApi.cancelSubscription();
                        toast.success('Subscription cancelled. Access continues until end of billing period.');
                      } catch {
                        toast.error('Failed to cancel subscription. Please try again.');
                      }
                    }}
                    className="btn-secondary text-sm gap-2 flex-shrink-0 inline-flex items-center text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>

              {/* Usage */}
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Usage This Month</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                    <strong className="text-gray-900 dark:text-gray-100">{emailsUsed.toLocaleString()}</strong>
                    {emailLimit ? (
                      <> / {emailLimit.toLocaleString()}</>
                    ) : (
                      ' / Unlimited'
                    )}
                  </span>
                </div>
                {emailLimit ? (
                  <>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          usagePercent >= 90
                            ? 'bg-red-500'
                            : usagePercent >= 70
                            ? 'bg-amber-500'
                            : 'bg-primary-500'
                        )}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>{Math.round(usagePercent)}% used</span>
                      <span>{(emailLimit - emailsUsed).toLocaleString()} remaining</span>
                    </div>
                    {usagePercent >= 80 && (
                      <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          You're approaching your email limit. Consider upgrading to Pro for unlimited emails.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-1 h-2.5 bg-primary-100 rounded-full">
                    <div className="h-full w-full bg-primary-500 rounded-full opacity-20" />
                  </div>
                )}
              </div>
            </div>
          )}

          {billingError && (
            <div className="card p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-400 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Unable to load billing information. Please refresh.</p>
            </div>
          )}

          {/* Plans grid */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isHigher =
                  (plan.id === 'pro' && currentPlan === 'free') ||
                  (plan.id === 'agency' && currentPlan !== 'agency');
                const isPopular = plan.id === 'pro';

                return (
                  <div
                    key={plan.id}
                    className={clsx(
                      'relative rounded-xl border p-5 flex flex-col',
                      isCurrent
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm',
                      isPopular && !isCurrent && 'ring-1 ring-primary-200'
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-amber-900">
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 right-4">
                        <span className="rounded-full bg-primary-600 px-3 py-0.5 text-xs font-bold text-white">
                          Current Plan
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg',
                        plan.id === 'agency' ? 'bg-purple-100 dark:bg-purple-900/30' : plan.id === 'pro' ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-700'
                      )}>
                        {plan.id === 'agency' ? (
                          <Crown className="h-4 w-4 text-purple-600" />
                        ) : plan.id === 'pro' ? (
                          <Zap className="h-4 w-4 text-primary-600" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                            {plan.price_monthly === 0 ? 'Free' : `₹${plan.price_monthly.toLocaleString()}`}
                          </span>
                          {plan.price_monthly > 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">/mo</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 flex-1 mb-5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="w-full rounded-lg bg-primary-100 py-2 text-center text-sm font-semibold text-primary-700">
                        Your Current Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={loadingPlan !== null}
                        className={clsx(
                          'w-full rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                          isHigher
                            ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        )}
                      >
                        {loadingPlan === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                        {loadingPlan === plan.id
                          ? 'Loading...'
                          : plan.id === 'free'
                          ? 'Downgrade to Free'
                          : isHigher
                          ? `Upgrade to ${plan.name}`
                          : `Switch to ${plan.name}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAQ / notes */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Billing FAQ</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Can I cancel any time?</p>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">Yes. You can cancel your subscription at any time. Your access continues until the end of your billing period.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">How are emails counted?</p>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">Each email processed by AI counts as one email. Your count resets on the 1st of each month.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">What happens if I exceed my limit?</p>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">On the Free plan, AI processing pauses until the next month or you upgrade. Pro and Agency have no limits.</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
