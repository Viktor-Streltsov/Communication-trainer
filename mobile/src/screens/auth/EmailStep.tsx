/**
 * EmailStep — first screen of the email-code auth flow.
 *
 * User enters their email and taps "Получить код". On success the parent
 * advances to CodeStep.  On error a short message is shown inline.
 */

import { useState } from 'react';
import { apiFetch } from '../../services/api';

interface EmailStepProps {
  onCodeSent: (email: string) => void;
  onBack: () => void;
}

export default function EmailStep({ onCodeSent, onBack }: EmailStepProps) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json() as { detail: string };
        setError(data.detail);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCodeSent(email.trim());
    } catch {
      setError('Не удалось отправить код. Проверь соединение и попробуй снова.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-section">

      {/* Back */}
      <button
        onClick={onBack}
        className="self-start font-sans text-sm text-text-secondary active:opacity-60 transition-opacity mb-section"
        aria-label="Назад"
      >
        ← Назад
      </button>

      {/* Heading */}
      <div className="flex flex-col gap-block mb-section">
        <h1 className="font-display italic text-3xl font-medium text-text-primary leading-snug">
          Войти
        </h1>
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          Введи email — пришлём одноразовый код для входа.
          Пароль не нужен.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-block flex-1">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="font-sans text-xs text-text-secondary uppercase tracking-wide"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="you@example.com"
            className="w-full bg-surface rounded-card px-4 py-4 font-sans text-base text-text-primary placeholder:text-text-secondary/50 outline-none focus:ring-2 focus:ring-button-primary/30 transition"
          />
          {error && (
            <p className="font-sans text-xs text-red-500 leading-relaxed">{error}</p>
          )}
        </div>

        {/* Spacer pushes button to bottom */}
        <div className="flex-1" />

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity disabled:opacity-40"
        >
          {loading ? 'Отправляем…' : 'Получить код'}
        </button>
      </form>
    </div>
  );
}
