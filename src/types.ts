export interface UserAuth {
  buque: string;
  famss: string;
}

export interface SurveyOption {
  value: string;
  label: string;
  hint?: string;
  description?: string;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'single_choice' | 'multiple_choice' | 'text';
  options?: SurveyOption[];
  required?: boolean;
  maxSelect?: number;
  placeholder?: string;
  phase?: 'initial' | 'post_swipe';
}

export interface InspirationPhoto {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  fallbackGradient?: string;
  description: string;
  tags: string[];
}

export interface SurveyConfig {
  project: {
    title: string;
    subtitle: string;
    promo: string;
    targetAudience: number;
    description: string;
    swipeBatchSize?: number;
  };
  swipeBatchSize?: number;
  settings?: {
    swipeBatchSize?: number;
  };
  questions: SurveyQuestion[];
  photos: InspirationPhoto[];
}

export type SwipeVote = 'like' | 'dislike' | 'superlike';

export interface SuperlikeDetails {
  element: string;
  reason: string;
}

export interface UserResponseData {
  buque: string;
  famss: string;
  answers: Record<string, string | string[]>;
  swipes: Record<string, SwipeVote>;
  superlikeNotes?: Record<string, SuperlikeDetails>;
  submittedAt?: string;
  updatedAt?: string;
}

export interface GlobalStats {
  totalResponses: number;
  targetAudience: number;
  completionRate: number;
  questionStats: Record<string, Record<string, number>>;
  photoStats: Record<string, { like: number; superlike: number; dislike: number; score: number }>;
  respondents: Array<{
    buque: string;
    famss: string;
    updatedAt: string;
    hasAnswers: boolean;
    hasSwipes: boolean;
  }>;
  textResponses?: Record<string, Array<{ buque: string; famss: string; text: string }>>;
  superlikeHighlights?: Array<{ buque: string; famss: string; photoId: string; element: string; reason: string }>;
}
