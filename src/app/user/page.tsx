'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet,
  QrCode,
  Building2,
  Smartphone,
  FileText,
  Award,
  ArrowUpRight,
  ArrowLeftRight,
  Printer,
  TrendingUp,
  Zap,
  Search,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { formatINR, formatDateTime } from '@/lib/format';
import { ReceiptModal, PrintableTransaction } from '@/components/shared/ReceiptModal';

export default function UserDashboardPage() {
  const { user } = useApp();
  const [data, setData] = useState<any>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<PrintableTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadDashboard = useCallback(async () => {
    const mobile = user?.mobile || '9081047006';
    const res = await fetch(`/api/dashboard?mobile=${encodeURIComponent(mobile)}`);
    if (res.ok) {
      setData(await res.json());
    }
  }, [user?.mobile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const quickServices = [
    {
      label: 'Bank Transfer',
      sub: 'Pay Any Bank A/c',
      href: '/user/wallet',
      icon: Building2,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      label: 'UPI Cash QR',
      sub: 'Scan & Collect',
      href: '/user/services?tab=UPI_CASH',
      icon: QrCode,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      label: 'Mobile & DTH',
      sub: 'Instant Recharge',
      href: '/user/services?tab=RECHARGE',
      icon: Smartphone,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    {
      label: 'Utility Bills',
      sub: 'Electricity & BBPS',
      href: '/user/services?tab=BILLPAY',
      icon: FileText,
      color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    },
    {
      label: 'CMS Drop',
      sub: 'EMI & Collections',
      href: '/user/services?tab=CMS',
      icon: Zap,
      color: 'bg-rose-50 text-rose-600 border-rose-200',
    },
    {
      label: 'Reports & History',
      sub: 'Ledger & Receipts',
      href: '/user/reports',
      icon: Award,
      color: 'bg-violet-50 text-violet-600 border-violet-200',
    },
  ];

  const mainBalance = Number(user?.wallet?.availableBalance ?? data?.user?.wallet?.availableBalance ?? 0);
  const commBalance = Number(user?.wallet?.commissionBalance ?? data?.user?.wallet?.commissionBalance ?? 0);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <h1 className="text-xl font-black text-slate-900">Merchant Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {user?.firstName} {user?.lastName} ({user?.companyName})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCertOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 cursor-pointer"
            >
              <Award className="w-4 h-4 text-blue-600" />
              Certificate
            </button>
            <Link
              href="/user/services"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
            >
              <Zap className="w-4 h-4" />
              New Transaction
            </Link>
          </div>
        </div>

        {/* KPI Cards (No AEPS Card) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Main Wallet</span>
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{formatINR(mainBalance)}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/user/wallet"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                Pay Any Bank / User <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/user/wallet" className="text-xs font-bold text-emerald-700 hover:underline">
                Saved Beneficiaries →
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-700 uppercase">Commission Wallet</span>
                <TrendingUp className="w-4 h-4 text-violet-600" />
              </div>
              <div className="text-2xl font-black text-violet-700 mt-2">{formatINR(commBalance)}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/user/wallet"
                className="text-xs font-bold text-violet-600 hover:text-violet-800 inline-flex items-center gap-1"
              >
                Transfer to Main <ArrowLeftRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/user/downline" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                Slabs
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Volume</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                  Active
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {formatINR(data?.totals?.totalAmount ?? 0)}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link href="/user/reports" className="text-xs font-bold text-blue-600 hover:text-blue-800">
                View Reports →
              </Link>
              <span className="text-xs text-slate-500">
                {data?.totals?.totalTransactions ?? 0} txns
              </span>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-900">Services</h2>
            <Link href="/user/services" className="text-xs font-bold text-blue-600 hover:underline">
              All Services →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickServices.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.label}
                  href={s.href}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 transition group flex flex-col justify-between"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${s.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-xs font-black text-slate-900 group-hover:text-blue-600">{s.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Bank & User Transfers (Searchable) */}
        {(() => {
          const allTxns = data?.lastTransactions || [];
          const query = searchQuery.trim().toLowerCase();
          const filteredTxns = allTxns.filter((tx: any) => {
            if (!query) return true;
            const name = (tx.customerName || '').toLowerCase();
            const ref = (tx.reference || '').toLowerCase();
            const acc = (tx.accountOrVpa || '').toLowerCase();
            const ifsc = (tx.ifsc || '').toLowerCase();
            const bank = (tx.bankName || tx.serviceName || '').toLowerCase();
            const utr = (tx.bankRrn || '').toLowerCase();
            const mode = (tx.transferMode || '').toLowerCase();
            const amt = String(tx.amount || '');
            return (
              name.includes(query) ||
              ref.includes(query) ||
              acc.includes(query) ||
              ifsc.includes(query) ||
              bank.includes(query) ||
              utr.includes(query) ||
              mode.includes(query) ||
              amt.includes(query)
            );
          });

          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-slate-900">Main Wallet Transfers (To Any Bank & Users)</h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                    {query ? `${filteredTxns.length} of ${allTxns.length}` : `${allTxns.length} Total`}
                  </span>
                </div>

                {/* Search Bar & Button */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, A/c, IFSC, UTR..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-500 transition outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <Search className="w-3 h-3" />
                    Search
                  </button>
                  <Link
                    href="/user/wallet"
                    className="text-xs font-bold text-blue-600 hover:underline shrink-0 ml-1 hidden sm:inline"
                  >
                    + New Payment
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Account Holder / Name</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4">Bank Account Number</th>
                      <th className="py-2.5 px-4">IFSC Code & Bank</th>
                      <th className="py-2.5 px-4">UTR / Mode</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4 text-right">Pay / Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTxns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                          {query ? (
                            <div className="space-y-1">
                              <div>No transfers found matching &quot;<strong>{searchQuery}</strong>&quot;</div>
                              <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="text-blue-600 text-xs font-bold hover:underline cursor-pointer"
                              >
                                Clear Search
                              </button>
                            </div>
                          ) : (
                            'No transfers yet. Make a transfer to see history here.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredTxns.map((tx: any) => (
                        <tr key={tx.reference} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-4">
                            <div className="font-black text-slate-900">{tx.customerName}</div>
                            <div className="font-mono text-[11px] text-slate-400">{tx.reference}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                            {formatINR(tx.amount)}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{tx.accountOrVpa || '—'}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-mono font-bold text-slate-900">{tx.ifsc || '—'}</div>
                            <div className="text-[11px] text-slate-500">{tx.bankName || tx.serviceName}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] mr-1">
                              {tx.transferMode || 'PAID'}
                            </span>
                            {tx.bankRrn || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href="/user/wallet"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              >
                                Pay
                              </Link>
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Slip
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      <ReceiptModal
        open={!!selectedTx || certOpen}
        onClose={() => {
          setSelectedTx(null);
          setCertOpen(false);
        }}
        transaction={selectedTx}
        certificateUser={
          certOpen
            ? {
                name: `${user?.firstName || 'Gelot'} ${user?.lastName || 'Mahendrakumar mangalji'}`,
                companyName: user?.companyName || 'Shree Krishna agro food',
                mobile: user?.mobile || '9081047006',
                panNumber: user?.panNumber || 'DSCPG3386N',
                city: user?.city || 'Ahmedabad',
                state: user?.state || 'Gujarat',
                pinCode: user?.pinCode || '380051',
                roleName: user?.roleName || 'Retailer',
              }
            : null
        }
      />
    </AppShell>
  );
}
