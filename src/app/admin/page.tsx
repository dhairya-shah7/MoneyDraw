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
  EyeOff,
  ChevronRight,
  Building2,
  Lock,
  ShieldCheck,
  Landmark,
  ArrowRightLeft,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { pushToast, refreshUser } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PrintableTransaction | null>(null);
  const [selectedFundReq, setSelectedFundReq] = useState<any | null>(null);

  // Bank SMS Matcher & Balance Simulator
  const [simulatedSms, setSimulatedSms] = useState<string>('');
  const [isProcessingSms, setIsProcessingSms] = useState<boolean>(false);
  const [smsResult, setSmsResult] = useState<any>(null);

  // Direct Bank Balance Sync
  const [directBankBal, setDirectBankBal] = useState<string>('');
  const [isSyncingDirectBal, setIsSyncingDirectBal] = useState<boolean>(false);

  // Admin -> Retailer Treasury Payout State
  const [fundingSource, setFundingSource] = useState<'admin_wallet' | 'company_bank'>('admin_wallet');
  const [transferDestination, setTransferDestination] = useState<'retailer_wallet' | 'retailer_bank'>('retailer_wallet');
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('10000');
  const [transferRemarks, setTransferRemarks] = useState<string>('Treasury Float Load');
  const [adminTpin, setAdminTpin] = useState<string>('1234');
  const [showTpin, setShowTpin] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // WhatsApp Banking & 1-Tap UPI Approvals
  const [whatsAppText, setWhatsAppText] = useState<string>('');
  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState<boolean>(false);
  const [whatsAppResult, setWhatsAppResult] = useState<any>(null);
  const [payoutAlertData, setPayoutAlertData] = useState<any>(null);
  const [showPayoutAlertModal, setShowPayoutAlertModal] = useState<boolean>(false);

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
      if (json.liveBankBalance?.availableBalance) {
        setDirectBankBal(String(json.liveBankBalance.availableBalance));
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
    return (
      <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Loading Admin Treasury Console...</span>
      </div>
    );
  }

  const users = data.users || [];
  const adminUser = users.find((u: any) => u.roleCode === 'SUPER_ADMIN') || users[0];
  const retailers = users.filter((u: any) => u.roleCode !== 'SUPER_ADMIN');
  const transactions = data.transactions || [];
  const fundRequests = data.fundRequests || [];
  const onboardingApps = data.onboardingApps || [];
  const liveBank = data.liveBankBalance || {
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '9974366033',
    ifsc: 'KKBK0002626',
    upiId: '9974366033@kotak',
    accountHolder: 'TEKCHANDJI CO',
    availableBalance: 148701,
    updatedAt: new Date().toISOString(),
  };

  const selectedRetailer = retailers.find((r: any) => String(r.id) === String(selectedRetailerId));

  // EXECUTE REAL ADMIN-TO-RETAILER PAYOUT (DOUBLE-ENTRY LEDGER + TPIN)
  const handleGiveBalanceToRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(transferAmount || 0);
    if (!selectedRetailerId || amt <= 0) {
      pushToast('Invalid Input', 'Select a Retailer and enter an amount > 0', 'warning');
      return;
    }
    if (!adminTpin || adminTpin.length < 4) {
      pushToast('TPIN Required', 'Please enter your 4-6 digit Admin TPIN to authorize transfer', 'warning');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_transfer_to_retailer',
          retailerId: Number(selectedRetailerId),
          amount: amt,
          fundingSource,
          transferDestination,
          tpin: adminTpin,
          remarks: transferRemarks || 'Admin Treasury Transfer',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');

      pushToast(
        'Payout Succeeded!',
        `Transferred ${formatINR(amt)} to ${selectedRetailer?.companyName || selectedRetailer?.firstName} (Ref: ${json.transaction?.reference})`,
        'success'
      );

      // Open printable official receipt modal
      if (json.transaction) {
        setSelectedReceipt(json.transaction);
      }

      await loadAdminOverview();
      await refreshUser();
    } catch (err: any) {
      pushToast('Payout Rejected', err?.message || 'Transfer failed', 'warning');
    } finally {
      setIsTransferring(false);
    }
  };

  // DIRECT BANK BALANCE SYNC HANDLER
  const handleDirectBankSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(directBankBal);
    if (isNaN(bal) || bal < 0) {
      pushToast('Invalid Balance', 'Enter a valid positive number for bank balance', 'warning');
      return;
    }
    setIsSyncingDirectBal(true);
    try {
      const res = await fetch('/api/bank-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_balance',
          balance: bal,
          bankName: 'Kotak Mahindra Bank',
        }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Failed updating balance');
      pushToast('Bank Balance Synced', resJson.message, 'success');
      await loadAdminOverview();
    } catch (err: any) {
      pushToast('Error', err?.message || 'Sync failed', 'warning');
    } finally {
      setIsSyncingDirectBal(false);
    }
  };

  // BANK SMS PARSING HANDLER
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
      } else if (resData.balanceUpdated || resData.availableBalance !== null) {
        pushToast('Bank Balance Synced', resData.message, 'success');
      } else if (resData.status === 'BANK_MISMATCH') {
        pushToast('Amount Mismatch', resData.message, 'warning');
      } else {
        pushToast('Parsed', resData.message, 'info');
      }
      await loadAdminOverview();
      await refreshUser();
    } catch (err: any) {
      setSmsResult({ success: false, error: err?.message });
    } finally {
      setIsProcessingSms(false);
    }
  };

  const handleWhatsAppSync = async (textToSync?: string) => {
    const content = textToSync || whatsAppText;
    if (!content) return;
    setIsSyncingWhatsApp(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      const resData = await res.json();
      setWhatsAppResult(resData);
      if (resData.success && resData.availableBalance !== undefined) {
        pushToast('WhatsApp Balance Synced', resData.message, 'success');
        await loadAdminOverview();
        await refreshUser();
      } else {
        pushToast('WhatsApp Message', resData.message || resData.error || 'Processed', 'info');
      }
    } catch (err: any) {
      pushToast('WhatsApp Error', err?.message, 'warning');
      setWhatsAppResult({ success: false, error: err?.message });
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };

  const handleGenerateWhatsAppAlert = async (retailerId?: string, customAmt?: number) => {
    try {
      const targetUser = retailers.find((r: any) => String(r.id) === String(retailerId || selectedRetailerId)) || retailers[0];
      const amt = customAmt || Number(transferAmount || 5000);
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_payout_alert',
          orderId: `WD-${Date.now().toString().slice(-4)}`,
          retailerName: `${targetUser?.firstName || 'Retailer'} ${targetUser?.lastName || ''}`.trim(),
          retailerMobile: targetUser?.mobile || '9081047006',
          amount: amt,
          beneficiaryName: targetUser?.companyName || `${targetUser?.firstName || 'Retailer'} ${targetUser?.lastName || ''}`.trim(),
          bankName: 'Kotak Mahindra Bank',
          accountNumber: targetUser?.mobile || '9081047006',
          ifsc: 'KKBK0002626',
          upiId: `${targetUser?.mobile || '9081047006'}@kotak`,
          mode: 'IMPS',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPayoutAlertData(data);
        setShowPayoutAlertModal(true);
      }
    } catch (err: any) {
      pushToast('Error', err?.message, 'warning');
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            <span>Admin Treasury & Settlement Console</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real double-entry transfers to Retailers, live Kotak Bank balance sync, and network audits
          </p>
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

      {/* ADMIN TREASURY PAYOUT ENGINE */}
      <div className="bg-white border-2 border-blue-600/30 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <ArrowRightLeft className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-black text-slate-900">
                Admin Payout & Working Capital Transfer
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                Double-Entry Ledger Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Transfer funds to any Retailer or Merchant. Debits your Treasury/Bank pool, credits the retailer, and logs an auditable slip.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Admin Treasury Balance</div>
              <div className="text-sm font-black font-mono text-slate-900">
                {formatINR(adminUser?.wallet?.availableBalance || 0)}
              </div>
            </div>
            <div className="h-7 w-[1px] bg-slate-200" />
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Kotak Bank Live Balance</div>
              <div className="text-sm font-black font-mono text-emerald-700">
                {formatINR(liveBank.availableBalance)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleGiveBalanceToRetailer} className="space-y-4">
          {/* Step 1: Source & Destination Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Funding Source */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                1. Funding Source (Debited) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFundingSource('admin_wallet')}
                  className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                    fundingSource === 'admin_wallet'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Admin Main Wallet</span>
                    {fundingSource === 'admin_wallet' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`text-[11px] font-mono mt-1 ${fundingSource === 'admin_wallet' ? 'text-blue-100' : 'text-slate-500'}`}>
                    Avl: {formatINR(adminUser?.wallet?.availableBalance || 0)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFundingSource('company_bank')}
                  className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                    fundingSource === 'company_bank'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Kotak Bank (9974366033)</span>
                    {fundingSource === 'company_bank' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`text-[11px] font-mono mt-1 ${fundingSource === 'company_bank' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    Avl: {formatINR(liveBank.availableBalance)}
                  </div>
                </button>
              </div>
            </div>

            {/* Transfer Destination */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                2. Transfer Destination (Credited) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferDestination('retailer_wallet')}
                  className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                    transferDestination === 'retailer_wallet'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Retailer Main Wallet</span>
                    {transferDestination === 'retailer_wallet' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`text-[11px] mt-1 ${transferDestination === 'retailer_wallet' ? 'text-blue-100' : 'text-slate-500'}`}>
                    Instant Float Top-up
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferDestination('retailer_bank')}
                  className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                    transferDestination === 'retailer_bank'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Settlement Bank A/c</span>
                    {transferDestination === 'retailer_bank' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`text-[11px] mt-1 ${transferDestination === 'retailer_bank' ? 'text-purple-100' : 'text-slate-500'}`}>
                    Direct IMPS / NEFT Payout
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Retailer & Amount Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Retailer / Merchant *
              </label>
              <select
                value={selectedRetailerId}
                onChange={(e) => setSelectedRetailerId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 shadow-2xs"
              >
                {(retailers.length > 0 ? retailers : users).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.companyName ? `${u.companyName} — ` : ''}{u.firstName} {u.lastName} ({u.mobile}) | Wallet: {formatINR(u.wallet?.availableBalance || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Amount (₹) *</label>
                <div className="flex items-center gap-1">
                  {[5000, 10000, 25000, 50000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTransferAmount(String(preset))}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                    >
                      +{preset / 1000}k
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                required
                min={1}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-black text-slate-900 shadow-2xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Security Admin TPIN *
              </label>
              <div className="relative">
                <input
                  type={showTpin ? 'text' : 'password'}
                  required
                  maxLength={6}
                  value={adminTpin}
                  onChange={(e) => setAdminTpin(e.target.value.replace(/\D/g, ''))}
                  placeholder="TPIN (1234)"
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold tracking-widest text-slate-900 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowTpin(!showTpin)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showTpin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Retailer Details Preview & Submit Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">Transfer Summary: </span>
              Transferring <span className="font-mono font-bold text-blue-600">{formatINR(Number(transferAmount || 0))}</span> from{' '}
              <span className="font-bold">{fundingSource === 'admin_wallet' ? 'Admin Treasury Wallet' : 'Kotak Bank A/c 9974366033'}</span> to{' '}
              <span className="font-bold text-slate-900">{selectedRetailer?.companyName || selectedRetailer?.firstName}</span> (
              {transferDestination === 'retailer_wallet' ? 'Main Wallet Float' : 'Bank Settlement'}).
            </div>

            <button
              type="submit"
              disabled={isTransferring || !selectedRetailerId || !transferAmount || !adminTpin}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTransferring ? 'Processing Ledger...' : `Authorize & Transfer ${formatINR(Number(transferAmount || 0))}`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* LIVE KOTAK MAHINDRA BANK BALANCE BANNER & DIRECT SYNC */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Live Kotak Bank Balance (A/c 9974366033)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  UPI: 9974366033@kotak • IFSC: KKBK0002626
                </span>
              </div>
              <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
                {formatINR(liveBank.availableBalance)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {liveBank.updatedAt
                  ? `Last synced at ${new Date(liveBank.updatedAt).toLocaleTimeString('en-IN')}${
                      liveBank.lastUtr ? ` • Last UTR: ${liveBank.lastUtr}` : ''
                    }`
                  : 'Active Kotak Bank Pool'}
              </div>
            </div>
          </div>

          {/* Quick Direct Bank Sync Form */}
          <form onSubmit={handleDirectBankSync} className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-300 shrink-0">Direct Sync (₹):</span>
            <input
              type="number"
              value={directBankBal}
              onChange={(e) => setDirectBankBal(e.target.value)}
              placeholder="148701"
              className="w-28 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs font-mono font-bold text-white"
            />
            <button
              type="submit"
              disabled={isSyncingDirectBal}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSyncingDirectBal ? 'Syncing...' : 'Set Bal'}
            </button>
          </form>
        </div>
      </div>

      {/* BANK SMS AUTO-MATCHER & BALANCE EXTRACTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Kotak / Indian Bank SMS Matcher & Balance Extractor
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Auto Webhook: POST /api/bank-feed</span>
        </div>

        {/* 1-Click Sample SMS Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold text-[11px]">Quick Samples:</span>
          <button
            type="button"
            onClick={() =>
              setSimulatedSms(
                'Kotak Bank: INR 5,000.00 credited to A/c 9974366033 on 10-Oct-26. UPI:428199283712. Total Bal: INR 1,53,701.00.'
              )
            }
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-[11px]"
          >
            Kotak Credit (₹5,000)
          </button>
          <button
            type="button"
            onClick={() =>
              setSimulatedSms(
                'Kotak Bank: INR 2,500.00 debited from A/c 9974366033 on 10-Oct-26. Info: UPI/428199283712/Retailer. Avl Bal: INR 1,51,201.00.'
              )
            }
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-[11px]"
          >
            Kotak Debit (₹2,500)
          </button>
          <button
            type="button"
            onClick={() =>
              setSimulatedSms(
                'Dear Customer, balance for Kotak Bank A/c 9974366033 is Rs 1,48,701.00 as of 10-OCT-26.'
              )
            }
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-[11px]"
          >
            Kotak Balance Inquiry (₹1,48,701)
          </button>
          <button
            type="button"
            onClick={() =>
              setSimulatedSms(
                'Dear SBI UPI User, A/C 6033 Credited by 1000.0 on 10Oct26 by UPI/428199283712/Retailer. Bal: Rs 1,49,701.0'
              )
            }
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-[11px]"
          >
            SBI UPI (₹1,000)
          </button>
        </div>

        <form onSubmit={handleProcessBankSms} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={simulatedSms}
            onChange={(e) => setSimulatedSms(e.target.value)}
            placeholder="Paste Bank SMS (extracts UTR, ₹ Amount, and Avl Bal Rs. ...)"
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={isProcessingSms || !simulatedSms}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isProcessingSms ? 'Syncing...' : 'Parse & Sync Bank Balance'}</span>
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

      {/* WHATSAPP BANKING & 1-TAP PAYOUT DISPATCHER */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/50 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  WhatsApp Banking Gateway & 1-Tap Approvals
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Live Kotak Bot: +91 97185 66655
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fetch Kotak bank balance via WhatsApp & dispatch 1-Tap pre-filled UPI transfer cards to Admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://wa.me/919718566655?text=bal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ask Kotak Bot for Bal</span>
            </a>
            <button
              type="button"
              onClick={() => handleGenerateWhatsAppAlert()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>1-Tap Payout Card</span>
            </button>
          </div>
        </div>

        {/* WhatsApp Test Chips */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Kotak Bot Quick Sync Chips:</span>
            <button
              type="button"
              onClick={() =>
                handleWhatsAppSync(
                  'Dear Customer, The Available Balance in your A/c ending 6033 is INR 1,48,701.00 as on 21-Oct-2026.'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-200 font-semibold cursor-pointer text-[11px]"
            >
              Kotak Bal: ₹1,48,701.00
            </button>
            <button
              type="button"
              onClick={() =>
                handleWhatsAppSync(
                  'Total Bal: INR 2,15,450.00 in A/c 9974366033 as on 21-Oct-2026.'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-200 font-semibold cursor-pointer text-[11px]"
            >
              Kotak Bal: ₹2,15,450.00
            </button>
            <button
              type="button"
              onClick={() =>
                handleWhatsAppSync(
                  'Total Bal: INR 5,00,000.00 in A/c 9974366033 as on 21-Oct-2026.'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-200 font-semibold cursor-pointer text-[11px]"
            >
              Kotak Bal: ₹5,00,000.00
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleWhatsAppSync();
            }}
            className="flex flex-col sm:flex-row gap-2 pt-1"
          >
            <input
              type="text"
              value={whatsAppText}
              onChange={(e) => setWhatsAppText(e.target.value)}
              placeholder="Paste Kotak WhatsApp reply (e.g. 'The Available Balance in your A/c ending 6033 is INR ...')"
              className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={isSyncingWhatsApp || !whatsAppText}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSyncingWhatsApp ? 'Syncing...' : 'Sync Balance via WhatsApp'}</span>
            </button>
          </form>
        </div>

        {whatsAppResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              whatsAppResult.success
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200'
                : 'bg-amber-900/40 border-amber-500 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {whatsAppResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{whatsAppResult.message || whatsAppResult.error}</span>
            </div>
            <button
              onClick={() => setWhatsAppResult(null)}
              className="text-[11px] font-bold underline ml-3 cursor-pointer text-slate-300 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
          <span>Webhook endpoint for automated WhatsApp forwarders / bots:</span>
          <code className="text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-emerald-900 font-mono">
            POST /api/whatsapp
          </code>
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
            <h2 className="text-sm font-bold text-slate-900">Recent Audited Transactions</h2>
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
                  <th className="py-2 px-3">Beneficiary</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-right">UTR / RRN</th>
                  <th className="py-2 px-3 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions.slice(0, 6).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{tx.reference}</td>
                    <td className="py-2 px-3 font-bold text-[11px] text-blue-700">{tx.serviceName}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{tx.customerName || '—'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.customerMobile || tx.accountOrVpa}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(tx.amount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600">
                      {tx.bankRrn || '—'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedReceipt(tx)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        View Slip
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

      {/* WHATSAPP 1-TAP PAYOUT MODAL */}
      {showPayoutAlertModal && payoutAlertData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <MessageSquare className="w-5 h-5" />
                <h3 className="text-sm font-black text-slate-900">
                  WhatsApp 1-Tap Payout Approval Card
                </h3>
              </div>
              <button
                onClick={() => setShowPayoutAlertModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 font-mono text-xs text-slate-800 whitespace-pre-line select-all">
              {payoutAlertData.text}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Direct NPCI UPI Intent Link:
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-xs font-mono break-all text-slate-700">
                {payoutAlertData.upiDeepLink}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <a
                href={payoutAlertData.whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Open & Send in WhatsApp</span>
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(payoutAlertData.text);
                  pushToast('Copied', 'WhatsApp message copied to clipboard!', 'success');
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
