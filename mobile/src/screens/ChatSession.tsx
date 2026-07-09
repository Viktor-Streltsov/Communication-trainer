import { useEffect, useRef, useState } from 'react';

import StrictnessBadge from '../components/StrictnessBadge';
import type { StrictnessLevel, StrictnessVariant } from '../components/StrictnessBadge';
import type { ReviewData } from './SessionReview';

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '(ошибка связи — попробуй ещё раз)' },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
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
      // If end call fails, still navigate away — review can be fetched later
      onEnd({
        session_id: sessionId,
        success_score: 0,
        overall_impression: '',
        strengths: [],
        weak_points: [],
        suggested_phrasings: [],
        motivational_message: '',
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-surface px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-display text-base font-semibold text-text-primary truncate">
            {scenarioName}
          </span>
          <StrictnessBadge level={strictness} variant={variant} />
        </div>

        <button
          onClick={handleEnd}
          disabled={sending}
          className="flex-shrink-0 font-sans text-sm text-text-secondary underline-offset-2 hover:underline disabled:opacity-40 transition-opacity"
        >
          завершить
        </button>
      </header>

      {/* ── Message feed ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-block flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] ${
              msg.sender === 'user' ? 'self-end' : 'self-start'
            }`}
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
              печатает…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <footer className="bg-surface px-6 py-4 flex items-end gap-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Напиши что-нибудь…"
          disabled={sending}
          className="flex-1 resize-none bg-background rounded-card px-4 py-3 font-sans text-sm text-text-primary placeholder:text-text-secondary focus:outline-none leading-relaxed disabled:opacity-40"
          style={{ maxHeight: '8rem' }}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="flex-shrink-0 bg-button-primary text-button-primary-text font-sans text-sm font-medium px-5 py-3 rounded-card disabled:opacity-40 transition-opacity active:opacity-70"
        >
          →
        </button>
      </footer>
    </div>
  );
}
