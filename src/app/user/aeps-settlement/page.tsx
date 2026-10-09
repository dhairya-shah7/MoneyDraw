'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';

export default function BankSettlementPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/user/wallet');
  }, [router]);

  return (
    <AppShell>
      <div className="p-12 text-center text-xs text-slate-500 font-bold">
        Redirecting to Main Wallet & Pay...
      </div>
    </AppShell>
  );
}
