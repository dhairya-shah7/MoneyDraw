import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MoneyDraw database...');

  // Clean existing tables
  await prisma.settlementRequest.deleteMany();
  await prisma.settlementAccount.deleteMany();
  await prisma.cashRequest.deleteMany();
  await prisma.fundRequest.deleteMany();
  await prisma.companyBankAccount.deleteMany();
  await prisma.upiCashSession.deleteMany();
  await prisma.payoutBeneficiary.deleteMany();
  await prisma.payoutRemitter.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.commissionSlab.deleteMany();
  await prisma.commissionScheme.deleteMany();
  await prisma.service.deleteMany();
  await prisma.onboardingApplication.deleteMany();
  await prisma.user.deleteMany();

  // 1. Services
  await prisma.service.createMany({
    data: [
      { code: 'UPI_CASH', name: 'UPI Cash Withdrawal', category: 'upi_cash', active: true, requiresKyc: true, tpinRequired: true, minAmount: 100, maxAmount: 5000, primaryProvider: 'Fingpay', backupProvider: 'PaySprint' },
      { code: 'AEPS', name: 'AEPS Biometric Banking', category: 'aeps', active: true, requiresKyc: true, tpinRequired: false, minAmount: 100, maxAmount: 10000, primaryProvider: 'Fingpay', backupProvider: 'Eko' },
      { code: 'PAYOUT', name: 'Payout / Bank Transfer (DMT)', category: 'payout', active: true, requiresKyc: true, tpinRequired: true, minAmount: 100, maxAmount: 200000, primaryProvider: 'YesBank', backupProvider: 'IDFC First' },
      { code: 'RECHARGE', name: 'Mobile & DTH Recharge', category: 'recharge', active: true, requiresKyc: true, tpinRequired: true, minAmount: 10, maxAmount: 10000, primaryProvider: 'CyberPlat', backupProvider: 'MRobotics' },
      { code: 'BILLPAY', name: 'Utility Bill Payment (BBPS)', category: 'billpay', active: true, requiresKyc: true, tpinRequired: true, minAmount: 10, maxAmount: 2000000, primaryProvider: 'NPCI BBPS', backupProvider: 'PaySprint BBPS' },
      { code: 'CMS', name: 'Cash Management Service (CMS)', category: 'cms', active: true, requiresKyc: true, tpinRequired: true, minAmount: 100, maxAmount: 500000, primaryProvider: 'Fino CMS', backupProvider: 'Airtel CMS' },
      { code: 'ACCOUNT_VERIFY', name: 'Penny-Drop Account Verification', category: 'account_verify', active: true, requiresKyc: true, tpinRequired: true, minAmount: 1, maxAmount: 1000, primaryProvider: 'YesBank', backupProvider: 'Cashfree' },
    ],
  });

  // 2. Commission Scheme & Slabs (Zero Over-Payment Validated Slabs)
  const goldScheme = await prisma.commissionScheme.create({
    data: {
      name: 'MoneyDraw Prime Retailer Scheme',
      roleCode: 'RETAILER',
      isDefault: true,
      active: true,
      slabs: {
        create: [
          // Payout / DMT Slabs (Surcharge model + Retailer Rebate + Distributor Override + Platform Net)
          { serviceCode: 'PAYOUT', operatorCode: 'ALL', minAmount: 100, maxAmount: 1000, chargeType: 'flat', surcharge: 10, retailerComm: 3.5, distributorComm: 1.5, adminMargin: 5.0, gstPercent: 18, tdsPercent: 5 },
          { serviceCode: 'PAYOUT', operatorCode: 'ALL', minAmount: 1001, maxAmount: 5000, chargeType: 'percent', surcharge: 1.0, retailerComm: 0.35, distributorComm: 0.15, adminMargin: 0.50, gstPercent: 18, tdsPercent: 5 },
          { serviceCode: 'PAYOUT', operatorCode: 'ALL', minAmount: 5001, maxAmount: 25000, chargeType: 'percent', surcharge: 0.85, retailerComm: 0.30, distributorComm: 0.12, adminMargin: 0.43, gstPercent: 18, tdsPercent: 5 },
          { serviceCode: 'PAYOUT', operatorCode: 'ALL', minAmount: 25001, maxAmount: 200000, chargeType: 'flat', surcharge: 150, retailerComm: 45, distributorComm: 20, adminMargin: 85, gstPercent: 18, tdsPercent: 5 },
          // AEPS Cash Withdrawal Slabs (Commission earned by Retailer & Distributor)
          { serviceCode: 'AEPS', operatorCode: 'ALL', minAmount: 100, maxAmount: 999, chargeType: 'flat', surcharge: 0, retailerComm: 2.0, distributorComm: 0.5, adminMargin: 1.0, gstPercent: 0, tdsPercent: 5 },
          { serviceCode: 'AEPS', operatorCode: 'ALL', minAmount: 1000, maxAmount: 2999, chargeType: 'flat', surcharge: 0, retailerComm: 5.5, distributorComm: 1.5, adminMargin: 2.0, gstPercent: 0, tdsPercent: 5 },
          { serviceCode: 'AEPS', operatorCode: 'ALL', minAmount: 3000, maxAmount: 10000, chargeType: 'flat', surcharge: 0, retailerComm: 11.0, distributorComm: 2.5, adminMargin: 3.5, gstPercent: 0, tdsPercent: 5 },
          // UPI Cash Withdrawal Slabs
          { serviceCode: 'UPI_CASH', operatorCode: 'ALL', minAmount: 100, maxAmount: 5000, chargeType: 'percent', surcharge: 0, retailerComm: 0.40, distributorComm: 0.10, adminMargin: 0.25, gstPercent: 0, tdsPercent: 5 },
          // Recharge Slabs
          { serviceCode: 'RECHARGE', operatorCode: 'ALL', minAmount: 10, maxAmount: 10000, chargeType: 'percent', surcharge: 0, retailerComm: 2.20, distributorComm: 0.40, adminMargin: 0.60, gstPercent: 0, tdsPercent: 5 },
          // BillPay (BBPS) Slabs
          { serviceCode: 'BILLPAY', operatorCode: 'ALL', minAmount: 10, maxAmount: 2000000, chargeType: 'flat', surcharge: 0, retailerComm: 4.50, distributorComm: 1.00, adminMargin: 2.00, gstPercent: 0, tdsPercent: 5 },
          // CMS Slabs
          { serviceCode: 'CMS', operatorCode: 'ALL', minAmount: 100, maxAmount: 500000, chargeType: 'percent', surcharge: 0, retailerComm: 0.15, distributorComm: 0.05, adminMargin: 0.08, gstPercent: 0, tdsPercent: 5 },
        ],
      },
    },
  });

  // 3. Users: Super Admin, Staff, Distributor, Retailer
  const superAdmin = await prisma.user.create({
    data: {
      username: process.env.INITIAL_ADMIN_EMAIL || 'admin@hunarpay.com',
      mobile: process.env.INITIAL_ADMIN_MOBILE || '9999999999',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@hunarpay.com',
      passwordHash: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123',
      tpin: '1234',
      firstName: process.env.INITIAL_ADMIN_NAME || 'Super Admin',
      lastName: '',
      roleCode: 'SUPER_ADMIN',
      roleName: 'Super Admin',
      companyName: 'MoneyDraw Direct Gateway',
      businessType: 'Headquarters',
      address: 'Financial Operations HQ',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380015',
      panNumber: 'AAACM9999A',
      aadhaarNumber: '999988887777',
      canCreateDownline: true,
      isCmsAepsHead: true,
      isBusinessManager: true,
      schemeId: goldScheme.id,
      wallet: {
        create: {
          availableBalance: 2500000,
          aepsBalance: 840000,
          commissionBalance: 148520,
          holdBalance: 0,
          capBalance: 0,
        },
      },
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      username: '8000000002',
      mobile: '8000000002',
      email: 'lavina.ops@moneydraw.in',
      passwordHash: 'Admin@123',
      tpin: '1234',
      firstName: 'Lavina',
      lastName: 'Sharma',
      roleCode: 'STAFF',
      roleName: 'Operations Staff',
      parentId: superAdmin.id,
      parentName: 'MoneyDraw Fintech Pvt Ltd',
      parentMobile: '9999999999',
      companyName: 'MoneyDraw Treasury Desk',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380015',
      panNumber: 'BBDPS1122K',
      aadhaarNumber: '777766665555',
      wallet: {
        create: {
          availableBalance: 0,
          aepsBalance: 0,
          commissionBalance: 0,
        },
      },
    },
  });

  const distributor = await prisma.user.create({
    data: {
      username: '7506007000',
      mobile: '7506007000',
      email: 'agscorp@moneydraw.in',
      passwordHash: 'Admin@123',
      tpin: '1234',
      firstName: 'Rajesh',
      lastName: 'Patel',
      roleCode: 'DISTRIBUTOR',
      roleName: 'Master Distributor',
      parentId: superAdmin.id,
      parentName: 'MoneyDraw Fintech Pvt Ltd',
      parentMobile: '9999999999',
      companyName: 'AGS CORPORATION',
      businessType: 'Distributor',
      address: 'CG Road Commercial Hub',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380009',
      panNumber: 'AABCA7506D',
      aadhaarNumber: '665544332211',
      canCreateDownline: true,
      isBusinessManager: true,
      schemeId: goldScheme.id,
      wallet: {
        create: {
          availableBalance: 485000,
          aepsBalance: 120000,
          commissionBalance: 18450.75,
          holdBalance: 0,
          capBalance: 10000,
        },
      },
    },
  });

  const retailer = await prisma.user.create({
    data: {
      username: '9081047006',
      mobile: '9081047006',
      email: 'mmmaliya653@gmail.com',
      passwordHash: 'Ankit@0888',
      tpin: '1234',
      firstName: 'Gelot',
      lastName: 'Mahendrakumar mangalji',
      roleCode: 'RETAILER',
      roleName: 'Retailer',
      parentId: distributor.id,
      parentName: 'AGS CORPORATION',
      parentMobile: '7506007000',
      companyName: 'Shree Krishna agro food',
      businessType: 'Retail',
      address: 'Makarba',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380051',
      dob: '2004-03-16',
      panNumber: 'DSCPG3386N',
      aadhaarNumber: '878998056996',
      canCreateDownline: true,
      needCashEnabled: true,
      isCmsAepsHead: true,
      isBusinessManager: true,
      schemeId: goldScheme.id,
      aepsOnboarded: true,
      aepsMerchantKyc: true,
      aepsBankKyc: true,
      aepsDaily2faDate: new Date().toISOString().slice(0, 10),
      wallet: {
        create: {
          availableBalance: 64500.00,
          aepsBalance: 28400.00,
          commissionBalance: 1842.50,
          holdBalance: 0,
          capBalance: 0,
        },
      },
    },
  });

  // Also add a second Retailer under AGS Corporation for P2P Need Cash & Downline demos
  const retailer2 = await prisma.user.create({
    data: {
      username: '8806802036',
      mobile: '8806802036',
      email: 'sagar.traders@gmail.com',
      passwordHash: 'Admin@123',
      tpin: '1234',
      firstName: 'Sagar',
      lastName: 'Chaudhary',
      roleCode: 'RETAILER',
      roleName: 'Retailer',
      parentId: distributor.id,
      parentName: 'AGS CORPORATION',
      parentMobile: '7506007000',
      companyName: 'Sagar Digital Seva Kendra',
      businessType: 'Retail',
      address: 'Satellite Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380015',
      panNumber: 'Ertps8806C',
      aadhaarNumber: '554433221199',
      schemeId: goldScheme.id,
      wallet: {
        create: {
          availableBalance: 32100,
          aepsBalance: 14500,
          commissionBalance: 640,
        },
      },
    },
  });

  // 4. Company Bank Accounts (Real KKBK / Kotak Account)
  await prisma.companyBankAccount.createMany({
    data: [
      {
        label: 'Primary Kotak Bank & UPI',
        bankName: 'KKBK (Kotak Mahindra Bank)',
        accountHolderName: 'TEKCHANDJI CO',
        accountNumber: '9974366033',
        ifsc: 'KKBK0002626',
        upiId: '9974366033@kotak',
        active: true,
      },
    ],
  });

  // 5. Settlement Bank Account for Retailer (9081047006 - Yes Bank from live profile)
  const settlementAcc = await prisma.settlementAccount.create({
    data: {
      userId: retailer.id,
      accountHolderName: 'Gelot Mahendrakumar mangalji',
      bankName: 'Yes Bank',
      accountNumber: '039261900000671',
      ifsc: 'YESB0000392',
      verificationStatus: 'verified',
      approvalStatus: 'approved',
    },
  });

  // 6. Payout Remitter & Beneficiaries for Retailer
  const remitter = await prisma.payoutRemitter.create({
    data: {
      userId: retailer.id,
      mobile: '9825011223',
      name: 'Rameshbhai Patel',
      monthlyLimit: 200000,
      usedLimit: 24500,
      verified: true,
      beneficiaries: {
        create: [
          {
            accountHolderName: 'Rameshbhai K Patel',
            bankName: 'State Bank of India',
            accountNumber: '309812349871',
            ifsc: 'SBIN0004123',
            verified: true,
            verifiedName: 'RAMESHBHAI KARSANBHAI PATEL',
          },
          {
            accountHolderName: 'Kiranben R Patel',
            bankName: 'HDFC Bank',
            accountNumber: '50100293847561',
            ifsc: 'HDFC0000182',
            verified: true,
            verifiedName: 'KIRANBEN RAMESHBHAI PATEL',
          },
        ],
      },
    },
  });

  // 7. Historical Fund Requests (matching live account + pending one for Admin review)
  await prisma.fundRequest.createMany({
    data: [
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        userCompanyName: 'Shree Krishna agro food',
        amount: 180000,
        walletTarget: 'main',
        paymentDate: '2026-09-28',
        method: 'bank',
        transferMode: 'IMPS',
        companyBankName: 'BANDHAN BANK',
        companyBankAccount: '20100080078147',
        paymentReference: '619658632294',
        receiptName: 'IMPS_Slip_180000.jpg',
        note: 'Working capital top-up for festive payout volume',
        status: 'approved',
        reviewedByName: 'Lavina Sharma',
        reviewNote: 'UTR verified with Bandhan Bank statement',
        reviewedAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        userCompanyName: 'Shree Krishna agro food',
        amount: 45000,
        walletTarget: 'main',
        paymentDate: new Date().toISOString().slice(0, 10),
        method: 'bank',
        transferMode: 'IMPS',
        companyBankName: 'IDFC FIRST BANK',
        companyBankAccount: '79768424884',
        paymentReference: '627391048512',
        receiptName: 'IDFC_Deposit_45000.png',
        ocrExtractedJson: JSON.stringify({ utr: '627391048512', amount: 45000, mode: 'IMPS', confidence: 99.4 }),
        note: 'Morning IMPS transfer',
        status: 'pending',
      },
    ],
  });

  // 8. Sample Transactions across all services
  const sampleTxns = [
    {
      reference: 'MD-UPICW-908231',
      userId: retailer.id,
      userMobile: retailer.mobile,
      userName: 'Gelot Mahendrakumar mangalji',
      serviceCode: 'UPI_CASH',
      serviceName: 'UPI Cash Withdrawal',
      category: 'upi_cash',
      operatorName: 'Fingpay Dynamic QR',
      customerMobile: '9876501234',
      customerName: 'Harshad Mehta',
      accountOrVpa: 'harshad.m@okhdfcbank',
      bankName: 'HDFC Bank',
      amount: 2000,
      surcharge: 0,
      commission: 8.0,
      distributorComm: 2.0,
      adminMargin: 5.0,
      totalDebit: 0,
      walletBucket: 'aeps',
      status: 'success',
      providerName: 'Fingpay',
      providerTxnId: 'FP992837412',
      bankRrn: '627318293011',
      commissionChainJson: JSON.stringify([
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'commission', amount: 8.0 },
        { level: 2, role: 'DISTRIBUTOR', name: 'AGS CORPORATION', mobile: '7506007000', type: 'override', amount: 2.0 },
        { level: 3, role: 'SUPER_ADMIN', name: 'MoneyDraw Platform', mobile: '9999999999', type: 'margin', amount: 5.0 },
      ]),
    },
    {
      reference: 'MD-AEPS-884120',
      userId: retailer.id,
      userMobile: retailer.mobile,
      userName: 'Gelot Mahendrakumar mangalji',
      serviceCode: 'AEPS_CW',
      serviceName: 'AEPS Cash Withdrawal',
      category: 'aeps',
      operatorName: 'State Bank of India',
      customerMobile: '9925109283',
      customerName: 'Bhavesh Thakor',
      accountOrVpa: 'XXXX-XXXX-4829',
      bankName: 'State Bank of India',
      amount: 5000,
      surcharge: 0,
      commission: 11.0,
      distributorComm: 2.5,
      adminMargin: 3.5,
      totalDebit: 0,
      walletBucket: 'aeps',
      status: 'success',
      providerName: 'Fingpay',
      providerTxnId: 'FPAEPS778123',
      bankRrn: '627314982310',
      commissionChainJson: JSON.stringify([
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'commission', amount: 11.0 },
        { level: 2, role: 'DISTRIBUTOR', name: 'AGS CORPORATION', mobile: '7506007000', type: 'override', amount: 2.5 },
        { level: 3, role: 'SUPER_ADMIN', name: 'MoneyDraw Platform', mobile: '9999999999', type: 'margin', amount: 3.5 },
      ]),
    },
    {
      reference: 'MD-PAYOUT-773190',
      userId: retailer.id,
      userMobile: retailer.mobile,
      userName: 'Gelot Mahendrakumar mangalji',
      serviceCode: 'PAYOUT',
      serviceName: 'Payout / Bank Transfer',
      category: 'payout',
      operatorName: 'IMPS Payout',
      customerMobile: '9825011223',
      customerName: 'Rameshbhai K Patel',
      accountOrVpa: '309812349871',
      bankName: 'State Bank of India',
      ifsc: 'SBIN0004123',
      transferMode: 'IMPS',
      amount: 10000,
      surcharge: 85.0,
      gst: 15.3,
      tds: 1.5,
      commission: 30.0,
      distributorComm: 12.0,
      adminMargin: 43.0,
      totalDebit: 10085.0,
      walletBucket: 'main',
      status: 'success',
      providerName: 'YesBank',
      providerTxnId: 'YB-IMPS-991823',
      bankRrn: '627319982104',
      commissionChainJson: JSON.stringify([
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'surcharge_paid', amount: -85.0 },
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'commission_rebate', amount: 30.0 },
        { level: 2, role: 'DISTRIBUTOR', name: 'AGS CORPORATION', mobile: '7506007000', type: 'override', amount: 12.0 },
        { level: 3, role: 'SUPER_ADMIN', name: 'MoneyDraw Platform', mobile: '9999999999', type: 'margin', amount: 43.0 },
      ]),
    },
    {
      reference: 'MD-BBPS-661049',
      userId: retailer.id,
      userMobile: retailer.mobile,
      userName: 'Gelot Mahendrakumar mangalji',
      serviceCode: 'BILLPAY',
      serviceName: 'Utility Bill Payment',
      category: 'billpay',
      operatorName: 'Torrent Power - Ahmedabad',
      customerMobile: '9898123456',
      customerName: 'Shree Krishna agro food',
      accountOrVpa: 'TP-AHD-9081047',
      amount: 3420,
      surcharge: 0,
      commission: 4.5,
      distributorComm: 1.0,
      adminMargin: 2.0,
      totalDebit: 3420,
      walletBucket: 'main',
      status: 'success',
      providerName: 'NPCI BBPS',
      providerTxnId: 'BBPS01928374',
      bankRrn: '627311029384',
      commissionChainJson: JSON.stringify([
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'commission', amount: 4.5 },
        { level: 2, role: 'DISTRIBUTOR', name: 'AGS CORPORATION', mobile: '7506007000', type: 'override', amount: 1.0 },
        { level: 3, role: 'SUPER_ADMIN', name: 'MoneyDraw Platform', mobile: '9999999999', type: 'margin', amount: 2.0 },
      ]),
    },
    {
      reference: 'MD-RCH-552910',
      userId: retailer.id,
      userMobile: retailer.mobile,
      userName: 'Gelot Mahendrakumar mangalji',
      serviceCode: 'RECHARGE',
      serviceName: 'Mobile & DTH Recharge',
      category: 'recharge',
      operatorName: 'Jio Prepaid',
      customerMobile: '9081047006',
      customerName: 'Prepaid Subscriber',
      accountOrVpa: '9081047006',
      amount: 299,
      surcharge: 0,
      commission: 6.58,
      distributorComm: 1.2,
      adminMargin: 1.79,
      totalDebit: 299,
      walletBucket: 'main',
      status: 'success',
      providerName: 'CyberPlat',
      providerTxnId: 'JIO8827361',
      bankRrn: '627309918273',
      commissionChainJson: JSON.stringify([
        { level: 1, role: 'RETAILER', name: 'Gelot Mahendrakumar mangalji', mobile: '9081047006', type: 'commission', amount: 6.58 },
        { level: 2, role: 'DISTRIBUTOR', name: 'AGS CORPORATION', mobile: '7506007000', type: 'override', amount: 1.2 },
        { level: 3, role: 'SUPER_ADMIN', name: 'MoneyDraw Platform', mobile: '9999999999', type: 'margin', amount: 1.79 },
      ]),
    },
  ];

  for (const tx of sampleTxns) {
    await prisma.transaction.create({ data: tx });
  }

  // 9. Sample Double-Entry Ledger Records
  await prisma.ledgerEntry.createMany({
    data: [
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'main',
        entryType: 'fund_load',
        direction: 'credit',
        amount: 180000,
        openingBalance: 0,
        closingBalance: 180000,
        transactionRef: 'UTR-619658632294',
        remarks: 'Fund Request Approved (BANDHAN BANK IMPS)',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'main',
        entryType: 'p2p_transfer',
        direction: 'debit',
        amount: 101781,
        openingBalance: 180000,
        closingBalance: 78219,
        transactionRef: 'NCR476CCEC914BE46C2',
        remarks: 'Need Cash Approved to 8806802036 (Sagar Digital Seva)',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'main',
        entryType: 'transaction_debit',
        direction: 'debit',
        amount: 10085,
        openingBalance: 78219,
        closingBalance: 68134,
        transactionRef: 'MD-PAYOUT-773190',
        remarks: 'IMPS Payout to Rameshbhai K Patel (A/c 309812349871)',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'main',
        entryType: 'transaction_debit',
        direction: 'debit',
        amount: 3420,
        openingBalance: 68134,
        closingBalance: 64714,
        transactionRef: 'MD-BBPS-661049',
        remarks: 'BBPS Electricity Bill - Torrent Power Ahmedabad',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'aeps',
        entryType: 'aeps_credit',
        direction: 'credit',
        amount: 5000,
        openingBalance: 21400,
        closingBalance: 26400,
        transactionRef: 'MD-AEPS-884120',
        remarks: 'AEPS Cash Withdrawal - SBI (RRN 627314982310)',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'aeps',
        entryType: 'aeps_credit',
        direction: 'credit',
        amount: 2000,
        openingBalance: 26400,
        closingBalance: 28400,
        transactionRef: 'MD-UPICW-908231',
        remarks: 'UPI QR Cash Withdrawal - harshad.m@okhdfcbank',
      },
      {
        userId: retailer.id,
        userMobile: retailer.mobile,
        userName: 'Gelot Mahendrakumar mangalji',
        bucket: 'commission',
        entryType: 'commission_credit',
        direction: 'credit',
        amount: 30.0,
        openingBalance: 1812.5,
        closingBalance: 1842.5,
        transactionRef: 'MD-PAYOUT-773190',
        remarks: 'Retailer Commission Earned on MD-PAYOUT-773190',
      },
    ],
  });

  // 10. Sample P2P Cash Request ("Need Cash")
  await prisma.cashRequest.create({
    data: {
      reference: 'NCR-9081-2026',
      requesterId: retailer2.id,
      requesterMobile: retailer2.mobile,
      requesterName: 'Sagar Chaudhary (Sagar Digital Seva)',
      requesterRole: 'Retailer',
      responderId: retailer.id,
      responderMobile: retailer.mobile,
      responderName: 'Gelot Mahendrakumar mangalji',
      responderRole: 'Retailer',
      amount: 5000,
      walletTarget: 'main',
      note: 'Urgent ₹5,000 needed for customer payout, handing cash at shop',
      status: 'pending',
    },
  });

  // 11. Sample Settlement Request
  await prisma.settlementRequest.create({
    data: {
      reference: 'STL-YESB-449102',
      userId: retailer.id,
      accountId: settlementAcc.id,
      bankName: 'Yes Bank',
      accountNumber: '039261900000671',
      ifsc: 'YESB0000392',
      transferMode: 'IMPS',
      amount: 25000,
      charge: 10,
      netAmount: 24990,
      bankRrn: '627299104821',
      status: 'success',
    },
  });

  // 12. Sample Onboarding Application for Staff/Admin Review
  await prisma.onboardingApplication.create({
    data: {
      applicantName: 'Pravinbhai Solanki',
      mobile: '9712345678',
      email: 'pravin.enterprise@gmail.com',
      requestedRole: 'RETAILER',
      parentMobile: '7506007000',
      parentName: 'AGS CORPORATION',
      companyName: 'Solanki Telecom & Banking Point',
      businessType: 'Retail',
      panNumber: 'BGHPS9912E',
      aadhaarMasked: 'XXXXXXXX4412',
      digilockerVerified: true,
      bankVerified: true,
      bankName: 'Bank of Baroda',
      accountNumber: '08910100029381',
      ifsc: 'BARB0AHMEDA',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '380051',
      status: 'pending',
    },
  });

  console.log('MoneyDraw seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
