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
};

export default function GDPRPage() {
  return (
    <>
      <Head><title>GDPR & Data Rights — Mailair</title></Head>
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', background: '#fff' }}>
          <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 32 }} /></Link>
        </nav>
      <div style={s.wrap}>
        <Link href="/" style={s.back}>← Back to Mailair</Link>
        <h1 style={s.h1}>GDPR & Data Rights</h1>
        <p style={s.meta}>Last updated: March 22, 2026</p>

        <h2 style={s.h2}>1. Overview</h2>
        <p style={s.p}>Mailair is committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR) and applicable data protection laws. This page explains your rights and how we handle your data.</p>

        <h2 style={s.h2}>2. Data Controller</h2>
        <p style={s.p}>The data controller for Mailair is:</p>
        <p style={{ ...s.p, fontWeight: 600 }}>Sai Sridhar Tarra</p>
        <p style={s.p}>Email: <a href="mailto:saisridhart@gmail.com" style={{ color: '#b04723' }}>saisridhart@gmail.com</a></p>

        <h2 style={s.h2}>3. Data We Process</h2>
        <ul>
          <li style={s.li}><strong>Account data:</strong> Email address, name (from Google OAuth)</li>
          <li style={s.li}><strong>Email content:</strong> Gmail messages accessed with your explicit permission via Google OAuth</li>
          <li style={s.li}><strong>Usage data:</strong> Feature interactions, subscription plan, email processing counts</li>
          <li style={s.li}><strong>Payment data:</strong> Handled by Razorpay — Mailair does not store card details</li>
        </ul>

        <h2 style={s.h2}>4. Legal Basis for Processing</h2>
        <ul>
          <li style={s.li}><strong>Contract performance:</strong> Processing your emails is necessary to deliver the service you signed up for.</li>
          <li style={s.li}><strong>Consent:</strong> Gmail access is granted by you via Google OAuth and can be revoked at any time.</li>
          <li style={s.li}><strong>Legitimate interests:</strong> Improving service reliability and security.</li>
        </ul>

        <h2 style={s.h2}>5. Your Rights Under GDPR</h2>
        <p style={s.p}>If you are in the European Economic Area (EEA), you have the following rights:</p>
        <ul>
          <li style={s.li}><strong>Right to access:</strong> Request a copy of all personal data we hold about you.</li>
          <li style={s.li}><strong>Right to rectification:</strong> Request correction of inaccurate personal data.</li>
          <li style={s.li}><strong>Right to erasure:</strong> Request deletion of your account and associated data ("right to be forgotten").</li>
          <li style={s.li}><strong>Right to restriction:</strong> Request we limit how we use your data.</li>
          <li style={s.li}><strong>Right to data portability:</strong> Request an export of your data in a machine-readable format.</li>
          <li style={s.li}><strong>Right to object:</strong> Object to processing based on legitimate interests.</li>
          <li style={s.li}><strong>Right to withdraw consent:</strong> Revoke Gmail access at any time from Settings or your Google Account.</li>
        </ul>
        <p style={s.p}>To exercise any of these rights, email us at <a href="mailto:saisridhart@gmail.com" style={{ color: '#b04723' }}>saisridhart@gmail.com</a>. We will respond within 30 days.</p>

        <h2 style={s.h2}>6. Data Retention</h2>
        <ul>
          <li style={s.li}>Email data is retained for as long as your account is active.</li>
          <li style={s.li}>When you delete your account, all associated data is deleted within 30 days.</li>
          <li style={s.li}>Payment records may be retained for up to 7 years for legal/tax purposes.</li>
        </ul>

        <h2 style={s.h2}>7. International Transfers</h2>
        <p style={s.p}>Your data is processed on servers hosted by Supabase (US) and Render (US). These providers are GDPR-compliant and use standard contractual clauses for international data transfers.</p>

        <h2 style={s.h2}>8. Sub-processors</h2>
        <ul>
          <li style={s.li}><strong>Supabase</strong> — Database and authentication</li>
          <li style={s.li}><strong>Render</strong> — Backend hosting</li>
          <li style={s.li}><strong>Vercel</strong> — Frontend hosting</li>
          <li style={s.li}><strong>Anthropic</strong> — AI email processing (Claude API)</li>
          <li style={s.li}><strong>Razorpay</strong> — Payment processing</li>
          <li style={s.li}><strong>Google</strong> — Gmail OAuth and API access</li>
        </ul>

        <h2 style={s.h2}>9. Complaints</h2>
        <p style={s.p}>If you believe we have not handled your data correctly, you have the right to lodge a complaint with your local data protection authority.</p>

        <p style={{ ...s.meta, marginTop: 48, borderTop: '1px solid #e7e0d4', paddingTop: 24, textAlign: 'center' }}>© 2026 Mailair. All rights reserved.</p>
      </div>
      </div>
    </>
  );
}
