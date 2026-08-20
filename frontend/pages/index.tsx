import Head from 'next/head';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Mail,
  Quote,
} from 'lucide-react';
import { useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Navbar({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-md border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/">
            <img src="/logo.svg" alt="Mailair" className="h-8 w-auto cursor-pointer" />
          </Link>
          <div className="hidden md:flex items-center gap-9">
            <a href="#approach" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Approach</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <Link href="/shop" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Shop</Link>
            {isLoggedIn ? (
              <Link href="/dashboard" className="rounded-md bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors">Go to dashboard</Link>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign in</Link>
                <Link href="/auth/signup" className="rounded-md bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors">Start free</Link>
              </>
            )}
          </div>
          <button
            className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
          <a href="#approach" className="block text-sm text-gray-600" onClick={() => setMobileOpen(false)}>Approach</a>
          <a href="#how-it-works" className="block text-sm text-gray-600" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#pricing" className="block text-sm text-gray-600" onClick={() => setMobileOpen(false)}>Pricing</a>
          <Link href="/shop" className="block text-sm text-gray-600" onClick={() => setMobileOpen(false)}>Shop</Link>
          {isLoggedIn ? (
            <Link href="/dashboard" className="block text-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white">Go to dashboard</Link>
          ) : (
            <>
              <Link href="/auth/signin" className="block text-sm text-gray-600">Sign in</Link>
              <Link href="/auth/signup" className="block text-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white">Start free</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative px-5 sm:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(176,71,35,0.18) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="mx-auto max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />
            Built for people who run their inbox like a business
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.08] tracking-tight text-gray-900">
            The email you actually
            <span className="italic text-primary-700"> need to see</span>,
            surfaced first.
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
            Mailair sits on top of Gmail and quietly does the sorting you'd do yourself if
            you had two more hours a day — urgent client emails up front, action items
            pulled out, replies drafted in your voice.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href={isLoggedIn ? '/dashboard' : '/auth/signup'}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 hover:bg-primary-700 px-6 py-3 text-sm font-semibold text-white shadow-warm transition-colors"
            >
              {isLoggedIn ? 'Go to dashboard' : 'Start free — 5 emails/mo'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-primary-700 transition-colors"
            >
              See how it works
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-500">No credit card. Cancel any time. Built by one person who got tired of missing invoices in his own inbox.</p>
        </div>

        {/* Inbox mockup — editorial paper card, not a dark browser chrome */}
        <div className="relative">
          <div className="absolute -inset-3 -z-10 rounded-2xl bg-primary-100/60 rotate-1" />
          <div className="rounded-2xl border border-gray-200 bg-white shadow-warm-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
              <Mail className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-serif text-gray-800">Today's priority inbox</span>
              <span className="ml-auto text-xs text-gray-400">3 need you</span>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { from: 'Sarah Michaels', subject: 'Contract needs your signature today', tag: 'Urgent', tagClass: 'bg-primary-50 text-primary-700 border-primary-200' },
                { from: 'Tech Corp Billing', subject: 'Invoice #2847 — 12 days overdue', tag: 'Needs reply', tagClass: 'bg-warning/10 text-warning border-warning/30' },
                { from: 'Mike Reynolds', subject: "Circling back on last week's proposal", tag: 'Follow up', tagClass: 'bg-olive-50 text-olive-600 border-olive-100' },
              ].map((email) => (
                <div key={email.subject} className="px-5 py-4 hover:bg-gray-50/80 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-gray-800">{email.from}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${email.tagClass}`}>{email.tag}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{email.subject}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-8 pl-1">
            {[
              { val: '2h → 20m', label: 'avg. daily email time' },
              { val: '99%', label: 'emails correctly sorted' },
            ].map((stat) => (
              <div key={stat.val}>
                <div className="font-serif text-2xl text-gray-900">{stat.val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Approach (numbered manifesto list, not icon-card grid) ──────────────────
const approach = [
  {
    n: '01',
    title: 'It reads before you do',
    description:
      "Every email that lands gets classified — urgent, needs a reply, just FYI — the moment it arrives, so your inbox is already sorted by the time you open it.",
  },
  {
    n: '02',
    title: 'It pulls out the actual work',
    description:
      'Deadlines, tasks, and follow-ups get extracted into a running list. You stop re-reading threads to remember what you promised someone.',
  },
  {
    n: '03',
    title: 'It drafts in your voice',
    description:
      'Replies come back written the way you actually write — not generic AI filler. Edit and send in seconds, or let routine ones go out on their own.',
  },
  {
    n: '04',
    title: 'It tells you the moment it matters',
    description:
      "A Slack ping when something urgent lands. Not a notification for every email — just the ones that would've cost you a client if missed.",
  },
];

function Approach() {
  return (
    <section id="approach" className="px-5 sm:px-8 py-20 sm:py-28 border-t border-gray-200">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 mb-3">The approach</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-gray-900 leading-tight">
            Not another inbox. A second pair of eyes on the one you already have.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-12">
          {approach.map((item) => (
            <div key={item.n} className="flex gap-5">
              <span className="font-serif text-3xl text-primary-300 leading-none flex-shrink-0">{item.n}</span>
              <div>
                <h3 className="font-serif text-xl text-gray-900 mb-2">{item.title}</h3>
                <p className="text-[15px] text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      step: '1',
      title: 'Connect Gmail',
      description: 'One click, Google OAuth. Mailair never sees or stores your password — Google handles that part entirely.',
    },
    {
      step: '2',
      title: 'Let it process',
      description: 'Hit "Process with AI" on an email, or let it run automatically. Categorized, scored, and drafted in seconds — you control how much runs on autopilot.',
    },
    {
      step: '3',
      title: 'Work the priority list',
      description: 'Open a sorted inbox instead of a flat one. Check off action items, send or edit drafts, get pinged on Slack for the ones that can\'t wait.',
    },
  ];

  return (
    <section id="how-it-works" className="px-5 sm:px-8 py-20 sm:py-28 bg-primary-50/40 border-t border-gray-200">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 mb-3">How it works</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-gray-900 leading-tight">Set up over coffee. Save hours every week after.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.step} className="relative pl-14">
              <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-primary-600 font-serif text-lg text-primary-700">
                {step.step}
              </div>
              <h3 className="font-serif text-lg text-gray-900 mb-2 pt-1.5">{step.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: '',
    period: '',
    description: 'To see if it actually helps before you pay for anything.',
    features: [
      '5 AI-processed emails / month',
      '1 Gmail account',
      'Priority inbox sorting',
      'Action item extraction',
    ],
    cta: 'Start free',
    href: '/auth/signup',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    currency: '₹',
    period: '/mo',
    description: 'For a busy solo inbox that can\'t afford to miss things.',
    features: [
      'Unlimited AI processing',
      '5 Gmail accounts',
      'Smart reply drafts, in your voice',
      'Slack alerts for urgent mail',
      'Priority support',
    ],
    cta: 'Start Pro',
    href: '/auth/signup',
    highlight: true,
    badge: 'Most chosen',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 1499,
    currency: '₹',
    period: '/mo',
    description: 'When the whole team shares the same inbox pressure.',
    features: [
      'Everything in Pro',
      'Unlimited Gmail accounts',
      'Team member access',
      'CRM sync (HubSpot, Salesforce)',
      'API access',
    ],
    cta: 'Start Agency',
    href: '/auth/signup',
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="px-5 sm:px-8 py-20 sm:py-28 border-t border-gray-200">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 mb-3">Pricing</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-gray-900 leading-tight">Simple pricing. Start free, no clock ticking.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-7 ${
                plan.highlight
                  ? 'border-2 border-primary-600 bg-white shadow-warm-lg'
                  : 'border border-gray-200 bg-white shadow-warm'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white">
                  {plan.badge}
                </span>
              )}
              <h3 className="font-serif text-xl text-gray-900">{plan.name}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed h-10">{plan.description}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-gray-900">
                  {plan.price === 0 ? 'Free' : `${plan.currency}${plan.price.toLocaleString()}`}
                </span>
                {plan.price > 0 && <span className="text-sm text-gray-500">{plan.period}</span>}
              </div>
              <ul className="mt-7 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={`mt-8 block w-full rounded-md py-2.5 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials — editorial pull-quotes, not avatar-card grid ──────────────
const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Founder, Apex Web Studio',
    quote: "I used to spend two hours a day just reading email. Now it's twenty minutes, and the drafts genuinely sound like me — not a chatbot.",
  },
  {
    name: 'Marcus Johnson',
    role: 'Freelance Consultant',
    quote: "It flagged an urgent message during a week I was heads-down in a project and would've completely missed. That one email was worth a $15k contract.",
  },
  {
    name: 'Priya Sharma',
    role: 'Owner, Sharma Design Co.',
    quote: 'Juggling twenty-plus clients, the priority sort is the whole product for me. I open my inbox and know exactly where to start.',
  },
];

function Testimonials() {
  return (
    <section className="px-5 sm:px-8 py-20 sm:py-28 bg-gray-900 text-gray-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-300 mb-3">From people using it</p>
        <div className="grid md:grid-cols-3 gap-10 mt-10">
          {testimonials.map((t) => (
            <div key={t.name} className="flex flex-col">
              <Quote className="h-6 w-6 text-primary-400 mb-4" />
              <p className="font-serif text-lg leading-snug text-gray-100 flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 pt-4 border-t border-gray-700">
                <p className="text-sm font-medium text-gray-200">{t.name}</p>
                <p className="text-xs text-gray-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="px-5 sm:px-8 py-20 sm:py-28 bg-primary-700 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl sm:text-4xl leading-tight">
          Give your inbox back its order.
        </h2>
        <p className="mt-4 text-primary-100 text-lg max-w-xl mx-auto">
          Connect Gmail, process your first emails free, and see what a sorted
          inbox actually feels like.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={isLoggedIn ? '/dashboard' : '/auth/signup'}
            className="inline-flex items-center gap-2 rounded-md bg-white hover:bg-primary-50 px-7 py-3 text-sm font-semibold text-primary-800 transition-colors"
          >
            {isLoggedIn ? 'Go to dashboard' : 'Start free'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {!isLoggedIn && (
            <Link href="/auth/signin" className="text-sm font-medium text-primary-100 hover:text-white transition-colors">
              Already have an account? Sign in
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-14 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Link href="/"><img src="/logo-dark.svg" alt="Mailair" className="h-8 w-auto cursor-pointer" /></Link>
            <p className="mt-4 text-sm leading-relaxed max-w-xs">
              A sorted inbox for people running a service business on Gmail.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-200 mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#approach" className="hover:text-white transition-colors">Approach</Link></li>
              <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              <li><Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-200 mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/docs" className="hover:text-white transition-colors">Docs</Link></li>
              <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
              <li><Link href="/status" className="hover:text-white transition-colors">Status</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-200 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
              <li><Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p>© 2026 Mailair.</p>
          <p>Built for service businesses who live in their inbox.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { session } = useSessionContext();
  const isLoggedIn = !!session;

  return (
    <>
      <Head>
        <title>Mailair — a sorted inbox, not another inbox</title>
        <meta name="description" content="Mailair triages, prioritizes, and drafts replies for your Gmail inbox — built for service businesses that can't afford to miss a client email." />
        <meta property="og:title" content="Mailair — a sorted inbox, not another inbox" />
        <meta property="og:description" content="Stop drowning in email. Mailair sorts, extracts, and drafts — so the important thing is never buried." />
      </Head>
      <Navbar isLoggedIn={isLoggedIn} />
      <main>
        <Hero isLoggedIn={isLoggedIn} />
        <Approach />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <CTABanner isLoggedIn={isLoggedIn} />
      </main>
      <Footer />
    </>
  );
}
