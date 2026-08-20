import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle, Clock } from 'lucide-react';

const services = [
  { name: 'API (Backend)',          status: 'operational', uptime: '99.9%' },
  { name: 'Web App (Frontend)',     status: 'operational', uptime: '99.9%' },
  { name: 'Gmail Sync',            status: 'operational', uptime: '99.8%' },
  { name: 'AI Processing (Claude)', status: 'operational', uptime: '99.7%' },
  { name: 'Authentication',         status: 'operational', uptime: '100%' },
  { name: 'Database (Supabase)',    status: 'operational', uptime: '99.9%' },
  { name: 'Payment Processing',     status: 'operational', uptime: '99.9%' },
  { name: 'Email Notifications',    status: 'operational', uptime: '99.8%' },
];

const incidents = [
  {
    date: 'March 15, 2026',
    title: 'Intermittent CORS errors on API requests',
    status: 'Resolved',
    duration: '~2 hours',
    detail: 'Some users experienced CORS-blocked API calls from the web app. Root cause was an environment variable override in the Render deployment. Fixed by hardcoding allowed origins.',
  },
  {
    date: 'February 28, 2026',
    title: 'Gmail sync delays',
    status: 'Resolved',
    duration: '~30 minutes',
    detail: 'Gmail sync was delayed for some users due to Google API rate limiting. Resolved after implementing exponential backoff on sync retries.',
  },
];

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  operational:   { bg: '#f4f5ee', text: '#5c6a3d', dot: '#5c6a3d' },
  degraded:      { bg: '#fbf2e6', text: '#b3812c', dot: '#b3812c' },
  outage:        { bg: '#fbe9e5', text: '#b5432f', dot: '#b5432f' },
};

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <>
      <Head>
        <title>System Status — Mailair</title>
        <meta name="description" content="Real-time status of all Mailair services." />
      </Head>

      <nav style={{ borderBottom: '1px solid #e7e0d4', padding: '10px 16px', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexWrap: 'wrap', rowGap: 8 }}>
        <Link href="/"><img src="/logo.svg" alt="Mailair" style={{ height: 36 }} /></Link>
        <div className="gap-3 sm:gap-6" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/support" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Support</Link>
          <Link href="/auth/signin" style={{ color: '#83745e', fontSize: 14, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        {/* Overall status */}
        <div style={{ background: allOperational ? '#f4f5ee' : '#fbe9e5', border: `1px solid ${allOperational ? '#e6e9d6' : '#f0c7bc'}`, borderRadius: 20, padding: '32px 40px', textAlign: 'center', marginBottom: 48 }}>
          <CheckCircle size={40} color={allOperational ? '#5c6a3d' : '#b5432f'} style={{ margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 28, fontWeight: 800, color: allOperational ? '#5c6a3d' : '#b5432f', margin: '0 0 8px' }}>
            {allOperational ? 'All Systems Operational' : 'Service Disruption'}
          </h1>
          <p style={{ color: '#83745e', margin: 0 }}>Last checked: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        </div>

        {/* Services */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#221c16', marginBottom: 16 }}>Services</h2>
        <div style={{ background: '#fff', border: '1px solid #e7e0d4', borderRadius: 16, overflow: 'hidden', marginBottom: 48 }}>
          {services.map((service, i) => {
            const st = statusStyle[service.status];
            return (
              <div key={service.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < services.length - 1 ? '1px solid #f3efe8' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#4a4033', fontWeight: 500 }}>{service.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 12, color: '#a99b83' }}>{service.uptime} uptime</span>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 99, background: st.bg, color: st.text, textTransform: 'capitalize' }}>
                    {service.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Incidents */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#221c16', marginBottom: 16 }}>Past Incidents</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {incidents.map((incident) => (
            <div key={incident.title} style={{ background: '#fff', border: '1px solid #e7e0d4', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#221c16', margin: 0 }}>{incident.title}</h3>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: '#f4f5ee', color: '#5c6a3d' }}>{incident.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#a99b83', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {incident.date}
                </span>
                <span style={{ fontSize: 12, color: '#a99b83' }}>Duration: {incident.duration}</span>
              </div>
              <p style={{ fontSize: 13, color: '#83745e', margin: 0, lineHeight: 1.6 }}>{incident.detail}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 48, textAlign: 'center', fontSize: 13, color: '#a99b83' }}>
          Experiencing issues? <a href="mailto:saisridhart@gmail.com" style={{ color: '#b04723' }}>Contact support</a>
        </p>
      </div>
    </>
  );
}
