'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { UtrReviewModal } from '@/components/admin/UtrReviewModal';
import { formatINR, formatDateTime } from '@/lib/format';
import {
  ArrowUpDown,
  Eye,
  Smartphone,
  Send,
  Building2,
} from 'lucide-react';

export default function AdminPaymentsTreasuryPage() {
  const { refreshUser, pushToast } = useApp();
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [companyBanks, setCompanyBanks] = useState<any[]>([]);
  const [liveBankBalance, setLiveBankBalance] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [simulatedSms, setSimulatedSms] = useState('');
  const [isProcessingSms, setIsProcessingSms] = useState(false);

  const [adjustForm, setAdjustForm] = useState({
    targetUserId: '',
    bucket: 'main',
    direction: 'credit',
    amount: '',
    remarks: 'Wallet Adjustment',
  });

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setFundRequests(data.fundRequests || []);
      setCompanyBanks(data.companyBanks || []);
      setLiveBankBalance(data.liveBankBalance || null);
      setUsers(data.users || []);
      if (!adjustForm.targetUserId && data.users?.length > 0) {
        const defaultRetailer =
          data.users.find((u: any) => u.mobile === '9081047006') || data.users[0];
        setAdjustForm((prev) => ({ ...prev, targetUserId: String(defaultRetailer.id) }));
      }
    } catch {
      pushToast('Error', 'Failed to load data', 'warning');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBankSmsPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedSms) return;
    setIsProcessingSms(true);
    try {
      const res = await fetch('/api/bank-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_sms: simulatedSms }),
      });
      const data = await res.json();
      if (data.autoApproved) {
        pushToast('Auto-Approved', data.message, 'success');
      } else if (data.balanceUpdated || data.availableBalance !== null) {
        pushToast('Balance Synced', data.message || 'Live bank balance updated', 'success');
      } else {
        pushToast('Parsed', data.message || 'Processed', 'info');
      }
      setSimulatedSms('');
      await loadData();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    } finally {
      setIsProcessingSms(false);
    }
  };

  const handleDirectWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.targetUserId || !adjustForm.amount) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_wallet',
          userId: Number(adjustForm.targetUserId),
          bucket: adjustForm.bucket,
          direction: adjustForm.direction,
          amount: Number(adjustForm.amount),
          remarks: adjustForm.remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');
      pushToast(
        'Wallet Updated',
        `${adjustForm.direction.toUpperCase()} of ${formatINR(Number(adjustForm.amount))} completed.`,
        'success'
      );
      setAdjustForm({ ...adjustForm, amount: '' });
      await loadData();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">Fund Requests & Wallet Adjustments</h1>
          <p className="text-xs text-slate-500">Verify merchant UTRs, sync live Kotak Bank balance, and manage wallets</p>
        </div>
        {liveBankBalance?.availableBalance !== null && liveBankBalance?.availableBalance !== undefined && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
            <div className="text-[10px] font-bold uppercase text-emerald-700">
              Kotak A/c 9974366033 Live Avl Bal
            </div>
            <div className="text-base font-black font-mono text-emerald-900">
              {formatINR(liveBankBalance.availableBalance)}
            </div>
          </div>
        )}
      </div>

      {/* Bank SMS Matcher Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
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
            Kotak Bal Inquiry (₹1,48,701)
          </button>
        </div>

        <form
          onSubmit={handleBankSmsPaste}
          className="flex flex-col sm:flex-row items-center gap-2.5"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Kotak SMS Matcher:</span>
          </div>
          <input
            type="text"
            value={simulatedSms}
            onChange={(e) => setSimulatedSms(e.target.value)}
            placeholder="Paste Kotak SMS to auto-match UTR & extract Avl Bal Rs. ..."
            className="flex-1 w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
          />
          <button
            type="submit"
            disabled={isProcessingSms || !simulatedSms}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isProcessingSms ? 'Syncing...' : 'Match UTR & Sync Balance'}</span>
          </button>
        </form>
      </div>

      {/* Fund Requests Queue */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Fund Requests ({fundRequests.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-2.5 px-4">Merchant</th>
                <th className="py-2.5 px-4">Bank</th>
                <th className="py-2.5 px-4">Mode & UTR</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {fundRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-900">
                      {req.userCompanyName || req.userName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {req.userMobile} • {formatDateTime(req.createdAt)}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-800">{req.companyBankName}</div>
                    <div className="text-[11px] font-mono text-slate-400">{req.companyBankAccount}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] mr-1.5">
                      {req.transferMode}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{req.paymentReference}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900">
                    {formatINR(req.amount)}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        req.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : req.status === 'mismatch'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Bank Pool */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Active Bank Pool</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {companyBanks.map((b) => (
            <div key={b.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-extrabold text-slate-900">{b.bankName}</div>
              <div className="text-[11px] font-mono text-slate-600">
                A/c: {b.accountNumber} • IFSC: {b.ifsc}
              </div>
              {b.upiId && <div className="text-[11px] font-mono text-blue-600 font-semibold">UPI: {b.upiId}</div>}
              {liveBankBalance?.availableBalance !== null &&
                liveBankBalance?.availableBalance !== undefined &&
                b.accountNumber === '9974366033' && (
                  <div className="pt-1.5 mt-1.5 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Live SMS Avl Bal:</span>
                    <span className="font-mono font-black text-emerald-600">
                      {formatINR(liveBankBalance.availableBalance)}
                    </span>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* Direct Wallet Adjustment (Main & Commission Only) */}
      <form
        onSubmit={handleDirectWalletAdjust}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Direct Wallet Adjustment</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Merchant</label>
            <select
              value={adjustForm.targetUserId}
              onChange={(e) => setAdjustForm({ ...adjustForm, targetUserId: e.target.value })}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.companyName || `${u.firstName} ${u.lastName}`} ({u.mobile}) —{' '}
                  {formatINR(u.wallet?.availableBalance || 0)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Wallet</label>
            <select
              value={adjustForm.bucket}
              onChange={(e) => setAdjustForm({ ...adjustForm, bucket: e.target.value })}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="main">Main Wallet</option>
              <option value="commission">Commission Wallet</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Type</label>
            <select
              value={adjustForm.direction}
              onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="credit">CREDIT (+)</option>
              <option value="debit">DEBIT (-)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              min={1}
              required
              value={adjustForm.amount}
              onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
              placeholder="5000"
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            value={adjustForm.remarks}
            onChange={(e) => setAdjustForm({ ...adjustForm, remarks: e.target.value })}
            placeholder="Reason"
            className="w-full sm:w-80 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Update Balance
          </button>
        </div>
      </form>

      <UtrReviewModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onActionSuccess={() => {
          loadData();
          refreshUser();
          pushToast('Saved', 'Fund request and wallet updated.', 'success');
        }}
      />
    </div>
  );
}
