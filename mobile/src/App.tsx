import { useEffect, useState } from 'react';

import WelcomeStep from './screens/onboarding/WelcomeStep';
import CategoriesStep from './screens/onboarding/CategoriesStep';
import MicPermissionStep from './screens/onboarding/MicPermissionStep';
import Home from './screens/Home';
import type { ResumeSession } from './screens/Home';
import DifficultySelect from './screens/DifficultySelect';
import type { Difficulty, PendingScenario } from './screens/DifficultySelect';
import ChatSession from './screens/ChatSession';
import SessionReview from './screens/SessionReview';
import type { ReviewData } from './screens/SessionReview';
import type { StrictnessLevel, StrictnessVariant } from './components/StrictnessBadge';
import { storageGet, storageSet } from './services/storage';

// ---------------------------------------------------------------------------
// Navigation state machine
//
//   boot → onboarding (0→1→2) → home
//          ↓ (flag set)
//         home → difficulty → chat → review → home
//                                           ↘ difficulty (retry)
// ---------------------------------------------------------------------------

type Screen = 'boot' | 'onboarding' | 'home' | 'difficulty' | 'chat' | 'review';

const ONBOARDING_KEY = 'onboarding_completed';
const SESSION_KEY    = 'active_session';

// ---------------------------------------------------------------------------
// Static badge metadata (StrictnessBadge display only)
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
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [screen, setScreen]           = useState<Screen>('boot');
  const [onbStep, setOnbStep]         = useState(0);
  const [session, setSession]         = useState<ResumeSession | null>(null);
  const [review, setReview]           = useState<ReviewData | null>(null);
  const [pending, setPending]         = useState<PendingScenario | null>(null);
  const [lastScenarioId, setLastScenarioId] = useState<string>('');
  const [resumeReady, setResumeReady] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const done = await storageGet(ONBOARDING_KEY);
      const raw  = await storageGet(SESSION_KEY);
      if (raw) {
        try { setSession(JSON.parse(raw) as ResumeSession); } catch { /* ignore */ }
      }
      setScreen(done === 'true' ? 'home' : 'onboarding');
      setResumeReady(true);
    }
    init();
  }, []);

  // ── Onboarding ───────────────────────────────────────────────────────────
  async function advanceOnboarding() {
    if (onbStep < 2) {
      setOnbStep((s) => s + 1);
    } else {
      await storageSet(ONBOARDING_KEY, 'true');
      setScreen('home');
    }
  }

  // ── Scenario tapped → show DifficultySelect ───────────────────────────────
  function handleScenarioSelect(scenario: PendingScenario) {
    setPending(scenario);
    setScreen('difficulty');
  }

  // ── Difficulty chosen → start session and go to chat ─────────────────────
  async function handleDifficultyConfirm(difficulty: Difficulty) {
    if (!pending) return;
    await startSession(pending.scenario_id, difficulty);
  }

  // ── Start session (called from difficulty confirm or retry) ───────────────
  async function startSession(scenarioId: string, difficulty: Difficulty = 'medium') {
    try {
      const res = await fetch(`${baseUrl}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId, difficulty }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        session_id: string; display_name: string; message: string;
      };

      const newSession: ResumeSession = {
        sessionId:      data.session_id,
        scenarioId,
        scenarioName:   data.display_name,
        openingMessage: data.message,
        strictness:     STRICTNESS_MAP[scenarioId] ?? 'medium',
        variant:        VARIANT_MAP[scenarioId]    ?? 'calm',
      };
      await storageSet(SESSION_KEY, JSON.stringify(newSession));
      setLastScenarioId(scenarioId);
      setSession(newSession);
      setPending(null);
      setScreen('chat');
    } catch (e) {
      console.error('Failed to start session', e);
    }
  }

  // ── Resume existing session ───────────────────────────────────────────────
  function handleResume() {
    if (session) setScreen('chat');
  }

  // ── Session ended → go to review ─────────────────────────────────────────
  async function handleSessionEnd(reviewData: ReviewData) {
    await storageSet(SESSION_KEY, '');
    setSession(null);
    setReview(reviewData);
    setScreen('review');
  }

  // ── Review: back to home ──────────────────────────────────────────────────
  function handleReviewHome() {
    setReview(null);
    setScreen('home');
  }

  // ── Review: retry → show difficulty picker for the same scenario ──────────
  function handleRetry() {
    setReview(null);
    if (lastScenarioId && pending) {
      // pending was cleared when session started — recreate a minimal object
      setScreen('difficulty');
    } else if (lastScenarioId) {
      // Restore pending from lastScenarioId (no short_description available, but OK)
      setPending({ scenario_id: lastScenarioId, display_name: '', short_description: '' });
      setScreen('difficulty');
    } else {
      setScreen('home');
    }
  }

  // ── Boot splash ───────────────────────────────────────────────────────────
  if (!resumeReady || screen === 'boot') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-accent-calm/30 animate-breathe" />
      </div>
    );
  }

  // ── Onboarding ───────────────────────────────────────────────────────────
  if (screen === 'onboarding') {
    const TOTAL = 3;
    if (onbStep === 0) return <WelcomeStep    step={1} total={TOTAL} onNext={advanceOnboarding} />;
    if (onbStep === 1) return <CategoriesStep step={2} total={TOTAL} onNext={advanceOnboarding} />;
    return                    <MicPermissionStep step={3} total={TOTAL} onDone={advanceOnboarding} />;
  }

  // ── Difficulty ────────────────────────────────────────────────────────────
  if (screen === 'difficulty' && pending) {
    return (
      <DifficultySelect
        scenario={pending}
        variant={VARIANT_MAP[pending.scenario_id] ?? 'calm'}
        onConfirm={handleDifficultyConfirm}
        onBack={() => setScreen('home')}
      />
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  if (screen === 'chat' && session) {
    return (
      <ChatSession
        sessionId={session.sessionId}
        scenarioName={session.scenarioName}
        strictness={session.strictness}
        variant={session.variant}
        openingMessage={session.openingMessage}
        onEnd={handleSessionEnd}
      />
    );
  }

  // ── Review ───────────────────────────────────────────────────────────────
  if (screen === 'review' && review) {
    return (
      <SessionReview
        review={review}
        scenarioId={lastScenarioId}
        onHome={handleReviewHome}
        onRetry={handleRetry}
      />
    );
  }

  // ── Home (default) ────────────────────────────────────────────────────────
  return (
    <Home
      resumeSession={session}
      onResume={handleResume}
      onSelect={handleScenarioSelect}
    />
  );
}
