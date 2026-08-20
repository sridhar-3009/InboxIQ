import type { AppProps } from 'next/app';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CartProvider } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const supabaseClient = supabase;

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        <CartProvider>
        <Component {...pageProps} />
        <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#221c16',
            border: '1px solid #e7e0d4',
            boxShadow: '0 12px 32px -8px rgba(94,42,26,0.16), 0 4px 12px -4px rgba(94,42,26,0.08)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontFamily: "'Work Sans', sans-serif",
          },
          success: {
            iconTheme: { primary: '#5c7a4a', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#b5432f', secondary: '#fff' },
          },
        }}
        />
        </CartProvider>
      </SessionContextProvider>
    </ErrorBoundary>
  );
}
