export const AEPS_BANKS = [
  { id: 1, bankName: 'State Bank of India', iinno: '607094', code: 'SBIN', color: '#22409A' },
  { id: 2, bankName: 'HDFC Bank', iinno: '607152', code: 'HDFC', color: '#004C8F' },
  { id: 3, bankName: 'ICICI Bank', iinno: '508534', code: 'ICIC', color: '#F37021' },
  { id: 4, bankName: 'Bank of Baroda', iinno: '606985', code: 'BARB', color: '#F26522' },
  { id: 5, bankName: 'Punjab National Bank', iinno: '607027', code: 'PUNB', color: '#A20A3A' },
  { id: 6, bankName: 'Axis Bank', iinno: '607153', code: 'UTIB', color: '#97144D' },
  { id: 7, bankName: 'Kotak Mahindra Bank', iinno: '607420', code: 'KKBK', color: '#ED1C24' },
  { id: 8, bankName: 'Yes Bank', iinno: '607618', code: 'YESB', color: '#00549F' },
  { id: 9, bankName: 'IDFC First Bank', iinno: '608117', code: 'IDFB', color: '#9D1D27' },
  { id: 10, bankName: 'Union Bank of India', iinno: '607161', code: 'UBIN', color: '#E31837' },
  { id: 11, bankName: 'Canara Bank', iinno: '607396', code: 'CNRB', color: '#0095D9' },
  { id: 12, bankName: 'Bandhan Bank', iinno: '608088', code: 'BDBL', color: '#004B8D' },
];

export const RECHARGE_OPERATORS = {
  prepaid: [
    { code: 'JIO', name: 'Jio Prepaid', category: 'prepaid' },
    { code: 'AIRTEL', name: 'Airtel Prepaid', category: 'prepaid' },
    { code: 'VI', name: 'Vi (Vodafone Idea) Prepaid', category: 'prepaid' },
    { code: 'BSNL', name: 'BSNL Prepaid', category: 'prepaid' },
  ],
  dth: [
    { code: 'TATAPLAY', name: 'Tata Play (Tata Sky)', category: 'dth' },
    { code: 'AIRTELDTH', name: 'Airtel Digital TV', category: 'dth' },
    { code: 'DISHTV', name: 'Dish TV', category: 'dth' },
    { code: 'SUNDIRECT', name: 'Sun Direct', category: 'dth' },
    { code: 'D2H', name: 'D2H (Videocon)', category: 'dth' },
  ],
};

export const RECHARGE_CIRCLES = [
  'Gujarat', 'Maharashtra', 'Delhi NCR', 'Karnataka', 'Tamil Nadu', 'Rajasthan',
  'UP (East)', 'UP (West)', 'West Bengal', 'Madhya Pradesh', 'Punjab', 'Haryana',
  'Bihar & Jharkhand', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Odisha',
];

export const RECHARGE_PLANS = [
  { amount: 199, validity: '28 Days', data: '1.5 GB/Day', category: 'Popular', desc: 'Unlimited Voice + 1.5 GB/Day + 100 SMS/Day' },
  { amount: 299, validity: '28 Days', data: '2 GB/Day', category: 'Popular', desc: 'True 5G Unlimited + 2 GB/Day + 100 SMS/Day' },
  { amount: 349, validity: '28 Days', data: '2.5 GB/Day', category: 'Unlimited 5G', desc: 'Unlimited 5G Data + 2.5 GB/Day + OTT Bundle' },
  { amount: 749, validity: '72 Days', data: '2 GB/Day + 20 GB', category: 'Long Term', desc: '72 Days Validity + 2 GB/Day + 20 GB Extra Data' },
  { amount: 859, validity: '84 Days', data: '2 GB/Day', category: 'Long Term', desc: '84 Days Unlimited Calls + 2 GB/Day + True 5G' },
  { amount: 29, validity: '2 Days', data: '2 GB Data Pack', category: 'Data Booster', desc: 'High-speed 4G/5G Data Add-On Pack' },
];

export const BBPS_OPERATORS: Record<string, string[]> = {
  electricity: [
    'Torrent Power - Ahmedabad',
    'Torrent Power - Surat',
    'Paschim Gujarat Vij Company Limited (PGVCL)',
    'Uttar Gujarat Vij Company Limited (UGVCL)',
    'Madhya Gujarat Vij Company Limited (MGVCL)',
    'Dakshin Gujarat Vij Company Limited (DGVCL)',
    'Maharashtra State Electricity Distribution Co Ltd (MSEDCL)',
    'Tata Power - Mumbai',
    'Adani Electricity Mumbai',
    'BSES Rajdhani Power Limited - Delhi',
    'BSES Yamuna Power Limited - Delhi',
    'Bangalore Electricity Supply Co. Ltd (BESCOM)',
    'Uttar Pradesh Power Corp Ltd (UPPCL)',
    'Jaipur Vidyut Vitran Nigam (JVVNL)',
    'Tamil Nadu Electricity Board (TNEB)',
  ],
  insurance: [
    'Life Insurance Corporation of India (LIC)',
    'HDFC Life Insurance',
    'ICICI Prudential Life Insurance',
    'SBI Life Insurance',
    'Bajaj Allianz Life Insurance',
    'Max Life Insurance',
    'Tata AIA Life Insurance',
  ],
  fastag: [
    'ICICI Bank FASTag',
    'HDFC Bank FASTag',
    'SBI FASTag',
    'IDFC FIRST Bank - FASTag',
    'Axis Bank FASTag',
    'Kotak Mahindra Bank FASTag',
    'Airtel Payments Bank NETC FASTag',
    'IndusInd Bank FASTag',
  ],
  gas: [
    'Adani Total Gas Limited',
    'Gujarat Gas Limited',
    'Sabarmati Gas Limited (SGL)',
    'Mahanagar Gas Limited (MGL)',
    'Indraprastha Gas Limited (IGL)',
  ],
  water: [
    'Ahmedabad Municipal Corporation - Water',
    'Surat Municipal Corporation - Water',
    'Delhi Jal Board (DJB)',
    'Bangalore Water Supply and Sewerage Board',
    'Municipal Corporation of Greater Mumbai (MCGM)',
  ],
};

export const PROVIDER_HEALTH = [
  { name: 'Fingpay AEPS & UPI L1', service: 'AEPS / UPI Cash', latencyMs: 142, successRate: 99.4, status: 'operational' },
  { name: 'YesBank IMPS Switch', service: 'Payout / DMT', latencyMs: 185, successRate: 99.7, status: 'operational' },
  { name: 'IDFC First Payout Rail', service: 'Payout Backup', latencyMs: 210, successRate: 99.1, status: 'operational' },
  { name: 'NPCI Bharat BillPay Central', service: 'BBPS Utilities', latencyMs: 260, successRate: 98.9, status: 'operational' },
  { name: 'CyberPlat Multi-Recharge', service: 'Prepaid & DTH', latencyMs: 118, successRate: 99.6, status: 'operational' },
];
