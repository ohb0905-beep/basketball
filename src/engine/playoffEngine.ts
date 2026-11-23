import {
  AsianGamesMatchLog,
  AsianGamesTournamentResult,
  CareerState,
  ClutchChoiceId,
  ClutchScenarioType,
  InternationalMedalType,
  InternationalTournamentResult,
  InternationalTournamentType,
  LeagueId,
  LiveCourtPlay,
  LiveGameState,
  LivePlayerBoxSnapshot,
  LiveQuarterLog,
  LiveTacticId,
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
  TeamInfo,
} from '../types/game';
import {
  ASIAN_NATIONAL_TEAMS,
  getNationalTeamsForTournament,
  getTeamsByLeague,
} from '../data/teams';
import { LEAGUE_CONFIG } from '../data/leagues';
import {
  INTERNATIONAL_TOURNAMENT_CONFIG,
  LEAGUE_BALANCE_META,
  LIVE_GAME_CONFIG,
} from '../config/balanceConfig';
import {
  calculateBiomechanicalProfile,
  calculateHeightMismatchPenalty,
  calculateOvr,
} from './statCalculator';
import { getLeagueBaselineTeamRating } from './seasonSimulator';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
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
    league === 'HIGH_SCHOOL'
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
  const leagueMeanRating = getLeagueBaselineTeamRating(
    career.league,
    career.teamRatingsMap
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

    const directionMod =
      team.direction === 'CONTENDER'
        ? 0.022
        : team.direction === 'REBUILDING'
        ? -0.022
        : 0;
    // 플레이어 팀 승률 기대치 공식과 동일한 기준선(leagueMeanRating) 적용 + 현실적 시즌 변동폭(±8%)
    const expectedWinPct = clamp(
      0.5 +
        (dynamicRating - leagueMeanRating) * 0.021 +
        directionMod +
        (rng() - 0.5) * 0.16,
      0.16,
      0.84
    );
    const wins = clamp(
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

function getSeriesConfig(
  league: LeagueId,
  roundNumber: number,
  totalRounds: number
): { bestOf: number; winsNeeded: number; roundLabel: string } {
  if (league === 'NCAA') {
    return {
      bestOf: 1,
      winsNeeded: 1,
      roundLabel:
        roundNumber === 1
          ? '16강 토너먼트 (Sweet 16)'
          : roundNumber === 2
          ? '8강 토너먼트 (Elite 8)'
          : roundNumber === 3
          ? '4강 토너먼트 (Final Four)'
          : 'NCAA 전국 결승전',
    };
  }
  if (league === 'HIGH_SCHOOL' || league === 'U_LEAGUE') {
    return {
      bestOf: 1,
      winsNeeded: 1,
      roundLabel:
        roundNumber === 1
          ? '8강 토너먼트'
          : roundNumber === 2
          ? '4강 토너먼트'
          : '전국 결승전',
    };
  }
  if (league === 'NBA') {
    return {
      bestOf: 7,
      winsNeeded: 4,
      roundLabel:
        roundNumber === 1
          ? '컨퍼런스 1라운드 (8강)'
          : roundNumber === 2
          ? '컨퍼런스 세미파이널 (4강)'
          : roundNumber === 3
          ? '컨퍼런스 파이널'
          : 'NBA 파이널',
    };
  }
  if (league === 'GLEAGUE') {
    const isFinal = roundNumber === totalRounds;
    return {
      bestOf: isFinal ? 3 : 1,
      winsNeeded: isFinal ? 2 : 1,
      roundLabel:
        roundNumber === 1
          ? '컨퍼런스 1라운드 (단판)'
          : roundNumber === 2
          ? '컨퍼런스 세미파이널 (단판)'
          : roundNumber === 3
          ? '컨퍼런스 파이널 (단판)'
          : 'G리그 파이널 (3전 2선승)',
    };
  }
  if (league === 'B_LEAGUE') {
    return {
      bestOf: 3,
      winsNeeded: 2,
      roundLabel:
        roundNumber === 1
          ? 'B.리그 8강 플레이오프'
          : roundNumber === 2
          ? 'B.리그 4강 플레이오프'
          : 'B.리그 파이널',
    };
  }
  if (league === 'NBL') {
    if (roundNumber === 1) {
      return {
        bestOf: 3,
        winsNeeded: 2,
        roundLabel: 'NBL 세미파이널 (4강)',
      };
    }
    return {
      bestOf: 5,
      winsNeeded: 3,
      roundLabel: 'NBL 챔피언십 시리즈',
    };
  }
  if (league === 'EUROLEAGUE') {
    if (roundNumber === 1) {
      return {
        bestOf: 5,
        winsNeeded: 3,
        roundLabel: '유로리그 8강 플레이오프',
      };
    }
    if (roundNumber === 2) {
      return {
        bestOf: 1,
        winsNeeded: 1,
        roundLabel: '유로리그 파이널 포 (4강 단판)',
      };
    }
    return {
      bestOf: 1,
      winsNeeded: 1,
      roundLabel: '유로리그 파이널 포 결승',
    };
  }
  // KBL: 6강 BO5 -> 4강 BO5 -> 챔피언 결정전 BO7
  const isFinal = roundNumber === totalRounds;
  return {
    bestOf: isFinal ? 7 : 5,
    winsNeeded: isFinal ? 4 : 3,
    roundLabel:
      roundNumber === 1
        ? '6강 플레이오프'
        : roundNumber === 2
        ? '4강 플레이오프'
        : '챔피언 결정전',
  };
}

function createMatchup(
  id: string,
  roundNumber: number,
  roundLabel: string,
  bestOf: number,
  winsNeeded: number,
  higher: StandingEntry,
  lower: StandingEntry,
  playerTeamId: string,
  conference?: 'EAST' | 'WEST' | 'FINALS',
  extra?: {
    isPlayIn?: boolean;
    playInSlot?: '7v8' | '9v10' | '3v4' | '5v6' | 'DECIDER';
  }
): PlayoffSeriesMatchup {
  const hiRank = higher.conferenceRank ?? higher.rank;
  const loRank = lower.conferenceRank ?? lower.rank;
  const OrderedHi =
    conference === 'FINALS'
      ? higher.winPct >= lower.winPct
        ? higher
        : lower
      : hiRank <= loRank
      ? higher
      : lower;
  const OrderedLo = OrderedHi === higher ? lower : higher;

  const seedTagHi =
    conference && conference !== 'FINALS'
      ? `${conference === 'EAST' ? '동부' : '서부'} ${OrderedHi.conferenceRank ?? OrderedHi.rank}시드`
      : `${OrderedHi.rank}위`;
  const seedTagLo =
    conference && conference !== 'FINALS'
      ? `${conference === 'EAST' ? '동부' : '서부'} ${OrderedLo.conferenceRank ?? OrderedLo.rank}시드`
      : `${OrderedLo.rank}위`;

  return {
    id,
    roundNumber,
    roundLabel,
    conference,
    bestOf,
    winsNeeded,
    higherSeed: OrderedHi,
    lowerSeed: OrderedLo,
    higherSeedWins: 0,
    lowerSeedWins: 0,
    winnerId: null,
    involvesPlayer:
      OrderedHi.team.id === playerTeamId || OrderedLo.team.id === playerTeamId,
    isPlayIn: extra?.isPlayIn,
    playInSlot: extra?.playInSlot,
    summaryLog: [
      `(${seedTagHi}) ${OrderedHi.team.shortName} vs (${seedTagLo}) ${OrderedLo.team.shortName} 대진 확정`,
    ],
  };
}

function getWinnerEntry(s: PlayoffSeriesMatchup): StandingEntry {
  return s.winnerId === s.higherSeed.team.id ? s.higherSeed : s.lowerSeed;
}

function getLoserEntry(s: PlayoffSeriesMatchup): StandingEntry {
  return s.winnerId === s.higherSeed.team.id ? s.lowerSeed : s.higherSeed;
}

/**
 * NBA 본선 1라운드 대진 생성 (동·서부 1~6시드 + 플레이인으로 확정된 7·8시드)
 */
function buildNbaMainRound1(
  eastTop6: StandingEntry[],
  westTop6: StandingEntry[],
  east7: StandingEntry,
  east8: StandingEntry,
  west7: StandingEntry,
  west8: StandingEntry,
  playerTeamId: string
): PlayoffSeriesMatchup[] {
  const r1Cfg = getSeriesConfig('NBA', 1, 4);
  const eastPairs: [StandingEntry, StandingEntry][] = [
    [eastTop6[0], east8],
    [eastTop6[3], eastTop6[4]],
    [eastTop6[1], east7],
    [eastTop6[2], eastTop6[5]],
  ];
  const westPairs: [StandingEntry, StandingEntry][] = [
    [westTop6[0], west8],
    [westTop6[3], westTop6[4]],
    [westTop6[1], west7],
    [westTop6[2], westTop6[5]],
  ];

  return [
    ...eastPairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_E${i + 1}`,
        1,
        `동부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        playerTeamId,
        'EAST'
      )
    ),
    ...westPairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_W${i + 1}`,
        1,
        `서부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        playerTeamId,
        'WEST'
      )
    ),
  ];
}

/**
 * 유로리그 본선 8강 대진 생성 (1~6위 + 플레이인 7·8시드)
 */
function buildEuroleagueMainRound1(
  top6: StandingEntry[],
  seed7: StandingEntry,
  seed8: StandingEntry,
  playerTeamId: string
): PlayoffSeriesMatchup[] {
  const r1Cfg = getSeriesConfig('EUROLEAGUE', 1, 3);
  const pairs: [StandingEntry, StandingEntry][] = [
    [top6[0], seed8],
    [top6[3], top6[4]],
    [top6[1], seed7],
    [top6[2], top6[5]],
  ];
  return pairs.map(([hi, lo], i) =>
    createMatchup(
      `R1_S${i + 1}`,
      1,
      r1Cfg.roundLabel,
      r1Cfg.bestOf,
      r1Cfg.winsNeeded,
      hi,
      lo,
      playerTeamId
    )
  );
}

/**
 * NBL 본선 세미파이널(4강 BO3) 대진 생성 (1·2위 직행 + 플레이인 3·4시드)
 */
function buildNblMainRound1(
  seed1: StandingEntry,
  seed2: StandingEntry,
  seed3: StandingEntry,
  seed4: StandingEntry,
  playerTeamId: string
): PlayoffSeriesMatchup[] {
  const r1Cfg = getSeriesConfig('NBL', 1, 2);
  return [
    createMatchup(
      'R1_S1',
      1,
      r1Cfg.roundLabel,
      r1Cfg.bestOf,
      r1Cfg.winsNeeded,
      seed1,
      seed4,
      playerTeamId
    ),
    createMatchup(
      'R1_S2',
      1,
      r1Cfg.roundLabel,
      r1Cfg.bestOf,
      r1Cfg.winsNeeded,
      seed2,
      seed3,
      playerTeamId
    ),
  ];
}

/**
 * 정규시즌 순위표를 바탕으로 전 리그 포스트시즌(플레이인 + 본선) 대진표를 생성합니다.
 */
export function createPlayoffBracket(
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number = Math.random
): PlayoffBracketState {
  const playerStanding =
    standings.find((s) => s.isPlayerTeam) || standings[standings.length - 1];

  // 1) NBA: 동·서부 1~6위 본선 직행, 7~10위 플레이인 토너먼트 (BO1 2단계 -> 16팀 4R BO7)
  if (career.league === 'NBA') {
    const eastList = standings
      .filter((s) => s.team.conference === 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank));
    const westList = standings
      .filter((s) => s.team.conference !== 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank));

    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if (!playerQualified || eastList.length < 10 || westList.length < 10) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 4,
        currentRound: 1,
        stageType: 'MAIN_PLAYOFF',
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'PO 탈락',
      };
    }

    const piEast78 = createMatchup(
      'PI1_E78',
      1,
      '동부 플레이인 7·8위 결정전',
      1,
      1,
      eastList[6],
      eastList[7],
      career.team.id,
      'EAST',
      { isPlayIn: true, playInSlot: '7v8' }
    );
    const piEast910 = createMatchup(
      'PI1_E910',
      1,
      '동부 플레이인 9·10위 단판전',
      1,
      1,
      eastList[8],
      eastList[9],
      career.team.id,
      'EAST',
      { isPlayIn: true, playInSlot: '9v10' }
    );
    const piWest78 = createMatchup(
      'PI1_W78',
      1,
      '서부 플레이인 7·8위 결정전',
      1,
      1,
      westList[6],
      westList[7],
      career.team.id,
      'WEST',
      { isPlayIn: true, playInSlot: '7v8' }
    );
    const piWest910 = createMatchup(
      'PI1_W910',
      1,
      '서부 플레이인 9·10위 단판전',
      1,
      1,
      westList[8],
      westList[9],
      career.team.id,
      'WEST',
      { isPlayIn: true, playInSlot: '9v10' }
    );

    // 플레이어가 7~10위 플레이인 참가 팀이면 플레이인 1라운드부터 직접 진행
    if (playerStanding.playInQualified) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 2,
        currentRound: 1,
        stageType: 'PLAY_IN_ROUND_1',
        rounds: [[piEast78, piEast910, piWest78, piWest910]],
        playerEliminated: false,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: '플레이인 토너먼트 진출',
      };
    }

    // 1~6위 직행 시에는 7~10위 플레이인을 백그라운드로 시뮬레이션하여 실제 7·8시드를 채운 뒤 본선 1R 시작
    const resE78 = simulateSingleSeries(piEast78, career, rng, false);
    const resE910 = simulateSingleSeries(piEast910, career, rng, false);
    const resEDec = simulateSingleSeries(
      createMatchup(
        'PI2_E8',
        2,
        '동부 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(resE78),
        getWinnerEntry(resE910),
        career.team.id,
        'EAST',
        { isPlayIn: true, playInSlot: 'DECIDER' }
      ),
      career,
      rng,
      false
    );
    const resW78 = simulateSingleSeries(piWest78, career, rng, false);
    const resW910 = simulateSingleSeries(piWest910, career, rng, false);
    const resWDec = simulateSingleSeries(
      createMatchup(
        'PI2_W8',
        2,
        '서부 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(resW78),
        getWinnerEntry(resW910),
        career.team.id,
        'WEST',
        { isPlayIn: true, playInSlot: 'DECIDER' }
      ),
      career,
      rng,
      false
    );

    const east7 = getWinnerEntry(resE78);
    const east8 = getWinnerEntry(resEDec);
    const west7 = getWinnerEntry(resW78);
    const west8 = getWinnerEntry(resWDec);

    const round1Series = buildNbaMainRound1(
      eastList.slice(0, 6),
      westList.slice(0, 6),
      east7,
      east8,
      west7,
      west8,
      career.team.id
    );

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds: 4,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      playInSeeds: { east7, east8, west7, west8 },
      rounds: [round1Series],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: '플레이오프 진출',
    };
  }

  // 2) 유로리그 (20팀): 1~6위 8강 직행, 7~10위 플레이인 쇼다운 (BO1 2단계 -> 8강 BO5 -> 파이널 포 4강/결승 BO1)
  if (career.league === 'EUROLEAGUE') {
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if (!playerQualified || standings.length < 10) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 3,
        currentRound: 1,
        stageType: 'MAIN_PLAYOFF',
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'PO 탈락',
      };
    }

    const pi78 = createMatchup(
      'PI1_EL78',
      1,
      '유로리그 플레이인 7·8위 결정전',
      1,
      1,
      standings[6],
      standings[7],
      career.team.id,
      undefined,
      { isPlayIn: true, playInSlot: '7v8' }
    );
    const pi910 = createMatchup(
      'PI1_EL910',
      1,
      '유로리그 플레이인 9·10위 단판전',
      1,
      1,
      standings[8],
      standings[9],
      career.team.id,
      undefined,
      { isPlayIn: true, playInSlot: '9v10' }
    );

    if (playerStanding.playInQualified) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 2,
        currentRound: 1,
        stageType: 'PLAY_IN_ROUND_1',
        rounds: [[pi78, pi910]],
        playerEliminated: false,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: '유로리그 플레이인 진출',
      };
    }

    const res78 = simulateSingleSeries(pi78, career, rng, false);
    const res910 = simulateSingleSeries(pi910, career, rng, false);
    const resDec = simulateSingleSeries(
      createMatchup(
        'PI2_EL8',
        2,
        '유로리그 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(res78),
        getWinnerEntry(res910),
        career.team.id,
        undefined,
        { isPlayIn: true, playInSlot: 'DECIDER' }
      ),
      career,
      rng,
      false
    );
    const seed7 = getWinnerEntry(res78);
    const seed8 = getWinnerEntry(resDec);

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds: 3,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      playInSeeds: { seed7, seed8 },
      rounds: [
        buildEuroleagueMainRound1(
          standings.slice(0, 6),
          seed7,
          seed8,
          career.team.id
        ),
      ],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: '유로리그 8강 PO 진출',
    };
  }

  // 3) 호주 NBL (10팀): 1~2위 4강 직행, 3~6위 정통 2단계 플레이인 (3v4 + 5v6 -> 최종전 -> 4강 BO3 -> 챔피언십 BO5)
  if (career.league === 'NBL') {
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if (!playerQualified || standings.length < 6) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 2,
        currentRound: 1,
        stageType: 'MAIN_PLAYOFF',
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'PO 탈락',
      };
    }

    const pi34 = createMatchup(
      'PI1_NBL34',
      1,
      'NBL 시딩 퀄리파이어 (3·4위전)',
      1,
      1,
      standings[2],
      standings[3],
      career.team.id,
      undefined,
      { isPlayIn: true, playInSlot: '3v4' }
    );
    const pi56 = createMatchup(
      'PI1_NBL56',
      1,
      'NBL 플레이인 퀄리파이어 (5·6위전)',
      1,
      1,
      standings[4],
      standings[5],
      career.team.id,
      undefined,
      { isPlayIn: true, playInSlot: '5v6' }
    );

    if (playerStanding.playInQualified) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 2,
        currentRound: 1,
        stageType: 'PLAY_IN_ROUND_1',
        rounds: [[pi34, pi56]],
        playerEliminated: false,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'NBL 플레이인 진출',
      };
    }

    const res34 = simulateSingleSeries(pi34, career, rng, false);
    const res56 = simulateSingleSeries(pi56, career, rng, false);
    const resDec = simulateSingleSeries(
      createMatchup(
        'PI2_NBL4',
        2,
        'NBL 플레이인 4시드 최종전',
        1,
        1,
        getLoserEntry(res34),
        getWinnerEntry(res56),
        career.team.id,
        undefined,
        { isPlayIn: true, playInSlot: 'DECIDER' }
      ),
      career,
      rng,
      false
    );
    const seed3 = getWinnerEntry(res34);
    const seed4 = getWinnerEntry(resDec);

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds: 2,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      playInSeeds: { seed3, seed4 },
      rounds: [
        buildNblMainRound1(
          standings[0],
          standings[1],
          seed3,
          seed4,
          career.team.id
        ),
      ],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: 'NBL 세미파이널 직행',
    };
  }

  // 4) G리그 (31팀): 동부 6팀 + 서부 6팀 = 12팀 (1~2시드 1R 부전승, 컨퍼런스 단판 BO1 -> 파이널 BO3)
  if (career.league === 'GLEAGUE') {
    const eastTop6 = standings
      .filter((s) => s.team.conference === 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 6);
    const westTop6 = standings
      .filter((s) => s.team.conference !== 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 6);

    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if (!playerQualified || eastTop6.length < 6 || westTop6.length < 6) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 4,
        currentRound: 1,
        stageType: 'MAIN_PLAYOFF',
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'PO 탈락',
      };
    }

    const r1Cfg = getSeriesConfig('GLEAGUE', 1, 4);
    // East 4v5, East 3v6, West 4v5, West 3v6 (1·2시드 부전승)
    const round1Series: PlayoffSeriesMatchup[] = [
      createMatchup(
        'R1_E1',
        1,
        `동부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        eastTop6[3],
        eastTop6[4],
        career.team.id,
        'EAST'
      ),
      createMatchup(
        'R1_E2',
        1,
        `동부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        eastTop6[2],
        eastTop6[5],
        career.team.id,
        'EAST'
      ),
      createMatchup(
        'R1_W1',
        1,
        `서부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        westTop6[3],
        westTop6[4],
        career.team.id,
        'WEST'
      ),
      createMatchup(
        'R1_W2',
        1,
        `서부 ${r1Cfg.roundLabel}`,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        westTop6[2],
        westTop6[5],
        career.team.id,
        'WEST'
      ),
    ];

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds: 4,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      rounds: [round1Series],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: 'G리그 플레이오프 진출',
    };
  }

  // 5) NCAA (32팀): 16강 단판 토너먼트 (Sweet 16 -> Elite 8 -> Final Four -> Championship, 4라운드)
  if (career.league === 'NCAA') {
    const qualified = standings.slice(0, 16);
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if (!playerQualified || qualified.length < 16) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds: 4,
        currentRound: 1,
        stageType: 'MAIN_PLAYOFF',
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: '토너먼트 탈락',
      };
    }

    const r1Cfg = getSeriesConfig('NCAA', 1, 4);
    const pairs: [StandingEntry, StandingEntry][] = [
      [qualified[0], qualified[15]],
      [qualified[7], qualified[8]],
      [qualified[4], qualified[11]],
      [qualified[3], qualified[12]],
      [qualified[1], qualified[14]],
      [qualified[6], qualified[9]],
      [qualified[5], qualified[10]],
      [qualified[2], qualified[13]],
    ];
    const round1Series = pairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_S${i + 1}`,
        1,
        r1Cfg.roundLabel,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        career.team.id,
        i < 4 ? 'EAST' : 'WEST'
      )
    );

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds: 4,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      rounds: [round1Series],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: 'NCAA 16강 토너먼트 진출',
    };
  }

  // 6) B.리그 (동부2+서부2+와일드카드4 = 8강 BO3), U-리그 (8강 BO1), 고교 (8강 BO1), KBL (6강 BO5)
  const qualified =
    career.league === 'B_LEAGUE'
      ? standings.filter((s) => s.qualifiedPlayoffs).slice(0, 8)
      : standings.slice(
          0,
          getPlayoffCutoffByLeague(career.league, standings.length)
        );
  const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
  const totalRounds = qualified.length <= 4 ? 2 : 3;

  if (!playerQualified || qualified.length < 2) {
    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds,
      currentRound: 1,
      stageType: 'MAIN_PLAYOFF',
      rounds: [],
      playerEliminated: true,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: 'PO 탈락',
    };
  }

  const r1Cfg = getSeriesConfig(career.league, 1, totalRounds);
  let round1Series: PlayoffSeriesMatchup[] = [];

  if (qualified.length >= 8) {
    const pairs: [StandingEntry, StandingEntry][] = [
      [qualified[0], qualified[7]],
      [qualified[3], qualified[4]],
      [qualified[1], qualified[6]],
      [qualified[2], qualified[5]],
    ];
    round1Series = pairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_S${i + 1}`,
        1,
        r1Cfg.roundLabel,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        career.team.id
      )
    );
  } else if (qualified.length >= 6) {
    const pairs: [StandingEntry, StandingEntry][] = [
      [qualified[3], qualified[4]],
      [qualified[2], qualified[5]],
    ];
    round1Series = pairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_S${i + 1}`,
        1,
        r1Cfg.roundLabel,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        career.team.id
      )
    );
  } else {
    const pairs: [StandingEntry, StandingEntry][] = [
      [qualified[0], qualified[Math.min(3, qualified.length - 1)]],
      [qualified[1], qualified[Math.min(2, qualified.length - 1)]],
    ];
    round1Series = pairs.map(([hi, lo], i) =>
      createMatchup(
        `R1_S${i + 1}`,
        1,
        r1Cfg.roundLabel,
        r1Cfg.bestOf,
        r1Cfg.winsNeeded,
        hi,
        lo,
        career.team.id
      )
    );
  }

  return {
    league: career.league,
    year: career.seasonYear,
    totalRounds,
    currentRound: 1,
    stageType: 'MAIN_PLAYOFF',
    rounds: [round1Series],
    playerEliminated: false,
    playerReachedFinals: false,
    championTeamId: null,
    playoffResultLabel: '플레이오프 진출',
  };
}

function simulateSingleSeries(
  series: PlayoffSeriesMatchup,
  career: CareerState,
  rng: () => number,
  pauseAtGame7: boolean = false
): PlayoffSeriesMatchup {
  if (series.winnerId) return series;

  const ovr = calculateOvr(career.stats, career.primaryPos, career.heightCm);
  const leagueMean = getLeagueBaselineTeamRating(
    career.league,
    career.teamRatingsMap
  );
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER')
    ? 1.8
    : 0;

  // 플레이어 보너스: 에이스면 시리즈 전력 상승, 벤치/신인이면 기본 구단 전력 유지(-1.0 하한), 물리 미스매치 시 감점
  const rawBonus = (ovr - leagueMean) * 0.35 + clutchBonus;
  const playerBonus =
    (rawBonus >= 0 ? clamp(rawBonus, 0, 8.5) : Math.max(-1.0, rawBonus * 0.25)) -
    bio.positionalPhysicsStrain * 4.5;

  const hiEffective =
    series.higherSeed.team.rating +
    1.0 +
    (series.higherSeed.team.id === career.team.id ? playerBonus : 0);
  const loEffective =
    series.lowerSeed.team.rating +
    (series.lowerSeed.team.id === career.team.id ? playerBonus : 0);

  const hiWinProb = clamp(0.5 + (hiEffective - loEffective) * 0.024, 0.24, 0.78);

  let hiWins = series.higherSeedWins;
  let loWins = series.lowerSeedWins;
  const logs: string[] = [...series.summaryLog];
  let gameNo = hiWins + loWins + 1;

  while (hiWins < series.winsNeeded && loWins < series.winsNeeded) {
    // 7전 4선승제 시리즈에서 실제로 3승 3패가 성사된 경우, 7차전 라이브 중계 진입을 위해 일시 정지
    if (
      pauseAtGame7 &&
      series.involvesPlayer &&
      series.bestOf === 7 &&
      hiWins === 3 &&
      loWins === 3
    ) {
      logs.push(
        `3승 3패 동률 — ${series.higherSeed.team.shortName} vs ${series.lowerSeed.team.shortName} 7차전 성사`
      );
      return {
        ...series,
        higherSeedWins: hiWins,
        lowerSeedWins: loWins,
        winnerId: null,
        summaryLog: logs,
      };
    }

    const hiWonGame = rng() < hiWinProb;
    if (hiWonGame) {
      hiWins++;
    } else {
      loWins++;
    }
    const gWinner = hiWonGame ? series.higherSeed.team : series.lowerSeed.team;
    logs.push(
      `${gameNo}차전: ${gWinner.shortName} 승리 (시리즈 ${hiWins}-${loWins})`
    );
    gameNo++;
  }

  const winner = hiWins > loWins ? series.higherSeed : series.lowerSeed;
  const loser = hiWins > loWins ? series.lowerSeed : series.higherSeed;
  const scoreLabel =
    series.winsNeeded === 1
      ? '단판 승리'
      : `${Math.max(hiWins, loWins)}승 ${Math.min(hiWins, loWins)}패`;

  logs.push(
    `${winner.team.name}, ${loser.team.shortName}에 ${scoreLabel}로 다음 라운드 진출`
  );

  return {
    ...series,
    higherSeedWins: hiWins,
    lowerSeedWins: loWins,
    winnerId: winner.team.id,
    summaryLog: logs,
  };
}

function getEliminationLabel(
  league: LeagueId,
  roundNumber: number,
  totalRounds: number
): string {
  if (league === 'EUROLEAGUE') {
    if (roundNumber === totalRounds) return '유로리그 파이널 포 준우승';
    return roundNumber === 1 ? '유로리그 8강 PO 탈락' : '유로리그 파이널 포 4강 탈락';
  }
  if (league === 'B_LEAGUE') {
    if (roundNumber === totalRounds) return 'B.리그 파이널 준우승';
    return roundNumber === 1 ? 'B.리그 8강 PO 탈락' : 'B.리그 4강 PO 탈락';
  }
  if (league === 'NBL') {
    if (roundNumber === totalRounds) return 'NBL 챔피언십 준우승';
    return 'NBL 4강 탈락';
  }
  if (league === 'NCAA') {
    if (roundNumber === totalRounds) return 'NCAA 전국 준우승';
    if (roundNumber === 1) return 'NCAA 16강 탈락';
    if (roundNumber === 2) return 'NCAA 8강 탈락';
    return 'NCAA 4강(Final Four) 탈락';
  }
  if (league === 'U_LEAGUE' || league === 'HIGH_SCHOOL') {
    if (roundNumber === totalRounds) return '전국 결승 준우승';
    return roundNumber === 1 ? '8강 토너먼트 탈락' : '4강 토너먼트 탈락';
  }
  if (league === 'GLEAGUE') {
    if (roundNumber === totalRounds) return 'G리그 파이널 준우승';
    if (roundNumber === 1) return 'G리그 컨퍼런스 1R 탈락';
    if (roundNumber === 2) return 'G리그 컨퍼런스 4강 탈락';
    return 'G리그 컨퍼런스 파이널 탈락';
  }
  if (roundNumber === totalRounds) return '파이널 준우승';
  if (league === 'NBA') {
    if (roundNumber === 1) return '컨퍼런스 1R(8강) 탈락';
    if (roundNumber === 2) return '컨퍼런스 4강 탈락';
    return '컨퍼런스 파이널 탈락';
  }
  if (league === 'KBL') {
    return roundNumber === 1 ? '6강 PO 탈락' : '4강 PO 탈락';
  }
  return '4강 PO 탈락';
}

/**
 * 파이널 MVP 수상 자격 판정 (연속 공헌도 비교 모델)
 * ① 플레이어 소속팀이 최종 우승(won === true)
 * ② 출전 비중 가중치(mpg 연속 스케일)와 실전 임팩트(또는 라이브 결승 게임스코어)가 팀 내 에이스 기준선을 상회
 */
export function evaluateRealisticFinalsMvp(
  career: CareerState,
  wonChampionship: boolean,
  finalsGameScore?: number
): boolean {
  if (!wonChampionship) return false;
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];
  const mpg = latestLog ? latestLog.mpg : 26;
  const ovr = Math.max(
    career.ovr || 0,
    calculateOvr(career.stats, career.primaryPos, career.heightCm)
  );
  const teamRating = career.teamRatingsMap?.[career.team.id] ?? career.team.rating;
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  // 연속적 출전 비중 계수 (15분 이하 벤치 멤버는 자연스럽게 기준선 미달, 22~36분 구간 부드럽게 증가)
  const minuteShareFactor = clamp((mpg - 14.0) / 14.0, 0.0, 1.15);
  if (minuteShareFactor <= 0.35) return false;

  const strainPenalty = bio.positionalPhysicsStrain * 14.0;
  const teamGapAdjust = clamp((ovr - teamRating) * 0.85, -8.0, 10.0);

  if (typeof finalsGameScore === 'number') {
    const effectiveGameImpact =
      finalsGameScore * clamp(0.7 + minuteShareFactor * 0.3, 0.7, 1.05) +
      teamGapAdjust -
      strainPenalty;
    const teamAceGameBenchmark = Math.max(31.0, 27.5 + (teamRating - 62) * 1.12);
    return effectiveGameImpact >= teamAceGameBenchmark;
  }

  const seasonImpact = latestLog
    ? latestLog.ppg * 1.15 +
      latestLog.rpg * 0.75 +
      latestLog.apg * 1.1 +
      (latestLog.spg + latestLog.bpg) * 1.6
    : ovr * 0.35;
  const effectiveSeasonImpact =
    seasonImpact * clamp(0.65 + minuteShareFactor * 0.35, 0.65, 1.05) +
    teamGapAdjust -
    strainPenalty;
  const teamAceSeasonBenchmark = Math.max(22.0, 14.0 + (teamRating - 58) * 0.76);

  return effectiveSeasonImpact >= teamAceSeasonBenchmark;
}

/**
 * 플레이인 단계(PLAY_IN_ROUND_1 -> PLAY_IN_DECIDER -> MAIN_PLAYOFF) 전용 진행 처리기
 */
function advancePlayInStage(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number
): PlayoffBracketState {
  const rIdx = bracket.currentRound - 1;
  const currentSeriesList = bracket.rounds[rIdx] || [];
  const resolved = currentSeriesList.map((s) =>
    simulateSingleSeries(s, career, rng, false)
  );
  const updatedRounds = [...bracket.rounds];
  updatedRounds[rIdx] = resolved;

  const playerMatch = resolved.find((s) => s.involvesPlayer);
  let playerEliminated = bracket.playerEliminated;
  let playoffResultLabel = bracket.playoffResultLabel;

  // Stage 1: PLAY_IN_ROUND_1 -> PLAY_IN_DECIDER (또는 7시드/3시드 직행 시 본선 자동 진입)
  if (bracket.stageType === 'PLAY_IN_ROUND_1') {
    if (bracket.league === 'NBA') {
      const e78 = resolved.find((m) => m.id === 'PI1_E78') || resolved[0];
      const e910 = resolved.find((m) => m.id === 'PI1_E910') || resolved[1];
      const w78 = resolved.find((m) => m.id === 'PI1_W78') || resolved[2];
      const w910 = resolved.find((m) => m.id === 'PI1_W910') || resolved[3];

      const east7 = getWinnerEntry(e78);
      const west7 = getWinnerEntry(w78);

      const eDecider = createMatchup(
        'PI2_E8',
        2,
        '동부 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(e78),
        getWinnerEntry(e910),
        career.team.id,
        'EAST',
        { isPlayIn: true, playInSlot: 'DECIDER' }
      );
      const wDecider = createMatchup(
        'PI2_W8',
        2,
        '서부 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(w78),
        getWinnerEntry(w910),
        career.team.id,
        'WEST',
        { isPlayIn: true, playInSlot: 'DECIDER' }
      );

      if (
        playerMatch &&
        playerMatch.playInSlot === '9v10' &&
        playerMatch.winnerId !== career.team.id
      ) {
        playerEliminated = true;
        playoffResultLabel = '플레이인 1R 탈락';
      } else if (
        playerMatch &&
        playerMatch.playInSlot === '7v8' &&
        playerMatch.winnerId === career.team.id
      ) {
        // 플레이어가 7·8위전 승리로 7시드 직행 확정 -> 최종전 자동 해결 후 본선 1R 즉시 진입
        const resEDec = simulateSingleSeries(eDecider, career, rng, false);
        const resWDec = simulateSingleSeries(wDecider, career, rng, false);
        const east8 = getWinnerEntry(resEDec);
        const west8 = getWinnerEntry(resWDec);
        const eastTop6 = standings
          .filter((s) => s.team.conference === 'EAST')
          .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
          .slice(0, 6);
        const westTop6 = standings
          .filter((s) => s.team.conference !== 'EAST')
          .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
          .slice(0, 6);
        return {
          ...bracket,
          stageType: 'MAIN_PLAYOFF',
          totalRounds: 4,
          currentRound: 1,
          playInSeeds: { east7, east8, west7, west8 },
          rounds: [
            buildNbaMainRound1(
              eastTop6,
              westTop6,
              east7,
              east8,
              west7,
              west8,
              career.team.id
            ),
          ],
          playerEliminated: false,
          playoffResultLabel: '플레이인 돌파 · 7시드 PO 진출',
        };
      }

      updatedRounds.push([eDecider, wDecider]);
      return {
        ...bracket,
        stageType: 'PLAY_IN_DECIDER',
        currentRound: 2,
        playInSeeds: { east7, west7 },
        rounds: updatedRounds,
        playerEliminated,
        playoffResultLabel: playerEliminated
          ? playoffResultLabel
          : '플레이인 8시드 최종전 진출',
      };
    }

    if (bracket.league === 'EUROLEAGUE') {
      const m78 = resolved.find((m) => m.playInSlot === '7v8') || resolved[0];
      const m910 = resolved.find((m) => m.playInSlot === '9v10') || resolved[1];
      const seed7 = getWinnerEntry(m78);
      const decider = createMatchup(
        'PI2_EL8',
        2,
        '유로리그 플레이인 8시드 최종전',
        1,
        1,
        getLoserEntry(m78),
        getWinnerEntry(m910),
        career.team.id,
        undefined,
        { isPlayIn: true, playInSlot: 'DECIDER' }
      );

      if (
        playerMatch &&
        playerMatch.playInSlot === '9v10' &&
        playerMatch.winnerId !== career.team.id
      ) {
        playerEliminated = true;
        playoffResultLabel = '유로리그 플레이인 1R 탈락';
      } else if (
        playerMatch &&
        playerMatch.playInSlot === '7v8' &&
        playerMatch.winnerId === career.team.id
      ) {
        const resDec = simulateSingleSeries(decider, career, rng, false);
        const seed8 = getWinnerEntry(resDec);
        return {
          ...bracket,
          stageType: 'MAIN_PLAYOFF',
          totalRounds: 3,
          currentRound: 1,
          playInSeeds: { seed7, seed8 },
          rounds: [
            buildEuroleagueMainRound1(
              standings.slice(0, 6),
              seed7,
              seed8,
              career.team.id
            ),
          ],
          playerEliminated: false,
          playoffResultLabel: '유로리그 7시드 8강 진출',
        };
      }

      updatedRounds.push([decider]);
      return {
        ...bracket,
        stageType: 'PLAY_IN_DECIDER',
        currentRound: 2,
        playInSeeds: { seed7 },
        rounds: updatedRounds,
        playerEliminated,
        playoffResultLabel: playerEliminated
          ? playoffResultLabel
          : '유로리그 플레이인 최종전',
      };
    }

    // NBL PLAY_IN_ROUND_1
    const m34 = resolved.find((m) => m.playInSlot === '3v4') || resolved[0];
    const m56 = resolved.find((m) => m.playInSlot === '5v6') || resolved[1];
    const seed3 = getWinnerEntry(m34);
    const decider = createMatchup(
      'PI2_NBL4',
      2,
      'NBL 플레이인 4시드 최종전',
      1,
      1,
      getLoserEntry(m34),
      getWinnerEntry(m56),
      career.team.id,
      undefined,
      { isPlayIn: true, playInSlot: 'DECIDER' }
    );

    if (
      playerMatch &&
      playerMatch.playInSlot === '5v6' &&
      playerMatch.winnerId !== career.team.id
    ) {
      playerEliminated = true;
      playoffResultLabel = 'NBL 플레이인 1R 탈락';
    } else if (
      playerMatch &&
      playerMatch.playInSlot === '3v4' &&
      playerMatch.winnerId === career.team.id
    ) {
      const resDec = simulateSingleSeries(decider, career, rng, false);
      const seed4 = getWinnerEntry(resDec);
      return {
        ...bracket,
        stageType: 'MAIN_PLAYOFF',
        totalRounds: 2,
        currentRound: 1,
        playInSeeds: { seed3, seed4 },
        rounds: [
          buildNblMainRound1(
            standings[0],
            standings[1],
            seed3,
            seed4,
            career.team.id
          ),
        ],
        playerEliminated: false,
        playoffResultLabel: 'NBL 3시드 4강 진출',
      };
    }

    updatedRounds.push([decider]);
    return {
      ...bracket,
      stageType: 'PLAY_IN_DECIDER',
      currentRound: 2,
      playInSeeds: { seed3 },
      rounds: updatedRounds,
      playerEliminated,
      playoffResultLabel: playerEliminated
        ? playoffResultLabel
        : 'NBL 플레이인 최종전',
    };
  }

  // Stage 2: PLAY_IN_DECIDER -> MAIN_PLAYOFF
  if (playerMatch && playerMatch.winnerId !== career.team.id) {
    playerEliminated = true;
    playoffResultLabel =
      bracket.league === 'EUROLEAGUE'
        ? '유로리그 플레이인 최종전 탈락'
        : bracket.league === 'NBL'
        ? 'NBL 플레이인 최종전 탈락'
        : '플레이인 최종전 탈락';
  }

  if (bracket.league === 'NBA') {
    const eastTop6 = standings
      .filter((s) => s.team.conference === 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 6);
    const westTop6 = standings
      .filter((s) => s.team.conference !== 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 6);
    const eDec = resolved.find((m) => m.conference === 'EAST') || resolved[0];
    const wDec = resolved.find((m) => m.conference === 'WEST') || resolved[1];
    const east7 = bracket.playInSeeds?.east7 || eastTop6[5];
    const west7 = bracket.playInSeeds?.west7 || westTop6[5];
    const east8 = getWinnerEntry(eDec);
    const west8 = getWinnerEntry(wDec);

    return {
      ...bracket,
      stageType: 'MAIN_PLAYOFF',
      totalRounds: 4,
      currentRound: 1,
      playInSeeds: { east7, east8, west7, west8 },
      rounds: [
        buildNbaMainRound1(
          eastTop6,
          westTop6,
          east7,
          east8,
          west7,
          west8,
          career.team.id
        ),
      ],
      playerEliminated,
      playoffResultLabel: playerEliminated
        ? playoffResultLabel
        : '플레이인 돌파 · 8시드 PO 진출',
    };
  }

  if (bracket.league === 'EUROLEAGUE') {
    const seed7 = bracket.playInSeeds?.seed7 || standings[6];
    const seed8 = getWinnerEntry(resolved[0]);
    return {
      ...bracket,
      stageType: 'MAIN_PLAYOFF',
      totalRounds: 3,
      currentRound: 1,
      playInSeeds: { seed7, seed8 },
      rounds: [
        buildEuroleagueMainRound1(
          standings.slice(0, 6),
          seed7,
          seed8,
          career.team.id
        ),
      ],
      playerEliminated,
      playoffResultLabel: playerEliminated
        ? playoffResultLabel
        : '유로리그 8시드 8강 진출',
    };
  }

  // NBL PLAY_IN_DECIDER -> MAIN_PLAYOFF (SF BO3)
  const seed3 = bracket.playInSeeds?.seed3 || standings[2];
  const seed4 = getWinnerEntry(resolved[0]);
  return {
    ...bracket,
    stageType: 'MAIN_PLAYOFF',
    totalRounds: 2,
    currentRound: 1,
    playInSeeds: { seed3, seed4 },
    rounds: [
      buildNblMainRound1(
        standings[0],
        standings[1],
        seed3,
        seed4,
        career.team.id
      ),
    ],
    playerEliminated,
    playoffResultLabel: playerEliminated
      ? playoffResultLabel
      : 'NBL 4시드 4강 진출',
  };
}

/**
 * 현재 라운드의 플레이오프(또는 플레이인) 시리즈를 진행하고 다음 라운드 대진을 구성합니다.
 */
export function advancePlayoffRound(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number = Math.random,
  forceSimulateFinals: boolean = false
): PlayoffBracketState {
  if (bracket.championTeamId || bracket.rounds.length === 0) {
    return bracket;
  }

  // 플레이인 단계(NBA / 유로리그 / NBL) 전용 처리
  if (
    bracket.stageType === 'PLAY_IN_ROUND_1' ||
    bracket.stageType === 'PLAY_IN_DECIDER'
  ) {
    return advancePlayInStage(bracket, career, standings, rng);
  }

  const currentRoundIdx = bracket.currentRound;
  const currentSeriesList = bracket.rounds[currentRoundIdx - 1];
  if (!currentSeriesList) return bracket;

  const playerInCurrentRound = currentSeriesList.some((s) => s.involvesPlayer);
  if (
    currentRoundIdx === bracket.totalRounds &&
    playerInCurrentRound &&
    !forceSimulateFinals &&
    currentSeriesList.every((s) => !s.winnerId)
  ) {
    return {
      ...bracket,
      playerReachedFinals: true,
      pendingConfFinalsGame7: false,
    };
  }

  // NBA 컨퍼런스 파이널(3라운드)에서 플레이어가 포함되고 스킵이 아니면, 실제 3승 3패 도달 시 7차전 라이브 중계 진입을 위해 일시 정지
  const isNbaConfFinals =
    bracket.league === 'NBA' &&
    currentRoundIdx === 3 &&
    playerInCurrentRound &&
    !forceSimulateFinals &&
    !bracket.pendingConfFinalsGame7;

  const resolvedSeries = currentSeriesList.map((s) =>
    simulateSingleSeries(s, career, rng, isNbaConfFinals && s.involvesPlayer)
  );
  const updatedRounds = [...bracket.rounds];
  updatedRounds[currentRoundIdx - 1] = resolvedSeries;

  // 실제로 3승 3패 7차전이 성사되었다면 라운드를 넘기지 않고 7차전 라이브 중계 대기 상태로 반환
  const pausedGame7Series = resolvedSeries.find(
    (s) =>
      s.involvesPlayer &&
      !s.winnerId &&
      s.higherSeedWins === 3 &&
      s.lowerSeedWins === 3
  );
  if (pausedGame7Series) {
    return {
      ...bracket,
      rounds: updatedRounds,
      pendingConfFinalsGame7: true,
      playoffResultLabel: '컨퍼런스 파이널 7차전 (3승 3패)',
    };
  }

  const playerMatch = resolvedSeries.find((s) => s.involvesPlayer);
  let playerEliminated = bracket.playerEliminated;
  let playoffResultLabel = bracket.playoffResultLabel;

  if (playerMatch && playerMatch.winnerId !== career.team.id) {
    playerEliminated = true;
    playoffResultLabel = getEliminationLabel(
      bracket.league,
      currentRoundIdx,
      bracket.totalRounds
    );
  }

  if (currentRoundIdx >= bracket.totalRounds) {
    const finalMatch = resolvedSeries[0];
    const champEntry = getWinnerEntry(finalMatch);

    if (champEntry.team.id === career.team.id) {
      playoffResultLabel = '리그 우승';
      playerEliminated = false;
    }

    return {
      ...bracket,
      rounds: updatedRounds,
      championTeamId: champEntry.team.id,
      playerEliminated,
      playerReachedFinals:
        bracket.playerReachedFinals ||
        finalMatch.higherSeed.team.id === career.team.id ||
        finalMatch.lowerSeed.team.id === career.team.id,
      playoffResultLabel,
    };
  }

  const nextRoundIdx = currentRoundIdx + 1;
  const nextCfg = getSeriesConfig(
    bracket.league,
    nextRoundIdx,
    bracket.totalRounds
  );

  const winners = resolvedSeries.map((s) => getWinnerEntry(s));
  let nextSeriesList: PlayoffSeriesMatchup[] = [];

  if (bracket.league === 'NBA' || bracket.league === 'NCAA') {
    const isFinalsNext = nextRoundIdx === bracket.totalRounds;
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i];
      const b = winners[i + 1] || winners[i];
      const conf: 'EAST' | 'WEST' | 'FINALS' = isFinalsNext
        ? 'FINALS'
        : bracket.league === 'NBA'
        ? a.team.conference === 'EAST'
          ? 'EAST'
          : 'WEST'
        : i < winners.length / 2
        ? 'EAST'
        : 'WEST';
      const labelPrefix =
        bracket.league === 'NBA'
          ? conf === 'EAST'
            ? '동부 '
            : conf === 'WEST'
            ? '서부 '
            : ''
          : '';
      nextSeriesList.push(
        createMatchup(
          `R${nextRoundIdx}_S${Math.floor(i / 2) + 1}`,
          nextRoundIdx,
          `${labelPrefix}${nextCfg.roundLabel}`,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          a,
          b,
          career.team.id,
          conf
        )
      );
    }
  } else if (bracket.league === 'GLEAGUE') {
    if (currentRoundIdx === 1) {
      // 동·서부 1~2시드 부전승 합류 (E1 vs E(4v5), E2 vs E(3v6), W1 vs W(4v5), W2 vs W(3v6))
      const eastTop2 = standings
        .filter((s) => s.team.conference === 'EAST')
        .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
        .slice(0, 2);
      const westTop2 = standings
        .filter((s) => s.team.conference !== 'EAST')
        .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
        .slice(0, 2);

      nextSeriesList = [
        createMatchup(
          'R2_E1',
          2,
          `동부 ${nextCfg.roundLabel}`,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          eastTop2[0],
          winners[0],
          career.team.id,
          'EAST'
        ),
        createMatchup(
          'R2_E2',
          2,
          `동부 ${nextCfg.roundLabel}`,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          eastTop2[1],
          winners[1],
          career.team.id,
          'EAST'
        ),
        createMatchup(
          'R2_W1',
          2,
          `서부 ${nextCfg.roundLabel}`,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          westTop2[0],
          winners[2],
          career.team.id,
          'WEST'
        ),
        createMatchup(
          'R2_W2',
          2,
          `서부 ${nextCfg.roundLabel}`,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          westTop2[1],
          winners[3],
          career.team.id,
          'WEST'
        ),
      ];
    } else {
      const isFinalsNext = nextRoundIdx === bracket.totalRounds;
      for (let i = 0; i < winners.length; i += 2) {
        const a = winners[i];
        const b = winners[i + 1] || winners[i];
        const conf: 'EAST' | 'WEST' | 'FINALS' = isFinalsNext
          ? 'FINALS'
          : a.team.conference === 'EAST'
          ? 'EAST'
          : 'WEST';
        const labelPrefix =
          conf === 'EAST' ? '동부 ' : conf === 'WEST' ? '서부 ' : '';
        nextSeriesList.push(
          createMatchup(
            `R${nextRoundIdx}_S${Math.floor(i / 2) + 1}`,
            nextRoundIdx,
            `${labelPrefix}${nextCfg.roundLabel}`,
            nextCfg.bestOf,
            nextCfg.winsNeeded,
            a,
            b,
            career.team.id,
            conf
          )
        );
      }
    }
  } else if (
    bracket.league === 'KBL' &&
    currentRoundIdx === 1 &&
    standings.length >= 2
  ) {
    const seed1 = standings[0];
    const seed2 = standings[1];
    const w1 = winners[0];
    const w2 = winners[1] || winners[0];
    nextSeriesList = [
      createMatchup(
        `R${nextRoundIdx}_S1`,
        nextRoundIdx,
        nextCfg.roundLabel,
        nextCfg.bestOf,
        nextCfg.winsNeeded,
        seed1,
        w1,
        career.team.id
      ),
      createMatchup(
        `R${nextRoundIdx}_S2`,
        nextRoundIdx,
        nextCfg.roundLabel,
        nextCfg.bestOf,
        nextCfg.winsNeeded,
        seed2,
        w2,
        career.team.id
      ),
    ];
  } else {
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i];
      const b = winners[i + 1] || winners[i];
      nextSeriesList.push(
        createMatchup(
          `R${nextRoundIdx}_S${Math.floor(i / 2) + 1}`,
          nextRoundIdx,
          nextCfg.roundLabel,
          nextCfg.bestOf,
          nextCfg.winsNeeded,
          a,
          b,
          career.team.id
        )
      );
    }
  }

  updatedRounds.push(nextSeriesList);
  const playerReachedFinals =
    nextRoundIdx === bracket.totalRounds &&
    nextSeriesList.some((s) => s.involvesPlayer);

  return {
    ...bracket,
    currentRound: nextRoundIdx,
    rounds: updatedRounds,
    playerEliminated,
    playerReachedFinals,
    pendingConfFinalsGame7: false,
    playoffResultLabel,
  };
}

/**
 * 컨퍼런스 파이널 7차전 실시간 중계 결과를 브래킷에 반영합니다.
 * - 승리 시 우승이 아니라 다음 라운드(NBA 파이널) 진출로 이어집니다!
 * - 패배 시 컨퍼런스 파이널 탈락 처리 후 반대편 승자와 상대 팀의 파이널을 마무리합니다.
 */
export function resolveConfFinalsGame7InBracket(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  playerWon: boolean,
  gameScoreLine: string,
  rng: () => number = Math.random
): PlayoffBracketState {
  const rIdx = bracket.currentRound - 1;
  const currentSeriesList = bracket.rounds[rIdx];
  if (!currentSeriesList) return bracket;

  const updatedSeriesList = currentSeriesList.map((s) => {
    if (!s.involvesPlayer) {
      return s.winnerId ? s : simulateSingleSeries(s, career, rng, false);
    }
    const playerIsHigher = s.higherSeed.team.id === career.team.id;
    const winnerId = playerWon
      ? career.team.id
      : playerIsHigher
      ? s.lowerSeed.team.id
      : s.higherSeed.team.id;
    const hiWins =
      winnerId === s.higherSeed.team.id
        ? s.winsNeeded
        : Math.max(s.higherSeedWins, 3);
    const loWins =
      winnerId === s.lowerSeed.team.id
        ? s.winsNeeded
        : Math.max(s.lowerSeedWins, 3);
    const winnerName =
      winnerId === s.higherSeed.team.id
        ? s.higherSeed.team.name
        : s.lowerSeed.team.name;
    return {
      ...s,
      higherSeedWins: hiWins,
      lowerSeedWins: loWins,
      winnerId,
      summaryLog: [
        ...s.summaryLog,
        `7차전 실시간 중계 종료 (${gameScoreLine}): ${winnerName} 파이널 진출!`,
      ],
    };
  });

  const updatedRounds = [...bracket.rounds];
  updatedRounds[rIdx] = updatedSeriesList;

  const winners = updatedSeriesList.map((s) => getWinnerEntry(s));
  const nextRoundIdx = bracket.currentRound + 1;
  const nextCfg = getSeriesConfig(
    bracket.league,
    nextRoundIdx,
    bracket.totalRounds
  );
  const finalsMatch = createMatchup(
    `R${nextRoundIdx}_S1`,
    nextRoundIdx,
    nextCfg.roundLabel,
    nextCfg.bestOf,
    nextCfg.winsNeeded,
    winners[0],
    winners[1] || winners[0],
    career.team.id,
    'FINALS'
  );
  updatedRounds.push([finalsMatch]);

  const nextBracket: PlayoffBracketState = {
    ...bracket,
    currentRound: nextRoundIdx,
    rounds: updatedRounds,
    playerEliminated: !playerWon,
    playerReachedFinals: playerWon,
    pendingConfFinalsGame7: false,
    playoffResultLabel: playerWon ? 'NBA 파이널 진출' : '컨퍼런스 파이널 탈락',
  };

  // 플레이어가 컨퍼런스 파이널에서 탈락했다면 남은 NBA 파이널 우승팀까지 백그라운드로 확정
  if (!playerWon) {
    return skipEntirePlayoffs(nextBracket, career, standings, rng);
  }
  return nextBracket;
}

/**
 * 플레이오프 초반 라운드를 원클릭으로 일괄 시뮬레이션하여 피로도를 줄이고,
 * 탈락하거나 결승(또는 컨퍼런스 파이널)에 도달하면 멈춥니다.
 */
export function batchAdvanceEarlyPlayoffRounds(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number = Math.random
): PlayoffBracketState {
  let current = { ...bracket };
  let guard = 0;
  // 초반 라운드(결승 전 라운드들)를 일괄 진행하되, 플레이어가 탈락하거나 결승·컨파 7차전에 도달하면 즉시 정지
  while (
    !current.championTeamId &&
    !current.playerEliminated &&
    !current.playerReachedFinals &&
    !current.pendingConfFinalsGame7 &&
    current.rounds.length > 0 &&
    guard < 6
  ) {
    current = advancePlayoffRound(current, career, standings, rng, false);
    guard++;
    if (
      current.league === 'NBA' &&
      current.stageType === 'MAIN_PLAYOFF' &&
      current.currentRound === 3 &&
      !current.playerEliminated
    ) {
      break;
    }
  }
  return current;
}

/**
 * 플레이오프(플레이인 포함) 전체를 끝까지 즉시 시뮬레이션합니다.
 */
export function skipEntirePlayoffs(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number = Math.random
): PlayoffBracketState {
  let current = { ...bracket };
  let guard = 0;
  while (!current.championTeamId && current.rounds.length > 0 && guard < 12) {
    current = advancePlayoffRound(current, career, standings, rng, true);
    guard++;
  }
  return current;
}

export function isInternationalLiveGame(
  gameType: LiveGameState['gameType']
): boolean {
  return (
    gameType === 'ASIAN_GAMES_FINAL' ||
    gameType === 'INTERNATIONAL_FINAL' ||
    gameType === 'INTERNATIONAL_BRONZE'
  );
}

export function getLiveGameTournamentType(
  liveGame: Pick<LiveGameState, 'gameType' | 'internationalTournamentType'>
): InternationalTournamentType | null {
  if (liveGame.internationalTournamentType) {
    return liveGame.internationalTournamentType;
  }
  if (liveGame.gameType === 'ASIAN_GAMES_FINAL') {
    return 'ASIAN_GAMES';
  }
  return null;
}

/**
 * 대한민국 국가대표팀 실전 전력 산출 (선수 OVR·클러치 특성·신체 적합도 동적 반영)
 * - 아시안게임은 KBL 에이스(OVR 76+)가 팀을 견인해 결승 진출 및 우승을 충분히 노릴 수 있는 수준으로 조정
 */
export function calculateKoreaTeamEffectiveRating(
  career: CareerState,
  tournamentType: InternationalTournamentType = 'ASIAN_GAMES'
): number {
  const cfg = INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType];
  const ovr = calculateOvr(career.stats, career.primaryPos, career.heightCm);
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER') ? 2.5 : 0;
  const aceContribution = clamp(
    (ovr - 71) * cfg.aceRatingWeight + clutchBonus,
    -3.5,
    cfg.aceRatingMaxBonus
  );
  const rating =
    cfg.baseKorRating + aceContribution - bio.positionalPhysicsStrain * 3.8;
  return Number(clamp(rating, 69, 95).toFixed(1));
}

/**
 * 4년 주기 국제대회(FIBA 아시아컵·아시안게임·FIBA 월드컵·올림픽) 조별리그~4강 시뮬레이션
 * - 시드 기반 대진(8강 중하위 시드 -> 4강 중상위 시드 -> 결승 최상위 강호)으로 현실적인 토너먼트 곡선 구현
 * - 4강 승리 시 결승전(금/은메달 결정전), 4강 패배 시 3·4위전(동메달 결정전) 실시간 중계로 연결
 */
export function simulateInternationalTournament(
  career: CareerState,
  tournamentType: InternationalTournamentType,
  rng: () => number = Math.random
): InternationalTournamentResult {
  const cfg = INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType];
  const ovr = calculateOvr(career.stats, career.primaryPos, career.heightCm);
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const korEffectiveRating = calculateKoreaTeamEffectiveRating(
    career,
    tournamentType
  );

  const pool = [...getNationalTeamsForTournament(tournamentType)].sort(
    (a, b) => b.rating - a.rating
  );
  const topTier = pool.slice(0, Math.min(3, pool.length));
  const midTier = pool.slice(
    Math.min(3, pool.length),
    Math.min(6, pool.length)
  );
  const lowerTier = pool.slice(Math.min(6, pool.length));

  const shuffle = <T,>(arr: T[]): T[] =>
    [...arr].sort(() => rng() - 0.5);

  const shuffledTop = shuffle(topTier);
  const shuffledMid = shuffle(midTier.length > 0 ? midTier : topTier);
  const shuffledLower = shuffle(lowerTier.length > 0 ? lowerTier : shuffledMid);

  // 시드 배정: 8강(중하위), 4강(중상위), 결승(최상위 강호), 3·4위전(상위/중상위)
  const qfOpponent =
    shuffledLower[0] || shuffledMid[0] || pool[pool.length - 1];
  const sfOpponent =
    shuffledMid.find((t) => t.id !== qfOpponent.id) ||
    shuffledTop[1] ||
    pool[1];
  const finalOpponent =
    shuffledTop.find((t) => t.id !== sfOpponent.id && t.id !== qfOpponent.id) ||
    shuffledTop[0] ||
    pool[0];
  const bronzeOpponent =
    shuffledTop.find(
      (t) =>
        t.id !== finalOpponent.id &&
        t.id !== sfOpponent.id &&
        t.id !== qfOpponent.id
    ) ||
    shuffledMid.find((t) => t.id !== sfOpponent.id && t.id !== qfOpponent.id) ||
    finalOpponent;

  // 조별리그 3경기: 하위 1 + 중위 1 + 상위/중위 1 혼합
  const groupCandidates = shuffle(
    pool.filter((t) => t.id !== finalOpponent.id)
  );
  const groupOpponents = [
    shuffledLower[1] || shuffledLower[0] || groupCandidates[0],
    shuffledMid[1] || shuffledMid[0] || groupCandidates[1],
    groupCandidates.find(
      (t) =>
        t.id !== (shuffledLower[1] || shuffledLower[0])?.id &&
        t.id !== (shuffledMid[1] || shuffledMid[0])?.id
    ) || groupCandidates[2] || pool[0],
  ].filter(Boolean) as TeamInfo[];

  const matches: AsianGamesMatchLog[] = [];
  const winSlope = tournamentType === 'ASIAN_GAMES' ? 0.048 : 0.042;
  const baseWinBias = tournamentType === 'ASIAN_GAMES' ? 0.56 : 0.52;

  const playMatch = (
    stage: 'GROUP' | 'QUARTERFINAL' | 'SEMIFINAL',
    stageLabel: string,
    opp: TeamInfo
  ): AsianGamesMatchLog => {
    const winProb = clamp(
      baseWinBias + (korEffectiveRating - opp.rating) * winSlope,
      0.14,
      cfg.winProbCap
    );
    const won = rng() < winProb;
    const playerPts = Math.max(
      5,
      Math.round(
        14 +
          (ovr - cfg.ldr) * 0.58 -
          bio.positionalPhysicsStrain * 5.2 +
          (rng() * 8 - 4)
      )
    );
    const playerReb = Math.max(
      1,
      Math.round((4 + career.stats.reb / 20) * bio.rebMultiplier)
    );
    const playerAst = Math.max(
      1,
      Math.round(3 + career.stats.ply / 22 - bio.tovRatePenalty * 0.55)
    );

    const baseScore = 74 + Math.round(rng() * 14);
    const margin = Math.max(2, Math.round(2 + rng() * 12));
    const korScore = won ? baseScore + margin : baseScore - margin;
    const oppScore = baseScore;

    return {
      stage,
      stageLabel,
      opponentName: opp.shortName,
      korScore,
      oppScore,
      playerPts,
      playerReb,
      playerAst,
      won,
    };
  };

  // 1. 조별리그 3경기
  groupOpponents.slice(0, 3).forEach((opp, idx) => {
    matches.push(playMatch('GROUP', `조별리그 ${idx + 1}차전`, opp));
  });

  // 2. 8강 토너먼트
  const qfMatch = playMatch('QUARTERFINAL', '8강 토너먼트', qfOpponent);
  matches.push(qfMatch);
  if (!qfMatch.won) {
    return {
      tournamentType,
      tournamentName: cfg.name,
      reachedFinals: false,
      reachedBronzeMatch: false,
      eliminatedStage: 'QUARTERFINAL',
      finalOpponent,
      bronzeOpponent: null,
      korEffectiveRating,
      matches,
      summaryHeadline: `${cfg.shortName} 8강 탈락 — 대한민국, ${qfOpponent.shortName}에 ${qfMatch.korScore}-${qfMatch.oppScore} 패배`,
    };
  }

  // 3. 4강 준결승 토너먼트 (패배 시 3·4위전 동메달 결정전으로 이어짐)
  const sfMatch = playMatch('SEMIFINAL', '4강 준결승전', sfOpponent);
  matches.push(sfMatch);
  if (!sfMatch.won) {
    return {
      tournamentType,
      tournamentName: cfg.name,
      reachedFinals: false,
      reachedBronzeMatch: true,
      eliminatedStage: 'SEMIFINAL',
      finalOpponent,
      bronzeOpponent,
      korEffectiveRating,
      matches,
      summaryHeadline: `${cfg.shortName} 4강 석패 — ${sfOpponent.shortName}에 ${sfMatch.korScore}-${sfMatch.oppScore} 패배, ${bronzeOpponent.shortName}와 동메달 결정전`,
    };
  }

  return {
    tournamentType,
    tournamentName: cfg.name,
    reachedFinals: true,
    reachedBronzeMatch: false,
    eliminatedStage: null,
    finalOpponent,
    bronzeOpponent: null,
    korEffectiveRating,
    matches,
    summaryHeadline: `${cfg.shortName} 결승 진출 — ${qfOpponent.shortName}·${sfOpponent.shortName} 연파, ${finalOpponent.shortName}와 금메달 결정전`,
  };
}

/**
 * 아시안게임 남자농구 국가대표 토너먼트 시뮬레이션 (하위 호환 래퍼)
 */
export function simulateAsianGamesTournament(
  career: CareerState,
  rng: () => number = Math.random
): AsianGamesTournamentResult {
  const res = simulateInternationalTournament(career, 'ASIAN_GAMES', rng);
  return {
    reachedFinals: res.reachedFinals,
    eliminatedStage: res.eliminatedStage,
    finalOpponent: res.finalOpponent || ASIAN_NATIONAL_TEAMS[0],
    matches: res.matches,
    summaryHeadline: res.summaryHeadline,
  };
}

/**
 * 결승전(리그 파이널, 컨퍼런스 파이널 7차전, 국제대회 결승전/3·4위전) 실시간 쿼터별 중계 상태를 생성합니다.
 */
export function createLiveFinalGame(
  career: CareerState,
  opponentTeam: TeamInfo,
  gameType: LiveGameState['gameType'],
  options?: {
    tournamentType?: InternationalTournamentType;
    tournamentYear?: number;
    preMatches?: AsianGamesMatchLog[];
  }
): LiveGameState {
  const isInternational = isInternationalLiveGame(gameType);
  const tournamentType: InternationalTournamentType | undefined = isInternational
    ? options?.tournamentType ||
      (gameType === 'ASIAN_GAMES_FINAL' ? 'ASIAN_GAMES' : 'ASIA_CUP')
    : undefined;
  const tournamentYear: number | undefined = isInternational
    ? options?.tournamentYear ?? career.seasonYear
    : undefined;
  const tourneyCfg = tournamentType
    ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType]
    : null;

  const korRating = tournamentType
    ? Math.round(calculateKoreaTeamEffectiveRating(career, tournamentType))
    : 78;

  const playerTeam: TeamInfo = isInternational
    ? {
        id: 'KOR_NAT_TEAM',
        name: '대한민국 남자농구 국가대표팀',
        shortName: '대한민국',
        city: '서울',
        league: career.league,
        rating: korRating,
        primaryColor: '#0047A0',
        secondaryColor: '#CD2E3A',
        espnAbbr: 'KOR',
        logoUrl: '/logos/NAT_KOR.svg',
        prestigeDesc: `${
          tourneyCfg?.name || '국제대회'
        } 본선 무대에 출전한 대한민국 남자농구 국가대표팀입니다.`,
        direction: 'CONTENDER',
      }
    : career.team;

  const isBronzeMatch = gameType === 'INTERNATIONAL_BRONZE';
  const displayYear = tournamentYear ?? career.seasonYear;
  const showExemptionFinalTag =
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    ((tournamentType === 'ASIAN_GAMES' && !isBronzeMatch) ||
      tournamentType === 'OLYMPICS');
  const title = isInternational
    ? isBronzeMatch
      ? `${displayYear} ${tourneyCfg?.name || '국제대회'} 3·4위전 (동메달 결정전${
          showExemptionFinalTag ? ' · 병역특례' : ''
        })`
      : `${displayYear} ${tourneyCfg?.name || '국제대회'} 결승전${
          showExemptionFinalTag ? ' (병역특례 결정전)' : ''
        }`
    : gameType === 'CONF_FINALS_GAME7'
    ? `${LEAGUE_CONFIG[career.league].shortName} 컨퍼런스 파이널 7차전`
    : `${LEAGUE_CONFIG[career.league].shortName} 챔피언십 파이널 최종전`;

  const foulLimit = isInternational
    ? LIVE_GAME_CONFIG.asianGamesFoulLimit
    : LEAGUE_BALANCE_META[career.league].foulLimit;
  const initialStamina = clamp(
    Math.round(84 + ((career.stats?.phy ?? 65) - 65) * 0.45),
    78,
    100
  );

  return {
    gameType,
    internationalTournamentType: tournamentType,
    internationalTournamentName: tourneyCfg?.name,
    internationalTournamentYear: tournamentYear,
    internationalPreMatches: options?.preMatches,
    title,
    subtitle: `${playerTeam.name} vs ${opponentTeam.name}`,
    playerTeam,
    opponentTeam,
    quarter: 0,
    isFinished: false,
    teamScore: 0,
    oppScore: 0,
    currentTactic: 'UNSELFISH_PASS',
    momentum: 'NEUTRAL',
    foulLimit,
    fouledOut: false,
    overtimeCount: 0,
    pendingClutchPossession: false,
    clutchPossessionResolved: false,
    clutchConvertedInGame: false,
    playerStats: {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      fouls: 0,
      stamina: initialStamina,
    },
    quarterLogs: [],
  };
}

function buildFinalOutcome(
  liveGame: LiveGameState,
  career: CareerState,
  teamScore: number,
  oppScore: number,
  playerStats: LiveGameState['playerStats'],
  customClutchNote?: string
): NonNullable<LiveGameState['finalOutcome']> {
  const won = teamScore > oppScore;
  const gameScore =
    playerStats.pts +
    playerStats.reb * 1.2 +
    playerStats.ast * 1.5 +
    (playerStats.stl + playerStats.blk) * 2;
  const wonFinalsMvp =
    liveGame.gameType === 'LEAGUE_FINALS' &&
    evaluateRealisticFinalsMvp(career, won, gameScore);

  const isInternational = isInternationalLiveGame(liveGame.gameType);
  const tournamentType = getLiveGameTournamentType(liveGame);
  const tourneyCfg = tournamentType
    ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType]
    : null;
  const isBronzeMatch = liveGame.gameType === 'INTERNATIONAL_BRONZE';

  let medal: InternationalMedalType | undefined;
  if (isInternational) {
    if (isBronzeMatch) {
      medal = won ? 'BRONZE' : 'FOURTH';
    } else {
      medal = won ? 'GOLD' : 'SILVER';
    }
  }

  const wonTournamentMvp =
    isInternational && !isBronzeMatch && won && gameScore >= 24;

  const grantedMilitaryExemption = Boolean(
    isInternational &&
      tourneyCfg &&
      ((tourneyCfg.militaryExemptionMinMedal === 'GOLD' && medal === 'GOLD') ||
        (tourneyCfg.militaryExemptionMinMedal === 'BRONZE' &&
          (medal === 'GOLD' || medal === 'SILVER' || medal === 'BRONZE')))
  );

  let baseHeadline = '';
  if (isInternational && tourneyCfg) {
    const exemptionSuffix =
      grantedMilitaryExemption && !career.militaryExempt ? ' · 병역특례 획득' : '';
    const mvpSuffix = wonTournamentMvp ? ' · 대회 MVP' : '';
    if (isBronzeMatch) {
      baseHeadline = won
        ? `${tourneyCfg.shortName} 동메달 획득 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 승리 (${career.name} ${playerStats.pts}점${exemptionSuffix})`
        : `${tourneyCfg.shortName} 4위 마감 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 석패`;
    } else {
      baseHeadline = won
        ? `${tourneyCfg.shortName} 금메달 확정 — ${career.name} ${playerStats.pts}점 ${playerStats.reb}리바운드 ${playerStats.ast}도움${mvpSuffix}${exemptionSuffix}`
        : `${tourneyCfg.shortName} 은메달 — 대한민국, ${liveGame.opponentTeam.shortName}에 ${teamScore}-${oppScore} 석패${exemptionSuffix}`;
    }
  } else if (liveGame.gameType === 'CONF_FINALS_GAME7') {
    baseHeadline = won
      ? `컨퍼런스 파이널 7차전 승리 — ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name}에 ${teamScore}-${oppScore} 승리로 파이널 진출`
      : `컨퍼런스 파이널 7차전 패배 — ${liveGame.playerTeam.name}, ${teamScore}-${oppScore} 석패로 시즌 마감`;
  } else {
    baseHeadline = won
      ? `챔피언십 우승 — ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name} 제압 (${career.name} ${playerStats.pts}점${
          wonFinalsMvp ? ' · 파이널 MVP' : ''
        })`
      : `파이널 준우승 — ${liveGame.playerTeam.name}, 최종전 ${teamScore}-${oppScore} 석패`;
  }

  return {
    won,
    wonFinalsMvp,
    wonTournamentMvp,
    medal,
    grantedMilitaryExemption,
    clutchHeroSuccess: Boolean(liveGame.clutchConvertedInGame),
    headline: customClutchNote ? `${baseHeadline} · ${customClutchNote}` : baseHeadline,
  };
}

function splitPointsIntoBuckets(
  total: number,
  buckets: number,
  rng: () => number
): number[] {
  if (buckets <= 0) return [];
  if (total <= 0) return Array(buckets).fill(0);
  const weights = Array.from({ length: buckets }, () => 0.65 + rng() * 0.7);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const result = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - result.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (remainder > 0) {
    result[idx % buckets] += 1;
    remainder -= 1;
    idx += 1;
  }
  return result;
}

const THREE_PT_SPOTS: [number, number][] = [
  [11, 20], // 좌측 코너
  [89, 20], // 우측 코너
  [18, 52], // 좌측 윙
  [82, 52], // 우측 윙
  [50, 66], // 탑 오브 더 키
];

const TWO_PT_SPOTS: [number, number][] = [
  [44, 21], // 좌측 로우포스트
  [56, 21], // 우측 로우포스트
  [50, 26], // 페인트존 중앙
  [30, 38], // 좌측 엘보우 미드레인지
  [70, 38], // 우측 엘보우 미드레인지
];

function pickSpot(spots: [number, number][], rng: () => number): [number, number] {
  return spots[Math.floor(rng() * spots.length)] || spots[0];
}

interface DraftQuarterAction {
  actor: LiveCourtPlay['actor'];
  type: LiveCourtPlay['type'];
  showOnCourt: boolean;
  shotPoints: number; // 반드시 0, 1, 2, 3 중 하나
  courtBadge?: string;
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  dPts: number;
  dFgm: number;
  dFga: number;
  dTpm: number;
  dTpa: number;
  dAst: number;
  dStl: number;
  dBlk: number;
  dFoul: number;
  buildText: (clock: string, teamScoreAfter: number, oppScoreAfter: number) => string;
}

function buildQuarterClocks(
  count: number,
  isOvertime: boolean,
  triggerClutchPossession: boolean
): string[] {
  const endSec = triggerClutchPossession ? 18 : 8;
  const startSec = isOvertime ? 268 : 665;
  if (count <= 1) {
    const m = Math.floor(endSec / 60);
    const s = endSec % 60;
    return [`${m}:${s < 10 ? '0' : ''}${s}`];
  }
  const clocks: string[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1);
    const sec = Math.max(endSec, Math.round(startSec - (startSec - endSec) * ratio));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    clocks.push(`${m}:${s < 10 ? '0' : ''}${s}`);
  }
  return clocks;
}

function generateQuarterCourtPlays(params: {
  quarter: number;
  qLabel: string;
  isOvertime: boolean;
  playerName: string;
  playerTeamShort: string;
  oppTeamShort: string;
  startTeamScore: number;
  startOppScore: number;
  myQScore: number;
  oppQScore: number;
  qPts: number;
  qTpm: number;
  qTpa: number;
  qFgm: number;
  qFga: number;
  freeThrows: number;
  qReb: number;
  qAst: number;
  qStl: number;
  qBlk: number;
  addedFoul: number;
  fouledOutNow: boolean;
  isAlreadyFouledOut: boolean;
  foulLimit: number;
  triggerClutchPossession: boolean;
  prevPlayerStats: LivePlayerBoxSnapshot;
  updatedPlayerStats: LivePlayerBoxSnapshot;
  rng: () => number;
}): LiveCourtPlay[] {
  const {
    quarter,
    qLabel,
    isOvertime,
    playerName,
    playerTeamShort,
    oppTeamShort,
    startTeamScore,
    startOppScore,
    myQScore,
    oppQScore,
    qPts,
    qTpm,
    qTpa,
    qFgm,
    qFga,
    freeThrows,
    qReb,
    qAst,
    qStl,
    qBlk,
    addedFoul,
    fouledOutNow,
    isAlreadyFouledOut,
    foulLimit,
    triggerClutchPossession,
    prevPlayerStats,
    updatedPlayerStats,
    rng,
  } = params;

  const actions: DraftQuarterAction[] = [];
  let remainingTeamBudget = myQScore;

  if (!isAlreadyFouledOut) {
    const madeThrees = qTpm;
    const madeTwos = Math.max(0, qFgm - qTpm);
    const totalMisses = Math.max(0, qFga - qFgm);
    const missedThrees = Math.max(0, qTpa - qTpm);
    const missedTwos = Math.max(0, totalMisses - missedThrees);

    // 1) 내 선수 3점 성공 (실제 1포제션 +3)
    for (let i = 0; i < madeThrees; i++) {
      const [x, y] = pickSpot(THREE_PT_SPOTS, rng);
      const pts = Math.min(3, remainingTeamBudget);
      remainingTeamBudget -= pts;
      const spotLabel = x <= 20 || x >= 80 ? '코너 3점슛' : y >= 60 ? '탑 3점슛' : '윙 3점슛';
      actions.push({
        actor: 'PLAYER',
        type: 'THREE_MAKE',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x,
        y,
        dPts: 3,
        dFgm: 1,
        dFga: 1,
        dTpm: 1,
        dTpa: 1,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, ${spotLabel} 성공 (+${pts})`,
      });
    }

    // 2) 내 선수 2점 성공 (실제 1포제션 +2)
    for (let i = 0; i < madeTwos; i++) {
      const [x, y] = pickSpot(TWO_PT_SPOTS, rng);
      const pts = Math.min(2, remainingTeamBudget);
      remainingTeamBudget -= pts;
      const moveLabel = y <= 28 ? '페인트존 돌파 마무리' : '미드레인지 점퍼';
      actions.push({
        actor: 'PLAYER',
        type: 'TWO_MAKE',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x,
        y,
        dPts: 2,
        dFgm: 1,
        dFga: 1,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, ${moveLabel} 성공 (+${pts})`,
      });
    }

    // 3) 내 선수 자유투 (1~2점 단위)
    let remFt = freeThrows;
    while (remFt > 0) {
      const trip = remFt >= 2 ? 2 : 1;
      remFt -= trip;
      const pts = Math.min(trip, remainingTeamBudget);
      remainingTeamBudget -= pts;
      actions.push({
        actor: 'PLAYER',
        type: 'FT',
        showOnCourt: true,
        shotPoints: pts,
        courtBadge: `+${pts}`,
        x: 50,
        y: 38,
        dPts: trip,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) =>
          `${qLabel} ${clock} · ${playerName}, 자유투 ${trip === 2 ? '2구 모두 성공' : '성공'} (+${pts})`,
      });
    }

    // 4) 대표 야투 실패 (최대 2개 표시, 잔여 실패 시도는 마지막 실패 턴에 합산)
    const shownMissCount = Math.min(2, totalMisses);
    let remMiss3 = missedThrees;
    let remMiss2 = missedTwos;
    for (let i = 0; i < shownMissCount; i++) {
      const isLastMiss = i === shownMissCount - 1;
      const isThreeMiss = remMiss3 > 0;
      const [x, y] = isThreeMiss ? pickSpot(THREE_PT_SPOTS, rng) : pickSpot(TWO_PT_SPOTS, rng);
      const take3 = isLastMiss ? remMiss3 : isThreeMiss ? 1 : 0;
      const take2 = isLastMiss ? remMiss2 : isThreeMiss ? 0 : 1;
      remMiss3 -= take3;
      remMiss2 -= take2;
      actions.push({
        actor: 'PLAYER',
        type: 'MISS',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'MISS',
        x,
        y,
        dPts: 0,
        dFgm: 0,
        dFga: take3 + take2,
        dTpm: 0,
        dTpa: take3,
        dAst: 0,
        dStl: 0,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) =>
          isThreeMiss
            ? `${qLabel} ${clock} · ${playerName}, 외곽 3점 시도 림 외면`
            : `${qLabel} ${clock} · ${playerName}, 점퍼 시도 불발`,
      });
    }

    // 5) 어시스트 (최대 2턴 표시, 잔여 어시스트는 마지막 어시스트 턴에 합산)
    if (qAst > 0) {
      const shownAstCount = Math.min(2, qAst);
      let remAst = qAst;
      for (let i = 0; i < shownAstCount; i++) {
        const isLastAst = i === shownAstCount - 1;
        const takeAst = isLastAst ? remAst : 1;
        remAst -= takeAst;
        const canThree = remainingTeamBudget >= 3 && rng() < 0.45;
        const assistPts = canThree ? 3 : remainingTeamBudget >= 2 ? 2 : 0;
        remainingTeamBudget -= assistPts;
        const [toX, toY] = assistPts === 3 ? pickSpot(THREE_PT_SPOTS, rng) : pickSpot(TWO_PT_SPOTS, rng);
        actions.push({
          actor: 'PLAYER',
          type: 'ASSIST',
          showOnCourt: true,
          shotPoints: assistPts,
          courtBadge: assistPts > 0 ? `AST +${assistPts}` : 'AST',
          fromX: 50,
          fromY: 56,
          x: toX,
          y: toY,
          dPts: 0,
          dFgm: 0,
          dFga: 0,
          dTpm: 0,
          dTpa: 0,
          dAst: takeAst,
          dStl: 0,
          dBlk: 0,
          dFoul: 0,
          buildText: (clock) =>
            assistPts === 3
              ? `${qLabel} ${clock} · ${playerName} 킥아웃 어시스트, 동료 3점슛 성공 (+3)`
              : assistPts === 2
              ? `${qLabel} ${clock} · ${playerName} 어시스트, 동료 골밑 마무리 (+2)`
              : `${qLabel} ${clock} · ${playerName}, 수비를 흔드는 패스 전개`,
        });
      }
    }

    // 6) 블록 / 스틸 수비 하이라이트
    if (qBlk > 0) {
      actions.push({
        actor: 'PLAYER',
        type: 'BLOCK',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'BLK',
        x: 50,
        y: 22,
        dPts: 0,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: 0,
        dBlk: qBlk,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, 골밑 블록슛으로 상대 공격 저지`,
      });
    }
    if (qStl > 0) {
      actions.push({
        actor: 'PLAYER',
        type: 'STEAL',
        showOnCourt: true,
        shotPoints: 0,
        courtBadge: 'STL',
        x: 34,
        y: 46,
        dPts: 0,
        dFgm: 0,
        dFga: 0,
        dTpm: 0,
        dTpa: 0,
        dAst: 0,
        dStl: qStl,
        dBlk: 0,
        dFoul: 0,
        buildText: (clock) => `${qLabel} ${clock} · ${playerName}, 패스 길목을 끊는 스틸 성공`,
      });
    }
  }

  // 액션이 너무 많으면(10개 초과) 초반 액션 순서를 유지하며 적당히 섞고, 파울아웃은 말미에 배치
  for (let i = actions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [actions[i], actions[j]] = [actions[j], actions[i]];
  }

  // 파울 아웃 발생 시 말미 직전에 추가
  if (fouledOutNow && !isAlreadyFouledOut) {
    actions.push({
      actor: 'PLAYER',
      type: 'FOUL',
      showOnCourt: true,
      shotPoints: 0,
      courtBadge: 'FOUL',
      x: 50,
      y: 34,
      dPts: 0,
      dFgm: 0,
      dFga: 0,
      dTpm: 0,
      dTpa: 0,
      dAst: 0,
      dStl: 0,
      dBlk: 0,
      dFoul: addedFoul,
      buildText: (clock) =>
        `${qLabel} ${clock} · ${playerName} 개인 ${foulLimit}반칙 파울 아웃으로 코트 퇴장`,
    });
  } else if (addedFoul > 0 && actions.length > 0) {
    // 일반 파울은 중반 턴에 스탯 반영
    actions[Math.floor(actions.length / 2)].dFoul += addedFoul;
  }

  // 내 선수 포제션이 적거나 파울 아웃 상태일 때 팀/상대 전광판 흐름 턴 보강 (최소 5턴 확보)
  const makeTeamTick = (label: 'EARLY' | 'MID' | 'LATE'): DraftQuarterAction => ({
    actor: 'TEAMMATE',
    type: 'TEAM_TICK',
    showOnCourt: false,
    shotPoints: 0,
    x: 50,
    y: 50,
    dPts: 0,
    dFgm: 0,
    dFga: 0,
    dTpm: 0,
    dTpa: 0,
    dAst: 0,
    dStl: 0,
    dBlk: 0,
    dFoul: 0,
    buildText: (clock, ts, os) => {
      if (isAlreadyFouledOut) {
        return label === 'LATE'
          ? `${qLabel} ${clock} · 벤치에서 지켜본 ${qLabel} 종료 (${ts}:${os})`
          : `${qLabel} ${clock} · 양 팀 공방전 이어지며 스코어 ${ts}:${os}`;
      }
      if (label === 'LATE') {
        return triggerClutchPossession
          ? `${qLabel} ${clock} · ${ts}:${os} 접전, 마지막 포제션 돌입`
          : `${qLabel} ${clock} · ${qLabel} 종료 (${ts}:${os})`;
      }
      if (label === 'EARLY') {
        return `${qLabel} ${clock} · ${playerTeamShort}·${oppTeamShort} 초반 탐색전 (${ts}:${os})`;
      }
      return `${qLabel} ${clock} · 양 팀 로테이션 공방전 진행 (${ts}:${os})`;
    },
  });

  if (actions.length === 0) {
    actions.push(
      makeTeamTick('EARLY'),
      makeTeamTick('MID'),
      makeTeamTick('MID'),
      makeTeamTick('MID'),
      makeTeamTick('LATE')
    );
  } else {
    // 최소 4개 중간 턴을 유지하고 항상 쿼터 마무리 전광판 정산 턴 1개 추가
    while (actions.length < 4) {
      const insertAt = Math.min(actions.length, Math.max(1, Math.floor(actions.length / 2)));
      actions.splice(insertAt, 0, makeTeamTick('MID'));
    }
    actions.push(makeTeamTick('LATE'));
  }

  const totalTurns = actions.length;
  const clocks = buildQuarterClocks(totalTurns, isOvertime, triggerClutchPossession);

  // 배경 팀 득점(내 선수 코트 포제션 외 동료 득점) 및 상대 팀 득점은
  // 턴 0이 내 선수 슛일 경우 턴 0에 0을 배정해 '쿼터 시작 0ms 스코어 선행 점프'를 원천 차단!
  const bgTeamTotal = Math.max(0, remainingTeamBudget);
  const bgOppTotal = Math.max(0, oppQScore);

  const firstIsPlayerShot = actions[0].showOnCourt;
  const bgStartIdx = firstIsPlayerShot && totalTurns > 1 ? 1 : 0;
  const bgSlotCount = totalTurns - bgStartIdx;
  const bgTeamSlots = splitPointsIntoBuckets(bgTeamTotal, bgSlotCount, rng);
  const bgOppSlots = splitPointsIntoBuckets(bgOppTotal, bgSlotCount, rng);
  const rebSlots = splitPointsIntoBuckets(qReb, totalTurns, rng);

  const plays: LiveCourtPlay[] = [];
  let runTeam = startTeamScore;
  let runOpp = startOppScore;
  const runStats: LivePlayerBoxSnapshot = { ...prevPlayerStats };

  for (let i = 0; i < totalTurns; i++) {
    const act = actions[i];
    const bgIdx = i - bgStartIdx;
    const elapsedTeam = bgIdx >= 0 ? bgTeamSlots[bgIdx] || 0 : 0;
    const elapsedOpp = bgIdx >= 0 ? bgOppSlots[bgIdx] || 0 : 0;

    // 슛이 날아가는 동안 전광판은 경과 시간 스코어를 표시하고, 림 도달 후 shotPoints(0~3)만 증가
    const teamScoreBefore = runTeam + elapsedTeam;
    const oppScoreBefore = runOpp + elapsedOpp;
    const teamScoreAfter = teamScoreBefore + act.shotPoints;
    const oppScoreAfter = oppScoreBefore;

    runTeam = teamScoreAfter;
    runOpp = oppScoreAfter;

    const isLast = i === totalTurns - 1;
    if (isLast) {
      Object.assign(runStats, updatedPlayerStats);
    } else {
      runStats.pts = Math.min(updatedPlayerStats.pts, runStats.pts + act.dPts);
      runStats.fgm = Math.min(updatedPlayerStats.fgm, runStats.fgm + act.dFgm);
      runStats.fga = Math.min(updatedPlayerStats.fga, runStats.fga + act.dFga);
      runStats.tpm = Math.min(updatedPlayerStats.tpm, runStats.tpm + act.dTpm);
      runStats.tpa = Math.min(updatedPlayerStats.tpa, runStats.tpa + act.dTpa);
      runStats.reb = Math.min(updatedPlayerStats.reb, runStats.reb + (rebSlots[i] || 0));
      runStats.ast = Math.min(updatedPlayerStats.ast, runStats.ast + act.dAst);
      runStats.stl = Math.min(updatedPlayerStats.stl, runStats.stl + act.dStl);
      runStats.blk = Math.min(updatedPlayerStats.blk, runStats.blk + act.dBlk);
      runStats.fouls = Math.min(updatedPlayerStats.fouls, runStats.fouls + act.dFoul);
      const progressRatio = (i + 1) / totalTurns;
      runStats.stamina = Math.round(
        prevPlayerStats.stamina +
          (updatedPlayerStats.stamina - prevPlayerStats.stamina) * progressRatio
      );
    }

    const clock = clocks[i];
    plays.push({
      id: `Q${quarter}_P${i + 1}`,
      clock,
      actor: act.actor,
      type: act.type,
      showOnCourt: act.showOnCourt,
      shotPoints: act.shotPoints,
      courtBadge: act.courtBadge,
      x: act.x,
      y: act.y,
      fromX: act.fromX,
      fromY: act.fromY,
      teamScoreBefore,
      oppScoreBefore,
      teamDelta: elapsedTeam + act.shotPoints,
      oppDelta: elapsedOpp,
      teamScoreAfter,
      oppScoreAfter,
      playerStatsAfter: { ...runStats },
      text: act.buildText(clock, teamScoreAfter, oppScoreAfter),
    });
  }

  return plays;
}

/**
 * 실시간 결승전 중계의 다음 쿼터(1Q -> 2Q -> 3Q -> 4Q -> 동점 시 OT1~3)를 시뮬레이션합니다.
 * - 점수 조작 0%: 1~4쿼터 누적 실제 스코어를 있는 그대로 보존합니다.
 * - 4쿼터 종료 직전 실제 점수 차가 ±4점 이내(|teamScore - oppScore| <= 4)이고 퇴장(파울 아웃) 상태가 아닐 때만
 *   자연스럽게 '클러치 마지막 1포제션 선택지(공격/수비/자유투 분기)'를 발동합니다!
 * - 점수 차가 5점 이상이면 클러치 없이 자연스럽게 경기가 종료됩니다.
 * - 동점으로 쿼터(또는 클러치)가 끝나면 최대 3차 연장(OT)까지 진행합니다.
 */
/**
 * 리그 평균 능력치(모든 스탯 = LDR) 선수가 중립 전술·표준 체력으로 한 쿼터를 뛸 때의 기대 기여도.
 * simulateLiveQuarter 의 선수 득점/야투/어시스트/스틸·블록 산식의 기댓값과 같은 형태로 계산합니다.
 */
export function getReplacementLevelQuarterImpact(
  ldr: number,
  minutesFactor: number,
  isOvertime: boolean
): { lift: number; stocks: number } {
  const fga = (isOvertime ? 1.8 : 3.25) * minutesFactor * (0.76 + (2 * ldr) / 280);
  const fgProb =
    clamp(0.44, 0.24, 0.72) * LIVE_GAME_CONFIG.replacementStaminaFactor;
  const threeShare = ldr >= 56 ? clamp((ldr - 42) / 105, 0.12, 0.55) : 0;
  const fieldPts = fga * fgProb * ((1 - threeShare) * 2 + threeShare * 0.85 * 3);
  const ftProb = clamp(0.62 + (ldr - 50) * 0.006, 0.55, 0.93);
  const ftPts = 0.28 * minutesFactor * 2 * ftProb;
  const ast =
    (0.4 + (ldr / 100) * 1.85) * minutesFactor * (isOvertime ? 0.55 : 1.0);
  const stocks =
    clamp((ldr / 100) * 0.42 * minutesFactor, 0.03, 0.62) +
    clamp((ldr / 100) * 0.36 * minutesFactor, 0.02, 0.52);
  return {
    lift: fieldPts + ftPts - fga * 0.85 + ast * 1.35,
    stocks,
  };
}

export function simulateLiveQuarter(
  liveGame: LiveGameState,
  career: CareerState,
  tactic?: LiveTacticId,
  rng: () => number = Math.random
): LiveGameState {
  if (liveGame.isFinished || liveGame.pendingClutchPossession) return liveGame;

  const chosenTactic = tactic || liveGame.currentTactic || 'UNSELFISH_PASS';
  const nextQ = liveGame.quarter + 1;
  const isOvertime = nextQ > 4;
  const overtimeCount = isOvertime ? nextQ - 4 : 0;
  const stats = career.stats;
  const ovr = calculateOvr(stats, career.primaryPos, career.heightCm);
  const leagueMeta = LEAGUE_BALANCE_META[career.league];
  const isInternational = isInternationalLiveGame(liveGame.gameType);
  const tournamentType = getLiveGameTournamentType(liveGame);
  const foulLimit =
    liveGame.foulLimit ??
    (isInternational
      ? LIVE_GAME_CONFIG.asianGamesFoulLimit
      : leagueMeta.foulLimit);
  const ldr =
    tournamentType
      ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType].ldr
      : LEAGUE_CONFIG[career.league].ldr;
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const mod =
    LIVE_GAME_CONFIG.tacticMods[chosenTactic] ||
    LIVE_GAME_CONFIG.tacticMods.UNSELFISH_PASS;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const hasIronMan =
    traits.includes('IRON_STAMINA') || career.growthDna === 'IRONMAN';

  // 정규시즌 출전시간(MPG)에 비례해 결승전 플레이어 볼륨(출전 비중)을 자연스럽게 연동
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];
  const seasonMpg = latestLog ? latestLog.mpg : 28.0;
  const roleMinutesFactor = clamp(seasonMpg / 32.0, 0.28, 1.18);

  const isAlreadyFouledOut = Boolean(
    liveGame.fouledOut || liveGame.playerStats.fouls >= foulLimit
  );
  const inFoulTrouble =
    !isAlreadyFouledOut && liveGame.playerStats.fouls >= foulLimit - 1;
  const foulTroubleMinutesMult = inFoulTrouble ? 0.65 : 1.0;

  const curStamina = liveGame.playerStats.stamina;
  // 연속 체력 효능 곡선 (계단식 점프 대신 부드러운 선형 보간)
  const staminaFactor = clamp(0.74 + (curStamina / 100) * 0.28, 0.74, 1.02);
  const momentumBonus =
    liveGame.momentum === 'HOT'
      ? 0.045
      : liveGame.momentum === 'COLD'
      ? -0.038
      : 0;
  const fourthQuarterClutch = nextQ >= 4 && hasClutchTrait ? 0.06 : 0;

  let qFga = 0;
  let qFgm = 0;
  let qTpa = 0;
  let qTpm = 0;
  let freeThrows = 0;
  let qPts = 0;
  let qReb = 0;
  let qAst = 0;
  let qStl = 0;
  let qBlk = 0;
  let nextFouls = liveGame.playerStats.fouls;
  let fouledOutNow = isAlreadyFouledOut;
  let nextStamina = curStamina;

  if (!isAlreadyFouledOut) {
    const baseFga = (isOvertime ? 1.8 : 3.25) * roleMinutesFactor * foulTroubleMinutesMult;
    qFga = Math.max(
      seasonMpg < 12 ? 0 : 1,
      Math.round(
        baseFga *
          mod.usageMult *
          (0.76 + (stats.ins + stats.out) / 280) *
          (0.85 + rng() * 0.3)
      )
    );

    const rawFgProb =
      clamp(
        0.44 +
          ((stats.ins + stats.out) / 2 - ldr) * 0.0045 +
          mod.fgBonus +
          momentumBonus +
          fourthQuarterClutch -
          mismatch.fgPctPenalty * 0.008,
        0.24,
        0.72
      ) * staminaFactor;

    for (let i = 0; i < qFga; i++) {
      const isThreeAttempt =
        stats.out >= 56 &&
        rng() <
          clamp(
            (stats.out - 42) / 105 + (hasSniperTrait ? 0.1 : 0),
            0.12,
            0.55
          );
      if (isThreeAttempt) {
        qTpa++;
        if (rng() < rawFgProb * 0.85) {
          qFgm++;
          qTpm++;
        }
      } else if (rng() < rawFgProb) {
        qFgm++;
      }
    }

    const ftProb = clamp(0.62 + (stats.out - 50) * 0.006, 0.55, 0.93);
    const ftTrips =
      chosenTactic === 'ACE_HERO' && rng() < 0.55 * roleMinutesFactor
        ? 2
        : rng() < 0.28 * roleMinutesFactor
        ? 1
        : 0;
    for (let t = 0; t < ftTrips; t++) {
      if (rng() < ftProb) freeThrows++;
      if (rng() < ftProb) freeThrows++;
    }
    qPts = qFgm * 2 + qTpm + freeThrows;

    qReb = Math.max(
      0,
      Math.round(
        (0.55 + (stats.reb / 100) * 2.15) *
          roleMinutesFactor *
          foulTroubleMinutesMult *
          mismatch.rebMultiplier *
          (isOvertime ? 0.55 : 1.0) *
          (0.6 + rng() * 0.8)
      )
    );
    qAst = Math.max(
      0,
      Math.round(
        (0.4 + (stats.ply / 100) * 1.85) *
          roleMinutesFactor *
          foulTroubleMinutesMult *
          mod.astBonus *
          (isOvertime ? 0.55 : 1.0) *
          (0.6 + rng() * 0.8)
      )
    );
    qStl =
      rng() <
      clamp(
        ((stats.def / 100) * 0.42 +
          (chosenTactic === 'LOCKDOWN_DEFENSE' ? 0.16 : 0)) *
          roleMinutesFactor *
          foulTroubleMinutesMult,
        0.03,
        0.62
      )
        ? 1
        : 0;
    qBlk =
      rng() <
      clamp(
        (stats.def / 100) *
          0.36 *
          mismatch.blkMultiplier *
          roleMinutesFactor *
          foulTroubleMinutesMult,
        0.02,
        0.52
      )
        ? 1
        : 0;

    const drain = Math.round(
      mod.staminaDrain *
        (0.55 + roleMinutesFactor * 0.45) *
        (hasIronMan ? 0.72 : 1.0) *
        bio.staminaDrainMultiplier *
        (isOvertime ? 0.55 : 1.0)
    );
    nextStamina = clamp(
      curStamina - drain + (chosenTactic === 'PACE_CONSERVE' ? 6 : 0),
      10,
      100
    );

    const effectiveFoulRisk =
      mod.foulRisk *
      (inFoulTrouble ? 0.55 : 1.0) *
      clamp(0.6 + roleMinutesFactor * 0.4, 0.6, 1.1);
    const addedFoul = rng() < effectiveFoulRisk ? 1 : 0;
    nextFouls = Math.min(foulLimit, liveGame.playerStats.fouls + addedFoul);
    if (nextFouls >= foulLimit) {
      fouledOutNow = true;
    }
  }

  // 리그별 실제 경기 템포 기반 팀/상대 쿼터 득점 산출 (강제 스코어 조작 0%)
  const teamRating =
    career.teamRatingsMap?.[liveGame.playerTeam.id] ?? liveGame.playerTeam.rating;
  const baseTeamQuarterPts = isOvertime
    ? leagueMeta.liveOvertimeBasePts
    : leagueMeta.liveQuarterBasePts;
  const baseOppQuarterPts = isOvertime
    ? leagueMeta.liveOvertimeBasePts
    : leagueMeta.liveOppQuarterBasePts;

  // 두 팀 평균 전력이 리그 LDR보다 높을수록 경기 템포(양 팀 득점)가 함께 올라갑니다. (한쪽에만 주지 않음)
  const paceRatingOffset =
    ((teamRating + liveGame.opponentTeam.rating) / 2 - ldr) * 0.22;

  // [대칭 보정] 선수 기여도는 '같은 역할·출전 비중을 맡은 리그 평균 선수'의 기대 기여도 대비 차이로만 반영합니다.
  // 상대 팀에도 리그 평균 수준의 선수가 같은 역할을 수행한다고 보는 것과 같아,
  // 평균 선수는 승패에 중립적이고 실력이 리그 평균을 넘어설수록 팀 승률이 올라갑니다.
  const replacement = getReplacementLevelQuarterImpact(
    ldr,
    roleMinutesFactor * foulTroubleMinutesMult,
    isOvertime
  );
  const playerCourtLift = isAlreadyFouledOut
    ? -LIVE_GAME_CONFIG.fouledOutLiftPenalty
    : qPts - qFga * 0.85 + qAst * 1.35 - replacement.lift;
  const myQScore = Math.max(
    isOvertime ? 4 : 11,
    isAlreadyFouledOut ? 0 : qPts + (qAst > 0 ? 2 : 0),
    Math.round(
      baseTeamQuarterPts +
        paceRatingOffset +
        playerCourtLift * LIVE_GAME_CONFIG.playerImpactWeight +
        (rng() - 0.5) * 8.5
    )
  );

  const oppAdvantage = (liveGame.opponentTeam.rating - teamRating) * 0.24;
  const defSuppression = isAlreadyFouledOut
    ? -LIVE_GAME_CONFIG.fouledOutDefPenalty
    : mod.defBonus * roleMinutesFactor * foulTroubleMinutesMult +
      (stats.def - ldr) * 0.08 * roleMinutesFactor * foulTroubleMinutesMult +
      (qStl + qBlk - replacement.stocks) * 1.35 -
      bio.perimeterDefPenalty * 0.14 * roleMinutesFactor * foulTroubleMinutesMult;
  let oppQScore = Math.max(
    isOvertime ? 4 : 11,
    Math.round(
      baseOppQuarterPts +
        paceRatingOffset +
        oppAdvantage -
        defSuppression * LIVE_GAME_CONFIG.defImpactWeight +
        (rng() - 0.5) * 8.5
    )
  );

  const nextTeamScore = liveGame.teamScore + myQScore;
  let nextOppScore = liveGame.oppScore + oppQScore;

  // 최대 연장(3OT)까지도 동점이면 마지막 서든데스 2점으로 자연 결착
  if (
    isOvertime &&
    overtimeCount >= LIVE_GAME_CONFIG.maxOvertimePeriods &&
    nextTeamScore === nextOppScore
  ) {
    const teamEdge = teamRating + (ovr - ldr) * 0.3 + (hasClutchTrait ? 3 : 0);
    if (teamEdge >= liveGame.opponentTeam.rating) {
      oppQScore = Math.max(2, oppQScore - 2);
    } else {
      oppQScore += 2;
    }
    nextOppScore = liveGame.oppScore + oppQScore;
  }

  // 🔥 자연 클러치 1포제션 발동 조건:
  // 4쿼터 종료 직전, 파울아웃되지 않았고, 실제 점수 차가 ±4점 이내(|diff| <= 4)일 때만 발동!
  // 스코어는 단 1점도 조작하지 않고 실제 누적 점수를 그대로 유지합니다.
  const scoreDiff = nextTeamScore - nextOppScore;
  let triggerClutchPossession = false;
  let clutchScenario: ClutchScenarioType | undefined = undefined;
  let clutchSituationText: string | undefined = undefined;

  if (
    nextQ === 4 &&
    !liveGame.clutchPossessionResolved &&
    !fouledOutNow &&
    Math.abs(scoreDiff) <= LIVE_GAME_CONFIG.clutchMaxPointGap
  ) {
    triggerClutchPossession = true;
    if (scoreDiff < 0) {
      clutchScenario = 'TRAILING';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore}(${Math.abs(
        scoreDiff
      )}점 차 열세). 마지막 공격권이 ${career.name}에게 주어집니다.`;
    } else if (scoreDiff > 0) {
      clutchScenario = 'LEADING';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore}(${scoreDiff}점 차 리드). 상대의 마지막 공격을 막아내면 승리가 확정됩니다.`;
    } else {
      clutchScenario = 'TIED';
      clutchSituationText = `4쿼터 종료 14.2초 전, ${nextTeamScore}:${nextOppScore} 동점. 마지막 공격권으로 승부를 끝낼 기회입니다.`;
    }
  }

  const nextMomentum: 'HOT' | 'NEUTRAL' | 'COLD' =
    qPts >= 8 || myQScore - oppQScore >= 5
      ? 'HOT'
      : qFgm === 0 && qFga >= 4
      ? 'COLD'
      : 'NEUTRAL';

  const qLabel = isOvertime ? `OT${overtimeCount}` : `${nextQ}Q`;
  const pbp: string[] = [];

  if (isAlreadyFouledOut) {
    pbp.push(
      `[${qLabel}] ${career.name}이 ${foulLimit}반칙 퇴장으로 벤치에서 경기를 지켜봅니다.`
    );
  } else {
    pbp.push(`[${qLabel}] '${mod.label}' 전술로 쿼터를 시작합니다.`);
    if (fouledOutNow) {
      pbp.push(
        `${career.name}, ${qLabel} 중반 개인 ${foulLimit}반칙 파울 아웃으로 코트를 떠납니다.`
      );
    } else if (inFoulTrouble) {
      pbp.push(
        `개인 반칙 ${liveGame.playerStats.fouls}개로 파울 관리에 들어갑니다.`
      );
    }

    if (qPts >= 7) {
      pbp.push(
        `${career.name}, ${qLabel} ${qPts}득점(${
          qTpm > 0 ? `3점슛 ${qTpm}개 포함` : '인사이드 집중 공략'
        })으로 공격을 이끕니다.`
      );
    } else if (qAst >= 3) {
      pbp.push(
        `${career.name}, 날카로운 패스 전개로 ${qAst}어시스트를 기록합니다.`
      );
    } else if (qPts <= 2 && qFga >= 4) {
      pbp.push(
        `${liveGame.opponentTeam.shortName}의 강한 압박에 ${career.name}의 야투가 침묵합니다 (${qFgm}/${qFga}).`
      );
    } else {
      pbp.push(
        `${career.name}, ${qPts}점 ${qReb}리바운드 ${qAst}어시스트로 흐름을 조율합니다.`
      );
    }
  }

  if (triggerClutchPossession && clutchSituationText) {
    pbp.push(clutchSituationText);
  } else if (nextQ >= 4 && nextTeamScore === nextOppScore) {
    pbp.push(
      `${qLabel} 종료 ${nextTeamScore}:${nextOppScore} 동점, 연장전(OT)으로 돌입합니다.`
    );
  } else if (qBlk > 0 || qStl > 0) {
    pbp.push(
      `${career.name}의 ${
        qBlk > 0 ? '결정적 블록슛' : '스틸'
      }으로 ${liveGame.opponentTeam.shortName}의 흐름을 끊습니다.`
    );
  } else if (myQScore >= oppQScore + 4) {
    pbp.push(
      `${liveGame.playerTeam.shortName}, 쿼터 스코어 ${myQScore}-${oppQScore}로 주도권을 잡습니다.`
    );
  } else {
    pbp.push(
      `누적 스코어 ${nextTeamScore}:${nextOppScore}로 ${qLabel}가 종료됩니다.`
    );
  }

  const prevPlayerStats: LivePlayerBoxSnapshot = { ...liveGame.playerStats };
  const updatedPlayerStats: LivePlayerBoxSnapshot = {
    pts: liveGame.playerStats.pts + qPts,
    reb: liveGame.playerStats.reb + qReb,
    ast: liveGame.playerStats.ast + qAst,
    stl: liveGame.playerStats.stl + qStl,
    blk: liveGame.playerStats.blk + qBlk,
    fgm: liveGame.playerStats.fgm + qFgm,
    fga: liveGame.playerStats.fga + qFga,
    tpm: liveGame.playerStats.tpm + qTpm,
    tpa: liveGame.playerStats.tpa + qTpa,
    fouls: nextFouls,
    stamina: nextStamina,
  };

  const quarterPlays = generateQuarterCourtPlays({
    quarter: nextQ,
    qLabel,
    isOvertime,
    playerName: career.name,
    playerTeamShort: liveGame.playerTeam.shortName,
    oppTeamShort: liveGame.opponentTeam.shortName,
    startTeamScore: liveGame.teamScore,
    startOppScore: liveGame.oppScore,
    myQScore,
    oppQScore,
    qPts,
    qTpm,
    qTpa,
    qFgm,
    qFga,
    freeThrows,
    qReb,
    qAst,
    qStl,
    qBlk,
    addedFoul: Math.max(0, nextFouls - liveGame.playerStats.fouls),
    fouledOutNow,
    isAlreadyFouledOut,
    foulLimit,
    triggerClutchPossession,
    prevPlayerStats,
    updatedPlayerStats,
    rng,
  });

  const logEntry: LiveQuarterLog = {
    quarter: nextQ,
    label: qLabel,
    teamPts: myQScore,
    oppPts: oppQScore,
    playerPts: qPts,
    playerReb: qReb,
    playerAst: qAst,
    startTeamScore: liveGame.teamScore,
    startOppScore: liveGame.oppScore,
    startPlayerStats: prevPlayerStats,
    playByPlay: pbp,
    plays: quarterPlays,
  };

  if (triggerClutchPossession) {
    return {
      ...liveGame,
      quarter: nextQ,
      isFinished: false,
      foulLimit,
      fouledOut: fouledOutNow,
      overtimeCount,
      pendingClutchPossession: true,
      clutchScenario,
      clutchSituationText,
      teamScore: nextTeamScore,
      oppScore: nextOppScore,
      currentTactic: chosenTactic,
      momentum: nextMomentum,
      playerStats: updatedPlayerStats,
      quarterLogs: [...liveGame.quarterLogs, logEntry],
    };
  }

  const isGameFinished = nextQ >= 4 && nextTeamScore !== nextOppScore;

  let finalOutcome: LiveGameState['finalOutcome'] = undefined;
  if (isGameFinished) {
    finalOutcome = buildFinalOutcome(
      liveGame,
      career,
      nextTeamScore,
      nextOppScore,
      updatedPlayerStats
    );
  }

  return {
    ...liveGame,
    quarter: nextQ,
    isFinished: isGameFinished,
    foulLimit,
    fouledOut: fouledOutNow,
    overtimeCount,
    pendingClutchPossession: false,
    teamScore: nextTeamScore,
    oppScore: nextOppScore,
    currentTactic: chosenTactic,
    momentum: nextMomentum,
    playerStats: updatedPlayerStats,
    quarterLogs: [...liveGame.quarterLogs, logEntry],
    finalOutcome,
  };
}

/**
 * 🔥 4쿼터 실제 ±4점 이내 접전 '클러치 마지막 1포제션' 판정 (실제 2점/3점/자유투/수비 점수만 정확히 가산!)
 * - 절대 점수를 텔레포트 조작하지 않습니다. 동점이 되면 자연스럽게 연장전(OT)으로 진입합니다!
 */
export function resolveClutchPossession(
  liveGame: LiveGameState,
  career: CareerState,
  choice: ClutchChoiceId,
  rng: () => number = Math.random
): LiveGameState {
  if (!liveGame.pendingClutchPossession || liveGame.isFinished) {
    return liveGame;
  }

  const stats = career.stats;
  const tournamentType = getLiveGameTournamentType(liveGame);
  const ldr =
    tournamentType
      ? INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType].ldr
      : LEAGUE_CONFIG[career.league].ldr;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const staminaMod = clamp(
    ((liveGame.playerStats.stamina - 45) / 100) * 0.14,
    -0.08,
    0.05
  );
  const clutchBonus = hasClutchTrait ? 0.12 : 0;

  const nextStats = { ...liveGame.playerStats };
  let nextTeamScore = liveGame.teamScore;
  let nextOppScore = liveGame.oppScore;
  const deficit = nextOppScore - nextTeamScore; // >0이면 열세, <0이면 리드, 0이면 동점
  let clutchPlayLine = '';
  let customClutchNote = '';
  let clutchConverted = false;

  if (choice === 'ISO_WINNER') {
    // 3~4점 열세면 3점슛 시도, 1~2점 열세 또는 동점이면 선수 성향(OUT vs INS)에 따라 3점 또는 2점 돌파 선택
    const isThreeShot = deficit >= 3 || (stats.out >= stats.ins + 4 && rng() < 0.65);
    const shotPoints = isThreeShot ? 3 : 2;
    const attackSkill = isThreeShot
      ? stats.out * 0.78 + stats.ply * 0.22
      : stats.ins * 0.72 + stats.phy * 0.28;
    const successProb = clamp(
      (isThreeShot ? 0.41 : 0.5) +
        (attackSkill - ldr) * 0.011 +
        clutchBonus +
        (isThreeShot && hasSniperTrait ? 0.06 : 0) +
        staminaMod -
        bio.positionalPhysicsStrain * 0.12,
      LIVE_GAME_CONFIG.clutchProbMin,
      LIVE_GAME_CONFIG.clutchProbMax
    );

    const succeeded = rng() < successProb;
    nextStats.fga += 1;
    if (isThreeShot) nextStats.tpa += 1;

    if (succeeded) {
      clutchConverted = true;
      nextStats.fgm += 1;
      if (isThreeShot) nextStats.tpm += 1;
      nextStats.pts += shotPoints;
      nextTeamScore += shotPoints;

      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 클러치 ${shotPoints}점 위닝샷 성공 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 결승 ${shotPoints}점 클러치 슛`;
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 동점 클러치 ${shotPoints}점슛 성공 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 동점 클러치 슛`;
      } else {
        clutchPlayLine = `4Q 0:01.8 · ${career.name}, 추격 ${shotPoints}점슛 성공했으나 1점 차 석패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '종료 직전 추격포 (석패)';
      }
    } else {
      clutchPlayLine =
        nextTeamScore === nextOppScore
          ? `4Q 0:01.8 · ${career.name}의 마지막 ${shotPoints}점 슛 림 외면 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`
          : `4Q 0:01.8 · ${career.name}의 마지막 ${shotPoints}점 슛 불발 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '마지막 클러치 슛 불발';
    }
  } else if (choice === 'KICKOUT_ASSIST') {
    const passSkill = stats.ply * 0.72 + liveGame.playerTeam.rating * 0.28;
    const successProb = clamp(
      0.44 +
        (passSkill - ldr) * 0.011 +
        clutchBonus * 0.75 +
        staminaMod -
        bio.tovRatePenalty * 0.08,
      LIVE_GAME_CONFIG.clutchProbMin,
      LIVE_GAME_CONFIG.clutchProbMax
    );
    const succeeded = rng() < successProb;
    if (succeeded) {
      clutchConverted = true;
      nextStats.ast += 1;
      nextTeamScore += 3;
      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 코너 킥아웃 패스, 동료 결승 3점슛 성공 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = `${career.name} 결승 킥아웃 어시스트`;
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 킥아웃 어시스트로 동점 3점 성공 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '동점 킥아웃 어시스트';
      } else {
        clutchPlayLine = `4Q 0:01.8 · ${career.name} 패스로 동료 3점 성공, 1점 차 석패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '추격 킥아웃 어시스트 (석패)';
      }
    } else {
      clutchPlayLine =
        nextTeamScore === nextOppScore
          ? `4Q 0:01.8 · 코너 3점슛 불발 · 동점 연장전 돌입 (${nextTeamScore}:${nextOppScore})`
          : `4Q 0:01.8 · 코너 동료의 오픈 3점슛 불발로 경기 종료 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '마지막 코너 3점 불발';
    }
  } else if (choice === 'LOCKDOWN_STOP') {
    // 리드 상황(1~4점 앞섬): 상대 마지막 공격을 전담 수비로 봉쇄
    const defSkill = stats.def * 0.72 + stats.phy * 0.28;
    const stopProb = clamp(
      0.54 +
        (defSkill - ldr) * 0.011 +
        clutchBonus * 0.8 +
        staminaMod -
        bio.perimeterDefPenalty * 0.04,
      0.28,
      0.88
    );
    const stopped = rng() < stopProb;
    if (stopped) {
      clutchConverted = true;
      const gotHighlight = rng() < 0.55;
      if (gotHighlight) {
        if (career.primaryPos === 'C' || career.primaryPos === 'PF') {
          nextStats.blk += 1;
        } else {
          nextStats.stl += 1;
        }
      }
      clutchPlayLine = `4Q 0:01.8 · ${career.name}, 상대 마지막 공격 완벽 봉쇄로 승리 확정 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `${career.name} 클러치 수비 스톱`;
    } else {
      const lead = nextTeamScore - nextOppScore;
      const oppShotPts = lead >= 3 ? 3 : rng() < 0.45 ? 3 : 2;
      nextOppScore += oppShotPts;
      if (nextTeamScore > nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · 상대 ${oppShotPts}점슛 허용했으나 리드 수성 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '상대 추격포 허용에도 승리 수성';
      } else if (nextTeamScore === nextOppScore) {
        clutchPlayLine = `4Q 0:01.8 · 종료 직전 ${oppShotPts}점 실점 · 동점 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '종료 직전 동점 실점';
      } else {
        clutchPlayLine = `4Q 0:01.8 · 상대 ${oppShotPts}점 버저비터 허용으로 역전패 (${nextTeamScore}:${nextOppScore})`;
        customClutchNote = '역전 버저비터 허용';
      }
    }
  } else {
    // CLUTCH_FREE_THROWS (리드 상황): 시간 소진 후 상대 파울 작전 유도 → 클러치 자유투 2구
    const ftProb = clamp(
      0.7 +
        (stats.out - 60) * 0.006 +
        (hasClutchTrait ? 0.08 : 0) +
        staminaMod * 0.6,
      0.55,
      0.97
    );
    const ft1 = rng() < ftProb ? 1 : 0;
    const ft2 = rng() < ftProb ? 1 : 0;
    const ftMade = ft1 + ft2;
    nextStats.pts += ftMade;
    nextTeamScore += ftMade;

    // 상대 마지막 딥쓰리(초장거리 버저비터) 시도
    const leadAfterFt = nextTeamScore - nextOppScore;
    const desperateMake =
      leadAfterFt <= 3 && rng() < clamp(0.18 + (liveGame.opponentTeam.rating - 82) * 0.008, 0.1, 0.28);
    if (desperateMake) {
      nextOppScore += 3;
    }

    if (nextTeamScore > nextOppScore) {
      if (ftMade === 2) clutchConverted = true;
      clutchPlayLine = `4Q 0:01.8 · ${career.name}, 클러치 자유투 ${ftMade}/2 성공으로 승리 확정 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `클러치 자유투 ${ftMade}/2 성공`;
    } else if (nextTeamScore === nextOppScore) {
      clutchPlayLine = `4Q 0:01.8 · 자유투 ${ftMade}/2 후 상대 3점포 허용 · 연장전 돌입 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '상대 동점 3점 허용';
    } else {
      clutchPlayLine = `4Q 0:01.8 · 자유투 ${ftMade}/2에 그친 뒤 상대 역전 3점 허용 (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = '자유투 불발 후 역전 3점 허용';
    }
  }

  const updatedLogs = [...liveGame.quarterLogs];
  if (updatedLogs.length > 0) {
    const lastIdx = updatedLogs.length - 1;
    const prevLog = updatedLogs[lastIdx];
    const teamDelta = nextTeamScore - liveGame.teamScore;
    const oppDelta = nextOppScore - liveGame.oppScore;
    const playerShotPts = choice === 'LOCKDOWN_STOP' ? 0 : Math.min(3, Math.max(0, teamDelta));
    const clutchBadge =
      choice === 'LOCKDOWN_STOP'
        ? oppDelta === 0
          ? 'STOP'
          : 'FOUL'
        : choice === 'KICKOUT_ASSIST'
        ? playerShotPts > 0
          ? `AST +${playerShotPts}`
          : 'MISS'
        : playerShotPts > 0
        ? `+${playerShotPts}`
        : 'MISS';
    const clutchPlay: LiveCourtPlay = {
      id: `Q${prevLog.quarter}_CLUTCH`,
      clock: '0:01.8',
      actor:
        choice === 'LOCKDOWN_STOP' && oppDelta > 0
          ? 'OPPONENT'
          : 'PLAYER',
      type: 'CLUTCH',
      showOnCourt: true,
      shotPoints: playerShotPts,
      courtBadge: clutchBadge,
      fromX: choice === 'KICKOUT_ASSIST' ? 50 : undefined,
      fromY: choice === 'KICKOUT_ASSIST' ? 42 : undefined,
      x:
        choice === 'KICKOUT_ASSIST'
          ? 89
          : choice === 'CLUTCH_FREE_THROWS'
          ? 50
          : choice === 'LOCKDOWN_STOP'
          ? 50
          : teamDelta === 3 || deficit >= 3
          ? 80
          : 52,
      y:
        choice === 'KICKOUT_ASSIST'
          ? 20
          : choice === 'CLUTCH_FREE_THROWS'
          ? 38
          : choice === 'LOCKDOWN_STOP'
          ? 24
          : teamDelta === 3 || deficit >= 3
          ? 54
          : 26,
      teamScoreBefore: liveGame.teamScore,
      oppScoreBefore: liveGame.oppScore,
      teamDelta,
      oppDelta,
      teamScoreAfter: nextTeamScore,
      oppScoreAfter: nextOppScore,
      playerStatsAfter: { ...nextStats },
      text: clutchPlayLine,
    };
    updatedLogs[lastIdx] = {
      ...prevLog,
      teamPts: prevLog.teamPts + teamDelta,
      oppPts: prevLog.oppPts + oppDelta,
      playerPts: prevLog.playerPts + (nextStats.pts - liveGame.playerStats.pts),
      playerAst: prevLog.playerAst + (nextStats.ast - liveGame.playerStats.ast),
      playByPlay: [...prevLog.playByPlay, clutchPlayLine],
      plays: [...(prevLog.plays || []), clutchPlay],
    };
  }

  // 동점이 되었다면 경기를 끝내지 않고 연장전(OT) 진행 대기 상태로 전환!
  const updatedLiveForOutcome: LiveGameState = {
    ...liveGame,
    clutchConvertedInGame: Boolean(liveGame.clutchConvertedInGame || clutchConverted),
  };

  if (nextTeamScore === nextOppScore) {
    return {
      ...updatedLiveForOutcome,
      teamScore: nextTeamScore,
      oppScore: nextOppScore,
      isFinished: false,
      pendingClutchPossession: false,
      clutchPossessionResolved: true,
      clutchSituationText: clutchPlayLine,
      playerStats: nextStats,
      quarterLogs: updatedLogs,
    };
  }

  const finalOutcome = buildFinalOutcome(
    updatedLiveForOutcome,
    career,
    nextTeamScore,
    nextOppScore,
    nextStats,
    customClutchNote
  );

  return {
    ...updatedLiveForOutcome,
    teamScore: nextTeamScore,
    oppScore: nextOppScore,
    isFinished: true,
    pendingClutchPossession: false,
    clutchPossessionResolved: true,
    clutchSituationText: clutchPlayLine,
    playerStats: nextStats,
    quarterLogs: updatedLogs,
    finalOutcome,
  };
}

/**
 * 실시간 결승전 경기를 남은 쿼터 모두 즉시 시뮬레이션하여 최종 결과로 이동합니다.
 */
export function skipLiveGameToEnd(
  liveGame: LiveGameState,
  career: CareerState,
  rng: () => number = Math.random
): LiveGameState {
  let current = { ...liveGame };
  let guard = 0;
  while (!current.isFinished && guard < 12) {
    if (current.pendingClutchPossession) {
      let autoChoice: ClutchChoiceId;
      if (current.clutchScenario === 'LEADING') {
        autoChoice =
          career.stats.def >= career.stats.out
            ? 'LOCKDOWN_STOP'
            : 'CLUTCH_FREE_THROWS';
      } else {
        autoChoice =
          career.stats.ply > Math.max(career.stats.ins, career.stats.out) + 5
            ? 'KICKOUT_ASSIST'
            : 'ISO_WINNER';
      }
      current = resolveClutchPossession(current, career, autoChoice, rng);
    } else {
      current = simulateLiveQuarter(
        current,
        career,
        current.currentTactic || 'UNSELFISH_PASS',
        rng
      );
    }
    guard++;
  }
  return current;
}
