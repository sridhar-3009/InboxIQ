import Head from 'next/head';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Mailair</title>
      </Head>
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', background: '#fff' }}>
          <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 32 }} /></Link>
        </nav>
      <div style={{ maxWidth: 760, margin: '60px auto', padding: '0 24px', fontFamily: "'Work Sans', ui-sans-serif, system-ui, sans-serif", lineHeight: 1.8, color: '#221c16' }}>
        <Link href="/" style={{ color: '#b04723', textDecoration: 'none', fontSize: 14 }}>← Back to Mailair</Link>

        <h1 style={{ marginTop: 32, fontSize: 32, fontWeight: 700 }}>Privacy Policy</h1>
        <p style={{ color: '#666', fontSize: 14 }}>Last updated: March 15, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Mailair ("we", "our", or "us") operates the Mailair email management application
          available at <strong>mailair.company</strong>. This Privacy Policy explains
          how we collect, use, and protect your information when you use our service.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
          <li><strong>Account information:</strong> Your email address and name when you sign up.</li>
          <li><strong>Gmail data:</strong> With your explicit permission, we access your Gmail messages to provide AI-powered email management features. This includes reading emails and sending replies on your behalf.</li>
          <li><strong>Usage data:</strong> How you interact with the app (e.g. which features you use).</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To provide and operate the Mailair service</li>
          <li>To classify, summarize, and prioritize your emails using AI</li>
          <li>To generate draft replies based on your email content and preferences</li>
          <li>To send email replies on your behalf when you explicitly instruct us to</li>
          <li>To improve the accuracy and performance of our AI models</li>
        </ul>

        <h2>4. Gmail Data Usage</h2>
        <p>
          Mailair uses the Gmail API to access your email data. Specifically:
        </p>
        <ul>
          <li>We request <strong>read access</strong> to your Gmail inbox to fetch and analyze emails.</li>
          <li>We request <strong>send access</strong> to send replies on your behalf when you choose to do so.</li>
          <li>Your Gmail data is never sold to third parties.</li>
          <li>Your Gmail data is not used to train any AI models beyond improving Mailair features.</li>
          <li>We store only the email metadata and content necessary to provide our service.</li>
          <li>You can revoke Gmail access at any time from the Settings page or from your Google Account.</li>
        </ul>
        <p>
          Mailair's use and transfer of information received from Google APIs adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#b04723' }}>
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h2>5. Data Storage and Security</h2>
        <p>
          Your data is stored securely using Supabase (hosted on AWS). We use industry-standard
          encryption in transit (HTTPS/TLS) and at rest. We do not store your Gmail password —
          access is granted via OAuth 2.0 tokens which you can revoke at any time.
        </p>

        <h2>6. Data Sharing</h2>
        <p>We do not sell your personal data. We share data only with:</p>
        <ul>
          <li><strong>Anthropic (Claude AI):</strong> Email content is sent to Anthropic's API to generate summaries and reply drafts. Anthropic's privacy policy applies.</li>
          <li><strong>Google:</strong> OAuth tokens are used to access Gmail via the Gmail API.</li>
          <li><strong>Supabase:</strong> Your data is stored in Supabase's secure database infrastructure.</li>
          <li><strong>Razorpay:</strong> Payment information is handled by Razorpay. We do not store credit card details.</li>
        </ul>

        <h2>7. Data Retention</h2>
        <p>
          We retain your email data for as long as your account is active. You can request
          deletion of your account and all associated data at any time by contacting us.
        </p>

        <h2>8. Your Rights</h2>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Revoke Gmail access at any time from Settings or via your Google Account</li>
          <li>Export your data</li>
        </ul>

        <h2>9. Children's Privacy</h2>
        <p>
          Mailair is not intended for use by anyone under the age of 13. We do not knowingly
          collect personal information from children.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any
          significant changes by email or via an in-app notification.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or how we handle your data, contact us at:
          <br />
          <strong>tarrasridhar1154@gmail.com</strong>
        </p>

        <hr style={{ margin: '48px 0', borderColor: '#e7e0d4' }} />
        <p style={{ color: '#a99b83', fontSize: 13, textAlign: 'center' }}>© 2026 Mailair. All rights reserved.</p>
      </div>
      </div>
    </>
  );
}
