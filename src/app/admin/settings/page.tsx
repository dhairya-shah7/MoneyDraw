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

  const loadSettingsData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setCompanyBanks(data.companyBanks || []);
    } catch {
      pushToast('Error', 'Failed to load settings', 'warning');
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const copyField = (label: string, val: string) => {
    navigator.clipboard.writeText(val);
    pushToast(`Copied ${label}`, val, 'info');
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

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900">Company Bank & Receiving UPI Settings</h1>
          <p className="text-xs text-slate-500">Manage receiving UPI QRs and company bank accounts</p>
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

          </div>
  );
}
