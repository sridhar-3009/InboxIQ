import Head from 'next/head';
import Link from 'next/link';

const releases = [
  {
    version: 'v1.4.0',
    date: 'March 22, 2026',
    tag: 'Latest',
    tagColor: '#dcfce7',
    tagText: '#16a34a',
    changes: [
      { type: 'New', text: 'Platform admin dashboard at /admin — view MRR, users, usage, and webhook logs' },
      { type: 'New', text: 'Manual AI processing per email — click "Process with AI" to control your usage' },
      { type: 'New', text: 'Email body renders as HTML inside a sandboxed iframe (like Gmail)' },
      { type: 'New', text: 'Cancel subscription button — cancels at end of billing period via Razorpay API' },
      { type: 'Improved', text: 'Plan limit banner in inbox when free users reach 5/5 AI-processed emails' },
      { type: 'Fixed', text: 'Auth form now correctly renders in light mode (white background)' },
      { type: 'Fixed', text: 'All website pricing updated to INR: Pro ₹199/mo, Agency ₹1,499/mo' },
    ],
  },
  {
    version: 'v1.3.0',
    date: 'March 15, 2026',
    tag: 'Billing',
    tagColor: '#e6e9d6',
    tagText: '#5c6a3d',
    changes: [
      { type: 'New', text: 'Razorpay integration — accept payments from India with subscription billing' },
      { type: 'New', text: 'Billing page shows exact error messages when payment setup is misconfigured' },
      { type: 'New', text: 'Webhook handlers for subscription.activated, subscription.charged, subscription.halted, invoice.paid, invoice.expired' },
      { type: 'Improved', text: 'Email usage count now only counts AI-processed emails (not all emails)' },
      { type: 'Fixed', text: 'CORS errors blocking API calls from mailair.company' },
    ],
  },
  {
    version: 'v1.2.0',
    date: 'March 5, 2026',
    tag: 'Security',
    tagColor: '#fef3c7',
    tagText: '#d97706',
    changes: [
      { type: 'New', text: 'HMAC-SHA256 signed OAuth state parameter for CSRF protection on Gmail flow' },
      { type: 'New', text: 'Fernet encryption for stored CRM credentials (HubSpot, Salesforce)' },
      { type: 'Improved', text: 'Team features: org membership verified before accessing internal notes' },
      { type: 'Improved', text: 'Auto-assign rules now verify assigned user is org member' },
      { type: 'Fixed', text: 'Webhook URL validated as proper HTTP/HTTPS URL via Pydantic HttpUrl' },
    ],
  },
  {
    version: 'v1.1.0',
    date: 'February 20, 2026',
    tag: 'Auth',
    tagColor: '#fbe3d6',
    tagText: '#8e381d',
    changes: [
      { type: 'New', text: 'Supabase implicit OAuth flow with localStorage session storage' },
      { type: 'New', text: 'Session-gated SWR hooks — no unauthenticated API fetches' },
      { type: 'Fixed', text: 'Removed auto sign-out on 401 — prevented infinite redirect loop on load' },
      { type: 'Fixed', text: 'Auth callback now uses useRef to prevent double navigation' },
      { type: 'Fixed', text: 'Middleware stripped of auth logic — incompatible with localStorage sessions' },
    ],
  },
  {
    version: 'v1.0.0',
    date: 'February 1, 2026',
    tag: 'Launch',
    tagColor: '#f6e2da',
    tagText: '#9a4a2e',
    changes: [
      { type: 'New', text: 'AI email categorization (Urgent, Needs Response, Follow Up, FYI, Newsletter, Spam)' },
      { type: 'New', text: 'Priority inbox with AI-scored priority levels' },
      { type: 'New', text: 'Action item extraction from email content' },
      { type: 'New', text: 'Smart reply drafts using Claude AI' },
      { type: 'New', text: 'Gmail OAuth integration with multi-account support' },
      { type: 'New', text: 'Slack notifications for urgent emails' },
      { type: 'New', text: 'Team collaboration: internal notes, email assignment, org management' },
      { type: 'New', text: 'CRM integrations: HubSpot and Salesforce' },
      { type: 'New', text: 'Google Calendar integration for meeting detection' },
    ],
  },
];

const typeColors: Record<string, { bg: string; text: string }> = {
  New:      { bg: '#dcfce7', text: '#15803d' },
  Improved: { bg: '#fbe3d6', text: '#8e381d' },
  Fixed:    { bg: '#fef9c3', text: '#a16207' },
};

export default function ChangelogPage() {
  return (
    <>
      <Head>
        <title>Changelog — Mailair</title>
        <meta name="description" content="See what's new in Mailair — new features, improvements, and bug fixes." />
      </Head>

      <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '10px 16px', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexWrap: 'wrap', rowGap: 8 }}>
        <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 36 }} /></Link>
        <div className="gap-3 sm:gap-6" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/docs" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Docs</Link>
          <Link href="/auth/signin" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Sign In</Link>
          <Link href="/auth/signup" style={{ background: '#b04723', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Start Free</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: '#221c16', margin: '0 0 8px' }}>Changelog</h1>
        <p style={{ color: '#83745e', fontSize: 16, marginBottom: 56 }}>Every update to Mailair, documented.</p>

        <div style={{ position: 'relative' }}>
          {releases.map((release, idx) => (
            <div key={release.version} style={{ display: 'flex', gap: 32, marginBottom: 56 }}>
              {/* Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: idx === 0 ? '#b04723' : '#d3c7b4', border: '2px solid', borderColor: idx === 0 ? '#b04723' : '#d3c7b4', marginTop: 6 }} />
                {idx < releases.length - 1 && <div style={{ width: 2, flexGrow: 1, background: '#e7e0d4', marginTop: 8 }} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#221c16' }}>{release.version}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: release.tagColor, color: release.tagText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {release.tag}
                  </span>
                  <span style={{ fontSize: 13, color: '#a99b83' }}>{release.date}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
                  {release.changes.map((change, i) => {
                    const tc = typeColors[change.type] ?? typeColors.New;
                    return (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: tc.bg, color: tc.text, flexShrink: 0, marginTop: 2 }}>
                          {change.type}
                        </span>
                        <span style={{ fontSize: 14, color: '#4a4033', lineHeight: 1.6 }}>{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
