import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSessionContext, useUser } from '@supabase/auth-helpers-react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
  Bell,
  User,
  BarChart2,
  AlarmClock,
  Users,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Newspaper,
  Clock,
  Heart,
  TrendingUp,
  Timer,
  Repeat2,
  BookOpen,
  FileText,
  DollarSign,
  ShoppingBag,
  FileStack,
  Megaphone,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import ThemeToggle from './ThemeToggle';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { useEmailStats } from '@/lib/hooks';
import { notificationsApi } from '@/lib/api';
import type { AppNotification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',     href: '/dashboard',      icon: LayoutDashboard },
  { label: 'Campaigns',     href: '/campaigns',       icon: Megaphone },
  { label: 'Inbox',         href: '/email',           icon: Inbox },
  { label: 'Snoozed',       href: '/snoozed',        icon: AlarmClock },
  { label: 'Actions',       href: '/actions',         icon: CheckSquare },
  { label: 'Analytics',     href: '/analytics',       icon: BarChart2 },
  { label: 'Relationships', href: '/relationships',   icon: Heart },
  { label: 'Revenue',       href: '/revenue',         icon: DollarSign },
  { label: 'SLA Tracker',   href: '/sla',             icon: Timer },
  { label: 'Sequences',     href: '/sequences',       icon: Repeat2 },
  { label: 'Knowledge',     href: '/knowledge',       icon: BookOpen },
  { label: 'Briefs',        href: '/briefs',          icon: FileText },
  { label: 'Quotes',        href: '/quotes',          icon: TrendingUp },
  { label: 'Shop',          href: '/shop',            icon: ShoppingBag },
  { label: 'CRM',           href: '/crm',             icon: Users },
  { label: 'Team',          href: '/team',            icon: Users },
  { label: 'Workspace',     href: '/workspace',       icon: FileStack },
  { label: 'Settings',      href: '/settings',        icon: Settings },
  { label: 'Billing',       href: '/billing',         icon: CreditCard },
];

// Mobile bottom nav — only the 4 most important
const mobileNavItems: NavItem[] = [
  { label: 'Home',      href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Inbox',     href: '/email',      icon: Inbox },
  { label: 'Snoozed',   href: '/snoozed',   icon: AlarmClock },
  { label: 'Actions',   href: '/actions',    icon: CheckSquare },
  { label: 'Analytics', href: '/analytics',  icon: BarChart2 },
  { label: 'CRM',       href: '/crm',        icon: Users },
  { label: 'Settings',  href: '/settings',   icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const router = useRouter();
  const { isLoading, session } = useSessionContext();
  const user = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Client-side auth guard — middleware can't read localStorage sessions
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/auth/signin?next=${encodeURIComponent(router.pathname)}`);
    }
  }, [isLoading, session, router]);

  const LOGOS = ['/logo.svg', '/logo-v2.svg', '/logo-v3.svg'];
  const LOGOS_DARK = ['/logo-dark.svg', '/logo-dark-v2.svg', '/logo-dark-v3.svg'];
  const [logoIdx, setLogoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLogoIdx(i => (i + 1) % LOGOS.length), 2 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: ? opens shortcuts modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [router.pathname]);

  // Notifications: poll every 30s
  useEffect(() => {
    if (!session) return;
    const load = () => {
      notificationsApi.list()
        .then(({ notifications, unread_count }) => { setNotifications(notifications); setUnreadCount(unread_count); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const handleBellOpen = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unreadCount > 0) {
      notificationsApi.markAllRead().then(() => setUnreadCount(0)).catch(() => {});
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (profileOpen || bellOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [profileOpen, bellOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setProfileOpen(false);
    try {
      await supabase.auth.signOut();
      router.push('/auth/signin');
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
      setSigningOut(false);
    }
  };

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  const userEmail    = user?.email ?? '';
  const displayName  = user?.user_metadata?.full_name ?? userEmail.split('@')[0];

  const { data: emailStats } = useEmailStats();
  const catBreakdown = (emailStats as any)?.category_breakdown ?? {};

  const SMART_FOLDERS = [
    { label: 'Urgent',      href: '/email?category=urgent',         icon: AlertTriangle,  color: 'text-red-500',    dot: 'bg-red-500',    key: 'urgent' },
    { label: 'Needs Reply', href: '/email?category=needs_response', icon: MessageSquare,  color: 'text-amber-500',  dot: 'bg-amber-400',  key: 'needs_response' },
    { label: 'Follow Up',   href: '/email?category=follow_up',      icon: RefreshCw,      color: 'text-warning',    dot: 'bg-warning',   key: 'follow_up' },
    { label: 'Waiting',     href: '/email?labels=__followup__',     icon: Clock,          color: 'text-olive-500',  dot: 'bg-olive-400',  key: '__followup__' },
    { label: 'Newsletters', href: '/email/newsletters',             icon: Newspaper,      color: 'text-emerald-500',dot: 'bg-emerald-400',key: 'newsletter' },
  ];

  const NavLinks = () => (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {navItems.map((item, i) => {
        const isActive = router.pathname === item.href || (item.href !== '/email' && router.pathname.startsWith(item.href));
        const isInboxActive = item.href === '/email' && router.pathname.startsWith('/email');
        const active = isActive || isInboxActive;
        const { icon: Icon } = item;
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                `animate-slide-in-left stagger-${i + 1}`,
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 hover:translate-x-0.5'
              )}
            >
              <Icon
                className={clsx(
                  'h-5 w-5 flex-shrink-0 transition-colors duration-150',
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              />
              {item.label}
              {active && <ChevronRight className="ml-auto h-4 w-4 text-primary-400" />}
            </Link>

            {/* Smart folders — shown nested under Inbox */}
            {item.href === '/email' && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-gray-700 pl-3">
                {SMART_FOLDERS.map((sf) => {
                  const sfActive = router.asPath === sf.href;
                  const count: number = catBreakdown[sf.key] ?? 0;
                  const SfIcon = sf.icon;
                  return (
                    <Link
                      key={sf.href}
                      href={sf.href}
                      className={clsx(
                        'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150',
                        sfActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                      )}
                    >
                      <SfIcon className={clsx('h-3.5 w-3.5 flex-shrink-0', sf.color)} />
                      <span className="flex-1 truncate">{sf.label}</span>
                      {count > 0 && (
                        <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white', sf.dot)}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const UserSection = () => (
    <div className="border-t border-gray-100 dark:border-gray-700 p-3">
      <div className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold shadow-sm">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all duration-150"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-gray-200 dark:border-gray-700 lg:bg-white dark:lg:bg-gray-900 lg:fixed lg:inset-y-0">
        {/* Logo */}
        <div className="flex items-center px-4 py-6 animate-fade-in">
          <Link href="/" className="block w-full">
            <img src={LOGOS[logoIdx]} alt="Mailair" className="h-12 w-auto dark:hidden transition-opacity duration-500 cursor-pointer" />
            <img src={LOGOS_DARK[logoIdx]} alt="Mailair" className="h-12 w-auto hidden dark:block transition-opacity duration-500 cursor-pointer" />
          </Link>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <NavLinks />
          <UserSection />
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 flex flex-col shadow-2xl animate-slide-in-left">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <Link href="/" className="block" onClick={() => setSidebarOpen(false)}>
                <img src={LOGOS[logoIdx]} alt="Mailair" className="h-12 w-auto dark:hidden transition-opacity duration-500 cursor-pointer" />
                <img src={LOGOS_DARK[logoIdx]} alt="Mailair" className="h-12 w-auto hidden dark:block transition-opacity duration-500 cursor-pointer" />
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">
              <NavLinks />
              <UserSection />
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex flex-1 flex-col lg:pl-64">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            {title && (
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg truncate">{title}</h1>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={handleBellOpen}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50 animate-slide-down max-h-96 overflow-y-auto">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</p>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center">
                      <Bell className="mx-auto h-8 w-8 text-gray-200 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Urgent email alerts will appear here</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const inner = (
                        <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                          <p className={clsx('text-sm', !n.is_read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>{n.title}</p>
                          {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                        </div>
                      );
                      return n.link ? (
                        <Link key={n.id} href={n.link} onClick={() => setBellOpen(false)}>{inner}</Link>
                      ) : (
                        <div key={n.id}>{inner}</div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label="Profile menu"
              >
                {userInitials}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50 animate-slide-down">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{userEmail}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      Settings
                    </Link>
                    <Link
                      href="/billing"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <CreditCard className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      Billing
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      Profile
                    </Link>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 page-enter">
          {children}
        </main>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-pb">
        <div className="flex items-center justify-around px-1 py-1">
          {mobileNavItems.map((item) => {
            const isActive = router.pathname.startsWith(item.href);
            const { icon: Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 px-1 transition-all duration-150',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}
              >
                <div className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150',
                  isActive ? 'bg-primary-50 dark:bg-primary-900/30 scale-110' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={clsx(
                  'text-[10px] font-medium leading-none',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
