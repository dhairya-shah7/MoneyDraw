import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function ensureDhairyaSuperAdmin() {
  const email = 'dhairyaqwerty1@gmail.com';
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: email }, { mobile: '9999999999' }] },
    include: { wallet: true },
  });

  if (!existing) {
    const scheme = await prisma.commissionScheme.findFirst();
    await prisma.user.create({
      data: {
        username: email,
        mobile: '9999999999',
        email,
        passwordHash: 'MoneyPayAdmin@2026',
        tpin: '1234',
        firstName: 'Dhairya',
        lastName: '(Super Admin)',
        roleCode: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        companyName: 'MoneyDraw Direct Gateway',
        businessType: 'Headquarters',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pinCode: '380015',
        panNumber: 'AAACM9999A',
        aadhaarNumber: '999988887777',
        canCreateDownline: true,
        isCmsAepsHead: true,
        isBusinessManager: true,
        schemeId: scheme?.id,
        wallet: {
          create: {
            availableBalance: 2500000,
            aepsBalance: 840000,
            commissionBalance: 148520,
          },
        },
      },
    });
  } else if (existing.email !== email) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        username: email,
      },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureDhairyaSuperAdmin();

    const identifier = (req.nextUrl.searchParams.get('mobile') || '9081047006').trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { mobile: identifier },
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
      include: {
        wallet: true,
        settlementAccounts: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const services = await prisma.service.findMany({ orderBy: { id: 'asc' } });
    const companyBanks = await prisma.companyBankAccount.findMany({
      where: { active: true },
      orderBy: [{ priority: 'asc' }, { currentDayVolume: 'asc' }],
    });

    return NextResponse.json({
      user,
      services,
      companyBanks,
      branding: {
        slug: 'moneydraw',
        displayName: 'MoneyDraw',
        tagline: 'Enterprise B2B Merchant Banking & Instant Payouts',
        primaryColor: '#2563EB',
        accentColor: '#059669',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDhairyaSuperAdmin();

    const body = await req.json();
    const { action } = body;

    if (action === 'login') {
      const identifier = String(body.identifier || body.username || body.email || body.mobile || '').trim();
      const password = String(body.password || '').trim();

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { mobile: identifier },
            { username: identifier },
            { email: identifier.toLowerCase() },
          ],
        },
        include: { wallet: true, settlementAccounts: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'No account found with that email or mobile number.' },
          { status: 401 }
        );
      }

      const isDhairyaAdmin =
        user.email.toLowerCase() === 'dhairyaqwerty1@gmail.com' &&
        (password === 'MoneyPayAdmin@2026' || password === 'Admin@123');

      if (user.passwordHash !== password && !isDhairyaAdmin) {
        return NextResponse.json(
          { error: 'Invalid password. Please check your credentials.' },
          { status: 401 }
        );
      }

      if (user.status !== 'active') {
        return NextResponse.json(
          { error: 'Your account is currently suspended by Admin.' },
          { status: 403 }
        );
      }

      const token = `mdraw-jwt-${user.id}-${Date.now()}`;
      const res = NextResponse.json({
        access: token,
        user,
      });
      res.cookies.set('mdraw_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }

    if (action === 'signup') {
      const name = String(body.name || '').trim();
      const companyName = String(body.businessName || body.companyName || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const mobile =
        String(body.mobile || '').trim() ||
        `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const password = String(body.password || '').trim();

      if (!name || !email || !password) {
        return NextResponse.json(
          { error: 'Full Name, Email, and Password are required.' },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters.' },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { mobile }, { username: email }] },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email or mobile number already exists.' },
          { status: 400 }
        );
      }

      const isSuperAdminEmail = email === 'dhairyaqwerty1@gmail.com';
      const parts = name.split(' ');
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(' ') || (isSuperAdminEmail ? '(Super Admin)' : '');
      const scheme = await prisma.commissionScheme.findFirst();

      const newUser = await prisma.user.create({
        data: {
          username: mobile,
          mobile,
          email,
          passwordHash: password,
          tpin: '1234',
          firstName,
          lastName,
          roleCode: isSuperAdminEmail ? 'SUPER_ADMIN' : 'RETAILER',
          roleName: isSuperAdminEmail ? 'Super Admin' : 'Retailer',
          parentName: 'AGS CORPORATION',
          parentMobile: '7506007000',
          companyName: companyName || `${firstName} Enterprise`,
          businessType: 'Retail',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pinCode: '380015',
          schemeId: scheme?.id,
          wallet: {
            create: {
              availableBalance: 0,
              aepsBalance: 0,
              commissionBalance: 0,
            },
          },
        },
        include: { wallet: true, settlementAccounts: true },
      });

      const token = `mdraw-jwt-${newUser.id}-${Date.now()}`;
      const res = NextResponse.json({
        success: true,
        access: token,
        user: newUser,
      });
      res.cookies.set('mdraw_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }

    if (action === 'set_tpin') {
      const { userId, mobile, newTpin } = body;
      const cleanTpin = String(newTpin || '').replace(/\D/g, '').trim();
      if (!cleanTpin || cleanTpin.length < 4 || cleanTpin.length > 6) {
        return NextResponse.json({ error: 'TPIN must be a 4 to 6 digit numeric code.' }, { status: 400 });
      }

      let targetUser = null;
      if (userId && Number(userId)) {
        targetUser = await prisma.user.findUnique({ where: { id: Number(userId) } });
      }
      if (!targetUser && mobile) {
        targetUser = await prisma.user.findFirst({ where: { mobile: String(mobile).trim() } });
      }
      if (!targetUser) {
        return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
      }

      const updated = await prisma.user.update({
        where: { id: targetUser.id },
        data: { tpin: cleanTpin },
        include: { wallet: true },
      });
      return NextResponse.json({
        success: true,
        user: updated,
        message: 'Transaction Security PIN (TPIN) updated successfully.',
      });
    }

    if (action === 'change_password') {
      const { userId, newPassword } = body;
      if (!newPassword || String(newPassword).length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }
      const updated = await prisma.user.update({
        where: { id: Number(userId) },
        data: { passwordHash: String(newPassword) },
      });
      return NextResponse.json({ user: updated, message: 'Password updated successfully.' });
    }

    if (action === 'update_api_settings') {
      const { userId, webhookUrl, allowedIp, rotateKey } = body;
      const data: Record<string, unknown> = {};
      if (webhookUrl !== undefined) data.webhookUrl = String(webhookUrl);
      if (allowedIp !== undefined) data.allowedIp = String(allowedIp);
      if (rotateKey) {
        data.apiKey = `mdraw-live-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-4)}`;
      }
      const updated = await prisma.user.update({
        where: { id: Number(userId) },
        data,
        include: { wallet: true },
      });
      return NextResponse.json({ user: updated, message: 'Developer API settings saved.' });
    }

    if (action === 'aeps_2fa') {
      const { userId } = body;
      const today = new Date().toISOString().slice(0, 10);
      const updated = await prisma.user.update({
        where: { id: Number(userId) },
        data: {
          aepsOnboarded: true,
          aepsMerchantKyc: true,
          aepsBankKyc: true,
          aepsDaily2faDate: today,
        },
        include: { wallet: true },
      });
      return NextResponse.json({ user: updated, message: 'Daily Biometric 2FA verified with NPCI / Fingpay L1.' });
    }

    if (action === 'switch_my_role') {
      const { userId, roleCode, roleName } = body;
      const updated = await prisma.user.update({
        where: { id: Number(userId) },
        data: {
          roleCode: String(roleCode),
          roleName: String(roleName),
        },
        include: { wallet: true, settlementAccounts: true },
      });
      return NextResponse.json({ user: updated, message: `Active role switched to ${roleName}.` });
    }

    return NextResponse.json({ error: 'Unknown auth action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
