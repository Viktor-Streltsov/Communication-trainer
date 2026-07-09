// ---------------------------------------------------------------------------
// SessionReview — post-session coach analysis screen
// Design system: background / surface / accent-calm / accent-warm /
//                button-primary / font-display / font-sans
// ---------------------------------------------------------------------------

interface WeakPoint {
  phrase: string;
  problem: string;
}

interface SuggestedPhrasing {
  original: string;
  improved: string;
}

export interface ReviewData {
  session_id: string;
  success_score: number;
  overall_impression: string;
  strengths: string[];
  weak_points: WeakPoint[];
  suggested_phrasings: SuggestedPhrasing[];
  motivational_message: string;
}

interface SessionReviewProps {
  review: ReviewData;
  scenarioId: string;
  onHome: () => void;
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// Score label
// ---------------------------------------------------------------------------

function getScoreLabel(score: number): string {
  if (score <= 40) return 'было непросто';
  if (score <= 70) return 'неплохое начало';
  return 'уверенно донёс мысль';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-xl font-semibold text-text-primary mb-3 leading-snug">
      {children}
    </h2>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="font-sans text-sm text-text-secondary italic">{text}</p>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SessionReview({
  review,
  onHome,
  onRetry,
}: SessionReviewProps) {
  const {
    success_score,
    overall_impression,
    strengths,
    weak_points,
    suggested_phrasings,
    motivational_message,
  } = review;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-6 py-section pb-36">

        {/* ── 1. Score ──────────────────────────────────────────────────── */}
        <section className="mb-section text-center">
          <p
            className="font-display font-semibold text-text-primary leading-none"
            style={{ fontSize: '56px' }}
          >
            {success_score}
          </p>
          <p className="font-sans text-sm text-text-secondary mt-2">
            {getScoreLabel(success_score)}
          </p>
        </section>

        {/* ── 2. Overall impression ─────────────────────────────────────── */}
        {overall_impression ? (
          <section className="mb-section">
            <p className="font-sans text-base text-text-primary leading-relaxed">
              {overall_impression}
            </p>
          </section>
        ) : null}

        {/* ── 3. Strengths ──────────────────────────────────────────────── */}
        <section className="mb-section">
          <SectionTitle>Что получилось</SectionTitle>
          {strengths.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {strengths.map((s, i) => (
                <li key={i} className="font-sans text-sm text-text-primary leading-relaxed flex gap-2">
                  <span className="text-accent-calm mt-0.5 flex-shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote text="Коуч не выделил отдельных сильных сторон." />
          )}
        </section>

        {/* ── 4. Weak points ────────────────────────────────────────────── */}
        <section className="mb-section">
          <SectionTitle>Над чем поработать</SectionTitle>
          {weak_points.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {weak_points.map((wp, i) => (
                <li key={i} className="flex flex-col gap-1">
                  {wp.phrase && (
                    <p className="font-sans text-sm text-text-primary italic leading-relaxed">
                      «{wp.phrase}»
                    </p>
                  )}
                  <p className="font-sans text-sm text-text-secondary leading-relaxed">
                    {wp.problem}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote text="Явных слабых мест не обнаружено." />
          )}
        </section>

        {/* ── 5. Suggested phrasings ────────────────────────────────────── */}
        <section className="mb-section">
          <SectionTitle>Как лучше сказать</SectionTitle>
          {suggested_phrasings.length > 0 ? (
            <ul className="flex flex-col gap-5">
              {suggested_phrasings.map((sp, i) => (
                <li key={i} className="flex flex-col gap-1">
                  {sp.original && (
                    <p className="font-sans text-sm text-text-secondary line-through leading-relaxed">
                      {sp.original}
                    </p>
                  )}
                  <p className="font-sans text-sm text-text-primary font-medium leading-relaxed">
                    {sp.improved}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote text="Конкретных предложений по переформулировке нет." />
          )}
        </section>

        {/* ── 6. Motivational message ───────────────────────────────────── */}
        {motivational_message ? (
          <section className="mb-section">
            <div
              className="bg-surface rounded-card px-6 py-5"
              style={{ border: '1px solid #9D7B72' }}
            >
              <p className="font-display italic text-base font-medium text-text-primary leading-relaxed">
                {motivational_message}
              </p>
            </div>
          </section>
        ) : null}
      </main>

      {/* ── 7. Fixed bottom buttons ───────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background px-6 py-5 flex flex-col gap-3">
        <button
          onClick={onHome}
          className="w-full bg-button-primary text-button-primary-text font-sans font-medium text-base py-4 rounded-card active:opacity-80 transition-opacity"
        >
          На главный экран
        </button>
        <button
          onClick={onRetry}
          className="w-full bg-transparent text-text-primary font-sans font-medium text-base py-4 rounded-card active:opacity-70 transition-opacity"
          style={{ border: '1px solid #2B332C' }}
        >
          Попробовать ещё раз
        </button>
      </footer>
    </div>
  );
}
