'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/client';

export function NotifyForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus('busy');
    try {
      await api.subscribe(email);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message);
    }
  }

  if (status === 'done') return <p className="notify-done">Thanks. We&apos;ll be in touch.</p>;

  return (
    <form className="notify-form" onSubmit={submit}>
      <label htmlFor="notify-email" className="sr-only">
        Email address
      </label>
      <input
        id="notify-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="btn btn-dark" disabled={status === 'busy'}>
        Notify me
      </button>
      {status === 'error' && <p className="form-error">{message}</p>}
    </form>
  );
}
