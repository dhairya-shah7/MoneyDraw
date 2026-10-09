'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';
import {
  QrCode,
  Smartphone,
  Building2,
  Plus,
  Trash2,
  Edit3,
  Copy,
  CheckCircle2,
  RefreshCw,
  Send,
  Zap,
} from 'lucide-react';

export default function AdminZeroApiSettingsPage() {
  const { pushToast, refreshUser } = useApp();
  const [companyBanks, setCompanyBanks] = useState<any[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [bankForm, setBankForm] = useState({
    id: undefined as number | undefined,
    label: 'Primary Kotak Bank & UPI',
    bankName: 'KKBK (Kotak Mahindra Bank)',
    accountHolderName: 'TEKCHANDJI CO',
    accountNumber: '9974366033',
    ifsc: 'KKBK0002626',
    upiId: '9974366033@kotak',
    dailyLimit: 500000,
    priority: 1,
    active: true,
  });
  const [savingBank, setSavingBank] = useState(false);

  const [payoutMode, setPayoutMode] = useState<'bank_to_bank' | 'upi' | 'bank_ifsc'>('upi');
  const [b2bRail, setB2bRail] = useState<'NEFT' | 'IFT' | 'IMPS' | 'RTGS'>('NEFT');
  const [beneficiaryName, setBeneficiaryName] = useState('TEKCHANDJI CO');
  const [payoutAmount, setPayoutAmount] = useState('20');
  const [beneficiaryUpi, setBeneficiaryUpi] = useState('9974366033@kotak');
  const [beneficiaryAcc, setBeneficiaryAcc] = useState('9974366033');
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState('KKBK0002626');
  const [b2bUtr, setB2bUtr] = useState('');
  const [recordingB2b, setRecordingB2b] = useState(false);
  const [lastB2bReceipt, setLastB2bReceipt] = useState<any | null>(null);
  const [includeAmountInQr, setIncludeAmountInQr] = useState(true);
  const [generatedPayoutQr, setGeneratedPayoutQr] = useState<any | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const [testFeedText, setTestFeedText] = useState(
    'Acct XX6033 credited with INR 25,000.00 on 08-Oct-26 via NEFT from TEKCHANDJI CO. UTR KKBKH26281992831.'
  );
  const [testingFeed, setTestingFeed] = useState(false);
  const [feedResult, setFeedResult] = useState<any | null>(null);

  const loadSettingsData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setCompanyBanks(data.companyBanks || []);
      const txns = data.transactions || [];
      setRecentPayouts(
        txns.filter((t: any) => t.category === 'payout' || t.serviceCode === 'PAYOUT').slice(0, 5)
      );
    } catch {
      pushToast('Error', 'Failed to load settings', 'warning');
    }
  };

  useEffect(() => {
    loadSettingsData();
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_payout_qr',
        beneficiaryName: 'TEKCHANDJI CO',
        amount: 20,
        upiId: '9974366033@kotak',
        includeAmount: true,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.qrDataUrl) setGeneratedPayoutQr(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prefix = (beneficiaryIfsc || '').trim().toUpperCase().slice(0, 4);
    if (!prefix) return;
    const hasSameBank = companyBanks.some(
      (b) => b.active && String(b.ifsc || '').toUpperCase().startsWith(prefix)
    );
    if (hasSameBank) {
      setB2bRail('IFT');
    } else if (Number(payoutAmount) >= 200000) {
      setB2bRail('RTGS');
    } else {
      setB2bRail('NEFT');
    }
  }, [beneficiaryIfsc, companyBanks, payoutAmount]);

  const copyField = (label: string, val: string) => {
    navigator.clipboard.writeText(val);
    pushToast(`Copied ${label}`, val, 'info');
  };

  const handleDownloadBulkBankCsv = (format: 'standard' | 'kotak' | 'bob') => {
    const rowsToExport = [
      {
        name: beneficiaryName || 'Tekchandji Co',
        acc: beneficiaryAcc || '9974366033',
        ifsc: (beneficiaryIfsc || 'KKBK0002626').toUpperCase(),
        amount: Number(payoutAmount || 20),
        rail: b2bRail,
        remark: 'MoneyDraw Settlement',
      },
      ...recentPayouts.map((tx: any) => ({
        name: tx.customerName || 'Beneficiary',
        acc: tx.accountOrVpa || '50100482910234',
        ifsc: (tx.ifsc || 'HDFC0001234').toUpperCase(),
        amount: Number(tx.amount || 1000),
        rail: 'NEFT',
        remark: `Settlement ${tx.reference}`,
      })),
    ];

    let csvContent = '';
    if (format === 'kotak') {
      csvContent =
        'Payment_Type,Beneficiary_Name,Beneficiary_Account_No,IFSC_Code,Amount,Narration\n' +
        rowsToExport
          .map((r) => `${r.ifsc.startsWith('KKBK') ? 'IFT' : r.rail},"${r.name}",${r.acc},${r.ifsc},${r.amount.toFixed(2)},"${r.remark}"`)
          .join('\n');
    } else if (format === 'bob') {
      csvContent =
        'Transaction_Mode,Beneficiary_Account,IFSC,Beneficiary_Name,Amount_INR,Remarks\n' +
        rowsToExport
          .map((r) => `${r.ifsc.startsWith('BARB') ? 'WITHIN_BANK' : r.rail},${r.acc},${r.ifsc},"${r.name}",${r.amount.toFixed(2)},"${r.remark}"`)
          .join('\n');
    } else {
      csvContent =
        'Transfer_Rail,Beneficiary_Name,Account_Number,IFSC_Code,Amount_INR,Fee_INR,Narration\n' +
        rowsToExport
          .map((r) => `${r.rail},"${r.name}",${r.acc},${r.ifsc},${r.amount.toFixed(2)},0.00,"${r.remark}"`)
          .join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MoneyDraw_${format.toUpperCase()}_Payout_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('CSV Downloaded', `Ready for ${format.toUpperCase()} NetBanking upload.`, 'success');
  };

  const handleRecordBankToBankPayout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRecordingB2b(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_bank_to_bank_payout',
          beneficiaryName,
          accountNumber: beneficiaryAcc,
          ifsc: beneficiaryIfsc,
          amount: Number(payoutAmount || 0),
          transferMode: b2bRail,
          bankUtr: b2bUtr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record transfer');
      setLastB2bReceipt(data.transaction);
      setB2bUtr('');
      pushToast('Transfer Recorded', data.message, 'success');
      await loadSettingsData();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    } finally {
      setRecordingB2b(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_company_bank',
          ...bankForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      pushToast('Saved', data.message, 'success');
      setEditingBank(null);
      await loadSettingsData();
      await refreshUser();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    } finally {
      setSavingBank(false);
    }
  };

  const handleToggleBank = async (b: any, resetVolume = false) => {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_company_bank',
          id: b.id,
          active: resetVolume ? b.active : !b.active,
          resetVolume,
        }),
      });
      await loadSettingsData();
    } catch {
      pushToast('Error', 'Failed to update bank', 'warning');
    }
  };

  const handleDeleteBank = async (id: number) => {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_company_bank', id }),
      });
      await loadSettingsData();
    } catch {
      pushToast('Error', 'Failed to delete', 'warning');
    }
  };

  const handleGeneratePayoutQr = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneratingQr(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_payout_qr',
          beneficiaryName,
          amount: Number(payoutAmount || 20),
          upiId: payoutMode === 'upi' ? beneficiaryUpi : '',
          accountNumber: payoutMode === 'bank_ifsc' ? beneficiaryAcc : '',
          ifsc: payoutMode === 'bank_ifsc' ? beneficiaryIfsc : '',
          includeAmount: includeAmountInQr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate QR');
      setGeneratedPayoutQr(data);
    } catch (err: any) {
      pushToast('QR Error', err.message, 'warning');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleTestNotificationFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testFeedText) return;
    setTestingFeed(true);
    setFeedResult(null);
    try {
      const res = await fetch('/api/bank-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_sms: testFeedText }),
      });
      const data = await res.json();
      setFeedResult(data);
      await refreshUser();
    } catch (err: any) {
      setFeedResult({ error: err.message });
    } finally {
      setTestingFeed(false);
    }
  };

  const webhookEndpoint =
    typeof window !== 'undefined' ? `${window.location.origin}/api/bank-feed` : '/api/bank-feed';

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900">Bank Pool & UPI Settings</h1>
          <p className="text-xs text-slate-500">Manage receiving UPI QRs, direct bank payouts, and SMS auto-verify</p>
        </div>

        <button
          onClick={() => {
            setEditingBank({});
            setBankForm({
              id: undefined,
              label: 'Primary Bank & UPI',
              bankName: '',
              accountHolderName: '',
              accountNumber: '',
              ifsc: '',
              upiId: '',
              dailyLimit: 500000,
              priority: 1,
              active: true,
            });
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Bank / UPI
        </button>
      </div>

      {/* Add / Edit Bank Form */}
      {editingBank !== null && (
        <form
          onSubmit={handleSaveBank}
          className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-900 uppercase">
              {bankForm.id ? 'Edit Bank / UPI' : 'Add Bank / UPI'}
            </h2>
            <button
              type="button"
              onClick={() => setEditingBank(null)}
              className="text-xs font-bold text-slate-500 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">UPI ID</label>
              <input
                type="text"
                value={bankForm.upiId}
                onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                placeholder="9974366033@kotak"
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Holder Name *</label>
              <input
                type="text"
                required
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name *</label>
              <input
                type="text"
                required
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={bankForm.ifsc}
                onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded-xl"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Daily Limit (₹)</label>
                <input
                  type="number"
                  value={bankForm.dailyLimit}
                  onChange={(e) => setBankForm({ ...bankForm, dailyLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={savingBank}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                {savingBank ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Receiving Bank & QR Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Receiving Bank & UPI QR</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyBanks.map((b) => (
            <div
              key={b.id}
              className={`p-4 rounded-2xl border space-y-3 ${
                b.active ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-100/50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-slate-900">{b.bankName}</div>
                  <div className="text-[11px] font-bold text-slate-600">{b.accountHolderName}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    b.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}
                >
                  {b.active ? 'Active' : 'Paused'}
                </span>
              </div>

              {b.qrDataUrl && (
                <div className="p-3 rounded-xl bg-white border border-blue-200 flex items-center gap-3">
                  <img
                    src={b.qrDataUrl}
                    alt="UPI QR"
                    className="w-28 h-28 rounded-lg border border-slate-200 p-1 shrink-0 bg-white"
                  />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="text-xs font-mono font-bold text-blue-700 break-all">
                      {b.upiId || b.targetVpa}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {b.upiId && (
                        <button
                          type="button"
                          onClick={() => copyField('UPI ID', b.upiId)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                        >
                          Copy UPI
                        </button>
                      )}
                      <a
                        href={b.qrDataUrl}
                        download={`QR_${b.upiId || b.accountNumber}.png`}
                        className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 border border-blue-200"
                      >
                        Download QR
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-between gap-2">
                <span>
                  A/c: <strong>{b.accountNumber || '—'}</strong> • IFSC: <strong>{b.ifsc || '—'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => copyField('Bank A/c', `${b.accountNumber} | ${b.ifsc}`)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-sans font-bold text-slate-700 cursor-pointer shrink-0"
                >
                  Copy
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingBank(b);
                      setBankForm({
                        id: b.id,
                        label: b.label,
                        bankName: b.bankName,
                        accountHolderName: b.accountHolderName,
                        accountNumber: b.accountNumber,
                        ifsc: b.ifsc,
                        upiId: b.upiId || '',
                        dailyLimit: b.dailyLimit || 500000,
                        priority: b.priority || 1,
                        active: b.active,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleBank(b)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    {b.active ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleToggleBank(b, true)}
                    title="Reset Today's Volume"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteBank(b.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outgoing Payouts + Webhook Auto-Verify */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Outgoing Payout Desk */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Outgoing Payouts (Bank-to-Bank & QR)</h2>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPayoutMode('upi')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  payoutMode === 'upi' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                UPI QR
              </button>
              <button
                type="button"
                onClick={() => setPayoutMode('bank_to_bank')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  payoutMode === 'bank_to_bank' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                Bank Transfer (₹0)
              </button>
              <button
                type="button"
                onClick={() => setPayoutMode('bank_ifsc')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  payoutMode === 'bank_ifsc' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                IFSC QR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Payee Name</label>
              <input
                type="text"
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {payoutMode === 'bank_to_bank' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Account No</label>
                  <input
                    type="text"
                    value={beneficiaryAcc}
                    onChange={(e) => setBeneficiaryAcc(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">IFSC</label>
                  <input
                    type="text"
                    value={beneficiaryIfsc}
                    onChange={(e) => setBeneficiaryIfsc(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['NEFT', 'IFT', 'RTGS', 'IMPS'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setB2bRail(r)}
                    className={`py-1.5 px-2 rounded-xl border text-center text-xs font-bold cursor-pointer ${
                      b2bRail === r
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-400">Quick Copy ({b2bRail})</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadBulkBankCsv('kotak')}
                      className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Kotak CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadBulkBankCsv('bob')}
                      className="px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      BoB CSV
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => copyField('Account', beneficiaryAcc)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-left font-mono font-bold truncate cursor-pointer"
                  >
                    {beneficiaryAcc}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyField('IFSC', beneficiaryIfsc)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-left font-mono font-bold text-emerald-300 truncate cursor-pointer"
                  >
                    {beneficiaryIfsc}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyField('Amount', payoutAmount)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-left font-mono font-bold text-amber-300 cursor-pointer"
                  >
                    {formatINR(Number(payoutAmount || 0))}
                  </button>
                </div>
              </div>

              <form onSubmit={handleRecordBankToBankPayout} className="flex gap-2">
                <input
                  type="text"
                  value={b2bUtr}
                  onChange={(e) => setB2bUtr(e.target.value)}
                  placeholder="Bank UTR (optional)"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
                <button
                  type="submit"
                  disabled={recordingB2b}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  {recordingB2b ? 'Saving...' : `Record ${b2bRail}`}
                </button>
              </form>

              {lastB2bReceipt && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex justify-between">
                  <span>✓ {lastB2bReceipt.transferMode} Recorded ({formatINR(lastB2bReceipt.amount)})</span>
                  <span className="font-mono">UTR: {lastB2bReceipt.bankRrn}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleGeneratePayoutQr} className="space-y-3">
              {payoutMode === 'bank_ifsc' ? (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={beneficiaryAcc}
                    onChange={(e) => setBeneficiaryAcc(e.target.value)}
                    placeholder="Account Number"
                    className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    required
                    value={beneficiaryIfsc}
                    onChange={(e) => setBeneficiaryIfsc(e.target.value.toUpperCase())}
                    placeholder="IFSC Code"
                    className="px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={beneficiaryUpi}
                    onChange={(e) => setBeneficiaryUpi(e.target.value)}
                    placeholder="UPI ID (e.g. 9974366033@kotak)"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                  <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAmountInQr}
                      onChange={(e) => setIncludeAmountInQr(e.target.checked)}
                    />
                    Lock ₹
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={generatingQr}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {generatingQr ? 'Generating...' : 'Generate UPI QR'}
              </button>

              {generatedPayoutQr && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
                  <img
                    src={generatedPayoutQr.qrDataUrl}
                    alt="Payout QR"
                    className="w-32 h-32 rounded-xl border border-slate-200 bg-white p-1 shrink-0"
                  />
                  <div className="space-y-1 text-xs min-w-0">
                    <div className="font-extrabold text-slate-900">
                      {formatINR(generatedPayoutQr.amount)} → {generatedPayoutQr.beneficiaryName}
                    </div>
                    <div className="text-[11px] font-mono text-blue-700 break-all">
                      {generatedPayoutQr.targetVpa}
                    </div>
                    <a
                      href={generatedPayoutQr.upiUri}
                      className="inline-block text-[11px] font-bold text-blue-600 hover:underline pt-1"
                    >
                      Open in UPI App →
                    </a>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Webhook / SMS Auto-Verification */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">SMS / Notification Webhook</h2>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-emerald-400 font-bold">POST Endpoint</span>
              <button
                type="button"
                onClick={() => copyField('Webhook URL', webhookEndpoint)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-white cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="text-emerald-300 break-all font-bold">{webhookEndpoint}</div>
            <div className="text-[10px] text-slate-400">
              Payload: <code className="text-amber-300">{`{"raw_sms": "..."}`}</code>
            </div>
          </div>

          <form onSubmit={handleTestNotificationFeed} className="space-y-2.5">
            <textarea
              rows={3}
              value={testFeedText}
              onChange={(e) => setTestFeedText(e.target.value)}
              placeholder="Paste Bank or UPI credit SMS to auto-match UTR..."
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
            />
            <button
              type="submit"
              disabled={testingFeed}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {testingFeed ? 'Verifying...' : 'Verify SMS & Credit Wallet'}
            </button>
          </form>

          {feedResult && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedResult.message || feedResult.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
