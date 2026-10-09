import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { calculateTransactionQuote } from '@/lib/commission-engine';
import { recordWalletMovement } from '@/lib/ledger';
import { broadcastEvent } from '@/lib/sse-hub';

export async function GET(req: NextRequest) {
  try {
    const mobile = req.nextUrl.searchParams.get('mobile') || '9081047006';
    const category = req.nextUrl.searchParams.get('category');
    const status = req.nextUrl.searchParams.get('status');
    const search = req.nextUrl.searchParams.get('search');
    const reference = req.nextUrl.searchParams.get('reference');

    if (reference) {
      const tx = await prisma.transaction.findUnique({ where: { reference } });
      return NextResponse.json({ transaction: tx });
    }

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isAdmin = user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'ADMIN' || user.roleCode === 'STAFF';
    const where: Record<string, unknown> = isAdmin ? {} : { userId: user.id };
    if (category && category !== 'all') where.category = category;
    if (status && status !== 'all') where.status = status;

    let transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (search) {
      const q = search.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.reference.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerMobile.toLowerCase().includes(q) ||
          t.accountOrVpa.toLowerCase().includes(q) ||
          t.operatorName.toLowerCase().includes(q) ||
          t.bankRrn.toLowerCase().includes(q)
      );
    }

    const remitters = await prisma.payoutRemitter.findMany({
      where: { userId: user.id },
      include: { beneficiaries: true },
    });

    return NextResponse.json({ transactions, remitters });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'quote') {
      const { mobile = '9081047006', serviceCode, amount } = body;
      const user = await prisma.user.findUnique({ where: { mobile } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const quote = await calculateTransactionQuote({
        userId: user.id,
        serviceCode,
        amount: Number(amount || 0),
      });
      return NextResponse.json({ quote });
    }

    if (action === 'add_remitter') {
      const { mobile = '9081047006', remitterMobile, remitterName } = body;
      const user = await prisma.user.findUnique({ where: { mobile } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const remitter = await prisma.payoutRemitter.create({
        data: {
          userId: user.id,
          mobile: String(remitterMobile),
          name: String(remitterName),
          monthlyLimit: 200000,
          usedLimit: 0,
          verified: true,
        },
        include: { beneficiaries: true },
      });
      return NextResponse.json({ remitter });
    }

    if (action === 'add_beneficiary') {
      const { remitterId, mobile = '9081047006', accountHolderName, bankName, accountNumber, ifsc } = body;
      let targetRemitterId = Number(remitterId || 0);

      if (!targetRemitterId) {
        const user = await prisma.user.findUnique({ where: { mobile } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        let remitter = await prisma.payoutRemitter.findFirst({ where: { userId: user.id } });
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
        targetRemitterId = remitter.id;
      }

      const bene = await prisma.payoutBeneficiary.create({
        data: {
          remitterId: targetRemitterId,
          accountHolderName: String(accountHolderName),
          bankName: String(bankName),
          accountNumber: String(accountNumber),
          ifsc: String(ifsc).toUpperCase(),
          verified: true,
          verifiedName: String(accountHolderName).toUpperCase() + ' (NPCI VERIFIED)',
        },
      });
      return NextResponse.json({ beneficiary: bene });
    }

    if (action === 'verify_beneficiary') {
      const { accountNumber, ifsc, accountHolderName } = body;
      return NextResponse.json({
        verified: true,
        bankRrn: `6274${Math.floor(10000000 + Math.random() * 89999999)}`,
        verifiedName: (accountHolderName || 'RAMESHBHAI PATEL').toUpperCase(),
        accountNumber,
        ifsc,
        feeCharged: 2.0,
      });
    }

    if (action === 'fetch_bill') {
      const { operatorName, consumerNumber } = body;
      const deterministicAmt =
        (String(consumerNumber || '1029').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 45 + 5) * 110;
      return NextResponse.json({
        bill: {
          consumerNumber,
          consumerName: 'SHREE KRISHNA AGRO FOOD PVT LTD',
          operatorName,
          billNumber: `BBPS-${Date.now().toString().slice(-6)}`,
          billDate: '2026-09-15',
          dueDate: '2026-10-05',
          amount: deterministicAmt,
          status: 'UNPAID',
        },
      });
    }

    if (action === 'execute') {
      const {
        mobile = '9081047006',
        serviceCode,
        serviceName,
        category,
        operatorName,
        customerMobile = '',
        customerName = '',
        accountOrVpa = '',
        bankName = '',
        ifsc = '',
        transferMode = 'IMPS',
        amount = 0,
        tpin,
        biometricDevice = 'Mantra MFS110 L1',
      } = body;

      const user = await prisma.user.findUnique({
        where: { mobile },
        include: { wallet: true },
      });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const numAmount = Number(amount || 0);
      const isInquiryOnly = serviceCode === 'AEPS_BE' || serviceCode === 'AEPS_MS';
      if (!isInquiryOnly && numAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
      }

      // Enforce Transaction PIN (TPIN) Security Check
      if (!isInquiryOnly) {
        const expectedTpin = String(user.tpin || '1234').trim();
        const enteredTpin = String(tpin || '').replace(/\D/g, '').trim();
        if (!enteredTpin) {
          return NextResponse.json(
            { error: 'Transaction Security PIN (TPIN) is required to confirm this transaction.' },
            { status: 400 }
          );
        }
        if (enteredTpin !== expectedTpin) {
          return NextResponse.json(
            { error: 'Incorrect Transaction Security PIN (TPIN). Please enter your valid 4-6 digit PIN.' },
            { status: 401 }
          );
        }
      }

      const quote = await calculateTransactionQuote({
        userId: user.id,
        serviceCode,
        amount: numAmount,
      });

      const isZeroFeeB2b =
        serviceCode === 'PAYOUT' &&
        (transferMode === 'NEFT' || transferMode === 'IFT' || transferMode === 'RTGS');
      if (isZeroFeeB2b) {
        quote.surcharge = 0;
        quote.retailerGrossComm = 0;
        quote.retailerNetComm = 0;
        quote.distributorComm = 0;
        quote.adminMargin = 0;
        quote.tds = 0;
        quote.totalDebit = numAmount;
      }

      const prefixMap: Record<string, string> = {
        PAYOUT: 'MD-PAY',
        AEPS_CW: 'MD-AEPSCW',
        AEPS_CD: 'MD-AEPSCD',
        AEPS_AP: 'MD-AEPSAP',
        AEPS_BE: 'MD-AEPSBE',
        AEPS_MS: 'MD-AEPSMS',
        RECHARGE: 'MD-RCH',
        BILLPAY: 'MD-BBPS',
        CMS: 'MD-CMS',
      };
      const prefix = prefixMap[serviceCode] || 'MD-TXN';
      const reference = `${prefix}-${Date.now().toString().slice(-6)}`;
      const ifscPrefix = String(ifsc || 'KKBK').slice(0, 4).toUpperCase();
      const bankRrn = isZeroFeeB2b
        ? `${ifscPrefix}H26281${Math.floor(100000 + Math.random() * 899999)}`
        : `6274${Math.floor(10000000 + Math.random() * 89999999)}`;
      const providerTxnId = `PRV-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

      // 1. Wallet Movement:
      // - AEPS_CW & AEPS_AP: Credits AEPS Wallet
      // - AEPS_CD: Debits AEPS Wallet
      // - PAYOUT, RECHARGE, BILLPAY, CMS: Debits Main Wallet
      if (serviceCode === 'AEPS_CW' || serviceCode === 'AEPS_AP') {
        await recordWalletMovement({
          userId: user.id,
          bucket: 'aeps',
          direction: 'credit',
          entryType: 'aeps_credit',
          amount: numAmount,
          transactionRef: reference,
          remarks: `${serviceName || serviceCode} via ${operatorName} (RRN: ${bankRrn})`,
        });
      } else if (serviceCode === 'AEPS_CD') {
        await recordWalletMovement({
          userId: user.id,
          bucket: 'aeps',
          direction: 'debit',
          entryType: 'transaction_debit',
          amount: numAmount,
          transactionRef: reference,
          remarks: `AEPS Cash Deposit to ${operatorName} (${accountOrVpa})`,
        });
      } else if (!isInquiryOnly && quote.totalDebit > 0) {
        await recordWalletMovement({
          userId: user.id,
          bucket: 'main',
          direction: 'debit',
          entryType: 'transaction_debit',
          amount: quote.totalDebit,
          transactionRef: reference,
          remarks: `${serviceName || serviceCode} - ${operatorName} (${accountOrVpa})`,
        });
      }

      // 2. Credit Retailer Commission Wallet
      if (!isInquiryOnly && quote.retailerNetComm > 0) {
        await recordWalletMovement({
          userId: user.id,
          bucket: 'commission',
          direction: 'credit',
          entryType: 'commission_credit',
          amount: quote.retailerNetComm,
          transactionRef: reference,
          remarks: `Commission earned on ${reference}`,
        });
      }

      // 3. Credit Upline Distributor Commission Wallet
      if (!isInquiryOnly && user.parentId && quote.distributorComm > 0) {
        await recordWalletMovement({
          userId: user.parentId,
          bucket: 'commission',
          direction: 'credit',
          entryType: 'commission_credit',
          amount: quote.distributorComm,
          transactionRef: reference,
          remarks: `Distributor Override on ${reference} from ${user.mobile}`,
        });
      }

      // Mini Statement Passbook Data for AEPS_MS / AEPS_BE
      const extraData =
        serviceCode === 'AEPS_MS' || serviceCode === 'AEPS_BE'
          ? {
              customerBankBalance: 42890.75,
              biometricDevice,
              pidScore: '94% (L1 Certified)',
              miniStatement: [
                { date: '29/09/2026', narration: 'UPI/CR/HARSHAD/HDFC', type: 'CR', amount: 4500.0 },
                { date: '27/09/2026', narration: 'AEPS/CW/SHREE KRISHNA', type: 'DR', amount: 2000.0 },
                { date: '24/09/2026', narration: 'PM-KISAN DBT BENEFIT', type: 'CR', amount: 2000.0 },
                { date: '20/09/2026', narration: 'TORRENT POWER BILL', type: 'DR', amount: 1420.0 },
                { date: '15/09/2026', narration: 'IMPS/CR/RAMESHBHAI', type: 'CR', amount: 12000.0 },
              ],
            }
          : { biometricDevice };

      const txRecord = await prisma.transaction.create({
        data: {
          reference,
          userId: user.id,
          userMobile: user.mobile,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          serviceCode,
          serviceName: serviceName || serviceCode,
          category: category || serviceCode.toLowerCase(),
          operatorName: operatorName || 'NPCI Switch',
          customerMobile: String(customerMobile),
          customerName: String(customerName || 'Walk-in Customer'),
          accountOrVpa: String(accountOrVpa),
          bankName: String(bankName || operatorName),
          ifsc: String(ifsc),
          transferMode: String(transferMode),
          amount: numAmount,
          surcharge: quote.surcharge,
          gst: quote.gst,
          tds: quote.tds,
          commission: isInquiryOnly ? 0 : quote.retailerNetComm,
          distributorComm: isInquiryOnly ? 0 : quote.distributorComm,
          adminMargin: isInquiryOnly ? 0 : quote.adminMargin,
          totalDebit: quote.totalDebit,
          walletBucket: quote.walletBucket,
          status: 'success',
          providerName: serviceCode.startsWith('AEPS') ? 'Fingpay L1' : serviceCode === 'PAYOUT' ? 'YesBank IMPS' : 'NPCI Central',
          providerTxnId,
          bankRrn,
          commissionChainJson: JSON.stringify(quote.chain),
          extraDataJson: JSON.stringify(extraData),
        },
      });

      let qrDataUrl = '';
      let upiUri = '';
      let targetVpa = '';
      const cleanAcc = String(accountOrVpa || '').trim();
      const cleanIfsc = String(ifsc || '').trim().toUpperCase();
      if (cleanAcc && cleanIfsc && cleanIfsc !== 'WALLET-P2P') {
        targetVpa = cleanAcc.includes('@') ? cleanAcc : `${cleanAcc}@${cleanIfsc}.ifsc.npci`;
        const params = new URLSearchParams();
        params.set('pa', targetVpa);
        params.set('pn', String(customerName || 'Beneficiary').trim());
        if (numAmount > 0) params.set('am', numAmount.toFixed(2));
        params.set('cu', 'INR');
        upiUri = `upi://pay?${params.toString()}`;
        qrDataUrl = await QRCode.toDataURL(upiUri, {
          width: 240,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
      }

      broadcastEvent('TXN_COMPLETED', {
        reference,
        serviceCode,
        serviceName: txRecord.serviceName,
        amount: numAmount,
        bankRrn,
        commission: txRecord.commission,
      });

      return NextResponse.json({
        transaction: { ...txRecord, qrDataUrl, upiUri, targetVpa },
        quote,
        extraData,
      });
    }

    return NextResponse.json({ error: 'Unknown transaction action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Transaction failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
