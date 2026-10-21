import { updateLiveBankBalance, getLiveBankBalance, LiveBankBalanceState } from './live-bank-balance';
import { broadcastEvent } from './sse-hub';

export interface KotakWhatsAppParsedResult {
  isKotakBot: boolean;
  messageType: 'balance' | 'mini_statement' | 'credit_alert' | 'debit_alert' | 'unknown';
  accountEnding?: string;
  availableBalance?: number;
  currency: string;
  timestamp?: string;
  rawText: string;
  matchedPattern?: string;
}

export interface WhatsAppPayoutCard {
  orderId: string;
  retailerName: string;
  retailerMobile: string;
  amount: number;
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
  mode: string;
  createdAt: string;
}

/**
 * Official Kotak Mahindra Bank WhatsApp Banking Bot Number
 */
export const KOTAK_WHATSAPP_BOT_NUMBER = '919718566655';

/**
 * Generates an official WhatsApp click-to-chat URL to query Kotak's bot for balance.
 * When clicked on mobile or web, WhatsApp opens a chat with Kotak with "bal" pre-typed.
 */
export function getKotakWhatsAppBalanceInquiryUrl(): string {
  const encodedMsg = encodeURIComponent('bal');
  return `https://wa.me/${KOTAK_WHATSAPP_BOT_NUMBER}?text=${encodedMsg}`;
}

/**
 * Parses Kotak WhatsApp Bot replies or transaction messages.
 * Kotak WhatsApp bot formats include:
 * - "The Available Balance in your A/c ending 6033 is INR 1,48,701.00 as on 21-Oct-2026."
 * - "Bal in A/c 9974366033 is Rs.1,48,701.00"
 * - "Total Bal: INR 1,48,701.00 in A/c ...6033"
 * - "Total Bal: INR 2,15,450.00 in A/c 9974366033"
 * - "Available Balance in A/c 9974366033: INR 1,48,701.00"
 * - "Dear Customer, Bal in A/c ...6033 is Rs 1,48,701.00"
 * - "A/c ...6033 credited with INR 25,000.00. Avl Bal INR 1,48,701.00"
 */
export function parseKotakWhatsAppMessage(text: string): KotakWhatsAppParsedResult {
  const clean = text.replace(/,/g, '').trim();

  // Extract account number if mentioned (e.g. A/c ending 6033 or A/c 9974366033)
  const accMatch = clean.match(/(?:a\/c|account)\s*(?:ending|no\.?)?\s*[:\-]?\s*(\d{4,12})/i);
  const accountEnding = accMatch ? accMatch[1] : '6033';

  // 1. Check for Balance Patterns
  const balPatterns = [
    // "Total Bal: INR 215450.00 in A/c ..." or "Available Bal: Rs 148701.00"
    /(?:available\s*balance|avl\s*bal|total\s*bal|bal)\s*[:\-]?\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)/i,
    // "... is INR 148701.00"
    /(?:is|balance\s*is)\s*[:\-]?\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)/i,
    // "INR 148701.00 is available"
    /(?:inr|rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)\s*(?:is\s*(?:the)?\s*available\s*balance|available\s*in)/i,
    // Catch-all: "balance" followed anywhere by INR/Rs amount
    /balance[^\d]*?(?:inr|rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)/i,
  ];

  for (const regex of balPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const balance = parseFloat(match[1]);
      if (!isNaN(balance) && balance >= 0) {
        return {
          isKotakBot: /kotak/i.test(text) || /a\/c/i.test(text) || /bal/i.test(text),
          messageType: 'balance',
          accountEnding,
          availableBalance: balance,
          currency: 'INR',
          rawText: text,
          matchedPattern: regex.source,
        };
      }
    }
  }

  // 2. Check for credit / debit alert via WhatsApp
  const isCredit = /credit(?:ed)?/i.test(clean);
  const isDebit = /debit(?:ed)?/i.test(clean);

  const avlBalMatch = clean.match(/(?:avl|available|total)\s*(?:bal|balance)?\s*(?:is)?\s*[:\-]?\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)/i);
  const availableBal = avlBalMatch ? parseFloat(avlBalMatch[1]) : undefined;

  if (isCredit || isDebit) {
    return {
      isKotakBot: true,
      messageType: isCredit ? 'credit_alert' : 'debit_alert',
      accountEnding,
      availableBalance: availableBal,
      currency: 'INR',
      rawText: text,
    };
  }

  return {
    isKotakBot: /kotak/i.test(text),
    messageType: 'unknown',
    currency: 'INR',
    rawText: text,
  };
}

/**
 * Ingests a WhatsApp message, updates live bank balance if balance found,
 * and broadcasts SSE notification to connected dashboards.
 */
export function ingestKotakWhatsAppReply(text: string): {
  success: boolean;
  parsed: KotakWhatsAppParsedResult;
  updatedBalance?: LiveBankBalanceState;
} {
  const parsed = parseKotakWhatsAppMessage(text);

  if (parsed.availableBalance !== undefined && !isNaN(parsed.availableBalance)) {
    const updated = updateLiveBankBalance({
      bankName: 'Kotak Mahindra Bank',
      availableBalance: parsed.availableBalance,
      lastSmsText: `WhatsApp Bot (${KOTAK_WHATSAPP_BOT_NUMBER}): ${text.slice(0, 120)}...`,
      updatedAt: new Date().toISOString(),
    });

    broadcastEvent('BANK_BALANCE_UPDATED', {
      bankName: updated.bankName,
      accountNumber: updated.accountNumber,
      availableBalance: updated.availableBalance,
      updatedAt: updated.updatedAt,
      source: 'whatsapp_bot',
    });

    return {
      success: true,
      parsed,
      updatedBalance: updated,
    };
  }

  return {
    success: false,
    parsed,
  };
}

/**
 * Formats a clean WhatsApp payout card with an authentic UPI Deep-Link
 * so the admin can approve and pay with 1 tap.
 */
export function formatWhatsAppPayoutApprovalMessage(card: WhatsAppPayoutCard): {
  text: string;
  upiDeepLink: string;
  whatsappShareUrl: string;
} {
  const cleanAcc = (card.accountNumber || '').replace(/\D/g, '').trim();
  const cleanIfsc = (card.ifsc || '').trim().toUpperCase();
  const vpaTarget = card.upiId?.trim()
    ? card.upiId.trim()
    : cleanAcc && cleanIfsc
    ? `${cleanIfsc}.${cleanAcc}@ifsc.npci`
    : '';

  const params = new URLSearchParams();
  if (vpaTarget) params.set('pa', vpaTarget);
  params.set('pn', card.beneficiaryName || 'Beneficiary');
  params.set('am', card.amount.toFixed(2));
  params.set('cu', 'INR');
  params.set('tn', `MD-WD-${card.orderId}`);

  const upiDeepLink = `upi://pay?${params.toString()}`;

  const messageText = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🚨 *MONEYDRAW: WITHDRAWAL APPROVAL*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🆔 *Order ID:* #${card.orderId}`,
    `👤 *Retailer:* ${card.retailerName} (${card.retailerMobile})`,
    `💰 *Amount:* ₹${card.amount.toLocaleString('en-IN')}.00`,
    `🏦 *Beneficiary:* ${card.beneficiaryName}`,
    `🏢 *Bank:* ${card.bankName} (${card.ifsc})`,
    `🔢 *A/c Number:* ${card.accountNumber}`,
    card.upiId ? `📱 *UPI VPA:* ${card.upiId}` : null,
    `⚡ *Mode:* ${card.mode || 'IMPS'} (24x7 Instant)`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👇 *Tap below to open your Kotak/PhonePe app and pay instantly:*`,
    `${upiDeepLink}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  return {
    text: messageText,
    upiDeepLink,
    whatsappShareUrl,
  };
}
