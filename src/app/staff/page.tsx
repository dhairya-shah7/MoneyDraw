'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';
import { Sparkles } from 'lucide-react';

export default function StaffOperationsDeskPage() {
  const { pushToast, refreshUser } = useApp();
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [onboardingApps, setOnboardingApps] = useState<any[]>([]);

  const loadQueues = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setFundRequests(data.fundRequests || []);
      setOnboardingApps(data.onboardingApps || []);
    } catch {
      pushToast('Error', 'Failed to load staff operations queues', 'warning');
    }
  };

  useEffect(() => {
    loadQueues();
  }, []);

  const handleApproveFund = async (id: number, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_fund_request',
          id,
          decision,
          reviewNote: 'Verified by Staff Compliance Desk',
        }),
      });
      if (!res.ok) throw new Error('Failed to process fund request');
      pushToast('Fund Request Processed', `Fund request #${id} ${decision.toUpperCase()}!`, 'success');
      await loadQueues();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  const handleApproveKyc = async (id: number, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_onboarding',
          id,
          decision,
        }),
      });
      if (!res.ok) throw new Error('Failed to process KYC');
      pushToast('KYC Processed', `KYC Application #${id} ${decision.toUpperCase()}!`, 'success');
      await loadQueues();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Operations & KYC Verification Desk
        </span>
        <h1 className="text-xl font-extrabold text-slate-900 mt-1">
          Staff Operations Queue (UTR Verification & Merchant eKYC)
        </h1>
        <p className="text-xs text-slate-500">
          Review OCR-parsed bank deposit slips and merchant KYC onboarding applications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fund Requests */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Fund Deposit Tickets ({fundRequests.filter((f) => f.status === 'pending').length} Pending)
          </h2>
          <div className="space-y-3">
            {fundRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {req.userName || req.requesterName} • {formatINR(req.amount)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    UTR: {req.paymentReference} ({req.transferMode})
                  </div>
                  {req.ocrExtractedUtr && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-0.5">
                      <Sparkles className="w-3 h-3" /> OCR Verified
                    </span>
                  )}
                </div>
                {req.status === 'pending' ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleApproveFund(req.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproveFund(req.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold uppercase text-emerald-700">{req.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding KYC Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Merchant eKYC Queue ({onboardingApps.filter((a) => a.status === 'pending').length} Pending)
          </h2>
          <div className="space-y-3">
            {onboardingApps.map((app) => (
              <div
                key={app.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {app.applicantName} ({app.companyName})
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Mobile: {app.mobile} • PAN: {app.panNumber}
                  </div>
                </div>
                {app.status === 'pending' ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleApproveKyc(app.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve KYC
                    </button>
                    <button
                      onClick={() => handleApproveKyc(app.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold uppercase text-emerald-700">{app.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
