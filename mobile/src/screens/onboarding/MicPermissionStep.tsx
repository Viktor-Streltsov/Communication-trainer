import { StepProgress } from './WelcomeStep';

interface MicPermissionStepProps {
  step: number;
  total: number;
  onDone: () => void;
}

export default function MicPermissionStep({ step, total, onDone }: MicPermissionStepProps) {
  async function requestMic() {
    try {
      // In the browser dev build we use the standard Web API.
      // When Capacitor is added (Этап 5 / voice step), replace this with
      // SpeechRecognition.requestPermissions() from
      // @capacitor-community/speech-recognition.
      await navigator.mediaDevices?.getUserMedia({ audio: true });
    } catch {
      // Permission denied or API unavailable — continue anyway
    } finally {
      onDone();
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-section">
      <StepProgress current={step} total={total} />

      <div className="flex-1 flex flex-col justify-center gap-block">
        <h2 className="font-display text-3xl font-semibold text-text-primary leading-snug">
          Голос — если захочешь
        </h2>

        <p className="font-sans text-text-secondary text-base leading-relaxed">
          Так тренировка ближе к настоящему разговору. Но можно и текстом —
          переключишь в любой момент прямо в чате.
        </p>

        <p className="font-sans text-text-secondary text-sm leading-relaxed">
          Разрешение нужно только для микрофона. Мы не записываем и не
          храним голос — всё остаётся на устройстве.
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-section">
        <button
          onClick={requestMic}
          className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity"
        >
          Разрешить микрофон
        </button>

        {/* "Later" — text link, not a button */}
        <button
          onClick={onDone}
          className="font-sans text-sm text-text-secondary underline-offset-2 hover:underline py-2"
        >
          Позже
        </button>
      </div>
    </div>
  );
}
