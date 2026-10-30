'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Lock,
  ArrowLeftRight,
  Building2,
  Send,
  Users,
  QrCode,
  Printer,
  Copy,
  CheckCircle2,
  X,
  ExternalLink,
  Plus,
  Banknote,
  BookmarkPlus,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { formatINR } from '@/lib/format';
import { ReceiptModal, PrintableTransaction } from '@/components/shared/ReceiptModal';

function inferBankFromIfsc(ifsc: string): string {
  const prefix = (ifsc || '').trim().slice(0, 4).toUpperCase();
  const map: Record<string, string> = {
    SBIN: 'State Bank of India',
    HDFC: 'HDFC Bank',
    KKBK: 'Kotak Mahindra Bank',
    ICIC: 'ICICI Bank',
    BARB: 'Bank of Baroda',
    UTIB: 'Axis Bank',
    IDFB: 'IDFC First Bank',
    YESB: 'Yes Bank',
    INDB: 'IndusInd Bank',
    PUNB: 'Punjab National Bank',
    CNRB: 'Canara Bank',
    UBIN: 'Union Bank of India',
    BKID: 'Bank of India',
    FDRL: 'Federal Bank',
  };
  return map[prefix] || (prefix.length === 4 ? `${prefix} Bank` : '');
}

export default function UserWalletPage() {
  const { user, refreshUser, pushToast } = useApp();
  const [data, setData] = useState<any>(null);
  const [commTransferAmt, setCommTransferAmt] = useState('500');
  const [transferring, setTransferring] = useState(false);

  // Payment Mode Toggle: 'BANK' | 'USER'
  const [payTargetType, setPayTargetType] = useState<'BANK' | 'USER'>('BANK');

  // 1. Direct Bank Transfer from Main Wallet State
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankMode, setBankMode] = useState<'NEFT' | 'IFT' | 'RTGS' | 'IMPS'>('NEFT');
  const [bankTpin, setBankTpin] = useState('');
  const [saveAsBeneOnPay, setSaveAsBeneOnPay] = useState(false);
  const [sendingToBank, setSendingToBank] = useState(false);

  // 2. Direct User Transfer from Main Wallet State
  const [targetUserMobile, setTargetUserMobile] = useState('');
  const [userPayAmount, setUserPayAmount] = useState('');
  const [userPayNote, setUserPayNote] = useState('');
  const [userPayTpin, setUserPayTpin] = useState('');
  const [sendingToUser, setSendingToUser] = useState(false);

  // 3. Beneficiaries State
  const [beneficiaryAmounts, setBeneficiaryAmounts] = useState<Record<string | number, string>>({});
  const [payingBeneficiary, setPayingBeneficiary] = useState<string | number | null>(null);

  // 4. Add Beneficiary Modal State
  const [addBeneModalOpen, setAddBeneModalOpen] = useState(false);
  const [newBeneName, setNewBeneName] = useState('');
  const [newBeneAcc, setNewBeneAcc] = useState('');
  const [newBeneConfirmAcc, setNewBeneConfirmAcc] = useState('');
  const [newBeneIfsc, setNewBeneIfsc] = useState('');
  const [newBeneBank, setNewBeneBank] = useState('');
  const [savingBene, setSavingBene] = useState(false);

  // 5. Transaction Confirmation & TPIN Modal State
  const [tpinModalOpen, setTpinModalOpen] = useState(false);
  const [tpinModalData, setTpinModalData] = useState<{
    recipientName: string;
    recipientDetail: string;
    amount: number;
    actionType: 'bank' | 'user' | 'beneficiary';
    payload: any;
  } | null>(null);
  const [confirmTpinInput, setConfirmTpinInput] = useState('');
  const [confirmTpinError, setConfirmTpinError] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // 6. Top-Up / Fund Request Modal State
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('2000');
  const [topUpMode, setTopUpMode] = useState<'UPI' | 'IMPS' | 'NEFT'>('UPI');
  const [topUpUtr, setTopUpUtr] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

  // Active Payment / QR Modal State
  const [activePayRow, setActivePayRow] = useState<any | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [receiptTx, setReceiptTx] = useState<PrintableTransaction | null>(null);

  const loadWallet = useCallback(async () => {
    const mobile = user?.mobile;
    if (!mobile) return;
    const res = await fetch(`/api/wallet?mobile=${encodeURIComponent(mobile)}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (!targetUserMobile && json.otherUsers?.length > 0) {
        setTargetUserMobile(json.otherUsers[0].mobile);
      }
    }
  }, [user?.mobile, targetUserMobile]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleBankTransferFromMainWallet = async (e?: React.FormEvent, overrideData?: any) => {
    if (e) e.preventDefault();
    const holder = (overrideData?.customerName ?? bankHolderName).trim();
    const accNo = (overrideData?.accountOrVpa ?? bankAccountNo).trim();
    const ifsc = (overrideData?.ifsc ?? bankIfsc).trim().toUpperCase();
    const inferredBank = (overrideData?.bankName ?? bankName).trim() || inferBankFromIfsc(ifsc) || 'Bank Account';
    const amt = Number(overrideData?.amount ?? bankAmount ?? 0);
    const mode = overrideData?.transferMode || bankMode;
    const tpinToUse = (overrideData?.tpin || bankTpin || '').trim();

    if (!accNo || !ifsc || !holder) {
      pushToast('Missing Details', 'Please enter Account Holder Name, Bank Account Number, and IFSC Code.', 'warning');
      return;
    }
    if (amt <= 0) {
      pushToast('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.', 'warning');
      return;
    }

    // If TPIN is not entered yet in the form, prompt via the Confirmation Modal
    if (!tpinToUse) {
      if (activePayRow) {
        setActivePayRow(null);
      }
      setTpinModalData({
        recipientName: holder,
        recipientDetail: `${inferredBank} • A/c ${accNo} • ${ifsc}`,
        amount: amt,
        actionType: 'bank',
        payload: { holder, accNo, ifsc, inferredBank, amt, mode },
      });
      setConfirmTpinInput('');
      setConfirmTpinError('');
      setTpinModalOpen(true);
      return;
    }

    setSendingToBank(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          mobile: user?.mobile,
          serviceCode: 'PAYOUT',
          serviceName: `Bank Transfer (${mode})`,
          category: 'payout',
          operatorName: `${mode} Bank Transfer`,
          customerMobile: user?.mobile || '',
          customerName: holder,
          accountOrVpa: accNo,
          bankName: inferredBank,
          ifsc,
          transferMode: mode,
          amount: amt,
          tpin: tpinToUse,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');

      // Auto-save beneficiary if checked
      if (saveAsBeneOnPay) {
        fetch('/api/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_beneficiary',
            mobile: user?.mobile,
            accountHolderName: holder,
            bankName: inferredBank,
            accountNumber: accNo,
            ifsc,
          }),
        }).catch(() => {});
      }

      pushToast(
        'Payment Successful!',
        `${formatINR(amt)} paid from Main Wallet to ${holder} (A/c ${accNo} • ${ifsc})`,
        'success'
      );
      setBankAmount('');
      setBankTpin('');
      setActivePayRow(json.transaction);
      setQuickPayAmount(String(amt));
      await refreshUser();
      await loadWallet();
    } catch (err: unknown) {
      pushToast('Payment Failed', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setSendingToBank(false);
    }
  };

  const handleUserTransferFromMainWallet = async (e?: React.FormEvent, overrideMobile?: string, overrideAmt?: number, overrideTpin?: string) => {
    if (e) e.preventDefault();
    const targetMob = (overrideMobile ?? targetUserMobile).trim();
    const amt = Number(overrideAmt ?? userPayAmount ?? 0);
    const tpinToUse = (overrideTpin || userPayTpin || '').trim();

    if (!targetMob) {
      pushToast('Missing User', 'Please select or enter a recipient mobile number.', 'warning');
      return;
    }
    if (amt <= 0) {
      pushToast('Invalid Amount', 'Please enter an amount greater than ₹0.', 'warning');
      return;
    }

    // If TPIN is not entered yet in the form, prompt via the Confirmation Modal
    if (!tpinToUse) {
      const recipientObj = otherUsers.find((u: any) => u.mobile === targetMob);
      const recipientName = recipientObj?.name || targetMob;
      setTpinModalData({
        recipientName,
        recipientDetail: `MoneyDraw User Wallet • ${targetMob}`,
        amount: amt,
        actionType: 'user',
        payload: { targetMob, amt, note: userPayNote },
      });
      setConfirmTpinInput('');
      setConfirmTpinError('');
      setTpinModalOpen(true);
      return;
    }

    setSendingToUser(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'direct_user_pay',
          mobile: user?.mobile,
          targetMobile: targetMob,
          amount: amt,
          note: userPayNote,
          tpin: tpinToUse,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'User transfer failed');

      pushToast('Paid User!', json.message, 'success');
      setUserPayAmount('');
      setUserPayNote('');
      setUserPayTpin('');
      setActivePayRow(json.transaction);
      setQuickPayAmount(String(amt));
      await refreshUser();
      await loadWallet();
    } catch (err: unknown) {
      pushToast('Transfer Failed', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setSendingToUser(false);
    }
  };

  // Pay a saved beneficiary directly from main wallet - prompts for TPIN to confirm
  const handleBeneficiaryPay = (ben: any) => {
    const amt = Number(beneficiaryAmounts[ben.id] || 0);
    if (amt <= 0) {
      pushToast('Enter Amount', `Please enter the amount in the box to pay ${ben.accountHolderName}.`, 'warning');
      return;
    }
    const ifsc = (ben.ifsc || '').trim().toUpperCase();
    const inferredBank = ben.bankName || inferBankFromIfsc(ifsc) || 'Bank Account';

    setTpinModalData({
      recipientName: ben.accountHolderName,
      recipientDetail: `${inferredBank} • A/c ${ben.accountNumber} • ${ifsc}`,
      amount: amt,
      actionType: 'beneficiary',
      payload: { ben, amt, ifsc, inferredBank, mode: 'NEFT' },
    });
    setConfirmTpinInput('');
    setConfirmTpinError('');
    setTpinModalOpen(true);
  };

  // Authorize & Execute Payment from the TPIN Confirmation Modal
  const handleConfirmTpinAndExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tpinModalData) return;
    const cleanTpin = confirmTpinInput.replace(/\D/g, '').trim();
    if (!cleanTpin || cleanTpin.length < 4) {
      setConfirmTpinError('Please enter your 4 to 6 digit Security TPIN.');
      return;
    }

    setConfirmingPayment(true);
    setConfirmTpinError('');

    try {
      if (tpinModalData.actionType === 'bank') {
        const { holder, accNo, ifsc, inferredBank, amt, mode } = tpinModalData.payload;
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute',
            mobile: user?.mobile,
            serviceCode: 'PAYOUT',
            serviceName: `Bank Transfer (${mode})`,
            category: 'payout',
            operatorName: `${mode} Bank Transfer`,
            customerMobile: user?.mobile || '',
            customerName: holder,
            accountOrVpa: accNo,
            bankName: inferredBank,
            ifsc,
            transferMode: mode,
            amount: amt,
            tpin: cleanTpin,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Transfer failed');

        if (saveAsBeneOnPay) {
          fetch('/api/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_beneficiary',
              mobile: user?.mobile,
              accountHolderName: holder,
              bankName: inferredBank,
              accountNumber: accNo,
              ifsc,
            }),
          }).catch(() => {});
        }

        pushToast(
          'Payment Successful!',
          `${formatINR(amt)} paid from Main Wallet to ${holder} (A/c ${accNo} • ${ifsc})`,
          'success'
        );
        setBankAmount('');
        setBankTpin('');
        setTpinModalOpen(false);
        setActivePayRow(json.transaction);
        setQuickPayAmount(String(amt));
        await refreshUser();
        await loadWallet();
      } else if (tpinModalData.actionType === 'user') {
        const { targetMob, amt, note } = tpinModalData.payload;
        const res = await fetch('/api/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'direct_user_pay',
            mobile: user?.mobile,
            targetMobile: targetMob,
            amount: amt,
            note,
            tpin: cleanTpin,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'User transfer failed');

        pushToast('Paid User!', json.message, 'success');
        setUserPayAmount('');
        setUserPayNote('');
        setUserPayTpin('');
        setTpinModalOpen(false);
        setActivePayRow(json.transaction);
        setQuickPayAmount(String(amt));
        await refreshUser();
        await loadWallet();
      } else if (tpinModalData.actionType === 'beneficiary') {
        const { ben, amt, ifsc, inferredBank, mode } = tpinModalData.payload;
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute',
            mobile: user?.mobile,
            serviceCode: 'PAYOUT',
            serviceName: `Bank Transfer (${mode || 'NEFT'})`,
            category: 'payout',
            operatorName: `${mode || 'NEFT'} Bank Transfer`,
            customerMobile: user?.mobile || '',
            customerName: ben.accountHolderName,
            accountOrVpa: ben.accountNumber,
            bankName: inferredBank,
            ifsc,
            transferMode: mode || 'NEFT',
            amount: amt,
            tpin: cleanTpin,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Transfer failed');

        pushToast(
          'Payment Successful!',
          `${formatINR(amt)} paid from Main Wallet to ${ben.accountHolderName} (A/c ${ben.accountNumber})`,
          'success'
        );
        setBeneficiaryAmounts((prev) => ({ ...prev, [ben.id]: '' }));
        setTpinModalOpen(false);
        setActivePayRow(json.transaction);
        setQuickPayAmount(String(amt));
        await refreshUser();
        await loadWallet();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      setConfirmTpinError(msg);
      pushToast('Payment Failed', msg, 'warning');
    } finally {
      setConfirmingPayment(false);
    }
  };

  // Save a new beneficiary directly
  const handleSaveNewBeneficiary = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newBeneName.trim() || !newBeneAcc.trim() || !newBeneIfsc.trim()) {
      pushToast('Missing Details', 'Please enter Name, Account Number, and IFSC Code.', 'warning');
      return;
    }
    if (newBeneConfirmAcc && newBeneAcc.trim() !== newBeneConfirmAcc.trim()) {
      pushToast('Mismatch', 'Account number and confirmation do not match.', 'warning');
      return;
    }
    setSavingBene(true);
    try {
      const ifsc = newBeneIfsc.trim().toUpperCase();
      const detectedBank = newBeneBank.trim() || inferBankFromIfsc(ifsc) || 'Bank Account';
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_beneficiary',
          mobile: user?.mobile,
          accountHolderName: newBeneName.trim(),
          bankName: detectedBank,
          accountNumber: newBeneAcc.trim(),
          ifsc,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save beneficiary');

      pushToast('Beneficiary Saved!', `${newBeneName} added to your saved beneficiaries.`, 'success');
      setNewBeneName('');
      setNewBeneAcc('');
      setNewBeneConfirmAcc('');
      setNewBeneIfsc('');
      setNewBeneBank('');
      setAddBeneModalOpen(false);
      await loadWallet();
    } catch (err: unknown) {
      pushToast('Failed to Save', err instanceof Error ? err.message : 'Error', 'warning');
    } finally {
      setSavingBene(false);
    }
  };

  const handleDeleteBeneficiary = async (benId: any) => {
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_beneficiary',
          mobile: user?.mobile,
          beneficiaryId: benId,
        }),
      });
      if (res.ok) {
        pushToast('Beneficiary Removed', 'Beneficiary was removed.', 'info');
        await loadWallet();
      }
    } catch {
      // ignore
    }
  };

  const handleCommissionTransfer = async () => {
    setTransferring(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bucket_transfer',
          mobile: user?.mobile,
          fromBucket: 'commission',
          toBucket: 'main',
          amount: Number(commTransferAmt),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      pushToast('Transferred', json.message, 'success');
      await refreshUser();
      await loadWallet();
    } catch (err: unknown) {
      pushToast('Transfer Error', err instanceof Error ? err.message : 'Failed', 'warning');
    } finally {
      setTransferring(false);
    }
  };

  const handleSubmitTopUpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(topUpAmount);
    const cleanUtr = (topUpUtr || '').trim();
    if (!amt || amt <= 0) {
      pushToast('Invalid Amount', 'Please enter an amount greater than ₹0.', 'warning');
      return;
    }
    if (!cleanUtr || cleanUtr.length < 6) {
      pushToast('Missing UTR', 'Please enter a valid 12-digit UTR or Reference ID.', 'warning');
      return;
    }

    setSubmittingTopUp(true);
    try {
      const companyBank = data?.companyBanks?.[0] || {
        bankName: 'Kotak Mahindra Bank',
        accountNumber: '9974366033',
      };

      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_fund_request',
          mobile: user?.mobile,
          amount: amt,
          walletTarget: 'main',
          method: topUpMode === 'UPI' ? 'upi' : 'bank',
          transferMode: topUpMode,
          companyBankName: companyBank.bankName,
          companyBankAccount: companyBank.accountNumber,
          paymentReference: cleanUtr,
          note: topUpNote,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit fund request');

      pushToast('Fund Request Submitted!', `Reference: ${cleanUtr}. Awaiting Admin Approval.`, 'success');
      setTopUpAmount('2000');
      setTopUpUtr('');
      setTopUpNote('');
      setTopUpModalOpen(false);
      await loadWallet();
    } catch (err: unknown) {
      pushToast('Request Failed', err instanceof Error ? err.message : 'Error submitting request', 'warning');
    } finally {
      setSubmittingTopUp(false);
    }
  };

  const autoFillFromBeneficiary = (b: any) => {
    setBankHolderName(b.accountHolderName || '');
    setBankAccountNo(b.accountNumber || '');
    setBankIfsc(b.ifsc || '');
    setBankName(b.bankName || inferBankFromIfsc(b.ifsc || '') || '');
    setPayTargetType('BANK');
    pushToast('Auto-Filled', `Bank details for ${b.accountHolderName} loaded into form above.`, 'info');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const w = data?.wallet || user?.wallet;
  const beneficiaries: any[] = data?.beneficiaries || [];
  const otherUsers = data?.otherUsers || [];
  const fundRequests: any[] = data?.fundRequests || [];
  const primaryBank = data?.companyBanks?.[0] || {
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '9974366033',
    ifsc: 'KKBK0002626',
    accountHolderName: 'TEKCHANDJI CO',
    upiId: '9974366033@kotak',
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Wallet Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                <span>Main Wallet Balance</span>
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">{formatINR(w?.availableBalance)}</div>
              <div className="text-xs text-slate-400 mt-1">Platform Float for Customer Bank Transfers (0% Extra Fees)</div>
            </div>
            <button
              type="button"
              onClick={() => setTopUpModalOpen(true)}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Top Up / Request Funds from Admin</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                <span>Hold / Security Reserve</span>
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {formatINR((w?.holdBalance || 0) + (w?.capBalance || 0))}
              </div>
              <div className="text-xs text-slate-400 mt-1">Lien / minimum reserve balance</div>
            </div>
            <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Admin-secured float wallet without personal bank linking</span>
            </div>
          </div>
        </div>

        {/* PAY / TRANSFER FROM MAIN WALLET */}
        <div className="bg-white rounded-2xl border-2 border-blue-600/20 p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Pay / Transfer from Main Wallet ({formatINR(w?.availableBalance)})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Send money directly from your Main Wallet to any Bank Account (NEFT / IFT / RTGS / IMPS) or to another User
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPayTargetType('BANK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  payTargetType === 'BANK'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Pay to Any Bank Account
              </button>
              <button
                type="button"
                onClick={() => setPayTargetType('USER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  payTargetType === 'USER'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Pay to Other User
              </button>
            </div>
          </div>

          {payTargetType === 'BANK' ? (
            <form onSubmit={(e) => handleBankTransferFromMainWallet(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={bankHolderName}
                    onChange={(e) => setBankHolderName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account Number *</label>
                  <input
                    type="text"
                    required
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value.replace(/\s+/g, ''))}
                    placeholder="Enter Account Number"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    value={bankIfsc}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setBankIfsc(val);
                      const detected = inferBankFromIfsc(val);
                      if (detected && !bankName) setBankName(detected);
                    }}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name (Auto / Optional)</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder={inferBankFromIfsc(bankIfsc) || 'e.g. SBI / HDFC / Kotak'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Mode</label>
                  <select
                    value={bankMode}
                    onChange={(e) => setBankMode(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900"
                  >
                    <option value="NEFT">NEFT (₹0 Fee)</option>
                    <option value="IFT">Same-Bank IFT (₹0 Fee)</option>
                    <option value="RTGS">RTGS (₹0 Fee)</option>
                    <option value="IMPS">IMPS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Security TPIN *</span>
                    <span className="text-[10px] text-blue-600 font-semibold">(4-6 Digits)</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={bankTpin}
                    onChange={(e) => setBankTpin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter TPIN"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-black tracking-widest text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-bold select-none">
                    <input
                      type="checkbox"
                      checked={saveAsBeneOnPay}
                      onChange={(e) => setSaveAsBeneOnPay(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>Save to Beneficiary list automatically</span>
                  </label>
                  <button
                    type="submit"
                    disabled={sendingToBank}
                    className="w-full py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                    {sendingToBank ? 'Processing Payment...' : 'Pay Now from Main Wallet'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => handleUserTransferFromMainWallet(e)} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select User or Enter Mobile *</label>
                {otherUsers.length > 0 ? (
                  <select
                    value={targetUserMobile}
                    onChange={(e) => setTargetUserMobile(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900"
                  >
                    {otherUsers.map((u: any) => (
                      <option key={u.id} value={u.mobile}>
                        {u.name} ({u.mobile} • {u.roleName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={targetUserMobile}
                    onChange={(e) => setTargetUserMobile(e.target.value)}
                    placeholder="Mobile or Email"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={userPayAmount}
                  onChange={(e) => setUserPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-black text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remark (Optional)</label>
                <input
                  type="text"
                  value={userPayNote}
                  onChange={(e) => setUserPayNote(e.target.value)}
                  placeholder="e.g. Wallet transfer"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Security TPIN *</span>
                  <span className="text-[10px] text-blue-600 font-semibold">(4-6 Digits)</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={userPayTpin}
                  onChange={(e) => setUserPayTpin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter TPIN"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-black tracking-widest text-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={sendingToUser}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingToUser ? 'Paying...' : 'Pay User from Main Wallet'}
              </button>
            </form>
          )}
        </div>

        {/* BENEFICIARY DETAILS — Saved beneficiary bank accounts with Amount Box & Pay Button */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Beneficiary Details</span>
              </h3>
              <p className="text-xs text-slate-500">
                Your saved bank accounts — enter an amount and click <strong>Pay</strong> to transfer from Main Wallet
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                {beneficiaries.length} Saved
              </span>
              <button
                type="button"
                onClick={() => setAddBeneModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 cursor-pointer transition shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Beneficiary</span>
              </button>
            </div>
          </div>

          {beneficiaries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-3">
              <Plus className="w-8 h-8 mx-auto text-slate-300" />
              <div>
                <p className="font-bold text-slate-600">No beneficiaries added yet.</p>
                <p className="text-slate-400 mt-0.5">Click &quot;Save Beneficiary&quot; above to add your first recipient bank account.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddBeneModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add First Beneficiary
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {beneficiaries.map((ben: any) => {
                const bankLabel = ben.bankName || inferBankFromIfsc(ben.ifsc || '');
                const isVerified = ben.verified ?? (ben.verificationStatus === 'verified');
                const isPaying = payingBeneficiary === ben.id;
                return (
                  <div key={ben.id} className="px-5 py-4 flex flex-wrap items-center gap-4 hover:bg-slate-50/60 transition">
                    {/* Bank icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs font-mono">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">{ben.accountHolderName}</span>
                        {isVerified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => autoFillFromBeneficiary(ben)}
                          className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          Auto-fill in form ↑
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                        <span>
                          <span className="font-bold text-slate-700">A/c:</span>{' '}
                          <span className="font-mono text-slate-900 font-bold">{ben.accountNumber}</span>
                        </span>
                        <span>
                          <span className="font-bold text-slate-700">IFSC:</span>{' '}
                          <span className="font-mono text-slate-900">{ben.ifsc}</span>
                        </span>
                        {bankLabel && (
                          <span className="text-slate-600 font-medium">({bankLabel})</span>
                        )}
                      </div>
                    </div>

                    {/* Amount input + Pay button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">₹</span>
                        <input
                          type="number"
                          min={1}
                          value={beneficiaryAmounts[ben.id] || ''}
                          onChange={(e) =>
                            setBeneficiaryAmounts((prev) => ({ ...prev, [ben.id]: e.target.value }))
                          }
                          placeholder="Amount"
                          className="w-32 pl-7 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-black text-slate-900 bg-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isPaying}
                        onClick={() => handleBeneficiaryPay(ben)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isPaying ? 'Paying...' : 'Pay'}
                      </button>
                      {ben.type === 'payout' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBeneficiary(ben.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Remove beneficiary"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top-Up Requests History Card */}
        {fundRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Your Wallet Top-Up / Fund Requests</span>
                </h3>
                <p className="text-xs text-slate-500">Track status of bank transfers submitted for wallet credit</p>
              </div>
              <button
                type="button"
                onClick={() => setTopUpModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Request</span>
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {fundRequests.slice(0, 5).map((fr: any) => (
                <div key={fr.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="text-sm font-black">{formatINR(fr.amount)}</span>
                      <span className="font-mono text-slate-500">({fr.transferMode || 'IMPS'})</span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      UTR: <span className="font-mono font-bold text-slate-700">{fr.paymentReference}</span> • {new Date(fr.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        fr.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : fr.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {fr.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



        {/* ADD BENEFICIARY MODAL */}
        {addBeneModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookmarkPlus className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-black">Save New Beneficiary</div>
                    <div className="text-[11px] text-slate-400">Add a bank account to pay quickly from Main Wallet</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddBeneModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewBeneficiary} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={newBeneName}
                    onChange={(e) => setNewBeneName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account Number *</label>
                  <input
                    type="text"
                    required
                    value={newBeneAcc}
                    onChange={(e) => setNewBeneAcc(e.target.value.replace(/\s+/g, ''))}
                    placeholder="Enter Account Number"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Account Number *</label>
                  <input
                    type="text"
                    required
                    value={newBeneConfirmAcc}
                    onChange={(e) => setNewBeneConfirmAcc(e.target.value.replace(/\s+/g, ''))}
                    placeholder="Re-enter Account Number"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={newBeneIfsc}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setNewBeneIfsc(val);
                      const detected = inferBankFromIfsc(val);
                      if (detected && !newBeneBank) setNewBeneBank(detected);
                    }}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name (Auto-detected / Optional)</label>
                  <input
                    type="text"
                    value={newBeneBank}
                    onChange={(e) => setNewBeneBank(e.target.value)}
                    placeholder={inferBankFromIfsc(newBeneIfsc) || 'e.g. State Bank of India'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAddBeneModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBene}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
                  >
                    {savingBene ? 'Saving...' : 'Save Beneficiary'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LIVE PAYMENT & QUICK PAY MODAL */}
        {activePayRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-black">Pay & Bank Transfer Details</div>
                    <div className="text-[11px] text-slate-400">
                      {activePayRow.customerName} • {activePayRow.accountOrVpa}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActivePayRow(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Recipient Details Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Holder Name</span>
                    <span className="font-black text-slate-900">{activePayRow.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Bank Account Number</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-blue-700">{activePayRow.accountOrVpa}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activePayRow.accountOrVpa || '');
                          pushToast('Copied', activePayRow.accountOrVpa, 'info');
                        }}
                        className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">IFSC Code & Bank</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">
                        {activePayRow.ifsc} ({activePayRow.bankName})
                      </span>
                      {activePayRow.ifsc && activePayRow.ifsc !== 'WALLET-P2P' && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activePayRow.ifsc || '');
                            pushToast('Copied IFSC', activePayRow.ifsc, 'info');
                          }}
                          className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-slate-600" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">UTR / Reference</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {activePayRow.bankRrn || activePayRow.reference}
                    </span>
                  </div>
                </div>

                {/* Direct Bank Transfer Status Card */}
                {!activePayRow.accountOrVpa?.includes('@') && activePayRow.ifsc !== 'WALLET-P2P' ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          IMPS
                        </div>
                        <div>
                          <div className="text-xs font-black text-emerald-950">Direct Bank Transfer Successful</div>
                          <div className="text-[11px] text-emerald-700">Executed via Cashfree Bank Payout Rail</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                        Processed
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 text-[11px]">
                      <div>
                        <span className="text-emerald-700">Transfer Rail:</span>
                        <span className="font-bold text-slate-900 ml-1">IMPS / NEFT (Bank-to-Bank)</span>
                      </div>
                      <div>
                        <span className="text-emerald-700">Extra Charges:</span>
                        <span className="font-bold text-emerald-700 ml-1">₹0.00 (Zero Fee)</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Amount <strong>{formatINR(activePayRow.amount)}</strong> debited directly from Retailer Main Wallet and credited to beneficiary bank account.
                    </p>
                  </div>
                ) : activePayRow.qrDataUrl ? (
                  /* Only for direct UPI VPA payments */
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={activePayRow.qrDataUrl}
                      alt="UPI QR"
                      className="w-32 h-32 rounded-xl bg-white p-1.5 border border-slate-200 shrink-0"
                    />
                    <div className="space-y-2 text-center sm:text-left">
                      <div className="text-xs font-black text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                        <QrCode className="w-4 h-4 text-blue-600" />
                        <span>UPI Payment QR</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Scan with any UPI App (GPay, PhonePe, Paytm) to pay{' '}
                        <strong>{formatINR(quickPayAmount || activePayRow.amount)}</strong> directly to{' '}
                        <strong>{activePayRow.customerName}</strong> ({activePayRow.accountOrVpa}).
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* 1-Click Pay Again from Main Wallet */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <label className="block text-xs font-black text-slate-800">
                    Send Payment from Main Wallet ({formatINR(w?.availableBalance)})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={quickPayAmount}
                      onChange={(e) => setQuickPayAmount(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-black bg-white text-slate-900"
                      placeholder="Amount (₹)"
                    />
                    <button
                      type="button"
                      disabled={sendingToBank || sendingToUser}
                      onClick={() => {
                        if (activePayRow.ifsc === 'WALLET-P2P') {
                          handleUserTransferFromMainWallet(
                            undefined,
                            activePayRow.accountOrVpa,
                            Number(quickPayAmount)
                          );
                        } else {
                          handleBankTransferFromMainWallet(undefined, {
                            ...activePayRow,
                            amount: Number(quickPayAmount),
                          });
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingToBank || sendingToUser ? 'Paying...' : `Pay ${formatINR(quickPayAmount || 0)}`}
                    </button>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const tx = activePayRow;
                      setActivePayRow(null);
                      setReceiptTx(tx);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePayRow(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TPIN Confirmation Modal */}
        {tpinModalOpen && tpinModalData && (
          <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Confirm Transaction TPIN</h3>
                    <p className="text-[11px] text-slate-300">Authorize payment from Main Wallet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTpinModalOpen(false);
                    setConfirmTpinError('');
                    setConfirmTpinInput('');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmTpinAndExecute} className="p-5 space-y-4">
                {/* Transfer Summary Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Paying To:</span>
                    <span className="font-black text-slate-900">{tpinModalData.recipientName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Destination:</span>
                    <span className="font-mono text-slate-800 text-[11px]">{tpinModalData.recipientDetail}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Debit Amount:</span>
                    <span className="text-base font-black text-blue-600">{formatINR(tpinModalData.amount)}</span>
                  </div>
                </div>

                {/* TPIN Input */}
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>Enter 4-6 Digit Security TPIN *</span>
                    <span className="text-[10px] text-slate-400 font-medium">Default: 1234</span>
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    maxLength={6}
                    value={confirmTpinInput}
                    onChange={(e) => {
                      setConfirmTpinInput(e.target.value.replace(/\D/g, ''));
                      setConfirmTpinError('');
                    }}
                    placeholder="••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-center text-lg tracking-[0.4em] font-black text-slate-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  />
                  {confirmTpinError && (
                    <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                      <span>⚠</span> {confirmTpinError}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-400 text-center">
                    You can set or change your TPIN anytime from <strong>My Account &gt; Security</strong>.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTpinModalOpen(false);
                      setConfirmTpinError('');
                      setConfirmTpinInput('');
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={confirmingPayment || !confirmTpinInput}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {confirmingPayment ? 'Authorizing...' : `Confirm & Pay ${formatINR(tpinModalData.amount)}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ReceiptModal
          open={Boolean(receiptTx)}
          transaction={receiptTx}
          onClose={() => setReceiptTx(null)}
        />

        {/* Top-Up / Fund Request Modal */}
        {topUpModalOpen && (
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Top Up Wallet / Request Funds</h3>
                    <p className="text-[11px] text-slate-300">0% Gateway Fee direct Bank/UPI Deposit</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTopUpModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitTopUpRequest} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                {/* Bank / QR Payment Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
                    <span>Deposit Funds to Primary Treasury Bank:</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">0% Fee</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Bank Name</div>
                      <div className="font-black text-slate-900">{primaryBank.bankName}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Beneficiary</div>
                      <div className="font-black text-slate-900 truncate">{primaryBank.accountHolderName}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account Number</div>
                      <div className="font-mono font-black text-blue-700 flex items-center justify-between">
                        <span>{primaryBank.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(primaryBank.accountNumber);
                            pushToast('Copied', primaryBank.accountNumber, 'info');
                          }}
                          className="hover:text-blue-900 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">IFSC Code</div>
                      <div className="font-mono font-black text-slate-900 flex items-center justify-between">
                        <span>{primaryBank.ifsc}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(primaryBank.ifsc);
                            pushToast('Copied IFSC', primaryBank.ifsc, 'info');
                          }}
                          className="hover:text-slate-600 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {primaryBank.upiId && (
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase block">Instant UPI ID</span>
                        <span className="font-mono font-bold text-slate-900">{primaryBank.upiId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(primaryBank.upiId);
                          pushToast('Copied UPI', primaryBank.upiId, 'info');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold cursor-pointer hover:bg-blue-700"
                      >
                        Copy UPI
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">Deposit Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min={100}
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-black text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">Transfer Mode *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['UPI', 'IMPS', 'NEFT'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTopUpMode(m)}
                          className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            topUpMode === m
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      12-Digit Bank UTR / Reference ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={topUpUtr}
                      onChange={(e) => setTopUpUtr(e.target.value)}
                      placeholder="e.g. 429182749102"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Found in your banking/UPI payment confirmation SMS or receipt.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">Remarks / Note (Optional)</label>
                    <input
                      type="text"
                      value={topUpNote}
                      onChange={(e) => setTopUpNote(e.target.value)}
                      placeholder="e.g. Top up for store DMT payouts"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTopUpModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTopUp || !topUpUtr}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingTopUp ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
