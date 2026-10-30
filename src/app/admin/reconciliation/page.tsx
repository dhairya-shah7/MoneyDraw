'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR, formatDateTime } from '@/lib/format';
import { CheckCircle2 } from 'lucide-react';

export default function AdminReconciliationPage() {
  const { pushToast } = useApp();
  const [reconSummary, setReconSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin');
        const data = await res.json();
        setReconSummary(
          (data.reconSummary || []).filter(
            (r: any) => !String(r.category || '').toUpperCase().includes('AEPS')
          )
        );
        setTransactions(data.transactions || []);
        if (data.transactions?.length > 0) {
          setSelectedTx(data.transactions[0]);
        }
      } catch {
        pushToast('Error', 'Failed to load reconciliation', 'warning');
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <h1 className="text-lg font-black text-slate-900">Reconciliation & Audit</h1>
        <p className="text-xs text-slate-500">Ledger and settlement summary</p>
      </div>

      {/* Category 3-Way Recon Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Category-Level 3-Way Settlement Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Internal Ledger</th>
                <th className="py-3 px-4 text-right">Provider Switch</th>
                <th className="py-3 px-4 text-right">Bank Settled</th>
                <th className="py-3 px-4 text-right">Ret. Comm</th>
                <th className="py-3 px-4 text-right">Dist. Override</th>
                <th className="py-3 px-4 text-right">Platform Net</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {reconSummary.map((item) => (
                <tr key={item.category} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{item.category}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatINR(item.internalLedgerVolume)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700">
                    {formatINR(item.providerReportedVolume)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatINR(item.bankSettledVolume)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600">
                    {formatINR(item.retailerCommPaid)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600">
                    {formatINR(item.distributorCommPaid)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    +{formatINR(item.platformNetMargin)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Transactions List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Transaction-Level Audit Log ({transactions.length})
          </h2>
          <span className="text-xs text-slate-500">Live Double-Entry Verification</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Ref ID / Time</th>
                <th className="py-3 px-4">Service & Operator</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Fee</th>
                <th className="py-3 px-4">Bank RRN / UTR</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {transactions.slice(0, 20).map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-slate-900">{r.reference}</div>
                    <div className="text-[11px] text-slate-400">{formatDateTime(r.createdAt)}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{r.serviceName}</div>
                    <div className="text-[11px] text-slate-500">{r.operatorName}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatINR(r.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                    ₹0.00
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {r.bankRrn || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
