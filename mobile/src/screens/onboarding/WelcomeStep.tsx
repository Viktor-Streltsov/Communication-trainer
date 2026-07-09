import BreathingDot from '../../components/BreathingDot';

interface WelcomeStepProps {
  /** 1-based current step index */
  step: number;
  total: number;
  onNext: () => void;
}

export default function WelcomeStep({ step, total, onNext }: WelcomeStepProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-section">
      {/* Progress line */}
      <StepProgress current={step} total={total} />

      {/* Content — vertically centred */}
      <div className="flex-1 flex flex-col items-center justify-center gap-block text-center">
        <h1 className="font-display italic text-4xl font-medium text-text-primary leading-snug">
          Прежде чем начать
        </h1>

        <p className="font-sans text-text-secondary text-base leading-relaxed max-w-xs">
          выдохни, никто не оценивает — только ты
        </p>

        <div className="my-section">
          <BreathingDot size="w-20 h-20" colorClass="bg-accent-calm" />
        </div>
      </div>

      {/* CTA — pinned to bottom */}
      <button
        onClick={onNext}
        className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity"
      >
        Начать, когда буду готов
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared step progress indicator — a thin single line, not coloured dots
// ---------------------------------------------------------------------------

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-section" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-px flex-1 transition-colors duration-500 ${
            i < current ? 'bg-text-secondary' : 'bg-text-secondary/25'
          }`}
        />
      ))}
    </div>
  );
}

export { StepProgress };
