import {
  AsianGamesMatchLog,
  AsianGamesTournamentResult,
  CareerState,
  ClutchChoiceId,
  LeagueId,
  LiveGameState,
  LiveQuarterLog,
  LiveTacticId,
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
  TeamInfo,
} from '../types/game';
import { ASIAN_NATIONAL_TEAMS, getTeamsByLeague } from '../data/teams';
import { LEAGUE_CONFIG } from '../data/leagues';
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
  // NBA는 동부 8팀 + 서부 8팀 = 총 16팀이 플레이오프 진출 (컨퍼런스별 상위 8위)
  if (league === 'NBA') return Math.min(16, totalTeams);
  if (league === 'KBL' || league === 'OVERSEAS' || league === 'GLEAGUE') {
    return Math.min(6, totalTeams);
  }
  return Math.min(4, totalTeams);
}

/**
 * 리그 전체 구단의 정규시즌 최종 순위표를 동적 생성합니다.
 * - seasonSimulator.ts의 플레이어 소속팀 승률 공식과 100% 동일한 리그 평균 전력 기준선(getLeagueBaselineTeamRating)을 공유합니다.
 * - NBA의 경우 동부(EAST 1~15위) / 서부(WEST 1~15위) 컨퍼런스 순위(conferenceRank)와 PO 진출 여부(각 컨퍼런스 1~8위)를 함께 산출합니다.
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
      };
    }

    const directionMod =
      team.direction === 'CONTENDER'
        ? 0.055
        : team.direction === 'REBUILDING'
        ? -0.055
        : 0;
    // 플레이어 팀 승률 기대치 공식과 정확히 동일한 기준선(leagueMeanRating) 적용
    const expectedWinPct = clamp(
      0.5 +
        (dynamicRating - leagueMeanRating) * 0.022 +
        directionMod +
        (rng() - 0.5) * 0.1,
      0.16,
      0.86
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
    };
  });

  rawEntries.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.team.rating - a.team.rating;
  });

  if (career.league === 'NBA') {
    const eastList = rawEntries.filter((e) => e.team.conference === 'EAST');
    const westList = rawEntries.filter((e) => e.team.conference !== 'EAST');

    const assignConfRank = (list: StandingEntry[], conf: 'EAST' | 'WEST') => {
      const leader = list[0];
      list.forEach((entry, idx) => {
        const cRank = idx + 1;
        entry.conference = conf;
        entry.conferenceRank = cRank;
        entry.qualifiedPlayoffs = cRank <= 8;
        entry.gb =
          idx === 0 || !leader
            ? 0
            : Number(
                Math.max(
                  0,
                  (leader.wins - entry.wins + (entry.losses - leader.losses)) / 2
                ).toFixed(1)
              );
      });
    };

    assignConfRank(eastList, 'EAST');
    assignConfRank(westList, 'WEST');

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
    return {
      ...entry,
      rank,
      conferenceRank: rank,
      gb,
      qualifiedPlayoffs: rank <= cutoff,
    };
  });
}

function getSeriesConfig(
  league: LeagueId,
  roundNumber: number,
  totalRounds: number
): { bestOf: number; winsNeeded: number; roundLabel: string } {
  const isAmateur =
    league === 'HIGH_SCHOOL' || league === 'U_LEAGUE' || league === 'NCAA';
  if (isAmateur) {
    return {
      bestOf: 1,
      winsNeeded: 1,
      roundLabel: roundNumber === 1 ? '4강 토너먼트' : '전국 결승전',
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
  conference?: 'EAST' | 'WEST' | 'FINALS'
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
    summaryLog: [
      `(${seedTagHi}) ${OrderedHi.team.shortName} vs (${seedTagLo}) ${OrderedLo.team.shortName} 대진 확정`,
    ],
  };
}

/**
 * 정규시즌 순위표를 바탕으로 포스트시즌 사다리 대진표를 생성합니다.
 * - NBA: 동부 1~8시드 4경기 + 서부 1~8시드 4경기 (총 4라운드: 1R -> 컨퍼런스 4강 -> 컨퍼런스 파이널 -> NBA 파이널)
 * - KBL / 해외 / G리그: 6강 PO (3라운드)
 * - 고교 / 대학 / NCAA: 4강 단판 토너먼트 (2라운드)
 */
export function createPlayoffBracket(
  career: CareerState,
  standings: StandingEntry[]
): PlayoffBracketState {
  const playerStanding =
    standings.find((s) => s.isPlayerTeam) || standings[standings.length - 1];

  if (career.league === 'NBA') {
    const eastTop8 = standings
      .filter((s) => s.team.conference === 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 8);
    const westTop8 = standings
      .filter((s) => s.team.conference !== 'EAST')
      .sort((a, b) => (a.conferenceRank ?? a.rank) - (b.conferenceRank ?? b.rank))
      .slice(0, 8);

    const totalRounds = 4;
    const playerQualified = Boolean(playerStanding?.qualifiedPlayoffs);

    if (!playerQualified || eastTop8.length < 8 || westTop8.length < 8) {
      return {
        league: career.league,
        year: career.seasonYear,
        totalRounds,
        currentRound: 1,
        rounds: [],
        playerEliminated: true,
        playerReachedFinals: false,
        championTeamId: null,
        playoffResultLabel: 'PO 탈락',
      };
    }

    const r1Cfg = getSeriesConfig('NBA', 1, totalRounds);
    const eastPairs: [StandingEntry, StandingEntry][] = [
      [eastTop8[0], eastTop8[7]],
      [eastTop8[3], eastTop8[4]],
      [eastTop8[1], eastTop8[6]],
      [eastTop8[2], eastTop8[5]],
    ];
    const westPairs: [StandingEntry, StandingEntry][] = [
      [westTop8[0], westTop8[7]],
      [westTop8[3], westTop8[4]],
      [westTop8[1], westTop8[6]],
      [westTop8[2], westTop8[5]],
    ];

    const round1Series: PlayoffSeriesMatchup[] = [
      ...eastPairs.map(([hi, lo], i) =>
        createMatchup(
          `R1_E${i + 1}`,
          1,
          `동부 ${r1Cfg.roundLabel}`,
          r1Cfg.bestOf,
          r1Cfg.winsNeeded,
          hi,
          lo,
          career.team.id,
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
          career.team.id,
          'WEST'
        )
      ),
    ];

    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds,
      currentRound: 1,
      rounds: [round1Series],
      playerEliminated: false,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: '플레이오프 진출',
    };
  }

  const cutoff = getPlayoffCutoffByLeague(career.league, standings.length);
  const qualified = standings.slice(0, cutoff);
  const playerQualified = playerStanding.rank <= cutoff;
  const totalRounds = cutoff <= 4 ? 2 : 3;

  if (!playerQualified || qualified.length < 2) {
    return {
      league: career.league,
      year: career.seasonYear,
      totalRounds,
      currentRound: 1,
      rounds: [],
      playerEliminated: true,
      playerReachedFinals: false,
      championTeamId: null,
      playoffResultLabel: 'PO 탈락',
    };
  }

  const r1Cfg = getSeriesConfig(career.league, 1, totalRounds);
  let round1Series: PlayoffSeriesMatchup[] = [];

  if (cutoff === 6 && qualified.length >= 6) {
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
  rng: () => number
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
    1.5 +
    (series.higherSeed.team.id === career.team.id ? playerBonus : 0);
  const loEffective =
    series.lowerSeed.team.rating +
    (series.lowerSeed.team.id === career.team.id ? playerBonus : 0);

  const hiWinProb = clamp(0.5 + (hiEffective - loEffective) * 0.032, 0.2, 0.82);

  let hiWins = 0;
  let loWins = 0;
  const logs: string[] = [];
  let gameNo = 1;

  while (hiWins < series.winsNeeded && loWins < series.winsNeeded) {
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
    `✅ ${winner.team.name}, ${loser.team.shortName} 상대로 ${scoreLabel} 상위 라운드 진출!`
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
  if (roundNumber === totalRounds) return '파이널 준우승';
  if (league === 'NBA') {
    if (roundNumber === 1) return '컨퍼런스 1R(8강) 탈락';
    if (roundNumber === 2) return '컨퍼런스 4강 탈락';
    return '컨퍼런스 파이널 탈락';
  }
  if (league === 'KBL' || league === 'OVERSEAS' || league === 'GLEAGUE') {
    return roundNumber === 1 ? '6강 PO 탈락' : '4강 PO 탈락';
  }
  return '4강 PO 탈락';
}

/**
 * 파이널 MVP 수상 자격 판정 (현실적인 3대 조건)
 * ① 플레이어 소속팀이 최종 우승(won === true)
 * ② 플레이어가 주전급 출전 시간(mpg >= 24)을 소화
 * ③ 플레이어의 파이널 활약도가 소속팀 가상 1옵션 에이스 기준치를 상회
 */
export function evaluateRealisticFinalsMvp(
  career: CareerState,
  wonChampionship: boolean,
  finalsGameScore?: number
): boolean {
  if (!wonChampionship) return false;
  const latestLog = career.seasonLogs[career.seasonLogs.length - 1];
  const mpg = latestLog ? latestLog.mpg : 25;
  if (mpg < 24.0) return false;

  const ovr = Math.max(
    career.ovr || 0,
    calculateOvr(career.stats, career.primaryPos, career.heightCm)
  );
  const teamRating = career.teamRatingsMap?.[career.team.id] ?? career.team.rating;
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  // 실시간 결승전을 직접 뛴 경우 finalsGameScore(득점+리바운드*1.2+어시스트*1.5+수비*2)와 팀 내 비중을 함께 평가
  if (typeof finalsGameScore === 'number') {
    const teamAceGameBenchmark = Math.max(20, (teamRating - 62) * 0.92);
    return (
      finalsGameScore >= teamAceGameBenchmark &&
      ovr >= teamRating - 4 &&
      bio.positionalPhysicsStrain < 0.45
    );
  }

  // 스킵 시뮬레이션 시 시즌 퍼포먼스 점수가 팀 내 1옵션 기준치 이상인지 확인
  const playerImpact = latestLog
    ? latestLog.ppg * 1.15 +
      latestLog.rpg * 0.75 +
      latestLog.apg * 1.1 +
      (latestLog.spg + latestLog.bpg) * 1.6
    : ovr * 0.35;
  const teamAceSeasonBenchmark = Math.max(18.5, (teamRating - 56) * 0.88);

  return (
    playerImpact >= teamAceSeasonBenchmark &&
    ovr >= teamRating - 3 &&
    bio.positionalPhysicsStrain < 0.45
  );
}

/**
 * 현재 라운드의 플레이오프 시리즈를 진행하고 다음 라운드 대진을 구성합니다.
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
    };
  }

  const resolvedSeries = currentSeriesList.map((s) =>
    simulateSingleSeries(s, career, rng)
  );
  const updatedRounds = [...bracket.rounds];
  updatedRounds[currentRoundIdx - 1] = resolvedSeries;

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
    const champEntry =
      finalMatch.winnerId === finalMatch.higherSeed.team.id
        ? finalMatch.higherSeed
        : finalMatch.lowerSeed;

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

  const winners = resolvedSeries.map((s) =>
    s.winnerId === s.higherSeed.team.id ? s.higherSeed : s.lowerSeed
  );

  let nextSeriesList: PlayoffSeriesMatchup[] = [];
  const cutoff = getPlayoffCutoffByLeague(bracket.league, standings.length);

  if (bracket.league === 'NBA') {
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
  } else if (cutoff === 6 && currentRoundIdx === 1 && standings.length >= 2) {
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
    playoffResultLabel,
  };
}

/**
 * 플레이오프 1~2라운드(초반 라운드)를 원클릭으로 일괄 시뮬레이션하여 피로도를 줄이고,
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
  // 초반 라운드(결승 전 라운드들)를 일괄 진행하되, 플레이어가 탈락하거나 결승에 진출하면 즉시 정지
  while (
    !current.championTeamId &&
    !current.playerEliminated &&
    !current.playerReachedFinals &&
    current.rounds.length > 0 &&
    guard < 4
  ) {
    current = advancePlayoffRound(current, career, standings, rng, false);
    guard++;
    // NBA에서 컨퍼런스 파이널(3라운드)에 도달했으면 컨퍼런스 파이널 매치업을 먼저 확인할 수 있게 정지
    if (
      current.league === 'NBA' &&
      current.currentRound === 3 &&
      !current.playerEliminated
    ) {
      break;
    }
  }
  return current;
}

/**
 * 플레이오프 전체를 끝까지 즉시 시뮬레이션합니다.
 */
export function skipEntirePlayoffs(
  bracket: PlayoffBracketState,
  career: CareerState,
  standings: StandingEntry[],
  rng: () => number = Math.random
): PlayoffBracketState {
  let current = { ...bracket };
  let guard = 0;
  while (!current.championTeamId && current.rounds.length > 0 && guard < 8) {
    current = advancePlayoffRound(current, career, standings, rng, true);
    guard++;
  }
  return current;
}

/**
 * 🏅 아시안게임 남자농구 국가대표 풀 토너먼트 백그라운드 시뮬레이션
 * - 조별리그(3경기) -> 8강 토너먼트 -> 4강 토너먼트 진행
 * - 8강이나 4강에서 패배할 경우 결승에 진출하지 못하고 즉시 탈락 (병역특례 실패)
 * - 4강까지 모두 승리한 경우에만 결승 상대 국가(finalOpponent)와 함께 reachedFinals: true 반환 -> 실시간 쿼터 결승 중계 진입!
 */
export function simulateAsianGamesTournament(
  career: CareerState,
  rng: () => number = Math.random
): AsianGamesTournamentResult {
  const ovr = calculateOvr(career.stats, career.primaryPos, career.heightCm);
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER') ? 3.0 : 0;

  // 대한민국 대표팀 기본 전력 74 + 국가대표 에이스(플레이어)의 실전 가중치
  const korEffectiveRating =
    74.0 +
    clamp((ovr - 72) * 0.42 + clutchBonus, -4.0, 10.5) -
    bio.positionalPhysicsStrain * 5.0;

  const shuffledPool = [...ASIAN_NATIONAL_TEAMS].sort(() => rng() - 0.5);
  const groupOpponents = shuffledPool.slice(0, 3);
  const qfOpponent = shuffledPool[3] || ASIAN_NATIONAL_TEAMS[4];
  const sfOpponent = shuffledPool[4] || ASIAN_NATIONAL_TEAMS[1];
  const finalOpponent = shuffledPool[5] || ASIAN_NATIONAL_TEAMS[0];

  const matches: AsianGamesMatchLog[] = [];

  const playMatch = (
    stage: 'GROUP' | 'QUARTERFINAL' | 'SEMIFINAL',
    stageLabel: string,
    opp: TeamInfo
  ): AsianGamesMatchLog => {
    const winProb = clamp(
      0.52 + (korEffectiveRating - opp.rating) * 0.038,
      0.18,
      0.86
    );
    const won = rng() < winProb;
    const playerPts = Math.max(
      4,
      Math.round(
        14 +
          (ovr - 70) * 0.55 -
          bio.positionalPhysicsStrain * 6 +
          (rng() * 8 - 4)
      )
    );
    const playerReb = Math.max(
      1,
      Math.round((4 + (career.stats.reb / 20)) * bio.rebMultiplier)
    );
    const playerAst = Math.max(
      1,
      Math.round(3 + (career.stats.ply / 22) - bio.tovRatePenalty * 0.6)
    );

    const baseScore = 76 + Math.round(rng() * 14);
    const margin = Math.max(2, Math.round(2 + rng() * 11));
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
  groupOpponents.forEach((opp, idx) => {
    matches.push(playMatch('GROUP', `조별리그 ${idx + 1}차전`, opp));
  });

  // 2. 8강 토너먼트
  const qfMatch = playMatch('QUARTERFINAL', '8강 토너먼트', qfOpponent);
  matches.push(qfMatch);
  if (!qfMatch.won) {
    return {
      reachedFinals: false,
      eliminatedStage: 'QUARTERFINAL',
      finalOpponent,
      matches,
      summaryHeadline: `💔 [아시안게임 8강 탈락] 대한민국 대표팀, 8강에서 ${qfOpponent.shortName}에 ${qfMatch.korScore}-${qfMatch.oppScore} 패배... 노메달 및 병역특례 무산`,
    };
  }

  // 3. 4강 준결승 토너먼트
  const sfMatch = playMatch('SEMIFINAL', '4강 준결승전', sfOpponent);
  matches.push(sfMatch);
  if (!sfMatch.won) {
    return {
      reachedFinals: false,
      eliminatedStage: 'SEMIFINAL',
      finalOpponent,
      matches,
      summaryHeadline: `🥉 [아시안게임 4강 석패] 대한민국 대표팀, 준결승에서 ${sfOpponent.shortName}에 ${sfMatch.korScore}-${sfMatch.oppScore} 석패... 결승 진출 및 금메달 병역특례 좌절`,
    };
  }

  return {
    reachedFinals: true,
    eliminatedStage: null,
    finalOpponent,
    matches,
    summaryHeadline: `🔥 [아시안게임 결승 진출] 8강(${qfOpponent.shortName}전)·4강(${sfOpponent.shortName}전) 연파! 숙적 ${finalOpponent.name}와 금메달 결정전 돌입!`,
  };
}

/**
 * 결승전(리그 파이널, 컨퍼런스 파이널 7차전, 또는 아시안게임 결승) 실시간 쿼터별 중계 상태를 생성합니다.
 */
export function createLiveFinalGame(
  career: CareerState,
  opponentTeam: TeamInfo,
  gameType: 'LEAGUE_FINALS' | 'CONF_FINALS_GAME7' | 'ASIAN_GAMES_FINAL'
): LiveGameState {
  const isAsianGames = gameType === 'ASIAN_GAMES_FINAL';
  const playerTeam: TeamInfo = isAsianGames
    ? {
        id: 'KOR_NAT_TEAM',
        name: '대한민국 남자농구 국가대표팀',
        shortName: '대한민국',
        city: '서울',
        league: career.league,
        rating: 75,
        primaryColor: '#1D4ED8',
        secondaryColor: '#EF4444',
        prestigeDesc:
          '태극마크를 달고 아시안게임 금메달과 병역특례에 도전하는 국가대표팀이에요.',
        direction: 'CONTENDER',
      }
    : career.team;

  const title = isAsianGames
    ? `${career.seasonYear} 아시안게임 남자농구 결승전 (병역특례 결정전)`
    : gameType === 'CONF_FINALS_GAME7'
    ? `${LEAGUE_CONFIG[career.league].shortName} 컨퍼런스 파이널 운명의 7차전`
    : `${LEAGUE_CONFIG[career.league].shortName} 챔피언십 파이널 최종전`;

  return {
    gameType,
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
    pendingClutchPossession: false,
    clutchPossessionResolved: false,
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
      stamina: 100,
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
  const grantedMilitaryExemption =
    won && liveGame.gameType === 'ASIAN_GAMES_FINAL';

  const baseHeadline =
    liveGame.gameType === 'ASIAN_GAMES_FINAL'
      ? won
        ? `🏅 [아시안게임 금메달] ${career.name}, 결승전 ${playerStats.pts}점 ${playerStats.reb}리바운드 ${playerStats.ast}도움 맹활약! 금메달 및 병역특례 획득!`
        : `🥈 [아시안게임 은메달] 대한민국, ${liveGame.opponentTeam.name}에 ${teamScore}-${oppScore} 석패... 아쉬운 준우승`
      : liveGame.gameType === 'CONF_FINALS_GAME7'
      ? won
        ? `🔥 [컨퍼런스 파이널 7차전 승리] ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name}을 ${teamScore}-${oppScore}로 제압하고 대망의 파이널 진출!`
        : `💔 [컨퍼런스 파이널 7차전 석패] ${liveGame.playerTeam.name}, 혈투 끝에 ${teamScore}-${oppScore} 패배... 파이널 문턱에서 탈락`
      : won
      ? `🏆 [챔피언 등극] ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name} 꺾고 정상 등극! ${career.name} ${playerStats.pts}점 활약${
          wonFinalsMvp ? ' (파이널 MVP 수상!)' : ''
        }`
      : `💔 [파이널 준우승] ${liveGame.playerTeam.name}, 최종전 끝 ${teamScore}-${oppScore} 석패... 아쉬운 준우승`;

  return {
    won,
    wonFinalsMvp,
    grantedMilitaryExemption,
    headline: customClutchNote ? `${baseHeadline} · ${customClutchNote}` : baseHeadline,
  };
}

/**
 * 실시간 결승전 중계의 다음 쿼터(1Q -> 2Q -> 3Q -> 4Q -> 동점 시 OT)를 시뮬레이션합니다.
 * - 4쿼터 종료 1분 전 점수 차가 6점 이내인 접전 상황이면 경기를 즉시 끝내지 않고
 *   '클러치 마지막 1포제션 선택지(pendingClutchPossession: true)'를 발동합니다!
 */
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
  const stats = career.stats;
  const ovr = calculateOvr(stats, career.primaryPos, career.heightCm);
  const ldr =
    liveGame.gameType === 'ASIAN_GAMES_FINAL'
      ? 72
      : LEAGUE_CONFIG[career.league].ldr;
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const tacticMods: Record<
    LiveTacticId,
    {
      usageMult: number;
      fgBonus: number;
      defBonus: number;
      astBonus: number;
      staminaDrain: number;
      foulRisk: number;
      label: string;
    }
  > = {
    ACE_HERO: {
      usageMult: 1.42,
      fgBonus: -0.02,
      defBonus: -1.5,
      astBonus: 0.72,
      staminaDrain: 24,
      foulRisk: 0.25,
      label: '에이스 모드 (공격 주도)',
    },
    LOCKDOWN_DEFENSE: {
      usageMult: 0.88,
      fgBonus: 0.01,
      defBonus: 4.5,
      astBonus: 0.95,
      staminaDrain: 21,
      foulRisk: 0.4,
      label: '질식 수비 (상대 에이스 봉쇄)',
    },
    UNSELFISH_PASS: {
      usageMult: 1.0,
      fgBonus: 0.035,
      defBonus: 1.2,
      astBonus: 1.45,
      staminaDrain: 16,
      foulRisk: 0.18,
      label: '이타적 조율 (팀플레이)',
    },
    PACE_CONSERVE: {
      usageMult: 0.72,
      fgBonus: 0.02,
      defBonus: 0.5,
      astBonus: 0.9,
      staminaDrain: 8,
      foulRisk: 0.1,
      label: '체력 안배 (페이스 조절)',
    },
  };

  const mod = tacticMods[chosenTactic] || tacticMods.ACE_HERO;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const hasIronMan =
    traits.includes('IRON_STAMINA') || career.growthDna === 'IRONMAN';

  const curStamina = liveGame.playerStats.stamina;
  const staminaFactor =
    curStamina < 35 ? 0.78 : curStamina < 60 ? 0.91 : 1.0;
  const momentumBonus =
    liveGame.momentum === 'HOT'
      ? 0.05
      : liveGame.momentum === 'COLD'
      ? -0.04
      : 0;
  const fourthQuarterClutch = nextQ >= 4 && hasClutchTrait ? 0.065 : 0;

  const baseFga = isOvertime ? 3 : 5;
  const qFga = Math.max(
    1,
    Math.round(
      baseFga *
        mod.usageMult *
        (0.85 + (stats.ins + stats.out) / 220) *
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
      0.25,
      0.72
    ) * staminaFactor;

  let qFgm = 0;
  let qTpa = 0;
  let qTpm = 0;
  for (let i = 0; i < qFga; i++) {
    const isThreeAttempt =
      stats.out >= 58 &&
      rng() <
        clamp(
          (stats.out - 42) / 105 + (hasSniperTrait ? 0.1 : 0),
          0.12,
          0.55
        );
    if (isThreeAttempt) {
      qTpa++;
      if (rng() < rawFgProb * 0.86) {
        qFgm++;
        qTpm++;
      }
    } else if (rng() < rawFgProb) {
      qFgm++;
    }
  }

  const freeThrows =
    chosenTactic === 'ACE_HERO' && rng() < 0.65
      ? Math.floor(1 + rng() * 3)
      : rng() < 0.35
      ? 1
      : 0;
  const qPts = qFgm * 2 + qTpm + freeThrows;

  const qReb = Math.max(
    0,
    Math.round(
      (1.2 + (stats.reb / 100) * 3.2) *
        mismatch.rebMultiplier *
        (isOvertime ? 0.6 : 1.0) *
        (0.6 + rng() * 0.8)
    )
  );
  const qAst = Math.max(
    0,
    Math.round(
      (0.8 + (stats.ply / 100) * 2.8) *
        mod.astBonus *
        (isOvertime ? 0.6 : 1.0) *
        (0.6 + rng() * 0.8)
    )
  );
  const qStl =
    rng() <
    clamp(
      (stats.def / 100) * 0.45 +
        (chosenTactic === 'LOCKDOWN_DEFENSE' ? 0.18 : 0),
      0.05,
      0.65
    )
      ? 1
      : 0;
  const qBlk =
    rng() <
    clamp((stats.def / 100) * 0.38 * mismatch.blkMultiplier, 0.02, 0.55)
      ? 1
      : 0;

  const baseQuarterPoints = isOvertime ? 10 : 21;
  const teamSupportPts = Math.round(
    baseQuarterPoints * (0.72 + rng() * 0.32) + qAst * 1.65 - qFga * 0.55
  );
  let myQScore = Math.max(isOvertime ? 6 : 14, qPts + teamSupportPts);

  const oppAdvantage =
    (liveGame.opponentTeam.rating - (ldr + (ovr - ldr) * 0.5)) * 0.25;
  const defSuppression =
    mod.defBonus +
    (stats.def - ldr) * 0.08 +
    (qStl + qBlk) * 1.4 -
    bio.perimeterDefPenalty * 0.15;
  let oppQScore = Math.max(
    isOvertime ? 5 : 13,
    Math.round(
      (isOvertime ? 11 : 23) +
        oppAdvantage -
        defSuppression * 0.65 +
        (rng() - 0.5) * 7
    )
  );

  let nextTeamScore = liveGame.teamScore + myQScore;
  let nextOppScore = liveGame.oppScore + oppQScore;

  // 🔥 4쿼터 종료 1분 전 클러치 마지막 1포제션 드라마 연출:
  // 4쿼터(nextQ === 4)이고 아직 클러치 선택을 하지 않았을 때,
  // 종료 14.2초 전 1점(또는 2점) 열세의 극적인 원포제션 승부처로 진입!
  let triggerClutchPossession = false;
  let clutchSituationText: string | undefined = undefined;

  if (nextQ === 4 && !liveGame.clutchPossessionResolved) {
    triggerClutchPossession = true;
    // 종료 14.2초 전 1점 뒤진(또는 2점 뒤진) 극적인 원포제션 상황으로 스코어링 조율
    const deficit = rng() < 0.65 ? 1 : 2;
    oppQScore = Math.max(12, nextTeamScore + deficit - liveGame.oppScore);
    nextOppScore = liveGame.oppScore + oppQScore;
    if (nextOppScore <= nextTeamScore) {
      nextTeamScore = nextOppScore - deficit;
      myQScore = Math.max(10, nextTeamScore - liveGame.teamScore);
    }
    const curDiff = nextOppScore - nextTeamScore;
    clutchSituationText = `⏱️ 4쿼터 종료 14.2초 전! 스코어 ${nextTeamScore}:${nextOppScore} (${curDiff}점 차 열세) — 작전타임 직후 마지막 공격권이 ${career.name} 선수의 손에 들려 있어요!`;
  } else if (nextQ >= 5 && nextTeamScore === nextOppScore) {
    if (ovr + (hasClutchTrait ? 4 : 0) >= liveGame.opponentTeam.rating) {
      oppQScore = Math.max(4, oppQScore - 2);
    } else {
      oppQScore += 2;
    }
    nextOppScore = liveGame.oppScore + oppQScore;
  }

  const nextMomentum: 'HOT' | 'NEUTRAL' | 'COLD' =
    qPts >= 8 || myQScore - oppQScore >= 5
      ? 'HOT'
      : qFgm === 0 && qFga >= 4
      ? 'COLD'
      : 'NEUTRAL';

  const drain = Math.round(
    mod.staminaDrain *
      (hasIronMan ? 0.72 : 1.0) *
      bio.staminaDrainMultiplier
  );
  const nextStamina = clamp(
    curStamina - drain + (chosenTactic === 'PACE_CONSERVE' ? 6 : 0),
    10,
    100
  );
  const addedFoul = rng() < mod.foulRisk ? 1 : 0;
  const nextFouls = Math.min(5, liveGame.playerStats.fouls + addedFoul);

  const qLabel = isOvertime ? `OT${nextQ - 4}` : `${nextQ}Q`;
  const pbp: string[] = [];
  pbp.push(`[${qLabel}] 벤치에서 '${mod.label}' 전술 지시가 하달됩니다.`);

  if (qPts >= 7) {
    pbp.push(
      `🔥 ${career.name}, 폭발적인 득점력! ${qLabel}에만 ${qPts}득점(${
        qTpm > 0 ? `3점슛 ${qTpm}방 포함` : '인사이드 돌파'
      })을 쓸어 담으며 코트를 지배합니다!`
    );
  } else if (qAst >= 3) {
    pbp.push(
      `🎯 ${career.name}의 송곳 같은 패스워크! 수비를 흔들고 동료의 오픈 찬스를 살리며 ${qAst}어시스트를 배달합니다.`
    );
  } else if (qPts <= 2 && qFga >= 4) {
    pbp.push(
      `🧱 ${liveGame.opponentTeam.shortName}의 강한 압박 수비에 ${career.name}의 야투가 림을 외면합니다 (${qFgm}/${qFga}).`
    );
  } else {
    pbp.push(
      `⚡ ${career.name}, 공수에서 침착하게 흐름을 조율하며 ${qPts}점 ${qReb}리바운드 ${qAst}도움을 기록합니다.`
    );
  }

  if (triggerClutchPossession && clutchSituationText) {
    pbp.push(`🚨 [클러치 타임 돌입] ${clutchSituationText}`);
  } else if (qBlk > 0 || qStl > 0) {
    pbp.push(
      `🛡️ 결정적인 수비 하이라이트! ${career.name} 선수가 ${
        qBlk > 0 ? '호쾌한 블록슛' : '번개 같은 스틸'
      }로 ${liveGame.opponentTeam.shortName}의 공격 흐름을 끊어냅니다!`
    );
  } else if (myQScore >= oppQScore + 4) {
    pbp.push(
      `📈 ${liveGame.playerTeam.shortName}의 팀워크가 빛을 발하며 쿼터 스코어 ${myQScore}-${oppQScore}로 앞서 나갑니다.`
    );
  } else {
    pbp.push(
      `⚔️ 양 팀의 치열한 시소게임 끝에 누적 스코어 ${nextTeamScore}:${nextOppScore}로 ${qLabel}가 종료됩니다.`
    );
  }

  const updatedPlayerStats = {
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

  const logEntry: LiveQuarterLog = {
    quarter: nextQ,
    label: qLabel,
    teamPts: myQScore,
    oppPts: oppQScore,
    playerPts: qPts,
    playerReb: qReb,
    playerAst: qAst,
    playByPlay: pbp,
  };

  if (triggerClutchPossession) {
    return {
      ...liveGame,
      quarter: nextQ,
      isFinished: false,
      pendingClutchPossession: true,
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
 * 🔥 4쿼터 종료 직전 '클러치 마지막 1포제션' 선택지를 판정하여 최종 승패를 결정합니다.
 * - 'ISO_WINNER': 내가 직접 아이솔레이션 위닝샷 시도 (INS/OUT 능력치 + CLUTCH_PERFORMER + 체력 반영)
 * - 'KICKOUT_ASSIST': 더블팀을 유인해 코너 오픈 동료에게 킥아웃 패스 (PLY 능력치 + 팀 전력 + 기민성 반영)
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
  const ldr =
    liveGame.gameType === 'ASIAN_GAMES_FINAL'
      ? 72
      : LEAGUE_CONFIG[career.league].ldr;
  const traits = career.traits || [];
  const hasClutchTrait = traits.includes('CLUTCH_PERFORMER');
  const hasSniperTrait = traits.includes('SNIPER');
  const bio = calculateBiomechanicalProfile(career.heightCm, career.primaryPos);

  const staminaMod =
    liveGame.playerStats.stamina >= 50
      ? 0.04
      : liveGame.playerStats.stamina < 25
      ? -0.08
      : 0;
  const clutchBonus = hasClutchTrait ? 0.14 : 0;

  let successProb = 0.5;
  if (choice === 'ISO_WINNER') {
    const scoringSkill = Math.max(stats.ins, stats.out) * 0.65 + Math.min(stats.ins, stats.out) * 0.35;
    successProb = clamp(
      0.48 +
        (scoringSkill - ldr) * 0.012 +
        clutchBonus +
        (hasSniperTrait ? 0.05 : 0) +
        staminaMod -
        bio.positionalPhysicsStrain * 0.12,
      0.22,
      0.86
    );
  } else {
    const passSkill = stats.ply * 0.7 + liveGame.playerTeam.rating * 0.3;
    successProb = clamp(
      0.5 +
        (passSkill - ldr) * 0.012 +
        clutchBonus * 0.8 +
        staminaMod -
        bio.tovRatePenalty * 0.08,
      0.25,
      0.86
    );
  }

  const succeeded = rng() < successProb;
  const nextStats = { ...liveGame.playerStats };
  let nextTeamScore = liveGame.teamScore;
  let nextOppScore = liveGame.oppScore;
  let clutchPlayLine = '';
  let customClutchNote = '';

  // 승리하기 위해 필요한 득점 (1~2점 열세이므로 3점 버저비터 또는 앤드원 3점 플레이로 역전승!)
  const pointsAdded = 3;

  if (choice === 'ISO_WINNER') {
    nextStats.fga += 1;
    nextStats.tpa += 1;
    if (succeeded) {
      nextStats.fgm += 1;
      nextStats.tpm += 1;
      nextStats.pts += pointsAdded;
      nextTeamScore += pointsAdded;
      if (nextTeamScore <= nextOppScore) {
        nextTeamScore = nextOppScore + 1;
      }
      clutchPlayLine = `🚨 [버저비터 위닝샷 작렬!] 종료 버저와 함께 ${career.name} 선수가 수비수 두 명 위로 솟구쳐 올라 던진 역전 클러치 3점포가 그물을 가릅니다! (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `${career.name} 경기 종료 버저비터 위닝샷 작렬!`;
    } else {
      if (nextTeamScore >= nextOppScore) {
        nextOppScore = nextTeamScore + 1;
      }
      clutchPlayLine = `😢 [아쉬운 림 외면] ${career.name} 선수가 마지막 회심의 아이솔레이션 위닝샷을 던졌으나 림 안쪽을 맞고 튀어 나오며 종료 버저가 울립니다 (${nextTeamScore}:${nextOppScore}).`;
      customClutchNote = '마지막 클러치 위닝샷 불발';
    }
  } else {
    if (succeeded) {
      nextStats.ast += 1;
      nextTeamScore += pointsAdded;
      if (nextTeamScore <= nextOppScore) {
        nextTeamScore = nextOppScore + 1;
      }
      clutchPlayLine = `🧠 [환상적인 클러치 킥아웃 어시스트!] ${career.name} 선수가 수비수 3명을 순식간에 끌어들인 뒤 반대편 코너 오픈 동료에게 노룩 패스를 배달! 종료 버저와 함께 역전 3점슛이 꽂힙니다! (${nextTeamScore}:${nextOppScore})`;
      customClutchNote = `${career.name} 결승 위닝 킥아웃 어시스트 기록!`;
    } else {
      if (nextTeamScore >= nextOppScore) {
        nextOppScore = nextTeamScore + 1;
      }
      clutchPlayLine = `😢 [뼈아픈 마지막 포제션] ${career.name} 선수의 킥아웃 패스를 이어받은 코너 동료의 오픈 3점슛이 림을 돌아 나오며 경기가 그대로 종료됩니다 (${nextTeamScore}:${nextOppScore}).`;
      customClutchNote = '마지막 코너 킥아웃 찬스 무산';
    }
  }

  const updatedLogs = [...liveGame.quarterLogs];
  if (updatedLogs.length > 0) {
    const lastIdx = updatedLogs.length - 1;
    const prevLog = updatedLogs[lastIdx];
    updatedLogs[lastIdx] = {
      ...prevLog,
      teamPts: prevLog.teamPts + (nextTeamScore - liveGame.teamScore),
      oppPts: prevLog.oppPts + (nextOppScore - liveGame.oppScore),
      playerPts: prevLog.playerPts + (nextStats.pts - liveGame.playerStats.pts),
      playerAst: prevLog.playerAst + (nextStats.ast - liveGame.playerStats.ast),
      playByPlay: [...prevLog.playByPlay, clutchPlayLine],
    };
  }

  const finalOutcome = buildFinalOutcome(
    liveGame,
    career,
    nextTeamScore,
    nextOppScore,
    nextStats,
    customClutchNote
  );

  return {
    ...liveGame,
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
  while (!current.isFinished && guard < 10) {
    if (current.pendingClutchPossession) {
      const autoChoice: ClutchChoiceId =
        career.stats.ply > Math.max(career.stats.ins, career.stats.out) + 5
          ? 'KICKOUT_ASSIST'
          : 'ISO_WINNER';
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
