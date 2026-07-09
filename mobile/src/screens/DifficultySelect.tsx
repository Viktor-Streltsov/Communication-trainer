// ---------------------------------------------------------------------------
// DifficultySelect — shown after tapping a scenario card, before starting chat.
// The user picks a difficulty level; the choice is sent as `difficulty` to
// POST /chat/start.
// ---------------------------------------------------------------------------

export type Difficulty = 'soft' | 'medium' | 'hard';

export interface PendingScenario {
  scenario_id: string;
  display_name: string;
  short_description: string;
}

interface DifficultySelectProps {
  scenario: PendingScenario;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DifficultySelect({
  scenario,
  onConfirm,
  onBack,
}: DifficultySelectProps) {
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

      {/* Options */}
      <ul className="flex flex-col" role="list">
        {OPTIONS.map((opt) => (
          <li key={opt.value}>
            <button
              onClick={() => onConfirm(opt.value)}
              className="w-full text-left py-block border-b border-text-secondary/15 last:border-0 flex flex-col gap-1 active:opacity-60 transition-opacity"
            >
              <span className="font-sans text-base text-text-primary font-medium">
                {opt.label}
              </span>
              <span className="font-sans text-sm text-text-secondary leading-relaxed">
                {opt.note}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
