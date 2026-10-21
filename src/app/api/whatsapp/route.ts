import { NextRequest, NextResponse } from 'next/server';
import {
  KOTAK_WHATSAPP_BOT_NUMBER,
  getKotakWhatsAppBalanceInquiryUrl,
  ingestKotakWhatsAppReply,
  formatWhatsAppPayoutApprovalMessage,
  WhatsAppPayoutCard,
} from '@/lib/whatsapp-banking';
import { getLiveBankBalance } from '@/lib/live-bank-balance';

/**
 * GET /api/whatsapp
 * Returns current status, Kotak bot link, and webhook verification.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const hubChallenge = url.searchParams.get('hub.challenge');
  const hubMode = url.searchParams.get('hub.mode');

  // Support Meta / Cloud API webhook verification handshake
  if (hubMode === 'subscribe' && hubChallenge) {
    return new NextResponse(hubChallenge, { status: 200 });
  }

  const liveBal = getLiveBankBalance();

  return NextResponse.json({
    status: 'active',
    service: 'MoneyDraw WhatsApp Banking & Payout Gateway',
    kotakBotNumber: KOTAK_WHATSAPP_BOT_NUMBER,
    kotakInquiryUrl: getKotakWhatsAppBalanceInquiryUrl(),
    currentLiveBalance: liveBal,
    supportedActions: [
      'query_balance (opens official Kotak WhatsApp chat)',
      'ingest_reply (webhook / manual sync from Kotak bot)',
      'generate_payout_alert (formats 1-tap UPI transfer message)',
    ],
  });
}

/**
 * POST /api/whatsapp
 * Handles balance sync from Kotak bot, payout alert generation, and incoming webhooks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Generate 1-Tap Payout Approval Card for WhatsApp
    if (action === 'generate_payout_alert') {
      const card: WhatsAppPayoutCard = {
        orderId: body.orderId || `WD-${Date.now().toString().slice(-4)}`,
        retailerName: body.retailerName || 'Retailer',
        retailerMobile: body.retailerMobile || '9081047006',
        amount: Number(body.amount || 5000),
        beneficiaryName: body.beneficiaryName || 'Beneficiary Name',
        bankName: body.bankName || 'State Bank of India',
        accountNumber: body.accountNumber || '123456789012',
        ifsc: body.ifsc || 'SBIN0001234',
        upiId: body.upiId || undefined,
        mode: body.mode || 'IMPS',
        createdAt: new Date().toISOString(),
      };

      const formatted = formatWhatsAppPayoutApprovalMessage(card);
      return NextResponse.json({
        success: true,
        card,
        ...formatted,
      });
    }

    // 2. Ingest Kotak WhatsApp Bot reply or message
    // Can be sent as { message: "..." }, { text: "..." }, { raw_text: "..." }
    const incomingText =
      body.text ||
      body.message ||
      body.raw_text ||
      body.body ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;

    if (!incomingText) {
      return NextResponse.json(
        { error: 'No message text provided. Please send { message: "..." }' },
        { status: 400 }
      );
    }

    const result = ingestKotakWhatsAppReply(String(incomingText));

    if (result.success && result.updatedBalance) {
      return NextResponse.json({
        success: true,
        message: `Kotak WhatsApp balance successfully synced! Available Balance: ₹${result.updatedBalance.availableBalance.toLocaleString('en-IN')}`,
        availableBalance: result.updatedBalance.availableBalance,
        liveBankBalance: result.updatedBalance,
        parsed: result.parsed,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Received WhatsApp message, but no Kotak balance figure was identified.',
      parsed: result.parsed,
      rawText: incomingText,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to process WhatsApp request' },
      { status: 500 }
    );
  }
}
