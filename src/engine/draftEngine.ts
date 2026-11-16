import { LEAGUE_CONFIG } from '../data/leagues';
import {
  GLEAGUE_TEAMS,
  KBL_TEAMS,
  NBA_TEAMS,
  NCAA_TEAMS,
  OVERSEAS_TEAMS,
  U_LEAGUE_TEAMS,
} from '../data/teams';
import {
  CareerState,
  CombineState,
  OffseasonOption,
  TeamInfo,
} from '../types/game';
import { checkRetirementEligibility } from './retirementEngine';

/**
 * NBA 드래프트 예상 지명 순위 공식:
 * nbaReadyScore = (career.ovr - 68) * 3.5 + (career.draftStock * leagueConfig.prestige * 0.45)
 * projectedPick = Math.round(75 - nbaReadyScore)
 */
export function calculateProjectedNbaPick(
  career: Pick<CareerState, 'ovr' | 'draftStock' | 'league'>,
  combineBonus: number = 0
): { nbaReadyScore: number; projectedPick: number; undraftedRisk: boolean } {
  const leagueConfig = LEAGUE_CONFIG[career.league];
  const nbaReadyScore =
    (career.ovr - 68) * 3.5 +
    career.draftStock * leagueConfig.prestige * 0.45 +
    combineBonus;
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
      '현재 예상 순위가 58순위 밖이라 언드래프티 위험이 높아요! 컴바인에서 대반전을 만들거나, 드래프트를 철회하고 소속 무대에서 기량을 더 닦는 선택도 가능해요.';
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
} {
  if (draftType === 'KBL') {
    const kblScore = (career.ovr - 54) * 2.2 + career.draftStock * 0.25;
    const rawPick = Math.round(22 - kblScore + (rng() * 3 - 1.5));
    const pickNumber = Math.max(1, Math.min(20, rawPick));
    const round: 1 | 2 = pickNumber <= 10 ? 1 : 2;
    const teamPool =
      pickNumber <= 4
        ? KBL_TEAMS.filter((t) => t.rating <= 68)
        : KBL_TEAMS;
    const draftedTeam = teamPool[Math.floor(rng() * teamPool.length)];
    return {
      draftType: 'KBL',
      pickNumber,
      round,
      draftedTeam,
      twoWayOfferTeam: null,
    };
  }

  // NBA 드래프트
  const bonus = career.combineState?.combineBonusScore ?? 0;
  const { projectedPick } = calculateProjectedNbaPick(career, bonus);
  const variance = Math.round(rng() * 4 - 2);
  const finalPickCalc = Math.max(1, projectedPick + variance);

  if (finalPickCalc > 60) {
    // 언드래프티: 서머리그 투웨이 오퍼 구단 배정
    const twoWayOfferTeam = NBA_TEAMS[Math.floor(rng() * NBA_TEAMS.length)];
    return {
      draftType: 'NBA',
      pickNumber: null,
      round: null,
      draftedTeam: null,
      twoWayOfferTeam,
    };
  }

  const round: 1 | 2 = finalPickCalc <= 30 ? 1 : 2;
  // 상위 픽일수록 리빌딩 구단, 하위 픽일수록 컨텐더 구단 확률 높임
  const sortedByRatingAsc = [...NBA_TEAMS].sort((a, b) => a.rating - b.rating);
  const bucketIndex = Math.min(
    sortedByRatingAsc.length - 1,
    Math.max(0, Math.floor(((finalPickCalc - 1) / 60) * sortedByRatingAsc.length))
  );
  const windowTeams = sortedByRatingAsc.slice(
    Math.max(0, bucketIndex - 2),
    Math.min(sortedByRatingAsc.length, bucketIndex + 3)
  );
  const draftedTeam =
    windowTeams[Math.floor(rng() * windowTeams.length)] || sortedByRatingAsc[bucketIndex];

  return {
    draftType: 'NBA',
    pickNumber: finalPickCalc,
    round,
    draftedTeam,
    twoWayOfferTeam: round === 2 ? draftedTeam : null,
  };
}

/**
 * ★ 투웨이 계약 생존 및 방출 심사:
 * - 투웨이 계약 시즌 종료 시 career.ovr >= 75 또는 시즌 평균 ppg >= 8.5 달성 시 NBA 정식 보장 계약으로 승격!
 * - 투웨이 2시즌 차까지 기준 미달 시 구단으로부터 웨이버 방출(Waived) 통보
 */
export function evaluateTwoWaySurvival(
  career: CareerState,
  lastSeasonPpg: number
): {
  status: 'PROMOTED' | 'RETAINED_YEAR_2' | 'WAIVED';
  message: string;
} {
  if (career.ovr >= 75 || lastSeasonPpg >= 8.5) {
    return {
      status: 'PROMOTED',
      message: `🎉 축하해요! 투웨이 계약 신분으로 평균 ${lastSeasonPpg.toFixed(1)}점(OVR ${career.ovr})을 기록하며 가치를 증명해 구단으로부터 NBA 정식 보장 계약(Standard Contract) 승격 오퍼를 받았어요!`,
    };
  }

  if (career.twoWaySeasonsUsed < 2) {
    return {
      status: 'RETAINED_YEAR_2',
      message: `투웨이 1년 차 시즌이 끝났어요. 정식 계약 승격 기준(OVR 75+ 또는 평균 8.5득점+)에는 조금 모자랐지만, 구단에서 마지막 2년 차 투웨이 기회를 한 번 더 부여하기로 했어요!`,
    };
  }

  return {
    status: 'WAIVED',
    message: `⚠️ 투웨이 계약 2시즌 동안 정식 승격 기준(OVR 75+ 또는 평균 8.5득점+)을 충족하지 못해 구단으로부터 웨이버 방출(Waived) 통보를 받았어요. G리그나 해외 프로, 또는 KBL 무대에서 재기를 노려야 해요.`,
  };
}

/**
 * 4. 비선형 오픈월드 진로 - 오프시즌 에이전트 데스크 선택지 생성
 */
export function generateOffseasonOptions(career: CareerState): OffseasonOption[] {
  const options: OffseasonOption[] = [];
  const lastLog = career.seasonLogs[career.seasonLogs.length - 1];
  const lastPpg = lastLog ? lastLog.ppg : 0;
  const lastWonChamp = lastLog ? lastLog.wonChampionship : false;

  const {
    canRetireVoluntarily,
    canDeclareFarewellTour,
    isOutOfLeague,
  } = checkRetirementEligibility(career);

  // ③ 구단 오퍼 부재로 인한 은퇴 권유 (만 32세 이상 노쇠화 & 기준 OVR 미달)
  if (isOutOfLeague) {
    options.push({
      id: 'OPT_RETIRE_OUT_OF_LEAGUE',
      title: '🎤 정든 코트를 떠나 현역 은퇴식 진행',
      subtitle: '구단 오퍼 부재 · 에이전트 은퇴 권유 리포트 수용',
      badgeText: '은퇴 권유',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: 'FREE_AGENT',
      contractYears: 0,
      actionType: 'RETIRE_OUT_OF_LEAGUE',
    });

    if (career.league !== 'KBL') {
      const kblHomeTeam = KBL_TEAMS[0];
      options.push({
        id: 'OPT_RETURN_KBL_LAST_DANCE',
        title: `🇰🇷 고국 KBL ${kblHomeTeam.name} 1년 베테랑 계약 (국내 팬 앞 은퇴 투어)`,
        subtitle: '해외 커리어를 정리하고 국내 코트에서 마지막 1년을 불태운 뒤 은퇴해요.',
        badgeText: '금의환향 라스트댄스',
        targetLeague: 'KBL',
        targetTeam: kblHomeTeam,
        contractType: 'KBL_VET',
        contractYears: 1,
        actionType: 'RETURN_KBL_FAREWELL',
      });
    }
    return options;
  }

  // [Case 1] 고교 농구 재학 및 졸업 (만 20세에 고교 졸업)
  if (career.league === 'HIGH_SCHOOL') {
    if (career.age < 20) {
      options.push({
        id: 'OPT_HS_NEXT_GRADE',
        title: `🏫 ${career.team.name} 다음 학년 진급`,
        subtitle: '고교 무대에서 주전 입지와 전국대회 우승에 도전하며 스카우트 주가를 높여요.',
        badgeText: '고교 재학',
        targetLeague: 'HIGH_SCHOOL',
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: 1,
        actionType: 'STAY_TEAM',
      });
      return options;
    }

    // 만 20세 고교 졸업 4대 루트 (A, B, C, D)
    // 루트 A: 한국 대학 U-리그 진학 (4개교)
    for (const uni of U_LEAGUE_TEAMS) {
      options.push({
        id: `OPT_ROUTE_A_${uni.id}`,
        title: `[루트 A] 🎓 ${uni.name} 입학 (U-리그)`,
        subtitle: uni.prestigeDesc,
        badgeText: '한국 대학 진학',
        targetLeague: 'U_LEAGUE',
        targetTeam: uni,
        contractType: 'AMATEUR',
        contractYears: 4,
        actionType: 'SIGN_TEAM',
      });
    }

    // 루트 B: 고졸 KBL 얼리 드래프트 신청
    options.push({
      id: 'OPT_ROUTE_B_KBL_EARLY',
      title: '[루트 B] 🔥 고졸 KBL 신인드래프트 얼리 참가 신청',
      subtitle: '대학 진학 없이 곧바로 한국프로농구(KBL) 10개 구단 드래프트에 직행해요!',
      badgeText: '고졸 프로 직행',
      targetLeague: 'KBL',
      contractType: 'KBL_ROOKIE',
      contractYears: 3,
      actionType: 'ENTER_KBL_DRAFT',
    });

    // 루트 C: 미국 NCAA D1 장학금 입학 (OVR >= 58 또는 고교 전국대회 우승 시 활성화)
    const ncaaUnlocked =
      career.ovr >= 58 ||
      career.seasonLogs.some((s) => s.league === 'HIGH_SCHOOL' && s.wonChampionship);

    for (const ncaaTeam of NCAA_TEAMS) {
      options.push({
        id: `OPT_ROUTE_C_${ncaaTeam.id}`,
        title: `[루트 C] 🇺🇸 ${ncaaTeam.name} D1 전액 장학금 입학`,
        subtitle: ncaaUnlocked
          ? ncaaTeam.prestigeDesc
          : '🔒 고교 OVR 58 이상 달성 또는 고교 전국대회 우승 시 스카우트 오퍼가 해금돼요.',
        badgeText: ncaaUnlocked ? 'NCAA D1 오퍼' : '조건 미달',
        targetLeague: 'NCAA',
        targetTeam: ncaaTeam,
        contractType: 'AMATEUR',
        contractYears: 4,
        actionType: 'SIGN_TEAM',
        locked: !ncaaUnlocked,
        lockReason: 'OVR 58 이상 또는 고교 전국대회 우승 필요',
      });
    }

    // 루트 D: 해외 프로 (호주 NBL / 일본 B.리그) 및 NBA G리그 직행
    const nblSydney = OVERSEAS_TEAMS.find((t) => t.id === 'OVS_SYDNEY') || OVERSEAS_TEAMS[0];
    const bLeagueChiba = OVERSEAS_TEAMS.find((t) => t.id === 'OVS_CHIBA') || OVERSEAS_TEAMS[1];
    const gLeagueUnited = GLEAGUE_TEAMS[0];

    options.push({
      id: 'OPT_ROUTE_D_NBL',
      title: `[루트 D] 🌏 ${nblSydney.name} 아시아쿼터/넥스트스타 입단`,
      subtitle: nblSydney.prestigeDesc,
      badgeText: '해외 프로 직행',
      targetLeague: 'OVERSEAS',
      targetTeam: nblSydney,
      contractType: 'OVERSEAS_CONTRACT',
      contractYears: 2,
      actionType: 'SIGN_TEAM',
    });

    options.push({
      id: 'OPT_ROUTE_D_BLEAGUE',
      title: `[루트 D] 🌏 ${bLeagueChiba.name} 프로 계약`,
      subtitle: bLeagueChiba.prestigeDesc,
      badgeText: '일본 B.리그',
      targetLeague: 'OVERSEAS',
      targetTeam: bLeagueChiba,
      contractType: 'OVERSEAS_CONTRACT',
      contractYears: 2,
      actionType: 'SIGN_TEAM',
    });

    options.push({
      id: 'OPT_ROUTE_D_GLEAGUE',
      title: `[루트 D] 🇺🇸 ${gLeagueUnited.name} 입단 도전`,
      subtitle: gLeagueUnited.prestigeDesc,
      badgeText: '미국 G리그 직행',
      targetLeague: 'GLEAGUE',
      targetTeam: gLeagueUnited,
      contractType: 'GLEAGUE_EXHIBIT',
      contractYears: 1,
      actionType: 'SIGN_TEAM',
    });

    return options;
  }

  // [Case 2] 한국 대학(U-리그) 또는 미국 대학(NCAA) 재학 중
  if (career.league === 'U_LEAGUE' || career.league === 'NCAA') {
    const canStayInCollege = career.age < 23 && career.contractYearsLeft > 0;
    if (canStayInCollege) {
      options.push({
        id: 'OPT_COLLEGE_STAY',
        title: `🎓 ${career.team.name} 다음 학년 잔류`,
        subtitle: '대학 무대에서 주전 에이스로 도약하며 드래프트 예상 순위를 더 끌어올려요.',
        badgeText: '대학 잔류',
        targetLeague: career.league,
        targetTeam: career.team,
        contractType: 'AMATEUR',
        contractYears: career.contractYearsLeft,
        actionType: 'STAY_TEAM',
      });
    }

    // NBA 드래프트 참가 신청
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

    // KBL 신인드래프트 참가 신청
    options.push({
      id: 'OPT_COLLEGE_TO_KBL_DRAFT',
      title: '🇰🇷 KBL 신인드래프트 참가 신청',
      subtitle: '국내 프로 무대 KBL 10개 구단 지명을 통해 프로 커리어를 시작해요.',
      badgeText: 'KBL 드래프트',
      targetLeague: 'KBL',
      contractType: 'KBL_ROOKIE',
      contractYears: 3,
      actionType: 'ENTER_KBL_DRAFT',
    });

    // 해외 프로 / G리그 진출
    options.push({
      id: 'OPT_COLLEGE_TO_GLEAGUE',
      title: `🇺🇸 ${GLEAGUE_TEAMS[0].name} 계약 도전`,
      subtitle: '미국 G리그에서 실전 감각을 쌓으며 NBA 투웨이 콜업을 노려요.',
      badgeText: 'G리그 도전',
      targetLeague: 'GLEAGUE',
      targetTeam: GLEAGUE_TEAMS[0],
      contractType: 'GLEAGUE_EXHIBIT',
      contractYears: 1,
      actionType: 'SIGN_TEAM',
    });

    return options;
  }

  // [Case 3] NBA 투웨이(Two-Way) 계약 중인 선수 심사
  if (career.league === 'NBA' && career.contractType === 'TWO_WAY') {
    const survival = evaluateTwoWaySurvival(career, lastPpg);
    if (survival.status === 'PROMOTED') {
      options.push({
        id: 'OPT_TWOWAY_PROMOTED_STANDARD',
        title: `🎉 ${career.team.name} NBA 정식 보장 계약(Standard) 승격 체결!`,
        subtitle: survival.message,
        badgeText: '정식 계약 승격!',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'NBA_STANDARD',
        contractYears: 3,
        actionType: 'SIGN_TEAM',
      });
    } else if (survival.status === 'RETAINED_YEAR_2') {
      options.push({
        id: 'OPT_TWOWAY_YEAR_2',
        title: `💪 ${career.team.name} 투웨이 계약 2년 차 잔류 도전`,
        subtitle: survival.message,
        badgeText: '투웨이 2년 차',
        targetLeague: 'NBA',
        targetTeam: career.team,
        contractType: 'TWO_WAY',
        contractYears: 1,
        actionType: 'STAY_TEAM',
      });
    } else {
      // WAIVED (웨이버 방출): G리그, 해외 프로, KBL 복귀 선택지 제공
      const gTeam = GLEAGUE_TEAMS[1];
      const ovsTeam = OVERSEAS_TEAMS[2];
      const kblTeam = KBL_TEAMS[Math.floor(Math.random() * KBL_TEAMS.length)];

      options.push({
        id: 'OPT_WAIVED_TO_GLEAGUE',
        title: `🇺🇸 [방출 후 재기] ${gTeam.name} (NBA G리그) 입단`,
        subtitle: '웨이버 아픔을 딛고 G리그에서 폭발적인 득점력을 증명해 다시 NBA 콜업을 노려요.',
        badgeText: 'G리그 재도전',
        targetLeague: 'GLEAGUE',
        targetTeam: gTeam,
        contractType: 'GLEAGUE_EXHIBIT',
        contractYears: 1,
        actionType: 'SIGN_TEAM',
      });

      options.push({
        id: 'OPT_WAIVED_TO_OVERSEAS',
        title: `🌏 [방출 후 재기] ${ovsTeam.name} 주전 계약`,
        subtitle: '호주 NBL 무대에서 풀타임 주전으로 뛰며 기량을 끌어올려요.',
        badgeText: '해외 프로 이적',
        targetLeague: 'OVERSEAS',
        targetTeam: ovsTeam,
        contractType: 'OVERSEAS_CONTRACT',
        contractYears: 2,
        actionType: 'SIGN_TEAM',
      });

      options.push({
        id: 'OPT_WAIVED_TO_KBL',
        title: `🇰🇷 [국내 복귀] ${kblTeam.name} 에이스 대우 계약`,
        subtitle: '한국프로농구 KBL로 복귀해 리그를 평정하고 자신감을 되찾아요.',
        badgeText: 'KBL 복귀',
        targetLeague: 'KBL',
        targetTeam: kblTeam,
        contractType: 'KBL_MAX',
        contractYears: 2,
        actionType: 'SIGN_TEAM',
      });
    }
    return options;
  }

  // [Case 4] KBL / 해외 프로 / G리그 / NBA 정식 계약 선수들의 오프시즌 선택지
  // 1) 계약 기간이 남아있으면 소속팀 잔류 기본 제공
  if (career.contractYearsLeft > 0) {
    options.push({
      id: 'OPT_STAY_CURRENT_CONTRACT',
      title: `🤝 ${career.team.name} 잔여 계약 시즌 진행 (${career.contractYearsLeft}년 남음)`,
      subtitle: '소속 구단에서 팀 동료들과 호흡을 맞추며 다음 시즌을 준비해요.',
      badgeText: '소속팀 잔류',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType: career.contractType,
      contractYears: career.contractYearsLeft,
      actionType: 'STAY_TEAM',
    });
  } else {
    // FA 재계약 오퍼
    options.push({
      id: 'OPT_RESIGN_CURRENT_TEAM',
      title: `✍️ ${career.team.name} 프랜차이즈 재계약 체결`,
      subtitle: '익숙한 홈 팬들의 응원 속에 소속 구단과 새로운 연장 계약을 맺어요.',
      badgeText: 'FA 재계약',
      targetLeague: career.league,
      targetTeam: career.team,
      contractType:
        career.league === 'NBA'
          ? career.ovr >= 85
            ? 'NBA_MAX'
            : 'NBA_STANDARD'
          : career.league === 'KBL'
          ? 'KBL_MAX'
          : 'OVERSEAS_CONTRACT',
      contractYears: 3,
      actionType: 'SIGN_TEAM',
    });
  }

  // 2) KBL / 해외 / G리그에서 활약 중일 때 상위 리그 및 NBA 도전 루트
  if (career.league !== 'NBA') {
    if (career.age <= 22 && career.totals.nbaGp === 0) {
      options.push({
        id: 'OPT_PRO_TO_NBA_DRAFT',
        title: '🏀 NBA 신인드래프트 참가 신청 (시카고 컴바인 진출)',
        subtitle: '프로 무대에서 검증한 실력을 바탕으로 NBA 드래프트에 도전장을 던져요!',
        badgeText: 'NBA 드래프트',
        targetLeague: 'NBA',
        contractType: 'NBA_STANDARD',
        contractYears: 4,
        actionType: 'ENTER_NBA_DRAFT',
      });
    }

    // 서머리그 / 투웨이 쇼케이스 도전 (OVR >= 68 또는 평균 15점 이상 시 활성화)
    const canTrySummerLeague = career.ovr >= 68 || lastPpg >= 15.0;
    const nbaOfferTeam =
      NBA_TEAMS.find((t) => t.id === 'NBA_MIA') || NBA_TEAMS[0];
    options.push({
      id: 'OPT_SUMMER_LEAGUE_TWOWAY',
      title: `🇺🇸 NBA 서머리그 초청 & ${nbaOfferTeam.name} 투웨이 계약 도전`,
      subtitle: canTrySummerLeague
        ? '라스베이거스 서머리그 쇼케이스를 통해 NBA 투웨이 로스터 한 자리를 꿰차요!'
        : '🔒 OVR 68 이상 또는 직전 시즌 평균 15.0득점 이상 기록 시 NBA 서머리그 초청장이 도착해요.',
      badgeText: canTrySummerLeague ? 'NBA 투웨이 오퍼' : '조건 미달',
      targetLeague: 'NBA',
      targetTeam: nbaOfferTeam,
      contractType: 'TWO_WAY',
      contractYears: 1,
      actionType: 'SIGN_TEAM',
      locked: !canTrySummerLeague,
      lockReason: 'OVR 68 이상 또는 시즌 평균 15득점 이상 필요',
    });

    // NBA 직행 정식 보장 오퍼 (OVR >= 76 이고 우승 또는 평균 20점 이상일 때)
    if (career.ovr >= 76 && (lastPpg >= 18.0 || lastWonChamp)) {
      const stdTeam = NBA_TEAMS.find((t) => t.id === 'NBA_GSW') || NBA_TEAMS[1];
      options.push({
        id: 'OPT_DIRECT_NBA_STANDARD',
        title: `🌟 ${stdTeam.name} NBA 정식 보장 계약(Standard) 스카우트 오퍼!`,
        subtitle: '해외/하부 리그를 완전히 평정한 활약에 반한 NBA 구단이 정식 로스터 계약을 제시했어요!',
        badgeText: 'NBA 정식 오퍼',
        targetLeague: 'NBA',
        targetTeam: stdTeam,
        contractType: 'NBA_STANDARD',
        contractYears: 2,
        actionType: 'SIGN_TEAM',
      });
    }

    // 타 리그 이적 오퍼 (KBL <-> 해외 <-> G리그)
    if (career.league === 'KBL') {
      const ovsOffer = OVERSEAS_TEAMS[0];
      options.push({
        id: 'OPT_KBL_TO_OVERSEAS',
        title: `🌏 ${ovsOffer.name} 해외 리그 이적`,
        subtitle: '더 높은 수비 저항치(LDR 71)와 성장 상한선(OVR 77)을 가진 해외 무대로 진출해요.',
        badgeText: '해외 진출',
        targetLeague: 'OVERSEAS',
        targetTeam: ovsOffer,
        contractType: 'OVERSEAS_CONTRACT',
        contractYears: 2,
        actionType: 'SIGN_TEAM',
      });
    } else if (career.league === 'OVERSEAS') {
      const glOffer = GLEAGUE_TEAMS[0];
      options.push({
        id: 'OPT_OVS_TO_GLEAGUE',
        title: `🇺🇸 ${glOffer.name} 이적`,
        subtitle: '미국 본토 G리그 쇼케이스에서 NBA 코칭스태프에게 직접 어필해요.',
        badgeText: 'G리그 진출',
        targetLeague: 'GLEAGUE',
        targetTeam: glOffer,
        contractType: 'GLEAGUE_EXHIBIT',
        contractYears: 1,
        actionType: 'SIGN_TEAM',
      });
    }
  } else {
    // NBA 정식 계약 선수가 계약 만료되었거나 이적을 원할 때 타 NBA 구단 오퍼 제공
    const otherNbaTeams = NBA_TEAMS.filter((t) => t.id !== career.team.id);
    const contender =
      otherNbaTeams.find((t) => t.rating >= 86) || otherNbaTeams[0];
    const youngTeam =
      otherNbaTeams.find((t) => t.rating <= 78) || otherNbaTeams[1];

    if (career.contractYearsLeft === 0) {
      if (career.ovr >= 78) {
        options.push({
          id: `OPT_NBA_FA_${contender.id}`,
          title: `🏆 [NBA FA 이적] 우승 후보 ${contender.name} 계약`,
          subtitle: contender.prestigeDesc,
          badgeText: '컨텐더 영입 제의',
          targetLeague: 'NBA',
          targetTeam: contender,
          contractType: career.ovr >= 86 ? 'NBA_MAX' : 'NBA_STANDARD',
          contractYears: 3,
          actionType: 'SIGN_TEAM',
        });
      }

      options.push({
        id: `OPT_NBA_FA_${youngTeam.id}`,
        title: `⚡ [NBA FA 이적] ${youngTeam.name} 주전 보장 계약`,
        subtitle: '더 많은 출전 시간과 공격 롤을 보장받으며 스탯 볼륨을 극대화할 수 있는 구단이에요.',
        badgeText: '출전시간 보장',
        targetLeague: 'NBA',
        targetTeam: youngTeam,
        contractType: 'NBA_STANDARD',
        contractYears: 2,
        actionType: 'SIGN_TEAM',
      });
    }
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
