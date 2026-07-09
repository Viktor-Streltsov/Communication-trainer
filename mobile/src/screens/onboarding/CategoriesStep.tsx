import { StepProgress } from './WelcomeStep';

interface CategoriesStepProps {
  step: number;
  total: number;
  onNext: () => void;
}

const CATEGORIES = [
  {
    label: 'Собеседование и руководитель',
    note: 'деловые разговоры, где важна конкретика',
  },
  {
    label: 'Партнёр и родители',
    note: 'близкие люди, которым важно тебя понять',
  },
  {
    label: 'Дружеский разговор',
    note: 'неформально, но тоже бывает непросто',
  },
];

export default function CategoriesStep({ step, total, onNext }: CategoriesStepProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-section">
      <StepProgress current={step} total={total} />

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-display text-3xl font-semibold text-text-primary leading-snug mb-section">
          Что здесь можно тренировать
        </h2>

        <ul className="flex flex-col" role="list">
          {CATEGORIES.map((cat) => (
            <li
              key={cat.label}
              className="py-block border-b border-text-secondary/15 last:border-0"
            >
              <p className="font-sans text-text-primary text-base leading-snug">
                {cat.label}
              </p>
              <p className="font-sans text-text-secondary text-sm mt-1 leading-relaxed">
                {cat.note}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onNext}
        className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity"
      >
        Понятно
      </button>
    </div>
  );
}
