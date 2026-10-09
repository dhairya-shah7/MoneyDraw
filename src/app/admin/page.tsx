'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppContext';
import { ReceiptModal, PrintableTransaction } from '@/components/shared/ReceiptModal';
import { UtrReviewModal } from '@/components/admin/UtrReviewModal';
import { formatINR } from '@/lib/format';
import {
  Activity,
  TrendingUp,
  Wallet,
  Clock,
  RefreshCw,
  Smartphone,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ChevronRight,
  Building2,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { pushToast, refreshUser } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PrintableTransaction | null>(null);
  const [selectedFundReq, setSelectedFundReq] = useState<any | null>(null);

  const [simulatedSms, setSimulatedSms] = useState<string>('');
  const [isProcessingSms, setIsProcessingSms] = useState<boolean>(false);
  const [smsResult, setSmsResult] = useState<any>(null);

  // Admin -> Retailer Quick Balance Transfer State
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('10000');
  const [transferRemarks, setTransferRemarks] = useState<string>('Admin Wallet Credit');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  const loadAdminOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin');
      const json = await res.json();
      setData(json);
      if (!selectedRetailerId && json.users?.length > 0) {
        const firstRetailer =
          json.users.find((u: any) => u.roleCode !== 'SUPER_ADMIN') || json.users[0];
        if (firstRetailer) setSelectedRetailerId(String(firstRetailer.id));
      }
    } catch {
      pushToast('Error', 'Failed to load dashboard', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, []);

  if (loading || !data) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading...</div>;
  }

  const users = data.users || [];
  const retailers = users.filter((u: any) => u.roleCode !== 'SUPER_ADMIN');
  const transactions = data.transactions || [];
  const fundRequests = data.fundRequests || [];
  const onboardingApps = data.onboardingApps || [];
  const liveBank = data.liveBankBalance || {
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '9974366033',
    ifsc: 'KKBK0002626',
    upiId: '9974366033@kotak',
    availableBalance: null,
    updatedAt: null,
  };

  const handleGiveBalanceToRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(transferAmount || 0);
    if (!selectedRetailerId || amt <= 0) {
      pushToast('Invalid Input', 'Select a Retailer and enter an amount > 0', 'warning');
      return;
    }
    setIsTransferring(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_wallet',
          userId: Number(selectedRetailerId),
          bucket: 'main',
          direction: 'credit',
          amount: amt,
          remarks: transferRemarks || 'Admin Main Wallet Transfer',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');
      const targetUser = users.find((u: any) => u.id === Number(selectedRetailerId));
      pushToast(
        'Balance Transferred!',
        `Credited ${formatINR(amt)} to ${targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'Retailer'} Main Wallet`,
        'success'
      );
      await loadAdminOverview();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err?.message || 'Transfer failed', 'warning');
    } finally {
      setIsTransferring(false);
    }
  };

  const successTxns = transactions.filter((t: any) => t.status === 'success');
  const totalGtv = successTxns.reduce((s: number, t: any) => s + t.amount, 0);
  const totalPlatformMargin = successTxns.reduce((s: number, t: any) => s + t.adminMargin, 0);
  const totalNetworkFloat = users.reduce(
    (s: number, u: any) => s + (u.wallet?.availableBalance || 0) + (u.wallet?.commissionBalance || 0),
    0
  );
  const pendingFunds = fundRequests.filter(
    (f: any) => f.status === 'pending' || f.status === 'verifying' || f.status === 'mismatch'
  );
  const pendingOnboarding = onboardingApps.filter((a: any) => a.status === 'pending');

  const handleProcessBankSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedSms) return;
    setIsProcessingSms(true);
    setSmsResult(null);

    try {
      const res = await fetch('/api/bank-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_sms: simulatedSms }),
      });

      const resData = await res.json();
      setSmsResult(resData);
      if (resData.autoApproved) {
        pushToast('Auto-Reconciled', resData.message, 'success');
      } else if (resData.balanceUpdated) {
        pushToast('Bank Balance Synced', resData.message, 'success');
      } else if (resData.status === 'BANK_MISMATCH') {
        pushToast('Amount Mismatch', resData.message, 'warning');
      }
      await loadAdminOverview();
      await refreshUser();
    } catch (err: any) {
      setSmsResult({ success: false, error: err?.message });
    } finally {
      setIsProcessingSms(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900">Admin Console</h1>
          <p className="text-xs text-slate-500">Transfer balance to Retailers, view live Kotak Bank balance & manage network</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminOverview}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            All Retailers ({retailers.length})
          </Link>
        </div>
      </div>

      {/* TRANSFER BALANCE TO RETAILER (MAIN WALLET) */}
      <div className="bg-white border-2 border-blue-600/20 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span>Transfer Balance to Retailer Account (Main Wallet)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Select a Retailer below to instantly credit their Main Wallet so they can pay any bank account or user
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[1000, 5000, 10000, 50000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTransferAmount(String(preset))}
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold cursor-pointer"
              >
                +₹{preset.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGiveBalanceToRetailer} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Retailer Account *</label>
            <select
              value={selectedRetailerId}
              onChange={(e) => setSelectedRetailerId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 text-slate-900"
            >
              {(retailers.length > 0 ? retailers : users).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.companyName || u.mobile}) — Main Wallet: {formatINR(u.wallet?.availableBalance || 0)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Credit (₹) *</label>
            <input
              type="number"
              required
              min={1}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-black text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={isTransferring || !selectedRetailerId}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTransferring ? 'Transferring...' : 'Transfer to Retailer'}</span>
          </button>
        </form>
      </div>

      {/* Live Kotak Mahindra Bank Balance Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Live Kotak Bank Balance (SMS Sync)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                A/c 9974366033 • 9974366033@kotak
              </span>
            </div>
            <div className="text-2xl font-black font-mono mt-1">
              {liveBank.availableBalance !== null && liveBank.availableBalance !== undefined
                ? formatINR(liveBank.availableBalance)
                : 'Awaiting Kotak SMS...'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {liveBank.updatedAt
                ? `Last synced from Kotak SMS at ${new Date(liveBank.updatedAt).toLocaleTimeString('en-IN')}${
                    liveBank.lastUtr ? ` • Last UTR: ${liveBank.lastUtr}` : ''
                  }`
                : 'Auto-extracts "Avl Bal Rs. ..." whenever your Android SMS Forwarder sends a Kotak Bank SMS to /api/bank-feed'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setSimulatedSms(
                'Received Rs.2500.00 in your Kotak Bank AC X6033 from retailer@upi on 08-10-26. UPI Ref:428199283712. Avl Bal Rs.1,48,500.00'
              )
            }
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
          >
            Fill Sample Kotak SMS
          </button>
        </div>
      </div>

      {/* Pending UTR Alert */}
      {pendingFunds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-xs font-bold text-amber-900">
              {pendingFunds.length} Deposit UTR{pendingFunds.length > 1 ? 's' : ''} Pending Verification
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedFundReq(pendingFunds[0])}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Review
            </button>
            <Link
              href="/admin/payments"
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1"
            >
              All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Gross Volume</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1.5">
            {formatINR(totalGtv)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{successTxns.length} transactions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Platform Margin</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1.5">
            +{formatINR(totalPlatformMargin)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Net earnings</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Network Balance</span>
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1.5">
            {formatINR(totalNetworkFloat)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{users.length} active users</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Pending Queue</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1.5">
            {pendingFunds.length + pendingOnboarding.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {pendingFunds.length} UTR • {pendingOnboarding.length} KYC
          </div>
        </div>
      </div>

      {/* Bank SMS Auto-Matcher & Balance Extractor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Kotak Bank SMS UTR Matcher & Live Balance Sync
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Webhook: POST /api/bank-feed</span>
        </div>

        <form onSubmit={handleProcessBankSms} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={simulatedSms}
            onChange={(e) => setSimulatedSms(e.target.value)}
            placeholder="Paste Kotak SMS (extracts 12-digit UTR, ₹ Amount, and Avl Bal Rs. ...)"
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={isProcessingSms || !simulatedSms}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isProcessingSms ? 'Syncing...' : 'Verify & Sync Balance'}</span>
          </button>
        </form>

        {smsResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              smsResult.autoApproved || smsResult.balanceUpdated || smsResult.availableBalance !== null
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {smsResult.autoApproved || smsResult.balanceUpdated || smsResult.availableBalance !== null ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{smsResult.message || smsResult.error}</span>
            </div>
            <button onClick={() => setSmsResult(null)} className="text-[11px] font-bold underline ml-3 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Recent UTR Queue & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">UTR Queue</h2>
            <Link href="/admin/payments" className="text-xs font-bold text-blue-600 hover:underline">
              View All →
            </Link>
          </div>

          {fundRequests.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">No UTR requests yet.</div>
          ) : (
            fundRequests.slice(0, 5).map((req: any) => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {req.userCompanyName || req.userName} •{' '}
                    <span className="font-mono text-emerald-600">{formatINR(req.amount)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    UTR: {req.paymentReference} ({req.transferMode})
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFundReq(req)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer shrink-0 ${
                    req.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {req.status === 'approved' ? 'Approved' : 'Review'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent Transactions</h2>
            <Link href="/admin/reconciliation" className="text-xs font-bold text-blue-600 hover:underline">
              Reconciliation →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-2 px-3">Ref</th>
                  <th className="py-2 px-3">Service</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-right">Comm</th>
                  <th className="py-2 px-3 text-right">Margin</th>
                  <th className="py-2 px-3 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions.slice(0, 6).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{tx.reference}</td>
                    <td className="py-2 px-3 font-bold text-[11px] text-blue-700">{tx.serviceName}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(tx.amount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600">
                      {formatINR(tx.commission)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                      +{formatINR(tx.adminMargin)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedReceipt(tx)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ReceiptModal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        transaction={selectedReceipt}
      />

      <UtrReviewModal
        request={selectedFundReq}
        onClose={() => setSelectedFundReq(null)}
        onActionSuccess={() => {
          loadAdminOverview();
          refreshUser();
          pushToast('Updated', 'UTR status and wallet updated.', 'success');
        }}
      />
    </div>
  );
}
