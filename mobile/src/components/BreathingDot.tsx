/**
 * BreathingDot — signature element of the "Quiet Room" design system.
 *
 * A softly pulsing circle shown before any session starts as a brief
 * "breathe out" ritual. Animation: scale 0.9 → 1.1 → 0.9, opacity
 * 0.7 → 1 → 0.7, duration 3.5 s, ease-in-out, infinite.
 *
 * The keyframe is defined in tailwind.config.js (animate-breathe).
 */

interface BreathingDotProps {
  /** Diameter in Tailwind size units, default w-16 / h-16 (64 px) */
  size?: string;
  /** Tailwind color class for the dot fill, default bg-accent-calm */
  colorClass?: string;
}

export default function BreathingDot({
  size = 'w-16 h-16',
  colorClass = 'bg-accent-calm',
}: BreathingDotProps) {
  return (
    <span
      className={`inline-block rounded-full ${size} ${colorClass} animate-breathe`}
      aria-hidden="true"
    />
  );
}
