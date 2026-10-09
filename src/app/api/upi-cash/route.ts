import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { recordWalletMovement } from '@/lib/ledger';
import { calculateTransactionQuote } from '@/lib/commission-engine';
import { broadcastEvent } from '@/lib/sse-hub';

export async function GET(req: NextRequest) {
  try {
    const mobile = req.nextUrl.searchParams.get('mobile') || '9081047006';
    const reference = req.nextUrl.searchParams.get('reference');

    if (reference) {
      const session = await prisma.upiCashSession.findUnique({ where: { reference } });
      if (!session) return NextResponse.json({ error: 'QR session not found' }, { status: 404 });
      return NextResponse.json({ session });
    }

    const sessions = await prisma.upiCashSession.findMany({
      where: { userMobile: mobile },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    const transactions = await prisma.transaction.findMany({
      where: { userMobile: mobile, serviceCode: 'UPI_CASH' },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return NextResponse.json({ sessions, transactions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'initiate') {
      const { mobile = '9081047006', amount, tpin } = body;
      const numAmount = Number(amount || 0);

      if (numAmount < 100 || numAmount > 5000 || numAmount % 100 !== 0) {
        return NextResponse.json(
          { error: 'UPI Cash Withdrawal must be between ₹100 and ₹5,000 in multiples of ₹100.' },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({ where: { mobile } });
      if (!user) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
      if (tpin && user.tpin !== String(tpin)) {
        return NextResponse.json({ error: 'Invalid Transaction PIN (TPIN).' }, { status: 401 });
      }

      const reference = `MD-UPICW-${Date.now().toString().slice(-6)}`;
      const activeUpiAccount = await prisma.companyBankAccount.findFirst({
        where: { active: true },
        orderBy: [{ priority: 'asc' }, { currentDayVolume: 'asc' }],
      });
      const vpa = activeUpiAccount?.upiId || '9974366033@kotak';
      const payeeName = activeUpiAccount?.accountHolderName || 'AGS';
      // Omit &tr= so personal / non-merchant UPI VPAs are not rejected by UPI apps as unsigned P2M merchants
      const upiUri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(
        payeeName
      )}&am=${numAmount.toFixed(2)}&cu=INR`;

      const qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 280,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });

      const session = await prisma.upiCashSession.create({
        data: {
          reference,
          userId: user.id,
          userMobile: user.mobile,
          amount: numAmount,
          vpa,
          qrPayload: qrDataUrl,
          status: 'pending',
          expirySeconds: 180,
        },
      });

      const quote = await calculateTransactionQuote({
        userId: user.id,
        serviceCode: 'UPI_CASH',
        amount: numAmount,
      });

      return NextResponse.json({
        session,
        quote,
        bankAccount: {
          bankName: activeUpiAccount?.bankName || 'Kotak Mahindra Bank',
          accountNumber: activeUpiAccount?.accountNumber || '9974366033',
          ifsc: activeUpiAccount?.ifsc || 'KKBK0002626',
          accountHolderName: payeeName,
          upiId: vpa,
        },
      });
    }

    if (action === 'submit_utr') {
      const { reference, utr, mode = 'UPI QR / Bank Transfer' } = body;
      const cleanUtr = String(utr || '').replace(/\D/g, '');
      if (cleanUtr.length !== 12) {
        return NextResponse.json(
          { error: 'Please enter a valid 12-digit UTR / Bank Reference number.' },
          { status: 400 }
        );
      }

      const session = await prisma.upiCashSession.findUnique({ where: { reference } });
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      if (session.status === 'success') {
        return NextResponse.json({ session, message: 'Already verified and credited' });
      }

      const existingFundReq = await prisma.fundRequest.findFirst({
        where: {
          OR: [{ paymentReference: cleanUtr }, { bankUtr: cleanUtr }],
        },
      });
      if (existingFundReq) {
        return NextResponse.json(
          { error: `UTR ${cleanUtr} has already been submitted (${existingFundReq.paymentReference}).` },
          { status: 409 }
        );
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const activeBank = await prisma.companyBankAccount.findFirst({
        where: { active: true },
        orderBy: [{ priority: 'asc' }],
      });

      const fundRequest = await prisma.fundRequest.create({
        data: {
          userId: user.id,
          userMobile: user.mobile,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          userCompanyName: user.companyName || '',
          amount: session.amount,
          receivedAmount: session.amount,
          walletTarget: 'main',
          paymentDate: new Date().toISOString().slice(0, 10),
          method: 'upi',
          transferMode: mode || 'UPI',
          companyBankName: activeBank?.bankName || 'Kotak Mahindra Bank',
          companyBankAccount: activeBank?.accountNumber || '',
          paymentReference: cleanUtr,
          bankUtr: cleanUtr,
          note: `Submitted from UPI Cash / Bank Deposit (${session.reference})`,
          status: 'pending',
        },
      });

      await prisma.upiCashSession.update({
        where: { id: session.id },
        data: { status: 'submitted', bankRrn: cleanUtr },
      });

      return NextResponse.json({
        status: 'pending',
        fundRequest,
        message: `UTR ${cleanUtr} submitted! Your Main Wallet will be credited as soon as the bank transfer is approved by Admin.`,
      });
    }

    if (action === 'simulate_scan') {
      const { reference, adminMobile, payerName = 'Verified Customer', payerVpa = 'customer@upi' } = body;
      const caller = adminMobile ? await prisma.user.findUnique({ where: { mobile: adminMobile } }) : null;
      if (!caller || (caller.roleCode !== 'SUPER_ADMIN' && caller.roleCode !== 'ADMIN')) {
        return NextResponse.json(
          { error: 'Please enter your 12-digit UTR number to verify payment.' },
          { status: 403 }
        );
      }

      const session = await prisma.upiCashSession.findUnique({ where: { reference } });
      if (!session) return NextResponse.json({ error: 'QR session not found' }, { status: 404 });
      if (session.status === 'success') {
        return NextResponse.json({ session, message: 'Already settled' });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const bankRrn = `6274${Math.floor(10000000 + Math.random() * 89999999)}`;
      const providerTxnId = `FP-QR-${Date.now().toString().slice(-7)}`;
      const quote = await calculateTransactionQuote({
        userId: user.id,
        serviceCode: 'UPI_CASH',
        amount: session.amount,
      });

      // 1. Update QR Session
      const updatedSession = await prisma.upiCashSession.update({
        where: { id: session.id },
        data: {
          status: 'success',
          payerName,
          payerVpa,
          bankRrn,
          providerTxnId,
          settledAt: new Date(),
        },
      });

      // 2. Credit Merchant Main Wallet with the Cash Withdrawal Amount
      await recordWalletMovement({
        userId: user.id,
        bucket: 'main',
        direction: 'credit',
        entryType: 'fund_load',
        amount: session.amount,
        transactionRef: session.reference,
        remarks: `UPI QR Cash Collection from ${payerVpa} (RRN: ${bankRrn})`,
      });

      // 3. Credit Merchant Commission Wallet
      if (quote.retailerNetComm > 0) {
        await recordWalletMovement({
          userId: user.id,
          bucket: 'commission',
          direction: 'credit',
          entryType: 'commission_credit',
          amount: quote.retailerNetComm,
          transactionRef: session.reference,
          remarks: `Commission on UPI Cash ${session.reference}`,
        });
      }

      // 4. Credit Upline Distributor Commission Wallet
      if (user.parentId && quote.distributorComm > 0) {
        await recordWalletMovement({
          userId: user.parentId,
          bucket: 'commission',
          direction: 'credit',
          entryType: 'commission_credit',
          amount: quote.distributorComm,
          transactionRef: session.reference,
          remarks: `Downline Override from ${user.mobile} on ${session.reference}`,
        });
      }

      // 5. Create Unified Transaction Record
      const txRecord = await prisma.transaction.create({
        data: {
          reference: session.reference,
          userId: user.id,
          userMobile: user.mobile,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          serviceCode: 'UPI_CASH',
          serviceName: 'UPI Cash QR',
          category: 'upi_cash',
          operatorName: 'Dynamic UPI QR',
          customerMobile: user.mobile,
          customerName: payerName,
          accountOrVpa: payerVpa,
          bankName: 'NPCI UPI',
          amount: session.amount,
          surcharge: 0,
          tds: quote.tds,
          commission: quote.retailerNetComm,
          distributorComm: quote.distributorComm,
          adminMargin: quote.adminMargin,
          totalDebit: 0,
          walletBucket: 'main',
          status: 'success',
          providerName: 'Direct UPI',
          providerTxnId,
          bankRrn,
          commissionChainJson: JSON.stringify(quote.chain),
        },
      });

      // 6. Broadcast Real-Time SSE Event for Soundbox & Instant UI Transition
      broadcastEvent('UPI_QR_SETTLED', {
        reference: session.reference,
        amount: session.amount,
        payerName,
        payerVpa,
        bankRrn,
        commission: quote.retailerNetComm,
      });

      return NextResponse.json({
        session: updatedSession,
        transaction: txRecord,
        quote,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
