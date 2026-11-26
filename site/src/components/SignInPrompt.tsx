'use client';

import { useAuthGate } from './Providers';

export function SignInPrompt() {
  const { openSignIn } = useAuthGate();
  return (
    <div className="empty">
      <p>Sign in to see your saved stories.</p>
      <button type="button" className="btn btn-primary" onClick={openSignIn}>
        Sign in
      </button>
    </div>
  );
}
