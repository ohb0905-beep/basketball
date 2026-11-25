/**
 * 1.3.0 은퇴 커리어 공유 카드 표시 데이터
 * - CareerRetrospective를 카드 한 장에 들어갈 값으로 정리합니다 (순수 함수).
 * - 카드 이미지 캡처가 막히지 않도록 외부 로고는 같은 서버 주소로 바꿉니다.
 */
import { ALL_INTERNATIONAL_TEAMS, ALL_TEAMS } from '../data/teams';
import type { CareerRetrospective, LeagueId, TeamInfo } from '../types/game';

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

/** 리그별 수상 한 줄 (예: { label: 'NBA', text: '우승 4 · MVP 3 · 올스타 10' }) */
export interface CareerCardHonorLine {
  label: string;
  text: string;
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
  honorLines: CareerCardHonorLine[];
  stints: CareerCardStint[];
  hiddenStintCount: number;
  careerHighPts: number | null;
  peakSeasonLabel: string | null;
}

/** 팀이 많아 줄여야 할 때 빼는 아마추어 리그 (고교·대학) */
const AMATEUR_LEAGUES: ReadonlySet<LeagueId> = new Set<LeagueId>([
  'HIGH_SCHOOL',
  'US_HIGH_SCHOOL',
  'U_LEAGUE',
  'NCAA',
]);

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

interface HonorTally {
  championships: number;
  mvps: number;
  finalsMvps: number;
  allStars: number;
}

function formatHonors(t: HonorTally): string {
  return joinParts([
    t.championships > 0 ? `우승 ${t.championships}` : null,
    t.mvps > 0 ? `MVP ${t.mvps}` : null,
    t.finalsMvps > 0 ? `파이널 MVP ${t.finalsMvps}` : null,
    t.allStars > 0 ? `올스타 ${t.allStars}` : null,
  ]);
}

/**
 * 팀별 수상을 리그별로 묶어 한 줄씩 만듭니다.
 * NBA를 맨 위에 두고, 나머지 프로 리그는 커리어 순서대로, 고교·대학은 '아마추어' 한 줄로 맨 아래에 둡니다.
 */
function buildHonorLines(stints: CareerRetrospective['stints']): CareerCardHonorLine[] {
  const AMATEUR_KEY = '__AMATEUR__';
  const order: string[] = [];
  const tallies = new Map<string, { label: string; tally: HonorTally }>();
  for (const stint of stints) {
    const key = AMATEUR_LEAGUES.has(stint.league) ? AMATEUR_KEY : stint.league;
    if (!tallies.has(key)) {
      order.push(key);
      tallies.set(key, {
        label: key === AMATEUR_KEY ? '아마추어' : stint.leagueShortName,
        tally: { championships: 0, mvps: 0, finalsMvps: 0, allStars: 0 },
      });
    }
    const t = tallies.get(key)!.tally;
    t.championships += stint.championships;
    t.mvps += stint.mvps;
    t.finalsMvps += stint.finalsMvps;
    t.allStars += stint.allStars;
  }
  const rank = (key: string) => (key === 'NBA' ? 0 : key === AMATEUR_KEY ? 2 : 1);
  const lines = order
    .map((key, idx) => ({ key, idx }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.idx - b.idx)
    .map(({ key }) => tallies.get(key)!)
    .filter(({ tally }) => formatHonors(tally).length > 0);

  // 카드가 넘치지 않도록 최대 4줄. 넘치면 4번째 줄부터 '기타' 한 줄로 합칩니다.
  if (lines.length > MAX_HONOR_LINES) {
    const rest = lines.slice(MAX_HONOR_LINES - 1);
    const merged: HonorTally = { championships: 0, mvps: 0, finalsMvps: 0, allStars: 0 };
    for (const { tally } of rest) {
      merged.championships += tally.championships;
      merged.mvps += tally.mvps;
      merged.finalsMvps += tally.finalsMvps;
      merged.allStars += tally.allStars;
    }
    lines.splice(MAX_HONOR_LINES - 1, rest.length, { label: '기타', tally: merged });
  }
  return lines.map(({ label, tally }) => ({ label, text: formatHonors(tally) }));
}

const MAX_HONOR_LINES = 4;

export function buildCareerCardData(
  retro: CareerRetrospective,
  legacyEmoji: string
): CareerCardData {
  const honorLines = buildHonorLines(retro.stints);

  // 팀이 많으면 고교·대학은 빼고 프로 팀만 보여 줍니다. 프로 팀이 없으면 그대로 둡니다.
  const proStints = retro.stints.filter((s) => !AMATEUR_LEAGUES.has(s.league));
  const stintPool =
    retro.stints.length > 4 && proStints.length > 0 ? proStints : retro.stints;
  const { shown, hidden } = compressStints(stintPool);
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
    ? `${peak.year} ${peak.teamShortName} · ${peak.ppg.toFixed(1)}득점 · ` +
      `${peak.rpg.toFixed(1)}리바운드 · ${peak.apg.toFixed(1)}어시스트`
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
    honorLines,
    stints,
    hiddenStintCount: hidden,
    careerHighPts: retro.careerHighs.points > 0 ? retro.careerHighs.points : null,
    peakSeasonLabel,
  };
}
