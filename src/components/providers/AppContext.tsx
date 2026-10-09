'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface WalletData {
  id: number;
  availableBalance: number;
  aepsBalance: number;
  commissionBalance: number;
  holdBalance: number;
  capBalance: number;
  overdraftLimit: number;
  recoveryDebt: number;
  commissionLocked: boolean;
}

export interface UserData {
  id: number;
  username: string;
  mobile: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  roleName: string;
  parentId?: number | null;
  parentName?: string | null;
  parentMobile?: string | null;
  status: string;
  kycStatus: string;
  companyName: string;
  businessType: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  dob: string;
  panNumber: string;
  aadhaarNumber: string;
  tpin: string;
  apiKey: string;
  webhookUrl: string;
  allowedIp: string;
  aepsOnboarded: boolean;
  aepsMerchantKyc: boolean;
  aepsBankKyc: boolean;
  aepsDaily2faDate: string;
  wallet?: WalletData;
}

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface AppContextValue {
  user: UserData | null;
  loading: boolean;
  soundboxEnabled: boolean;
  soundboxLang: 'en-IN' | 'hi-IN';
  toasts: ToastAlert[];
  setSoundboxEnabled: (v: boolean) => void;
  setSoundboxLang: (lang: 'en-IN' | 'hi-IN') => void;
  speakSoundbox: (textEn: string, textHi?: string) => void;
  refreshUser: (overrideMobile?: string) => Promise<void>;
  switchDemoRole: (mobile: string) => Promise<void>;
  logout: () => void;
  pushToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundboxEnabled, setSoundboxEnabled] = useState(true);
  const [soundboxLang, setSoundboxLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  const pushToast = useCallback(
    (title: string, message: string, type: 'success' | 'info' | 'warning' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [{ id, title, message, type }, ...prev.slice(0, 3)]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const speakSoundbox = useCallback(
    (textEn: string, textHi?: string) => {
      if (!soundboxEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(soundboxLang === 'hi-IN' && textHi ? textHi : textEn);
        utter.lang = soundboxLang;
        utter.rate = 1.0;
        utter.pitch = 1.05;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech error
      }
    },
    [soundboxEnabled, soundboxLang]
  );

  const refreshUser = useCallback(async (overrideMobile?: string) => {
    try {
      const savedMobile =
        overrideMobile ||
        (typeof window !== 'undefined' ? localStorage.getItem('mdraw_mobile') : null);
      if (!savedMobile) {
        setUser(null);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/auth?mobile=${encodeURIComponent(savedMobile)}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mdraw_mobile', data.user.mobile);
        }
      } else {
        setUser(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const switchDemoRole = useCallback(
    async (mobile: string) => {
      setLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mdraw_mobile', mobile);
      }
      await refreshUser(mobile);
    },
    [refreshUser]
  );

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mdraw_mobile');
    }
    setUser(null);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Connect to Real-Time SSE stream for instant QR & transaction soundbox alerts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource('/api/events');
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'UPI_QR_SETTLED') {
          const amt = data.payload?.amount || 0;
          const payer = data.payload?.payerName || 'Customer';
          pushToast(
            `₹${Number(amt).toLocaleString('en-IN')} UPI Cash Received!`,
            `Paid by ${payer} · RRN ${data.payload?.bankRrn}. Credited to Main Wallet.`,
            'success'
          );
          speakSoundbox(
            `MoneyDraw Alert. Rupees ${amt} received via U P I Cash from ${payer}. Hand over cash to customer.`,
            `MoneyDraw Alert. ${amt} rupaye U P I Cash prapt hue. Grahak ko nagad dein.`
          );
          refreshUser();
        } else if (data.type === 'TXN_COMPLETED') {
          const amt = data.payload?.amount || 0;
          const svc = data.payload?.serviceName || 'Transaction';
          if (amt > 0) {
            pushToast(
              `${svc} Successful`,
              `₹${Number(amt).toLocaleString('en-IN')} · Ref ${data.payload?.reference}`,
              'success'
            );
            speakSoundbox(
              `MoneyDraw ${svc} of Rupees ${amt} successful.`,
              `MoneyDraw ${svc} ${amt} rupaye safal raha.`
            );
          }
          refreshUser();
        } else if (data.type === 'WALLET_CREDITED') {
          const amt = data.payload?.amount || 0;
          pushToast('Wallet Top-Up Credited', `₹${Number(amt).toLocaleString('en-IN')} added to wallet.`, 'info');
          refreshUser();
        }
      } catch {
        // ignore parse errors
      }
    };
    return () => es.close();
  }, [pushToast, refreshUser, speakSoundbox]);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        soundboxEnabled,
        soundboxLang,
        toasts,
        setSoundboxEnabled,
        setSoundboxLang,
        speakSoundbox,
        refreshUser,
        switchDemoRole,
        logout,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
