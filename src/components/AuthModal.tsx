import React, { useState } from 'react';
import { UserAuth } from '../types';
import { KeyRound, Shield, ArrowRight, Sparkles, Loader2 } from 'lucide-react';

interface AuthModalProps {
  onLogin: (auth: UserAuth) => Promise<void>;
  isLoading?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLogin, isLoading = false }) => {
  const [buque, setBuque] = useState('');
  const [famss, setFamss] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Normalisation intelligente : la casse n'a pas d'importance
  const normalizeBuque = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    // Si tout en minuscules ou tout en majuscules, mettre la 1ère lettre en majuscule
    if (trimmed === trimmed.toLowerCase() || trimmed === trimmed.toUpperCase()) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }
    // Sinon conserver la casse mixte en s'assurant que la première lettre est majuscule
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buque.trim()) {
      setError('Veuillez entrer votre buque');
      return;
    }
    if (!famss.trim()) {
      setError("Veuillez indiquer votre numéro de Fam'ss");
      return;
    }
    setError(null);
    try {
      await onLogin({
        buque: normalizeBuque(buque),
        famss: famss.trim(),
      });
    } catch {
      setError("Une erreur est survenue lors de l'identification.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-stone-700/15 rounded-full blur-3xl pointer-events-none" />

        {/* Emblème & Titre */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4 shadow-inner">
            <KeyRound className="w-7 h-7" />
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold mb-1">
            Cl225 • Clé d'Ex
          </p>
          <h2 className="text-2xl font-bold text-stone-100 font-serif">
            Identification
          </h2>
          <p className="text-sm text-stone-400 mt-1 max-w-xs mx-auto">
            Accès réservé aux membres de la promo 225 pour recueillir des idées.
          </p>
        </div>

        {/* Formulaire sans mot de passe */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="buque-input" className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1.5">
              Ta Buque <span className="text-amber-400">*</span>
            </label>
            <input
              id="buque-input"
              type="text"
              required
              autoFocus
              placeholder="Ex: Rapido, Geox..."
              value={buque}
              onChange={(e) => setBuque(e.target.value)}
              className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-stone-100 placeholder-stone-600 transition-all outline-none text-sm"
            />
          </div>

          <div>
            <label htmlFor="famss-input" className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1.5">
              Ta Fam'ss <span className="text-amber-400">*</span>
            </label>
            <input
              id="famss-input"
              type="text"
              required
              placeholder="Ex: 25, 112, 7..."
              value={famss}
              onChange={(e) => setFamss(e.target.value)}
              className="w-full px-4 py-3 bg-stone-950 border border-stone-800 focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-stone-100 placeholder-stone-600 transition-all outline-none text-sm font-mono"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Pas besoin de mot de passe. La casse (majuscules / minuscules) n'a pas d'importance.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold rounded-xl shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50 cursor-pointer text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                <span>Chargement de tes réponses...</span>
              </>
            ) : (
              <>
                <span>Accéder au sondage</span>
                <ArrowRight className="w-4 h-4 text-stone-950" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
