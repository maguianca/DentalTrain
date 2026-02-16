/**
 * BadgeService.ts
 * Mock service for badges, user statistics, and gamification data
 */

// Types
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt?: Date;
  progress?: number; // 0-100 for badges not yet earned
  requirement: string;
  xpReward: number;
}

export interface UserStats {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  streak: number;
  longestStreak: number;
  casesCompleted: number;
  accuracy: number;
  badgesEarned: number;
  rank: number;
  totalStudents: number;
  dailyGoal: number;
  dailyCasesCompleted: number;
  joinedDate: Date;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl?: string;
  level: number;
  totalXP: number;
  streak: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface ClassItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  instructor: string;
  studentsCount: number;
  casesCount: number;
  progress: number;
}

export interface DiagnosisOption {
  id: string;
  name: string;
  description: string;
  category: string;
}

// Mock Data

const mockBadges: Badge[] = [
  {
    id: 'first-diagnosis',
    name: 'First Steps',
    description: 'Complete your first diagnosis case',
    icon: '🎯',
    rarity: 'common',
    requirement: 'Complete 1 case',
    xpReward: 50,
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    rarity: 'rare',
    requirement: '7-day streak',
    xpReward: 150,
  },
  {
    id: 'perfect-10',
    name: 'Perfect Ten',
    description: 'Get 10 diagnoses correct in a row',
    icon: '⭐',
    rarity: 'epic',
    requirement: '10 correct in a row',
    xpReward: 300,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete a diagnosis in under 2 minutes',
    icon: '⚡',
    rarity: 'rare',
    requirement: 'Complete case < 2 min',
    xpReward: 100,
  },
  {
    id: 'endodontist',
    name: 'Endodontist Expert',
    description: 'Master 20 pulp-related cases',
    icon: '🦷',
    rarity: 'epic',
    requirement: 'Complete 20 endo cases',
    xpReward: 500,
  },
  {
    id: 'periodontal-pro',
    name: 'Periodontal Pro',
    description: 'Master 20 periodontal cases',
    icon: '🩺',
    rarity: 'epic',
    requirement: 'Complete 20 perio cases',
    xpReward: 500,
  },
  {
    id: 'streak-30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: '🏆',
    rarity: 'legendary',
    requirement: '30-day streak',
    xpReward: 1000,
  },
  {
    id: 'diagnostician',
    name: 'Master Diagnostician',
    description: 'Complete 100 diagnosis cases',
    icon: '👑',
    rarity: 'legendary',
    requirement: 'Complete 100 cases',
    xpReward: 2000,
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a case before 7 AM',
    icon: '🌅',
    rarity: 'common',
    requirement: 'Practice before 7 AM',
    xpReward: 25,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a case after 11 PM',
    icon: '🦉',
    rarity: 'common',
    requirement: 'Practice after 11 PM',
    xpReward: 25,
  },
  {
    id: 'team-player',
    name: 'Team Player',
    description: 'Join 3 different classes',
    icon: '🤝',
    rarity: 'rare',
    requirement: 'Join 3 classes',
    xpReward: 100,
  }
];

const mockDiagnosisOptions: DiagnosisOption[] = [
    // --- Pulpal Diagnoses ---
    {
        id: 'acute-total-pulpitis',
        name: 'Acute Total Pulpitis',
        description: 'Generalized, severe inflammation involving the entire pulp tissue',
        category: 'Pulpal',
    },
    {
        id: 'reversible-pulpitis',
        name: 'Reversible Pulpitis',
        description: 'Inflammation of the pulp that can heal if the cause is removed',
        category: 'Pulpal',
    },
    {
        id: 'pulp-necrosis',
        name: 'Pulp Necrosis',
        description: 'Complete death of the pulp tissue, often following irreversible pulpitis',
        category: 'Pulpal',
    },
    {
        id: 'acute-apical-abscess',
        name: 'Acute Apical Abscess',
        description: 'Rapid onset, localized collection of pus in the alveolar bone at the apex of a tooth, usually associated with severe pain and swelling',
        category: 'Endodontic',
    },


    // --- Periapical Diagnoses ---
    {
        id: 'acute-apical-periodontitis',
        name: 'Acute Apical Periodontitis',
        description: 'Painful inflammation around the apex of the tooth, causing tenderness to biting',
        category: 'Periapical',
    },
    {
        id: 'chronic-apical-periodontitis',
        name: 'Chronic Apical Periodontitis',
        description: 'Long-standing inflammation at the apex of a non-vital tooth, usually appearing as a radiolucency',
        category: 'Periapical',
    },

    // --- Periodontal / Soft Tissue Diagnoses ---
    {
        id: 'periodontal-abscess',
        name: 'Periodontal Abscess',
        description: 'Localized purulent infection within the tissues adjacent to the periodontal pocket',
        category: 'Periodontal',
    },
    {
        id: 'pericoronitis',
        name: 'Pericoronitis',
        description: 'Inflammation of the soft tissues surrounding the crown of a partially erupted tooth',
        category: 'Periodontal',
    },

    // --- Structural / Hard Tissue Diagnoses ---
    {
        id: 'simple-caries',
        name: 'Simple Caries',
        description: 'Demineralization of tooth structure caused by bacterial acids affecting enamel/dentin',
        category: 'Structural',
    },
    // --- Non-Dental Diagnoses ---
    {
        id: 'non-endodontic',
        name: 'Non Endodontic Issue',
        description: 'The issue is not related to endodontics or dental structures, it can be otitis, neuralgia, sialolithiasis etc.',
        category: 'Non-endodontic',
    },
];

// Service Functions

export const getAllBadges = (): Badge[] => {
  return mockBadges;
};

export const getDiagnosisOptions = (): DiagnosisOption[] => {
  return mockDiagnosisOptions;
};

// Badge rarity colors
export const getBadgeRarityColor = (rarity: Badge['rarity']): string => {
  const colors = {
    common: '#9ca3af', // gray
    rare: '#3b82f6', // blue
    epic: '#a855f7', // purple
    legendary: '#f59e0b', // amber/gold
  };
  return colors[rarity];
};

export const getBadgeRarityGradient = (rarity: Badge['rarity']): string => {
  const gradients = {
    common: 'from-gray-200 to-gray-300',
    rare: 'from-blue-200 to-blue-400',
    epic: 'from-purple-300 to-pink-400',
    legendary: 'from-yellow-300 to-amber-500',
  };
  return gradients[rarity];
};

// XP Calculations

export const calculateXPForLevel = (level: number): number => {
  // XP needed to reach a level
  return Math.pow(level - 1, 2) * 100;
};

export const calculateXPToNextLevel = (
  currentLevel: number,
  totalXP: number
): number => {
  const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
  const xpForCurrentLevel = calculateXPForLevel(currentLevel);
  return xpForNextLevel - totalXP;
};

// Utility function to get user initials for avatar
export const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
