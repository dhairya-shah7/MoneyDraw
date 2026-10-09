import fs from 'fs';
import path from 'path';

export interface LiveBankBalanceState {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  accountHolder: string;
  availableBalance: number | null;
  lastSmsText: string;
  lastUtr: string | null;
  lastTxnAmount: number | null;
  updatedAt: string | null;
}

const BALANCE_FILE_PATH = path.join(process.cwd(), 'data', 'live_bank_balance.json');

const DEFAULT_STATE: LiveBankBalanceState = {
  bankName: 'Kotak Mahindra Bank',
  accountNumber: '9974366033',
  ifsc: 'KKBK0002626',
  upiId: '9974366033@kotak',
  accountHolder: 'AGS',
  availableBalance: null,
  lastSmsText: '',
  lastUtr: null,
  lastTxnAmount: null,
  updatedAt: null,
};

export function getLiveBankBalance(): LiveBankBalanceState {
  try {
    if (fs.existsSync(BALANCE_FILE_PATH)) {
      const raw = fs.readFileSync(BALANCE_FILE_PATH, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback to default state
  }
  return DEFAULT_STATE;
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
