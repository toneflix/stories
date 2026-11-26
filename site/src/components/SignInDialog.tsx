'use client';

import { signIn } from 'next-auth/react';
import { useState, type FormEvent } from 'react';
import type { ProviderId } from '@/auth';
import { CloseIcon } from './Icons';
import { Sheet } from './Sheet';

export function SignInDialog({ providers, onClose }: { providers: ProviderId[]; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const callbackUrl = typeof window === 'undefined' ? '/' : window.location.href;

  async function emailSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await signIn('resend', { email, callbackUrl });
  }

  async function devSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await signIn('dev', { name, callbackUrl });
  }

  return (
    <Sheet label="Sign in" onClose={onClose} variant="dialog">
      <div className="signin">
        <button type="button" className="icon-btn signin-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2>Join the story</h2>
        <p>Sign in to like, comment and save. Watching stays free and open.</p>

        {providers.includes('google') && (
          <button type="button" className="btn btn-light" disabled={busy} onClick={() => signIn('google', { callbackUrl })}>
            Continue with Google
          </button>
        )}

        {providers.includes('resend') && (
          <form className="signin-form" onSubmit={emailSignIn}>
            <label htmlFor="signin-email">Email address</label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-outline" disabled={busy}>
              Email me a sign-in link
            </button>
          </form>
        )}

        {providers.includes('dev') && (
          <form className="signin-form" onSubmit={devSignIn}>
            <label htmlFor="signin-name">Local test account (only on your computer)</label>
            <input
              id="signin-name"
              required
              maxLength={40}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-outline" disabled={busy}>
              Continue
            </button>
          </form>
        )}

        {providers.length === 0 && <p className="muted">Sign-in isn&apos;t set up yet.</p>}

        <button type="button" className="btn-text" onClick={onClose}>
          Not now
        </button>
      </div>
    </Sheet>
  );
}
