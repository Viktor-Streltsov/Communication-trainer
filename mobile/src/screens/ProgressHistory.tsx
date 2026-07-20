/**
 * ProgressHistory — shows per-scenario progress for the authenticated user.
 *
 * Design: background / surface / text-primary / text-secondary / accent-calm
 *         font-display (Newsreader italic) / font-sans (Work Sans)
 *         spacing: py-section px-6, gap-block
 *
 * Each scenario card contains:
 *   - Scenario name (font-display)
 *   - Thin SVG sparkline — trend shape only, no axes or labels
 *   - Summary text: "N попыток — сейчас X, было Y"
 */

import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

// ---------------------------------------------------------------------------
// Types (mirrors GET /users/me/progress response)
// ---------------------------------------------------------------------------

interface SessionEntry {
  date: string;
  success_score: number;
}

interface ScenarioProgress {
  scenario_id: string;
  display_name: string;
  sessions: SessionEntry[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgressHistoryProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

interface SparklineProps {
  scores: number[];
}

function Sparkline({ scores }: SparklineProps) {
  if (scores.length < 2) {
    // Single point — draw a short horizontal dash
    return (
      <svg width="100%" height="36" aria-hidden>
        <line x1="0" y1="18" x2="100%" y2="18" stroke="#7C9473" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  const W = 240;
  const H = 36;
  const pad = 4;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1; // avoid div-by-zero when all scores equal

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (W - pad * 2);
    // Invert Y: higher score → higher on canvas (lower y value)
    const y = H - pad - ((s - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="36"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#7C9473"       // accent-calm
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End-point dot */}
      {(() => {
        const last = points[points.length - 1].split(',');
        return (
          <circle
            cx={last[0]}
            cy={last[1]}
            r="3"
            fill="#7C9473"
          />
        );
      })()}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Summary sentence
// ---------------------------------------------------------------------------

function summaryText(sessions: SessionEntry[]): string {
  const n = sessions.length;
  const current = sessions[n - 1].success_score;
  const first   = sessions[0].success_score;

  const countWord =
    n === 1 ? '1 попытка' :
    n < 5   ? `${n} попытки` :
              `${n} попыток`;

  if (n === 1) return `${countWord} — результат ${current}`;

  const diff = current - first;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

  return `${countWord} — сейчас ${current}, было ${first} (${diffStr})`;
}

// ---------------------------------------------------------------------------
// Scenario card
// ---------------------------------------------------------------------------

function ScenarioCard({ item }: { item: ScenarioProgress }) {
  const scores = item.sessions.map((s) => s.success_score);

  return (
    <div className="bg-surface rounded-card px-6 py-6 flex flex-col gap-4">
      <p className="font-display text-xl font-semibold text-text-primary leading-snug">
        {item.display_name}
      </p>

      {/* Sparkline */}
      <div className="w-full opacity-80">
        <Sparkline scores={scores} />
      </div>

      {/* Summary */}
      <p className="font-sans text-sm text-text-secondary leading-relaxed">
        {summaryText(item.sessions)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProgressHistory({ onBack }: ProgressHistoryProps) {
  const [items, setItems]     = useState<ScenarioProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/users/me/progress')
      .then((r) => r.json() as Promise<ScenarioProgress[]>)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-section flex flex-col">

      {/* Back */}
      <button
        onClick={onBack}
        className="self-start font-sans text-sm text-text-secondary active:opacity-60 transition-opacity mb-section"
        aria-label="Назад"
      >
        ← Назад
      </button>

      {/* Heading */}
      <header className="mb-section">
        <h1 className="font-display italic text-3xl font-medium text-text-primary leading-snug">
          Прогресс
        </h1>
        <p className="mt-3 font-sans text-sm text-text-secondary leading-relaxed">
          как менялся результат по каждому сценарию
        </p>
      </header>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="w-10 h-10 rounded-full bg-accent-calm/30 animate-breathe" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="font-sans text-base text-text-secondary leading-relaxed text-center max-w-xs">
            Пока нет завершённых тренировок — начни первую, чтобы видеть,
            как меняется результат.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-block" role="list">
          {items.map((item) => (
            <li key={item.scenario_id}>
              <ScenarioCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
