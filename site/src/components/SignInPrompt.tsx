'use client';

import { useAuthGate } from './Providers';

export function SignInPrompt() {
  const { openSignIn } = useAuthGate();
  return (
    <div className="empty">
      <p>Sign in to see the stories you saved.</p>
      <button type="button" className="btn btn-primary" onClick={openSignIn}>
        Sign in
      </button>
    </div>
  );
}
