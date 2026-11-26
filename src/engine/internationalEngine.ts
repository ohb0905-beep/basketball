import {
  AsianGamesMatchLog,
  AsianGamesTournamentResult,
  CareerState,
  InternationalTournamentResult,
  InternationalTournamentType,
  LiveGameState,
  TeamInfo,
} from '../types/game';
import {
  ASIAN_NATIONAL_TEAMS,
  getNationalTeamsForTournament,
} from '../data/teams';
import {
  INTERNATIONAL_TOURNAMENT_CONFIG,
  clampNum,
} from '../config/balanceConfig';
import {
  calculateBiomechanicalProfile,
  calculateOvr,
} from './statCalculator';

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
  const clutchBonus = (career.traits || []).includes('CLUTCH_PERFORMER') ? 1.5 : 0;
  const aceContribution = clampNum(
    (ovr - 71) * cfg.aceRatingWeight + clutchBonus,
    -3.5,
    cfg.aceRatingMaxBonus
  );
  const rating =
    cfg.baseKorRating + aceContribution - bio.positionalPhysicsStrain * 3.8;
  return Number(clampNum(rating, 68, 87).toFixed(1));
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
  const baseWinBias = 0.5;

  const playMatch = (
    stage: 'GROUP' | 'QUARTERFINAL' | 'SEMIFINAL',
    stageLabel: string,
    opp: TeamInfo
  ): AsianGamesMatchLog => {
    const winProb = clampNum(
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

  // 1. 조별리그 3경기 (최소 2승 또는 1승 2패 득실차 >= 0 시 8강 토너먼트 진출)
  const groupMatches: AsianGamesMatchLog[] = [];
  groupOpponents.slice(0, 3).forEach((opp, idx) => {
    const m = playMatch('GROUP', `조별리그 ${idx + 1}차전`, opp);
    matches.push(m);
    groupMatches.push(m);
  });
  const groupWins = groupMatches.filter((m) => m.won).length;
  const groupLosses = groupMatches.length - groupWins;
  const groupPointDiff = groupMatches.reduce(
    (sum, m) => sum + (m.korScore - m.oppScore),
    0
  );
  const qualifiedFromGroup =
    groupWins >= 2 || (groupWins === 1 && groupPointDiff >= 0);
  if (!qualifiedFromGroup) {
    return {
      tournamentType,
      tournamentName: cfg.name,
      reachedFinals: false,
      reachedBronzeMatch: false,
      eliminatedStage: 'GROUP',
      finalOpponent: null,
      bronzeOpponent: null,
      korEffectiveRating,
      matches,
      summaryHeadline: `${cfg.shortName} 조별리그 탈락 — 대한민국, 조별리그 ${groupWins}승 ${groupLosses}패(득실 ${
        groupPointDiff >= 0 ? `+${groupPointDiff}` : groupPointDiff
      })로 본선 토너먼트 진출 실패`,
    };
  }

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
