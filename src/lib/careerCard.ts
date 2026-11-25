/**
 * 1.3.0 은퇴 커리어 공유 카드 표시 데이터
 * - CareerRetrospective를 카드 한 장에 들어갈 값으로 정리합니다 (순수 함수).
 * - 카드 이미지 캡처가 막히지 않도록 외부 로고는 같은 서버 주소로 바꿉니다.
 */
import { ALL_INTERNATIONAL_TEAMS, ALL_TEAMS } from '../data/teams';
import type { CareerRetrospective, TeamInfo } from '../types/game';

/** 카드 맨 아래에 적는 게임 주소 (홍보 문구 없이 주소만) */
export const CAREER_CARD_SITE_LABEL = 'roadtomvp.vercel.app';
export const CAREER_CARD_WIDTH = 1080;
export const CAREER_CARD_HEIGHT = 1350;

export interface CareerCardStint {
  teamId: string;
  teamShortName: string;
  leagueShortName: string;
  seasons: number;
  logoTeam: TeamInfo;
}

export interface CareerCardHonor {
  label: '우승' | 'MVP' | '파이널 MVP' | '올스타';
  count: number;
}

export interface CareerCardData {
  playerName: string;
  jerseyNumber: string;
  positionLabel: string;
  heightCm: number;
  yearSpan: string;
  seasonsPlayed: number;
  finalAge: number;
  legacyTitle: string;
  legacyEmoji: string;
  legacyScore: number;
  averages: { ppg: number; rpg: number; apg: number };
  peakOvr: number;
  honors: CareerCardHonor[];
  nbaLine: string | null;
  stints: CareerCardStint[];
  hiddenStintCount: number;
  careerHighPts: number | null;
  peakSeasonLabel: string | null;
}

const TEAM_INDEX: Map<string, TeamInfo> = new Map(
  [...ALL_TEAMS, ...ALL_INTERNATIONAL_TEAMS].map((t) => [t.id, t])
);

/** 팀이 많으면 앞 3팀 + 마지막 1팀만 보이고 나머지는 숨긴 수로 돌려줍니다. */
export function compressStints<T>(items: T[]): { shown: T[]; hidden: number } {
  if (items.length <= 4) return { shown: [...items], hidden: 0 };
  return {
    shown: [...items.slice(0, 3), items[items.length - 1]],
    hidden: items.length - 4,
  };
}

/** 외부 로고는 Next 이미지 변환(/_next/image)을 거쳐 같은 출처 주소로 바꿉니다. */
export function toSameOriginLogoUrl(url: string): string {
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=256&q=90`;
}

/** TeamEmblem과 같은 우선순위로 공식 로고 주소를 정합니다. 없으면 null. */
export function resolveCardLogoSrc(
  team: Pick<TeamInfo, 'id' | 'league' | 'espnId' | 'logoUrl'>,
  espnLogos: Record<string, string>
): string | null {
  const prefix =
    team.league === 'NBA'
      ? 'ESPN_NBA_'
      : team.league === 'NCAA'
      ? 'ESPN_NCAA_'
      : team.league === 'GLEAGUE'
      ? 'ESPN_GLEAGUE_'
      : 'ESPN_';
  const raw =
    espnLogos[team.id] ||
    (team.espnId ? espnLogos[`${prefix}${team.espnId}`] : undefined) ||
    team.logoUrl;
  return raw ? toSameOriginLogoUrl(raw) : null;
}

function joinParts(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(' · ');
}

export function buildCareerCardData(
  retro: CareerRetrospective,
  legacyEmoji: string
): CareerCardData {
  const { totals } = retro;

  const honorSource: CareerCardHonor[] = [
    { label: '우승', count: totals.championships },
    { label: 'MVP', count: totals.mvps },
    { label: '파이널 MVP', count: totals.finalsMvps },
    { label: '올스타', count: totals.allStars },
  ];

  const nbaLine =
    totals.nbaGp > 0
      ? joinParts([
          `NBA ${totals.nbaGp}경기`,
          totals.nbaChampionships > 0 ? `우승 ${totals.nbaChampionships}` : null,
          totals.nbaMvps > 0 ? `MVP ${totals.nbaMvps}` : null,
        ])
      : null;

  const { shown, hidden } = compressStints(retro.stints);
  const stints: CareerCardStint[] = shown.map((stint) => {
    const known = TEAM_INDEX.get(stint.teamId);
    return {
      teamId: stint.teamId,
      teamShortName: stint.teamShortName,
      leagueShortName: stint.leagueShortName,
      seasons: stint.seasons,
      logoTeam: {
        id: stint.teamId,
        name: stint.teamName,
        shortName: stint.teamShortName,
        city: '',
        league: stint.league,
        rating: 80,
        primaryColor: stint.primaryColor,
        secondaryColor: stint.secondaryColor,
        logoUrl: stint.logoUrl ?? known?.logoUrl,
        espnId: known?.espnId,
        espnAbbr: known?.espnAbbr,
        prestigeDesc: '',
        isMilitaryTeam: stint.isMilitaryTeam,
      },
    };
  });

  const peak = retro.peakSeason;
  const peakSeasonLabel = peak
    ? `${peak.year} ${peak.teamShortName} · ${peak.ppg.toFixed(1)}점`
    : null;

  return {
    playerName: retro.playerName,
    jerseyNumber: retro.jerseyNumber,
    positionLabel: retro.secondaryPos
      ? `${retro.primaryPos}/${retro.secondaryPos}`
      : retro.primaryPos,
    heightCm: retro.heightCm,
    yearSpan:
      retro.startYear === retro.endYear
        ? `${retro.startYear}`
        : `${retro.startYear}–${retro.endYear}`,
    seasonsPlayed: retro.seasonsPlayed,
    finalAge: retro.finalAge,
    legacyTitle: retro.legacyTitle,
    legacyEmoji,
    legacyScore: retro.legacyScore,
    averages: {
      ppg: retro.averages.ppg,
      rpg: retro.averages.rpg,
      apg: retro.averages.apg,
    },
    peakOvr: retro.peakOvr,
    honors: honorSource.filter((h) => h.count > 0),
    nbaLine,
    stints,
    hiddenStintCount: hidden,
    careerHighPts: retro.careerHighs.points > 0 ? retro.careerHighs.points : null,
    peakSeasonLabel,
  };
}
