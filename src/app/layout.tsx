import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/components/providers/AppContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0F172A',
};

export const metadata: Metadata = {
  title: 'MoneyDraw — Enterprise B2B Merchant Banking & Payout Console',
  description:
    'Next-generation B2B Merchant Banking, UPI Cash Withdrawal, AEPS Biometric Banking, DMT Payouts, and Multi-Tier Commission Engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
