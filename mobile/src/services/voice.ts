/**
 * voice.ts — thin abstraction over speech input/output.
 *
 * Strategy:
 *   - On native Android: uses @capacitor-community/speech-recognition + text-to-speech
 *   - In browser (npm run dev): falls back to Web Speech API (works in Chrome/Edge)
 *
 * All public functions are async and return void or a string, so the caller
 * never needs to know which backend is active.
 */

import { Capacitor } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceService {
  /** Check and request mic permission. Returns true if granted. */
  requestPermission(): Promise<boolean>;
  /**
   * Start listening for speech. Calls onResult when a transcript is ready,
   * or onError on failure. Resolves when listening starts.
   */
  startListening(options: {
    onResult: (transcript: string) => void;
    onError: (err: string) => void;
  }): Promise<void>;
  /** Stop an in-progress recognition session. */
  stopListening(): Promise<void>;
  /** Speak text aloud. Resolves when speech finishes (or starts, on some backends). */
  speak(text: string, lang?: string): Promise<void>;
  /** Stop ongoing speech synthesis. */
  stopSpeaking(): void;
}

// ---------------------------------------------------------------------------
// Native Capacitor implementation
// ---------------------------------------------------------------------------

async function makeNativeVoice(): Promise<VoiceService> {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech');

  return {
    async requestPermission() {
      const { speechRecognition } = await SpeechRecognition.requestPermissions();
      return speechRecognition === 'granted';
    },

    async startListening({ onResult, onError }) {
      await SpeechRecognition.addListener('partialResults', () => {});

      SpeechRecognition.addListener('listeningState', (state: { status: string }) => {
        if (state.status === 'stopped') {
          // handled via start result
        }
      });

      try {
        const result = await SpeechRecognition.start({
          language: 'ru-RU',
          maxResults: 1,
          popup: false,
        });
        const transcript = result?.matches?.[0] ?? '';
        if (transcript) onResult(transcript);
        else onError('Не удалось распознать речь');
      } catch (e) {
        onError(String(e));
      }
    },

    async stopListening() {
      await SpeechRecognition.stop();
    },

    async speak(text, lang = 'ru-RU') {
      await TextToSpeech.speak({ text, lang, rate: 1.0, pitch: 1.0, volume: 1.0 });
    },

    stopSpeaking() {
      TextToSpeech.stop();
    },
  };
}

// ---------------------------------------------------------------------------
// Browser Web Speech API implementation
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognitionCtor = new () => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _webRecognition: any = null;

function getSpeechRecognitionCtor(): AnySpeechRecognitionCtor | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function makeWebVoice(): VoiceService {
  return {
    async requestPermission() {
      if (!getSpeechRecognitionCtor()) return false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        return false;
      }
    },

    async startListening({ onResult, onError }) {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        onError('Web Speech API недоступен в этом браузере');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      _webRecognition?.abort();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const rec = new Ctor();
      _webRecognition = rec;
      rec.lang = 'ru-RU';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const transcript: string = event.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) onResult(transcript);
        else onError('Пустой результат распознавания');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (event: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        onError(`Ошибка распознавания: ${event.error}`);
      };

      rec.onnomatch = () => onError('Не удалось распознать речь');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      rec.start();
    },

    async stopListening() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      _webRecognition?.stop();
      _webRecognition = null;
    },

    async speak(text, lang = 'ru-RU') {
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    },

    stopSpeaking() {
      window.speechSynthesis.cancel();
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton factory — picks the right implementation at runtime
// ---------------------------------------------------------------------------

let _instance: VoiceService | null = null;

export async function getVoiceService(): Promise<VoiceService> {
  if (_instance) return _instance;
  if (Capacitor.isNativePlatform()) {
    _instance = await makeNativeVoice();
  } else {
    _instance = makeWebVoice();
  }
  return _instance;
}
