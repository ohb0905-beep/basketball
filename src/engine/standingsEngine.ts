import {
  CareerState,
  LeagueId,
  StandingEntry,
} from '../types/game';
import { getTeamsByLeague } from '../data/teams';
import {
  isHighSchoolLeague,
  LEAGUE_CONFIG,
} from '../data/leagues';
import {
  PLAYOFF_SERIES_CONFIG,
  REGULAR_SEASON_WIN_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import { getScheduleAdjustedTeamMeanRating } from './seasonSimulator';

/**
 * 시리즈 포맷(BO7/BO5/BO3/BO1)과 경기 번호에 따른 실제 홈코트 이점 반환 (상위 시드 기준)
 * - BO7: 1·2·5·7차전 상위 시드 홈(+1.2), 3·4·6차전 하위 시드 홈(-1.2)
 * - BO5: 1·2·5차전 상위 시드 홈(+1.2), 3·4차전 하위 시드 홈(-1.2)
 * - BO3: 1·3차전 상위 시드 홈(+1.2), 2차전 하위 시드 홈(-1.2)
 */
export function getHigherSeedHomeAdvantage(
  bestOf: number,
  gameNo: number
): number {
  if (bestOf <= 1) return PLAYOFF_SERIES_CONFIG.singleElimHigherSeedEdge;
  const edge = PLAYOFF_SERIES_CONFIG.homeCourtRatingEdge;
  if (bestOf === 7) {
    return gameNo === 1 || gameNo === 2 || gameNo === 5 || gameNo === 7
      ? edge
      : -edge;
  }
  if (bestOf === 5) {
    return gameNo === 1 || gameNo === 2 || gameNo === 5 ? edge : -edge;
  }
  if (bestOf === 3) {
    return gameNo === 1 || gameNo === 3 ? edge : -edge;
  }
  return gameNo % 2 === 1 ? edge : -edge;
}

/**
 * 리그별 파이널(결승전) 시리즈 포맷(BO7 / BO5 / BO3 / BO1) 반환
 */
export function getFinalsSeriesBestOf(league: LeagueId): number {
  if (league === 'NBA' || league === 'KBL') return 7;
  if (league === 'NBL') return 5;
  if (league === 'B_LEAGUE' || league === 'GLEAGUE') return 3;
  return 1;
}

export function getPlayoffCutoffByLeague(
  league: LeagueId,
  totalTeams: number
): number {
  // NBA: 동부 10팀(직행 6 + 플레이인 4) + 서부 10팀 = 총 20팀 포스트시즌
  if (league === 'NBA') return Math.min(20, totalTeams);
  // NCAA: Sweet 16 (16강 단판 토너먼트)
  if (league === 'NCAA') return Math.min(16, totalTeams);
  // G리그: 동부 6팀 + 서부 6팀 = 총 12팀 (1~2시드 부전승)
  if (league === 'GLEAGUE') return Math.min(12, totalTeams);
  // 유로리그: 1~6위 직행 + 7~10위 플레이인 = 총 10팀 포스트시즌
  if (league === 'EUROLEAGUE') return Math.min(10, totalTeams);
  // B.리그(동부2+서부2+와일드카드4), U-리그(8강), 고교(8강)
  if (
    league === 'B_LEAGUE' ||
    league === 'U_LEAGUE' ||
    isHighSchoolLeague(league)
  ) {
    return Math.min(8, totalTeams);
  }
  // KBL(6강 PO) & NBL(1~2위 4강 직행 + 3~6위 2단계 플레이인)
  if (league === 'KBL' || league === 'NBL') {
    return Math.min(6, totalTeams);
  }
  return Math.min(4, totalTeams);
}

/**
 * 리그 전체 구단의 정규시즌 최종 순위표를 동적 생성합니다.
 * - NBA (동15/서15): 각 컨퍼런스 1~6위 PO 직행, 7~10위 플레이인 진출
 * - G리그 (동16/서15): 각 컨퍼런스 1~6위 PO 진출 (1~2위 1R 부전승)
 * - B.리그 (동13/서13): 동부 상위 2팀 + 서부 상위 2팀 + 전체 와일드카드 4팀 = 8강 PO 진출
 * - 유로리그 (20팀): 1~6위 8강 직행, 7~10위 플레이인 쇼다운 진출
 * - NBL (10팀): 1~2위 4강 직행, 3~6위 2단계 플레이인 진출
 * - KBL (10팀): 1~6위 6강 PO 진출 (1~2위 4강 직행)
 * - U-리그 (12팀) / 고교 (30팀): 1~8위 8강 단판 토너먼트 진출
 * - NCAA (32팀): 1~16위 Sweet 16 단판 토너먼트 진출
 */
export function generateLeagueStandings(
  career: CareerState,
  playerWins: number,
  playerLosses: number,
  rng: () => number = Math.random
): StandingEntry[] {
  const pool = getTeamsByLeague(career.league, career.teamRatingsMap);
  const hasPlayerTeam = pool.some((t) => t.id === career.team.id);
  const fullPool = hasPlayerTeam ? pool : [career.team, ...pool];

  const leagueGames = LEAGUE_CONFIG[career.league].games;
  const totalGames = Math.max(1, playerWins + playerLosses || leagueGames);

  // 리그 구단 레이팅 편차에 비례해 AI 랜덤 변동폭 조정 (압축 리그의 과잉 주사위 운 완화)
  const ratings = fullPool.map(
    (t) => career.teamRatingsMap?.[t.id] ?? t.rating
  );
  const ratingSpread =
    ratings.length > 1 ? Math.max(...ratings) - Math.min(...ratings) : 10;
  const aiHalfSpread = clampNum(
    0.036 + ratingSpread * 0.002,
    REGULAR_SEASON_WIN_CONFIG.aiMinHalfSpread,
    REGULAR_SEASON_WIN_CONFIG.aiMaxHalfSpread
  );

  // 1차 기대 승률 산출 (플레이어와 동일한 directionMod ±2.5%p 및 컨퍼런스 일정 보정 기준선 적용)
  const aiRawWinPctMap = new Map<string, number>();
  let aiRawSum = 0;
  let aiCount = 0;
  for (const team of fullPool) {
    if (team.id === career.team.id) continue;
    const dynamicRating = career.teamRatingsMap?.[team.id] ?? team.rating;
    const teamOppMean = getScheduleAdjustedTeamMeanRating(
      career.league,
      career.teamRatingsMap,
      team.conference
    );
    const directionMod =
      team.direction === 'CONTENDER'
        ? REGULAR_SEASON_WIN_CONFIG.contenderDirectionMod
        : team.direction === 'REBUILDING'
        ? REGULAR_SEASON_WIN_CONFIG.rebuildingDirectionMod
        : 0;
    const rawExpected = clampNum(
      0.5 +
        (dynamicRating - teamOppMean) *
          REGULAR_SEASON_WIN_CONFIG.teamRatingSlope +
        directionMod +
        (rng() - 0.5) * (aiHalfSpread * 2),
      REGULAR_SEASON_WIN_CONFIG.minWinPct,
      REGULAR_SEASON_WIN_CONFIG.maxWinPct - 0.01
    );
    aiRawWinPctMap.set(team.id, rawExpected);
    aiRawSum += rawExpected;
    aiCount++;
  }

  // 제로섬 평균 보정: AI 팀 전체 평균 승률이 50%에 수렴하도록 균일 평행이동 (상대 순위·단조성 보존)
  const rawAiMean = aiCount > 0 ? aiRawSum / aiCount : 0.5;
  const zeroSumShift = clampNum(
    0.5 - rawAiMean,
    -REGULAR_SEASON_WIN_CONFIG.zeroSumMaxShift,
    REGULAR_SEASON_WIN_CONFIG.zeroSumMaxShift
  );

  const rawEntries: StandingEntry[] = fullPool.map((team) => {
    const isPlayer = team.id === career.team.id;
    const dynamicRating = career.teamRatingsMap?.[team.id] ?? team.rating;
    const conf = team.conference;

    if (isPlayer) {
      const winPct = Number(
        (playerWins / Math.max(1, playerWins + playerLosses)).toFixed(3)
      );
      return {
        rank: 1,
        conference: conf,
        conferenceRank: 1,
        team: { ...team, rating: dynamicRating },
        wins: playerWins,
        losses: playerLosses,
        winPct,
        gb: 0,
        isPlayerTeam: true,
        qualifiedPlayoffs: false,
        playInQualified: false,
      };
    }

    const expectedWinPct = clampNum(
      (aiRawWinPctMap.get(team.id) ?? 0.5) + zeroSumShift,
      REGULAR_SEASON_WIN_CONFIG.minWinPct,
      REGULAR_SEASON_WIN_CONFIG.maxWinPct - 0.01
    );
    const wins = clampNum(
      Math.round(totalGames * expectedWinPct),
      1,
      totalGames - 1
    );
    const losses = Math.max(0, totalGames - wins);
    const winPct = Number((wins / Math.max(1, wins + losses)).toFixed(3));

    return {
      rank: 1,
      conference: conf,
      conferenceRank: 1,
      team: { ...team, rating: dynamicRating },
      wins,
      losses,
      winPct,
      gb: 0,
      isPlayerTeam: false,
      qualifiedPlayoffs: false,
      playInQualified: false,
    };
  });

  rawEntries.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.team.rating - a.team.rating;
  });

  if (
    career.league === 'NBA' ||
    career.league === 'GLEAGUE' ||
    career.league === 'B_LEAGUE'
  ) {
    const eastList = rawEntries.filter((e) => e.team.conference === 'EAST');
    const westList = rawEntries.filter((e) => e.team.conference !== 'EAST');

    const assignConfRank = (list: StandingEntry[], conf: 'EAST' | 'WEST') => {
      const leader = list[0];
      list.forEach((entry, idx) => {
        const cRank = idx + 1;
        entry.conference = conf;
        entry.conferenceRank = cRank;
        entry.gb =
          idx === 0 || !leader
            ? 0
            : Number(
                Math.max(
                  0,
                  (leader.wins - entry.wins + (entry.losses - leader.losses)) / 2
                ).toFixed(1)
              );

        if (career.league === 'NBA') {
          entry.qualifiedPlayoffs = cRank <= 10;
          entry.playInQualified = cRank >= 7 && cRank <= 10;
        } else if (career.league === 'GLEAGUE') {
          entry.qualifiedPlayoffs = cRank <= 6;
          entry.playInQualified = false;
        } else {
          // B.리그: 동부 상위 2팀 + 서부 상위 2팀 우선 확정 (와일드카드 4팀은 아래에서 추가)
          entry.qualifiedPlayoffs = cRank <= 2;
          entry.playInQualified = false;
        }
      });
    };

    assignConfRank(eastList, 'EAST');
    assignConfRank(westList, 'WEST');

    if (career.league === 'B_LEAGUE') {
      // B.리그 와일드카드 4팀: 동·서부 1~2위를 제외한 나머지 구단 중 승률 상위 4팀
      const wildcards = rawEntries
        .filter((e) => !e.qualifiedPlayoffs)
        .slice(0, 4);
      for (const wc of wildcards) {
        wc.qualifiedPlayoffs = true;
      }
    }

    return rawEntries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }

  const cutoff = getPlayoffCutoffByLeague(career.league, rawEntries.length);
  const leader = rawEntries[0];
  return rawEntries.map((entry, idx) => {
    const rank = idx + 1;
    const gb =
      idx === 0
        ? 0
        : Number(
            Math.max(
              0,
              (leader.wins - entry.wins + (entry.losses - leader.losses)) / 2
            ).toFixed(1)
          );
    const isPlayIn =
      (career.league === 'EUROLEAGUE' && rank >= 7 && rank <= 10) ||
      (career.league === 'NBL' && rank >= 3 && rank <= 6);
    return {
      ...entry,
      rank,
      conferenceRank: rank,
      gb,
      qualifiedPlayoffs: rank <= cutoff,
      playInQualified: isPlayIn,
    };
  });
}
