'use client';

import { signOut, useSession } from 'next-auth/react';
import { useAuthGate } from './Providers';

export function HeaderAccount() {
  const { data } = useSession();
  const { openSignIn } = useAuthGate();
  return data?.user ? (
    <button type="button" className="btn-text header-link" onClick={() => signOut()}>
      Sign out
    </button>
  ) : (
    <button type="button" className="btn-text header-link" onClick={openSignIn}>
      Sign in
    </button>
  );
}
