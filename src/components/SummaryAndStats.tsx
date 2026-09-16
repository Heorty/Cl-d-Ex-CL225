import React, { useState } from 'react';
import { UserAuth, SurveyConfig, GlobalStats, SwipeVote, SuperlikeDetails } from '../types';
import {
  CheckCircle2,
  Users,
  Download,
  Edit3,
  Star,
  Heart,
  FileText,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Award,
  BarChart3,
  MessageSquare,
  Sparkles,
  RefreshCw,
  X,
  KeyRound,
  Layers,
  ArrowRight,
  Settings,
} from 'lucide-react';

interface SummaryAndStatsProps {
  user: UserAuth;
  config: SurveyConfig;
  answers: Record<string, string | string[]>;
  swipes: Record<string, SwipeVote>;
  superlikeNotes?: Record<string, SuperlikeDetails>;
  stats: GlobalStats | null;
  onEditAnswers: (step?: 'survey' | 'swipe' | 'post_swipe_survey') => void;
  onRefreshStats: () => void;
  onUpdateBatchSize?: (newSize: number) => Promise<void>;
  lastSavedTime?: string | null;
}

export const SummaryAndStats: React.FC<SummaryAndStatsProps> = ({
  user,
  config,
  answers,
  swipes,
  superlikeNotes = {},
  stats,
  onEditAnswers,
  onRefreshStats,
  onUpdateBatchSize,
  lastSavedTime,
}) => {
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<'all' | 'superlike' | 'like'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentBatchSize = config.swipeBatchSize ?? config.project?.swipeBatchSize ?? 30;
  const [editingBatchSize, setEditingBatchSize] = useState<number>(currentBatchSize);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleSaveBatchSize = async (sizeToSave: number) => {
    setIsSavingConfig(true);
    try {
      if (onUpdateBatchSize) {
        await onUpdateBatchSize(sizeToSave);
      } else {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ swipeBatchSize: sizeToSave }),
        });
      }
      setConfigSaveSuccess(true);
      setTimeout(() => setConfigSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const target = config.project.targetAudience || 160;
  const totalResponses = stats?.totalResponses || 1;
  const completionPercent = Math.min(100, Math.round((totalResponses / target) * 100));

  // Compute total swipes cast across all respondents
  const totalSwipesCast = (Object.values(stats?.photoStats || {}) as Array<{
    like: number;
    superlike: number;
    dislike: number;
    score: number;
  }>).reduce(
    (acc, p) => acc + (p.like || 0) + (p.superlike || 0) + (p.dislike || 0),
    0
  );

  // Compute photo rankings across the promo
  const photoRankings = config.photos
    .map((p) => {
      const pStat = stats?.photoStats[p.id] || { like: 0, superlike: 0, dislike: 0, score: 0 };
      const totalVotes = pStat.like + pStat.superlike + pStat.dislike;
      const positiveVotes = pStat.like + pStat.superlike;
      const approvalRate = totalVotes > 0 ? Math.round((positiveVotes / totalVotes) * 100) : 0;
      return {
        ...p,
        stats: pStat,
        totalVotes,
        approvalRate,
      };
    })
    .sort((a, b) => {
      // First by score, then by superlike count, then by approval rate
      if (b.stats.score !== a.stats.score) return b.stats.score - a.stats.score;
      if (b.stats.superlike !== a.stats.superlike) return b.stats.superlike - a.stats.superlike;
      return b.approvalRate - a.approvalRate;
    });

  // User's own top favorites
  const userFavorites = config.photos.filter(
    (p) => swipes[p.id] === 'like' || swipes[p.id] === 'superlike'
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStats();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Questions to display as major collective trends
  const trendQuestions = [
    {
      id: 'post_materiaux',
      label: 'Esthétique & Matériaux privilégiés',
      icon: Layers,
      color: 'amber',
    },
    {
      id: 'post_taille_signification',
      label: 'Taille & Dimension préférée de la Clé',
      icon: BarChart3,
      color: 'emerald',
    },
    {
      id: 'post_innovation',
      label: 'Touches d’innovation technologique',
      icon: Sparkles,
      color: 'amber',
    },
    {
      id: 'post_elements_vus',
      label: 'Aspects les plus séduisants des clés vues',
      icon: Layers,
      color: 'purple',
    },
    {
      id: 'pre_importance',
      label: 'Calendrier & Échéance de fabrication',
      icon: Clock,
      color: 'blue',
    },
    {
      id: 'post_interet',
      label: 'Niveau d’intérêt pour le projet',
      icon: Users,
      color: 'emerald',
    },
  ];

  const filteredPhotos = photoRankings.filter((p) => {
    if (photoFilter === 'superlike') return p.stats.superlike > 0;
    if (photoFilter === 'like') return p.stats.like > 0 || p.stats.superlike > 0;
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto py-5 px-3 sm:px-6 space-y-6">
      {/* 1. Executive Status & Confirmation Header */}
      <div className="bg-stone-900/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Votes enregistrés
                </span>
                <span className="text-stone-600">•</span>
                <span className="text-xs font-mono text-stone-300">
                  {user.buque} ({user.famss})
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Tes choix sont comptabilisés dans les tendancesci-dessous.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 text-xs font-medium transition-colors cursor-pointer"
              title="Mettre à jour les statistiques en direct"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <button
              type="button"
              onClick={() => onEditAnswers()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Modifier mes choix</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Collective Promo Participation Barometer */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 font-serif">
                Mobilisation de la Promotion 225
              </h2>
              <p className="text-xs text-stone-400">
                Participation en temps réel de la prom'ss.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-stone-950 px-4 py-2 rounded-xl border border-stone-800/80">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-stone-500">
                Gadzarts votants
              </p>
              <p className="text-xl font-bold font-mono text-amber-400">
                {totalResponses} <span className="text-xs text-stone-500">/ {target}</span>
              </p>
            </div>
            <div className="w-px h-8 bg-stone-800" />
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-stone-500">
                Nombre de swipe
              </p>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {totalSwipesCast}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-stone-950 h-3.5 rounded-full overflow-hidden border border-stone-800 p-0.5">
          <div
            className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 h-full rounded-full transition-all duration-700 shadow-sm"
            style={{ width: `${Math.max(4, completionPercent)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-xs text-stone-400 mt-2 font-mono">
          <span>{completionPercent}% de la prom'ss s'est déjà exprimée</span>
          <span>{Math.max(0, target - totalResponses)} réponses attendues</span>
        </div>

        {/* List of recent voters */}
        {stats?.respondents && stats.respondents.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center gap-2 overflow-x-auto text-xs font-mono text-stone-400 scrollbar-thin">
            <span className="text-[11px] text-stone-500 uppercase shrink-0">Derniers votants :</span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              {stats.respondents.slice(0, 8).map((r, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded-full border text-[10px] shrink-0 ${
                    r.buque?.trim().toLowerCase() === user.buque?.trim().toLowerCase() &&
                    r.famss?.trim().toLowerCase() === user.famss?.trim().toLowerCase()
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-stone-950 text-stone-300 border-stone-800'
                  }`}
                >
                  {r.buque} ({r.famss})
                </span>
              ))}
              {stats.respondents.length > 8 && (
                <span className="text-[10px] text-stone-500">
                  +{stats.respondents.length - 8} autres
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. PODIUM & PALMARÈS DES INSPIRATIONS DE LA PROMO */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 font-serif">
                Palmarès des Inspirations
              </h2>
              <p className="text-xs text-stone-400">
                Clés d'Ex ayant recueilli le plus de buzz.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setPhotoFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                photoFilter === 'all'
                  ? 'bg-stone-800 text-amber-400 font-bold shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Toutes ({photoRankings.length})
            </button>
            <button
              type="button"
              onClick={() => setPhotoFilter('superlike')}
              className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                photoFilter === 'superlike'
                  ? 'bg-stone-800 text-amber-400 font-bold shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Star className="w-3 h-3 fill-amber-400" />
              <span>Coups de cœur</span>
            </button>
            <button
              type="button"
              onClick={() => setPhotoFilter('like')}
              className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                photoFilter === 'like'
                  ? 'bg-stone-800 text-emerald-400 font-bold shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Heart className="w-3 h-3 fill-emerald-400" />
              <span>Plus aimées</span>
            </button>
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        {photoRankings.length >= 3 && photoFilter === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* 2nd Place */}
            {photoRankings[1] && (
              <div className="order-2 md:order-1 bg-stone-950/80 border border-stone-700/60 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-3 left-3 bg-stone-700/90 text-stone-200 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-stone-600 shadow flex items-center gap-1 z-10">
                  <span>🥈 #2</span>
                </div>
                <div className="h-40 w-full bg-stone-900/60 rounded-xl overflow-hidden p-2 flex items-center justify-center relative">
                  <img
                    src={photoRankings[1].imageUrl}
                    alt={photoRankings[1].title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const pId = photoRankings[1]?.id;
                      if (!target.dataset.retried && pId) {
                        target.dataset.retried = 'true';
                        target.src = `/api/photo/${pId}`;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h3 className="font-bold text-sm text-stone-100 truncate">
                    {photoRankings[1].title}
                  </h3>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-800/80 text-xs font-mono">
                    <span className="text-amber-400 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {photoRankings[1].stats.superlike}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-emerald-400" />
                      {photoRankings[1].stats.like}
                    </span>
                    <span className="text-stone-400 font-bold">
                      Score : {photoRankings[1].stats.score}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 1st Place (Featured Center) */}
            {photoRankings[0] && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-stone-950 to-stone-950 border-2 border-amber-500/50 rounded-2xl p-4.5 flex flex-col justify-between relative overflow-hidden shadow-2xl md:-translate-y-2">
                <div className="absolute top-3 left-3 bg-amber-500 text-stone-950 font-mono text-xs font-black px-2.5 py-0.5 rounded-md border border-amber-300 shadow flex items-center gap-1 z-10">
                  <Award className="w-3.5 h-3.5 fill-stone-950" />
                  <span>🥇 #1 PROMO</span>
                </div>
                <div className="h-44 w-full bg-stone-900/70 rounded-xl overflow-hidden p-2 flex items-center justify-center relative mt-4">
                  <img
                    src={photoRankings[0].imageUrl}
                    alt={photoRankings[0].title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const pId = photoRankings[0]?.id;
                      if (!target.dataset.retried && pId) {
                        target.dataset.retried = 'true';
                        target.src = `/api/photo/${pId}`;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h3 className="font-bold text-base text-amber-300 truncate">
                    {photoRankings[0].title}
                  </h3>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-500/20 text-xs font-mono">
                    <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {photoRankings[0].stats.superlike} Super Likes
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                      <Heart className="w-3.5 h-3.5 fill-emerald-400" />
                      {photoRankings[0].stats.like} Likes
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {photoRankings[2] && (
              <div className="order-3 bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-3 left-3 bg-amber-900/80 text-amber-200 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-700 shadow flex items-center gap-1 z-10">
                  <span>🥉 #3</span>
                </div>
                <div className="h-40 w-full bg-stone-900/60 rounded-xl overflow-hidden p-2 flex items-center justify-center relative">
                  <img
                    src={photoRankings[2].imageUrl}
                    alt={photoRankings[2].title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const pId = photoRankings[2]?.id;
                      if (!target.dataset.retried && pId) {
                        target.dataset.retried = 'true';
                        target.src = `/api/photo/${pId}`;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h3 className="font-bold text-sm text-stone-100 truncate">
                    {photoRankings[2].title}
                  </h3>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-800/80 text-xs font-mono">
                    <span className="text-amber-400 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {photoRankings[2].stats.superlike}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-emerald-400" />
                      {photoRankings[2].stats.like}
                    </span>
                    <span className="text-stone-400 font-bold">
                      Score : {photoRankings[2].stats.score}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detailed Full Ranking Table / Cards */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold mb-2">
            Classement complet ({filteredPhotos.length} clés) :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredPhotos.map((photo, index) => {
              const userVote = swipes[photo.id];
              return (
                <div
                  key={photo.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-950 border border-stone-850 hover:border-stone-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 font-mono text-xs flex items-center justify-center font-bold shrink-0">
                      #{index + 1}
                    </span>
                    <div className="w-12 h-12 rounded-lg bg-stone-900 border border-stone-800 p-0.5 shrink-0 overflow-hidden flex items-center justify-center">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
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
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-stone-200 truncate flex items-center gap-1.5">
                        <span>{photo.title}</span>
                        {userVote && (
                          <span
                            className="text-[9px] px-1 py-0.2 rounded font-mono"
                            title="Ton vote personnel"
                          >
                            {userVote === 'superlike' && '⭐'}
                            {userVote === 'like' && '❤️'}
                            {userVote === 'dislike' && '✕'}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono mt-0.5">
                        <span className="text-amber-400 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          {photo.stats.superlike}
                        </span>
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Heart className="w-2.5 h-2.5 fill-emerald-400" />
                          {photo.stats.like}
                        </span>
                        <span className="text-stone-500">
                          {photo.stats.dislike} écartée(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Score {photo.stats.score}
                    </span>
                    <p className="text-[10px] font-mono text-stone-500 mt-1">
                      {photo.approvalRate}% avis +
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. LES GRANDES DÉCISIONS COLLECTIVES DE LA PROMOTION */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-100 font-serif">
              Les Grandes Orientations Collectives
            </h2>
            <p className="text-xs text-stone-400">
              Répartition des votes sur les choix de conception et de réalisation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trendQuestions.map((tq) => {
            const questionDef = config.questions.find((q) => q.id === tq.id);
            if (!questionDef || !questionDef.options) return null;

            const qStats: Record<string, number> = (stats?.questionStats?.[tq.id] as Record<string, number>) || {};
            // Calculate total votes for this question
            const totalQuestionVotes: number = Object.values(qStats).reduce((a: number, b: any) => a + Number(b || 0), 0);

            // Compute sorted options by popularity
            const sortedOptions = [...questionDef.options]
              .map((opt) => {
                const count: number = Number(qStats[opt.value] || 0);
                const percent: number =
                  totalQuestionVotes > 0
                    ? Math.round((count / totalQuestionVotes) * 100)
                    : 0;
                return {
                  ...opt,
                  count,
                  percent,
                };
              })
              .sort((a, b) => b.count - a.count);

            const topChoice = sortedOptions[0];

            return (
              <div
                key={tq.id}
                className="bg-stone-950/80 border border-stone-800/90 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider font-mono">
                        {tq.label}
                      </h3>
                      {topChoice && topChoice.count > 0 && (
                        <p className="text-[11px] text-amber-400 font-semibold mt-0.5">
                          Tendance n°1 : {topChoice.label} ({topChoice.percent}%)
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-stone-500 shrink-0 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                      {totalQuestionVotes} vote(s)
                    </span>
                  </div>

                  {/* Visual Bar Breakdown */}
                  <div className="space-y-2.5">
                    {sortedOptions.map((opt, optIdx) => {
                      const isTop = optIdx === 0 && opt.count > 0;
                      return (
                        <div key={opt.value} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span
                              className={`truncate max-w-[240px] ${
                                isTop ? 'text-amber-300 font-bold' : 'text-stone-300'
                              }`}
                              title={opt.label}
                            >
                              {opt.label}
                            </span>
                            <span className="text-stone-400 font-semibold shrink-0 ml-2">
                              {opt.count} ({opt.percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-stone-900 h-2 rounded-full overflow-hidden border border-stone-800/80">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isTop
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                  : 'bg-stone-700'
                              }`}
                              style={{ width: `${Math.max(opt.count > 0 ? 5 : 0, opt.percent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. MUR DES IDÉES & SYMBOLES SUGGÉRÉS PAR LA PROMOTION */}
      {stats?.textResponses && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100 font-serif">
                Mur des Idées & Symboles Collectifs
              </h2>
              <p className="text-xs text-stone-400">
                Extraits des propositions et remarques exprimées.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Touche d'originalité unique */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Touche d'originalité unique</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(stats.textResponses['post_originalite'] && stats.textResponses['post_originalite'].length > 0) ||
                (stats.textResponses['post_symbole'] && stats.textResponses['post_symbole'].length > 0) ? (
                  [...(stats.textResponses['post_originalite'] || []), ...(stats.textResponses['post_symbole'] || [])].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-stone-900 border border-stone-800/80 text-xs">
                      <p className="text-stone-300 italic">"{item.text}"</p>
                      <p className="text-[10px] text-amber-400/80 font-mono mt-1 font-semibold">
                        — {item.buque} ({item.famss})
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-500 italic">Aucune idée d'originalité proposée pour le moment.</p>
                )}
              </div>
            </div>

            {/* Idées pour incarner la Prom'ss */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Pour incarner la Prom'ss</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {stats.textResponses['pre_representation_promss'] && stats.textResponses['pre_representation_promss'].length > 0 ? (
                  stats.textResponses['pre_representation_promss'].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-stone-900 border border-stone-800/80 text-xs">
                      <p className="text-stone-300 italic">"{item.text}"</p>
                      <p className="text-[10px] text-amber-400/80 font-mono mt-1 font-semibold">
                        — {item.buque} ({item.famss})
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-500 italic">Aucun avis consigné pour le moment.</p>
                )}
              </div>
            </div>

            {/* Boîte à idées & Remarques libres */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Boîte à idées</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {stats.textResponses['post_boite_a_idees'] && stats.textResponses['post_boite_a_idees'].length > 0 ? (
                  stats.textResponses['post_boite_a_idees'].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-stone-900 border border-stone-800/80 text-xs">
                      <p className="text-stone-300 italic">"{item.text}"</p>
                      <p className="text-[10px] text-amber-400/80 font-mono mt-1 font-semibold">
                        — {item.buque} ({item.famss})
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-500 italic">Aucune idée déposée pour le moment.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. VOLET DÉPLIABLE : MES RÉPONSES PERSONNELLES */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
        <button
          type="button"
          onClick={() => setShowPersonalDetails(!showPersonalDetails)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-stone-800 text-stone-300 border border-stone-700">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                Mes réponses individuelles ({user.buque} - {user.famss})
              </h3>
              <p className="text-xs text-stone-400">
                {showPersonalDetails
                  ? 'Clique pour replier ton récapitulatif personnel.'
                  : 'Consulter le détail de mes réponses et mes inspirations likées.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-400 hidden sm:inline">
              {showPersonalDetails ? 'Masquer' : 'Afficher'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
              {showPersonalDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </button>

        {showPersonalDetails && (
          <div className="mt-5 pt-5 border-t border-stone-800/90 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-mono tracking-wider text-stone-400 font-semibold">
                Détail de mes réponses :
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditAnswers('survey')}
                  className="text-stone-400 hover:text-stone-200 text-xs font-mono underline cursor-pointer"
                >
                  Modifier Étape 1
                </button>
                <span className="text-stone-700">/</span>
                <button
                  type="button"
                  onClick={() => onEditAnswers('swipe')}
                  className="text-stone-400 hover:text-stone-200 text-xs font-mono underline cursor-pointer"
                >
                  Modifier Étape 2
                </button>
                <span className="text-stone-700">/</span>
                <button
                  type="button"
                  onClick={() => onEditAnswers('post_swipe_survey')}
                  className="text-amber-400 hover:text-amber-300 text-xs font-mono underline cursor-pointer"
                >
                  Modifier Étape 3
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {config.questions.map((q) => {
                const val = answers[q.id];
                if (!val || (Array.isArray(val) && val.length === 0)) return null;

                let displayVal = '';
                if (Array.isArray(val)) {
                  displayVal = val
                    .map((v) => q.options?.find((o) => o.value === v)?.label || v)
                    .join(', ');
                } else {
                  displayVal = q.options?.find((o) => o.value === val)?.label || String(val);
                }

                if (answers[q.id + '_autre']) {
                  displayVal += ` (Précision : ${answers[q.id + '_autre']})`;
                }

                return (
                  <div
                    key={q.id}
                    className="rounded-xl p-3 bg-stone-950 border border-stone-850"
                  >
                    <p className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 font-bold mb-1">
                      {q.title}
                    </p>
                    <p className="text-xs font-medium text-stone-200">
                      {displayVal}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Personal Favorite photos */}
            {userFavorites.length > 0 && (
              <div className="pt-3 border-t border-stone-800">
                <p className="text-xs uppercase font-mono tracking-wider text-stone-400 font-semibold mb-2.5">
                  Mes inspirations favorites ({userFavorites.length}) :
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {userFavorites.map((p) => {
                    const isSuper = swipes[p.id] === 'superlike';
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg overflow-hidden border border-stone-800 bg-stone-950"
                      >
                        <div className="h-16 w-full bg-stone-900/80 p-1 flex items-center justify-center">
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.retried && p.id) {
                                target.dataset.retried = 'true';
                                target.src = `/api/photo/${p.id}`;
                              } else {
                                target.style.display = 'none';
                              }
                            }}
                          />
                        </div>
                        <div className="p-1.5">
                          <p className="text-[11px] font-bold text-stone-200 truncate">{p.title}</p>
                          <p className="text-[10px] text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                            {isSuper ? (
                              <>
                                <Star className="w-2.5 h-2.5 fill-amber-400" /> Super Like
                              </>
                            ) : (
                              <>
                                <Heart className="w-2.5 h-2.5 fill-amber-400" /> J'aime
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Configuration de la consultation & sélection d'inspirations */}
      <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
        >
          <div className="flex items-center gap-2 text-stone-200">
            <Settings className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold font-serif">Paramètres de la consultation (Configuration)</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              {currentBatchSize} clés initiales
            </span>
            {isConfigOpen ? (
              <ChevronUp className="w-4 h-4 text-stone-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-400" />
            )}
          </div>
        </div>

        {isConfigOpen && (
          <div className="mt-4 pt-4 border-t border-stone-800 text-xs text-stone-300 space-y-3">
            <p className="text-stone-400 leading-relaxed">
              Définit le nombre de clés d'Ex présentées au répondant avant de lui proposer de passer à l'Étape 3 ou de continuer à explorer le reste du catalogue (+{Math.max(0, config.photos.length - currentBatchSize)} clés supplémentaires disponibles).
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-stone-400 font-medium">Préréglages :</span>
              {[15, 20, 30, 45, config.photos.length].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setEditingBatchSize(size);
                    handleSaveBatchSize(size);
                  }}
                  disabled={isSavingConfig}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                    currentBatchSize === size
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                  }`}
                >
                  {size === config.photos.length ? `Toutes (${size})` : `${size} clés`}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label htmlFor="batchSizeInput" className="text-stone-400 font-medium shrink-0">
                Taille personnalisée :
              </label>
              <input
                id="batchSizeInput"
                type="number"
                min={1}
                max={config.photos.length}
                value={editingBatchSize}
                onChange={(e) => setEditingBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleSaveBatchSize(editingBatchSize)}
                disabled={isSavingConfig || editingBatchSize === currentBatchSize}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold text-xs transition-colors cursor-pointer"
              >
                {isSavingConfig ? 'Enregistrement...' : 'Appliquer'}
              </button>
              {configSaveSuccess && (
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px] animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enregistré dans survey-config.json
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 8. Bureau Clé d'Ex Actions & Export */}
      <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-stone-400 font-mono text-[11px]">
          Fichier local : data/responses/{user.buque.toLowerCase()}_famss{user.famss}.json
          {lastSavedTime && ` • Sauvegarde à ${new Date(lastSavedTime).toLocaleTimeString('fr-FR')}`}
        </div>

        <a
          href="/api/export"
          download="reponses_cle_dex_225.json"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-bold transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Exporter les réponses (.json)</span>
        </a>
      </div>
    </div>
  );
};
