import React, { useState, useEffect, useCallback } from 'react';
import { UserAuth, SurveyConfig, SwipeVote, GlobalStats, SuperlikeDetails } from './types';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { SurveySection } from './components/SurveySection';
import { PhotoSwipeSection } from './components/PhotoSwipeSection';
import { SummaryAndStats } from './components/SummaryAndStats';
import { Loader2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'cle_dex_225_user';

export default function App() {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [swipes, setSwipes] = useState<Record<string, SwipeVote>>({});
  const [superlikeNotes, setSuperlikeNotes] = useState<Record<string, SuperlikeDetails>>({});
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [activeStep, setActiveStep] = useState<'survey' | 'swipe' | 'post_swipe_survey' | 'stats'>('survey');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // 1. Fetch survey configuration from external file via API
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Erreur chargement configuration:', err);
    }
  }, []);

  // 2. Fetch global promo statistics
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    }
  }, []);

  // 3. Save current user response to server (writes JSON file in data/responses/)
  const saveResponseToServer = useCallback(
    async (
      currentUser: UserAuth,
      currentAnswers: Record<string, string | string[]>,
      currentSwipes: Record<string, SwipeVote>,
      currentNotes: Record<string, SuperlikeDetails> = superlikeNotes
    ) => {
      try {
        const res = await fetch('/api/response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buque: currentUser.buque,
            famss: currentUser.famss,
            answers: currentAnswers,
            swipes: currentSwipes,
            superlikeNotes: currentNotes,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          setLastSavedTime(result.data.updatedAt);
          fetchStats(); // Update aggregated promo meter
        }
      } catch (err) {
        console.error('Erreur sauvegarde réponse:', err);
      }
    },
    [fetchStats, superlikeNotes]
  );

  // 4. Handle user login
  const handleLogin = async (auth: UserAuth) => {
    setIsLoadingAuth(true);
    try {
      // Check if user already exists on server
      const res = await fetch(
        `/api/user-response?buque=${encodeURIComponent(auth.buque)}&famss=${encodeURIComponent(auth.famss)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.found && json.data) {
          // Si l'utilisateur avait déjà un enregistrement avec une casse définie, la préserver
          if (json.data.buque) {
            auth = {
              buque: json.data.buque,
              famss: json.data.famss || auth.famss,
            };
          }
          setAnswers(json.data.answers || {});
          setSwipes(json.data.swipes || {});
          setSuperlikeNotes(json.data.superlikeNotes || {});
          setLastSavedTime(json.data.updatedAt || json.data.submittedAt || null);

          // Smart route based on progress
          const hasInitialAnswers = Object.keys(json.data.answers || {}).some(
            (k) => k.startsWith('pre_') || (!k.startsWith('post_') && !k.endsWith('_autre'))
          );
          const hasSwipes = Object.keys(json.data.swipes || {}).length > 0;
          const hasPostSwipe = Object.keys(json.data.answers || {}).some((k) => k.startsWith('post_'));

          if (hasPostSwipe && hasSwipes && hasInitialAnswers) {
            setActiveStep('stats');
          } else if (hasSwipes) {
            setActiveStep('post_swipe_survey');
          } else if (hasInitialAnswers) {
            setActiveStep('swipe');
          } else {
            setActiveStep('survey');
          }
        } else {
          // New user
          setAnswers({});
          setSwipes({});
          setSuperlikeNotes({});
          setActiveStep('survey');
        }
      }

      setUser(auth);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(auth));
      await fetchStats();
    } catch (err) {
      console.error('Erreur connexion:', err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // 5. Handle user logout / change buque
  const handleLogout = () => {
    setUser(null);
    setAnswers({});
    setSwipes({});
    setSuperlikeNotes({});
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setActiveStep('survey');
  };

  // 6. Update single answer
  const handleUpdateAnswer = (questionId: string, value: string | string[]) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    if (user) {
      saveResponseToServer(user, updated, swipes, superlikeNotes);
    }
  };

  // 7. Vote on photo in swipe deck
  const handleVotePhoto = (photoId: string, vote: SwipeVote, details?: SuperlikeDetails) => {
    const updatedSwipes = { ...swipes, [photoId]: vote };
    const updatedNotes = { ...superlikeNotes };
    if (vote === 'superlike' && details) {
      updatedNotes[photoId] = details;
    } else if (vote !== 'superlike') {
      delete updatedNotes[photoId];
    }
    setSwipes(updatedSwipes);
    setSuperlikeNotes(updatedNotes);
    if (user) {
      saveResponseToServer(user, answers, updatedSwipes, updatedNotes);
    }
  };

  // 8. Undo vote
  const handleUndoVote = (photoId: string) => {
    const updatedSwipes = { ...swipes };
    const updatedNotes = { ...superlikeNotes };
    delete updatedSwipes[photoId];
    delete updatedNotes[photoId];
    setSwipes(updatedSwipes);
    setSuperlikeNotes(updatedNotes);
    if (user) {
      saveResponseToServer(user, answers, updatedSwipes, updatedNotes);
    }
  };

  // 9. Initial mount: load config, check local storage
  useEffect(() => {
    const init = async () => {
      await fetchConfig();
      await fetchStats();

      // Check stored user
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.buque && parsed.famss) {
            await handleLogin(parsed);
          }
        } catch {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
      setIsInitializing(false);
    };

    init();
  }, [fetchConfig, fetchStats]);

  // Scroll to top automatically when changing steps
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeStep]);

  if (isInitializing || !config) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-3 text-stone-400 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.05] select-none" aria-hidden="true">
          <img src="/AM_TRADS_Arrondi.svg" alt="" className="w-80 max-w-sm object-contain" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 relative z-10" />
        <p className="text-xs font-mono uppercase tracking-widest text-stone-500 relative z-10">
          Chargement de la Clé d'Ex 225...
        </p>
      </div>
    );
  }

  // Calculate completion percentages for each phase
  const initialQuestions = config.questions.filter((q) => !q.phase || q.phase === 'initial');
  const completedInitialQuestions = initialQuestions.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0;
  }).length;
  const surveyProgress = initialQuestions.length > 0 
    ? Math.round((completedInitialQuestions / initialQuestions.length) * 100)
    : 0;

  const swipeBatchSize = config.swipeBatchSize ?? config.project?.swipeBatchSize ?? 30;
  const completedSwipes = Object.keys(swipes).length;
  const targetSwipeCount = Math.min(swipeBatchSize, config.photos.length);
  const swipeProgress = targetSwipeCount > 0
    ? Math.min(100, Math.round((completedSwipes / targetSwipeCount) * 100))
    : 0;

  const postSwipeQuestions = config.questions.filter((q) => q.phase === 'post_swipe');
  const completedPostSwipeQuestions = postSwipeQuestions.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0;
  }).length;
  const postSwipeProgress = postSwipeQuestions.length > 0
    ? Math.round((completedPostSwipeQuestions / postSwipeQuestions.length) * 100)
    : 0;

  const hasCompletedBoth = surveyProgress === 100 && swipeProgress === 100 && postSwipeProgress === 100;

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950 relative overflow-x-hidden">
      {/* Background SVG - AM Traditions Arrondi en grand arrière-plan */}
      <div
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden select-none"
        aria-hidden="true"
      >
        <img
          src="/AM_TRADS_Arrondi.svg"
          alt=""
          className="w-[94vw] max-w-5xl max-h-[88vh] object-contain opacity-[0.11] pointer-events-none filter drop-shadow-[0_0_100px_rgba(245,158,11,0.28)]"
        />
        {/* Subtle radial vignette gradient to soften periphery */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(12,10,9,0.72)_90%)]" />
      </div>

      {/* Header with Promo Badge & Stepper */}
      <Header
        user={user}
        onLogout={handleLogout}
        activeStep={activeStep}
        onNavigate={setActiveStep}
        surveyProgress={surveyProgress}
        swipeProgress={swipeProgress}
        postSwipeProgress={postSwipeProgress}
        hasCompletedBoth={hasCompletedBoth}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10">
        {!user ? (
          <AuthModal onLogin={handleLogin} isLoading={isLoadingAuth} />
        ) : (
          <>
            {activeStep === 'survey' && (
              <SurveySection
                config={config}
                answers={answers}
                onUpdateAnswer={handleUpdateAnswer}
                onGoToSwipe={() => setActiveStep('swipe')}
                phase="initial"
                stepBadge="Questionnaire préliminaire"
                finishLabel="Passer aux Inspirations"
              />
            )}

            {activeStep === 'swipe' && (
              <PhotoSwipeSection
                photos={config.photos}
                swipes={swipes}
                superlikeNotes={superlikeNotes}
                user={user}
                batchSize={swipeBatchSize}
                onVote={handleVotePhoto}
                onUndo={handleUndoVote}
                onFinish={() => setActiveStep('post_swipe_survey')}
                onBackToSurvey={() => setActiveStep('survey')}
              />
            )}

            {activeStep === 'post_swipe_survey' && (
              <SurveySection
                config={config}
                answers={answers}
                onUpdateAnswer={handleUpdateAnswer}
                onGoToSwipe={() => setActiveStep('stats')}
                phase="post_swipe"
                stepBadge="Questions secondaires"
                finishLabel="Découvrir le Bilan & Tendances"
                onBack={() => setActiveStep('swipe')}
                backLabel="Revoir les Inspirations"
              />
            )}

            {activeStep === 'stats' && (
              <SummaryAndStats
                user={user}
                config={config}
                answers={answers}
                swipes={swipes}
                superlikeNotes={superlikeNotes}
                stats={stats}
                onEditAnswers={(step) => setActiveStep(step || 'survey')}
                onRefreshStats={fetchStats}
                lastSavedTime={lastSavedTime}
              />
            )}
          </>
        )}
      </main>

      {/* Discrete Footer */}
      <footer className="border-t border-stone-900 py-4 px-6 text-center text-xs text-stone-500 font-mono">
        <p>Projet Clé d'Ex — Promotion Gadzarts 225 • École Nationale Supérieure d'Arts et Métiers</p>
      </footer>
    </div>
  );
}
