import React, { useState, useRef, useEffect } from 'react';
import { UserAuth } from '../types';
import { Wrench, LogOut, CheckCircle2, ChevronDown, Layers, FileText, BarChart3, Sparkles } from 'lucide-react';

interface HeaderProps {
  user: UserAuth | null;
  onLogout: () => void;
  activeStep: 'survey' | 'swipe' | 'post_swipe_survey' | 'stats';
  onNavigate: (step: 'survey' | 'swipe' | 'post_swipe_survey' | 'stats') => void;
  surveyProgress: number; // 0 to 100
  swipeProgress: number; // 0 to 100
  postSwipeProgress?: number; // 0 to 100
  hasCompletedBoth: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  activeStep,
  onNavigate,
  surveyProgress,
  swipeProgress,
  postSwipeProgress = 0,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const steps = [
    {
      id: 'survey' as const,
      num: 1,
      name: 'Questionnaire préliminaire',
      shortName: 'Étape 1',
      icon: FileText,
      isDone: surveyProgress === 100,
    },
    {
      id: 'swipe' as const,
      num: 2,
      name: 'Inspirations Clés',
      shortName: 'Swipe',
      icon: Layers,
      isDone: swipeProgress === 100,
    },
    {
      id: 'post_swipe_survey' as const,
      num: 3,
      name: 'Questions secondaires',
      shortName: 'Étape 3',
      icon: Sparkles,
      isDone: postSwipeProgress === 100,
    },
    {
      id: 'stats' as const,
      num: 4,
      name: 'Bilan & Tendances',
      shortName: 'Bilan',
      icon: BarChart3,
      isDone: false,
    },
  ];

  const currentStepInfo = steps.find((s) => s.id === activeStep) || steps[0];

  return (
    <header className="sticky top-0 z-30 bg-stone-950/75 backdrop-blur-md border-b border-stone-800/80 px-2.5 sm:px-6 py-2 transition-all">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-950/80 flex items-center justify-center shadow-md shadow-amber-950/40 border border-amber-500/40 text-stone-950 font-bold shrink-0 p-1">
            <img src="/AM_TRADS_Arrondi.svg" alt="AM" className="w-full h-full object-contain drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-1 leading-none">
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-amber-400 font-mono">
                Clun'ss 225
              </span>
            </div>
            <h1 className="text-xs sm:text-base font-bold tracking-tight text-stone-100 font-serif leading-tight">
              Clé d'Ex
            </h1>
          </div>
        </div>

        {/* Step Selector Button with Dropdown Menu */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-stone-900/75 hover:bg-stone-800/90 border border-stone-800/80 backdrop-blur-sm text-stone-200 text-xs font-medium transition-all shadow-sm cursor-pointer shrink-0"
              title="Changer d'étape"
            >
              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                {currentStepInfo.num}
              </span>
              <span className="font-semibold text-stone-200 hidden sm:inline">{currentStepInfo.name}</span>
              <span className="font-semibold text-stone-200 sm:hidden">{currentStepInfo.shortName}</span>
              {currentStepInfo.isDone && (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ml-0.5 ${
                  isMenuOpen ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-1.5 w-56 bg-stone-900/85 backdrop-blur-xl border border-stone-800/80 rounded-xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 border-b border-stone-800/80 mb-1">
                  Naviguer vers :
                </div>
                {steps.map((step) => {
                  const isActive = step.id === activeStep;
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        onNavigate(step.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-amber-600/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'text-stone-300 hover:bg-stone-800/80 hover:text-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-stone-800/80 border border-stone-700 flex items-center justify-center text-[10px] font-mono">
                          {step.num}
                        </span>
                        <Icon className="w-3.5 h-3.5 text-stone-400" />
                        <span>{step.name}</span>
                      </div>
                      {step.isDone && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* User Info & Logout (Compact) */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 bg-stone-900/75 backdrop-blur-sm border border-stone-800/80 px-1.5 sm:px-2.5 py-1 rounded-lg text-xs">
              <span className="font-semibold text-amber-400 max-w-[70px] sm:max-w-none truncate">
                {user.buque}
              </span>
              <span className="text-stone-500 font-mono text-[10px] sm:text-[11px]">{user.famss}</span>
            </div>

            <button
              onClick={onLogout}
              className="text-stone-400 hover:text-stone-200 hover:bg-stone-900 border border-stone-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
