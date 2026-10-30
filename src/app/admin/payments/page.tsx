'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { UtrReviewModal } from '@/components/admin/UtrReviewModal';
import { formatINR, formatDateTime } from '@/lib/format';
import {
  ArrowUpDown,
  Eye,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';

export default function AdminPaymentsTreasuryPage() {
  const { refreshUser, pushToast } = useApp();
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [companyBanks, setCompanyBanks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

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

  const handleQuickDecision = async (id: number, decision: 'approved' | 'rejected', amount: number) => {
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_fund_request',
          id,
          decision,
          receivedAmount: amount,
          adminNote: `1-Click ${decision.toUpperCase()} from Admin Console`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update request');
      pushToast(
        decision === 'approved' ? 'Request Approved' : 'Request Rejected',
        decision === 'approved'
          ? `Successfully credited ${formatINR(amount)} to retailer Main Wallet.`
          : 'Fund request has been marked as rejected.',
        decision === 'approved' ? 'success' : 'info'
      );
      await loadData();
      await refreshUser();
    } catch (err: any) {
      pushToast('Action Failed', err.message || 'Error updating request', 'warning');
    } finally {
      setActionLoadingId(null);
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
          <p className="text-xs text-slate-500">Approve or reject retailer deposit requests & manage main wallet balances</p>
        </div>
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
                <th className="py-2.5 px-4 text-center">Action</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {fundRequests.map((req) => {
                const isPending = req.status === 'pending' || req.status === 'mismatch';
                const isLoading = actionLoadingId === req.id;

                return (
                  <tr key={req.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {req.userCompanyName || req.userName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {req.userMobile} • {formatDateTime(req.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{req.companyBankName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{req.companyBankAccount}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] mr-1.5">
                        {req.transferMode}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{req.paymentReference}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      {formatINR(req.amount)}
                    </td>

                    {/* Action Column with Approve / Reject Options */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleQuickDecision(req.id, 'approved', Number(req.amount))}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs disabled:opacity-50"
                              title="Approve request and credit retailer wallet"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isLoading ? '...' : 'Approve'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleQuickDecision(req.id, 'rejected', Number(req.amount))}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                              title="Reject request"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(req)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                              title="Review details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status Column on the right side */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : req.status === 'mismatch'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
              <option value="main">Main Wallet (Float)</option>
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
