'use client';

import React, { useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { ReceiptModal } from '@/components/shared/ReceiptModal';
import {
  KeyRound,
  Lock,
  Webhook,
  Award,
  Printer,
  Copy,
} from 'lucide-react';

export default function AccountSecurityPage() {
  const { user, refreshUser, pushToast } = useApp();
  const [newTpin, setNewTpin] = useState('');
  const [confirmTpin, setConfirmTpin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(user?.webhookUrl || 'https://erp.shreekrishnaagro.in/webhooks/moneydraw');
  const [allowedIp, setAllowedIp] = useState(user?.allowedIp || '103.21.58.192, 49.36.128.10');
  const [saving, setSaving] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  const handleUpdateTpin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTpin.replace(/\D/g, '').trim();
    if (clean.length < 4 || clean.length > 6) {
      pushToast('Invalid TPIN', 'TPIN must be 4 to 6 numeric digits', 'warning');
      return;
    }
    if (confirmTpin && clean !== confirmTpin.trim()) {
      pushToast('PIN Mismatch', 'New TPIN and Confirm TPIN do not match', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_tpin',
          userId: user.id,
          mobile: user.mobile,
          newTpin: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update TPIN');
      setNewTpin('');
      setConfirmTpin('');
      await refreshUser();
      pushToast('TPIN Updated Successfully', 'Your Transaction PIN has been set and is active.', 'success');
    } catch (err: any) {
      pushToast('Error', err.message || 'Failed to update TPIN', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      pushToast('Invalid Password', 'New password must be at least 6 characters', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          userId: user.id,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');
      setCurrentPassword('');
      setNewPassword('');
      pushToast('Password Updated', 'Account login password changed.', 'success');
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_api_settings',
          userId: user.id,
          webhookUrl,
          allowedIp,
          rotateKey: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to update developer settings');
      await refreshUser();
      pushToast('API Config Saved', 'Developer API Key rotated & Webhook saved.', 'success');
    } catch (err: any) {
      pushToast('Error', err.message, 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Authorized Retailer Certificate Banner */}
      <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 shadow-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Award className="w-3.5 h-3.5" />
              NPCI & RBI Authorized Business Correspondent Point
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">{user.companyName || fullName}</h1>
            <p className="text-xs text-slate-600">
              Proprietor: <strong>{fullName}</strong> • Mobile: <span className="font-mono">{user.mobile}</span> • PAN:{' '}
              <span className="font-mono">{user.panNumber || 'DSCPG3386N'}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Location: {user.address || 'Patan'}, {user.city || 'Patan'}, {user.state || 'Gujarat'} - {user.pinCode || '384265'}
            </p>
          </div>

          <button
            onClick={() => setShowCertModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            View & Print BC Certificate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TPIN Configuration */}
        <form onSubmit={handleUpdateTpin} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Transaction Security PIN (TPIN)</h2>
              <p className="text-xs text-slate-500">Required before high-value DMT payouts & bank settlements</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Set New 4–6 Digit TPIN</label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Active: ••••
              </span>
            </div>
            <input
              type="password"
              maxLength={6}
              value={newTpin}
              onChange={(e) => setNewTpin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 4-6 digit numeric PIN"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New TPIN</label>
            <input
              type="password"
              maxLength={6}
              value={confirmTpin}
              onChange={(e) => setConfirmTpin(e.target.value.replace(/\D/g, ''))}
              placeholder="Re-enter 4-6 digit numeric PIN"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {saving ? 'Updating...' : 'Save & Update TPIN'}
          </button>
        </form>

        {/* Login Password */}
        <form onSubmit={handleUpdatePassword} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Change Login Password</h2>
              <p className="text-xs text-slate-500">Keep your merchant account credentials protected</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Update Password
          </button>
        </form>
      </div>

      {/* Partner Developer API & Webhook Config */}
      <form onSubmit={handleUpdateApiConfig} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Partner Developer API & Webhook Callbacks</h2>
              <p className="text-xs text-slate-500">
                Server-to-server payout & UPI QR collection callbacks with HMAC signature verification
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Production Live
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Secret API Token</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={user.apiKey || 'md_live_9081047006_sk_89a1bc4f'}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(user.apiKey || 'md_live_9081047006_sk_89a1bc4f');
                  pushToast('Copied', 'API Token copied to clipboard', 'info');
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Webhook Callback URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Whitelisted Server IPs</label>
            <input
              type="text"
              value={allowedIp}
              onChange={(e) => setAllowedIp(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            Rotate Key & Save Webhook Config
          </button>
        </div>
      </form>

      <ReceiptModal
        open={showCertModal}
        onClose={() => setShowCertModal(false)}
        certificateUser={{
          name: fullName,
          companyName: user.companyName,
          mobile: user.mobile,
          panNumber: user.panNumber,
          city: user.city,
          state: user.state,
          pinCode: user.pinCode,
          roleName: user.roleName,
        }}
      />
    </div>
  );
}
