'use client';

import React, { useState } from 'react';
import { Printer, Share2, CheckCircle2, X, Award, FileText, Receipt } from 'lucide-react';
import { formatINR, formatDateTime, amountToWordsINR } from '@/lib/format';

export interface PrintableTransaction {
  reference: string;
  serviceName: string;
  operatorName: string;
  customerName?: string;
  customerMobile?: string;
  accountOrVpa?: string;
  bankName?: string;
  ifsc?: string;
  amount: number;
  surcharge?: number;
  commission?: number;
  totalDebit?: number;
  status: string;
  bankRrn?: string;
  providerTxnId?: string;
  createdAt?: string;
}

export function ReceiptModal({
  open,
  onClose,
  transaction,
  certificateUser,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: PrintableTransaction | null;
  certificateUser?: {
    name: string;
    companyName: string;
    mobile: string;
    panNumber: string;
    city: string;
    state: string;
    pinCode: string;
    roleName: string;
  } | null;
}) {
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');

  if (!open) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleWhatsAppShare = () => {
    if (!transaction) return;
    const text = `*MoneyDraw Official Receipt*\nRef: ${transaction.reference}\nService: ${transaction.serviceName}\nAmount: ${formatINR(
      transaction.amount
    )}\nStatus: ${transaction.status.toUpperCase()}\nBank RRN: ${transaction.bankRrn || 'N/A'}\nDate: ${formatDateTime(
      transaction.createdAt || new Date()
    )}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {certificateUser ? (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                <Award className="w-5 h-5 text-blue-600" />
                MoneyDraw Retailer Authorization Certificate
              </span>
            ) : (
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setFormat('thermal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    format === 'thermal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  80mm Thermal POS
                </button>
                <button
                  onClick={() => setFormat('a4')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    format === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  A4 Tax Voucher
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {transaction && (
              <button
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-6 bg-slate-100/60 flex justify-center">
          {certificateUser ? (
            <div className="bg-white border-4 border-double border-blue-700 rounded-xl p-8 w-full shadow-sm text-center space-y-5">
              <div className="flex justify-center items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-xl flex items-center justify-center">
                  M
                </div>
                <div className="text-left">
                  <div className="text-xl font-black tracking-tight text-slate-900">MoneyDraw</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    Authorized Banking & Payment Network
                  </div>
                </div>
              </div>
              <div className="border-y border-slate-200 py-3">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  Certificate of Merchant Authorization
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">{certificateUser.companyName}</div>
                <div className="text-sm font-semibold text-slate-600">
                  Proprietor / Authorized Signatory: <span className="text-slate-900">{certificateUser.name}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
                This certifies that the above establishment is an officially verified and KYC-approved{' '}
                <strong className="text-slate-900">{certificateUser.roleName}</strong> Banking Correspondent & Customer
                Service Point on the <strong>MoneyDraw Fintech Network</strong>, authorized to conduct AEPS Biometric
                Banking, Domestic Money Transfers (DMT), UPI Cash Withdrawals, BBPS Utility Bill Payments, and Recharges.
              </p>
              <div className="grid grid-cols-3 gap-3 text-left bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-400 font-medium">Merchant ID</div>
                  <div className="font-bold text-slate-900">MD-{certificateUser.mobile}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-medium">Verified PAN</div>
                  <div className="font-bold text-slate-900">{certificateUser.panNumber}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-medium">Location</div>
                  <div className="font-bold text-slate-900">
                    {certificateUser.city}, {certificateUser.state} - {certificateUser.pinCode}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 text-xs text-slate-500 border-t border-slate-200">
                <div>Issued by: MoneyDraw Compliance & Settlement Desk</div>
                <div className="font-bold text-emerald-700">✓ eKYC & NPCI L1 Active</div>
              </div>
            </div>
          ) : transaction && format === 'thermal' ? (
            /* 80mm Thermal POS Receipt */
            <div className="bg-white border border-slate-300 rounded-lg p-5 w-[330px] shadow-sm font-mono text-xs text-slate-900 space-y-3">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="text-base font-black tracking-tight">MONEYDRAW POS</div>
                <div className="text-[11px] text-slate-500">Shree Krishna Agro Food · Ahmedabad</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Merchant ID: 9081047006</div>
              </div>

              <div className="flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-800 rounded font-sans font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {transaction.status.toUpperCase()}
              </div>

              <div className="text-center py-1">
                <div className="text-[10px] text-slate-500 uppercase">Transaction Amount</div>
                <div className="text-2xl font-black text-slate-900">{formatINR(transaction.amount)}</div>
              </div>

              <div className="border-y border-dashed border-slate-300 py-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Ref:</span>
                  <span className="font-bold">{transaction.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Service:</span>
                  <span className="font-bold text-right">{transaction.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operator/Bank:</span>
                  <span className="font-bold text-right">{transaction.operatorName}</span>
                </div>
                {transaction.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-right">{transaction.customerName}</span>
                  </div>
                )}
                {transaction.accountOrVpa && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">A/c or VPA:</span>
                    <span className="font-bold text-right">{transaction.accountOrVpa}</span>
                  </div>
                )}
                {transaction.bankRrn && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank RRN/UTR:</span>
                    <span className="font-bold">{transaction.bankRrn}</span>
                  </div>
                )}
                {(transaction.surcharge ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fee / Surcharge:</span>
                    <span className="font-bold">{formatINR(transaction.surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & Time:</span>
                  <span>{formatDateTime(transaction.createdAt || new Date())}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                Thank you for transacting with MoneyDraw!
                <br />
                100% NPCI & RBI Compliant Banking Point
              </div>
            </div>
          ) : transaction ? (
            /* A4 Official Voucher */
            <div className="bg-white border border-slate-200 rounded-xl p-7 w-full shadow-xs space-y-5 text-xs">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xl font-black text-blue-600">MoneyDraw</div>
                  <div className="text-slate-500 font-medium">Official Transaction Confirmation Voucher</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Retailer: Shree Krishna Agro Food (9081047006)
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {transaction.status.toUpperCase()}
                  </span>
                  <div className="text-slate-500 mt-1.5">Ref: {transaction.reference}</div>
                  <div className="text-slate-400">{formatDateTime(transaction.createdAt || new Date())}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-slate-400">Service Category</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{transaction.serviceName}</div>
                  <div className="text-slate-600 mt-0.5">{transaction.operatorName}</div>
                </div>
                <div>
                  <div className="text-slate-400">Beneficiary / Payer Details</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {transaction.customerName || 'Verified Customer'}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {transaction.accountOrVpa || transaction.customerMobile || '—'}{' '}
                    {transaction.ifsc ? `(${transaction.ifsc})` : ''}
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-2.5 border-b border-slate-200">Description</th>
                    <th className="text-left p-2.5 border-b border-slate-200">Bank RRN / UTR</th>
                    <th className="text-right p-2.5 border-b border-slate-200">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border-b border-slate-100 font-medium">Principal Transaction Amount</td>
                    <td className="p-2.5 border-b border-slate-100 font-mono">{transaction.bankRrn || '—'}</td>
                    <td className="p-2.5 border-b border-slate-100 text-right font-bold">
                      {formatINR(transaction.amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-b border-slate-100 text-slate-500">Convenience / Service Surcharge</td>
                    <td className="p-2.5 border-b border-slate-100 text-slate-400">Incl. 18% GST</td>
                    <td className="p-2.5 border-b border-slate-100 text-right">
                      {formatINR(transaction.surcharge || 0)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/50 font-bold text-slate-900">
                    <td className="p-2.5" colSpan={2}>
                      Total Value ({amountToWordsINR(transaction.amount + (transaction.surcharge || 0))})
                    </td>
                    <td className="p-2.5 text-right text-sm text-blue-700">
                      {formatINR(transaction.amount + (transaction.surcharge || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2">
                <span>Computer generated tax voucher — no physical signature required.</span>
                <span className="font-semibold text-slate-600">Powered by MoneyDraw Enterprise Switch</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
