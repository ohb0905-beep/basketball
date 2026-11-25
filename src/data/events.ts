import {
  DRAFT_SCOUTING_CONFIG,
  ROLE_MPG_CONFIG,
  INTERNATIONAL_TOURNAMENT_CONFIG,
  MILITARY_SERVICE_CONFIG,
  canUseProTradeSystem,
  getInternationalTournamentByYear,
} from '../config/balanceConfig';
import {
  CareerEvent,
  CareerState,
  InternationalTournamentType,
  LeagueId,
} from '../types/game';
import {
  POSITION_EVENTS,
  rollCombinatorialEncounter,
} from '../engine/encounterEngine';

export { POSITION_EVENTS };

export function getMilitaryEnlistAgeForLeague(league: LeagueId): number {
  return league === 'NBA'
    ? MILITARY_SERVICE_CONFIG.nbaDeferredEnlistAge
    : MILITARY_SERVICE_CONFIG.defaultEnlistAge;
}

export function getMilitaryExemptionMaxAgeForLeague(league: LeagueId): number {
  return league === 'NBA'
    ? MILITARY_SERVICE_CONFIG.nbaExemptionMaxAge
    : MILITARY_SERVICE_CONFIG.defaultExemptionMaxAge;
}

export const ASIAN_GAMES_MILITARY_EVENT: CareerEvent = {
  id: 'EVT_ASIAN_GAMES_GOLD',
  title: '아시안게임 남자농구 국가대표 최종 엔트리 소집',
  subtitle: '조별리그(3경기) · 8강 · 4강 · 결승 우승 시 병역특례 획득',
  description:
    '4년 주기 아시안게임 남자농구 국가대표팀 최종 12인 명단에 발탁되었습니다. 조별리그와 토너먼트를 통과해 결승에서 금메달을 획득하면 병역특례(예술·체육요원) 자격을 얻습니다.',
  category: 'MILITARY',
  choices: [
    {
      label: '아시안게임 본선 토너먼트 출전',
      description:
        '조별리그부터 4강까지 요약 진행 후, 결승전 또는 동메달 결정전을 실시간 중계로 소화합니다.',
      effectSummary:
        '아시안게임 본선 출전 (결승 우승 시 병역특례 · 4강 석패 시 3·4위전 진행)',
      statChanges: { ins: 1, out: 1, ply: 1 },
      trustDelta: 6,
      draftStockDelta: 6,
      enterAsianGamesTournament: true,
      enterInternationalTournament: 'ASIAN_GAMES',
    },
    {
      label: '소속팀 비시즌 훈련 및 컨디션 관리 집중',
      description: '대표팀 차출을 고사하고 개인 기량 보완과 부상 관리에 집중합니다.',
      effectSummary: 'PHY +2, OUT +1 · 대표팀 불참',
      statChanges: { phy: 2, out: 1 },
      trustDelta: 2,
    },
  ],
};

export function createInternationalCallupEvent(
  career: CareerState,
  year: number,
  forcedType?: InternationalTournamentType
): CareerEvent {
  const tournamentType = forcedType || getInternationalTournamentByYear(year);
  const cfg = INTERNATIONAL_TOURNAMENT_CONFIG[tournamentType];
  const isExemptionTournament = cfg.militaryExemptionMinMedal !== null;
  const canEarnExemption =
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    isExemptionTournament;
  const showNonExemptionNotice =
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    !isExemptionTournament;

  const exemptionNote =
    tournamentType === 'OLYMPICS' && canEarnExemption
      ? ' 동메달 이상 획득 시 병역특례(예술·체육요원) 자격을 얻습니다.'
      : tournamentType === 'ASIAN_GAMES' && canEarnExemption
      ? ' 결승에서 금메달을 획득하면 병역특례(예술·체육요원) 자격을 얻습니다.'
      : showNonExemptionNotice
      ? ' 이 대회는 병역특례 비대상 대회입니다(아시안게임 금메달·올림픽 동메달 이상 시 특례 부여).'
      : '';

  const eventId =
    tournamentType === 'ASIAN_GAMES'
      ? 'EVT_ASIAN_GAMES_GOLD'
      : `EVT_INTL_${tournamentType}_${year}`;

  const statBonus =
    tournamentType === 'OLYMPICS'
      ? { ins: 1, out: 1, def: 1, ply: 1 }
      : tournamentType === 'FIBA_WORLD_CUP'
      ? { out: 1, def: 1, ply: 1 }
      : { ins: 1, out: 1, ply: 1 };

  const baseSubtitle =
    tournamentType === 'ASIAN_GAMES' && !canEarnExemption
      ? '조별리그 · 8강 · 4강 · 아시아 정상 도전'
      : tournamentType === 'OLYMPICS' && !canEarnExemption
      ? '세계 최정예 12개국 본선 토너먼트'
      : cfg.subtitle;

  const subtitle = showNonExemptionNotice
    ? `${baseSubtitle} · 병역특례 비대상`
    : baseSubtitle;

  const effectSuffix =
    tournamentType === 'OLYMPICS' && canEarnExemption
      ? ' · 동메달 이상 시 병역특례'
      : tournamentType === 'ASIAN_GAMES' && canEarnExemption
      ? ' · 결승 우승 시 병역특례'
      : showNonExemptionNotice
      ? ' · 병역특례 비대상'
      : '';

  return {
    id: eventId,
    title: `${year} ${cfg.name} 국가대표 최종 엔트리 소집`,
    subtitle,
    description: `${year}년 ${cfg.name}에 출전하는 대한민국 남자농구 국가대표팀 최종 12인 명단에 선발되었습니다. 조별리그와 8강·4강을 거쳐 결승전 또는 동메달 결정전에서 실시간 중계로 승부를 가립니다.${exemptionNote}`,
    category: canEarnExemption ? 'MILITARY' : 'NATIONAL_PRIDE',
    choices: [
      {
        label: `${cfg.shortName} 국가대표 본선 출전`,
        description:
          '조별리그·8강·4강 요약 진행 후, 결승전(금/은메달) 또는 3·4위전(동메달)을 실시간 중계로 치릅니다.',
        effectSummary: `${cfg.shortName} 출전 · 스카우트 평가 +${cfg.draftStockBonus}${effectSuffix}`,
        statChanges: statBonus,
        trustDelta: 6,
        draftStockDelta: cfg.draftStockBonus,
        enterInternationalTournament: tournamentType,
        internationalTournamentYear: year,
        ...(tournamentType === 'ASIAN_GAMES'
          ? { enterAsianGamesTournament: true }
          : {}),
      },
      {
        label: '소속팀 비시즌 회복 및 개인 훈련 집중',
        description: '이번 대회 대표팀 소집을 고사하고 체력 회복과 슈팅 교정에 전념합니다.',
        effectSummary: 'PHY +2, OUT +1 · 이번 국제대회 불참',
        statChanges: { phy: 2, out: 1 },
        trustDelta: 2,
      },
    ],
  };
}

export const SANGMU_ENLISTMENT_EVENT: CareerEvent = {
  id: 'EVT_SANGMU_ENLISTMENT',
  title: '국군체육부대 상무 입대 영장',
  subtitle: '만 27세 병역 의무 이행 · 2시즌 복무',
  description:
    '만 27세가 될 때까지 병역특례 혜택을 획득하지 못해 국군체육부대 상무에 입대하게 되었습니다. 2시즌 동안 복무한 뒤 프로 무대로 복귀합니다.',
  category: 'MILITARY',
  choices: [
    {
      label: '국군체육부대 상무 입대 (2시즌 복무)',
      description: '규칙적인 일과와 웨이트 트레이닝으로 전역 후 복귀를 준비합니다.',
      effectSummary: '2시즌 상무 복무 시작 · PHY +1, DEF +1 · 전역 후 병역필 전환',
      statChanges: { phy: 1, def: 1 },
      enlistSangmu: true,
    },
  ],
};

export function createSangmuEnlistmentEvent(career: CareerState): CareerEvent {
  if (career.league !== 'NBA' && career.age <= MILITARY_SERVICE_CONFIG.defaultEnlistAge) {
    return SANGMU_ENLISTMENT_EVENT;
  }
  const isNbaDeferred = career.league === 'NBA';
  return {
    ...SANGMU_ENLISTMENT_EVENT,
    subtitle: isNbaDeferred
      ? `만 ${career.age}세 병역 의무 이행 (NBA 해외 활동 연기 종료) · 2시즌 복무`
      : `만 ${career.age}세 병역 의무 이행 · 2시즌 복무`,
    description: isNbaDeferred
      ? `NBA 해외 활동 병역 연기 한도(만 28세)가 종료되어 국군체육부대 상무에 입대하게 되었습니다. 2시즌 동안 복무한 뒤 프로 무대로 복귀합니다.`
      : `만 ${career.age}세까지 병역특례 자격을 획득하지 못해 국군체육부대 상무에 입대하게 되었습니다. 2시즌 동안 복무한 뒤 프로 무대로 복귀합니다.`,
  };
}

export const VETERAN_CRITICAL_INJURY_EVENT: CareerEvent = {
  id: 'EVT_VETERAN_CRITICAL_INJURY',
  title: '경기 중 아킬레스건 · 무릎 중상 발생',
  subtitle: '베테랑 치명적 부상 은퇴 기로',
  description:
    '리바운드 경합 후 착지 과정에서 중상을 입어 최소 1년의 재활이 필요하다는 진단을 받았습니다. 베테랑으로서 진로를 결정해야 합니다.',
  category: 'INJURY',
  choices: [
    {
      label: '1년 재활 후 코트 복귀 도전 (PHY -7)',
      description: '운동능력 저하를 감수하고 재활 후 다시 코트에 섭니다.',
      effectSummary: 'PHY -7 영구 하락 · PLY +2 · 재활 복귀',
      statChanges: { phy: -7, ply: 2 },
      trustDelta: 5,
      bypassAgeStatCap: true,
    },
    {
      label: '부상을 받아들이고 현역 은퇴 선언',
      description: '코트와 작별하고 명예의 전당 심사로 이동합니다.',
      effectSummary: '현역 은퇴식 진행 및 명예의 전당 심사 이동',
      triggerRetirement: 'CRITICAL_INJURY',
    },
  ],
};

/**
 * 에이전트 은퇴 권유 리포트 생성
 * - 동일 리그 내 최근 2~3시즌 연속 기량 하락 또는 만 35세 이상 고령화 시에만 단 1회 발생
 * - 리그 승격(예: 대학/KBL -> NBA)으로 인한 볼륨 감소를 기량 하락으로 오인하지 않음!
 */
export function createAgentRetirementAdviceEvent(
  input: string | CareerState
): CareerEvent | null {
  let reasonText = '';

  if (typeof input === 'string') {
    reasonText = input;
  } else {
    const career = input;
    if (career.agentAdviceShown) return null;

    // 동일 리그 내 최근 기록만 추출해 비교 (리그 승격/이적 시 볼륨 착시 방지)
    const sameLeagueLogs = career.seasonLogs.filter(
      (l) => l.league === career.league
    );
    const ovrHist = career.ovrHistory || [];
    const twoYearOvrDrop =
      ovrHist.length >= 3 ? ovrHist[ovrHist.length - 3] - career.ovr : 0;

    let sameLeagueDecline = false;
    let peakSameLeaguePpg = 0;
    let lastSameLeaguePpg = 0;

    if (sameLeagueLogs.length >= 2) {
      const prevInLeague = sameLeagueLogs[sameLeagueLogs.length - 2];
      const lastInLeague = sameLeagueLogs[sameLeagueLogs.length - 1];
      peakSameLeaguePpg = Math.max(...sameLeagueLogs.map((l) => l.ppg));
      lastSameLeaguePpg = lastInLeague.ppg;

      const significantPpgDrop =
        prevInLeague.ppg >= 12.0 && lastInLeague.ppg <= prevInLeague.ppg * 0.58;
      const lostStarterMinutes =
        prevInLeague.mpg >= 24.0 && lastInLeague.mpg <= 13.5;

      if (
        career.age >= 31 &&
        ((twoYearOvrDrop >= 4 && (significantPpgDrop || lostStarterMinutes)) ||
          (twoYearOvrDrop >= 5 && lastInLeague.ppg < 8.0))
      ) {
        sameLeagueDecline = true;
      }
    }

    const advancedVeteranDecline =
      career.age >= 35 && (twoYearOvrDrop >= 3 || career.stats.phy <= 62);

    if (!sameLeagueDecline && !advancedVeteranDecline) {
      return null;
    }

    if (sameLeagueDecline && peakSameLeaguePpg > 0) {
      reasonText = `동일 리그 내에서 최근 종합 능력치(OVR -${twoYearOvrDrop})와 평균 득점(${peakSameLeaguePpg.toFixed(
        1
      )}점 → ${lastSameLeaguePpg.toFixed(1)}점)이 뚜렷하게 하락하며 베테랑의 기로에 섰습니다.`;
    } else {
      reasonText = `어느덧 만 ${career.age}세 고령 베테랑 구간에 접어들며 체력과 기량 유지가 쉽지 않은 시점이 찾아왔습니다.`;
    }
  }

  return {
    id: 'EVT_AGENT_RETIREMENT_ADVICE',
    title: '에이전트 면담 · 현역 은퇴 권유 리포트',
    subtitle: '동일 리그 기량 하락 또는 베테랑 은퇴 기로 (커리어 1회)',
    description: `${reasonText} 에이전트가 명예 은퇴와 현역 연장 선택지를 함께 제시했습니다. 현역 연장을 선택하면 이후 은퇴 권유는 다시 표시되지 않습니다.`,
    category: 'RETIREMENT_ADVICE',
    choices: [
      {
        label: '에이전트 조언 수용 · 명예 은퇴 선언',
        description: '공식 은퇴식과 명예의 전당 심사로 이동합니다.',
        effectSummary: '현역 명예 은퇴식 진행',
        triggerRetirement: 'VOLUNTARY_HONOR',
      },
      {
        label: '현역 연장 도전 (은퇴 권유 해제)',
        description: '권유를 정중히 거절하고 현역 도전을 이어갑니다.',
        effectSummary: '현역 연장 확정 · 이후 은퇴 권유 비활성화',
        trustDelta: 0,
        markAgentAdviceDismissed: true,
      },
    ],
  };
}

/**
 * 고교 가비지 타임 선수용 '코치의 기회' 인카운터
 * - 기회를 잡으면 이번 시즌 남은 경기에서 벤치 로테이션 출전 시간이 보장됩니다.
 */
export const COACH_CHANCE_EVENT_ID_PREFIX = 'EVT_MID_HS_COACH_CHANCE_';

export function createCoachChanceEvent(career: CareerState): CareerEvent {
  return {
    id: `${COACH_CHANCE_EVENT_ID_PREFIX}${career.seasonYear}`,
    title: '코치의 기회',
    subtitle: '정규시즌 반환점 · 로테이션 진입 찬스',
    description: `점수 차가 벌어진 4쿼터, 벤치 끝에서 묵묵히 몸을 풀던 당신을 ${career.team.shortName} 코치가 불러 세웠습니다. "다음 경기부터 몇 분 줘 볼 테니 보여줘 봐." 처음으로 찾아온 진짜 기회입니다.`,
    category: 'MID_SEASON_CROSSROADS',
    choices: [
      {
        label: '기회를 잡는다 · 주어진 몇 분에 모든 걸 쏟는다',
        description: '수비와 허슬부터 확실히 보여주며 코치의 믿음을 얻습니다.',
        riskTier: 'SAFE',
        effectSummary: '이번 시즌 벤치 로테이션 진입 확정 · 감독 신뢰도 +5 · DEF +1',
        statChanges: { def: 1 },
        trustDelta: 5,
        draftStockDelta: 2,
        grantRotationThisSeason: true,
      },
      {
        label: '아직은 이르다 · 개인 훈련으로 기본기를 다진다',
        description: '출전 대신 남는 시간을 슈팅·볼 핸들링 연습에 쏟습니다.',
        riskTier: 'SAFE',
        effectSummary: 'OUT +1, PLY +1 · 출전 시간 변화 없음',
        statChanges: { out: 1, ply: 1 },
        trustDelta: 1,
      },
    ],
  };
}

/**
 * 시즌 중반(50% 진행 시점) '커리어 분기점(Mid-Season Crossroads)' 이벤트 생성
 * - 트레이드 데드라인 루머는 최소 3시즌 쿨다운 + 현 소속팀 2시즌 이상 재적 조건 적용 (역할 약속 위반 시에만 예외)
 * - 매 시즌 반복 대신 올스타 브레이크 점검, 라커룸 리더십, 전술 해법 등 다양한 서사를 제공
 */
export function rollMidSeasonCrossroadsEvent(
  career: CareerState,
  rng: () => number = Math.random
): CareerEvent {
  const isPro = canUseProTradeSystem({
    league: career.league,
    contractType: career.contractType,
    isMilitaryTeam: career.team.isMilitaryTeam,
    teamId: career.team.id,
  });
  const isAceOrStarter =
    career.role.includes('에이스') || career.role.includes('스타터');

  const rumorCfg = DRAFT_SCOUTING_CONFIG.tradeRumor;
  const lastRumorYear = career.lastTradeRumorYear ?? null;
  const seasonsSinceRumor =
    lastRumorYear !== null ? career.seasonYear - lastRumorYear : 99;
  const seasonsOnTeam = career.seasonsOnCurrentTeam ?? 0;

  const passesTradeCooldown = seasonsSinceRumor >= rumorCfg.cooldownSeasons;
  const passesTeamTenure =
    Boolean(career.brokenRolePromise) ||
    seasonsOnTeam >= rumorCfg.minSeasonsOnTeam;

  let tradeRumorChance = 0;
  if (isPro && passesTradeCooldown && passesTeamTenure) {
    if (career.brokenRolePromise) {
      tradeRumorChance = rumorCfg.brokenPromiseProb;
    } else if (career.team.direction === 'REBUILDING') {
      tradeRumorChance =
        rumorCfg.rebuildingBaseProb +
        (career.contractYearsLeft <= 1 ? rumorCfg.contractYearBonusProb : 0);
    } else if (career.team.direction === 'CONTENDER') {
      tradeRumorChance = rumorCfg.contenderRareProb;
    } else {
      tradeRumorChance =
        rumorCfg.playoffHuntBaseProb +
        (career.contractYearsLeft <= 1 ? rumorCfg.contractYearBonusProb * 0.75 : 0);
    }
  }

  // 시나리오 1: 트레이드 데드라인 영입 타진 루머
  if (tradeRumorChance > 0 && rng() < tradeRumorChance) {
    return {
      id: `EVT_MID_TRADE_DEADLINE_${career.seasonYear}`,
      title: '트레이드 데드라인 영입 타진 루머',
      subtitle: '정규시즌 반환점 · 잔류 vs 구단 트레이드 협상',
      description: career.brokenRolePromise
        ? `계약 당시 약속받은 출전 시간이 지켜지지 않자 타 구단들이 데드라인을 앞두고 영입을 타진하고 있습니다.`
        : `${career.team.shortName}에서의 시즌이 길어지며 타 구단 단장들이 트레이드 문의를 넣어오고 있습니다. 잔류할지 프런트에 트레이드 협상을 요청할지 결정하세요.`,
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '트레이드 루머 일축 · 소속팀 잔류 선언',
          description: '라커룸 분위기를 다잡고 현재 동료들과 시즌을 완주합니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · 감독 신뢰도 +8 · INS +1, DEF +1',
          statChanges: { ins: 1, def: 1 },
          trustDelta: 8,
        },
        {
          label: '구단 프런트에 공식 트레이드 협상 요청',
          description:
            '단장에게 타 구단과의 트레이드 협상을 요청합니다. 시장 가치와 계약 조건에 따라 성사되거나 반려될 수 있습니다.',
          riskTier: 'HIGH_RISK',
          effectSummary:
            '구단 협상 판정 · 성사 시 타 구단 이적 · 반려 시 잔류 및 신뢰도 하락',
          draftStockDelta: 3,
          negotiateMidSeasonTrade: true,
        },
      ],
    };
  }

  // 시나리오 1-B: 고교 가비지 타임 선수에게 찾아오는 '코치의 기회' (잡으면 이번 시즌 로테이션 진입)
  if (
    career.league === 'HIGH_SCHOOL' &&
    career.role.includes('가비지') &&
    career.coachChanceRotationYear !== career.seasonYear &&
    rng() < ROLE_MPG_CONFIG.coachChance.triggerProb
  ) {
    return createCoachChanceEvent(career);
  }

  // 시나리오 2: 주전 부상으로 찾아온 3주간의 임시 선발 쇼케이스 기회 (벤치/식스맨/유망주 역할일 때)
  if (!isAceOrStarter) {
    return {
      id: `EVT_MID_STARTER_SHOWCASE_${career.seasonYear}`,
      title: '주전 부상 · 3주간 임시 선발 기회',
      subtitle: '정규시즌 반환점 · 주전 도약 찬스',
      description:
        '팀 내 주전 선수가 발목 염좌로 3주간 결장하며 임시 선발 출전 기회가 주어졌습니다.',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '공격적인 득점 쇼케이스로 어필',
          description: '과감한 1대1 돌파와 외곽슛으로 공격 재능을 증명합니다.',
          riskTier: 'HIGH_RISK',
          effectSummary: isPro
            ? '성공 시 INS +2, OUT +1, 성장 한계 확장, 주가 +8 · 실패 시 신뢰도 -6, 주가 -3'
            : '성공 시 INS +2, OUT +1, 주가 +8 · 실패 시 신뢰도 -6, 주가 -3',
          successCheck: {
            statKey: 'ins',
            difficulty: 0,
            baseProb: 0.65,
            label: '인사이드(INS) 기반 쇼케이스 판정',
          },
          successOutcome: {
            narrative: isPro
              ? '3주간 임시 선발로 맹활약하며 잠재력 상한선까지 끌어올렸습니다.'
              : '3주간 임시 선발로 맹활약하며 스카우트와 코칭스태프의 시선을 사로잡았습니다.',
            statChanges: { ins: 2, out: 1 },
            trustDelta: 5,
            draftStockDelta: 8,
            ...(isPro ? { potentialDelta: 1 } : {}),
          },
          failureOutcome: {
            narrative: '무리한 아이솔레이션이 턴오버로 이어지며 다시 벤치 롤로 복귀했습니다.',
            statChanges: { ply: -1 },
            trustDelta: -6,
            draftStockDelta: -3,
          },
          statChanges: { ins: 1, out: 1 },
          draftStockDelta: 7,
          ...(isPro ? { potentialDelta: 1 } : {}),
        },
        {
          label: '궂은일과 이타적 패스로 감독 신뢰 확보',
          description: '수비 로테이션과 찬스 메이킹에 집중해 감독의 신뢰를 얻습니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · PLY +1, DEF +1 · 감독 신뢰도 +10',
          statChanges: { ply: 1, def: 1 },
          trustDelta: 10,
        },
      ],
    };
  }

  // 시나리오 3~5: 다양한 비-트레이드 시즌 중반 분기점 로테이션
  const scenarioRoll = rng();
  if (scenarioRoll < 0.34) {
    return {
      id: `EVT_MID_ALLSTAR_BREAK_${career.seasonYear}`,
      title: '올스타 브레이크 집중 교정 캠프',
      subtitle: '정규시즌 반환점 · 체력 회복 vs 약점 보완',
      description:
        '올스타 브레이크로 5일간의 휴식기가 주어졌습니다. 후반기 순위 싸움을 앞두고 시간을 어떻게 활용하시겠습니까?',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '개인 스킬 트레이너와 약점 기술 집중 교정',
          description: '휴식 대신 슈팅 폼과 풋워크를 교정해 후반기 폭발력을 노립니다.',
          riskTier: 'HIGH_RISK',
          effectSummary: '성공 시 INS +1, OUT +2, PLY +1 · 실패 시 피로 누적 PHY -1',
          successCheck: {
            statKey: 'phy',
            difficulty: -2,
            baseProb: 0.72,
            label: '피지컬(PHY) 체력 소화력 판정',
          },
          successOutcome: {
            narrative: '브레이크 집중 교정으로 후반기에 한층 예리한 공격 감각을 뽐냈습니다.',
            statChanges: { ins: 1, out: 2, ply: 1 },
            trustDelta: 4,
            draftStockDelta: 5,
          },
          failureOutcome: {
            narrative: '휴식 없이 무리한 훈련을 강행해 하체 피로가 쌓였습니다.',
            statChanges: { phy: -1 },
            trustDelta: -2,
          },
          statChanges: { out: 1, ply: 1 },
        },
        {
          label: '리커버리와 전술 비디오 분석 집중',
          description: '관절을 회복시키며 후반기 상대 팀 수비 패턴을 분석합니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · PHY +1, PLY +1 · 감독 신뢰도 +6',
          statChanges: { phy: 1, ply: 1 },
          trustDelta: 6,
        },
      ],
    };
  }

  if (scenarioRoll < 0.67) {
    return {
      id: `EVT_MID_LOCKER_LEADERSHIP_${career.seasonYear}`,
      title: '후반기 연패 위기 · 라커룸 미팅',
      subtitle: '정규시즌 반환점 · 팀 케미스트리와 리더십',
      description:
        '후반기 진입 직전 3연패에 빠지며 라커룸 분위기가 무거워졌습니다. 팀의 핵심 선수로서 어떤 대응을 택하시겠습니까?',
      category: 'MID_SEASON_CROSSROADS',
      choices: [
        {
          label: '선수단 미팅 소집 · 수비 기강 다잡기',
          description: '수비 로테이션 문제를 정면으로 짚으며 팀의 각성을 이끌어냅니다.',
          riskTier: 'HIGH_RISK',
          effectSummary: '성공 시 DEF +2, REB +1, 신뢰도 +9 · 실패 시 신뢰도 -5',
          successCheck: {
            statKey: 'ply',
            difficulty: 0,
            baseProb: 0.68,
            label: '경기 조율(PLY) 리더십 판정',
          },
          successOutcome: {
            narrative: '직언에 동료들이 하나로 뭉치며 후반기 수비력이 크게 반등했습니다.',
            statChanges: { def: 2, reb: 1 },
            trustDelta: 9,
            draftStockDelta: 4,
          },
          failureOutcome: {
            narrative: '거친 표현에 일부 동료들이 반발하며 분위기가 잠시 서먹해졌습니다.',
            statChanges: {},
            trustDelta: -5,
          },
          statChanges: { def: 1 },
        },
        {
          label: '궂은일과 리바운드 경합으로 솔선수범',
          description: '말보다 허슬 플레이로 팀 에너지를 끌어올립니다.',
          riskTier: 'SAFE',
          effectSummary: '안정 확정 · REB +1, PHY +1 · 감독 신뢰도 +7',
          statChanges: { reb: 1, phy: 1 },
          trustDelta: 7,
        },
      ],
    };
  }

  // 시나리오 5: 시즌 중반 상대 집중 견제 & 슈팅 밸런스 조정
  return {
    id: `EVT_MID_TACTICAL_ADJUST_${career.seasonYear}`,
    title: '상대 수비 집중 견제와 전술 해법',
    subtitle: '정규시즌 반환점 · 후반기 돌파구 선택',
    description:
      '시즌 중반에 접어들며 상대 팀들이 집요한 더블팀과 함정 수비를 펼치고 있습니다.',
    category: 'MID_SEASON_CROSSROADS',
    choices: [
      {
        label: '퀵릴리스 야간 슈팅 · 풀업 3점 특훈',
        description: '수비가 붙기 전에 한 박자 빠르게 올라가는 릴리스로 돌파구를 찾습니다.',
        riskTier: 'HIGH_RISK',
        effectSummary: '성공 시 OUT +3, PLY +1, 주가 +7 · 실패 시 PHY -1, 신뢰도 -4',
        successCheck: {
          statKey: 'out',
          difficulty: 2,
          baseProb: 0.64,
          label: '외곽 슈팅(OUT) 기반 특훈 판정',
        },
        successOutcome: {
          narrative: '야간 특훈으로 더블팀 위에서도 흔들리지 않는 퀵릴리스를 완성했습니다.',
          statChanges: { out: 3, ply: 1 },
          trustDelta: 5,
          draftStockDelta: 7,
        },
        failureOutcome: {
          narrative: '과도한 야간 슈팅 훈련으로 피로가 누적되어 슛 밸런스가 흔들렸습니다.',
          statChanges: { phy: -1 },
          trustDelta: -4,
        },
        statChanges: { out: 2, ply: 1 },
        draftStockDelta: 5,
      },
      {
        label: '웨이트와 압박 수비로 공수 밸런스 재정비',
        description: '체력과 대인 방어로 상대 에이스를 먼저 지치게 만듭니다.',
        riskTier: 'SAFE',
        effectSummary: '안정 확정 · DEF +1, REB +1, PHY +1 · 감독 신뢰도 +7',
        statChanges: { def: 1, reb: 1, phy: 1 },
        trustDelta: 7,
      },
    ],
  };
}

export const FAREWELL_TOUR_LOGS: string[] = [
  '원정 경기장 관중들이 기립박수로 마지막 원정 경기를 배웅했습니다.',
  '경기 종료 후 상대 팀 에이스와 포옹을 나누며 유니폼을 교환했습니다.',
  '원정 구단 프런트가 헌정 영상과 기념 액자를 전달하며 경의를 표했습니다.',
  '코트를 떠나는 순간 양 팀 벤치 선수들이 일어나 박수를 보냈습니다.',
  '관중석 팬들이 은퇴 기념 플래카드를 들어 올리며 마지막 시즌을 응원했습니다.',
];

/**
 * 32~34세 베테랑 '플레이 스타일 진화(Re-invention)' 특별 서사 이벤트 (커리어 1회)
 * - 에이징 커브로 인해 피지컬(PHY)이 하락하기 시작할 때, 점프력 대신 패스 시야(PLY)와 코너 3점슛(OUT)으로
 *   팀을 이끄는 베테랑 포인트 포워드 / 3&D 도사로 변신할 수 있는 기회 제공
 */
export function createVeteranReinventionEvent(
  career: CareerState
): CareerEvent {
  return {
    id: 'EVT_VETERAN_REINVENTION',
    title: '베테랑 플레이 스타일 전환 제안',
    subtitle: `만 ${career.age}세 베테랑 전환기 · 코칭스태프 전술 미팅 (커리어 1회)`,
    description: `만 ${career.age}세에 접어들며 이전 같은 탄력 유지가 쉽지 않아졌습니다. 감독이 패스 시야(PLY)와 코너 3점슛(OUT) 중심의 베테랑 스타일 전환을 제안했습니다.`,
    category: 'VETERAN_LEGACY',
    choices: [
      {
        label: '패스 시야와 외곽슛 중심의 베테랑 스타일로 전환',
        description:
          '운동능력(PHY) 저하를 받아들이고 슈팅과 패스 지능을 끌어올려 30대 후반까지 경쟁력을 유지합니다.',
        effectSummary:
          'PLY +3, OUT +3, DEF +1 (PHY -2) · 향후 에이징 시 슛/패스 하락 완화',
        statChanges: { ply: 3, out: 3, def: 1, phy: -2 },
        trustDelta: 9,
        triggerVeteranReinvention: true,
        bypassAgeStatCap: true,
      },
      {
        label: '기존 돌파와 인사이드 스타일 고수',
        description:
          '웨이트 트레이닝으로 버티며 기존 에이스 플레이를 유지합니다.',
        effectSummary: 'INS +2, PHY +1 · 감독 신뢰도 +3 · 기존 스타일 유지',
        statChanges: { ins: 2, phy: 1 },
        trustDelta: 3,
        bypassAgeStatCap: true,
      },
    ],
  };
}

/**
 * 오프시즌 이벤트 큐 생성:
 * - Slot A: 병역/베테랑 분기/국제대회 국가대표 차출
 * - Slot B: 예약된 연쇄 스토리 · 멀티 시즌 스토리 아크 · 조합형/포지션 인카운터
 * 국제대회 차출이 매년 발생하는 전성기에도 Slot B 서사 이벤트를 함께 적재해 스토리 아크와 인카운터 기아를 방지합니다.
 */
export function rollSeasonEventQueue(
  career: CareerState,
  rng: () => number = Math.random,
  completedSeasonYear?: number
): CareerEvent[] {
  const targetYear = completedSeasonYear ?? career.seasonYear;
  const scheduledTournament = getInternationalTournamentByYear(targetYear);
  const tourneyCfg = INTERNATIONAL_TOURNAMENT_CONFIG[scheduledTournament];
  const alreadyPlayedThisTournament = (career.internationalHistory || []).some(
    (rec) => rec.year === targetYear && rec.tournamentType === scheduledTournament
  );
  const exemptionMaxAge = getMilitaryExemptionMaxAgeForLeague(career.league);
  const queue: CareerEvent[] = [];

  const rollNarrativeSlot = (): CareerEvent | null => {
    if (career.pendingChainEvent) {
      return rollCombinatorialEncounter(career, rng);
    }
    if (rng() < 0.48) {
      return rollCombinatorialEncounter(career, rng);
    }
    return null;
  };

  // 0) 병역 미필자 상무 입대 이벤트 (또는 입대 직전 마지막 특례 대회)
  const enlistAgeThreshold = getMilitaryEnlistAgeForLeague(career.league);
  if (
    !career.militaryExempt &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.age >= enlistAgeThreshold
  ) {
    const completedSeasonAge =
      completedSeasonYear !== undefined ? career.age - 1 : career.age;
    const isExemptionTournament = tourneyCfg.militaryExemptionMinMedal !== null;
    const eligibleForLastChanceExemption =
      !career.nationalTeamRetired &&
      completedSeasonAge <= exemptionMaxAge &&
      isExemptionTournament &&
      !alreadyPlayedThisTournament &&
      career.ovr >= tourneyCfg.minOvr;
    if (eligibleForLastChanceExemption) {
      queue.push(
        createInternationalCallupEvent(career, targetYear, scheduledTournament)
      );
      return queue;
    }
    queue.push(createSangmuEnlistmentEvent(career));
    return queue;
  }

  // 1) 만 32~34세 베테랑 '플레이 스타일 진화(Re-invention)' 이벤트 (커리어 단 1회)
  if (
    career.age >= 32 &&
    career.age <= 34 &&
    !career.veteranReinventionOffered &&
    !career.veteranReinvented
  ) {
    queue.push(createVeteranReinventionEvent(career));
    return queue;
  }

  // 2) 노장 치명적 부상 은퇴 기로: 만 32세 이상이고 PHY <= 65일 때 10% 확률
  if (career.age >= 32 && career.stats.phy <= 65 && rng() < 0.1) {
    queue.push(VETERAN_CRITICAL_INJURY_EVENT);
    return queue;
  }

  // 3) 에이전트 은퇴 권유 리포트 (커리어 중 단 1회)
  if (!career.agentAdviceShown) {
    const adviceEvent = createAgentRetirementAdviceEvent(career);
    if (adviceEvent) {
      queue.push(adviceEvent);
      return queue;
    }
  }

  // 4) 4년 주기 국제대회 국가대표 차출 (Slot A) + 서사 이벤트 동시 큐 적재 (Slot B)
  if (
    !career.nationalTeamRetired &&
    !alreadyPlayedThisTournament &&
    career.militaryServiceSeasonsLeft === 0 &&
    career.age >= 19 &&
    career.age <= 36 &&
    career.ovr >= tourneyCfg.minOvr
  ) {
    const meetsTournamentEligibility =
      scheduledTournament === 'ASIAN_GAMES'
        ? (!career.militaryExempt && career.age >= 20 && career.age <= exemptionMaxAge) ||
          career.ovr >= 70
        : true;
    if (meetsTournamentEligibility) {
      queue.push(
        createInternationalCallupEvent(career, targetYear, scheduledTournament)
      );
      const narrativeFollowup = rollNarrativeSlot();
      if (narrativeFollowup) {
        queue.push(narrativeFollowup);
      }
      return queue;
    }
  }

  // 5) 일반 서사 슬롯 (연쇄 이벤트 -> 멀티 시즌 스토리 아크 -> 조합형/포지션 인카운터)
  const narrative = rollNarrativeSlot();
  if (narrative) {
    queue.push(narrative);
  }
  return queue;
}

export function rollSeasonEvent(
  career: CareerState,
  rng: () => number = Math.random,
  completedSeasonYear?: number
): CareerEvent | null {
  return rollSeasonEventQueue(career, rng, completedSeasonYear)[0] ?? null;
}

