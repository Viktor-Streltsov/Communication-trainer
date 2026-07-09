import { useEffect, useState } from 'react';

import BreathingDot from '../components/BreathingDot';
import StrictnessBadge from '../components/StrictnessBadge';
import type { StrictnessLevel, StrictnessVariant } from '../components/StrictnessBadge';
import type { PendingScenario } from './DifficultySelect';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioItem {
  scenario_id: string;
  display_name: string;
  short_description: string;
  strictness: StrictnessLevel;
  variant: StrictnessVariant;
}

export interface ResumeSession {
  sessionId: string;
  scenarioId: string;
  scenarioName: string;
  openingMessage: string;
  strictness: StrictnessLevel;
  variant: StrictnessVariant;
}

interface HomeProps {
  resumeSession: ResumeSession | null;
  onResume: () => void;
  /** Called with the full scenario object so App can show DifficultySelect */
  onSelect: (scenario: PendingScenario) => void;
}

// ---------------------------------------------------------------------------
// Static variant mapping (display only — strictness & variant not in API)
// ---------------------------------------------------------------------------

const VARIANT_MAP: Record<string, StrictnessVariant> = {
  interview_strict:     'calm',
  boss_business:        'calm',
  family_parent:        'warm',
  partner_conversation: 'warm',
  friend_casual:        'warm',
};

const STRICTNESS_MAP: Record<string, StrictnessLevel> = {
  interview_strict:     'strict',
  boss_business:        'medium',
  family_parent:        'soft',
  partner_conversation: 'medium',
  friend_casual:        'soft',
};

// ---------------------------------------------------------------------------
// Time-aware greeting
// ---------------------------------------------------------------------------

interface Greeting {
  title: string;
  subtitle: string;
}

export function getTimeAwareGreeting(date: Date): Greeting {
  const h = date.getHours();

  if (h >= 5 && h < 11) {
    return {
      title:    'Доброе утро',
      subtitle: 'хорошее время, чтобы собраться с мыслями',
    };
  }
  if (h >= 11 && h < 17) {
    return {
      title:    'Добрый день',
      subtitle: 'выбери сценарий и начнём, когда будешь готов',
    };
  }
  if (h >= 17 && h < 23) {
    return {
      title:    'Добрый вечер',
      subtitle: 'можно потренироваться перед завтрашним днём',
    };
  }
  // 23:00–5:00
  return {
    title:    'Уже поздно',
    subtitle:
      'Возможно, сейчас лучше отдохнуть, чем тренироваться. Но если не спится — я здесь, когда будешь готов.',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home({ resumeSession, onResume, onSelect }: HomeProps) {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading]     = useState(true);

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
  const { title, subtitle } = getTimeAwareGreeting(new Date());

  useEffect(() => {
    fetch(`${baseUrl}/chat/scenarios`)
      .then((r) => r.json() as Promise<{
        scenario_id: string;
        display_name: string;
        short_description: string;
        strictness: string;
      }[]>)
      .then((data) =>
        setScenarios(
          data.map((s) => ({
            scenario_id:       s.scenario_id,
            display_name:      s.display_name,
            short_description: s.short_description ?? '',
            strictness: (STRICTNESS_MAP[s.scenario_id] ?? 'medium') as StrictnessLevel,
            variant:    (VARIANT_MAP[s.scenario_id]    ?? 'calm')   as StrictnessVariant,
          })),
        ),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const otherScenarios = resumeSession
    ? scenarios.filter((s) => s.scenario_id !== resumeSession.scenarioId)
    : scenarios;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background px-6 py-section">

      {/* Greeting */}
      <header className="mb-section">
        <h1 className="font-display italic text-3xl font-medium text-text-primary leading-snug">
          {title}
        </h1>
        <p className="mt-3 font-sans text-sm text-text-secondary leading-relaxed">
          {subtitle}
        </p>
      </header>

      {/* Resume session card */}
      {resumeSession && (
        <section className="mb-section">
          <div className="bg-surface rounded-card px-6 py-6 flex flex-col gap-4">
            <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
              Мы остановились здесь
            </p>
            <p className="font-display text-xl font-semibold text-text-primary leading-snug">
              {resumeSession.scenarioName}
            </p>
            <StrictnessBadge level={resumeSession.strictness} variant={resumeSession.variant} />
            <button
              onClick={onResume}
              className="self-start bg-button-primary text-button-primary-text font-sans text-sm font-medium px-5 py-3 rounded-card active:opacity-80 transition-opacity"
            >
              Начать, когда буду готов
            </button>
          </div>
        </section>
      )}

      {/* Scenario list */}
      {loading ? (
        <div className="flex flex-col items-center gap-block pt-section">
          <BreathingDot size="w-12 h-12" />
          <p className="font-sans text-text-secondary text-sm">загружаем сценарии…</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-block" role="list">
          {otherScenarios.map((s) => (
            <li key={s.scenario_id}>
              <button
                onClick={() =>
                  onSelect({
                    scenario_id:       s.scenario_id,
                    display_name:      s.display_name,
                    short_description: s.short_description,
                  })
                }
                className="w-full text-left bg-surface rounded-card px-6 py-6 flex flex-col gap-3 active:opacity-80 transition-opacity"
              >
                <span className="font-display text-xl font-semibold text-text-primary leading-snug">
                  {s.display_name}
                </span>

                {s.short_description && (
                  <span className="font-sans text-sm text-text-secondary leading-relaxed line-clamp-2">
                    {s.short_description}
                  </span>
                )}

                <StrictnessBadge level={s.strictness} variant={s.variant} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
