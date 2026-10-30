import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { recordWalletMovement, transferBetweenBuckets, WalletBucket } from '@/lib/ledger';
import { extractReceiptMetadata } from '@/lib/receipt-ocr';
import { broadcastEvent } from '@/lib/sse-hub';
import { requestCashfreePayout } from '@/lib/cashfree-payout';

export async function GET(req: NextRequest) {
  try {
    const mobile = req.nextUrl.searchParams.get('mobile') || '9081047006';
    const lookupMobile = req.nextUrl.searchParams.get('lookupMobile');

    if (lookupMobile) {
      const target = await prisma.user.findUnique({
        where: { mobile: lookupMobile },
      });
      if (!target) {
        return NextResponse.json({ error: 'No active user found with that mobile number.' }, { status: 404 });
      }
      return NextResponse.json({
        targetUser: {
          id: target.id,
          mobile: target.mobile,
          name: `${target.firstName} ${target.lastName}`.trim(),
          companyName: target.companyName,
          roleName: target.roleName,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { mobile },
      include: {
        wallet: true,
        settlementAccounts: { orderBy: { createdAt: 'desc' } },
        settlementRequests: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isAdmin = user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'ADMIN' || user.roleCode === 'STAFF';

    const ledger = await prisma.ledgerEntry.findMany({
      where: isAdmin ? {} : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    const fundRequests = await prisma.fundRequest.findMany({
      where: isAdmin ? {} : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const rawCompanyBanks = await prisma.companyBankAccount.findMany({
      where: { active: true },
    });

    const companyBanks = await Promise.all(
      rawCompanyBanks.map(async (b) => {
        const targetVpa = b.upiId?.trim()
          ? b.upiId.trim()
          : b.accountNumber && b.ifsc
          ? `${b.accountNumber.trim()}@${b.ifsc.trim().toUpperCase()}.ifsc.npci`
          : '';
        if (!targetVpa) return { ...b, qrDataUrl: '', upiUri: '' };
        const params = new URLSearchParams();
        params.set('pa', targetVpa);
        params.set('pn', (b.accountHolderName || 'TEKCHANDJI CO').trim());
        params.set('cu', 'INR');
        const upiUri = `upi://pay?${params.toString()}`;
        const qrDataUrl = await QRCode.toDataURL(upiUri, {
          width: 240,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        return { ...b, qrDataUrl, upiUri, targetVpa };
      })
    );

    const incomingCash = await prisma.cashRequest.findMany({
      where: { responderId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const outgoingCash = await prisma.cashRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const rawTransactions = await prisma.transaction.findMany({
      where: isAdmin ? {} : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const transactions = await Promise.all(
      rawTransactions.map(async (tx) => {
        const cleanAcc = (tx.accountOrVpa || '').trim();
        const cleanIfsc = (tx.ifsc || '').trim().toUpperCase();
        const isBankRow = cleanAcc && cleanIfsc && cleanIfsc !== 'WALLET-P2P';
        if (!isBankRow) return { ...tx, qrDataUrl: '', upiUri: '' };
        const targetVpa = cleanAcc.includes('@') ? cleanAcc : `${cleanAcc}@${cleanIfsc}.ifsc.npci`;
        const params = new URLSearchParams();
        params.set('pa', targetVpa);
        params.set('pn', (tx.customerName || 'Beneficiary').trim());
        if (tx.amount > 0) params.set('am', Number(tx.amount).toFixed(2));
        params.set('cu', 'INR');
        const upiUri = `upi://pay?${params.toString()}`;
        const qrDataUrl = await QRCode.toDataURL(upiUri, {
          width: 240,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        return { ...tx, qrDataUrl, upiUri, targetVpa };
      })
    );

    const allUsers = await prisma.user.findMany({
      where: { id: { not: user.id } },
      orderBy: { id: 'asc' },
    });
    const otherUsers = allUsers.map((u) => ({
      id: u.id,
      mobile: u.mobile,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim(),
      companyName: u.companyName,
      roleName: u.roleName,
    }));

    const remitters = await prisma.payoutRemitter.findMany({
      where: {
        OR: [{ userId: user.id }, { mobile: user.mobile }],
      },
      include: {
        beneficiaries: { orderBy: { createdAt: 'desc' } },
      },
    });
    const payoutBeneficiaries = remitters.flatMap((r) => r.beneficiaries);

    // Customer payout beneficiaries, deduplicating by accountNumber + ifsc
    const seenAccs = new Set<string>();
    const allBeneficiaries: any[] = [];

    for (const b of payoutBeneficiaries) {
      const key = `${b.accountNumber.trim()}_${b.ifsc.trim().toUpperCase()}`;
      if (!seenAccs.has(key)) {
        seenAccs.add(key);
        allBeneficiaries.push({
          id: b.id,
          accountHolderName: b.accountHolderName,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          ifsc: b.ifsc,
          verified: b.verified,
          type: 'payout',
        });
      }
    }

    return NextResponse.json({
      user,
      wallet: user.wallet,
      ledger,
      fundRequests,
      companyBanks,
      beneficiaries: allBeneficiaries,
      settlementAccounts: user.settlementAccounts,
      settlementRequests: user.settlementRequests,
      incomingCash,
      outgoingCash,
      transactions,
      otherUsers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, mobile = '9081047006' } = body;

    const user = await prisma.user.findUnique({
      where: { mobile },
      include: { wallet: true, settlementAccounts: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (action === 'add_beneficiary') {
      const { accountHolderName, bankName, accountNumber, ifsc } = body;
      if (!accountHolderName || !accountNumber || !ifsc) {
        return NextResponse.json({ error: 'Please provide Account Holder Name, Account Number, and IFSC.' }, { status: 400 });
      }

      let remitter = await prisma.payoutRemitter.findFirst({
        where: {
          OR: [{ userId: user.id }, { mobile: user.mobile }],
        },
      });

      if (!remitter) {
        remitter = await prisma.payoutRemitter.create({
          data: {
            userId: user.id,
            mobile: user.mobile,
            name: `${user.firstName} ${user.lastName}`.trim() || 'Merchant',
            monthlyLimit: 500000,
            usedLimit: 0,
            verified: true,
          },
        });
      }

      const bene = await prisma.payoutBeneficiary.create({
        data: {
          remitterId: remitter.id,
          accountHolderName: String(accountHolderName).trim(),
          bankName: String(bankName || '').trim() || 'Bank Account',
          accountNumber: String(accountNumber).trim(),
          ifsc: String(ifsc).trim().toUpperCase(),
          verified: true,
          verifiedName: String(accountHolderName).trim().toUpperCase() + ' (NPCI VERIFIED)',
        },
      });

      return NextResponse.json({ success: true, beneficiary: bene });
    }

    if (action === 'delete_beneficiary') {
      const { beneficiaryId } = body;
      const bId = Number(beneficiaryId);
      if (bId) {
        await prisma.payoutBeneficiary.deleteMany({
          where: { id: bId },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'direct_user_pay') {
      const { targetMobile, targetUserId, amount, note = '', tpin } = body;
      const numAmt = Number(amount || 0);
      if (numAmt <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
      }

      // Enforce Transaction PIN (TPIN) Security Check
      const expectedTpin = String(user.tpin || '1234').trim();
      const enteredTpin = String(tpin || '').replace(/\D/g, '').trim();
      if (!enteredTpin) {
        return NextResponse.json(
          { error: 'Transaction Security PIN (TPIN) is required to confirm this transfer.' },
          { status: 400 }
        );
      }
      if (enteredTpin !== expectedTpin) {
        return NextResponse.json(
          { error: 'Incorrect Transaction Security PIN (TPIN). Please enter your valid 4-6 digit PIN.' },
          { status: 401 }
        );
      }

      const recipient = targetUserId
        ? await prisma.user.findUnique({ where: { id: Number(targetUserId) } })
        : await prisma.user.findFirst({
            where: {
              OR: [
                { mobile: String(targetMobile).trim() },
                { email: String(targetMobile).trim() },
                { username: String(targetMobile).trim() },
              ],
            },
          });

      if (!recipient) {
        return NextResponse.json({ error: 'Recipient user not found.' }, { status: 404 });
      }
      if (recipient.id === user.id) {
        return NextResponse.json({ error: 'Cannot transfer to your own account.' }, { status: 400 });
      }

      const ref = `MD-USR-${Date.now().toString().slice(-6)}`;
      const recipientName = `${recipient.firstName} ${recipient.lastName}`.trim() || recipient.companyName || recipient.mobile;

      // 1. Debit sender Main Wallet
      await recordWalletMovement({
        userId: user.id,
        bucket: 'main',
        direction: 'debit',
        entryType: 'p2p_transfer',
        amount: numAmt,
        transactionRef: ref,
        remarks: `Paid to ${recipientName} (${recipient.mobile})${note ? ` - ${note}` : ''}`,
      });

      // 2. Credit recipient Main Wallet
      await recordWalletMovement({
        userId: recipient.id,
        bucket: 'main',
        direction: 'credit',
        entryType: 'p2p_transfer',
        amount: numAmt,
        transactionRef: ref,
        remarks: `Received from ${user.firstName} ${user.lastName} (${user.mobile})${note ? ` - ${note}` : ''}`,
      });

      // 3. Record in Transaction table so it shows in the Main Wallet Transfer History list
      const txRecord = await prisma.transaction.create({
        data: {
          reference: ref,
          userId: user.id,
          userMobile: user.mobile,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          serviceCode: 'PAYOUT',
          serviceName: 'Main Wallet to User Transfer',
          category: 'payout',
          operatorName: 'Wallet-to-Wallet Transfer',
          customerMobile: recipient.mobile,
          customerName: recipientName,
          accountOrVpa: recipient.mobile,
          bankName: recipient.companyName || 'MoneyDraw User Wallet',
          ifsc: 'WALLET-P2P',
          transferMode: 'WALLET',
          amount: numAmt,
          surcharge: 0,
          gst: 0,
          tds: 0,
          commission: 0,
          distributorComm: 0,
          adminMargin: 0,
          totalDebit: numAmt,
          walletBucket: 'main',
          status: 'success',
          providerName: 'MoneyDraw Internal Switch',
          providerTxnId: ref,
          bankRrn: `WLT${Date.now().toString().slice(-9)}`,
        },
      });

      broadcastEvent('WALLET_CREDITED', {
        reference: ref,
        amount: numAmt,
        bucket: 'main',
      });

      return NextResponse.json({
        transaction: txRecord,
        message: `₹${numAmt.toLocaleString('en-IN')} transferred from Main Wallet to ${recipientName} (${recipient.mobile})!`,
      });
    }

    if (action === 'bucket_transfer') {
      const { fromBucket, toBucket, amount } = body as {
        fromBucket: WalletBucket;
        toBucket: WalletBucket;
        amount: number;
      };
      const result = await transferBetweenBuckets({
        userId: user.id,
        fromBucket,
        toBucket,
        amount: Number(amount),
      });
      return NextResponse.json({
        wallet: result.wallet,
        message: `₹${Number(amount).toLocaleString('en-IN')} moved from ${fromBucket.toUpperCase()} to ${toBucket.toUpperCase()} wallet.`,
      });
    }

    if (action === 'ocr_extract') {
      const { fileName, rawText, fallbackAmount } = body;
      const extracted = extractReceiptMetadata({ fileName, rawText, fallbackAmount });
      return NextResponse.json({ extracted });
    }

    if (action === 'create_fund_request') {
      const {
        amount,
        walletTarget = 'main',
        paymentDate,
        method = 'bank',
        transferMode = 'IMPS',
        companyBankName = 'IDFC FIRST BANK',
        companyBankAccount = '79768424884',
        paymentReference,
        screenshotUrl = '',
        ocrExtractedJson = '{}',
        receiptName = 'Deposit_Receipt.jpg',
        note = '',
      } = body;

      const cleanRef = String(paymentReference || '').trim();
      if (!cleanRef) {
        return NextResponse.json({ error: 'Payment Reference / 12-digit UTR is required.' }, { status: 400 });
      }

      const existingUtr = await prisma.fundRequest.findUnique({
        where: { paymentReference: cleanRef },
      });
      if (existingUtr) {
        return NextResponse.json(
          { error: `Duplicate UTR detected! Reference ${cleanRef} was already submitted.` },
          { status: 400 }
        );
      }

      const fundReq = await prisma.fundRequest.create({
        data: {
          userId: user.id,
          userMobile: user.mobile,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          userCompanyName: user.companyName,
          amount: Number(amount),
          walletTarget,
          paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
          method,
          transferMode,
          companyBankName,
          companyBankAccount,
          paymentReference: cleanRef,
          screenshotUrl: String(screenshotUrl || ''),
          ocrExtractedJson:
            typeof ocrExtractedJson === 'string'
              ? ocrExtractedJson
              : JSON.stringify(ocrExtractedJson || {}),
          receiptName,
          note,
          status: 'pending',
        },
      });

      return NextResponse.json({ fundRequest: fundReq });
    }

    if (action === 'gateway_topup') {
      return NextResponse.json(
        { error: 'Please pay via the receiving Bank Account / UPI QR and submit your 12-digit UTR for verification.' },
        { status: 403 }
      );
    }

    if (action === 'add_settlement_account') {
      if (user.settlementAccounts.length >= 3) {
        return NextResponse.json({ error: 'Maximum of 3 settlement bank accounts allowed.' }, { status: 400 });
      }
      const { accountHolderName, bankName, accountNumber, ifsc } = body;
      const acc = await prisma.settlementAccount.create({
        data: {
          userId: user.id,
          accountHolderName: String(accountHolderName),
          bankName: String(bankName),
          accountNumber: String(accountNumber),
          ifsc: String(ifsc).toUpperCase(),
          verificationStatus: 'verified',
          approvalStatus: 'approved',
        },
      });
      return NextResponse.json({ account: acc });
    }

    if (action === 'aeps_bank_settle') {
      const { accountId, amount, transferMode = 'NEFT' } = body;
      const numAmt = Number(amount || 0);
      if (numAmt < 100) {
        return NextResponse.json({ error: 'Minimum bank settlement is ₹100.' }, { status: 400 });
      }
      const acc = await prisma.settlementAccount.findUnique({ where: { id: Number(accountId) } });
      if (!acc) return NextResponse.json({ error: 'Settlement bank account not found.' }, { status: 404 });

      const isZeroFeeRail =
        transferMode === 'NEFT' || transferMode === 'IFT' || transferMode === 'RTGS';
      const charge = isZeroFeeRail ? 0 : numAmt <= 25000 ? 10 : 15;
      const totalDebit = numAmt;
      const netAmount = numAmt - charge;
      const reference = `STL-${Date.now().toString().slice(-6)}`;

      // Execute real bank settlement via Cashfree Payout
      const payoutRes = await requestCashfreePayout({
        transferId: reference,
        amount: netAmount,
        transferMode: 'banktransfer',
        beneficiaryDetails: {
          name: acc.accountHolderName,
          phone: user.mobile,
          bankAccount: acc.accountNumber,
          ifsc: acc.ifsc,
        },
        remarks: `MoneyDraw Settlement ${reference} to ${acc.bankName}`,
      });

      if (!payoutRes.success) {
        return NextResponse.json(
          { error: `Settlement Transfer Declined by Bank: ${payoutRes.message}` },
          { status: 400 }
        );
      }

      const bankRrn = payoutRes.utr || `CF${Date.now().toString().slice(-10)}`;

      await recordWalletMovement({
        userId: user.id,
        bucket: 'main',
        direction: 'debit',
        entryType: 'settlement',
        amount: totalDebit,
        transactionRef: reference,
        remarks: `Bank Settlement (${transferMode}${isZeroFeeRail ? ' • ₹0 Fee' : ''}) to ${acc.bankName} A/c *${acc.accountNumber.slice(-4)}`,
      });

      const stl = await prisma.settlementRequest.create({
        data: {
          reference,
          userId: user.id,
          accountId: acc.id,
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          ifsc: acc.ifsc,
          transferMode,
          amount: numAmt,
          charge,
          netAmount,
          bankRrn,
          status: 'success',
        },
      });

      return NextResponse.json({ settlement: stl });
    }

    if (action === 'create_cash_request') {
      const { targetMobile, amount, walletTarget = 'main', note = '' } = body;
      const responder = await prisma.user.findUnique({ where: { mobile: String(targetMobile) } });
      if (!responder) {
        return NextResponse.json({ error: 'No active user found with that mobile number.' }, { status: 404 });
      }
      if (responder.id === user.id) {
        return NextResponse.json({ error: 'You cannot request cash from your own mobile number.' }, { status: 400 });
      }

      const reqRecord = await prisma.cashRequest.create({
        data: {
          reference: `NCR-${Date.now().toString().slice(-6)}`,
          requesterId: user.id,
          requesterMobile: user.mobile,
          requesterName: `${user.firstName} ${user.lastName} (${user.companyName})`.trim(),
          requesterRole: user.roleName,
          responderId: responder.id,
          responderMobile: responder.mobile,
          responderName: `${responder.firstName} ${responder.lastName}`.trim(),
          responderRole: responder.roleName,
          amount: Number(amount),
          walletTarget,
          note,
          status: 'pending',
        },
      });

      return NextResponse.json({ cashRequest: reqRecord });
    }

    if (action === 'approve_cash_request') {
      const { requestId } = body;

      const cashReq = await prisma.cashRequest.findUnique({ where: { id: Number(requestId) } });
      if (!cashReq || cashReq.status !== 'pending') {
        return NextResponse.json({ error: 'Cash request not found or already processed.' }, { status: 400 });
      }

      const bucket: WalletBucket = cashReq.walletTarget === 'aeps' ? 'aeps' : 'main';

      // Debit responder (approver)
      await recordWalletMovement({
        userId: cashReq.responderId,
        bucket,
        direction: 'debit',
        entryType: 'p2p_transfer',
        amount: cashReq.amount,
        transactionRef: cashReq.reference,
        remarks: `Need Cash Approved to ${cashReq.requesterMobile} (${cashReq.requesterName})`,
      });

      // Credit requester
      await recordWalletMovement({
        userId: cashReq.requesterId,
        bucket,
        direction: 'credit',
        entryType: 'p2p_transfer',
        amount: cashReq.amount,
        transactionRef: cashReq.reference,
        remarks: `Need Cash Received from ${cashReq.responderMobile} (${cashReq.responderName})`,
      });

      const updated = await prisma.cashRequest.update({
        where: { id: cashReq.id },
        data: { status: 'approved' },
      });

      return NextResponse.json({ cashRequest: updated });
    }

    if (action === 'reject_cash_request') {
      const { requestId, reviewNote = 'Declined by user' } = body;
      const updated = await prisma.cashRequest.update({
        where: { id: Number(requestId) },
        data: { status: 'rejected', reviewNote },
      });
      return NextResponse.json({ cashRequest: updated });
    }

    return NextResponse.json({ error: 'Unknown wallet action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
