import React, { useState, useEffect, useRef } from 'react';
import { SurveyQuestion, SurveyConfig } from '../types';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Info
} from 'lucide-react';

interface SurveySectionProps {
  config: SurveyConfig;
  answers: Record<string, string | string[]>;
  onUpdateAnswer: (questionId: string, value: string | string[]) => void;
  onGoToSwipe: () => void;
  phase?: 'initial' | 'post_swipe';
  stepBadge?: string;
  stepTitle?: string;
  finishLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}

export const SurveySection: React.FC<SurveySectionProps> = ({
  config,
  answers,
  onUpdateAnswer,
  onGoToSwipe,
  phase = 'initial',
  stepBadge,
  stepTitle,
  finishLabel = 'Passer aux Inspirations',
  onBack,
  backLabel,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Filter questions for the active phase
  const questions = config.questions.filter((q) => {
    if (phase === 'post_swipe') {
      return q.phase === 'post_swipe';
    }
    // phase 'initial': questions marked initial or questions without phase
    return !q.phase || q.phase === 'initial';
  });

  const currentQuestion = questions[currentIdx] || questions[0];

  // Auto-scroll systématique au sommet dès qu'on change de question ou de phase
  // pour que la question soit toujours immédiatement lisible sur smartphone sans devoir remonter manuellement
  useEffect(() => {
    window.scrollTo(0, 0);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 40);
    return () => clearTimeout(timer);
  }, [currentIdx, phase, currentQuestion?.id]);

  // Calculate completed count for this phase
  const completedCount = questions.filter((q) => {
    const val = answers[q.id];
    if (Array.isArray(val)) return val.length > 0;
    return typeof val === 'string' && val.trim().length > 0;
  }).length;

  const progressPercent = Math.round((completedCount / questions.length) * 100);

  const handleSingleSelect = (val: string) => {
    if (!currentQuestion) return;
    onUpdateAnswer(currentQuestion.id, val);
  };

  const handleMultiToggle = (val: string) => {
    if (!currentQuestion) return;
    const rawExisting = answers[currentQuestion.id];
    const existing: string[] = Array.isArray(rawExisting)
      ? rawExisting
      : (typeof rawExisting === 'string' && rawExisting.trim().length > 0)
        ? [rawExisting]
        : [];
    const max = currentQuestion.maxSelect || 99;

    if (existing.includes(val)) {
      onUpdateAnswer(
        currentQuestion.id,
        existing.filter((item) => item !== val)
      );
    } else {
      if (existing.length < max) {
        onUpdateAnswer(currentQuestion.id, [...existing, val]);
      } else {
        onUpdateAnswer(currentQuestion.id, [...existing.slice(1), val]);
      }
    }
  };

  const handleTextChange = (text: string) => {
    if (!currentQuestion) return;
    onUpdateAnswer(currentQuestion.id, text);
  };

  const canGoNext = currentIdx < questions.length - 1;
  const canGoPrev = currentIdx > 0;

  const handleNext = () => {
    if (canGoNext) {
      window.scrollTo(0, 0);
      setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1));
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      window.scrollTo(0, 0);
      setCurrentIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const handleJumpTo = (idx: number) => {
    window.scrollTo(0, 0);
    setCurrentIdx(idx);
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div
      ref={topRef}
      id="survey-section-top"
      className="w-full max-w-3xl mx-auto py-1.5 sm:py-4 px-2.5 sm:px-4 flex flex-col justify-between flex-1 scroll-mt-16"
    >
      {/* Top Compact Progress Bar */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {stepBadge && (
            <span className="hidden xs:inline-block px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300 font-mono text-[10px] uppercase tracking-wider">
              {stepBadge}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
            Q{currentIdx + 1}/{questions.length}
          </span>
          <span className="text-[11px] font-mono text-stone-400">
            {progressPercent}% complété
          </span>
        </div>

        {/* Step dots for quick jumping */}
        <div className="flex items-center gap-1">
          {questions.map((q, idx) => {
            const isAnswered =
              answers[q.id] &&
              (Array.isArray(answers[q.id])
                ? (answers[q.id] as string[]).length > 0
                : String(answers[q.id]).trim().length > 0);
            const isCurrent = idx === currentIdx;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => handleJumpTo(idx)}
                aria-label={`Aller à la question ${idx + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  isCurrent
                    ? 'w-6 bg-amber-500'
                    : isAnswered
                    ? 'w-2 bg-amber-500/50'
                    : 'w-2 bg-stone-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Question Card (compacted for single-screen smartphone layout) */}
      <div className="bg-stone-900/50 backdrop-blur-md border border-stone-800/80 rounded-2xl p-3 sm:p-5 shadow-xl flex flex-col justify-between flex-1">
        <div>
          {/* Question Title */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-stone-100 font-serif leading-snug">
              {currentQuestion.title}
            </h3>
            {currentQuestion.required && (
              <span className="text-[10px] text-amber-500 font-mono uppercase shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Requis
              </span>
            )}
          </div>

          {currentQuestion.subtitle &&
            currentQuestion.subtitle !== 'Questionnaire préliminaire' &&
            currentQuestion.subtitle !== 'Questions secondaires' && (
              <p className="text-[11px] sm:text-xs text-stone-400 mb-2 leading-snug">
                {currentQuestion.subtitle}
              </p>
          )}

          {/* Multiple choice selection counter */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.maxSelect && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 w-fit">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                {
                  (Array.isArray(answers[currentQuestion.id])
                    ? (answers[currentQuestion.id] as string[])
                    : answers[currentQuestion.id] ? [answers[currentQuestion.id] as string] : []).length
                } / {currentQuestion.maxSelect} max sélectionné(s)
              </span>
            </div>
          )}

          {/* Question Type: Single Choice (Compact cards) */}
          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSingleSelect(opt.value)}
                    className={`group text-left p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/80 ring-1 ring-amber-500/50 backdrop-blur-sm'
                        : 'bg-stone-950/45 backdrop-blur-sm border-stone-800/80 hover:border-stone-700 hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs sm:text-sm font-semibold leading-snug break-words ${
                            isSelected ? 'text-amber-300' : 'text-stone-200'
                          }`}
                        >
                          {opt.label}
                        </p>
                        {opt.hint && (
                          <p className="text-[11px] text-stone-400 mt-1 leading-snug">
                            {opt.hint}
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-stone-950'
                            : 'border-stone-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {isSelected && opt.value === 'autres' && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/30" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="Précise ta pensée (facultatif)..."
                          value={(answers[currentQuestion.id + '_autre'] as string) || ''}
                          onChange={(e) => onUpdateAnswer(currentQuestion.id + '_autre', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900/75 backdrop-blur-sm border border-stone-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400 placeholder-stone-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Question Type: Multiple Choice (Compact cards) */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {currentQuestion.options.map((opt) => {
                const rawSelected = answers[currentQuestion.id];
                const selectedList: string[] = Array.isArray(rawSelected)
                  ? rawSelected
                  : (typeof rawSelected === 'string' && rawSelected.trim().length > 0)
                    ? [rawSelected]
                    : [];
                const isSelected = selectedList.includes(opt.value);

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleMultiToggle(opt.value)}
                    className={`group text-left p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/80 ring-1 ring-amber-500/50 backdrop-blur-sm'
                        : 'bg-stone-950/45 backdrop-blur-sm border-stone-800/80 hover:border-stone-700 hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs sm:text-sm font-semibold leading-snug break-words ${
                            isSelected ? 'text-amber-300' : 'text-stone-200'
                          }`}
                        >
                          {opt.label}
                        </p>
                        {opt.hint && (
                          <p className="text-[11px] text-stone-400 mt-1 leading-snug">
                            {opt.hint}
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-stone-950'
                            : 'border-stone-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {isSelected && opt.value === 'autres' && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/30" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="Précise (facultatif)..."
                          value={(answers[currentQuestion.id + '_autre'] as string) || ''}
                          onChange={(e) => onUpdateAnswer(currentQuestion.id + '_autre', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900/75 backdrop-blur-sm border border-stone-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400 placeholder-stone-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Question Type: Free Text */}
          {currentQuestion.type === 'text' && (
            <div className="mt-1.5 sm:mt-2">
              <textarea
                rows={3}
                placeholder={currentQuestion.placeholder || 'Écris tes réflexions, idées, symboles...'}
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full p-2.5 sm:p-3 bg-stone-950/50 backdrop-blur-sm border border-stone-800/80 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-stone-100 placeholder-stone-500 transition-all outline-none text-xs sm:text-sm resize-none leading-relaxed min-h-[85px] sm:min-h-[110px]"
              />
              <div className="flex justify-between items-center text-[10px] text-stone-500 mt-1 font-mono">
                <span>Réponse libre</span>
                <span>{((answers[currentQuestion.id] as string) || '').length} caractères</span>
              </div>
            </div>
          )}
        </div>

        {/* Compact Navigation Footer */}
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2">
          {canGoPrev ? (
            <button
              type="button"
              onClick={handlePrev}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-800 text-stone-300 hover:bg-stone-800 transition-all text-xs font-semibold cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-all text-xs font-semibold cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{backLabel || 'Retour'}</span>
            </button>
          ) : (
            <div />
          )}

          {canGoNext ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold shadow-sm transition-all text-xs cursor-pointer active:scale-95"
            >
              <span>Suivant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.scrollTo(0, 0);
                onGoToSwipe();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold shadow-md text-xs cursor-pointer active:scale-95"
            >
              <span>{finishLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
