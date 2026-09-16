import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { InspirationPhoto, SwipeVote, SuperlikeDetails, UserAuth } from '../types';
import {
  Heart,
  X,
  Star,
  RotateCcw,
  HelpCircle,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Shuffle,
  KeyRound,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface PhotoSwipeSectionProps {
  photos: InspirationPhoto[];
  swipes: Record<string, SwipeVote>;
  superlikeNotes?: Record<string, SuperlikeDetails>;
  user?: UserAuth | null;
  batchSize?: number;
  onVote: (photoId: string, vote: SwipeVote, details?: SuperlikeDetails) => void;
  onUndo: (photoId: string) => void;
  onFinish: () => void;
  onBackToSurvey: () => void;
}

const DEFAULT_BATCH_SIZE = 30;

// Simple deterministic seeded random generator (LCG)
function createSeededRandom(seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
  }
  return function () {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle with seeded RNG
function shuffleWithSeed<T>(array: T[], seedStr: string): T[] {
  const arr = [...array];
  const rng = createSeededRandom(seedStr);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const PhotoSwipeSection: React.FC<PhotoSwipeSectionProps> = ({
  photos,
  swipes,
  superlikeNotes = {},
  user,
  batchSize,
  onVote,
  onUndo,
  onFinish,
  onBackToSurvey,
}) => {
  const targetBatchSize = batchSize && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;

  // Mode: initial targetBatchSize photos vs extended full catalog
  // Extended mode is active if explicitly chosen or if user has already swiped beyond targetBatchSize
  const [isExtendedMode, setIsExtendedMode] = useState<boolean>(() => {
    try {
      const voted = Object.keys(swipes).length;
      if (voted > targetBatchSize) return true;
      const saved =
        localStorage.getItem('cle_swipe_extended_mode') === 'true' ||
        sessionStorage.getItem('cle_swipe_extended_mode') === 'true';
      return saved && voted >= targetBatchSize;
    } catch {
      return false;
    }
  });

  const [showMilestoneModal, setShowMilestoneModal] = useState<boolean>(false);
  const [milestoneDismissed, setMilestoneDismissed] = useState<boolean>(false);

  // Stable seed per user to keep catalog order completely deterministic across sessions
  const [randomSeed, setRandomSeed] = useState<string>(() => {
    try {
      const userKey = user?.buque && user?.famss
        ? `cle_swipe_seed_${user.buque.trim().toLowerCase()}_${user.famss.trim().toLowerCase()}`
        : 'cle_swipe_seed_default';
      const saved = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
      if (saved) return saved;
      const initial = user?.buque && user?.famss
        ? `${user.buque.trim().toLowerCase()}_${user.famss.trim().toLowerCase()}`
        : Math.random().toString(36).substring(2, 10);
      localStorage.setItem(userKey, initial);
      return initial;
    } catch {
      return 'gadz_seed';
    }
  });

  // Broken photos state: any photo that cannot load is excluded and replaced by another working key
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('cle_swipe_broken_photos');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {}
    return new Set<string>();
  });

  const [replacementNotice, setReplacementNotice] = useState<string | null>(null);
  const replacementNoticeTimer = useRef<any>(null);

  const showReplacementToast = useCallback((message: string) => {
    setReplacementNotice(message);
    if (replacementNoticeTimer.current) clearTimeout(replacementNoticeTimer.current);
    replacementNoticeTimer.current = setTimeout(() => {
      setReplacementNotice(null);
    }, 4000);
  }, []);

  // When a photo cannot be loaded/rendered, automatically replace it with another working key
  const handleMarkPhotoBroken = useCallback(
    (photoId: string, photoTitle?: string) => {
      setBrokenPhotoIds((prev) => {
        if (prev.has(photoId)) return prev;
        const next = new Set(prev);
        next.add(photoId);
        try {
          sessionStorage.setItem('cle_swipe_broken_photos', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      if (swipes[photoId]) {
        onUndo(photoId);
      }

      const name = photoTitle ? `« ${photoTitle} »` : 'Cette clé';
      showReplacementToast(`${name} ne peut pas s'afficher : elle a été remplacée par une autre clé valide.`);
    },
    [swipes, onUndo, showReplacementToast]
  );

  // Filter out any broken photo so the user only ever swipes working, visible keys
  const validPhotos = useMemo(() => {
    return (photos || []).filter((p) => !brokenPhotoIds.has(p.id));
  }, [photos, brokenPhotoIds]);

  // Master randomized cards across all working keys (deterministic order per user)
  const masterPhotos = useMemo(() => {
    if (!validPhotos || validPhotos.length === 0) return [];
    return shuffleWithSeed(validPhotos, randomSeed);
  }, [validPhotos, randomSeed]);

  // Active deck:
  // 1. All photos already voted on by the user (preserved in memory with their votes)
  // 2. All photos not yet voted on ("la suite", queued in stable sequence)
  const activeDeck = useMemo(() => {
    if (!masterPhotos || masterPhotos.length === 0) return [];

    // All photos the user has already voted on
    const votedPhotos = masterPhotos.filter((p) => !!swipes[p.id]);
    // All photos not yet voted on
    const unvotedPhotos = masterPhotos.filter((p) => !swipes[p.id]);

    if (isExtendedMode) {
      // Extended mode: all already-voted photos first, followed by all remaining unvoted photos
      return [...votedPhotos, ...unvotedPhotos];
    }

    // Initial batch mode: aim for targetBatchSize
    const targetCount = Math.min(targetBatchSize, masterPhotos.length);
    const neededUnvoted = Math.max(0, targetCount - votedPhotos.length);
    const unvotedSlice = unvotedPhotos.slice(0, neededUnvoted);

    return [...votedPhotos, ...unvotedSlice];
  }, [masterPhotos, isExtendedMode, swipes, targetBatchSize]);

  const handleReshuffle = () => {
    const nextSeed = Math.random().toString(36).substring(2, 10);
    try {
      const userKey = user?.buque && user?.famss
        ? `cle_swipe_seed_${user.buque.trim().toLowerCase()}_${user.famss.trim().toLowerCase()}`
        : 'cle_swipe_seed_default';
      localStorage.setItem(userKey, nextSeed);
      sessionStorage.setItem('cle_swipe_random_seed', nextSeed);
    } catch {}
    setRandomSeed(nextSeed);
  };

  const handleContinueExploring = () => {
    setIsExtendedMode(true);
    setShowMilestoneModal(false);
    setMilestoneDismissed(true);
    try {
      localStorage.setItem('cle_swipe_extended_mode', 'true');
      sessionStorage.setItem('cle_swipe_extended_mode', 'true');
    } catch {}

    // Propose the next unswiped card ("la suite") immediately
    const votedCount = Object.keys(swipes).length;
    setCurrentIdx(votedCount);
  };

  const handleExitExtendedMode = () => {
    setIsExtendedMode(false);
    setShowMilestoneModal(false);
    try {
      localStorage.removeItem('cle_swipe_extended_mode');
      sessionStorage.removeItem('cle_swipe_extended_mode');
    } catch {}
  };

  // Initial index set to first unvoted photo in activeDeck
  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    const unvoted = activeDeck.findIndex((p) => !swipes[p.id]);
    return unvoted !== -1 ? unvoted : activeDeck.length;
  });

  // External trigger direction for button clicks or keyboard presses
  const [triggerDirection, setTriggerDirection] = useState<'left' | 'right' | 'up' | null>(null);

  // Preload and proactively validate upcoming photos to catch broken images before the user reaches them
  const preloadedUrls = useRef<Set<string>>(new Set());
  const testedPhotoIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeDeck || activeDeck.length === 0) return;
    const toPreload = activeDeck.slice(currentIdx, currentIdx + 8);
    toPreload.forEach((p) => {
      if (p.imageUrl && !preloadedUrls.current.has(p.imageUrl)) {
        preloadedUrls.current.add(p.imageUrl);
        const img = new Image();
        img.src = p.imageUrl;
        img.onerror = () => {
          // Fallback test
          const fb = new Image();
          fb.src = `/api/photo/${p.id}`;
          fb.onerror = () => {
            handleMarkPhotoBroken(p.id, p.title);
          };
        };
      }
    });
  }, [currentIdx, activeDeck, handleMarkPhotoBroken]);

  // Background verification of catalog photos: pre-check so broken photos are pruned before user reaches them
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    photos.forEach((p) => {
      if (testedPhotoIds.current.has(p.id) || brokenPhotoIds.has(p.id)) return;
      testedPhotoIds.current.add(p.id);

      const img = new Image();
      img.src = p.imageUrl;
      img.onerror = () => {
        const retry = new Image();
        retry.src = `/api/photo/${p.id}`;
        retry.onerror = () => {
          handleMarkPhotoBroken(p.id, p.title);
        };
      };
    });
  }, [photos, brokenPhotoIds, handleMarkPhotoBroken]);
  useEffect(() => {
    if (activeDeck.length > 0) {
      if (currentIdx >= activeDeck.length || (activeDeck[currentIdx] && swipes[activeDeck[currentIdx].id])) {
        const nextUnvoted = activeDeck.findIndex((p) => !swipes[p.id]);
        if (nextUnvoted !== -1) {
          setCurrentIdx(nextUnvoted);
        } else {
          setCurrentIdx(activeDeck.length);
        }
      }
    }
  }, [activeDeck, currentIdx, swipes]);

  // Tutorial modal state (shown on first visit)
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Superlike modal state (single question, note is optional and vote is ALREADY recorded)
  const [superlikeTarget, setSuperlikeTarget] = useState<InspirationPhoto | null>(null);
  const [superlikeComment, setSuperlikeComment] = useState('');

  useEffect(() => {
    const hasSeen = localStorage.getItem('cle_dex_swipe_tutorial_seen');
    if (!hasSeen) {
      setShowTutorial(true);
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('cle_dex_swipe_tutorial_seen', 'true');
  };

  const isAllSwiped =
    currentIdx >= activeDeck.length ||
    (activeDeck.length > 0 && activeDeck.every((p) => !!swipes[p.id]));

  const currentPhoto = activeDeck[currentIdx];

  // Next unvoted photo in deck for the stacked background preview
  const nextUnvotedPhoto = useMemo(() => {
    return activeDeck.find((p, idx) => idx > currentIdx && !swipes[p.id]);
  }, [activeDeck, currentIdx, swipes]);

  // Invoked when card exit animation completes (from swipe gesture OR button click)
  const handleCardSwiped = (vote: SwipeVote) => {
    if (!currentPhoto) return;

    setTriggerDirection(null);

    // 1. Immediately record vote in state & server
    if (vote === 'superlike') {
      onVote(currentPhoto.id, 'superlike', { element: 'Coup de cœur', reason: '' });
      setSuperlikeTarget(currentPhoto);
      setSuperlikeComment('');
    } else {
      onVote(currentPhoto.id, vote);
    }

    // 2. Count progress
    const alreadyVotedCount = Object.keys(swipes).length;
    const nextCount = swipes[currentPhoto.id] ? alreadyVotedCount : alreadyVotedCount + 1;
    const targetCount = Math.min(targetBatchSize, photos.length);

    // 3. Advance to the next unvoted card in activeDeck
    const nextUnvoted = activeDeck.findIndex((p, idx) => idx > currentIdx && !swipes[p.id]);
    if (nextUnvoted !== -1) {
      setCurrentIdx(nextUnvoted);
    } else {
      // Check if any earlier cards were skipped
      const earlierUnvoted = activeDeck.findIndex(
        (p, idx) => idx < currentIdx && !swipes[p.id] && p.id !== currentPhoto.id
      );
      if (earlierUnvoted !== -1) {
        setCurrentIdx(earlierUnvoted);
      } else {
        setCurrentIdx(activeDeck.length);
      }
    }

    // 4. Milestone check
    if (!isExtendedMode && nextCount >= targetCount && !milestoneDismissed) {
      setShowMilestoneModal(true);
    }
  };

  // Triggered by on-screen buttons or keyboard shortcuts
  const handleTriggerButton = (vote: SwipeVote) => {
    if (!currentPhoto || triggerDirection) return;
    const dir = vote === 'like' ? 'right' : vote === 'dislike' ? 'left' : 'up';
    setTriggerDirection(dir);
  };

  const handleConfirmSuperlike = (e: React.FormEvent) => {
    e.preventDefault();
    if (!superlikeTarget) return;

    const comment = superlikeComment.trim();
    const details: SuperlikeDetails = {
      element: comment || 'Coup de cœur',
      reason: comment,
    };

    onVote(superlikeTarget.id, 'superlike', details);
    setSuperlikeTarget(null);
  };

  const handleUndo = () => {
    // Find the most recently swiped photo before currentIdx
    let prevIdx = currentIdx - 1;
    while (prevIdx >= 0 && !swipes[activeDeck[prevIdx]?.id]) {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      const prevPhoto = activeDeck[prevIdx];
      if (prevPhoto) {
        onUndo(prevPhoto.id);
        setCurrentIdx(prevIdx);
      }
    }
  };

  // Keyboard navigation for PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showTutorial) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault();
          closeTutorial();
        }
        return;
      }

      if (showMilestoneModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowMilestoneModal(false);
          setMilestoneDismissed(true);
        }
        return;
      }

      if (superlikeTarget) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSuperlikeTarget(null);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleConfirmSuperlike({ preventDefault: () => {} } as React.FormEvent);
          return;
        }
        return;
      }

      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (isAllSwiped || !currentPhoto) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTriggerButton('dislike');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleTriggerButton('like');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleTriggerButton('superlike');
      } else if (e.key === 'ArrowDown' || e.key === 'Backspace') {
        if (currentIdx > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPhoto,
    isAllSwiped,
    currentIdx,
    showTutorial,
    showMilestoneModal,
    superlikeTarget,
    activeDeck,
    superlikeComment,
  ]);

  const likeCount = Object.values(swipes).filter((v) => v === 'like' || v === 'superlike').length;
  const superlikeCount = Object.values(swipes).filter((v) => v === 'superlike').length;
  const dislikeCount = Object.values(swipes).filter((v) => v === 'dislike').length;

  const totalVotedInDeck = activeDeck.filter((p) => !!swipes[p.id]).length;
  const deckTargetDisplay = isExtendedMode
    ? photos.length
    : Math.min(targetBatchSize, photos.length);

  return (
    <div className="w-full max-w-2xl mx-auto py-2 sm:py-4 px-3 sm:px-4 flex flex-col justify-between flex-1">
      {/* Top Header - Responsive 2-tier on mobile, single-line on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 mb-2">
        {/* Tier 1 on mobile: Navigation back to survey and quick exit / help */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBackToSurvey}
            className="flex items-center gap-1 text-xs text-stone-300 hover:text-stone-100 bg-stone-900/90 hover:bg-stone-850 border border-stone-800 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shrink-0"
            title="Revenir au questionnaire préliminaire"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Questionnaire</span>
          </button>

          {/* Quick exit to Step 3 and tutorial button on mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            {!isAllSwiped && (
              <button
                type="button"
                onClick={onFinish}
                className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                title="Passer directement au questionnaire secondaire"
              >
                <span>Étape 3</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="text-stone-400 hover:text-amber-400 p-1 rounded-lg border border-stone-800/80 bg-stone-900/60 cursor-pointer"
              title="Aide & explications des options"
              aria-label="Aide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tier 2 on mobile: Progress, Shuffle button, and Live Vote Counts */}
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-300 flex items-center gap-1 text-[11px] sm:text-xs">
              <span className="text-stone-400">Inspirations :</span>
              <strong className="text-amber-400 font-bold">
                {Math.min(deckTargetDisplay, totalVotedInDeck)}/{deckTargetDisplay}
              </strong>
            </span>

            <button
              type="button"
              onClick={handleReshuffle}
              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
              title="Mélanger l'ordre aléatoire des cartes"
            >
              <Shuffle className="w-2.5 h-2.5 text-amber-400" />
              <span>Aléatoire</span>
            </button>

            {!isExtendedMode && photos.length > targetBatchSize && (
              <span className="hidden md:inline-flex items-center text-[10px] text-stone-400 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded-full font-sans">
                Sélection de {targetBatchSize}
              </span>
            )}
            {isExtendedMode && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full font-sans">
                <span>Mode étendu ({photos.length} clés)</span>
                <button
                  type="button"
                  onClick={handleExitExtendedMode}
                  className="text-stone-400 hover:text-stone-200 underline cursor-pointer"
                  title={`Revenir à la sélection initiale de ${targetBatchSize} clés`}
                >
                  Revenir aux {targetBatchSize}
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-emerald-400 flex items-center gap-0.5 text-[11px] sm:text-xs" title="Nombre de J'aime">
              <Heart className="w-3 h-3 fill-emerald-500/30" /> {likeCount}
            </span>
            <span className="text-stone-400 flex items-center gap-0.5 text-[11px] sm:text-xs" title="Nombre de clés écartées">
              <X className="w-3 h-3" /> {dislikeCount}
            </span>

            {currentIdx > 0 && !isAllSwiped && (
              <button
                type="button"
                onClick={handleUndo}
                className="text-stone-400 hover:text-amber-400 p-1 transition-colors cursor-pointer"
                title="Annuler le vote précédent"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Desktop Quick exit and tutorial */}
            {!isAllSwiped && (
              <button
                type="button"
                onClick={onFinish}
                className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Passer directement au questionnaire secondaire (tes votes actuels sont sauvegardés)"
              >
                <span>Étape 3</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="hidden sm:inline-flex text-stone-500 hover:text-amber-400 p-1 cursor-pointer"
              title="Aide & explications des options"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-full bg-stone-900 h-1.5 rounded-full overflow-hidden mb-2 sm:mb-3 border border-stone-800">
        <div
          className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 h-full transition-all duration-300 rounded-full"
          style={{
            width: `${Math.min(100, Math.round((totalVotedInDeck / deckTargetDisplay) * 100))}%`,
          }}
        />
      </div>

      {/* Main Single-Screen Deck */}
      {!isAllSwiped && currentPhoto ? (
        <div className="flex flex-col items-center justify-center flex-1">
          {/* Automatic replacement banner if a key was replaced */}
          {replacementNotice && (
            <div className="w-full max-w-sm mx-auto mb-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center gap-1.5 truncate">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="truncate">{replacementNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplacementNotice(null)}
                className="text-stone-400 hover:text-stone-200 ml-2 cursor-pointer font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Card Container with reduced height for mobile */}
          <div className="relative w-full max-w-sm h-[390px] sm:h-[440px] select-none mx-auto touch-none">
            {/* Background stacked card preview (shows the deck depth) */}
            {nextUnvotedPhoto && (
              <div
                key={nextUnvotedPhoto.id}
                className="absolute inset-0 bg-stone-900/90 border border-stone-800/80 rounded-2xl overflow-hidden shadow-md pointer-events-none transform scale-[0.96] translate-y-2.5 opacity-60 flex flex-col -z-10"
              >
                <div className="relative flex-1 w-full bg-stone-950/80 overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={nextUnvotedPhoto.imageUrl}
                    alt={nextUnvotedPhoto.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain select-none opacity-70"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.retried && nextUnvotedPhoto?.id) {
                        target.dataset.retried = 'true';
                        target.src = `/api/photo/${nextUnvotedPhoto.id}`;
                      } else {
                        handleMarkPhotoBroken(nextUnvotedPhoto.id, nextUnvotedPhoto.title);
                        target.style.display = 'none';
                      }
                    }}
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${
                      nextUnvotedPhoto.fallbackGradient || 'from-amber-900/20 to-stone-900/40'
                    } -z-10`}
                  />
                </div>
                <div className="py-3 px-4 bg-stone-900 border-t border-stone-800/80 text-center shrink-0">
                  <h3 className="text-base sm:text-lg font-bold text-stone-300 font-serif tracking-wide truncate">
                    {nextUnvotedPhoto.title}
                  </h3>
                </div>
              </div>
            )}

            <AnimatePresence>
              <CompactSwipeCard
                key={currentPhoto.id}
                photo={currentPhoto}
                onVote={handleCardSwiped}
                triggerDirection={triggerDirection}
                onImageBroken={handleMarkPhotoBroken}
                cardIndex={totalVotedInDeck + 1}
                totalCards={deckTargetDisplay}
                isExtended={isExtendedMode}
              />
            </AnimatePresence>
          </div>

          {/* Action Buttons directly below card */}
          <div className="flex flex-col items-center mt-3 sm:mt-4">
            <div className="flex items-center justify-center gap-5 sm:gap-6">
              {/* Dislike */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleTriggerButton('dislike')}
                  className="w-12 h-12 rounded-full bg-stone-900 border-2 border-stone-700 hover:border-red-500/80 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer hover:bg-red-500/10"
                  title="Écarter (Swipe Gauche ou Flèche ←)"
                  aria-label="Dislike"
                >
                  <X className="w-5 h-5 text-stone-400 hover:text-red-400" />
                </button>
                <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-stone-400 bg-stone-950/90 px-1.5 py-0.5 rounded border border-stone-800 shadow-sm">
                  ←
                </span>
              </div>

              {/* Superlike */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleTriggerButton('superlike')}
                  className="w-11 h-11 rounded-full bg-stone-900 border-2 border-stone-700 hover:border-amber-400 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer hover:bg-amber-400/10"
                  title="Super Like / Coup de cœur (Swipe Haut ou Flèche ↑)"
                  aria-label="Superlike"
                >
                  <Star className="w-5 h-5 text-stone-400 hover:text-amber-400 fill-transparent hover:fill-amber-400/30" />
                </button>
                <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-amber-300 bg-stone-950/90 px-1.5 py-0.5 rounded border border-amber-500/40 shadow-sm">
                  ↑
                </span>
              </div>

              {/* Like */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleTriggerButton('like')}
                  className="w-12 h-12 rounded-full bg-stone-900 border-2 border-stone-700 hover:border-emerald-500/80 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer hover:bg-emerald-500/10"
                  title="J'aime (Swipe Droit ou Flèche →)"
                  aria-label="Like"
                >
                  <Heart className="w-5 h-5 text-stone-400 hover:text-emerald-400 fill-transparent hover:fill-emerald-400/30" />
                </button>
                <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-emerald-300 bg-stone-950/90 px-1.5 py-0.5 rounded border border-emerald-500/40 shadow-sm">
                  →
                </span>
              </div>
            </div>

            {/* Subtle PC keyboard hint */}
            <div className="hidden sm:flex items-center gap-2 mt-2.5 text-[10px] font-mono text-stone-500">
              <span>Touches clavier :</span>
              <span className="text-stone-400">
                <kbd className="bg-stone-800 text-stone-200 px-1.5 py-0.5 rounded border border-stone-700">←</kbd> Écarter
              </span>
              <span className="text-stone-400">
                <kbd className="bg-stone-800 text-amber-300 px-1.5 py-0.5 rounded border border-stone-700">↑</kbd> Coup de cœur
              </span>
              <span className="text-stone-400">
                <kbd className="bg-stone-800 text-emerald-300 px-1.5 py-0.5 rounded border border-stone-700">→</kbd> J'aime
              </span>
              {currentIdx > 0 && (
                <span className="text-stone-400">
                  <kbd className="bg-stone-800 text-stone-200 px-1.5 py-0.5 rounded border border-stone-700">↓</kbd> Annuler
                </span>
              )}
            </div>

            {/* Manual replacement trigger if photo is ever unrenderable or corrupted */}
            {currentPhoto && (
              <button
                type="button"
                onClick={() => handleMarkPhotoBroken(currentPhoto.id, currentPhoto.title)}
                className="mt-2.5 text-[10px] font-mono text-stone-500 hover:text-amber-400 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                title="Remplacer immédiatement cette clé par une autre clé valide du catalogue"
              >
                <RefreshCw className="w-2.5 h-2.5 text-stone-500 hover:text-amber-400" />
                <span>Photo non visible ? Remplacer cette clé</span>
              </button>
            )}

            {/* Fast finish link if in extended mode */}
            {isExtendedMode && (
              <button
                type="button"
                onClick={onFinish}
                className="mt-3 text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Tu as assez d'inspirations ? Passer à l'Étape 3</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Summary Grid when all cards in current deck are finished */
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between">
          <div>
            <div className="text-center max-w-md mx-auto mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 font-serif">
                {!isExtendedMode
                  ? `${targetBatchSize} inspirations notées !`
                  : 'Toutes les inspirations ont été notées !'}
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                {!isExtendedMode
                  ? `Tu as complété la sélection de ${targetBatchSize} clés. Tu peux passer aux questions finales ou continuer à explorer le reste du catalogue.`
                  : 'Tes votes sont tous enregistrés. Tu peux maintenant finaliser tes choix à l\'Étape 3.'}
              </p>
            </div>

            {/* Compact grid of voted cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {photos
                .filter((p) => !!swipes[p.id])
                .map((photo) => {
                  const vote = swipes[photo.id];
                  const note = superlikeNotes[photo.id];
                  return (
                    <div
                      key={photo.id}
                      className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="relative h-24 w-full bg-stone-900/80 p-1 flex items-center justify-center">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${
                            photo.fallbackGradient || 'from-amber-900/30 to-stone-900/40'
                          } flex items-center justify-center opacity-75`}
                        >
                          <KeyRound className="w-6 h-6 text-amber-500/30" />
                        </div>
                        <img
                          src={photo.imageUrl}
                          alt={photo.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain relative z-10"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.retried && photo.id) {
                              target.dataset.retried = 'true';
                              target.src = `/api/photo/${photo.id}`;
                            } else {
                              target.style.display = 'none';
                            }
                          }}
                        />
                        <div className="absolute top-1.5 right-1.5 z-20">
                          {vote === 'superlike' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 text-[9px] font-bold flex items-center gap-0.5 shadow">
                              <Star className="w-2.5 h-2.5 fill-stone-950" /> Super
                            </span>
                          )}
                          {vote === 'like' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-stone-950 text-[9px] font-bold flex items-center gap-0.5 shadow">
                              <Heart className="w-2.5 h-2.5 fill-stone-950" /> J'aime
                            </span>
                          )}
                          {vote === 'dislike' && (
                            <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 text-[9px] font-medium border border-stone-700">
                              Écarté
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2">
                        <p className="text-xs font-bold text-stone-200 truncate">{photo.title}</p>
                        {note?.element && (
                          <p className="text-[10px] text-amber-400 truncate mt-0.5">
                            ⭐ {note.element}
                          </p>
                        )}

                        {/* Mini vote buttons */}
                        <div className="flex items-center gap-1 mt-2 pt-1 border-t border-stone-900">
                          <button
                            type="button"
                            onClick={() => onVote(photo.id, 'dislike')}
                            className={`flex-1 py-0.5 rounded text-[10px] font-semibold flex items-center justify-center cursor-pointer ${
                              vote === 'dislike'
                                ? 'bg-red-500/20 text-red-300'
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSuperlikeComment(note?.reason || note?.element || '');
                              setSuperlikeTarget(photo);
                            }}
                            className={`flex-1 py-0.5 rounded text-[10px] font-semibold flex items-center justify-center cursor-pointer ${
                              vote === 'superlike'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onVote(photo.id, 'like')}
                            className={`flex-1 py-0.5 rounded text-[10px] font-semibold flex items-center justify-center cursor-pointer ${
                              vote === 'like'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            <Heart className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-stone-800 text-stone-300 hover:bg-stone-800 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Revoir en swipe</span>
            </button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {!isExtendedMode && photos.length > targetBatchSize && (
                <button
                  type="button"
                  onClick={handleContinueExploring}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-semibold text-xs transition-colors cursor-pointer text-center shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Continuer avec la suite (+{photos.length - targetBatchSize} clés)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onFinish}
                className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-md cursor-pointer transition-transform active:scale-95 text-center"
              >
                <span>Continuer vers l'Étape 3</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Modal after reaching targetBatchSize */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-stone-100 font-serif mb-1">
              Objectif atteint : {targetBatchSize} clés notées !
            </h3>
            <p className="text-xs text-stone-300 mb-4 leading-relaxed">
              Tu as évalué une première sélection de {targetBatchSize} clés d'Ex. Tes {targetBatchSize} votes sont bien gardés en mémoire ! Tu peux maintenant poursuivre avec les clés suivantes ou passer aux questions finales.
            </p>

            {/* Recap chips */}
            <div className="flex items-center justify-center gap-3 py-2.5 px-4 bg-stone-950/80 rounded-xl border border-stone-800/80 mb-5 text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <Heart className="w-3.5 h-3.5 fill-emerald-500/30" /> {likeCount} J'aime
              </span>
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400/30" /> {superlikeCount} Coups de cœur
              </span>
              <span className="text-stone-400 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> {dislikeCount} Écartées
              </span>
            </div>

            {/* Primary and secondary choices */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onFinish}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <span>Passer aux questions finales (Étape 3)</span>
                <ArrowRight className="w-4 h-4 text-stone-950" />
              </button>

              {photos.length > targetBatchSize && (
                <button
                  type="button"
                  onClick={handleContinueExploring}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-700 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Continuer avec la suite (+{photos.length - targetBatchSize} clés restantes)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMilestoneModal(false);
                  setMilestoneDismissed(true);
                }}
                className="text-[11px] text-stone-500 hover:text-stone-300 pt-2 cursor-pointer underline underline-offset-4 inline-block"
              >
                Voir la grille récapitulative de mes votes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding First-Swipe Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center gap-2.5 mb-3 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-100 font-serif">
                Comment voter ?
              </h3>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Pour chaque photo, indique ton ressenti pour la Clé de la Cl225 :
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-stone-200">Écarter (Swipe Gauche)</p>
                    <kbd className="hidden sm:inline-block bg-stone-800 text-stone-300 text-[10px] px-1 py-0.5 rounded border border-stone-700">←</kbd>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Cette inspiration ne te plaît pas ou ne colle pas à l'esprit 225.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-stone-200">J'aime (Swipe Droit)</p>
                    <kbd className="hidden sm:inline-block bg-stone-800 text-stone-300 text-[10px] px-1 py-0.5 rounded border border-stone-700">→</kbd>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Bonne idée mécanique ou esthétique à conserver.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-stone-200">Super Like (Swipe Haut / Coup de cœur)</p>
                    <kbd className="hidden sm:inline-block bg-stone-800 text-amber-300 text-[10px] px-1 py-0.5 rounded border border-stone-700">↑</kbd>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Vrai coup de cœur ! Tu pourras préciser quel élément t'a particulièrement marqué.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeTutorial}
              className="w-full mt-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold rounded-xl text-xs shadow-md cursor-pointer"
            >
              C'est compris, je commence !
            </button>
          </div>
        </div>
      )}

      {/* Superlike Confirmation & Optional Note Modal */}
      {superlikeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-stone-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center gap-2 mb-2 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
              <h3 className="text-base font-bold text-stone-100 font-serif">
                Coup de cœur enregistré !
              </h3>
            </div>

            <p className="text-xs text-stone-300 font-semibold mb-1 truncate">
              {superlikeTarget.title}
            </p>
            <p className="text-[11px] text-amber-400/90 font-mono mb-3">
              ✓ Ton vote a bien été validé. Tu peux ajouter une note ci-dessous si tu le souhaites (optionnel).
            </p>

            <form onSubmit={handleConfirmSuperlike} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1.5">
                  Qu'est-ce qui te plaît dans cette clé ?
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  placeholder="Optionnel : qu'est-ce qui te plaît dans cette clé ? (forme du panneton, rouages dorés, usinage brut, mécanisme secret...)"
                  value={superlikeComment}
                  onChange={(e) => setSuperlikeComment(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-xs text-stone-100 placeholder-stone-600 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
                <span className="hidden sm:inline text-[10px] font-mono text-stone-500">
                  <kbd className="bg-stone-800 text-stone-300 px-1 py-0.5 rounded border border-stone-700">↵</kbd> Enregistrer
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSuperlikeTarget(null)}
                    className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
                  >
                    Passer
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 fill-stone-950" />
                    <span>Enregistrer la note</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact Swipe Card with instant loading, smooth shimmer skeleton, and zero-latency swipe gesture
interface CompactSwipeCardProps {
  photo: InspirationPhoto;
  onVote: (vote: SwipeVote) => void;
  triggerDirection: 'left' | 'right' | 'up' | null;
  onImageBroken: (photoId: string, photoTitle: string) => void;
  cardIndex?: number;
  totalCards?: number;
  isExtended?: boolean;
}

const CompactSwipeCard: React.FC<CompactSwipeCardProps> = ({
  photo,
  onVote,
  triggerDirection,
  onImageBroken,
  cardIndex,
  totalCards,
  isExtended,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(photo.imageUrl);
  const [retryAttempted, setRetryAttempted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-14, 14]);
  const opacity = useTransform(x, [-260, -140, 0, 140, 260], [0.35, 0.95, 1, 0.95, 0.35]);

  // Reset states when switching photo
  useEffect(() => {
    setCurrentSrc(photo.imageUrl);
    setImageLoaded(false);
    setImageFailed(false);
    setRetryAttempted(false);
    setIsExiting(false);
    x.set(0);
    y.set(0);
  }, [photo.id, photo.imageUrl, x, y]);

  // Handle immediate browser cache hit
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setImageLoaded(true);
      } else if (!retryAttempted && photo.id) {
        setRetryAttempted(true);
        setCurrentSrc(`/api/photo/${photo.id}`);
      } else {
        setImageFailed(true);
        onImageBroken(photo.id, photo.title);
      }
    }
  }, [currentSrc, retryAttempted, photo.id, photo.title, onImageBroken]);

  // Watchdog timer: if image hangs indefinitely without loading or erroring
  useEffect(() => {
    if (imageLoaded || imageFailed) return;
    const timeout = setTimeout(() => {
      if (!imageLoaded && !imageFailed) {
        if (!retryAttempted && photo.id) {
          setRetryAttempted(true);
          setCurrentSrc(`/api/photo/${photo.id}`);
        } else {
          setImageFailed(true);
          onImageBroken(photo.id, photo.title);
        }
      }
    }, 6000);
    return () => clearTimeout(timeout);
  }, [imageLoaded, imageFailed, retryAttempted, photo.id, photo.title, onImageBroken]);

  const handleImageError = () => {
    if (!retryAttempted && photo.id) {
      setRetryAttempted(true);
      setCurrentSrc(`/api/photo/${photo.id}`);
    } else {
      // Both original URL and /api/photo/:id failed: mark as broken and find replacement key
      setImageFailed(true);
      onImageBroken(photo.id, photo.title);
    }
  };

  // Immediate swipe badges visibility during drag gesture
  const likeOpacity = useTransform(x, [12, 38], [0, 1]);
  const dislikeOpacity = useTransform(x, [-12, -38], [0, 1]);
  const superlikeOpacity = useTransform(y, [-12, -38], [0, 1]);

  // Smooth exit animation
  const flyAwayAndVote = useCallback(
    (dir: 'left' | 'right' | 'up') => {
      if (isExiting) return;
      setIsExiting(true);

      const flyX = dir === 'right' ? 520 : dir === 'left' ? -520 : 0;
      const flyY = dir === 'up' ? -520 : 0;
      const vote: SwipeVote = dir === 'right' ? 'like' : dir === 'left' ? 'dislike' : 'superlike';

      if (dir === 'up') {
        animate(y, flyY, { duration: 0.22, ease: 'easeOut' });
      } else {
        animate(x, flyX, { duration: 0.22, ease: 'easeOut' });
      }
      animate(opacity, 0, { duration: 0.22, ease: 'easeOut' });

      setTimeout(() => {
        onVote(vote);
      }, 210);
    },
    [isExiting, onVote, x, y, opacity]
  );

  // Triggered externally by button clicks or keyboard arrows
  useEffect(() => {
    if (triggerDirection && !isExiting) {
      flyAwayAndVote(triggerDirection);
    }
  }, [triggerDirection, isExiting, flyAwayAndVote]);

  const handleDragEnd = (_e: any, info: any) => {
    if (isExiting) return;

    const offsetX = info.offset.x;
    const offsetY = info.offset.y;
    const velocityX = info.velocity.x;
    const velocityY = info.velocity.y;

    const absX = Math.abs(offsetX);
    const absY = Math.abs(offsetY);

    // 1. Dominant Upward Swipe (Superlike)
    // Only triggers if upward movement is significant and clearly dominates horizontal
    if (offsetY < -40 && absY > absX * 1.2) {
      flyAwayAndVote('up');
      return;
    }

    // 2. Horizontal Swipe (Like / Dislike)
    // Highly responsive: 35px or quick velocity flick
    const isLike = offsetX > 35 || velocityX > 140;
    const isDislike = offsetX < -35 || velocityX < -140;

    if (isLike && absX >= absY) {
      flyAwayAndVote('right');
    } else if (isDislike && absX >= absY) {
      flyAwayAndVote('left');
    }
  };

  return (
    <motion.div
      style={{ x, y, rotate, opacity }}
      drag={!isExiting}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-0 bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl cursor-grab active:cursor-grabbing flex flex-col touch-none select-none"
    >
      {/* Photo Image Area */}
      <div className="relative flex-1 w-full bg-stone-950/90 overflow-hidden flex items-center justify-center p-2 sm:p-3">
        {/* Subtle Loading Shimmer Skeleton while the image loads */}
        {!imageLoaded && !imageFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/95 text-stone-600 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-center mb-2">
              <KeyRound className="w-6 h-6 text-amber-500/40 animate-pulse" />
            </div>
            <span className="text-[10px] font-mono tracking-wider text-stone-500 uppercase">
              Chargement...
            </span>
          </div>
        )}

        {!imageFailed ? (
          <img
            ref={(node) => {
              imgRef.current = node;
              if (node && node.complete && node.naturalWidth > 0) {
                setImageLoaded(true);
              }
            }}
            key={currentSrc}
            src={currentSrc}
            alt={photo.title}
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            // @ts-ignore
            fetchPriority="high"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-contain select-none pointer-events-none drop-shadow-md z-10 transition-opacity duration-150 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          /* Automatic replacement state: user never has to swipe a key without seeing it */
          <div className="absolute inset-0 bg-stone-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-inner">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
            <span className="text-xs font-serif text-stone-200 font-semibold mb-1">
              Image non disponible
            </span>
            <span className="text-[11px] font-mono text-amber-400/90">
              Recherche automatique d'une autre clé...
            </span>
          </div>
        )}

        {/* Swipe indicators on drag */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-3 left-3 bg-emerald-500/90 text-stone-950 font-black text-[11px] uppercase px-2.5 py-1 rounded-md border border-emerald-400 shadow flex items-center gap-1 -rotate-12 z-20 pointer-events-none"
        >
          <Heart className="w-3 h-3 fill-stone-950" /> J'AIME
        </motion.div>

        <motion.div
          style={{ opacity: dislikeOpacity }}
          className="absolute top-3 right-3 bg-red-500/90 text-stone-950 font-black text-[11px] uppercase px-2.5 py-1 rounded-md border border-red-400 shadow flex items-center gap-1 rotate-12 z-20 pointer-events-none"
        >
          <X className="w-3 h-3 stroke-[3]" /> ÉCARTER
        </motion.div>

        <motion.div
          style={{ opacity: superlikeOpacity }}
          className="absolute top-4 inset-x-0 mx-auto w-fit bg-amber-500 text-stone-950 font-black text-xs uppercase px-3.5 py-1 rounded-full border border-amber-300 shadow-xl flex items-center gap-1.5 z-20 pointer-events-none tracking-wide"
        >
          <Star className="w-3.5 h-3.5 fill-stone-950" /> SUPER LIKE
        </motion.div>
      </div>

      {/* Card Info - Clean title and card counter */}
      <div className="py-2.5 px-4 bg-stone-900 border-t border-stone-800/90 flex items-center justify-between shrink-0">
        <h3 className="text-sm sm:text-base font-bold text-stone-100 font-serif tracking-wide truncate">
          {photo.title}
        </h3>
        {cardIndex !== undefined && totalCards !== undefined && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800 text-amber-400 shrink-0 ml-2">
            {cardIndex} / {totalCards} {isExtended ? '• Suite' : ''}
          </span>
        )}
      </div>
    </motion.div>
  );
};
