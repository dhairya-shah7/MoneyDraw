import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseBankSms } from '@/lib/bank-parser';
import { recordWalletMovement, WalletBucket } from '@/lib/ledger';
import { calculateTransactionQuote } from '@/lib/commission-engine';
import { broadcastEvent } from '@/lib/sse-hub';
import { getLiveBankBalance, updateLiveBankBalance } from '@/lib/live-bank-balance';

export async function GET() {
  return NextResponse.json({
    success: true,
    liveBankBalance: getLiveBankBalance(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      raw_sms,
      rawSms,
      smsText,
      notification_text,
      utr: directUtr,
      amount: directAmount,
      availableBalance: directBalance,
      balance: directSetBalance,
      bank_name,
      bankName,
    } = body;

    // Handle Direct Manual Balance Sync / Set
    if (action === 'set_balance' || directSetBalance !== undefined) {
      const targetBal = parseFloat(String(directSetBalance ?? directBalance));
      if (isNaN(targetBal) || targetBal < 0) {
        return NextResponse.json({ error: 'Please provide a valid balance amount (>= 0).' }, { status: 400 });
      }
      const updated = updateLiveBankBalance({
        bankName: bank_name || bankName || 'Kotak Mahindra Bank',
        availableBalance: targetBal,
        lastSmsText: `Manual sync by Admin: ₹${targetBal.toLocaleString('en-IN')}`,
        updatedAt: new Date().toISOString(),
      });

      broadcastEvent('BANK_BALANCE_UPDATED', {
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        availableBalance: updated.availableBalance,
        updatedAt: updated.updatedAt,
      });

      return NextResponse.json({
        success: true,
        balanceUpdated: true,
        availableBalance: updated.availableBalance,
        liveBankBalance: updated,
        message: `Live ${updated.bankName} (A/c ${updated.accountNumber}) balance updated to ₹${updated.availableBalance.toLocaleString('en-IN')}`,
      });
    }

    const smsContent = raw_sms || rawSms || smsText || notification_text;

    let utr = directUtr ? String(directUtr).trim() : null;
    let amount = directAmount ? parseFloat(String(directAmount)) : null;
    let availableBalance =
      directBalance !== undefined && directBalance !== null ? parseFloat(String(directBalance)) : null;
    let parsedBankName = bank_name || bankName || 'Kotak Mahindra Bank';
    let parsedPayerName: string | undefined = undefined;
    let txnType: 'credit' | 'debit' | 'balance_only' = 'balance_only';

    if (smsContent) {
      const parsed = parseBankSms(String(smsContent));
      if (!utr && parsed.utr) utr = parsed.utr;
      if (!amount && parsed.amount) amount = parsed.amount;
      if (availableBalance === null && parsed.availableBalance !== null) {
        availableBalance = parsed.availableBalance;
      }
      if (parsed.bankName) parsedBankName = parsed.bankName;
      if (parsed.payerName) parsedPayerName = parsed.payerName;
      txnType = parsed.txnType;
    }

    // Whenever an SMS contains Avl Bal / Available Balance, update the Live Bank Balance
    let liveBankBalance = getLiveBankBalance();
    if (availableBalance !== null && !isNaN(availableBalance)) {
      liveBankBalance = updateLiveBankBalance({
        bankName: parsedBankName,
        availableBalance,
        lastSmsText: smsContent ? String(smsContent).trim() : liveBankBalance.lastSmsText,
        lastUtr: utr || liveBankBalance.lastUtr,
        lastTxnAmount: amount ?? liveBankBalance.lastTxnAmount,
      });

      broadcastEvent('BANK_BALANCE_UPDATED', {
        bankName: liveBankBalance.bankName,
        accountNumber: liveBankBalance.accountNumber,
        availableBalance: liveBankBalance.availableBalance,
        updatedAt: liveBankBalance.updatedAt,
      });
    }

    // If it's a balance check SMS (no transaction amount, or explicit balance_only)
    if (txnType === 'balance_only' || (!utr && !amount && availableBalance !== null)) {
      return NextResponse.json({
        success: true,
        matched: false,
        balanceUpdated: true,
        availableBalance: liveBankBalance.availableBalance,
        liveBankBalance,
        message: `Live ${parsedBankName} Balance (A/c ${liveBankBalance.accountNumber}) synced: ₹${liveBankBalance.availableBalance.toLocaleString('en-IN')}`,
      });
    }

    // If it's a debit SMS (e.g. payout went out of bank account)
    if (txnType === 'debit') {
      return NextResponse.json({
        success: true,
        matched: false,
        txnType: 'debit',
        amount,
        utr,
        availableBalance: liveBankBalance.availableBalance,
        liveBankBalance,
        message: `${parsedBankName} Debit Notification: ₹${amount?.toLocaleString('en-IN') || 0} deducted${utr ? ` (Ref: ${utr})` : ''}. Current Avl Bal: ₹${liveBankBalance.availableBalance.toLocaleString('en-IN')}`,
      });
    }

    if (!utr && !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract a 12-digit UTR, ₹ Amount, or Avl Bal from the SMS / App notification.',
        },
        { status: 400 }
      );
    }

    const effectiveUtr = utr || `UPI${Date.now().toString().slice(-9)}`;

    // 1. Check matching pending/verifying FundRequest by UTR first
    let matchingFundReq = utr
      ? await prisma.fundRequest.findFirst({
          where: {
            paymentReference: utr,
            status: { in: ['pending', 'verifying', 'mismatch'] },
          },
        })
      : null;

    // Fallback: if no FundRequest has this exact UTR (or notification only had ₹ amount), match by pending amount
    if (!matchingFundReq && amount) {
      matchingFundReq = await prisma.fundRequest.findFirst({
        where: {
          amount,
          status: { in: ['pending', 'verifying'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (matchingFundReq) {
      // Check amount mismatch when UTR matched but amount differs
      if (amount && Math.abs(matchingFundReq.amount - amount) > 0.01) {
        const mismatched = await prisma.fundRequest.update({
          where: { id: matchingFundReq.id },
          data: {
            bankUtr: effectiveUtr,
            receivedAmount: amount,
            status: 'mismatch',
            disputeReason: `Bank credited ₹${amount} (${parsedBankName}) but request was for ₹${matchingFundReq.amount}`,
            reviewedByName: 'Auto Bank / UPI Feed',
          },
        });

        return NextResponse.json({
          success: true,
          matched: true,
          autoApproved: false,
          status: 'BANK_MISMATCH',
          fundRequest: mismatched,
          availableBalance: liveBankBalance.availableBalance,
          liveBankBalance,
          message: `Amount mismatch detected! Expected ₹${matchingFundReq.amount}, but ${parsedBankName} reported ₹${amount}. Flagged for Admin Review.`,
        });
      }

      // Exact match -> Auto-Approve & Credit Main Wallet!
      const finalAmount = amount || matchingFundReq.amount;
      const bucket: WalletBucket = 'main';

      await recordWalletMovement({
        userId: matchingFundReq.userId,
        bucket,
        direction: 'credit',
        entryType: 'fund_load',
        amount: finalAmount,
        transactionRef: `UTR-${effectiveUtr}`,
        remarks: `Auto-reconciled via ${parsedBankName} Feed (Ref ${effectiveUtr})`,
      });

      const approved = await prisma.fundRequest.update({
        where: { id: matchingFundReq.id },
        data: {
          bankUtr: effectiveUtr,
          receivedAmount: finalAmount,
          status: 'approved',
          disputeReason: '',
          reviewedByName: `Auto Feed (${parsedBankName})`,
          reviewNote: `Auto-reconciled via ${parsedBankName}`,
          reviewedAt: new Date(),
        },
      });

      // Update company bank daily volume
      if (matchingFundReq.companyBankAccount) {
        const companyBank = await prisma.companyBankAccount.findFirst({
          where: { accountNumber: matchingFundReq.companyBankAccount },
        });
        if (companyBank) {
          await prisma.companyBankAccount.update({
            where: { id: companyBank.id },
            data: { currentDayVolume: (companyBank.currentDayVolume || 0) + finalAmount },
          });
        }
      }

      broadcastEvent('WALLET_CREDITED', {
        reference: `UTR-${effectiveUtr}`,
        amount: finalAmount,
        bucket,
      });

      return NextResponse.json({
        success: true,
        matched: true,
        autoApproved: true,
        status: 'APPROVED',
        fundRequest: approved,
        availableBalance: liveBankBalance.availableBalance,
        liveBankBalance,
        message: `Fund Request #${approved.id} for ₹${finalAmount.toLocaleString('en-IN')} verified & credited to Main Wallet via ${parsedBankName}! Live Bank Avl Bal: ₹${liveBankBalance.availableBalance.toLocaleString('en-IN')}`,
      });
    }

    // 2. Also check pending UPI Cash QR sessions
    const pendingQr = await prisma.upiCashSession.findFirst({
      where: {
        status: 'pending',
        ...(amount ? { amount } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingQr) {
      const user = await prisma.user.findUnique({ where: { id: pendingQr.userId } });
      if (user) {
        const quote = await calculateTransactionQuote({
          userId: user.id,
          serviceCode: 'UPI_CASH',
          amount: pendingQr.amount,
        });

        const payerLabel = parsedPayerName || `${parsedBankName} Customer`;

        await prisma.upiCashSession.update({
          where: { id: pendingQr.id },
          data: {
            status: 'success',
            payerName: payerLabel,
            payerVpa: 'verified@upi',
            bankRrn: effectiveUtr,
            providerTxnId: `NPCI-${effectiveUtr}`,
            settledAt: new Date(),
          },
        });

        await recordWalletMovement({
          userId: user.id,
          bucket: 'main',
          direction: 'credit',
          entryType: 'fund_load',
          amount: pendingQr.amount + quote.retailerNetComm,
          transactionRef: pendingQr.reference,
          remarks: `UPI QR Settled via ${parsedBankName} (Ref ${effectiveUtr})`,
        });

        broadcastEvent('UPI_QR_SETTLED', {
          reference: pendingQr.reference,
          amount: pendingQr.amount,
          payerName: payerLabel,
          bankRrn: effectiveUtr,
        });

        return NextResponse.json({
          success: true,
          matched: true,
          autoApproved: true,
          status: 'UPI_QR_SETTLED',
          availableBalance: liveBankBalance.availableBalance,
          liveBankBalance,
          message: `Pending UPI QR (${pendingQr.reference}) for ₹${pendingQr.amount} auto-settled to Main Wallet via ${parsedBankName} (Ref ${effectiveUtr})! Live Bank Avl Bal: ₹${liveBankBalance.availableBalance.toLocaleString('en-IN')}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      matched: false,
      utr: effectiveUtr,
      amount,
      availableBalance: liveBankBalance.availableBalance,
      liveBankBalance,
      bank: parsedBankName,
      message: `Parsed ${utr ? `UTR ${utr}` : 'notification'}${amount ? ` (₹${amount.toLocaleString('en-IN')})` : ''} from ${parsedBankName}. Live Bank Avl Bal: ₹${liveBankBalance.availableBalance.toLocaleString('en-IN')}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed processing bank / notification feed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
