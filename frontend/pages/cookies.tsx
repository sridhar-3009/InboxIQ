import Head from 'next/head';
import Link from 'next/link';

const s = {
  wrap: { maxWidth: 760, margin: '60px auto', padding: '0 24px', fontFamily: "'Work Sans', ui-sans-serif, system-ui, sans-serif", lineHeight: 1.8, color: '#221c16' } as React.CSSProperties,
  back: { color: '#b04723', textDecoration: 'none', fontSize: 14 } as React.CSSProperties,
  h1: { marginTop: 32, fontSize: 32, fontWeight: 700 } as React.CSSProperties,
  h2: { marginTop: 32, fontSize: 20, fontWeight: 700, borderBottom: '1px solid #e7e0d4', paddingBottom: 8 } as React.CSSProperties,
  meta: { color: '#83745e', fontSize: 14 } as React.CSSProperties,
  p: { color: '#4a4033', marginTop: 12 } as React.CSSProperties,
  li: { color: '#4a4033', marginBottom: 6 } as React.CSSProperties,
  table: { width: '100%', minWidth: 560, borderCollapse: 'collapse' as const, marginTop: 16, fontSize: 14 },
  th: { textAlign: 'left' as const, padding: '10px 12px', background: '#faf8f5', border: '1px solid #e7e0d4', fontWeight: 600, color: '#4a4033' },
  td: { padding: '10px 12px', border: '1px solid #e7e0d4', color: '#4a4033' },
};

export default function CookiePolicy() {
  return (
    <>
      <Head><title>Cookie Policy — Mailair</title></Head>
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', background: '#fff' }}>
          <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 32 }} /></Link>
        </nav>
      <div style={s.wrap}>
        <Link href="/" style={s.back}>← Back to Mailair</Link>
        <h1 style={s.h1}>Cookie Policy</h1>
        <p style={s.meta}>Last updated: March 22, 2026</p>

        <h2 style={s.h2}>1. What Are Cookies?</h2>
        <p style={s.p}>Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience. Mailair uses a minimal set of cookies strictly necessary to operate the service.</p>

        <h2 style={s.h2}>2. Cookies We Use</h2>
        <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Cookie</th>
              <th style={s.th}>Purpose</th>
              <th style={s.th}>Duration</th>
              <th style={s.th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['mailair-auth', 'Stores your authentication session so you stay signed in', 'Session / 7 days', 'Essential'],
              ['sb-*', 'Supabase authentication tokens for secure API access', 'Session', 'Essential'],
              ['__vercel_*', 'Vercel deployment and routing (Next.js hosting)', 'Session', 'Technical'],
              ['theme', 'Remembers your dark/light mode preference', '1 year', 'Preference'],
            ].map(([name, purpose, duration, type]) => (
              <tr key={name}>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 13 }}>{name}</td>
                <td style={s.td}>{purpose}</td>
                <td style={s.td}>{duration}</td>
                <td style={s.td}>{type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <h2 style={s.h2}>3. What We Do NOT Use</h2>
        <ul>
          <li style={s.li}>We do <strong>not</strong> use advertising or tracking cookies.</li>
          <li style={s.li}>We do <strong>not</strong> use third-party analytics cookies (e.g. Google Analytics).</li>
          <li style={s.li}>We do <strong>not</strong> sell or share cookie data with third parties.</li>
        </ul>

        <h2 style={s.h2}>4. Managing Cookies</h2>
        <p style={s.p}>Since all cookies used by Mailair are essential for the service to function, disabling them may prevent you from signing in or using core features.</p>
        <p style={s.p}>You can manage or delete cookies through your browser settings:</p>
        <ul>
          <li style={s.li}><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
          <li style={s.li}><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={s.li}><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        </ul>

        <h2 style={s.h2}>5. Contact</h2>
        <p style={s.p}>Questions about our cookie use? Email us at <a href="mailto:saisridhart@gmail.com" style={{ color: '#b04723' }}>saisridhart@gmail.com</a></p>

        <p style={{ ...s.meta, marginTop: 48, borderTop: '1px solid #e7e0d4', paddingTop: 24, textAlign: 'center' }}>© 2026 Mailair. All rights reserved.</p>
      </div>
      </div>
    </>
  );
}
