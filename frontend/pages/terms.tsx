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

export default function TermsOfService() {
  return (
    <>
      <Head><title>Terms of Service — Mailair</title></Head>
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', background: '#fff' }}>
          <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 32 }} /></Link>
        </nav>
      <div style={s.wrap}>
        <Link href="/" style={s.back}>← Back to Mailair</Link>
        <h1 style={s.h1}>Terms of Service</h1>
        <p style={s.meta}>Last updated: March 22, 2026</p>

        <h2 style={s.h2}>1. Acceptance of Terms</h2>
        <p style={s.p}>By accessing or using Mailair ("the Service") at mailair.company, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>

        <h2 style={s.h2}>2. Description of Service</h2>
        <p style={s.p}>Mailair is an AI-powered email management platform that connects to your Gmail account to categorize, prioritize, and draft replies to your emails. The Service is provided by Sai Sridhar Tarra, an individual operator based in India.</p>

        <h2 style={s.h2}>3. Account Registration</h2>
        <ul>
          <li style={s.li}>You must provide accurate and complete information when creating an account.</li>
          <li style={s.li}>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li style={s.li}>You must be at least 18 years old to use this Service.</li>
          <li style={s.li}>You may not share your account with others.</li>
        </ul>

        <h2 style={s.h2}>4. Gmail Access and Permissions</h2>
        <p style={s.p}>To use Mailair, you must grant permission to access your Gmail account via Google OAuth. By granting this permission, you authorize Mailair to:</p>
        <ul>
          <li style={s.li}>Read emails in your inbox for AI processing</li>
          <li style={s.li}>Send replies on your behalf when you explicitly choose to do so</li>
          <li style={s.li}>Store email metadata and content necessary to provide the Service</li>
        </ul>
        <p style={s.p}>You can revoke this access at any time from the Settings page or your Google Account settings.</p>

        <h2 style={s.h2}>5. Subscription and Billing</h2>
        <ul>
          <li style={s.li}><strong>Free plan:</strong> Up to 5 AI-processed emails per month at no cost.</li>
          <li style={s.li}><strong>Pro plan:</strong> ₹199/month for unlimited AI processing across 5 Gmail accounts.</li>
          <li style={s.li}><strong>Agency plan:</strong> ₹1,499/month for unlimited Gmail accounts and team features.</li>
          <li style={s.li}>Subscriptions are billed monthly via Razorpay. You can cancel at any time.</li>
          <li style={s.li}>Upon cancellation, access continues until the end of the billing period. No refunds are issued for partial periods.</li>
        </ul>

        <h2 style={s.h2}>6. Acceptable Use</h2>
        <p style={s.p}>You agree not to:</p>
        <ul>
          <li style={s.li}>Use the Service to send spam, phishing emails, or any unsolicited bulk messages.</li>
          <li style={s.li}>Attempt to reverse-engineer, hack, or disrupt the Service.</li>
          <li style={s.li}>Use the Service for any illegal purpose.</li>
          <li style={s.li}>Share access to your account with unauthorized parties.</li>
        </ul>

        <h2 style={s.h2}>7. Intellectual Property</h2>
        <p style={s.p}>All software, design, and content within Mailair is the property of the operator. You retain all rights to your email data. We claim no ownership over your emails or any content processed through the Service.</p>

        <h2 style={s.h2}>8. Disclaimer of Warranties</h2>
        <p style={s.p}>The Service is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the Service will be error-free or uninterrupted. AI-generated content (categorization, summaries, reply drafts) may not always be accurate — always review before sending.</p>

        <h2 style={s.h2}>9. Limitation of Liability</h2>
        <p style={s.p}>To the maximum extent permitted by law, Mailair shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including any loss of data or email communications.</p>

        <h2 style={s.h2}>10. Termination</h2>
        <p style={s.p}>We reserve the right to terminate or suspend your account at any time if you violate these Terms. You may cancel your account at any time from the Settings page.</p>

        <h2 style={s.h2}>11. Changes to Terms</h2>
        <p style={s.p}>We may update these Terms from time to time. We will notify you of significant changes via email or an in-app notice. Continued use of the Service after changes constitutes acceptance.</p>

        <h2 style={s.h2}>12. Contact</h2>
        <p style={s.p}>For questions about these Terms, contact us at: <a href="mailto:saisridhart@gmail.com" style={{ color: '#b04723' }}>saisridhart@gmail.com</a></p>

        <p style={{ ...s.meta, marginTop: 48, borderTop: '1px solid #e7e0d4', paddingTop: 24, textAlign: 'center' }}>© 2026 Mailair. All rights reserved.</p>
      </div>
      </div>
    </>
  );
}
