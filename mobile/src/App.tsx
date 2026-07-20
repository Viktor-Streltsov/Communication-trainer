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
import EmailStep from './screens/auth/EmailStep';
import CodeStep from './screens/auth/CodeStep';
import ProgressHistory from './screens/ProgressHistory';
import CreateScenario from './screens/CreateScenario';
import type { StrictnessLevel, StrictnessVariant } from './components/StrictnessBadge';
import { storageGet, storageSet } from './services/storage';
import { apiFetch, AUTH_TOKEN_KEY, AUTH_USER_KEY } from './services/api';
import {
  recordActivity,
  cancelReminder,
  scheduleReminder,
  requestPermission,
  markPermissionAsked,
  hasAskedPermission,
  incrementSessionsDone,
} from './services/notifications';

// ---------------------------------------------------------------------------
// Navigation state machine
//
//   boot → onboarding (0→1→2) → home
//          ↓ (flag set)
//         home → difficulty → chat → review → home
//                                           ↘ difficulty (retry)
//         home → auth-email → auth-code → home
// ---------------------------------------------------------------------------

type Screen = 'boot' | 'onboarding' | 'home' | 'difficulty' | 'chat' | 'review' | 'auth-email' | 'auth-code' | 'progress' | 'create-scenario';

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
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [authEmail, setAuthEmail]     = useState('');
  const [notifPromptVisible, setNotifPromptVisible] = useState(false);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const done  = await storageGet(ONBOARDING_KEY);
      const raw   = await storageGet(SESSION_KEY);
      const token = await storageGet(AUTH_TOKEN_KEY);
      if (raw) {
        try { setSession(JSON.parse(raw) as ResumeSession); } catch { /* ignore */ }
      }
      if (token) setIsLoggedIn(true);

      // Record this visit, cancel any stale notification, reschedule
      await recordActivity();
      await cancelReminder();
      await scheduleReminder();

      setScreen(done === 'true' ? 'home' : 'onboarding');
      setResumeReady(true);
    }
    init();
  }, []);

  // ── Reschedule when user lands on Home ───────────────────────────────────
  useEffect(() => {
    if (screen === 'home') {
      scheduleReminder();
    }
  }, [screen]);

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

  // ── Auth flow ─────────────────────────────────────────────────────────────
  function handleLoginPress() {
    setScreen('auth-email');
  }

  function handleEmailSent(email: string) {
    setAuthEmail(email);
    setScreen('auth-code');
  }

  function handleAuthSuccess() {
    setIsLoggedIn(true);
    setScreen('home');
  }

  function handleProgressPress() {
    setScreen('progress');
  }

  function handleCreateScenarioPress() {
    setScreen('create-scenario');
  }

  function handleScenarioCreated(scenario: PendingScenario) {
    setPending(scenario);
    setScreen('difficulty');
  }

  // ── Start session (called from difficulty confirm or retry) ───────────────
  async function startSession(scenarioId: string, difficulty: Difficulty = 'medium') {
    try {
      const res = await apiFetch('/chat/start', {
        method: 'POST',
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

    // After the first completed session, surface the notification permission
    // prompt on the way back to Home (if not already asked).
    const count = await incrementSessionsDone();
    if (count === 1 && !(await hasAskedPermission())) {
      setNotifPromptVisible(true);
    }
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

  // ── Progress history ──────────────────────────────────────────────────────
  if (screen === 'progress') {
    return <ProgressHistory onBack={() => setScreen('home')} />;
  }

  // ── Create custom scenario ────────────────────────────────────────────────
  if (screen === 'create-scenario') {
    return (
      <CreateScenario
        onSuccess={handleScenarioCreated}
        onBack={() => setScreen('home')}
      />
    );
  }

  // ── Auth screens ─────────────────────────────────────────────────────────
  if (screen === 'auth-email') {
    return (
      <EmailStep
        onCodeSent={handleEmailSent}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'auth-code') {
    return (
      <CodeStep
        email={authEmail}
        onSuccess={handleAuthSuccess}
        onBack={() => setScreen('auth-email')}
      />
    );
  }

  // ── Home (default) ────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <Home
        resumeSession={session}
        onResume={handleResume}
        onSelect={handleScenarioSelect}
        isLoggedIn={isLoggedIn}
        onLoginPress={handleLoginPress}
        onProgressPress={handleProgressPress}
        onCreateScenario={handleCreateScenarioPress}
      />
      {notifPromptVisible && (
        <NotifPromptBanner
          onAccept={async () => {
            await markPermissionAsked();
            setNotifPromptVisible(false);
            const granted = await requestPermission();
            if (granted) await scheduleReminder();
          }}
          onDecline={async () => {
            await markPermissionAsked();
            setNotifPromptVisible(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotifPromptBanner — appears once after the first completed session
// ---------------------------------------------------------------------------

interface NotifPromptBannerProps {
  onAccept: () => void;
  onDecline: () => void;
}

function NotifPromptBanner({ onAccept, onDecline }: NotifPromptBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-text-secondary/10 px-6 py-5 flex flex-col gap-3 shadow-sm">
      <p className="font-sans text-sm text-text-primary leading-relaxed">
        Показать напоминание, если давно не заходил?{' '}
        <span className="text-text-secondary">Без спама — максимум раз в несколько дней.</span>
      </p>
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="flex-1 bg-button-primary text-button-primary-text font-sans text-sm font-medium py-3 rounded-card active:opacity-80 transition-opacity"
        >
          Да, хорошо
        </button>
        <button
          onClick={onDecline}
          className="flex-1 bg-transparent text-text-secondary font-sans text-sm py-3 rounded-card active:opacity-60 transition-opacity"
        >
          Нет, спасибо
        </button>
      </div>
    </div>
  );
}
