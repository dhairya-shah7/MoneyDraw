'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  QrCode,
  Building2,
  Smartphone,
  FileText,
  Zap,
  Sparkles,
  Printer,
  Search,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { formatINR, formatDateTime } from '@/lib/format';
import {
  RECHARGE_OPERATORS,
  RECHARGE_CIRCLES,
  RECHARGE_PLANS,
  BBPS_OPERATORS,
} from '@/lib/operators-data';
import { ReceiptModal, PrintableTransaction } from '@/components/shared/ReceiptModal';

const SERVICE_TABS = [
  { code: 'UPI_CASH', label: 'UPI QR Collect', sub: 'Customer QR', icon: QrCode },
  { code: 'RECHARGE', label: 'Mobile & DTH', sub: 'Instant Top-Up', icon: Smartphone },
  { code: 'BILLPAY', label: 'Utility Bills', sub: 'Electricity & BBPS', icon: FileText },
  { code: 'CMS', label: 'CMS & Status', sub: 'Cash Drop & RRN', icon: Zap },
  { code: 'PAYOUT', label: 'Bank Payout', sub: 'Main Wallet Hub', icon: Building2 },
];

function ServicesContent() {
  const searchParams = useSearchParams();
  const { user, refreshUser, pushToast } = useApp();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'UPI_CASH');
  const [tpin, setTpin] = useState('1234');
  const [receiptTx, setReceiptTx] = useState<PrintableTransaction | null>(null);
  const [quote, setQuote] = useState<any>(null);

  // 1. UPI Cash QR State
  const [upiAmount, setUpiAmount] = useState('2000');
  const [upiSession, setUpiSession] = useState<any>(null);
  const [upiBankInfo, setUpiBankInfo] = useState<any>({
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '9974366033',
    ifsc: 'KKBK0002626',
    accountHolderName: 'AGS',
    upiId: '9974366033@kotak',
  });
  const [upiUtr, setUpiUtr] = useState('');
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiSimulating, setUpiSimulating] = useState(false);
  const [upiCountdown, setUpiCountdown] = useState(180);

  // 2. Payout / DMT State
  const [remitters, setRemitters] = useState<any[]>([]);
  const [selectedRemitter, setSelectedRemitter] = useState<any>(null);
  const [selectedBene, setSelectedBene] = useState<any>(null);
  const [payoutAmount, setPayoutAmount] = useState('5000');
  const [payoutMode, setPayoutMode] = useState<'NEFT' | 'IFT' | 'RTGS' | 'IMPS'>('NEFT');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [newBeneOpen, setNewBeneOpen] = useState(false);
  const [beneName, setBeneName] = useState('');
  const [beneBank, setBeneBank] = useState('');
  const [beneAcc, setBeneAcc] = useState('');
  const [beneIfsc, setBeneIfsc] = useState('');
  const [verifyingPenny, setVerifyingPenny] = useState(false);

  // 3. Recharge State
  const [rchType, setRchType] = useState<'prepaid' | 'dth'>('prepaid');
  const [rchNumber, setRchNumber] = useState('9825012345');
  const [rchOperator, setRchOperator] = useState('Jio Prepaid');
  const [rchCircle, setRchCircle] = useState('Gujarat');
  const [rchAmount, setRchAmount] = useState('299');
  const [rchLoading, setRchLoading] = useState(false);

  // 4. BBPS Utility State
  const [bbpsCategory, setBbpsCategory] = useState<'electricity' | 'insurance' | 'fastag' | 'gas' | 'water'>('electricity');
  const [bbpsOperator, setBbpsOperator] = useState(BBPS_OPERATORS.electricity[0]);
  const [bbpsConsumerNo, setBbpsConsumerNo] = useState('TP-AHD-449102');
  const [bbpsMobile, setBbpsMobile] = useState('9898123456');
  const [fetchedBill, setFetchedBill] = useState<any>(null);
  const [bbpsLoading, setBbpsLoading] = useState(false);

  // 5. CMS & Status Check State
  const [cmsMobile, setCmsMobile] = useState('9825099881');
  const [cmsPortal, setCmsPortal] = useState('Fino CMS Enterprise');
  const [cmsAmount, setCmsAmount] = useState('15000');
  const [lookupRef, setLookupRef] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== 'AEPS') setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (!upiSession || upiSession.status !== 'pending') return;
    const timer = setInterval(() => {
      setUpiCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [upiSession]);

  const loadRemitters = useCallback(async () => {
    const mobile = user?.mobile || '9081047006';
    const res = await fetch(`/api/transactions?mobile=${encodeURIComponent(mobile)}`);
    if (res.ok) {
      const data = await res.json();
      setRemitters(data.remitters || []);
      if (data.remitters?.length > 0 && !selectedRemitter) {
        setSelectedRemitter(data.remitters[0]);
        if (data.remitters[0].beneficiaries?.length > 0) {
          setSelectedBene(data.remitters[0].beneficiaries[0]);
        }
      }
    }
  }, [user?.mobile, selectedRemitter]);

  useEffect(() => {
    loadRemitters();
  }, [loadRemitters]);

  const currentServiceAmount =
    activeTab === 'UPI_CASH'
      ? Number(upiAmount)
      : activeTab === 'PAYOUT'
      ? Number(payoutAmount)
      : activeTab === 'RECHARGE'
      ? Number(rchAmount)
      : activeTab === 'BILLPAY'
      ? Number(fetchedBill?.amount || 1450)
      : Number(cmsAmount);

  useEffect(() => {
    if (currentServiceAmount <= 0) return;
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'quote',
        mobile: user?.mobile || '9081047006',
        serviceCode: activeTab,
        amount: currentServiceAmount,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.quote) setQuote(d.quote);
      })
      .catch(() => {});
  }, [activeTab, currentServiceAmount, user?.mobile]);

  const handleGenerateUpiQr = async () => {
    setUpiLoading(true);
    try {
      const res = await fetch('/api/upi-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          mobile: user?.mobile || '9081047006',
          amount: Number(upiAmount),
          tpin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUpiSession(data.session);
      if (data.bankAccount) setUpiBankInfo(data.bankAccount);
      setUpiUtr('');
      setUpiCountdown(180);
      pushToast('QR Generated', `Scan QR or transfer ${formatINR(upiAmount)}`, 'info');
    } catch (err: unknown) {
      pushToast('QR Error', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setUpiLoading(false);
    }
  };

  const handleSubmitUpiUtr = async () => {
    if (!upiSession) return;
    const clean = upiUtr.replace(/\D/g, '');
    if (clean.length !== 12) {
      pushToast('Invalid UTR', 'Please enter a valid 12-digit UTR / Reference number.', 'warning');
      return;
    }
    setUpiSimulating(true);
    try {
      const res = await fetch('/api/upi-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_utr',
          reference: upiSession.reference,
          utr: clean,
          mode: 'UPI QR / Bank Transfer',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pushToast(
        data.status === 'approved' ? 'Wallet Credited!' : 'UTR Submitted',
        data.message || 'Submitted for verification',
        'success'
      );
      setUpiSession(null);
      setUpiUtr('');
      await refreshUser();
    } catch (err: unknown) {
      pushToast('UTR Error', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setUpiSimulating(false);
    }
  };

  const handleSimulateUpiScan = async () => {
    if (!upiSession) return;
    setUpiSimulating(true);
    try {
      const res = await fetch('/api/upi-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_scan',
          reference: upiSession.reference,
          adminMobile: user?.mobile,
          payerName: 'Customer UPI',
          payerVpa: 'customer@upi',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUpiSession(data.session);
      setReceiptTx(data.transaction);
      await refreshUser();
    } catch (err: unknown) {
      pushToast('Scan Failed', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setUpiSimulating(false);
    }
  };

  const handlePennyDropVerify = async () => {
    if (!beneAcc || !beneIfsc) return;
    setVerifyingPenny(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_beneficiary',
          accountNumber: beneAcc,
          ifsc: beneIfsc,
          accountHolderName: beneName || 'TEKCHANDJI CO',
        }),
      });
      const data = await res.json();
      if (data.verified) {
        setBeneName(data.verifiedName);
        pushToast('Verified', `Account holder: ${data.verifiedName}`, 'success');
      }
    } finally {
      setVerifyingPenny(false);
    }
  };

  const handleSaveBeneficiary = async () => {
    if (!beneName.trim() || !beneAcc.trim() || !beneIfsc.trim()) {
      pushToast('Missing Details', 'Enter Account Holder Name, Account Number, and IFSC.', 'warning');
      return;
    }
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_beneficiary',
        remitterId: selectedRemitter?.id,
        mobile: user?.mobile || '9081047006',
        accountHolderName: beneName.trim(),
        bankName: beneBank.trim() || 'Bank Transfer',
        accountNumber: beneAcc.trim(),
        ifsc: beneIfsc.trim().toUpperCase(),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewBeneOpen(false);
      setSelectedBene(data.beneficiary);
      await loadRemitters();
      pushToast('Beneficiary Saved', `${beneName} saved to your beneficiaries.`, 'success');
    }
  };

  const handleExecutePayout = async () => {
    const targetName = beneName.trim() || selectedBene?.accountHolderName || '';
    const targetAcc = beneAcc.trim() || selectedBene?.accountNumber || '';
    const targetIfsc = (beneIfsc.trim() || selectedBene?.ifsc || '').toUpperCase();
    const targetBank = beneBank.trim() || selectedBene?.bankName || 'Bank Account';

    if (!targetAcc || !targetIfsc || !targetName) {
      pushToast('Missing Bank Details', 'Please enter Account Holder Name, Account Number, and IFSC Code.', 'warning');
      return;
    }

    setPayoutLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          mobile: user?.mobile || '9081047006',
          serviceCode: 'PAYOUT',
          serviceName: `Bank Transfer (${payoutMode})`,
          category: 'payout',
          operatorName: `${payoutMode} Bank Transfer`,
          customerMobile: user?.mobile || '9825011223',
          customerName: targetName,
          accountOrVpa: targetAcc,
          bankName: targetBank,
          ifsc: targetIfsc,
          transferMode: payoutMode,
          amount: Number(payoutAmount),
          tpin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReceiptTx(data.transaction);
      pushToast('Transfer Successful', `${formatINR(payoutAmount)} sent to ${targetName} (${targetAcc})`, 'success');
      await refreshUser();
    } catch (err: unknown) {
      pushToast('Transfer Failed', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleExecuteRecharge = async () => {
    setRchLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          mobile: user?.mobile || '9081047006',
          serviceCode: 'RECHARGE',
          serviceName: `${rchType.toUpperCase()} Recharge`,
          category: 'recharge',
          operatorName: rchOperator,
          customerMobile: rchNumber,
          customerName: `${rchCircle} Subscriber`,
          accountOrVpa: rchNumber,
          amount: Number(rchAmount),
          tpin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReceiptTx(data.transaction);
      await refreshUser();
    } catch (err: unknown) {
      pushToast('Recharge Error', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setRchLoading(false);
    }
  };

  const handleFetchBbpsBill = async () => {
    setBbpsLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_bill',
          operatorName: bbpsOperator,
          consumerNumber: bbpsConsumerNo,
        }),
      });
      const data = await res.json();
      setFetchedBill(data.bill);
    } finally {
      setBbpsLoading(false);
    }
  };

  const handlePayBbpsBill = async () => {
    if (!fetchedBill) return;
    setBbpsLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          mobile: user?.mobile || '9081047006',
          serviceCode: 'BILLPAY',
          serviceName: `BBPS ${bbpsCategory.toUpperCase()}`,
          category: 'billpay',
          operatorName: bbpsOperator,
          customerMobile: bbpsMobile,
          customerName: fetchedBill.consumerName,
          accountOrVpa: bbpsConsumerNo,
          amount: Number(fetchedBill.amount),
          tpin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReceiptTx(data.transaction);
      setFetchedBill(null);
      await refreshUser();
    } catch (err: unknown) {
      pushToast('Bill Payment Failed', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setBbpsLoading(false);
    }
  };

  const handleExecuteCms = async () => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        mobile: user?.mobile || '9081047006',
        serviceCode: 'CMS',
        serviceName: 'CMS Cash Drop',
        category: 'cms',
        operatorName: cmsPortal,
        customerMobile: cmsMobile,
        customerName: 'CMS Drop',
        accountOrVpa: cmsMobile,
        amount: Number(cmsAmount),
        tpin,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setReceiptTx(data.transaction);
      await refreshUser();
    }
  };

  const handleLookupRef = async () => {
    const res = await fetch(`/api/transactions?reference=${encodeURIComponent(lookupRef)}`);
    const data = await res.json();
    setLookupResult(data.transaction || { notFound: true });
  };

  return (
    <div className="space-y-5">
      {/* Service Selector Tabs (5 Tabs, No AEPS) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {SERVICE_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.code;
          return (
            <button
              key={t.code}
              onClick={() => setActiveTab(t.code)}
              className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                active
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-blue-600'}`} />
              <div className="min-w-0">
                <div className="text-xs font-black truncate">{t.label}</div>
                <div className={`text-[10px] truncate ${active ? 'text-blue-100' : 'text-slate-400'}`}>{t.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Workspace + Quote */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          {/* TAB 1: UPI CASH QR & BANK DEPOSIT */}
          {activeTab === 'UPI_CASH' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">UPI QR & Bank Transfer</h2>
                  <p className="text-xs text-slate-500">Pay via UPI QR or NEFT / IFT → Submit 12-Digit UTR</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  ₹100 – ₹5,000
                </span>
              </div>

              {!upiSession ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={upiAmount}
                      onChange={(e) => setUpiAmount(e.target.value)}
                      step={100}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-lg font-black text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[500, 1000, 2000, 3000, 5000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setUpiAmount(String(preset))}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                            Number(upiAmount) === preset
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ₹{preset.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">TPIN</label>
                    <input
                      type="password"
                      value={tpin}
                      onChange={(e) => setTpin(e.target.value)}
                      maxLength={6}
                      className="w-40 px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                    />
                  </div>

                  <button
                    onClick={handleGenerateUpiQr}
                    disabled={upiLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    {upiLoading ? 'Generating...' : `Generate UPI QR & Bank Details for ${formatINR(upiAmount)}`}
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Left: UPI QR */}
                    <div className="flex flex-col items-center text-center bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                        Option 1: Scan UPI QR
                      </span>
                      <img src={upiSession.qrPayload} alt="UPI QR" className="w-44 h-44 object-contain" />
                      <div className="text-lg font-black text-slate-900">{formatINR(upiSession.amount)}</div>
                      <div className="text-xs font-mono font-bold text-slate-700">{upiSession.vpa}</div>
                      <div className="text-[11px] font-bold text-blue-600">
                        Expires in {Math.floor(upiCountdown / 60)}:{String(upiCountdown % 60).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Right: Direct Bank Transfer */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                          Option 2: Bank Transfer (0% Fee)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          NEFT / IFT / IMPS
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Bank</span>
                          <span className="font-bold text-slate-900">{upiBankInfo.bankName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Account No.</span>
                          <span className="font-mono font-black text-blue-700">{upiBankInfo.accountNumber}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">IFSC Code</span>
                          <span className="font-mono font-black text-blue-700">{upiBankInfo.ifsc}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Beneficiary</span>
                          <span className="font-bold text-slate-900">{upiBankInfo.accountHolderName}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">UPI ID</span>
                          <span className="font-mono font-bold text-slate-800">{upiSession.vpa}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: 12-Digit UTR Input */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                      Enter 12-Digit UTR / Bank Reference No. After Payment
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={upiUtr}
                        onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        placeholder="e.g. 628119384712 (12 digits)"
                        maxLength={12}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        onClick={handleSubmitUpiUtr}
                        disabled={upiSimulating || upiUtr.length !== 12}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {upiSimulating ? 'Submitting...' : 'Submit 12-Digit UTR'}
                      </button>
                      <button
                        onClick={() => setUpiSession(null)}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Change Amount
                      </button>
                    </div>

                    {(user?.roleCode === 'SUPER_ADMIN' || user?.roleCode === 'ADMIN') && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">Admin Quick Action:</span>
                        <button
                          onClick={handleSimulateUpiScan}
                          disabled={upiSimulating}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                        >
                          ⚡ 1-Click Admin Settle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BANK PAYOUT (CENTRALLY MANAGED IN MAIN WALLET & PAY) */}
          {activeTab === 'PAYOUT' && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-black text-slate-900">Direct Bank Transfers & Beneficiaries</h3>
                <p className="text-xs text-slate-500">
                  Bank payouts, saved beneficiaries, and instant payment links are managed centrally in your Main Wallet hub.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/user/wallet"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  <Building2 className="w-4 h-4" />
                  Open Main Wallet & Pay Any Bank →
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: MOBILE & DTH RECHARGE */}
          {activeTab === 'RECHARGE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">Mobile & DTH Recharge</h2>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => {
                      setRchType('prepaid');
                      setRchOperator(RECHARGE_OPERATORS.prepaid[0].name);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      rchType === 'prepaid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Prepaid
                  </button>
                  <button
                    onClick={() => {
                      setRchType('dth');
                      setRchOperator(RECHARGE_OPERATORS.dth[0].name);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      rchType === 'dth' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    DTH
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {rchType === 'prepaid' ? 'Mobile Number' : 'Customer ID'}
                  </label>
                  <input
                    type="text"
                    value={rchNumber}
                    onChange={(e) => setRchNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Operator</label>
                  <select
                    value={rchOperator}
                    onChange={(e) => setRchOperator(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                  >
                    {RECHARGE_OPERATORS[rchType].map((op) => (
                      <option key={op.code} value={op.name}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Circle</label>
                  <select
                    value={rchCircle}
                    onChange={(e) => setRchCircle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                  >
                    {RECHARGE_CIRCLES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={rchAmount}
                    onChange={(e) => setRchAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RECHARGE_PLANS.map((pl) => (
                  <button
                    key={pl.amount}
                    type="button"
                    onClick={() => setRchAmount(String(pl.amount))}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      Number(rchAmount) === pl.amount
                        ? 'border-blue-600 bg-blue-50/60'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        {pl.validity} · {pl.data}
                      </span>
                      <div className="text-[11px] text-slate-500">{pl.desc}</div>
                    </div>
                    <div className="text-sm font-black text-blue-600">₹{pl.amount}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleExecuteRecharge}
                disabled={rchLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer"
              >
                {rchLoading ? 'Processing...' : `Pay ${formatINR(rchAmount)}`}
              </button>
            </div>
          )}

          {/* TAB 4: BBPS UTILITY BILL PAYMENT */}
          {activeTab === 'BILLPAY' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">Utility Bill Payment (BBPS)</h2>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['electricity', 'insurance', 'fastag', 'gas', 'water'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setBbpsCategory(cat);
                      setBbpsOperator(BBPS_OPERATORS[cat][0]);
                      setFetchedBill(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase border transition cursor-pointer ${
                      bbpsCategory === cat
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Biller</label>
                  <select
                    value={bbpsOperator}
                    onChange={(e) => setBbpsOperator(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                  >
                    {BBPS_OPERATORS[bbpsCategory].map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Consumer Number</label>
                  <input
                    type="text"
                    value={bbpsConsumerNo}
                    onChange={(e) => setBbpsConsumerNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile</label>
                  <input
                    type="text"
                    value={bbpsMobile}
                    onChange={(e) => setBbpsMobile(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
              </div>

              {!fetchedBill ? (
                <button
                  onClick={handleFetchBbpsBill}
                  disabled={bbpsLoading}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  {bbpsLoading ? 'Fetching...' : 'Fetch Bill'}
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-blue-700">{fetchedBill.consumerName}</div>
                      <div className="text-[11px] text-slate-500">Due: {fetchedBill.dueDate}</div>
                    </div>
                    <div className="text-xl font-black text-slate-900">{formatINR(fetchedBill.amount)}</div>
                  </div>
                  <button
                    onClick={handlePayBbpsBill}
                    disabled={bbpsLoading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                  >
                    {bbpsLoading ? 'Paying...' : `Pay ${formatINR(fetchedBill.amount)}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CMS & STATUS CHECK */}
          {activeTab === 'CMS' && (
            <div className="space-y-5">
              <div className="space-y-3 border-b border-slate-200 pb-5">
                <h2 className="text-base font-black text-slate-900">CMS Cash Drop</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={cmsPortal}
                    onChange={(e) => setCmsPortal(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option>Fino CMS Enterprise</option>
                    <option>Airtel CMS Portal</option>
                  </select>
                  <input
                    type="text"
                    value={cmsMobile}
                    onChange={(e) => setCmsMobile(e.target.value)}
                    placeholder="Mobile"
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={cmsAmount}
                    onChange={(e) => setCmsAmount(e.target.value)}
                    placeholder="Amount"
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
                <button
                  onClick={handleExecuteCms}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Execute CMS Drop
                </button>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-slate-900 uppercase">Transaction Lookup</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupRef}
                    onChange={(e) => setLookupRef(e.target.value)}
                    placeholder="Enter Reference ID"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                  <button
                    onClick={handleLookupRef}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Search
                  </button>
                </div>
                {lookupResult && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    {lookupResult.notFound ? (
                      <div className="text-rose-600 font-bold">Not found.</div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">
                            {lookupResult.serviceName} · {formatINR(lookupResult.amount)}
                          </div>
                          <div className="text-slate-500">
                            RRN: {lookupResult.bankRrn} · {formatDateTime(lookupResult.createdAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => setReceiptTx(lookupResult)}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Slip
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Compact Breakdown */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Transaction Summary
            </h3>

            {quote ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-slate-900">{formatINR(quote.amount)}</span>
                </div>
                {quote.surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fee</span>
                    <span className="font-bold text-amber-700">+{formatINR(quote.surcharge)}</span>
                  </div>
                )}
                {quote.totalDebit > 0 && (
                  <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 font-bold">
                    <span className="text-slate-700">Total Debit</span>
                    <span className="text-slate-900">{formatINR(quote.totalDebit)}</span>
                  </div>
                )}
                {quote.walletCredit > 0 && (
                  <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-emerald-50 font-bold">
                    <span className="text-emerald-800">Main Wallet Credit</span>
                    <span className="text-emerald-700">+{formatINR(quote.walletCredit)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-violet-50 font-bold">
                  <span className="text-violet-800">Commission</span>
                  <span className="text-violet-700">+{formatINR(quote.retailerNetComm)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Loading quote...</div>
            )}
          </div>
        </div>
      </div>

      <ReceiptModal open={!!receiptTx} onClose={() => setReceiptTx(null)} transaction={receiptTx} />
    </div>
  );
}

export default function UserServicesPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
        <ServicesContent />
      </Suspense>
    </AppShell>
  );
}
