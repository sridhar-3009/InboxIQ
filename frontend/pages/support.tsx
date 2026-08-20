import Head from 'next/head';
import Link from 'next/link';
import { Mail, MessageSquare, FileText, Zap } from 'lucide-react';

const faqs = [
  {
    q: 'Why is my email count showing 0/5 even after syncing?',
    a: 'Syncing emails does not count toward your limit. Only clicking "Process with AI" on an email counts. Each AI-processed email uses 1 of your 5 monthly credits on the Free plan.',
  },
  {
    q: 'My Gmail is not connecting. What do I do?',
    a: 'Go to Settings → Gmail and disconnect then reconnect. Make sure you allow all requested permissions (read and send) on the Google OAuth screen. If the issue persists, try signing out and back in.',
  },
  {
    q: 'I upgraded to Pro but my plan still shows Free.',
    a: 'Plans update via Razorpay webhook — this usually takes a few seconds. Try refreshing the Billing page. If it still shows Free after 5 minutes, email us with your payment confirmation.',
  },
  {
    q: 'Can I use Mailair with multiple Gmail accounts?',
    a: 'Yes. Pro plan allows up to 5 Gmail accounts. Agency plan allows unlimited Gmail accounts. You can add additional accounts from Settings → Gmail.',
  },
  {
    q: 'How accurate is the AI categorization?',
    a: 'Accuracy varies by email type but is typically 90%+ for clear cases like newsletters and urgent client emails. You can always re-process an email or manually change the category on the email detail page.',
  },
  {
    q: 'Does Mailair send emails automatically?',
    a: 'No. Mailair never sends emails without your explicit action. AI reply drafts are generated for you to review, edit, and send manually. You are always in control.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Billing and click "Cancel Subscription". Your access continues until the end of the billing period. No refunds are issued for partial months.',
  },
  {
    q: 'Is my email data safe?',
    a: 'Yes. Email content is encrypted in transit (HTTPS/TLS) and stored securely in Supabase. We never sell your data. Gmail data is only used to provide the Mailair service. See our Privacy Policy for full details.',
  },
];

export default function SupportPage() {
  return (
    <>
      <Head>
        <title>Support — Mailair</title>
        <meta name="description" content="Get help with Mailair. Browse FAQs or contact our support team." />
      </Head>

      <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '10px 16px', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexWrap: 'wrap', rowGap: 8 }}>
        <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 36 }} /></Link>
        <div className="gap-3 sm:gap-6" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/docs" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Docs</Link>
          <Link href="/auth/signin" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#221c16', margin: '0 0 12px' }}>How can we help?</h1>
          <p style={{ color: '#83745e', fontSize: 18 }}>Browse common questions or reach out directly.</p>
        </div>

        {/* Contact cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 64 }}>
          {[
            { icon: Mail, title: 'Email Support', desc: 'Typically reply within 24 hours', cta: 'Send Email', href: 'mailto:saisridhart@gmail.com', color: '#b04723', bg: '#fdf3ee' },
            { icon: FileText, title: 'Documentation', desc: 'Guides for every feature', cta: 'Browse Docs', href: '/docs', color: '#5c6a3d', bg: '#f4f5ee' },
            { icon: Zap, title: 'Changelog', desc: 'See what\'s new in Mailair', cta: 'View Updates', href: '/changelog', color: '#d97706', bg: '#fffbeb' },
          ].map(({ icon: Icon, title, desc, cta, href, color, bg }) => (
            <div key={title} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icon size={22} color={color} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#221c16', margin: '0 0 6px' }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#83745e', margin: '0 0 16px' }}>{desc}</p>
              <a href={href} style={{ fontSize: 13, fontWeight: 600, color, textDecoration: 'none', borderBottom: `1.5px solid ${color}` }}>{cta} →</a>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#221c16', marginBottom: 32 }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {faqs.map((faq, i) => (
            <details key={i} style={{ background: '#fff', border: '1px solid #e7e0d4', borderRadius: 12, padding: '0', overflow: 'hidden' }}>
              <summary style={{ padding: '18px 20px', fontWeight: 600, fontSize: 15, color: '#221c16', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {faq.q}
                <span style={{ fontSize: 20, color: '#a99b83', flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{ padding: '0 20px 18px', fontSize: 14, color: '#4a4033', lineHeight: 1.7, borderTop: '1px solid #f3efe8' }}>
                <p style={{ margin: '12px 0 0' }}>{faq.a}</p>
              </div>
            </details>
          ))}
        </div>

        {/* Still need help */}
        <div style={{ marginTop: 64, textAlign: 'center', background: '#faf8f5', borderRadius: 20, padding: '48px 24px', border: '1px solid #e7e0d4' }}>
          <MessageSquare size={32} color="#a99b83" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 22, fontWeight: 700, color: '#221c16', margin: '0 0 8px' }}>Still need help?</h3>
          <p style={{ color: '#83745e', margin: '0 0 24px' }}>Can&apos;t find your answer above? Drop us an email and we&apos;ll get back to you.</p>
          <a href="mailto:saisridhart@gmail.com" style={{ background: '#b04723', color: '#fff', padding: '12px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
            Email saisridhart@gmail.com
          </a>
        </div>
      </div>
    </>
  );
}
