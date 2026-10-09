'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';
import { Lock, Unlock, ArrowRightLeft, PlusCircle, MinusCircle, Wallet } from 'lucide-react';

const ROLE_OPTIONS = [
  { roleCode: 'SUPER_ADMIN', roleName: 'Super Admin' },
  { roleCode: 'DISTRIBUTOR', roleName: 'Master Distributor' },
  { roleCode: 'RETAILER', roleName: 'Retailer' },
  { roleCode: 'STAFF', roleName: 'Operations Staff' },
];

export default function AdminUsersManagementPage() {
  const router = useRouter();
  const { user, pushToast, refreshUser, switchDemoRole } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [onboardingApps, setOnboardingApps] = useState<any[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<number, string>>({});
  const [adjustingId, setAdjustingId] = useState<number | null>(null);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setUsers(data.users || []);
      setOnboardingApps(data.onboardingApps || []);
    } catch {
      pushToast('Error', 'Failed to load users', 'warning');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdjustBalance = async (u: any, direction: 'credit' | 'debit', overrideAmount?: number) => {
    const rawAmt = overrideAmount !== undefined ? overrideAmount : Number(creditAmounts[u.id] || 0);
    if (!rawAmt || rawAmt <= 0) {
      pushToast('Enter Amount', 'Please enter a valid ₹ amount to credit/debit.', 'warning');
      return;
    }
    setAdjustingId(u.id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_wallet',
          userId: u.id,
          bucket: 'main',
          direction,
          amount: rawAmt,
          remarks:
            direction === 'credit'
              ? `Main Wallet Credited by Admin (${user?.firstName || 'Super Admin'})`
              : `Main Wallet Debited by Admin (${user?.firstName || 'Super Admin'})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update wallet');
      pushToast(
        direction === 'credit' ? 'Balance Added!' : 'Balance Deducted',
        `${formatINR(rawAmt)} ${direction === 'credit' ? 'added to' : 'deducted from'} ${u.firstName} ${u.lastName}'s Main Wallet.`,
        'success'
      );
      setCreditAmounts((prev) => ({ ...prev, [u.id]: '' }));
      await loadUsers();
      if (user?.id === u.id) {
        await refreshUser(u.mobile);
      }
    } catch (err: any) {
      pushToast('Wallet Error', err.message, 'warning');
    } finally {
      setAdjustingId(null);
    }
  };

  const handleToggleUserStatus = async (u: any) => {
    const nextStatus = u.status === 'active' ? 'blocked' : 'active';
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          userId: u.id,
          status: nextStatus,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      pushToast('User Updated', `${u.firstName} ${u.lastName} is now ${nextStatus}`, 'success');
      await loadUsers();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  const handleRoleChange = async (u: any, newRoleCode: string) => {
    const found = ROLE_OPTIONS.find((r) => r.roleCode === newRoleCode);
    if (!found) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          userId: u.id,
          roleCode: found.roleCode,
          roleName: found.roleName,
        }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      pushToast(
        'Role Updated',
        `${u.firstName} ${u.lastName} assigned to ${found.roleName}`,
        'success'
      );
      await loadUsers();
      if (user?.id === u.id) {
        await refreshUser(u.mobile);
      }
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  const handleApproveOnboarding = async (id: number, decision: 'approved' | 'rejected') => {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process onboarding');
      pushToast(
        'Onboarding Processed',
        decision === 'approved'
          ? 'Merchant Provisioned with Wallet!'
          : 'Onboarding Application Rejected',
        'success'
      );
      await loadUsers();
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Users & Wallet Funding
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">
            Retailers, Role Assignment & Direct Wallet Credit
          </h1>
          <p className="text-xs text-slate-500">
            Give Main Wallet balance to any Retailer account or manage user roles and status
          </p>
        </div>
      </div>

      {/* Active Network Users + Direct Wallet Funding */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Registered Accounts ({users.length})</h2>
          <span className="text-xs text-slate-500">
            Enter ₹ amount on any row and click <strong>+ Add Balance</strong> to credit a Retailer&apos;s Main Wallet
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Name / Business</th>
                <th className="py-3 px-4">Phone / Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Main Wallet Balance</th>
                <th className="py-3 px-4">Give / Deduct Main Balance (₹)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500">{u.companyName}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-semibold text-slate-800">{u.mobile}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.roleCode}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-800 font-bold text-[11px] focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.roleCode} value={r.roleCode}>
                          {r.roleName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-mono text-sm font-black text-emerald-700">
                      {formatINR(u.wallet?.availableBalance || 0)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Comm: {formatINR(u.wallet?.commissionBalance || 0)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        placeholder="₹ Amount"
                        value={creditAmounts[u.id] || ''}
                        onChange={(e) =>
                          setCreditAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        disabled={adjustingId === u.id}
                        onClick={() => handleAdjustBalance(u, 'credit')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add Balance
                      </button>
                      <button
                        type="button"
                        disabled={adjustingId === u.id}
                        onClick={() => handleAdjustBalance(u, 'debit')}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        title="Deduct from Main Wallet"
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        Deduct
                      </button>
                      <div className="flex items-center gap-1">
                        {[1000, 5000, 10000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={adjustingId === u.id}
                            onClick={() => handleAdjustBalance(u, 'credit', preset)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-[10px] font-mono font-bold text-slate-700 cursor-pointer"
                          >
                            +₹{preset / 1000}k
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await switchDemoRole(u.mobile);
                          pushToast(
                            'Switched Account',
                            `Now viewing as ${u.firstName} ${u.lastName} (${u.roleName})`,
                            'info'
                          );
                          if (u.roleCode === 'SUPER_ADMIN') router.push('/admin');
                          else if (u.roleCode === 'STAFF') router.push('/staff');
                          else router.push('/user');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        View As
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.status === 'active' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {u.status === 'active' ? 'Active' : 'Blocked'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Onboarding Applications */}
      {onboardingApps.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Merchant Onboarding Queue ({onboardingApps.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Applicant / Outlet</th>
                  <th className="py-3 px-4">Mobile / Role</th>
                  <th className="py-3 px-4">PAN / Aadhaar</th>
                  <th className="py-3 px-4">Settlement Bank</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {onboardingApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.applicantName}</div>
                      <div className="text-[11px] text-slate-500">{app.companyName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-800">{app.mobile}</div>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {app.requestedRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                      <div>PAN: {app.panNumber}</div>
                      <div>UID: {app.aadhaarMasked}</div>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <div className="font-semibold text-slate-800">{app.bankName}</div>
                      <div className="font-mono text-slate-500">
                        {app.accountNumber} ({app.ifsc})
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          app.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : app.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleApproveOnboarding(app.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproveOnboarding(app.id, 'rejected')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px] cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
