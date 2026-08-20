import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const benefits = [
  'Free for up to 5 AI-processed emails/month',
  'AI email categorization & prioritization',
  'Action item extraction',
  'Smart reply drafts',
];

export default function SignupPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/dashboard');
    }
  }, [session, isLoading, router]);

  return (
    <>
      <Head>
        <title>Sign Up — Mailair</title>
        <meta name="description" content="Create your Mailair account and start managing email with AI." />
      </Head>
      <div className="flex min-h-screen">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 flex-col justify-center px-16">
          <div className="flex items-center mb-12">
            <img src="/logo-dark.svg" alt="Mailair" className="h-9 w-auto" />
          </div>
          <h2 className="font-serif text-4xl text-white leading-tight mb-6">
            Your inbox, finally under control
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed mb-10">
            Join service business owners who sort, extract, and draft with Mailair instead of re-reading the same thread three times.
          </p>
          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-olive-400 flex-shrink-0" />
                <span className="text-primary-100 text-sm">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Panel */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-white">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center mb-8">
              <img src="/logo.svg" alt="Mailair" className="h-8 w-auto" />
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="mt-2 text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/auth/signin" className="font-medium text-primary-600 hover:text-primary-700">
                  Sign in
                </Link>
              </p>
            </div>

            <Auth
              supabaseClient={supabase}
              view="sign_up"
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#b04723',
                      brandAccent: '#8e381d',
                      brandButtonText: '#ffffff',
                      inputBorder: '#e7e0d4',
                      inputBorderFocus: '#b04723',
                      inputBorderHover: '#d3c7b4',
                      inputLabelText: '#4a4033',
                      inputText: '#221c16',
                      inputPlaceholder: '#a99b83',
                      inputBackground: '#ffffff',
                      defaultButtonBackground: '#ffffff',
                      defaultButtonBackgroundHover: '#faf8f5',
                      defaultButtonBorder: '#e7e0d4',
                      defaultButtonText: '#4a4033',
                      anchorTextColor: '#b04723',
                      anchorTextHoverColor: '#8e381d',
                      dividerBackground: '#e7e0d4',
                      messageText: '#4a4033',
                      messageBackground: '#faf8f5',
                      messageBorder: '#e7e0d4',
                    },
                    radii: {
                      borderRadiusButton: '0.75rem',
                      buttonBorderRadius: '0.75rem',
                      inputBorderRadius: '0.625rem',
                    },
                    fontSizes: {
                      baseButtonSize: '0.9375rem',
                      baseInputSize: '0.9375rem',
                      baseLabelSize: '0.875rem',
                    },
                    fonts: {
                      bodyFontFamily: `'Work Sans', ui-sans-serif, system-ui, sans-serif`,
                      buttonFontFamily: `'Work Sans', ui-sans-serif, system-ui, sans-serif`,
                      inputFontFamily: `'Work Sans', ui-sans-serif, system-ui, sans-serif`,
                      labelFontFamily: `'Work Sans', ui-sans-serif, system-ui, sans-serif`,
                    },
                    space: {
                      inputPadding: '0.75rem 1rem',
                      buttonPadding: '0.75rem 1rem',
                    },
                  },
                },
                style: {
                  container: { background: 'transparent' },
                  message: { color: '#4a4033', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '0.5rem' },
                  divider: { background: '#e7e0d4' },
                  label: { color: '#4a4033', fontWeight: '500' },
                  input: {
                    color: '#221c16',
                    background: '#ffffff',
                    border: '1.5px solid #e7e0d4',
                    boxShadow: 'none',
                  },
                  button: { fontWeight: '600' },
                  anchor: { color: '#b04723', fontWeight: '500' },
                },
                className: {
                  button: 'font-semibold shadow-sm',
                  label: 'text-sm font-medium text-gray-700',
                },
              }}
              providers={['google']}
              redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
              localization={{
                variables: {
                  sign_up: {
                    email_label: 'Work Email',
                    password_label: 'Password',
                    button_label: 'Create Account',
                    social_provider_text: 'Continue with {{provider}}',
                    link_text: '',
                  },
                },
              }}
            />

            <p className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="/terms" className="underline hover:text-gray-600">Terms of Service</a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
