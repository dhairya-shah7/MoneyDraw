'use client';

import React, { useState } from 'react';
import { useApp } from '@/components/providers/AppContext';
import { UserPlus, ShieldCheck, Building2, CreditCard, CheckCircle2, Sparkles } from 'lucide-react';

export default function OnboardMerchantPage() {
  const { user, pushToast } = useApp();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const [form, setForm] = useState({
    applicantName: '',
    companyName: '',
    mobile: '',
    email: '',
    requestedRole: 'RETAILER',
    panNumber: '',
    aadhaarMasked: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    city: '',
    state: 'Gujarat',
    pinCode: '',
  });

  const simulateDigiLockerFetch = () => {
    setForm({
      ...form,
      applicantName: form.applicantName || 'Rameshbhai Patel',
      companyName: form.companyName || 'Patel Digital Seva Kendra',
      mobile: form.mobile || '9825012345',
      email: form.email || 'ramesh.patel@moneydraw.in',
      panNumber: 'ABCDE1234F',
      aadhaarMasked: 'XXXX-XXXX-8492',
      bankName: 'HDFC Bank',
      accountNumber: '50100482910234',
      ifsc: 'HDFC0001234',
      city: 'Patan',
      state: 'Gujarat',
      pinCode: '384265',
    });
    pushToast('DigiLocker Verified', 'eKYC & Penny-Drop Bank details auto-filled.', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.applicantName || !form.mobile || !form.panNumber) {
      pushToast('Missing Fields', 'Please complete required applicant & KYC fields', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_onboarding',
          parentMobile: user?.mobile || '7506007000',
          parentName: user?.companyName || 'AGS CORPORATION',
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmittedRef(String(data.application.id));
      pushToast('Dossier Submitted', 'Merchant Onboarding queued for instant compliance approval.', 'success');
    } catch (err: any) {
      pushToast('Submission Failed', err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Paperless eKYC Onboarding
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Onboard New Retailer / Distributor</h1>
          <p className="text-xs text-slate-500">
            Instant PAN NSDL check, Aadhaar DigiLocker verification & Penny-Drop bank account validation
          </p>
        </div>
        <button
          type="button"
          onClick={simulateDigiLockerFetch}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Auto-Fill via DigiLocker Demo
        </button>
      </div>

      {submittedRef ? (
        <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-card space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Onboarding Dossier Submitted!</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Application for <strong>{form.applicantName}</strong> ({form.companyName}) is now in the Staff/Admin Compliance Queue. You can approve it immediately from the Admin or Staff portal.
          </p>
          <div className="inline-block px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700">
            Application ID: #{submittedRef}
          </div>
          <div>
            <button
              onClick={() => {
                setSubmittedRef(null);
                setStep(1);
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              Onboard Another Merchant
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card space-y-6">
          {/* Stepper */}
          <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-100">
            {[
              { id: 1, title: '1. Outlet & Role Profile', icon: Building2 },
              { id: 2, title: '2. PAN & Aadhaar eKYC', icon: ShieldCheck },
              { id: 3, title: '3. Settlement Bank A/c', icon: CreditCard },
            ].map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  step === s.id
                    ? 'bg-blue-50/70 border-blue-300 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">{s.title}</span>
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name (As per PAN) *</label>
                <input
                  type="text"
                  required
                  value={form.applicantName}
                  onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                  placeholder="e.g., Rameshbhai Patel"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shop / Enterprise Name *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="e.g., Patel Digital Seva Kendra"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">10-Digit Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="9825012345"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="merchant@moneydraw.in"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Partner Tier Role</label>
                <select
                  value={form.requestedRole}
                  onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="RETAILER">Retailer (BC Agent Point)</option>
                  <option value="DISTRIBUTOR">Distributor (Channel Partner)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City & Pincode</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Patan"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Account Number (PAN) *</label>
                <input
                  type="text"
                  required
                  value={form.panNumber}
                  onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Masked Aadhaar UID *</label>
                <input
                  type="text"
                  required
                  value={form.aadhaarMasked}
                  onChange={(e) => setForm({ ...form, aadhaarMasked: e.target.value })}
                  placeholder="XXXX-XXXX-8492"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Bank Name *</label>
                <input
                  type="text"
                  required
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="HDFC Bank / Yes Bank"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account Number *</label>
                <input
                  type="text"
                  required
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  placeholder="50100482910234"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                <input
                  type="text"
                  required
                  value={form.ifsc}
                  onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                  placeholder="HDFC0001234"
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Previous Step
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Continue to Step {step + 1}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Submitting KYC Dossier...' : 'Submit Merchant Onboarding'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
