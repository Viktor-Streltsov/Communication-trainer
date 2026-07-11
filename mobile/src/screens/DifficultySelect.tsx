// ---------------------------------------------------------------------------
// DifficultySelect — shown after tapping a scenario card, before starting chat.
// The user picks a difficulty level; the choice is sent as `difficulty` to
// POST /chat/start.
// ---------------------------------------------------------------------------

import type { StrictnessVariant } from '../components/StrictnessBadge';

export type Difficulty = 'soft' | 'medium' | 'hard';

export interface PendingScenario {
  scenario_id: string;
  display_name: string;
  short_description: string;
}

interface DifficultySelectProps {
  scenario: PendingScenario;
  variant: StrictnessVariant;
  onConfirm: (difficulty: Difficulty) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Difficulty options
// ---------------------------------------------------------------------------

const OPTIONS: { value: Difficulty; label: string; note: string }[] = [
  {
    value: 'soft',
    label: 'мягкая',
    note: 'собеседник будет терпеливее и даст время на размышление',
  },
  {
    value: 'medium',
    label: 'средняя',
    note: 'стандартное поведение персонажа, как описано в сценарии',
  },
  {
    value: 'hard',
    label: 'строгая',
    note: 'собеседник будет особенно требовательным и менее терпимым к расплывчатым ответам',
  },
];

// Intensity scale: softer → more transparent, harder → fully opaque.
const DOT_OPACITY: Record<Difficulty, string> = {
  soft:   'opacity-30',
  medium: 'opacity-60',
  hard:   'opacity-100',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DifficultySelect({
  scenario,
  variant,
  onConfirm,
  onBack,
}: DifficultySelectProps) {
  const dotColor = variant === 'calm' ? 'bg-accent-calm' : 'bg-accent-warm';

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-section">

      {/* Back link */}
      <button
        onClick={onBack}
        className="self-start font-sans text-sm text-text-secondary underline-offset-2 hover:underline mb-section"
      >
        ← назад
      </button>

      {/* Scenario header */}
      <header className="mb-section">
        <h1 className="font-display text-3xl font-semibold text-text-primary leading-snug">
          {scenario.display_name}
        </h1>
        {scenario.short_description && (
          <p className="mt-3 font-sans text-sm text-text-secondary leading-relaxed">
            {scenario.short_description}
          </p>
        )}
      </header>

      {/* Difficulty label */}
      <p className="font-sans text-xs text-text-secondary uppercase tracking-wide mb-4">
        Выбери сложность
      </p>

      {/* Options — card list, lifted off the background */}
      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onConfirm(opt.value)}
            className="w-full text-left bg-surface rounded-card px-4 py-[0.875rem]
              flex flex-col gap-1
              hover:shadow-sm active:scale-[0.98]
              transition-all duration-150"
          >
            {/* Label row with intensity dot */}
            <span className="inline-flex items-center gap-2 font-sans text-base text-text-primary font-medium">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${DOT_OPACITY[opt.value]}`}
              />
              {opt.label}
            </span>
            {/* Note indented to align with label text (dot 6px + gap 8px = 14px) */}
            <span className="font-sans text-sm text-text-secondary leading-relaxed pl-[14px]">
              {opt.note}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
