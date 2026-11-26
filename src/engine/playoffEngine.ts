import {
  CareerState,
  LeagueId,
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
} from '../types/game';
import { isHighSchoolLeague } from '../data/leagues';
import {
  PLAYOFF_SERIES_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import {
  calculateBiomechanicalProfile,
  calculateOvr,
} from './statCalculator';
import {
  calculatePlayoffPlayerBonus,
  getSeriesSeedModifiers,
} from './playoffStrength';
import {
  getHigherSeedHomeAdvantage,
  getPlayoffCutoffByLeague,
} from './standingsEngine';

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
  if (isHighSchoolLeague(league) || league === 'U_LEAGUE') {
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
  rng: () => number = Math.random,
  options?: { simulateForNonPlayer?: boolean }
): PlayoffBracketState {
  const simulateForNonPlayer = Boolean(options?.simulateForNonPlayer);
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
    if (
      (!playerQualified && !simulateForNonPlayer) ||
      eastList.length < 10 ||
      westList.length < 10
    ) {
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
    if (playerQualified && playerStanding.playInQualified) {
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
    const resE78 = simulateSingleSeries(piEast78, career, rng);
    const resE910 = simulateSingleSeries(piEast910, career, rng);
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
      rng
    );
    const resW78 = simulateSingleSeries(piWest78, career, rng);
    const resW910 = simulateSingleSeries(piWest910, career, rng);
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
      rng
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
      playerEliminated: !playerQualified,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: playerQualified ? '플레이오프 진출' : 'PO 탈락',
    };
  }

  // 2) 유로리그 (20팀): 1~6위 8강 직행, 7~10위 플레이인 쇼다운 (BO1 2단계 -> 8강 BO5 -> 파이널 포 4강/결승 BO1)
  if (career.league === 'EUROLEAGUE') {
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if ((!playerQualified && !simulateForNonPlayer) || standings.length < 10) {
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

    if (playerQualified && playerStanding.playInQualified) {
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

    const res78 = simulateSingleSeries(pi78, career, rng);
    const res910 = simulateSingleSeries(pi910, career, rng);
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
      rng
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
      playerEliminated: !playerQualified,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: playerQualified ? '유로리그 8강 PO 진출' : 'PO 탈락',
    };
  }

  // 3) 호주 NBL (10팀): 1~2위 4강 직행, 3~6위 정통 2단계 플레이인 (3v4 + 5v6 -> 최종전 -> 4강 BO3 -> 챔피언십 BO5)
  if (career.league === 'NBL') {
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if ((!playerQualified && !simulateForNonPlayer) || standings.length < 6) {
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

    if (playerQualified && playerStanding.playInQualified) {
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

    const res34 = simulateSingleSeries(pi34, career, rng);
    const res56 = simulateSingleSeries(pi56, career, rng);
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
      rng
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
      playerEliminated: !playerQualified,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: playerQualified ? 'NBL 세미파이널 직행' : 'PO 탈락',
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
    if (
      (!playerQualified && !simulateForNonPlayer) ||
      eastTop6.length < 6 ||
      westTop6.length < 6
    ) {
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
      playerEliminated: !playerQualified,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: playerQualified ? 'G리그 플레이오프 진출' : 'PO 탈락',
    };
  }

  // 5) NCAA (32팀): 16강 단판 토너먼트 (Sweet 16 -> Elite 8 -> Final Four -> Championship, 4라운드)
  if (career.league === 'NCAA') {
    const qualified = standings.slice(0, 16);
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);
    if ((!playerQualified && !simulateForNonPlayer) || qualified.length < 16) {
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
      playerEliminated: !playerQualified,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: playerQualified
        ? 'NCAA 16강 토너먼트 진출'
        : '토너먼트 탈락',
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

  if ((!playerQualified && !simulateForNonPlayer) || qualified.length < 2) {
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
    playerEliminated: !playerQualified,
    playerReachedFinals: false,
    championTeamId: null,
    playoffResultLabel: playerQualified ? '플레이오프 진출' : 'PO 탈락',
  };
}

export type SeriesPauseMode = 'NONE' | 'CONF_FINALS_GAME7' | 'DECISIVE_GAME';

export function simulateSingleSeries(
  series: PlayoffSeriesMatchup,
  career: CareerState,
  rng: () => number,
  pauseMode: SeriesPauseMode = 'NONE',
  mods: { hi: number; lo: number } = { hi: 0, lo: 0 }
): PlayoffSeriesMatchup {
  if (series.winnerId) return series;

  const playerBonus = calculatePlayoffPlayerBonus(career);

  const hiEffective =
    series.higherSeed.team.rating +
    (series.higherSeed.team.id === career.team.id ? playerBonus : 0) +
    mods.hi;
  const loEffective =
    series.lowerSeed.team.rating +
    (series.lowerSeed.team.id === career.team.id ? playerBonus : 0) +
    mods.lo;

  let hiWins = series.higherSeedWins;
  let loWins = series.lowerSeedWins;
  const logs: string[] = [...series.summaryLog];
  let gameNo = hiWins + loWins + 1;

  while (hiWins < series.winsNeeded && loWins < series.winsNeeded) {
    // 7전 4선승제 시리즈에서 실제로 3승 3패가 성사된 경우, 7차전 라이브 중계 진입을 위해 일시 정지
    if (
      pauseMode === 'CONF_FINALS_GAME7' &&
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

    // 실제 홈/원정 경기 번호 기반 홈코트 이점 교대 적용 (BO7 1·2·5·7 상위 홈 vs 3·4·6 하위 홈)
    const homeAdv = getHigherSeedHomeAdvantage(series.bestOf, gameNo);
    const hiWinProb = clampNum(
      0.5 +
        (hiEffective - loEffective + homeAdv) *
          PLAYOFF_SERIES_CONFIG.gameWinProbSlope,
      PLAYOFF_SERIES_CONFIG.minGameWinProb,
      PLAYOFF_SERIES_CONFIG.maxGameWinProb
    );

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
  if (league === 'U_LEAGUE' || isHighSchoolLeague(league)) {
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
  const minuteShareFactor = clampNum((mpg - 14.0) / 14.0, 0.0, 1.15);
  if (minuteShareFactor <= 0.35) return false;

  const strainPenalty = bio.positionalPhysicsStrain * 14.0;
  const teamGapAdjust = clampNum((ovr - teamRating) * 0.85, -8.0, 10.0);

  if (typeof finalsGameScore === 'number') {
    const effectiveGameImpact =
      finalsGameScore * clampNum(0.7 + minuteShareFactor * 0.3, 0.7, 1.05) +
      teamGapAdjust -
      strainPenalty;
    const teamAceGameBenchmark = Math.max(30.0, 30.8 + (teamRating - 62) * 0.78);
    return effectiveGameImpact >= teamAceGameBenchmark;
  }

  const seasonImpact = latestLog
    ? latestLog.ppg * 1.15 +
      latestLog.rpg * 0.75 +
      latestLog.apg * 1.1 +
      (latestLog.spg + latestLog.bpg) * 1.6
    : ovr * 0.35;
  const effectiveSeasonImpact =
    seasonImpact * clampNum(0.65 + minuteShareFactor * 0.35, 0.65, 1.05) +
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
    simulateSingleSeries(s, career, rng)
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
        const resEDec = simulateSingleSeries(eDecider, career, rng);
        const resWDec = simulateSingleSeries(wDecider, career, rng);
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
        const resDec = simulateSingleSeries(decider, career, rng);
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
      const resDec = simulateSingleSeries(decider, career, rng);
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
    simulateSingleSeries(
      s,
      career,
      rng,
      isNbaConfFinals && s.involvesPlayer ? 'CONF_FINALS_GAME7' : 'NONE',
      getSeriesSeedModifiers(bracket, s)
    )
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
      return s.winnerId
        ? s
        : simulateSingleSeries(s, career, rng, 'NONE', getSeriesSeedModifiers(bracket, s));
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
