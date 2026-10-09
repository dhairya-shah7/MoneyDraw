'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  Wallet,
  Building2,
  HandCoins,
  FileBarChart2,
  Users,
  ShieldCheck,
  Settings,
  Search,
  Volume2,
  VolumeX,
  LogOut,
  CheckCircle2,
  Scale,
  Sliders,
  ClipboardCheck,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';

const AppShellNestedContext = createContext(false);

export function AppShell({ children }: { children: React.ReactNode }) {
  const isAlreadyInsideShell = useContext(AppShellNestedContext);
  if (isAlreadyInsideShell) {
    return <>{children}</>;
  }
  return (
    <AppShellNestedContext.Provider value={true}>
      <AppShellInner>{children}</AppShellInner>
    </AppShellNestedContext.Provider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    loading,
    soundboxEnabled,
    soundboxLang,
    toasts,
    setSoundboxEnabled,
    setSoundboxLang,
    speakSoundbox,
    logout,
    dismissToast,
  } = useApp();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  const isAdmin = user?.roleCode === 'SUPER_ADMIN' || user?.roleCode === 'ADMIN';
  const isStaff = user?.roleCode === 'STAFF';

  // Enforce Strict Role-Based Route Protection
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Admin can ONLY access /admin/* routes
    if (isAdmin && !pathname.startsWith('/admin')) {
      router.replace('/admin');
      return;
    }
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace(isStaff ? '/staff' : '/user');
      return;
    }
    if (pathname.startsWith('/staff') && !isStaff) {
      router.replace(isAdmin ? '/admin' : '/user');
      return;
    }
  }, [user, loading, pathname, isAdmin, isStaff, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const adminNav = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Transfer to Retailers', href: '/admin/users', icon: Users },
    { label: 'Fund Requests & Wallet', href: '/admin/payments', icon: Wallet },
    { label: 'Bank & UPI Pool', href: '/admin/settings', icon: Settings },
    { label: 'Commissions', href: '/admin/commissions', icon: Sliders },
    { label: 'Reconciliation', href: '/admin/reconciliation', icon: Scale },
  ];

  const userNav = [
    { label: 'Dashboard', href: '/user', icon: LayoutDashboard },
    { label: 'Main Wallet & Pay', href: '/user/wallet', icon: Wallet },
    { label: 'Value Services', href: '/user/services', icon: Zap },
    { label: 'Reports & History', href: '/user/reports', icon: FileBarChart2 },
    { label: 'Network', href: '/user/downline', icon: Users },
    { label: 'Account', href: '/user/account', icon: Settings },
  ];

  const staffNav = [
    { label: 'Staff Queue', href: '/staff', icon: ShieldCheck },
  ];

  // Strict separation: Admin only sees Admin Console; Retailer only sees Retailer Menu
  const navSections = isAdmin
    ? [{ title: 'Admin Console', items: adminNav }]
    : isStaff
    ? [{ title: 'Operations', items: staffNav }]
    : [{ title: 'Menu', items: userNav }];

  const allCommands = isAdmin
    ? [
        { title: 'Admin Overview', sub: 'Dashboard & Retailer Wallet Transfer', href: '/admin' },
        { title: 'Transfer to Retailers (Users)', sub: 'Give or deduct Retailer Main Wallet balance', href: '/admin/users' },
        { title: 'Fund Requests & Wallet', sub: 'Verify UTRs & Adjust Wallets', href: '/admin/payments' },
        { title: 'Bank & UPI Pool', sub: 'Receiving QRs & Bank-to-Bank Payouts', href: '/admin/settings' },
        { title: 'Commissions', sub: 'Manage slabs & margins', href: '/admin/commissions' },
        { title: 'Reconciliation', sub: 'Ledger & audit', href: '/admin/reconciliation' },
      ]
    : isStaff
    ? [{ title: 'Staff Queue', sub: 'UTR & KYC verification desk', href: '/staff' }]
    : [
        { title: 'Dashboard', sub: 'Balances & recent transactions', href: '/user' },
        { title: 'Main Wallet & Pay', sub: 'Transfer to any Bank or User from Main Wallet', href: '/user/wallet' },
        { title: 'UPI Cash QR', sub: 'Generate dynamic UPI QR', href: '/user/services?tab=UPI_CASH' },
        { title: 'Mobile & DTH Recharge', sub: 'Instant prepaid & DTH recharge', href: '/user/services?tab=RECHARGE' },
        { title: 'Utility Bills (BBPS)', sub: 'Electricity, FASTag, Gas', href: '/user/services?tab=BILLPAY' },
        { title: 'Reports & Ledger', sub: 'Transactions & CSV export', href: '/user/reports' },
      ];

  const quickCommands = allCommands.filter(
    (c) =>
      !cmdQuery ||
      c.title.toLowerCase().includes(cmdQuery.toLowerCase()) ||
      c.sub.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  // Prevent flashing wrong role UI while checking auth
  if (!loading && user && pathname.startsWith('/admin') && !isAdmin) {
    return null;
  }
  if (!loading && user && isAdmin && !pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div className="h-15 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
            <Link href={isAdmin ? '/admin' : isStaff ? '/staff' : '/user'} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-xs">
                M
              </div>
              <div className="font-black text-base tracking-tight text-slate-900">
                MoneyDraw
              </div>
            </Link>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600">
              {user?.roleName || 'Merchant'}
            </span>
          </div>

          {/* Active User Summary */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="font-bold text-xs text-slate-900 truncate">
              {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user?.email || user?.mobile || ''}
            </div>
          </div>

          {/* Role-Filtered Navigation */}
          <nav className="p-2.5 space-y-3 overflow-y-auto flex-1">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-0.5">
                {navSections.length > 1 && (
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sign Out */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50/60 shrink-0">
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-15 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-xs text-slate-500 transition w-56 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="flex-1 text-left truncate">Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-600 rounded border border-slate-200">
                Ctrl K
              </kbd>
            </button>

            {isAdmin && (
              <Link
                href="/admin/users"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition"
              >
                <Users className="w-3.5 h-3.5" />
                Transfer Balance to Retailer
              </Link>
            )}
          </div>

          {/* Wallet Strip (Main + Commission) */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5">
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase leading-none">Main Wallet</div>
                <div className="text-xs font-black text-slate-900 mt-0.5">
                  {formatINR(user?.wallet?.availableBalance)}
                </div>
              </div>
              <div className="h-5 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] font-semibold text-violet-600 uppercase leading-none">Commission</div>
                <div className="text-xs font-black text-violet-700 mt-0.5">
                  {formatINR(user?.wallet?.commissionBalance)}
                </div>
              </div>
            </div>

            {/* Soundbox Toggle */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => {
                  const next = !soundboxEnabled;
                  setSoundboxEnabled(next);
                  if (next) {
                    speakSoundbox('Voice Soundbox Active', 'Soundbox Chalu Ho Gaya Hai');
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  soundboxEnabled
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {soundboxEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Sound</span>
              </button>
              <button
                onClick={() => setSoundboxLang(soundboxLang === 'en-IN' ? 'hi-IN' : 'en-IN')}
                className="px-1.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white cursor-pointer"
              >
                {soundboxLang === 'hi-IN' ? 'HI' : 'EN'}
              </button>
            </div>
          </div>
        </header>

        {/* Toast Notifications */}
        {toasts.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 space-y-2 w-88">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="bg-white border-l-4 border-l-emerald-500 border border-slate-200 rounded-xl p-3.5 shadow-xl flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{t.message}</div>
                  </div>
                </div>
                <button onClick={() => dismissToast(t.id)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="p-5 flex-1 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      {/* Ctrl+K Command Palette */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-xs pt-20 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to page..."
                className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setCmdOpen(false)}
                className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {quickCommands.map((c) => (
                <button
                  key={c.href}
                  onClick={() => {
                    setCmdOpen(false);
                    router.push(c.href);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50/70 rounded-xl text-left transition cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.title}</div>
                    <div className="text-[11px] text-slate-500">{c.sub}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
