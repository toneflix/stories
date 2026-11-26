'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ProviderId } from '@/auth';
import { SignInDialog } from './SignInDialog';

type AuthGate = {
  signedIn: boolean;
  openSignIn: () => void;
  requireAuth: (action: () => void) => void;
};

const AuthGateContext = createContext<AuthGate | null>(null);

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside <Providers>');
  return ctx;
}

function Gate({ providers, children }: { providers: ProviderId[]; children: ReactNode }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const signedIn = status === 'authenticated';

  const requireAuth = useCallback(
    (action: () => void) => {
      if (signedIn) action();
      else setOpen(true);
    },
    [signedIn],
  );

  return (
    <AuthGateContext.Provider value={{ signedIn, openSignIn: () => setOpen(true), requireAuth }}>
      {children}
      {open && <SignInDialog providers={providers} onClose={() => setOpen(false)} />}
    </AuthGateContext.Provider>
  );
}

export function Providers({ providers, children }: { providers: ProviderId[]; children: ReactNode }) {
  return (
    <SessionProvider>
      <Gate providers={providers}>{children}</Gate>
    </SessionProvider>
  );
}
