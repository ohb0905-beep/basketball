import { LEAGUE_CONFIG } from '../data/leagues';
import {
  getTeamsByLeague,
  SANGMU_TEAM,
  selectBestFitTeamForPlayer,
} from '../data/teams';
import {
  CareerState,
  CombineState,
  ContractType,
  OffseasonOption,
  TeamInfo,
} from '../types/game';
import { checkRetirementEligibility } from './retirementEngine';
import { getContractDefaultSalary } from './seasonSimulator';

export interface HighSchoolProspectEvaluation {
  stars: 1 | 2 | 3 | 4 | 5;
  compositeScore: number;
  avgPpg: number;
  avgRpg: number;
  avgApg: number;
  championships: number;
  mvps: number;
  summary: string;
}

/**
 * 3-2. 고교 3년 누적 기록, 수상, OVR, 잠재력을 종합 평가하여 유망주 스카우팅 등급(1성~5성) 산출
 */
export function evaluateHighSchoolProspect(
  career: CareerState
): HighSchoolProspectEvaluation {
  const hsLogs = career.seasonLogs.filter((l) => l.league === 'HIGH_SCHOOL');
  const totalGp = hsLogs.reduce((acc, l) => acc + l.gp, 0);
  const avgPpg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.ppg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgRpg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.rpg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgApg =
    totalGp > 0
      ? Number(
          (hsLogs.reduce((acc, l) => acc + l.apg * l.gp, 0) / totalGp).toFixed(1)
        )
      : 0;
  const avgStk =
    totalGp > 0
      ? Number(
          (
            hsLogs.reduce((acc, l) => acc + (l.spg + l.bpg) * l.gp, 0) / totalGp
          ).toFixed(1)
        )
      : 0;
  const championships = hsLogs.filter((l) => l.wonChampionship).length;
  const mvps = hsLogs.filter((l) => l.wonMvp || l.wonDpoy).length;

  const compositeScore = Number(
    (
      (career.ovr - LEAGUE_CONFIG.HIGH_SCHOOL.ldr) * 3.0 +
      avgPpg * 1.65 +
      avgRpg * 0.85 +
      avgApg * 1.15 +
      avgStk * 2.2 +
      championships * 8 +
      mvps * 10
    ).toFixed(1)
  );

  let stars: 1 | 2 | 3 | 4 | 5 = 1;
  if (compositeScore >= 82 && avgPpg >= 20.0) {
    stars = 5;
  } else if (compositeScore >= 64 && avgPpg >= 16.0) {
    stars = 4;
  } else if (compositeScore >= 46 || championships >= 1 || mvps >= 1) {
    stars = 3;
  } else if (compositeScore >= 28 || avgPpg >= 9.0) {
    stars = 2;
  }

  const starLabels: Record<number, string> = {
    5: '⭐⭐⭐⭐⭐ (5성급 초고교급 글로벌 유망주)',
    4: '⭐⭐⭐⭐ (4성급 전국구 톱클래스 유망주)',
    3: '⭐⭐⭐ (3성급 대학/얼리 드래프트 유망주)',
    2: '⭐⭐ (2성급 성장형 고교 유망주)',
    1: '⭐ (1성급 원석 유망주)',
  };

  return {
    stars,
    compositeScore,
    avgPpg,
    avgRpg,
    avgApg,
    championships,
    mvps,
    summary: `${starLabels[stars]} · 고교 평균 ${avgPpg}점 ${avgRpg}리바운드 ${avgApg}도움`,
  };
}

export interface ScoutingEvaluationResult {
  scoutingScore: number;
  realGameCompetence: boolean;
  positionFitBonus: number;
  passesOfferThreshold: boolean;
  recommendedContract: ContractType;
  rejectionReason?: string;
}

/**
 * 3-3. 다차원 구단 스카우팅 AI 엔진 (고정 OVR 기준 완전 폐기)
 * [① 직전 1~2시즌 실전 성적 및 슈팅 효율 + ② 소속 리그 수비 수준(LDR) 환산 +
 *  ③ 나이/성장 DNA(조숙형·대기만성·철강왕) + ④ 구단 기조(리빌딩/플옵/컨텐더) 및 포지션 니즈] 종합 분석
 */
export function evaluateTeamScouting(
  career: CareerState,
  targetTeam: TeamInfo,
  rng: () => number = Math.random
): ScoutingEvaluationResult {
  const recentLogs = career.seasonLogs.slice(-2);
  const lastLog = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null;
  const prevLog = recentLogs.length > 1 ? recentLogs[0] : null;

  const currentLeagueCfg = LEAGUE_CONFIG[career.league];
  const targetLeagueCfg = LEAGUE_CONFIG[targetTeam.league];

  // ① 직전 1~2시즌 실전 퍼포먼스 및 슈팅 효율 검증
  // 평균 득점이 1~2점대에 불과하거나 출전 시간/효율이 현저히 낮으면 OVR이 높아도 실전 경쟁력 미달로 판정
  let realGameCompetence = true;
  let perfIndex = 12;
  let efficiencyBonus = 0;

  if (lastLog) {
    const calcVolume = (log: typeof lastLog) =>
      log.ppg * 1.15 +
      log.rpg * 0.72 +
      log.apg * 0.92 +
      (log.spg + log.bpg) * 2.1;

    const lastVol = calcVolume(lastLog);
    const prevVol = prevLog ? calcVolume(prevLog) : lastVol;
    const weightedVolume = prevLog ? lastVol * 0.7 + prevVol * 0.3 : lastVol;

    if (
      lastLog.ppg < 4.0 ||
      lastLog.mpg < 9.0 ||
      (lastLog.fgPct < 38.5 && lastLog.tpPct < 29.0) ||
      weightedVolume < 7.5
    ) {
      realGameCompetence = false;
    }

    efficiencyBonus =
      (lastLog.fgPct - 44.0) * 0.45 + (lastLog.tpPct - 34.0) * 0.35;
    perfIndex = weightedVolume * 0.85 + efficiencyBonus;
  }

  // ② 소속 리그 수비 저항치(LDR) 환산 계수
  const ldrRatio = currentLeagueCfg.ldr / targetLeagueCfg.ldr;
  const convertedPerf =
    perfIndex * ldrRatio * (0.75 + currentLeagueCfg.prestige * 0.35);

  // ③ 나이, 잠재력 및 선수 고유 성장 DNA (구단 기조별 가중치 차별화)
  const teamDirection = targetTeam.direction || 'PLAYOFF_HUNT';
  const dna = career.growthDna || 'STANDARD';
  const dnaYouthBonus =
    dna === 'LATE_BLOOMER' && career.age >= 23 && career.age <= 29
      ? 4.0
      : dna === 'EARLY_BLOOMER' && career.age <= 22
      ? 3.5
      : dna === 'IRONMAN' && career.age >= 30
      ? 4.5
      : 0;

  let agePotentialScore = dnaYouthBonus;
  if (teamDirection === 'REBUILDING') {
    agePotentialScore +=
      career.age <= 25
        ? (career.potential - targetLeagueCfg.ldr) * 0.55 + (26 - career.age) * 1.8
        : -(career.age - 26) * 2.3;
  } else if (teamDirection === 'CONTENDER') {
    agePotentialScore +=
      (career.stats.def - targetLeagueCfg.ldr) * 0.38 +
      (career.stats.out - targetLeagueCfg.ldr) * 0.32 -
      Math.max(0, career.age - (dna === 'IRONMAN' ? 34 : 32)) * 2.8;
  } else {
    agePotentialScore +=
      (career.potential - targetLeagueCfg.ldr) * 0.35 -
      Math.max(0, career.age - (dna === 'IRONMAN' ? 33 : 31)) * 2.1;
  }

  // ④ 구단 보강 포지션 니즈 적합도 및 스카우트 편차
  const needed = targetTeam.neededPositions || [];
  const positionFitBonus =
    needed.includes(career.primaryPos)
      ? 6.5
      : career.secondaryPos && needed.includes(career.secondaryPos)
      ? 3.8
      : -1.5;

  const scoutVariance = (rng() - 0.5) * 4.5;

  // 구단 현재 전력(targetTeam.rating) 대비 상대적 경쟁력 + 실전 성적 + 포지션 니즈 합산
  const relativeGap = career.ovr - targetTeam.rating;
  const rawScoutingScore =
    61 +
    relativeGap * 1.35 +
    convertedPerf * 1.18 +
    agePotentialScore +
    positionFitBonus +
    scoutVariance -
    (realGameCompetence ? 0 : 24);

  const scoutingScore = Number(
    Math.max(10, Math.min(99, rawScoutingScore)).toFixed(1)
  );

  // 구단 기조 및 리그 위상에 따른 동적 커트라인
  let threshold = 58;
  if (targetTeam.league === 'NBA') {
    threshold =
      teamDirection === 'CONTENDER'
        ? 72
        : teamDirection === 'PLAYOFF_HUNT'
        ? 68
        : 64;
  } else if (
    targetTeam.league === 'OVERSEAS' ||
    targetTeam.league === 'GLEAGUE'
  ) {
    threshold = teamDirection === 'CONTENDER' ? 60 : 56;
  } else if (targetTeam.league === 'KBL') {
    threshold = teamDirection === 'CONTENDER' ? 57 : 53;
  }

  // 노쇠화 베테랑은 구단 전력 대비 경쟁력과 실전 효율을 동시에 충족해야 함
  const veteranDeclineGap = career.ovr - targetLeagueCfg.ldr;
  if (career.age >= 33 && veteranDeclineGap <= -10 && (!lastLog || lastLog.ppg < 5.5)) {
    realGameCompetence = false;
  }

  const passesOfferThreshold = realGameCompetence && scoutingScore >= threshold;

  let recommendedContract: ContractType = 'FREE_AGENT';
  if (targetTeam.league === 'NBA') {
    if (scoutingScore >= 84 && relativeGap >= 3) {
      recommendedContract = 'NBA_MAX';
    } else if (scoutingScore >= 69) {
      recommendedContract = career.age >= 33 ? 'NBA_VET_MIN' : 'NBA_STANDARD';
    } else {
      recommendedContract = 'TWO_WAY';
    }
  } else if (targetTeam.league === 'KBL') {
    recommendedContract =
      scoutingScore >= 67
        ? 'KBL_MAX'
        : career.age >= 32
        ? 'KBL_VET'
        : 'KBL_ROOKIE';
  } else if (targetTeam.league === 'OVERSEAS') {
    recommendedContract = 'OVERSEAS_CONTRACT';
  } else if (targetTeam.league === 'GLEAGUE') {
    recommendedContract = 'GLEAGUE_EXHIBIT';
  } else {
    recommendedContract = 'AMATEUR';
  }

  return {
    scoutingScore,
    realGameCompetence,
    positionFitBonus,
    passesOfferThreshold,
    recommendedContract,
    rejectionReason: !realGameCompetence
      ? '직전 시즌 실전 경기 출전 시간 및 득점/야투 효율 미달'
      : scoutingScore < threshold
      ? `구단 스카우팅 기준 점수(${threshold}점) 미달 (현재 ${scoutingScore}점)`
      : undefined,
  };
}

/**
 * NBA 드래프트 예상 지명 순위 공식 (실전 성적 및 리그 수준 반영)
 */
export function calculateProjectedNbaPick(
  career: Pick<CareerState, 'ovr' | 'draftStock' | 'league'> & {
    seasonLogs?: CareerState['seasonLogs'];
  },
  combineBonus: number = 0
): { nbaReadyScore: number; projectedPick: number; undraftedRisk: boolean } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const lastLog =
    career.seasonLogs && career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const lowPerfPenalty =
    lastLog && (lastLog.ppg < 5.0 || lastLog.mpg < 10.0) ? -14 : 0;

  const nbaReadyScore =
    (career.ovr - (LEAGUE_CONFIG.NBA.ldr - 16)) * 3.5 +
    career.draftStock * leagueConfig.prestige * 0.45 +
    combineBonus +
    lowPerfPenalty;
  const rawPick = Math.round(75 - nbaReadyScore);
  const projectedPick = Math.max(1, Math.min(75, rawPick));
  const undraftedRisk = projectedPick > 58;

  return {
    nbaReadyScore: Number(nbaReadyScore.toFixed(2)),
    projectedPick,
    undraftedRisk,
  };
}

/**
 * 시카고 드래프트 컴바인 초기 상태 생성
 */
export function createInitialCombineState(career: CareerState): CombineState {
  const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(career, 0);
  let scoutingReport = '';

  if (projectedPick <= 14) {
    scoutingReport =
      'NBA 스카우트들이 로터리 픽(1~14순위) 즉시 전력감으로 극찬하고 있어요! 브루클린 그린룸 초청장이 도착했어요.';
  } else if (projectedPick <= 30) {
    scoutingReport =
      '1라운드 지명권(15~30순위) 내에 안정적으로 이름을 올렸어요. 컴바인 워크아웃에서 순위를 더 끌어올려 봐요!';
  } else if (projectedPick <= 58) {
    scoutingReport =
      '2라운드 지명(31~58순위)이 유력해요. 컴바인 드릴과 단장 면접에서 깊은 인상을 남기면 1라운드 진입도 가능해요!';
  } else {
    scoutingReport =
      '현재 예상 순위가 58순위 밖이라 언드래프티 위험이 높아요! 스카우팅 평가가 기준에 미달하면 드래프트 낙방 후 투웨이 오퍼조차 받지 못할 수 있으니 신중히 결정하세요.';
  }

  return {
    completedDrills: [],
    interviewCompleted: false,
    combineBonusScore: 0,
    projectedPick,
    scoutingReport,
    undraftedRisk,
  };
}

/**
 * 드래프트 본 무대 결과 산출 (NBA / KBL)
 * - 모든 구단 풀은 동적 전력(teamRatingsMap)과 포지션 니즈를 반영하여 선택
 */
export function executeDraftResolution(
  career: CareerState,
  draftType: 'NBA' | 'KBL',
  rng: () => number = Math.random
): {
  draftType: 'NBA' | 'KBL';
  pickNumber: number | null;
  round: 1 | 2 | null;
  draftedTeam: TeamInfo | null;
  twoWayOfferTeam: TeamInfo | null;
  scoutingGrade: number;
} {
  if (draftType === 'KBL') {
    const kblTeams = getTeamsByLeague('KBL', career.teamRatingsMap);
    const kblScore =
      (career.ovr - (LEAGUE_CONFIG.KBL.ldr - 12)) * 2.2 + career.draftStock * 0.25;
    const rawPick = Math.round(22 - kblScore + (rng() * 3 - 1.5));
    const pickNumber = Math.max(1, Math.min(20, rawPick));
    const round: 1 | 2 = pickNumber <= 10 ? 1 : 2;

    // 하위 전력(리빌딩) 및 포지션 니즈 구단이 상위 픽을 행사
    const sortedByRatingAsc = [...kblTeams].sort((a, b) => a.rating - b.rating);
    const candidateWindow =
      pickNumber <= 4 ? sortedByRatingAsc.slice(0, 4) : sortedByRatingAsc;
    const posFitCandidates = candidateWindow.filter((t) =>
      t.neededPositions?.includes(career.primaryPos)
    );
    const pool = posFitCandidates.length > 0 ? posFitCandidates : candidateWindow;
    const draftedTeam = pool[Math.floor(rng() * pool.length)] || sortedByRatingAsc[0];

    return {
      draftType: 'KBL',
      pickNumber,
      round,
      draftedTeam,
      twoWayOfferTeam: null,
      scoutingGrade: Math.round(55 + kblScore),
    };
  }

  // NBA 드래프트
  const nbaTeams = getTeamsByLeague('NBA', career.teamRatingsMap);
  const bonus = career.combineState?.combineBonusScore ?? 0;
  const { projectedPick } = calculateProjectedNbaPick(career, bonus);
  const variance = Math.round(rng() * 4 - 2);
  const finalPickCalc = Math.max(1, projectedPick + variance);

  const evaluatedNba = nbaTeams
    .map((team) => ({
      team,
      eval: evaluateTeamScouting(career, team, rng),
    }))
    .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

  const topScouting = evaluatedNba[0];

  if (finalPickCalc > 60) {
    // 언드래프티: 고정 OVR 컷 대신 실전 경쟁력과 스카우팅 점수를 통과한 경우에만 투웨이 오퍼 발생
    const qualifiesForUndraftedTwoWay =
      topScouting.eval.realGameCompetence && topScouting.eval.scoutingScore >= 63;

    return {
      draftType: 'NBA',
      pickNumber: null,
      round: null,
      draftedTeam: null,
      twoWayOfferTeam: qualifiesForUndraftedTwoWay ? topScouting.team : null,
      scoutingGrade: topScouting.eval.scoutingScore,
    };
  }

  const round: 1 | 2 = finalPickCalc <= 30 ? 1 : 2;
  const sortedByRatingAsc = [...nbaTeams].sort((a, b) => a.rating - b.rating);
  const bucketIndex = Math.min(
    sortedByRatingAsc.length - 1,
    Math.max(0, Math.floor(((finalPickCalc - 1) / 60) * sortedByRatingAsc.length))
  );
  const windowTeams = sortedByRatingAsc.slice(
    Math.max(0, bucketIndex - 2),
    Math.min(sortedByRatingAsc.length, bucketIndex + 3)
  );
  const fitTeam = windowTeams.find((t) =>
    t.neededPositions?.includes(career.primaryPos)
  );
  const draftedTeam =
    fitTeam ||
    windowTeams[Math.floor(rng() * windowTeams.length)] ||
    sortedByRatingAsc[bucketIndex];

  return {
    draftType: 'NBA',
    pickNumber: finalPickCalc,
    round,
    draftedTeam,
    twoWayOfferTeam: round === 2 ? draftedTeam : null,
    scoutingGrade: topScouting.eval.scoutingScore,
  };
}

/**
 * 3-3. 투웨이 계약 생존 및 방출 심사 (고정 OVR 기준 제거, 다차원 스카우팅 AI 및 실전 효율 기반)
 */
export function evaluateTwoWaySurvival(
  career: CareerState,
  lastSeasonPpg: number,
  rng: () => number = Math.random
): {
  status: 'PROMOTED' | 'RETAINED_YEAR_2' | 'WAIVED';
  message: string;
} {
  const lastLog =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const mpg = lastLog ? lastLog.mpg : 12.0;
  const fgPct = lastLog ? lastLog.fgPct : 44.0;
  const nonScoringImpact = lastLog
    ? lastLog.rpg * 0.8 + lastLog.apg * 1.1 + (lastLog.spg + lastLog.bpg) * 2.2
    : 4.5;

  const teamScout = evaluateTeamScouting(career, career.team, rng);

  // 실전 공헌도(득점 또는 수비·리바운드·어시스트 기여) + 슈팅 효율 + 구단 스카우팅 통과 시 정식 계약 승격
  const passedPromotionTest =
    (lastSeasonPpg >= 7.0 || (lastSeasonPpg >= 5.2 && nonScoringImpact >= 6.5)) &&
    mpg >= 10.0 &&
    fgPct >= 40.0 &&
    (teamScout.passesOfferThreshold || teamScout.scoutingScore >= 66 || lastSeasonPpg >= 7.0);

  if (passedPromotionTest) {
    return {
      status: 'PROMOTED',
      message: `🎉 축하해요! 투웨이 계약 신분으로 평균 ${lastSeasonPpg.toFixed(
        1
      )}점(FG ${fgPct}%, ${mpg.toFixed(
        1
      )}분)의 알짜배기 실전 활약을 펼쳐 구단 스카우팅 심사 끝에 NBA 정식 보장 계약(Standard Contract) 승격 오퍼를 받았어요!`,
    };
  }

  const severeUnderperformance =
    lastSeasonPpg < 4.0 || fgPct < 38.0 || !teamScout.realGameCompetence;

  if (career.twoWaySeasonsUsed < 2 && !severeUnderperformance && teamScout.scoutingScore >= 58) {
    return {
      status: 'RETAINED_YEAR_2',
      message: `투웨이 1년 차 시즌이 끝났어요. 정식 계약 승격 기준에는 조금 못 미쳤지만, 스카우팅 팀이 성장 잠재력을 인정해 마지막 2년 차 투웨이 기회를 부여했어요!`,
    };
  }

  return {
    status: 'WAIVED',
    message: `⚠️ 투웨이 계약 기간 동안 실전 경쟁력을 증명하지 못해 구단으로부터 웨이버 방출(Waived) 통보를 받았어요. 이제 타 구단 스카우트들의 냉정한 재평가를 거쳐 재취업을 노려야 해요.`,
  };
}

/**
 * 3 & 4. 동적 구단 생태계 및 스카우팅 AI 기반 오프시즌 에이전트 데스크 선택지 생성 (특정 팀 하드코딩 0%)
 */
export function generateOffseasonOptions(
  career: CareerState,
  rng: () => number = Math.random
): OffseasonOption[] {
  const options: OffseasonOption[] = [];
  const lastLog = career.seasonLogs[career.seasonLogs.length - 1];
  const lastPpg = lastLog ? lastLog.ppg : 0;

  const {
    canRetireVoluntarily,
    canDeclareFarewellTour,
    isOutOfLeague,
  } = checkRetirementEligibility(career);

  // 동적 전력 및 기조가 반영된 리그별 구단 풀 조회
  const uLeagueTeams = getTeamsByLeague('U_LEAGUE', career.teamRatingsMap);
  const kblTeams = getTeamsByLeague('KBL', career.teamRatingsMap);
  const ncaaTeams = getTeamsByLeague('NCAA', career.teamRatingsMap);
  const overseasTeams = getTeamsByLeague('OVERSEAS', career.teamRatingsMap);
  const gleagueTeams = getTeamsByLeague('GLEAGUE', career.teamRatingsMap);
  const nbaTeams = getTeamsByLeague('NBA', career.teamRatingsMap);

  // [특수 Case 0] 국군체육부대(상무) 복무 중인 경우
  if (career.militaryServiceSeasonsLeft > 0) {
    options.push({
      id: 'OPT_SANGMU_CONTINUE',
      title: `🫡 ${SANGMU_TEAM.name} 잔여 군 복무 진행 (${career.militaryServiceSeasonsLeft}시즌 남음)`,
      subtitle: '국군체육부대 상무 소속으로 남은 복무 기간 동안 성실히 경기에 출전해요.',
      badgeText: '병역 복무 중',
      targetLeague: 'KBL',
      targetTeam: SANGMU_TEAM,
      contractType: 'MILITARY_SERVICE',
      contractYears: career.militaryServiceSeasonsLeft,
      annualSalary: 5400,
      actionType: 'STAY_TEAM',
    });
    return options;
  }

  // [Case 1] 고교 농구 재학 및 졸업 (만 20세 고교 졸업 시 유망주 평가에 따른 제한적 오퍼만 생성)
  if (career.league === 'HIGH_SCHOOL') {
    if (career.age < 20) {
      options.push({
        id: 'OPT_HS_NEXT_GRADE',
        title: `🏫 ${career.team.name} 다음 학년 진급`,
        subtitle: '고교 무대에서 주전 입지와 전국대회 우승에 도전하며 유망주 스카우트 평점을 높여요.',
        badgeText: '고교 재학',
        targetLeague: 'HIGH_SCHOOL',
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: 1,
        annualSalary: 0,
        actionType: 'STAY_TEAM',
      });
      return options;
    }

    const prospect = evaluateHighSchoolProspect(career);

    // 1) 국내 대학(U-리그): 포지션 니즈와 유망주 등급에 부합하는 1~2개 대학만 스카우트 오퍼 제시
    const eligibleUniversities = uLeagueTeams
      .filter((uni) => {
        if (uni.direction === 'CONTENDER') {
          return prospect.stars >= 3;
        }
        return true;
      })
      .sort((a, b) => {
        const aFit = a.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        const bFit = b.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        return bFit - aFit || (rng() - 0.5);
      });

    const offeredUniversities = eligibleUniversities.slice(
      0,
      prospect.stars >= 3 ? 2 : 1
    );

    for (const uni of offeredUniversities) {
      options.push({
        id: `OPT_ROUTE_A_${uni.id}`,
        title: `🎓 ${uni.name} 스카우트 입학 제의 (${prospect.stars}성 유망주 전형)`,
        subtitle: `${uni.prestigeDesc} (${prospect.summary})`,
        badgeText: '한국 대학 오퍼',
        targetLeague: 'U_LEAGUE',
        targetTeam: uni,
        contractType: 'AMATEUR',
        contractYears: 4,
        annualSalary: 0,
        actionType: 'SIGN_TEAM',
      });
    }

    // 2) KBL 얼리 드래프트: 유망주 등급 3성 이상 또는 전국대회 우승/MVP 입증 시 참가 가능
    const kblEarlyEligible =
      prospect.stars >= 3 ||
      prospect.compositeScore >= 45 ||
      prospect.championships >= 1 ||
      prospect.mvps >= 1;
    if (kblEarlyEligible) {
      options.push({
        id: 'OPT_ROUTE_B_KBL_EARLY',
        title: '🔥 고졸 KBL 신인드래프트 얼리 참가 신청',
        subtitle: `고교 무대에서 입증한 실력(${prospect.stars}성급)을 바탕으로 KBL 프로 무대에 직행해요!`,
        badgeText: '고졸 프로 직행',
        targetLeague: 'KBL',
        contractType: 'KBL_ROOKIE',
        contractYears: 3,
        annualSalary: getContractDefaultSalary('KBL_ROOKIE', career.ovr),
        actionType: 'ENTER_KBL_DRAFT',
      });
    }

    // 3) 미국 NCAA D1 장학금 오퍼: 4성급 이상 초고교급 활약을 펼친 유망주에게만 포지션 니즈가 맞는 1~2개 대학 오퍼 발생
    const maxHsPpg = Math.max(
      prospect.avgPpg,
      ...career.seasonLogs
        .filter((l) => l.league === 'HIGH_SCHOOL')
        .map((l) => l.ppg),
      0
    );
    if (prospect.stars >= 4 && maxHsPpg >= 18.5) {
      const sortedNcaa = [...ncaaTeams].sort((a, b) => {
        const aNeed = a.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        const bNeed = b.neededPositions?.includes(career.primaryPos) ? 1 : 0;
        return bNeed - aNeed || (rng() - 0.5);
      });
      const ncaaOfferCount = prospect.stars === 5 ? 2 : 1;
      for (const ncaaTeam of sortedNcaa.slice(0, ncaaOfferCount)) {
        options.push({
          id: `OPT_ROUTE_C_${ncaaTeam.id}`,
          title: `🇺🇸 ${ncaaTeam.name} D1 전액 장학금 스카우트 오퍼!`,
          subtitle: `고교 최고 평균 ${maxHsPpg.toFixed(1)}점(${prospect.stars}성 유망주) 활약에 반한 미국 D1 명문대의 공식 오퍼예요!`,
          badgeText: 'NCAA D1 장학금',
          targetLeague: 'NCAA',
          targetTeam: ncaaTeam,
          contractType: 'AMATEUR',
          contractYears: 4,
          annualSalary: 0,
          actionType: 'SIGN_TEAM',
        });
      }
    }

    // 4) 해외 프로/G리그 직행: 5성급 슈퍼 유망주에게만 스카우팅 적합도가 가장 높은 1개 구단 오퍼 발생
    if (prospect.stars === 5) {
      const directCandidates = [...overseasTeams, ...gleagueTeams]
        .map((team) => ({
          team,
          scout: evaluateTeamScouting(career, team, rng),
        }))
        .sort((a, b) => b.scout.scoutingScore - a.scout.scoutingScore);

      const pickedDirect = directCandidates[0]?.team;
      if (pickedDirect) {
        const directContract: ContractType =
          pickedDirect.league === 'GLEAGUE' ? 'GLEAGUE_EXHIBIT' : 'OVERSEAS_CONTRACT';
        options.push({
          id: `OPT_ROUTE_D_${pickedDirect.id}`,
          title: `🌏 [5성 슈퍼 유망주 특별 오퍼] ${pickedDirect.name} 직행 계약`,
          subtitle: `아시아 고교 무대를 평정한 5성급 유망주를 영입하기 위해 해외 구단 스카우트가 직접 찾아왔어요!`,
          badgeText: '해외 스카우트 픽',
          targetLeague: pickedDirect.league,
          targetTeam: pickedDirect,
          contractType: directContract,
          contractYears: 2,
          annualSalary: getContractDefaultSalary(directContract, career.ovr),
          actionType: 'SIGN_TEAM',
        });
      }
    }

    return options;
  }

  // [Case 2] 한국 대학(U-리그) 또는 미국 대학(NCAA) 재학 중
  if (career.league === 'U_LEAGUE' || career.league === 'NCAA') {
    const canStayInCollege = career.age < 23 && career.contractYearsLeft > 0;
    if (canStayInCollege) {
      options.push({
        id: 'OPT_COLLEGE_STAY',
        title: `🎓 ${career.team.name} 다음 학년 잔류`,
        subtitle: '대학 무대에서 주전 에이스로 도약하며 실전 기록과 드래프트 주가를 더 끌어올려요.',
        badgeText: '대학 잔류',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: career.contractYearsLeft,
        annualSalary: 0,
        actionType: 'STAY_TEAM',
      });
    }

    // 대학에서 NBA 드래프트 참가 신청 (NCAA 소속이거나 대학 무대 주전급 실전 활약 입증 시)
    const collegeReadyForNbaDraft =
      career.league === 'NCAA' ||
      (lastPpg >= 13.5 && career.draftStock >= 42);
    if (collegeReadyForNbaDraft) {
      options.push({
        id: 'OPT_COLLEGE_TO_NBA_DRAFT',
        title: '🏀 NBA 신인드래프트 참가 신청 (시카고 컴바인 진출)',
        subtitle: '시카고 드래프트 컴바인에서 기량을 검증받고 브루클린 바클레이스 센터 지명에 도전해요!',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    // KBL 신인드래프트 참가 신청
    options.push({
      id: 'OPT_COLLEGE_TO_KBL_DRAFT',
      title: '🇰🇷 KBL 신인드래프트 참가 신청',
      subtitle: '국내 프로 무대 KBL 10개 구단 지명을 통해 프로 커리어를 시작해요.',
      badgeText: 'KBL 드래프트',
      targetLeague: 'KBL',
      contractType: 'KBL_ROOKIE',
      contractYears: 3,
      annualSalary: getContractDefaultSalary('KBL_ROOKIE', career.ovr),
      actionType: 'ENTER_KBL_DRAFT',
    });

    return options;
  }

  // [Case 3] NBA 투웨이(Two-Way) 계약 중인 선수 심사 (스카우팅 AI 재평가 및 방출 후 재취업 심사)
  if (career.league === 'NBA' && career.contractType === 'TWO_WAY') {
    const survival = evaluateTwoWaySurvival(career, lastPpg, rng);
    if (survival.status === 'PROMOTED') {
      const stdSalary = getContractDefaultSalary('NBA_STANDARD', career.ovr);
      options.push({
        id: 'OPT_TWOWAY_PROMOTED_STANDARD',
        title: `🎉 ${career.team.name} NBA 정식 보장 계약(Standard) 승격 체결!`,
        subtitle: survival.message,
        badgeText: '정식 계약 승격!',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'NBA_STANDARD',
        contractYears: 3,
        annualSalary: stdSalary,
        actionType: 'SIGN_TEAM',
      });
      return options;
    }

    if (survival.status === 'RETAINED_YEAR_2') {
      options.push({
        id: 'OPT_TWOWAY_YEAR_2',
        title: `💪 ${career.team.name} 투웨이 계약 2년 차 잔류 도전`,
        subtitle: survival.message,
        badgeText: '투웨이 2년 차',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'TWO_WAY',
        contractYears: 1,
        annualSalary: getContractDefaultSalary('TWO_WAY', career.ovr),
        actionType: 'STAY_TEAM',
      });
      return options;
    }

    // WAIVED (웨이버 방출): 성적과 평판(스카우팅 점수)에 따라 제한된 오퍼만 오거나 오퍼가 0개일 수 있음
    const rebuildCandidates = [...gleagueTeams, ...overseasTeams, ...kblTeams];
    const interestedTeams = rebuildCandidates
      .map((t) => ({
        team: t,
        scout: evaluateTeamScouting(career, t, rng),
      }))
      .filter(
        (item) =>
          item.scout.passesOfferThreshold ||
          (item.scout.scoutingScore >= 54 && lastPpg >= 4.2 && career.age <= 33)
      )
      .sort((a, b) => b.scout.scoutingScore - a.scout.scoutingScore)
      .slice(0, 2);

    for (const item of interestedTeams) {
      const sal = getContractDefaultSalary(item.scout.recommendedContract, career.ovr);
      options.push({
        id: `OPT_WAIVED_REBUILD_${item.team.id}`,
        title: `[방출 후 재취업 오퍼] ${item.team.name} 계약 제의`,
        subtitle: `스카우팅 점수 ${item.scout.scoutingScore}점 · 웨이버 방출 소식을 듣고 ${item.team.shortName} 구단이 영입 의사를 밝혀왔어요.`,
        badgeText: `${LEAGUE_CONFIG[item.team.league].shortName} 영입 오퍼`,
        targetLeague: item.team.league,
        targetTeam: item.team,
        contractType: item.scout.recommendedContract,
        contractYears: 2,
        annualSalary: sal,
        scoutingScore: item.scout.scoutingScore,
        actionType: 'SIGN_TEAM',
      });
    }

    if (options.length === 0) {
      options.push({
        id: 'OPT_FORCED_RETIRE_NO_OFFERS',
        title: '🎤 소속팀 부재로 인한 현역 은퇴 (영입 오퍼 0건)',
        subtitle:
          '웨이버 방출 이후 국내외 프로 구단 어디에서도 계약 제의가 도착하지 않아 정든 코트를 떠나게 되었어요.',
        badgeText: '미계약 은퇴',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: 'FREE_AGENT',
        contractYears: 0,
        actionType: 'RETIRE_OUT_OF_LEAGUE',
      });
    }

    return options;
  }

  // [Case 4] 프로 리그(KBL / 해외 / G리그 / NBA) 소속 선수들의 오프시즌 스카우팅 평가
  let teamOffersCount = 0;

  // 1) 잔여 계약 기간이 남아있고 노쇠화 방출 대상이 아닌 경우 소속팀 잔류 가능
  if (career.contractYearsLeft > 0 && !isOutOfLeague) {
    options.push({
      id: 'OPT_STAY_CURRENT_CONTRACT',
      title: `🤝 ${career.team.name} 잔여 계약 시즌 진행 (${career.contractYearsLeft}년 남음)`,
      subtitle: '소속 구단에서 팀 동료들과 호흡을 맞추며 다음 시즌을 준비해요.',
      badgeText: '잔여 계약 이행',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: career.contractYearsLeft,
      annualSalary: career.annualSalary,
      actionType: 'STAY_TEAM',
    });
    teamOffersCount += 1;
  } else if (career.contractYearsLeft === 0 && !isOutOfLeague) {
    // 2) 계약 만료(FA) 상태: 원소속팀도 스카우팅 AI 평가를 통과해야만 재계약 오퍼를 제시함
    const currentTeamEval = evaluateTeamScouting(career, career.team, rng);
    if (currentTeamEval.passesOfferThreshold) {
      const sal = getContractDefaultSalary(currentTeamEval.recommendedContract, career.ovr);
      options.push({
        id: 'OPT_RESIGN_CURRENT_TEAM',
        title: `✍️ ${career.team.name} FA 재계약 오퍼 (스카우트 평가 ${currentTeamEval.scoutingScore}점)`,
        subtitle: '실전 퍼포먼스와 팀 기여도를 인정받아 원소속팀으로부터 공식 연장 계약서를 제안받았어요.',
        badgeText: '원소속팀 재계약',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: currentTeamEval.recommendedContract,
        contractYears: career.age >= 33 ? 1 : 3,
        annualSalary: sal,
        scoutingScore: currentTeamEval.scoutingScore,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }

    // 동일 리그 타 구단 동적 스카우팅 AI 오퍼 탐색 (최대 2개 구단)
    const sameLeaguePool = (
      career.league === 'NBA'
        ? nbaTeams
        : career.league === 'KBL'
        ? kblTeams
        : career.league === 'OVERSEAS'
        ? overseasTeams
        : gleagueTeams
    ).filter((t) => t.id !== career.team.id);

    const interestedSameLeague = sameLeaguePool
      .map((t) => ({
        team: t,
        eval: evaluateTeamScouting(career, t, rng),
      }))
      .filter((item) => item.eval.passesOfferThreshold)
      .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore)
      .slice(0, 2);

    for (const item of interestedSameLeague) {
      const sal = getContractDefaultSalary(item.eval.recommendedContract, career.ovr);
      options.push({
        id: `OPT_FA_OFFER_${item.team.id}`,
        title: `📝 [FA 영입 제의] ${item.team.name} (${
          item.team.direction === 'CONTENDER'
            ? '우승 컨텐더'
            : item.team.direction === 'REBUILDING'
            ? '리빌딩 코어'
            : '플레이오프 경쟁'
        })`,
        subtitle: `스카우트 평가 ${item.eval.scoutingScore}점 · 보강 포지션(${item.team.neededPositions?.join(
          '/'
        )}) 적임자로 낙점되었어요!`,
        badgeText: 'FA 정식 오퍼',
        targetLeague: item.team.league,
        targetTeam: item.team,
        contractType: item.eval.recommendedContract,
        contractYears: career.age >= 33 ? 1 : 2,
        annualSalary: sal,
        scoutingScore: item.eval.scoutingScore,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }
  }

  // 3) KBL / 해외 / G리그 소속 선수의 상위 리그 및 NBA 단계적 도전 루트
  if (career.league !== 'NBA' && !isOutOfLeague) {
    // 만 22세 이하 & 실전 성적 우수 시 NBA 드래프트 신청 가능
    if (career.age <= 22 && career.totals.nbaGp === 0 && lastPpg >= 12.0 && career.draftStock >= 45) {
      options.push({
        id: 'OPT_PRO_TO_NBA_DRAFT',
        title: '🏀 NBA 신인드래프트 참가 신청 (시카고 컴바인 진출)',
        subtitle: '프로 무대에서 입증한 실전 기록을 바탕으로 NBA 드래프트에 도전장을 던져요!',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    // Step 1: KBL/해외 리그 -> [NBA 서머리그 초청 & G리그 쇼케이스 합류] (특정 팀 하드코딩 없이 동적 선정)
    if (career.league === 'KBL' || career.league === 'OVERSEAS') {
      const glShowcaseTeam = selectBestFitTeamForPlayer(
        'GLEAGUE',
        career.primaryPos,
        career.secondaryPos,
        career.teamRatingsMap,
        rng
      );
      const glEval = evaluateTeamScouting(career, glShowcaseTeam, rng);

      if (glEval.passesOfferThreshold && lastPpg >= 14.0) {
        options.push({
          id: 'OPT_SUMMER_LEAGUE_SHOWCASE_STEP1',
          title: `🇺🇸 [1단계] NBA 라스베이거스 서머리그 초청 & ${glShowcaseTeam.name} 쇼케이스 합류`,
          subtitle:
            '해외 리그에서 곧바로 NBA 계약을 맺는 대신, 서머리그와 G리그 쇼케이스 무대에서 NBA 스카우트들에게 실전 경쟁력을 먼저 증명해요!',
          badgeText: '서머리그 초청장',
          targetLeague: 'GLEAGUE',
          targetTeam: glShowcaseTeam,
          contractType: 'SUMMER_LEAGUE_INVITE',
          contractYears: 1,
          annualSalary: getContractDefaultSalary('SUMMER_LEAGUE_INVITE', career.ovr),
          scoutingScore: glEval.scoutingScore,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }

      // KBL -> 해외 프로(B.리그/NBL/유로리그) 동적 스카우트 오퍼
      if (career.league === 'KBL') {
        const ovsCandidates = overseasTeams
          .map((t) => ({
            team: t,
            eval: evaluateTeamScouting(career, t, rng),
          }))
          .filter((x) => x.eval.passesOfferThreshold)
          .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

        if (ovsCandidates.length > 0) {
          const bestOvs = ovsCandidates[0];
          options.push({
            id: `OPT_KBL_TO_OVS_${bestOvs.team.id}`,
            title: `🌏 ${bestOvs.team.name} 해외 리그 스카우트 오퍼`,
            subtitle: `스카우트 점수 ${bestOvs.eval.scoutingScore}점 · 더 높은 수비 저항치(LDR 71) 무대에서 도전을 이어가요.`,
            badgeText: '해외 프로 오퍼',
            targetLeague: 'OVERSEAS',
            targetTeam: bestOvs.team,
            contractType: 'OVERSEAS_CONTRACT',
            contractYears: 2,
            annualSalary: getContractDefaultSalary('OVERSEAS_CONTRACT', career.ovr),
            scoutingScore: bestOvs.eval.scoutingScore,
            actionType: 'SIGN_TEAM',
          });
          teamOffersCount += 1;
        }
      }
    } else if (career.league === 'GLEAGUE') {
      // Step 2: G리그/서머리그 쇼케이스에서 실전 성적을 증명한 경우에만 NBA 투웨이 오퍼 발생
      const nbaTwoWayCandidates = nbaTeams
        .map((t) => ({
          team: t,
          eval: evaluateTeamScouting(career, t, rng),
        }))
        .filter(
          (x) =>
            x.eval.realGameCompetence &&
            x.eval.scoutingScore >= 64 &&
            lastPpg >= 14.0
        )
        .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

      if (nbaTwoWayCandidates.length > 0) {
        const pickedTwoWay = nbaTwoWayCandidates[0];
        options.push({
          id: `OPT_GLEAGUE_TO_TWOWAY_${pickedTwoWay.team.id}`,
          title: `🏀 [2단계 돌파] ${pickedTwoWay.team.name} NBA 투웨이(Two-Way) 계약 오퍼!`,
          subtitle: `쇼케이스 평균 ${lastPpg.toFixed(1)}점(스카우트 ${pickedTwoWay.eval.scoutingScore}점) 활약으로 마침내 NBA 투웨이 콜업 계약을 따냈어요!`,
          badgeText: 'NBA 투웨이 오퍼',
          targetLeague: 'NBA',
          targetTeam: pickedTwoWay.team,
          contractType: 'TWO_WAY',
          contractYears: 1,
          annualSalary: getContractDefaultSalary('TWO_WAY', career.ovr),
          scoutingScore: pickedTwoWay.eval.scoutingScore,
          actionType: 'SIGN_TEAM',
        });
        teamOffersCount += 1;
      }
    }
  }

  // 4) 상위 리그 오퍼가 없을 때 하위 리그(KBL 등) 구단이 관심을 보이는지 동적 스카우팅 체크
  if (teamOffersCount === 0 && !isOutOfLeague && career.age <= 34) {
    const fallbackKbl = kblTeams
      .map((t) => ({
        team: t,
        eval: evaluateTeamScouting(career, t, rng),
      }))
      .filter((x) => x.eval.passesOfferThreshold)
      .sort((a, b) => b.eval.scoutingScore - a.eval.scoutingScore);

    if (fallbackKbl.length > 0) {
      const topKbl = fallbackKbl[0];
      options.push({
        id: `OPT_FALLBACK_KBL_${topKbl.team.id}`,
        title: `🇰🇷 ${topKbl.team.name} 국내 무대 복귀 오퍼`,
        subtitle: `상위 리그 구단 오퍼는 없었지만, ${topKbl.team.name}에서 주축 선수 대우로 영입을 제안했어요.`,
        badgeText: 'KBL 영입 제의',
        targetLeague: 'KBL',
        targetTeam: topKbl.team,
        contractType: topKbl.eval.recommendedContract,
        contractYears: 2,
        annualSalary: getContractDefaultSalary(topKbl.eval.recommendedContract, career.ovr),
        scoutingScore: topKbl.eval.scoutingScore,
        actionType: 'SIGN_TEAM',
      });
      teamOffersCount += 1;
    }
  }

  // 5) 오프시즌 영입 오퍼가 0개이거나 노쇠화 방출(isOutOfLeague)인 경우 -> [소속팀 부재로 인한 현역 은퇴] 강제 귀결
  if (teamOffersCount === 0 || isOutOfLeague) {
    options.push({
      id: 'OPT_RETIRE_OUT_OF_LEAGUE',
      title: '🎤 소속팀 부재로 인한 현역 은퇴 (구단 영입 오퍼 0건)',
      subtitle:
        '구단 스카우팅 평가 결과 재계약 및 신규 영입 오퍼를 제시한 구단이 없어 현역 생활을 마무리하고 은퇴식을 진행해요.',
      badgeText: '미계약 강제 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_OUT_OF_LEAGUE',
    });
    return options;
  }

  // ② 레전드 은퇴 투어 선언 (만 34세 이상 & 우승 1회+ 또는 올스타 3회+ 또는 MVP 1회+)
  if (canDeclareFarewellTour) {
    options.push({
      id: 'OPT_DECLARE_FAREWELL_TOUR',
      title: '🌟 [마지막 1년] 공식 레전드 은퇴 투어(Farewell Tour) 선언',
      subtitle:
        '이번 시즌을 현역 마지막 해로 선언하고 전 구단 팬들의 기립박수와 유니폼 교환식 속에 화려한 피날레를 장식해요!',
      badgeText: '레전드 은퇴 투어',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: 1,
      annualSalary: career.annualSalary,
      actionType: 'START_FAREWELL_TOUR',
    });
  }

  // ① 자율 명예 은퇴 (만 31세 이상 또는 통산 10시즌 이상 소화)
  if (canRetireVoluntarily) {
    options.push({
      id: 'OPT_VOLUNTARY_RETIREMENT',
      title: '🎤 박수칠 때 떠나기 (현역 은퇴 선언)',
      subtitle:
        '그동안 쌓아 올린 빛나는 커리어를 뒤로하고 공식 은퇴식과 영구결번·명예의 전당 심사로 이동해요.',
      badgeText: '자율 명예 은퇴',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_VOLUNTARY',
    });
  }

  return options;
}
