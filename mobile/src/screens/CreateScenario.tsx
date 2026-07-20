/**
 * CreateScenario — lets an authenticated user describe a situation in free
 * text and generate a custom AI persona from it.
 *
 * Flow:
 *   idle     → user types → submit
 *   loading  → BreathingDot + "продумываем собеседника…"
 *   success  → calls onSuccess(PendingScenario) → DifficultySelect
 *   error    → inline message, form stays editable
 */

import { useState } from 'react';
import { apiFetch } from '../services/api';
import type { PendingScenario } from './DifficultySelect';
import BreathingDot from '../components/BreathingDot';

const MIN_LENGTH = 15;
const MAX_LENGTH = 600;

interface CreateScenarioProps {
  /** Called with the newly created scenario so App can route to DifficultySelect. */
  onSuccess: (scenario: PendingScenario) => void;
  onBack: () => void;
}

export default function CreateScenario({ onSuccess, onBack }: CreateScenarioProps) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const trimmed  = text.trim();
  const canSubmit = trimmed.length >= MIN_LENGTH && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/scenarios/custom', {
        method: 'POST',
        body: JSON.stringify({ description: trimmed }),
      });

      if (res.status === 422) {
        const data = await res.json() as { detail: string | { msg: string }[] };
        const msg = Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg).join(' ')
          : data.detail;
        setError(msg);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: '' })) as { detail?: string };
        setError(data.detail ?? 'Не удалось создать сценарий. Попробуй ещё раз.');
        return;
      }

      const data = await res.json() as {
        scenario_id: string;
        display_name: string;
        short_description: string;
      };

      onSuccess({
        scenario_id:       data.scenario_id,
        display_name:      data.display_name,
        short_description: data.short_description,
      });
    } catch {
      setError('Ошибка связи — проверь соединение и попробуй снова.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-block px-6">
        <BreathingDot size="w-16 h-16" colorClass="bg-accent-calm" />
        <p className="font-sans text-sm text-text-secondary">
          продумываем собеседника…
        </p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
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
          Свой сценарий
        </h1>
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          Опиши ситуацию — с кем и о чём тебе нужно поговорить. Мы создадим
          собеседника специально под неё.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-block flex-1">
        <div className="flex flex-col gap-2 flex-1">
          <label
            htmlFor="description"
            className="font-sans text-xs text-text-secondary uppercase tracking-wide"
          >
            Ситуация
          </label>
          <textarea
            id="description"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            placeholder="Опиши ситуацию своими словами — с кем и о чём тебе нужно поговорить"
            maxLength={MAX_LENGTH}
            rows={6}
            autoFocus
            className="w-full flex-1 bg-surface rounded-card px-4 py-4 font-sans text-base text-text-primary placeholder:text-text-secondary/50 resize-none outline-none focus:ring-2 focus:ring-button-primary/30 transition leading-relaxed"
          />

          <div className="flex items-start justify-between gap-4">
            {error ? (
              <p className="font-sans text-xs text-red-500 leading-relaxed flex-1">{error}</p>
            ) : (
              <span />
            )}
            <p className="font-sans text-xs text-text-secondary/50 shrink-0 tabular-nums">
              {trimmed.length}/{MAX_LENGTH}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity disabled:opacity-40"
        >
          Создать
        </button>
      </form>
    </div>
  );
}
