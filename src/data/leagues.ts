import { LeagueId } from '@/src/types/game';

export interface LeagueConfig {
  id: LeagueId;
  name: string;
  shortName: string;
  gamesPerSeason: number;
  games: number;
  ldr: number;
  growthCap: number;
  prestige: number;
  country: string;
  badgeColor: string;
}

export const LEAGUES: Record<LeagueId, LeagueConfig> = {
  HIGH_SCHOOL: {
    id: 'HIGH_SCHOOL',
    name: '한국 고교농구 (대한중고농구연맹)',
    shortName: '고교농구',
    gamesPerSeason: 30,
    games: 30,
    ldr: 45,
    growthCap: 60,
    prestige: 0.35,
    country: '대한민국',
    badgeColor: '#475569',
  },
  U_LEAGUE: {
    id: 'U_LEAGUE',
    name: '한국 대학농구 U-리그 (KUBF)',
    shortName: 'U-리그',
    gamesPerSeason: 16,
    games: 16,
    ldr: 55,
    growthCap: 66,
    prestige: 0.50,
    country: '대한민국',
    badgeColor: '#2563EB',
  },
  KBL: {
    id: 'KBL',
    name: '한국프로농구 (KBL)',
    shortName: 'KBL',
    gamesPerSeason: 54,
    games: 54,
    ldr: 66,
    growthCap: 74,
    prestige: 0.70,
    country: '대한민국',
    badgeColor: '#DC2626',
  },
  B_LEAGUE: {
    id: 'B_LEAGUE',
    name: '일본 B.리그 (B1)',
    shortName: 'B.리그',
    gamesPerSeason: 60,
    games: 60,
    ldr: 69,
    growthCap: 75,
    prestige: 0.76,
    country: '일본',
    badgeColor: '#0284C7',
  },
  NBL: {
    id: 'NBL',
    name: '호주 프로농구 (NBL)',
    shortName: 'NBL',
    gamesPerSeason: 29,
    games: 29,
    ldr: 72,
    growthCap: 78,
    prestige: 0.83,
    country: '호주 · 뉴질랜드',
    badgeColor: '#0D9488',
  },
  GLEAGUE: {
    id: 'GLEAGUE',
    name: 'NBA G리그',
    shortName: 'G리그',
    gamesPerSeason: 50,
    games: 50,
    ldr: 73,
    growthCap: 78,
    prestige: 0.85,
    country: '미국',
    badgeColor: '#4F46E5',
  },
  NCAA: {
    id: 'NCAA',
    name: '미국 대학농구 (NCAA Division 1)',
    shortName: 'NCAA D1',
    gamesPerSeason: 35,
    games: 35,
    ldr: 74,
    growthCap: 79,
    prestige: 1.00,
    country: '미국',
    badgeColor: '#D97706',
  },
  EUROLEAGUE: {
    id: 'EUROLEAGUE',
    name: '유로리그 (EuroLeague)',
    shortName: '유로리그',
    gamesPerSeason: 38,
    games: 38,
    ldr: 78,
    growthCap: 85,
    prestige: 0.94,
    country: '유럽',
    badgeColor: '#EA580C',
  },
  NBA: {
    id: 'NBA',
    name: 'NBA (National Basketball Association)',
    shortName: 'NBA',
    gamesPerSeason: 82,
    games: 82,
    ldr: 84,
    growthCap: 99,
    prestige: 1.00,
    country: '미국',
    badgeColor: '#C2410C',
  },
};

export const LEAGUE_CONFIG = LEAGUES;

export const LEAGUE_ORDER: LeagueId[] = [
  'HIGH_SCHOOL',
  'U_LEAGUE',
  'KBL',
  'B_LEAGUE',
  'NBL',
  'GLEAGUE',
  'NCAA',
  'EUROLEAGUE',
  'NBA',
];
