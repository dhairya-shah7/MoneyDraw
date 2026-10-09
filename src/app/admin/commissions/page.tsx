'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';

export default function AdminCommissionsPage() {
  const { pushToast } = useApp();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [editingSlab, setEditingSlab] = useState<any | null>(null);

  const loadSchemes = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setSchemes(data.schemes || []);
    } catch {
      pushToast('Error', 'Failed to load commission schemes', 'warning');
    }
  };

  useEffect(() => {
    loadSchemes();
  }, []);

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlab) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_slab',
          ...editingSlab,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save slab');
      pushToast('Slab Saved', 'Commission slab updated with positive platform margin verification!', 'success');
      setEditingSlab(null);
      await loadSchemes();
    } catch (err: any) {
      pushToast('Margin Guardrail Alert', err.message, 'warning');
    }
  };

  const activeScheme = schemes[0];
  const visibleSlabs = (activeScheme?.slabs || []).filter(
    (s: any) => !String(s.serviceCode || '').toUpperCase().startsWith('AEPS')
  );

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <h1 className="text-lg font-black text-slate-900">Commission Slabs</h1>
        <p className="text-xs text-slate-500">Manage retailer commissions, surcharges, and platform margins</p>
      </div>

      {editingSlab && (
        <form
          onSubmit={handleSaveSlab}
          className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-5 shadow-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Edit Slab: {editingSlab.serviceCode.toUpperCase()} ({formatINR(editingSlab.minAmount)} –{' '}
              {formatINR(editingSlab.maxAmount)})
            </h3>
            <button
              type="button"
              onClick={() => setEditingSlab(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Retailer Comm</label>
              <input
                type="number"
                step="0.01"
                value={editingSlab.retailerComm}
                onChange={(e) => setEditingSlab({ ...editingSlab, retailerComm: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Distributor Override</label>
              <input
                type="number"
                step="0.01"
                value={editingSlab.distributorComm}
                onChange={(e) => setEditingSlab({ ...editingSlab, distributorComm: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Surcharge</label>
              <input
                type="number"
                step="0.01"
                value={editingSlab.surcharge}
                onChange={(e) => setEditingSlab({ ...editingSlab, surcharge: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Platform Net Margin</label>
              <input
                type="number"
                step="0.01"
                value={editingSlab.adminMargin}
                onChange={(e) => setEditingSlab({ ...editingSlab, adminMargin: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Save Slab
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Slabs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Scheme: {activeScheme?.name || 'Gold Retailer Scheme'} ({visibleSlabs.length} Slabs)
          </h2>
          <span className="text-xs text-emerald-700 font-semibold">
            Guardrail: Platform Net Margin ≥ ₹0.00
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Slab Range</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Retailer Comm</th>
                <th className="py-3 px-4 text-right">Distributor Override</th>
                <th className="py-3 px-4 text-right">Surcharge</th>
                <th className="py-3 px-4 text-right">Platform Margin</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleSlabs.map((slab: any) => (
                <tr key={slab.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold uppercase text-slate-900">
                    {slab.serviceCode.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {formatINR(slab.minAmount)} – {formatINR(slab.maxAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                      {slab.chargeType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {slab.chargeType === 'percent'
                      ? `${slab.retailerComm}%`
                      : formatINR(slab.retailerComm)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600">
                    {slab.chargeType === 'percent'
                      ? `${slab.distributorComm}%`
                      : formatINR(slab.distributorComm)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-600">
                    {slab.surcharge > 0
                      ? slab.chargeType === 'percent'
                        ? `${slab.surcharge}%`
                        : formatINR(slab.surcharge)
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                    {slab.chargeType === 'percent'
                      ? `${slab.adminMargin}%`
                      : formatINR(slab.adminMargin)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setEditingSlab(slab)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-semibold text-xs cursor-pointer"
                    >
                      Edit Slab
                    </button>
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
