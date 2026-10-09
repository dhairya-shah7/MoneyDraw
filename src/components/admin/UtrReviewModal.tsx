'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Copy, Check, Eye, Sparkles } from 'lucide-react';
import { formatINR, formatDateTime } from '@/lib/format';

interface UtrReviewModalProps {
  request: any | null;
  onClose: () => void;
  onActionSuccess: () => void;
}

export function UtrReviewModal({ request, onClose, onActionSuccess }: UtrReviewModalProps) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<string>(
    String(request?.receivedAmount ?? request?.amount ?? '')
  );
  const [reason, setReason] = useState<string>(request?.reviewNote || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!request) return null;

  const copyValue = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAction = async (decision: 'approved' | 'rejected' | 'mismatch') => {
    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_fund_request',
          id: request.id,
          decision,
          receivedAmount: Number(receivedAmount || request.amount),
          reviewNote: reason,
          disputeReason:
            decision === 'mismatch'
              ? reason || `Bank credited ₹${receivedAmount} against requested ₹${request.amount}`
              : '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      onActionSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to process review');
    } finally {
      setLoadingAction(false);
    }
  };

  let ocrData: any = null;
  try {
    if (request.ocrExtractedJson && request.ocrExtractedJson !== '{}') {
      ocrData = JSON.parse(request.ocrExtractedJson);
    }
  } catch {
    ocrData = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-extrabold text-slate-900">
              Review Payment & UTR (#{request.id})
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                request.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : request.status === 'mismatch'
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : request.status === 'rejected'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {request.status === 'mismatch' ? 'BANK_MISMATCH' : request.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Top Key Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Requested Amount</span>
              <span className="text-lg font-extrabold text-emerald-600 font-mono">
                {formatINR(request.amount)}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Target: {request.walletTarget} Wallet
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Submitted 12-Digit UTR</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {request.paymentReference || 'None'}
                </span>
                {request.paymentReference && (
                  <button
                    type="button"
                    onClick={() => copyValue('utr', request.paymentReference)}
                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    {copiedField === 'utr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              <span className="text-[10px] font-bold text-blue-600 uppercase">
                Mode: {request.transferMode}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Merchant / Depositor</span>
              <span className="text-sm font-bold text-slate-900 block truncate">
                {request.userCompanyName || request.userName}
              </span>
              <span className="text-[11px] font-mono text-slate-500">{request.userMobile}</span>
            </div>
          </div>

          {/* Dispute / Mismatch Alert */}
          {request.disputeReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Bank Amount Mismatch / Flagged Dispute</div>
                <div className="text-amber-800 mt-0.5">{request.disputeReason}</div>
              </div>
            </div>
          )}

          {/* Screenshot Proof Preview */}
          {request.screenshotUrl ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Uploaded Payment Screenshot Proof ({request.receiptName || 'Receipt'})</span>
              </span>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 max-h-64 overflow-hidden flex items-center justify-center">
                <img
                  src={request.screenshotUrl}
                  alt="Payment Proof"
                  className="max-h-56 object-contain rounded-lg border border-slate-200"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Receipt File:</span>{' '}
                {request.receiptName || 'Manual UTR Entry'}
              </div>
              {ocrData?.utr && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3 h-3" />
                  OCR Confidence: {ocrData.confidence || 96}%
                </span>
              )}
            </div>
          )}

          {/* Details Table */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 text-xs">
            <div className="p-3 flex justify-between">
              <span className="text-slate-500">Assigned Company Bank / UPI:</span>
              <span className="font-mono font-bold text-slate-800">
                {request.companyBankName} ({request.companyBankAccount})
              </span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-slate-500">Submitted Timestamp:</span>
              <span className="text-slate-700">{formatDateTime(request.createdAt)}</span>
            </div>
            {request.note && (
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">Merchant Note:</span>
                <span className="text-slate-800 font-medium">{request.note}</span>
              </div>
            )}
          </div>

          {/* Editable Actual Amount Received & Admin Remarks (MoneyPay pattern) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Actual Amount Received in Bank (₹)
              </label>
              <input
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-emerald-600 focus:outline-none focus:border-emerald-600"
              />
              <p className="text-[10px] text-slate-400">
                If user sent less/more than requested, edit this amount before clicking Approve.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Admin Verification Note / Mismatch Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Verified in HDFC Bank statement"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>

          {request.status !== 'approved' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAction('rejected')}
                disabled={loadingAction}
                className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('mismatch')}
                disabled={loadingAction}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/60 text-amber-800 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Mark Mismatch</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('approved')}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Credit {formatINR(Number(receivedAmount || request.amount))}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
