'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle2, XCircle, Send, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { formatINR, formatDateTime } from '@/lib/format';

export default function NeedCashPage() {
  const { user, refreshUser, pushToast } = useApp();
  const [data, setData] = useState<any>(null);
  const [targetMobile, setTargetMobile] = useState('');
  const [foundPeer, setFoundPeer] = useState<any>(null);
  const [amount, setAmount] = useState('5000');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const mobile = user?.mobile;
    if (!mobile) return;
    const res = await fetch(`/api/wallet?mobile=${encodeURIComponent(mobile)}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (!targetMobile && json.otherUsers?.length > 0) {
        setTargetMobile(json.otherUsers[0].mobile);
        setFoundPeer(json.otherUsers[0]);
      }
    }
  }, [user?.mobile, targetMobile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLookupPeer = async () => {
    const res = await fetch(`/api/wallet?lookupMobile=${encodeURIComponent(targetMobile)}`);
    const json = await res.json();
    if (!res.ok) {
      pushToast('User Not Found', json.error, 'warning');
      setFoundPeer(null);
      return;
    }
    setFoundPeer(json.targetUser);
  };

  const handleDirectPayUser = async () => {
    const numAmt = Number(amount || 0);
    if (!targetMobile.trim() || numAmt <= 0) {
      pushToast('Missing Details', 'Select a recipient user and enter an amount > ₹0', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'direct_user_pay',
          mobile: user?.mobile,
          targetMobile: targetMobile.trim(),
          amount: numAmt,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');
      pushToast('Paid Successfully!', json.message, 'success');
      setNote('');
      await refreshUser();
      await loadData();
    } catch (err: unknown) {
      pushToast('Payment Failed', err instanceof Error ? err.message : 'Error', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_cash_request',
          mobile: user?.mobile,
          targetMobile,
          amount: Number(amount),
          walletTarget: 'main',
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      pushToast('Request Sent', `Sent to ${targetMobile} for ${formatINR(amount)}`, 'success');
      await loadData();
    } catch (err: unknown) {
      pushToast('Error', err instanceof Error ? err.message : 'Error', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveIncoming = async (requestId: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_cash_request',
          mobile: user?.mobile,
          requestId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      pushToast('Approved', 'Balance transferred from Main Wallet.', 'success');
      await refreshUser();
      await loadData();
    } catch (err: unknown) {
      pushToast('Error', err instanceof Error ? err.message : 'Error', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectIncoming = async (requestId: number) => {
    await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject_cash_request',
        mobile: user?.mobile,
        requestId,
      }),
    });
    pushToast('Declined', 'Request rejected.', 'info');
    await loadData();
  };

  const otherUsers = data?.otherUsers || [];
  const p2pTransactions = (data?.transactions || []).filter((t: any) => t.ifsc === 'WALLET-P2P');

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-slate-900">P2P User Wallet Transfer</h1>
            <p className="text-xs text-slate-500">
              Directly pay another user from your Main Wallet ({formatINR(user?.wallet?.availableBalance || 0)}) or request balance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Pay / Request User */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Pay or Request Another User</span>
            </h2>

            {otherUsers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Registered User</label>
                <select
                  value={targetMobile}
                  onChange={(e) => {
                    setTargetMobile(e.target.value);
                    const match = otherUsers.find((u: any) => u.mobile === e.target.value);
                    if (match) setFoundPeer(match);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 text-slate-900"
                >
                  {otherUsers.map((u: any) => (
                    <option key={u.id} value={u.mobile}>
                      {u.name} ({u.mobile} • {u.roleName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Or Enter Mobile / Email</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetMobile}
                  onChange={(e) => setTargetMobile(e.target.value)}
                  placeholder="Mobile or Email"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
                <button
                  onClick={handleLookupPeer}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" /> Lookup
                </button>
              </div>
            </div>

            {foundPeer && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                <div className="font-black text-slate-900">{foundPeer.name}</div>
                <div className="text-slate-600">
                  {foundPeer.companyName} · <span className="font-bold text-blue-700">{foundPeer.roleName}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-black"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleDirectPayUser}
                disabled={loading}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Pay Now (Main Wallet)
              </button>
              <button
                onClick={handleSendRequest}
                disabled={loading}
                className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Request Balance
              </button>
            </div>
          </div>

          {/* Right: Incoming Requests & Recent User Transfers */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
              <h2 className="text-sm font-black text-slate-900">Incoming Payment Requests</h2>

              {(data?.incomingCash || []).length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">No incoming requests.</div>
              ) : (
                <div className="space-y-2.5">
                  {(data?.incomingCash || []).map((req: any) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{req.requesterName}</span>
                          <span className="font-mono text-xs text-slate-500">({req.requesterMobile})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {req.reference} · {formatDateTime(req.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-base font-black text-slate-900">{formatINR(req.amount)}</div>
                        {req.status === 'pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleApproveIncoming(req.id)}
                              disabled={loading}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Pay
                            </button>
                            <button
                              onClick={() => handleRejectIncoming(req.id)}
                              className="px-2 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User-to-User Payment History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-black text-slate-900">User Transfer History</h2>
              {p2pTransactions.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">No user transfers yet.</div>
              ) : (
                <div className="space-y-2">
                  {p2pTransactions.map((tx: any) => (
                    <div
                      key={tx.id || tx.reference}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-black text-slate-900">
                          {tx.customerName} ({tx.accountOrVpa})
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {tx.reference} • {formatDateTime(tx.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900">{formatINR(tx.amount)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetMobile(tx.accountOrVpa);
                            setAmount(String(tx.amount));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Pay Again
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
