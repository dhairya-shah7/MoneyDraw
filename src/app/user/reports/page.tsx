'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { ReceiptModal, PrintableTransaction } from '@/components/shared/ReceiptModal';
import { formatINR, formatDateTime } from '@/lib/format';
import {
  Search,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'upi_cash', label: 'UPI Cash QR' },
  { id: 'payout', label: 'Bank Payout' },
  { id: 'recharge', label: 'Recharge' },
  { id: 'billpay', label: 'Utility Bills' },
  { id: 'cms', label: 'CMS Drop' },
];

export default function ReportsPage() {
  const { user, pushToast } = useApp();
  const [activeTab, setActiveTab] = useState<'transactions' | 'ledger'>('transactions');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PrintableTransaction | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mobile: user.mobile,
        category,
        status: statusFilter,
        search: searchQuery,
      });
      const [txRes, walRes] = await Promise.all([
        fetch(`/api/transactions?${params.toString()}`),
        fetch(`/api/wallet?mobile=${encodeURIComponent(user.mobile)}`),
      ]);
      const txData = await txRes.json();
      const walData = await walRes.json();
      setTransactions(txData.transactions || []);
      setLedgerEntries(walData.ledger || []);
    } catch {
      pushToast('Error', 'Failed to load transaction and ledger reports', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.mobile, category, statusFilter]);

  const exportCSV = () => {
    if (activeTab === 'transactions') {
      const headers = ['Reference', 'Date', 'Service', 'Operator', 'Customer', 'Amount', 'Commission', 'TDS', 'Surcharge', 'Net', 'Status', 'Bank RRN'];
      const rows = transactions.map((t) => [
        t.reference,
        new Date(t.createdAt).toISOString(),
        t.serviceName,
        t.operatorName,
        t.customerMobile || t.customerName || '-',
        t.amount,
        t.commission,
        t.tds,
        t.surcharge,
        t.totalDebit,
        t.status,
        t.bankRrn || '-',
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoneyDraw_Transactions_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      pushToast('CSV Exported', 'Transaction statement downloaded.', 'success');
    } else {
      const headers = ['ID', 'Date', 'Bucket', 'Direction', 'Type', 'Amount', 'Opening Balance', 'Closing Balance', 'Remarks'];
      const rows = ledgerEntries.map((l) => [
        l.transactionRef,
        new Date(l.createdAt).toISOString(),
        l.bucket,
        l.direction,
        l.entryType,
        l.amount,
        l.openingBalance,
        l.closingBalance,
        `"${(l.remarks || '').replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoneyDraw_Ledger_Passbook_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      pushToast('Passbook Exported', 'Double-Entry Ledger CSV downloaded.', 'success');
    }
  };

  const totalVolume = transactions
    .filter((t) => t.status === 'success')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalComm = transactions
    .filter((t) => t.status === 'success')
    .reduce((acc, t) => acc + t.commission, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900">Reports & Ledger</h1>
          <p className="text-xs text-slate-500">Transaction history, receipts, and wallet passbook</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ledger ({ledgerEntries.length})
            </button>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Settled Volume</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{formatINR(totalVolume)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Commission Earned</div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">+{formatINR(totalComm)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Main Wallet Balance</div>
          <div className="text-2xl font-extrabold text-blue-600 font-mono mt-1">
            {formatINR(user?.wallet?.availableBalance || 0)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                category === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              placeholder="Search Reference ID, Bank RRN, Customer Mobile, Beneficiary Name..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success Only</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed / Reversed</option>
          </select>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Table Content */}
      {activeTab === 'transactions' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3.5 px-4">Ref / Date</th>
                  <th className="py-3.5 px-4">Service & Operator</th>
                  <th className="py-3.5 px-4">Customer / Account</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Comm / Surcharge</th>
                  <th className="py-3.5 px-4 text-right">Net Impact</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading transaction records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No transactions match your current filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{tx.reference}</div>
                        <div className="text-[11px] text-slate-400">{formatDateTime(tx.createdAt)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {tx.serviceName}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {tx.operatorName} • RRN: {tx.bankRrn || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{tx.customerName || 'Walk-in Customer'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {tx.customerMobile || '-'} {tx.accountOrVpa ? `• ${tx.accountOrVpa}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {tx.commission > 0 && (
                          <div className="text-emerald-600 font-semibold">+{formatINR(tx.commission)}</div>
                        )}
                        {tx.surcharge > 0 && (
                          <div className="text-amber-600 font-semibold">-{formatINR(tx.surcharge)} Fee</div>
                        )}
                        {tx.tds > 0 && (
                          <div className="text-[10px] text-slate-400">TDS: {formatINR(tx.tds)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {formatINR(tx.totalDebit)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            tx.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {tx.status === 'success' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : tx.status === 'pending' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedReceipt(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3.5 px-4">Entry Ref / Timestamp</th>
                  <th className="py-3.5 px-4">Bucket</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Opening Bal</th>
                  <th className="py-3.5 px-4 text-right">Delta Amount</th>
                  <th className="py-3.5 px-4 text-right">Closing Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">{entry.transactionRef}</div>
                      <div className="text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                        {entry.bucket}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          entry.direction === 'credit'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {entry.direction === 'credit' ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {entry.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md">{entry.remarks}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatINR(entry.openingBalance)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {entry.direction === 'credit' ? '+' : '-'}
                      {formatINR(entry.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(entry.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReceiptModal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        transaction={selectedReceipt}
      />
    </div>
  );
}
