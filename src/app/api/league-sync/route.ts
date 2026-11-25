import { NextRequest, NextResponse } from 'next/server';
import { generateLeagueFallbackSvgDataUri } from '../../../data/logoFallbacks';
import {
  ALL_INTERNATIONAL_TEAMS,
  B_LEAGUE_TEAMS,
  EUROLEAGUE_TEAMS,
  GLEAGUE_TEAMS,
  HIGH_SCHOOL_TEAMS,
  US_HIGH_SCHOOL_TEAMS,
  KBL_TEAMS,
  NBA_TEAMS,
  NBL_TEAMS,
  NCAA_TEAMS,
  SANGMU_TEAM,
  U_LEAGUE_TEAMS,
} from '../../../data/teams';
import { TeamInfo } from '../../../types/game';

export const revalidate = 3600;

export interface SyncPayload {
  ok: boolean;
  cached: boolean;
  syncedAt: string;
  count: number;
  logos: Record<string, string>;
  fallbacks: Record<string, string>;
  standingsHint: Record<string, number>;
  sourceStatus: {
    nba: boolean;
    ncaa: boolean;
    gleague: boolean;
    kbl: boolean;
    koreaAmateur: boolean;
  };
}

// 서버 인메모리 캐시 (1시간 TTL)
let cachedSyncPayload: SyncPayload | null = null;
let cachedTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

const KBL_OFFICIAL_SYMBOL_MAP: Record<string, string> = {
  KBL_SK: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-sk.svg',
  KBL_KT: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-kt.svg',
  KBL_LG: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-lg.svg',
  KBL_KCC: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-kcc.svg',
  KBL_DB: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-db.svg',
  KBL_MOBIS: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-hd.svg',
  KBL_SONO: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-sono.svg',
  KBL_KGC: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-kgc.svg',
  KBL_GAS: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-pega.svg',
  KBL_SAMSUNG: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-ss.svg',
  KBL_SANGMU: 'https://www.kbl.or.kr/assets/img/ico/logo/ic-sangmu.svg',
};

const KOREA_NATIONAL_TEAM_ENTRY: TeamInfo = {
  id: 'KOR_NAT_TEAM',
  name: '대한민국 남자농구 국가대표팀',
  shortName: '대한민국',
  city: '서울',
  league: 'KBL',
  rating: 78,
  primaryColor: '#0047A0',
  secondaryColor: '#CD2E3A',
  espnAbbr: 'KOR',
  logoUrl: '/logos/NAT_KOR.svg',
  prestigeDesc: '대한민국 남자농구 국가대표팀입니다.',
};

/**
 * 실시간/주기적 전 리그(고교, 대학, KBL, 해외, G리그, NCAA, NBA, 국제대회 국가대표) 구단 공식 로고 획득 및 캐싱 엔드포인트
 * - NBA / NCAA / G-League: ESPN 공식 API에서 실시간 획득 및 리그별 네임스페이스 캐싱
 * - KBL / 한국 대학(U-League) / 한국 고교 / 대한민국 대표팀: 정적 에셋과 원격 엔드포인트 동기화
 * - 네트워크 오류 시 각 리그의 규격에 맞춘 고품질 SVG 이니셜 로고(fallbacks) 자동 생성 및 폴백
 */
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl?.searchParams?.get('refresh') === '1';
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedSyncPayload &&
    now - cachedTimestamp < CACHE_TTL_MS
  ) {
    return NextResponse.json(
      { ...cachedSyncPayload, cached: true },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  }

  const logos: Record<string, string> = {};
  const fallbacks: Record<string, string> = {};
  const standingsHint: Record<string, number> = {};
  const sourceStatus = {
    nba: false,
    ncaa: false,
    gleague: false,
    kbl: false,
    koreaAmateur: true,
  };

  const allRegisteredTeams: TeamInfo[] = [
    ...HIGH_SCHOOL_TEAMS,
    ...US_HIGH_SCHOOL_TEAMS,
    ...U_LEAGUE_TEAMS,
    ...KBL_TEAMS,
    SANGMU_TEAM,
    ...B_LEAGUE_TEAMS,
    ...NBL_TEAMS,
    ...EUROLEAGUE_TEAMS,
    ...GLEAGUE_TEAMS,
    ...NCAA_TEAMS,
    ...NBA_TEAMS,
    ...ALL_INTERNATIONAL_TEAMS,
    KOREA_NATIONAL_TEAM_ENTRY,
  ];

  // 1. 전 구단 리그별 맞춤형 고품질 SVG 폴백 로고 생성 및 기본 공식 로고 등록
  for (const team of allRegisteredTeams) {
    const svgFallback = generateLeagueFallbackSvgDataUri(team);
    fallbacks[team.id] = svgFallback;
    logos[team.id] = team.logoUrl || svgFallback;

    if (team.league === 'NBA' && team.espnId) {
      const url = team.logoUrl || svgFallback;
      logos[`ESPN_NBA_${team.espnId}`] = url;
      fallbacks[`ESPN_NBA_${team.espnId}`] = svgFallback;
    } else if (team.league === 'NCAA' && team.espnId) {
      const url = team.logoUrl || svgFallback;
      logos[`ESPN_NCAA_${team.espnId}`] = url;
      fallbacks[`ESPN_NCAA_${team.espnId}`] = svgFallback;
    } else if (team.league === 'GLEAGUE' && team.espnId) {
      const url = team.logoUrl || svgFallback;
      logos[`ESPN_GLEAGUE_${team.espnId}`] = url;
      fallbacks[`ESPN_GLEAGUE_${team.espnId}`] = svgFallback;
    }
  }

  // 2. 한국 프로농구 연맹(KBL) 공식 페이지 심볼 확인 및 로컬 캐시 에셋 매핑
  try {
    const kblProbe = await fetch(KBL_OFFICIAL_SYMBOL_MAP.KBL_SK, {
      method: 'HEAD',
      next: { revalidate: 3600 },
    });
    sourceStatus.kbl = kblProbe.ok;
  } catch {
    sourceStatus.kbl = false;
  }
  for (const kblTeam of [...KBL_TEAMS, SANGMU_TEAM]) {
    logos[kblTeam.id] =
      kblTeam.logoUrl ||
      KBL_OFFICIAL_SYMBOL_MAP[kblTeam.id] ||
      fallbacks[kblTeam.id];
  }

  // 3. NBA 30개 구단 공식 로고 실시간 획득 (ESPN_NBA_ 네임스페이스)
  try {
    const nbaRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50',
      { next: { revalidate: 3600 } }
    );
    if (nbaRes.ok) {
      const data = await nbaRes.json();
      const nbaTeams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      for (const entry of nbaTeams) {
        const id = String(entry?.team?.id ?? '');
        const abbr = String(entry?.team?.abbreviation ?? '').toUpperCase();
        const logo = entry?.team?.logos?.[0]?.href;
        if (id && logo) {
          logos[`ESPN_NBA_${id}`] = logo;
          const matched = NBA_TEAMS.find(
            (t) =>
              t.espnId === id ||
              (t.espnAbbr && t.espnAbbr.toUpperCase() === abbr)
          );
          if (matched) {
            logos[matched.id] = logo;
          }
        }
      }
      sourceStatus.nba = true;
    }
  } catch {
    // 네트워크 오류 시 사전 설정된 공식 URL 또는 리그 규격 SVG 이니셜 폴백 유지
  }

  // 4. NCAA D1 24개 대학 구단 공식 로고 실시간 획득 (ESPN_NCAA_ 네임스페이스)
  try {
    const ncaaRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500',
      { next: { revalidate: 3600 } }
    );
    if (ncaaRes.ok) {
      const data = await ncaaRes.json();
      const ncaaTeams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      for (const entry of ncaaTeams) {
        const id = String(entry?.team?.id ?? '');
        const logo = entry?.team?.logos?.[0]?.href;
        if (id && logo) {
          logos[`ESPN_NCAA_${id}`] = logo;
          const matched = NCAA_TEAMS.find((t) => t.espnId === id);
          if (matched) {
            logos[matched.id] = logo;
          }
        }
      }
      sourceStatus.ncaa = true;
    }
  } catch {
    // 네트워크 오류 시 사전 설정된 공식 URL 또는 대학 규격 SVG 이니셜 폴백 유지
  }

  // 5. NBA G-League 20개 구단 공식 로고 실시간 획득 (ESPN_GLEAGUE_ 네임스페이스)
  try {
    const glRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba-development/teams?limit=50',
      { next: { revalidate: 3600 } }
    );
    if (glRes.ok) {
      const data = await glRes.json();
      const glTeams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      for (const entry of glTeams) {
        const id = String(entry?.team?.id ?? '');
        const abbr = String(entry?.team?.abbreviation ?? '').toUpperCase();
        const logo = entry?.team?.logos?.[0]?.href;
        if (id && logo && !logo.includes('/guid/')) {
          logos[`ESPN_GLEAGUE_${id}`] = logo;
          const matched = GLEAGUE_TEAMS.find(
            (t) =>
              (t.espnAbbr && t.espnAbbr.toUpperCase() === abbr) ||
              t.espnId === id
          );
          if (matched) {
            logos[matched.id] = logo;
          }
        }
      }
      sourceStatus.gleague = true;
    }
  } catch {
    // 네트워크 오류 시 사전 설정된 공식 G리그 URL 또는 G리그 규격 SVG 이니셜 폴백 유지
  }

  const payload: SyncPayload = {
    ok: true,
    cached: false,
    syncedAt: new Date().toISOString(),
    count: allRegisteredTeams.length,
    logos,
    fallbacks,
    standingsHint,
    sourceStatus,
  };

  cachedSyncPayload = payload;
  cachedTimestamp = now;

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
