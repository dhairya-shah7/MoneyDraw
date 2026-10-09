import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PROVIDER_HEALTH } from '@/lib/operators-data';

export async function GET(req: NextRequest) {
  try {
    const mobile = req.nextUrl.searchParams.get('mobile') || '9081047006';
    const user = await prisma.user.findUnique({
      where: { mobile },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isAdmin = user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'ADMIN' || user.roleCode === 'STAFF';

    const txWhere = isAdmin ? {} : { userId: user.id };
    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalAmount = transactions.reduce((s, t) => s + (t.status === 'success' ? t.amount : 0), 0);
    const totalCommission = transactions.reduce((s, t) => s + (t.status === 'success' ? t.commission : 0), 0);
    const totalDistributorComm = transactions.reduce((s, t) => s + (t.status === 'success' ? t.distributorComm : 0), 0);
    const totalAdminMargin = transactions.reduce((s, t) => s + (t.status === 'success' ? t.adminMargin : 0), 0);

    const serviceMap: Record<string, { name: string; count: number; volume: number }> = {};
    for (const t of transactions) {
      if (!serviceMap[t.serviceCode]) {
        serviceMap[t.serviceCode] = { name: t.serviceName, count: 0, volume: 0 };
      }
      serviceMap[t.serviceCode].count += 1;
      serviceMap[t.serviceCode].volume += t.amount;
    }

    const pendingFundRequests = await prisma.fundRequest.count({ where: { status: 'pending' } });
    const pendingOnboarding = await prisma.onboardingApplication.count({ where: { status: 'pending' } });
    const pendingCashRequests = await prisma.cashRequest.count({
      where: { responderId: user.id, status: 'pending' },
    });

    const allWallets = await prisma.wallet.findMany();
    const networkTotals = {
      available: allWallets.reduce((s, w) => s + w.availableBalance, 0),
      aeps: allWallets.reduce((s, w) => s + w.aepsBalance, 0),
      commission: allWallets.reduce((s, w) => s + w.commissionBalance, 0),
      hold: allWallets.reduce((s, w) => s + w.holdBalance, 0),
    };

    const trend = [
      { month: 'Apr', volume: 342000, commission: 1120 },
      { month: 'May', volume: 418000, commission: 1490 },
      { month: 'Jun', volume: 512000, commission: 1810 },
      { month: 'Jul', volume: 634000, commission: 2240 },
      { month: 'Aug', volume: 789000, commission: 2790 },
      { month: 'Sep', volume: Math.max(845000, totalAmount + 820000), commission: Math.max(3120, totalCommission + 3050) },
    ];

    return NextResponse.json({
      user,
      totals: {
        totalTransactions: transactions.length,
        success: transactions.filter((t) => t.status === 'success').length,
        pending: transactions.filter((t) => t.status === 'pending').length,
        failed: transactions.filter((t) => t.status === 'failed').length,
        totalAmount,
        totalCommission,
        totalDistributorComm,
        totalAdminMargin,
      },
      serviceSummary: Object.values(serviceMap),
      trend,
      lastTransactions: transactions,
      pendingCounts: {
        fundRequests: pendingFundRequests,
        onboarding: pendingOnboarding,
        cashRequests: pendingCashRequests,
      },
      networkTotals,
      providerHealth: PROVIDER_HEALTH,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
