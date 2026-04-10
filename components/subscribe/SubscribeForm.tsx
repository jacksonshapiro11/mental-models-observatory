'use client';

import { useState, FormEvent } from 'react';

interface SubscribeFormProps {
  source: string; // tracks which form (hero, footer-cta, super-brief, subscribe-page)
  inputClassName?: string;
  buttonClassName?: string;
  layout?: 'row' | 'column';
  buttonText?: string;
  showNote?: boolean;
  noteClassName?: string;
}

export function SubscribeForm({
  source,
  inputClassName = '',
  buttonClassName = '',
  layout = 'row',
  buttonText = 'Get in',
  showNote = true,
  noteClassName = 'text-xs text-ct-dark font-body',
}: SubscribeFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source,
          website: '', // honeypot — should always be empty
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string; message?: string };

      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message || "You're in.");
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Connection error. Try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="py-2">
        <p className="font-mono text-sm font-semibold text-ct-green-data">
          ✓ {message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className={`flex ${layout === 'column' ? 'flex-col' : ''} gap-2`}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
          placeholder="your@email.com"
          required
          className={inputClassName}
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={`${buttonClassName} ${status === 'loading' ? 'opacity-70 cursor-wait' : ''}`}
        >
          {status === 'loading' ? '...' : buttonText}
        </button>
      </div>
      {/* Honeypot — hidden from humans, filled by bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
        aria-hidden="true"
      />
      {status === 'error' && (
        <p className="text-xs text-ct-pink font-body">{message}</p>
      )}
      {showNote && status === 'idle' && (
        <p className={noteClassName}>Free. No spam. Ever.</p>
      )}
    </form>
  );
}
