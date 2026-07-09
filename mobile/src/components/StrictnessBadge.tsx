/**
 * StrictnessBadge — shows the scenario's strictness level as a word,
 * never as a number or percentage.
 *
 * - "деловые/строгие" scenarios → accent-calm (sage green)
 * - "близкие люди/тёплые" scenarios → accent-warm (dusty clay)
 *
 * Usage:
 *   <StrictnessBadge level="medium" variant="calm" />
 *   → ● средняя
 */

export type StrictnessLevel = 'soft' | 'medium' | 'strict';
export type StrictnessVariant = 'calm' | 'warm';

const LABEL: Record<StrictnessLevel, string> = {
  soft: 'мягкая',
  medium: 'средняя',
  strict: 'строгая',
};

interface StrictnessBadgeProps {
  level: StrictnessLevel;
  variant: StrictnessVariant;
  className?: string;
}

export default function StrictnessBadge({
  level,
  variant,
  className = '',
}: StrictnessBadgeProps) {
  const dotColor =
    variant === 'calm' ? 'bg-accent-calm' : 'bg-accent-warm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-sans text-sm text-text-secondary ${className}`}
    >
      <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
      {LABEL[level]}
    </span>
  );
}
