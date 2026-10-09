export interface ParsedBankTransaction {
  bankName: string;
  accountNumber?: string;
  amount: number | null;
  availableBalance: number | null;
  utr: string | null;
  payerName?: string;
  rawText: string;
}

export function parseBankSms(smsText: string): ParsedBankTransaction {
  const text = (smsText || '').trim();

  // 1. Extract Alphanumeric NEFT / RTGS / IFT Bank UTR (e.g. KKBKH26281992831, BARBH26...) OR 12-digit IMPS/UPI RRN
  let utr: string | null = null;
  const utrPatterns = [
    /(?:UTR|Ref(?:erence)?\s*(?:No\.?|num)?|NEFT|RTGS|IFT)\s*[:\-\/]?\s*([A-Z]{4}[A-Z0-9]{8,18})/i,
    /\b([A-Z]{4}[HRN]\d{9,17})\b/,
    /(?:UPI\/|Ref(?:erence)?\s*(?:No\.?|num)?\s*[:\-]?\s*|UTR\s*[:\-]?\s*|Txn\s*ID\s*[:\-]?\s*|RRN\s*[:\-]?\s*)(\d{12})/i,
    /(?:UPI\s+Ref\s+No\s*)(\d{12})/i,
    /(?:IMPS\/|NEFT\/|RTGS\/)([A-Z0-9]{10,22})/i,
    /(?:\b|\D)(\d{12})(?:\b|\D)/,
  ];

  for (const pattern of utrPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      utr = match[1].toUpperCase();
      break;
    }
  }

  // 2. Extract Live Available Bank Balance (Avl Bal / Available Balance / Clear Bal / Bal)
  let availableBalance: number | null = null;
  const balancePatterns = [
    /(?:Avl\.?\s*Bal(?:ance)?|Available\s*Bal(?:ance)?|Clear\s*Bal(?:ance)?|Updated\s*Bal(?:ance)?|Total\s*Bal(?:ance)?|A\/c\s*Bal(?:ance)?)\s*(?:in\s+your\s+[A-Za-z0-9\s\/\*xX]+?)?(?:is)?\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:Bal(?:ance)?)\s*(?:is)?\s*[:\-]\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:Avl\.?\s*Bal(?:ance)?|Available\s*Bal(?:ance)?)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of balancePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed >= 0) {
        availableBalance = parsed;
        break;
      }
    }
  }

  // 3. Extract Credited Amount (INR / Rs / ₹)
  // Strip out the matched balance segment before generic Rs. matching so balance-only SMS isn't mistaken for a transaction amount
  const textWithoutBalance = text.replace(
    /(?:Avl\.?\s*Bal(?:ance)?|Available\s*Bal(?:ance)?|Clear\s*Bal(?:ance)?|Updated\s*Bal(?:ance)?|Total\s*Bal(?:ance)?|A\/c\s*Bal(?:ance)?).*$/i,
    ''
  );

  let amount: number | null = null;
  const amountPatterns = [
    /(?:credited\s+(?:by|with|for)?\s*(?:Rs\.?|INR|₹)?\s*|deposited\s*(?:Rs\.?|INR|₹)?\s*|received\s*(?:Rs\.?|INR|₹)?\s*)([\d,]+(?:\.\d{1,2})?)/i,
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:is\s+)?(?:credited|received|paid)/i,
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = textWithoutBalance.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // 4. Extract Payer Name from Bank NEFT/IMPS or GPay / PhonePe / Paytm notifications
  let payerName: string | undefined = undefined;
  const payerMatch = text.match(/(?:from|by)\s+([A-Za-z0-9@._\s]{2,28}?)(?:\s+on|\s+via|\s+in|\s+UPI|\s+UTR|\.|$)/i);
  if (payerMatch && payerMatch[1]) {
    payerName = payerMatch[1].trim();
  }

  // 5. Extract Account Number slice
  let accountNumber: string | undefined = undefined;
  const accMatch = text.match(/(?:A\/c|AC|Acct|Account)\s*(?:No\.?)?\s*[\*xX]*(\d{3,10})/i);
  if (accMatch && accMatch[1]) {
    accountNumber = accMatch[1];
  }

  // 6. Identify Bank or UPI App Source
  let bankName = 'Kotak Mahindra Bank';
  if (/Kotak|KKBK/i.test(text)) bankName = 'Kotak Mahindra Bank';
  else if (/Baroda|BARB|bob\s*World/i.test(text)) bankName = 'Bank of Baroda';
  else if (/HDFC/i.test(text)) bankName = 'HDFC Bank';
  else if (/ICICI|ICIC/i.test(text)) bankName = 'ICICI Bank';
  else if (/SBI|State Bank/i.test(text)) bankName = 'State Bank of India';
  else if (/IDFC|IDFB/i.test(text)) bankName = 'IDFC First Bank';
  else if (/Axis|UTIB/i.test(text)) bankName = 'Axis Bank';
  else if (/Yes\s*Bank|YESB/i.test(text)) bankName = 'Yes Bank';
  else if (/IndusInd|INDB/i.test(text)) bankName = 'IndusInd Bank';
  else if (/PhonePe/i.test(text)) bankName = 'PhonePe Business';
  else if (/Google\s*Pay|GPay/i.test(text)) bankName = 'Google Pay Business';
  else if (/BharatPe/i.test(text)) bankName = 'BharatPe QR';
  else if (/Paytm/i.test(text)) bankName = 'Paytm Soundbox / Bank';

  return {
    bankName,
    accountNumber,
    amount,
    availableBalance,
    utr,
    payerName,
    rawText: text,
  };
}
