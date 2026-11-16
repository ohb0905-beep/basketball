import {
  CareerState,
  LeagueId,
  LiveGameState,
  LiveQuarterLog,
  LiveTacticId,
  PlayoffBracketState,
  PlayoffSeriesMatchup,
  StandingEntry,
  TeamInfo,
} from '../types/game';
import { getTeamsByLeague } from '../data/teams';
import { LEAGUE_CONFIG } from '../data/leagues';
import { calculateOvr, calculateHeightMismatchPenalty } from './statCalculator';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getPlayoffCutoffByLeague(league: LeagueId, totalTeams: number): number {
  if (league === 'NBA') return Math.min(8, totalTeams);
  if (league === 'KBL' || league === 'OVERSEAS' || league === 'GLEAGUE') {
    return Math.min(6, totalTeams);
  }
  return Math.min(4, totalTeams);
}

/**
 * 리그 전체 구단의 정규시즌 최종 순위표를 동적 생성합니다.
 * 특정 구단 ID나 배열 인덱스를 하드코딩하지 않고, teamRatingsMap과 팀 기조(direction), 시즌 변동을 반영합니다.
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
  const cutoff = getPlayoffCutoffByLeague(career.league, fullPool.length);

  const rawEntries = fullPool.map((team) => {
    const isPlayer = team.id === career.team.id;
    const dynamicRating = career.teamRatingsMap?.[team.id] ?? team.rating;

    if (isPlayer) {
      const winPct = Number(
        (playerWins / Math.max(1, playerWins + playerLosses)).toFixed(3)
      );
      return {
        rank: 1,
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
        ? 0.06
        : team.direction === 'REBUILDING'
        ? -0.07
        : 0;
    const ldrBase = LEAGUE_CONFIG[career.league].ldr;
    const expectedWinPct = clamp(
      0.5 +
        (dynamicRating - ldrBase * 0.94) * 0.018 +
        directionMod +
        (rng() - 0.5) * 0.14,
      0.15,
      0.86
    );
    const wins = clamp(Math.round(totalGames * expectedWinPct), 1, totalGames - 1);
    const losses = Math.max(0, totalGames - wins);
    const winPct = Number((wins / Math.max(1, wins + losses)).toFixed(3));

    return {
      rank: 1,
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
          ? '플레이오프 1라운드 (8강)'
          : roundNumber === 2
          ? '컨퍼런스 결승 (4강)'
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
  playerTeamId: string
): PlayoffSeriesMatchup {
  const OrderedHi = higher.rank <= lower.rank ? higher : lower;
  const OrderedLo = higher.rank <= lower.rank ? lower : higher;
  return {
    id,
    roundNumber,
    roundLabel,
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
      `(${OrderedHi.rank}위) ${OrderedHi.team.shortName} vs (${OrderedLo.rank}위) ${OrderedLo.team.shortName} 대진 확정`,
    ],
  };
}

/**
 * 정규시즌 순위표를 바탕으로 포스트시즌 사다리 대진표를 생성합니다.
 */
export function createPlayoffBracket(
  career: CareerState,
  standings: StandingEntry[]
): PlayoffBracketState {
  const cutoff = getPlayoffCutoffByLeague(career.league, standings.length);
  const qualified = standings.slice(0, cutoff);
  const playerStanding =
    standings.find((s) => s.isPlayerTeam) || standings[standings.length - 1];
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

  if (cutoff === 8 && qualified.length >= 8) {
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
  } else if (cutoff === 6 && qualified.length >= 6) {
    // 6강 PO: 1위, 2위는 4강 부전승 직행, (4 vs 5), (3 vs 6) 대진
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
    // 4강: (1 vs 4), (2 vs 3)
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
  const ldr = LEAGUE_CONFIG[career.league].ldr;
  const mismatch = calculateHeightMismatchPenalty(career.heightCm, career.primaryPos);
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER') ? 1.8 : 0;

  const playerBonus =
    clamp((ovr - ldr) * 0.38 + clutchBonus, -5, 9.0) -
    mismatch.scoutingPenalty * 0.15;

  const hiEffective =
    series.higherSeed.team.rating +
    1.5 + // 상위 시드 홈코트 어드밴티지
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
    return roundNumber === 1 ? '8강 PO 탈락' : '컨퍼런스 결승 탈락';
  }
  if (league === 'KBL' || league === 'OVERSEAS' || league === 'GLEAGUE') {
    return roundNumber === 1 ? '6강 PO 탈락' : '4강 PO 탈락';
  }
  return '4강 PO 탈락';
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

  // 결승 라운드에 플레이어 팀이 포함되어 있고 아직 미진행이면 라이브 중계 진입 플래그 활성화
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

  // 결승 라운드 종료 시 우승팀 확정
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

  // 다음 라운드 대진표 생성
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

  if (cutoff === 6 && currentRoundIdx === 1 && standings.length >= 2) {
    // 6강 PO 승자 2팀 + 정규시즌 1, 2위 합류 -> 4강 PO: (1위 vs 4/5위 승자), (2위 vs 3/6위 승자)
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
  while (!current.championTeamId && current.rounds.length > 0 && guard < 6) {
    current = advancePlayoffRound(current, career, standings, rng, true);
    guard++;
  }
  return current;
}

/**
 * 결승전(리그 파이널 또는 아시안게임 결승) 실시간 쿼터별 중계 상태를 생성합니다.
 */
export function createLiveFinalGame(
  career: CareerState,
  opponentTeam: TeamInfo,
  gameType: 'LEAGUE_FINALS' | 'ASIAN_GAMES_FINAL'
): LiveGameState {
  const isAsianGames = gameType === 'ASIAN_GAMES_FINAL';
  const playerTeam: TeamInfo = isAsianGames
    ? {
        id: 'KOR_NAT_TEAM',
        name: '대한민국 남자농구 국가대표팀',
        shortName: '대한민국',
        city: '서울',
        league: career.league,
        rating: 74,
        primaryColor: '#1D4ED8',
        secondaryColor: '#EF4444',
        prestigeDesc: '태극마크를 달고 아시안게임 금메달과 병역특례에 도전하는 국가대표팀이에요.',
        direction: 'CONTENDER',
      }
    : career.team;

  const title = isAsianGames
    ? `${career.seasonYear} 아시안게임 남자농구 결승전 (병역특례 결정전)`
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

/**
 * 실시간 결승전 중계의 다음 쿼터(1Q -> 2Q -> 3Q -> 4Q -> 동점 시 OT)를 시뮬레이션합니다.
 */
export function simulateLiveQuarter(
  liveGame: LiveGameState,
  career: CareerState,
  tactic?: LiveTacticId,
  rng: () => number = Math.random
): LiveGameState {
  if (liveGame.isFinished) return liveGame;

  const chosenTactic = tactic || liveGame.currentTactic || 'UNSELFISH_PASS';
  const nextQ = liveGame.quarter + 1;
  const isOvertime = nextQ > 4;
  const stats = career.stats;
  const ovr = calculateOvr(stats, career.primaryPos, career.heightCm);
  const ldr =
    liveGame.gameType === 'ASIAN_GAMES_FINAL'
      ? 71
      : LEAGUE_CONFIG[career.league].ldr;
  const mismatch = calculateHeightMismatchPenalty(
    career.heightCm,
    career.primaryPos
  );

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
      label: '에이스 난사 (공격 집중)',
    },
    LOCKDOWN_DEFENSE: {
      usageMult: 0.88,
      fgBonus: 0.01,
      defBonus: 4.5,
      astBonus: 0.95,
      staminaDrain: 21,
      foulRisk: 0.4,
      label: '집중 마크 (수비 강화)',
    },
    UNSELFISH_PASS: {
      usageMult: 1.0,
      fgBonus: 0.035,
      defBonus: 1.2,
      astBonus: 1.45,
      staminaDrain: 16,
      foulRisk: 0.18,
      label: '이타적 패스 (팀플레이)',
    },
    PACE_CONSERVE: {
      usageMult: 0.72,
      fgBonus: 0.02,
      defBonus: 0.5,
      astBonus: 0.9,
      staminaDrain: 8,
      foulRisk: 0.1,
      label: '페이스 조절 (체력 안배)',
    },
  };

  const mod = tacticMods[chosenTactic];
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
      rng() < clamp((stats.out - 42) / 105 + (hasSniperTrait ? 0.1 : 0), 0.12, 0.55);
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
  const myQScore = Math.max(isOvertime ? 6 : 14, qPts + teamSupportPts);

  const oppAdvantage =
    (liveGame.opponentTeam.rating - (ldr + (ovr - ldr) * 0.5)) * 0.25;
  const defSuppression =
    mod.defBonus +
    (stats.def - ldr) * 0.08 +
    (qStl + qBlk) * 1.4;
  let oppQScore = Math.max(
    isOvertime ? 5 : 13,
    Math.round(
      (isOvertime ? 11 : 23) +
        oppAdvantage -
        defSuppression * 0.65 +
        (rng() - 0.5) * 7
    )
  );

  const nextTeamScore = liveGame.teamScore + myQScore;
  let nextOppScore = liveGame.oppScore + oppQScore;

  // 연장전(5Q+)에서도 동점이면 승부가 나도록 보정
  if (nextQ >= 5 && nextTeamScore === nextOppScore) {
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

  const drain = Math.round(mod.staminaDrain * (hasIronMan ? 0.72 : 1.0));
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

  if (qBlk > 0 || qStl > 0) {
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

  const isGameFinished = nextQ >= 4 && nextTeamScore !== nextOppScore;

  let finalOutcome: LiveGameState['finalOutcome'] = undefined;
  if (isGameFinished) {
    const won = nextTeamScore > nextOppScore;
    const gameScore =
      updatedPlayerStats.pts +
      updatedPlayerStats.reb * 1.2 +
      updatedPlayerStats.ast * 1.5 +
      (updatedPlayerStats.stl + updatedPlayerStats.blk) * 2;
    const wonFinalsMvp =
      won && liveGame.gameType === 'LEAGUE_FINALS' && gameScore >= 22;
    const grantedMilitaryExemption =
      won && liveGame.gameType === 'ASIAN_GAMES_FINAL';

    const headline =
      liveGame.gameType === 'ASIAN_GAMES_FINAL'
        ? won
          ? `🏅 [아시안게임 금메달] ${career.name}, 결승전 ${updatedPlayerStats.pts}점 ${updatedPlayerStats.reb}리바운드 ${updatedPlayerStats.ast}도움 맹활약! 금메달 및 병역특례 획득!`
          : `🥈 [아시안게임 은메달] 대한민국, ${liveGame.opponentTeam.name}에 ${nextTeamScore}-${nextOppScore} 석패... 아쉬운 준우승`
        : won
        ? `🏆 [챔피언 등극] ${liveGame.playerTeam.name}, ${liveGame.opponentTeam.name} 꺾고 정상 등극! ${career.name} ${updatedPlayerStats.pts}점 폭발${
            wonFinalsMvp ? ' (파이널 MVP 수상!)' : ''
          }`
        : `💔 [파이널 준우승] ${liveGame.playerTeam.name}, 최종전 끝 ${nextTeamScore}-${nextOppScore} 석패... 아쉬운 준우승`;

    finalOutcome = {
      won,
      wonFinalsMvp,
      grantedMilitaryExemption,
      headline,
    };
  }

  return {
    ...liveGame,
    quarter: nextQ,
    isFinished: isGameFinished,
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
 * 실시간 결승전 경기를 남은 쿼터 모두 즉시 시뮬레이션하여 최종 결과로 이동합니다.
 */
export function skipLiveGameToEnd(
  liveGame: LiveGameState,
  career: CareerState,
  rng: () => number = Math.random
): LiveGameState {
  let current = { ...liveGame };
  let guard = 0;
  while (!current.isFinished && guard < 8) {
    current = simulateLiveQuarter(
      current,
      career,
      current.currentTactic || 'UNSELFISH_PASS',
      rng
    );
    guard++;
  }
  return current;
}
