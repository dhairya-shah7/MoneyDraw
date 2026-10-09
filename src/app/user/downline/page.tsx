'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';
import { Users, Percent, CheckCircle2 } from 'lucide-react';

export default function DownlineAndSlabsPage() {
  const { user, pushToast } = useApp();
  const [downline, setDownline] = useState<any[]>([]);
  const [slabs, setSlabs] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin');
        const data = await res.json();
        const allUsers = data.users || [];
        setDownline(allUsers.filter((u: any) => u.parentMobile === user.mobile || u.roleCode === 'RETAILER'));
        const defaultScheme = data.schemes?.[0];
        setSlabs(defaultScheme?.slabs || []);
      } catch {
        pushToast('Error', 'Failed to load commission slabs', 'warning');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.mobile]);

  const filteredSlabs = slabs.filter((s) => {
    if (selectedService === 'ALL') return true;
    return s.serviceCode === selectedService;
  });

  const serviceCodes = Array.from(new Set(slabs.map((s) => s.serviceCode)));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Gold Tier Commercials
            </span>
            <span className="text-xs text-slate-400 font-mono">194H TDS: 2% • GST: 18%</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Commercial Commission Slabs & Network Hierarchy
          </h1>
          <p className="text-xs text-slate-500">
            Transparent multi-tier commission structure across UPI Cash, AEPS, DMT Payouts, BBPS & Recharges
          </p>
        </div>

        {user?.parentName && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {user.parentName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Your Upline Distributor</div>
              <div className="text-xs font-bold text-slate-900">{user.parentName}</div>
              <div className="text-[11px] font-mono text-blue-600">{user.parentMobile}</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Commission Scheme Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Active Commercial Slabs (Gold Partner Scheme)</h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedService('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedService === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ALL
            </button>
            {serviceCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedService(code)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  selectedService === code
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {code.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Amount Slab Range</th>
                <th className="py-3 px-4">Calc Mode</th>
                <th className="py-3 px-4 text-right">Retailer Commission</th>
                <th className="py-3 px-4 text-right">Distributor Override</th>
                <th className="py-3 px-4 text-right">Service Surcharge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Loading commercial slabs...
                  </td>
                </tr>
              ) : (
                filteredSlabs.map((slab) => (
                  <tr key={slab.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                      {slab.serviceCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatINR(slab.minAmount)} – {formatINR(slab.maxAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {slab.chargeType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {slab.retailerComm > 0
                        ? slab.chargeType === 'percent'
                          ? `${slab.retailerComm}%`
                          : formatINR(slab.retailerComm)
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600">
                      {slab.distributorComm > 0
                        ? slab.chargeType === 'percent'
                          ? `${slab.distributorComm}%`
                          : formatINR(slab.distributorComm)
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                      {slab.surcharge > 0
                        ? slab.chargeType === 'percent'
                          ? `${slab.surcharge}%`
                          : formatINR(slab.surcharge)
                        : 'FREE'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Downline Members */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Mapped Network Retailers ({downline.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Real-time wallet balances & KYC status of retailers under your hierarchy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Merchant / Outlet</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Main Wallet</th>
                <th className="py-3 px-4 text-right">AEPS Wallet</th>
                <th className="py-3 px-4">KYC Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {downline.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">
                      {m.firstName} {m.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500">{m.companyName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">{m.mobile}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                      {m.roleName}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatINR(m.wallet?.availableBalance || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {formatINR(m.wallet?.aepsBalance || 0)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      <CheckCircle2 className="w-3 h-3" />
                      {m.kycStatus}
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
