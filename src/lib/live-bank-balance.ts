import fs from 'fs';
import path from 'path';

export interface LiveBankBalanceState {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  accountHolder: string;
  availableBalance: number;
  lastSmsText: string;
  lastUtr: string | null;
  lastTxnAmount: number | null;
  updatedAt: string;
}

const BALANCE_FILE_PATH = path.join(process.cwd(), 'data', 'live_bank_balance.json');

function getDefaultState(): LiveBankBalanceState {
  return {
    bankName: process.env.PRIMARY_BANK_NAME || 'Kotak Mahindra Bank',
    accountNumber: process.env.PRIMARY_BANK_ACCOUNT || '9974366033',
    ifsc: process.env.PRIMARY_BANK_IFSC || 'KKBK0002626',
    upiId: process.env.PRIMARY_BANK_UPI || '9974366033@kotak',
    accountHolder: process.env.PRIMARY_BANK_HOLDER || 'TEKCHANDJI CO',
    availableBalance: 148701.0,
    lastSmsText: 'Initialized from Treasury Configuration',
    lastUtr: null,
    lastTxnAmount: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getLiveBankBalance(): LiveBankBalanceState {
  const defaultState = getDefaultState();
  try {
    if (fs.existsSync(BALANCE_FILE_PATH)) {
      const raw = fs.readFileSync(BALANCE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...defaultState,
        ...parsed,
        availableBalance:
          typeof parsed.availableBalance === 'number' && !isNaN(parsed.availableBalance)
            ? parsed.availableBalance
            : defaultState.availableBalance,
        updatedAt: parsed.updatedAt || defaultState.updatedAt,
      };
    }
  } catch {
    // Fallback to default state
  }
  return defaultState;
}

export function updateLiveBankBalance(partial: Partial<LiveBankBalanceState>): LiveBankBalanceState {
  const current = getLiveBankBalance();
  const next: LiveBankBalanceState = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(BALANCE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BALANCE_FILE_PATH, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // Ignore file write errors in read-only environments
  }

  return next;
}
