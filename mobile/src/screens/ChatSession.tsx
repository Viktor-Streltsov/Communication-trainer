import { useEffect, useRef, useState } from 'react';

import StrictnessBadge from '../components/StrictnessBadge';
import type { StrictnessLevel, StrictnessVariant } from '../components/StrictnessBadge';
import type { ReviewData } from './SessionReview';
import { getVoiceService } from '../services/voice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

interface ChatSessionProps {
  sessionId: string;
  scenarioName: string;
  strictness: StrictnessLevel;
  variant: StrictnessVariant;
  openingMessage: string;
  onEnd: (review: ReviewData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatSession({
  sessionId,
  scenarioName,
  strictness,
  variant,
  openingMessage,
  onEnd,
}: ChatSessionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'ai', text: openingMessage },
  ]);
  const [draft, setDraft]         = useState('');
  const [sending, setSending]     = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const baseUrl   = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speak the opening message when voice mode is first enabled
  useEffect(() => {
    if (!voiceMode) return;
    speakText(openingMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  // Stop TTS when leaving voice mode
  useEffect(() => {
    if (voiceMode) return;
    getVoiceService().then((svc) => svc.stopSpeaking());
    setSpeaking(false);
  }, [voiceMode]);

  // ---------------------------------------------------------------------------
  // Voice helpers
  // ---------------------------------------------------------------------------

  async function speakText(text: string) {
    const svc = await getVoiceService();
    setSpeaking(true);
    await svc.speak(text);
    setSpeaking(false);
  }

  async function handleMicPress() {
    if (listening) {
      const svc = await getVoiceService();
      await svc.stopListening();
      setListening(false);
      return;
    }

    const svc = await getVoiceService();
    const granted = await svc.requestPermission();
    if (!granted) return;

    setListening(true);
    await svc.startListening({
      onResult: (transcript) => {
        setListening(false);
        sendText(transcript);
      },
      onError: () => {
        setListening(false);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  async function sendText(text: string) {
    if (!text.trim() || sending) return;
    setDraft('');
    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setSending(true);

    try {
      const res = await fetch(`${baseUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { message: string };
      setMessages((prev) => [...prev, { sender: 'ai', text: data.message }]);
      if (voiceMode) speakText(data.message);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '(ошибка связи — попробуй ещё раз)' },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function send() {
    await sendText(draft.trim());
  }

  async function handleEnd() {
    // Stop any ongoing voice before leaving
    const svc = await getVoiceService();
    svc.stopSpeaking();
    await svc.stopListening();

    setSending(true);
    try {
      const res = await fetch(`${baseUrl}/chat/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const review = await res.json() as ReviewData;
      onEnd(review);
    } catch {
      onEnd({
        session_id: sessionId,
        success_score: 0,
        overall_impression: '',
        strengths: [],
        weak_points: [],
        suggested_phrasings: [],
        motivational_message: '',
        summary_text: '',
        revealed_trait: null,
      });
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-surface px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-display text-base font-semibold text-text-primary truncate">
            {scenarioName}
          </span>
          <StrictnessBadge level={strictness} variant={variant} />
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Voice mode toggle */}
          <button
            onClick={() => setVoiceMode((v) => !v)}
            title={voiceMode ? 'Переключить в текстовый режим' : 'Переключить в голосовой режим'}
            className={`text-lg transition-opacity ${voiceMode ? 'opacity-100' : 'opacity-35'} hover:opacity-80`}
          >
            {/* Headphones icon — SVG inline to avoid icon lib dependency */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-text-secondary"
            >
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
              <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
          </button>

          <button
            onClick={handleEnd}
            disabled={sending}
            className="font-sans text-sm text-text-secondary underline-offset-2 hover:underline disabled:opacity-40 transition-opacity"
          >
            завершить
          </button>
        </div>
      </header>

      {/* ── Message feed ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-block flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}
          >
            <div
              className={`rounded-card px-4 py-3 font-sans text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-button-primary text-button-primary-text'
                  : 'bg-surface text-text-primary'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {sending && (
          <div className="self-start max-w-[80%]">
            <div className="rounded-card px-4 py-3 bg-surface text-text-secondary font-sans text-sm italic">
              {speaking ? 'озвучивает…' : 'печатает…'}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <footer className="bg-surface px-6 py-4">
        {voiceMode ? (
          /* ── Voice mode ─────────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-3">
            <p className="font-sans text-xs text-text-secondary">
              {listening ? 'слушаю… нажми ещё раз чтобы остановить' : 'нажми чтобы говорить'}
            </p>
            <button
              onClick={handleMicPress}
              disabled={sending}
              className={`w-16 h-16 rounded-full flex items-center justify-center
                transition-all duration-200 disabled:opacity-40
                ${listening
                  ? 'bg-red-400/90 scale-110 shadow-lg'
                  : 'bg-button-primary hover:opacity-80 active:scale-95'
                }`}
            >
              {listening ? (
                /* Stop / recording indicator */
                <span className="w-4 h-4 rounded-sm bg-white" />
              ) : (
                /* Mic icon */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="9" y="2" width="6" height="11" rx="3"/>
                  <path d="M5 10a7 7 0 0 0 14 0"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>
          </div>
        ) : (
          /* ── Text mode ──────────────────────────────────────────────────── */
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Напиши что-нибудь…"
              disabled={sending}
              className="flex-1 resize-none bg-background rounded-card px-4 py-3 font-sans text-sm
                text-text-primary placeholder:text-text-secondary focus:outline-none
                leading-relaxed disabled:opacity-40"
              style={{ maxHeight: '8rem' }}
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="flex-shrink-0 bg-button-primary text-button-primary-text font-sans text-sm
                font-medium px-5 py-3 rounded-card disabled:opacity-40 transition-opacity active:opacity-70"
            >
              →
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
