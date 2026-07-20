/**
 * CodeStep — second screen of the email-code auth flow.
 *
 * User enters the 6-digit code received by email.
 * "Отправить ещё раз" is disabled for 60 s after each send to match the
 * backend rate-limit, then re-enables.
 */

import { useEffect, useRef, useState } from 'react';
import { apiFetch, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../services/api';
import { storageSet } from '../../services/storage';

interface CodeStepProps {
  email: string;
  /** Called after a successful verify: token & userId have been saved. */
  onSuccess: () => void;
  onBack: () => void;
}

const RESEND_COOLDOWN = 60; // seconds

export default function CodeStep({ email, onSuccess, onBack }: CodeStepProps) {
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  // Countdown in seconds until resend is allowed. Starts at RESEND_COOLDOWN
  // because a code was already sent when the user arrived here.
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start / restart the countdown
  function startCountdown() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(RESEND_COOLDOWN);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    startCountdown();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResend() {
    if (countdown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json() as { detail?: string };
        setError(data.detail ?? 'Не удалось отправить код.');
        return;
      }
      startCountdown();
      setCode('');
    } catch {
      setError('Не удалось отправить код. Проверь соединение.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (res.status === 400) {
        setError('Неверный или устаревший код. Запроси новый.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { access_token: string; user_id: string };
      await storageSet(AUTH_TOKEN_KEY, data.access_token);
      await storageSet(AUTH_USER_KEY, data.user_id);
      onSuccess();
    } catch (err) {
      if (!(err instanceof Error && err.message.startsWith('Неверный'))) {
        setError('Ошибка при проверке кода. Попробуй ещё раз.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(val: string) {
    // Allow digits only, max 6
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');
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
          Код из письма
        </h1>
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          Отправили 6-значный код на{' '}
          <span className="text-text-primary font-medium">{email}</span>.
          Он действует 10 минут.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleVerify} className="flex flex-col gap-block flex-1">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="code"
            className="font-sans text-xs text-text-secondary uppercase tracking-wide"
          >
            Код
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="000000"
            maxLength={6}
            className="w-full bg-surface rounded-card px-4 py-4 font-sans text-2xl text-center tracking-[0.35em] text-text-primary placeholder:text-text-secondary/40 outline-none focus:ring-2 focus:ring-button-primary/30 transition"
          />
          {error && (
            <p className="font-sans text-xs text-red-500 leading-relaxed">{error}</p>
          )}
        </div>

        {/* Resend link */}
        <div className="flex justify-center">
          {countdown > 0 ? (
            <p className="font-sans text-sm text-text-secondary">
              Отправить ещё раз через {countdown} с
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="font-sans text-sm text-button-primary underline underline-offset-2 active:opacity-60 transition-opacity disabled:opacity-40"
            >
              Отправить код ещё раз
            </button>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity disabled:opacity-40"
        >
          {loading ? 'Проверяем…' : 'Подтвердить'}
        </button>
      </form>
    </div>
  );
}
