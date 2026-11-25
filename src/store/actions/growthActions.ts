/**
 * 훈련 · 포지션 · 캠프 · 퍼스널 케어 · 트레이드 요청 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  DRAFT_SCOUTING_CONFIG,
  ECONOMY_CONFIG,
  ROLE_MPG_CONFIG,
  canUseProTradeSystem,
  clampNum,
  isPersonalCareAllowedInLeague,
} from '../../config/balanceConfig';
import {
  getTeamsByLeague,
} from '../../data/teams';
import {
  determineTeamRolePromise,
} from '../../engine/draftEngine';
import {
  syncCareerRelationships,
} from '../../engine/progressionEngine';
import {
  calculateRoleAndMpg,
} from '../../engine/seasonSimulator';
import {
  applySpecialCampProgram,
  calculateOvr,
  canSwitchToPosition,
  enforceBiomechanicalCaps,
  evaluatePlayerBadges,
  getPlaystyleInfo,
  reconcilePlaystyleForPosition,
} from '../../engine/statCalculator';
import {
  PersonalCareId,
  TrainingFocus,
  TrainingPresetId,
} from '../../types/game';
import {
  formatCurrencyDetailed,
} from '../../utils/formatters';
import {
  getPersonalCarePackageCost,
  getEffectiveCashBalance,
  buildTeamTransferRelationships,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
} from '../careerStoreTypes';

export type GrowthActions = Pick<CareerStoreState, 'setTrainingFocus' | 'applyTrainingPreset' | 'switchPrimaryPosition' | 'unlockSecondaryPosition' | 'runSpecialCamp' | 'purchasePersonalCare' | 'reapplyLastPersonalCare' | 'requestTrade'>;

export function createGrowthActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): GrowthActions {
  return {
    setTrainingFocus: (focus) => {
      const { career } = get();
      if (!career) return;
      set({
        career: {
          ...career,
          trainingFocus: focus,
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: '중점 훈련 변경',
          description: '다음 시즌 결산 시 선택한 훈련 비중이 반영됩니다.',
          tone: 'emerald',
        },
      });
    },

    applyTrainingPreset: (presetId) => {
      const { career } = get();
      if (!career) return;
      const isBig = career.primaryPos === 'PF' || career.primaryPos === 'C';
      const presetMap: Record<
        TrainingPresetId,
        { focus: TrainingFocus; label: string }
      > = {
        SHOOTING_SPACING: {
          focus: 'OUTSIDE_SHOOTING',
          label: '슈팅 · 스페이싱',
        },
        ALL_AROUND: {
          focus: 'BALANCED',
          label: '올라운드 균형',
        },
        DEFENSE_GLASS: {
          focus: isBig ? 'REBOUND_POST' : 'DEFENSE_LOCKDOWN',
          label: isBig ? '리바운드 · 골밑 수비' : '대인 수비 · 리바운드',
        },
        PHYSICAL_ENGINE: {
          focus: 'PHYSICAL_CONDITIONING',
          label: '체력 · 내구성',
        },
      };
      const picked = presetMap[presetId];
      set({
        career: {
          ...career,
          trainingFocus: picked.focus,
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `${picked.label} 프리셋 적용`,
          description: '다음 시즌 훈련 계획에 자동 반영됩니다.',
          tone: 'emerald',
        },
      });
    },

    switchPrimaryPosition: (newPos) => {
      const { career } = get();
      if (!career || career.primaryPos === newPos) return;

      const switchCheck = canSwitchToPosition(
        career.primaryPos,
        newPos,
        {
          heightCm: career.heightCm,
          secondaryPos: career.secondaryPos,
        }
      );
      if (!switchCheck.allowed) {
        get().showToast(
          '포지션 전향 불가',
          switchCheck.reason || '인접 포지션 또는 해금된 부포지션으로만 전향할 수 있습니다.',
          'amber'
        );
        return;
      }

      const cappedStats = enforceBiomechanicalCaps(
        career.stats,
        career.heightCm,
        newPos
      );
      const newOvr = calculateOvr(cappedStats, newPos, career.heightCm);
      const newSecondary =
        career.secondaryPos === newPos ? career.primaryPos : career.secondaryPos;
      const nextPlaystyle = reconcilePlaystyleForPosition(
        career.playstyle,
        cappedStats,
        newPos
      );
      const playstyleChanged = nextPlaystyle !== career.playstyle;
      const nextStyleInfo = getPlaystyleInfo(nextPlaystyle, newPos);
      const nextBadges = evaluatePlayerBadges(
        cappedStats,
        newSecondary,
        career.growthDna,
        nextPlaystyle,
        career.traits,
        newPos
      );
      const { role } = calculateRoleAndMpg({
        ...career,
        stats: cappedStats,
        primaryPos: newPos,
        ovr: newOvr,
        secondaryPos: newSecondary,
      });

      set({
        career: {
          ...career,
          stats: cappedStats,
          primaryPos: newPos,
          secondaryPos: newSecondary,
          playstyle: nextPlaystyle,
          badges: nextBadges,
          ovr: newOvr,
          peakOvr: Math.max(career.peakOvr, newOvr),
          role,
          milestones: [
            ...career.milestones,
            {
              id: `MS_POS_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `주포지션 ${newPos} 전향`,
              description: playstyleChanged
                ? `코칭스태프와 협의해 주포지션을 ${newPos}(으)로 변경하며 플레이 스타일도 ${nextStyleInfo.label}(으)로 재정립했습니다 (OVR ${newOvr}).`
                : `코칭스태프와 협의해 주포지션을 ${newPos}(으)로 변경했습니다 (OVR ${newOvr}).`,
              type: 'SPECIAL',
              teamName: career.team.name,
            },
          ],
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `주포지션 ${newPos} 전향 완료`,
          description: playstyleChanged
            ? `새 포지션 기준 종합 OVR ${newOvr} · 스타일 ${nextStyleInfo.label}(으)로 재편`
            : `새 포지션 기준 종합 OVR은 ${newOvr}입니다.`,
          tone: 'orange',
        },
      });
    },

    unlockSecondaryPosition: (secPos) => {
      const { career } = get();
      if (!career || career.primaryPos === secPos) return;
      const badges = evaluatePlayerBadges(
        career.stats,
        secPos,
        career.growthDna,
        career.playstyle,
        career.traits,
        career.primaryPos
      );
      const { role } = calculateRoleAndMpg({
        ...career,
        secondaryPos: secPos,
      });

      const syncedDual = syncCareerRelationships(career, undefined, 5);
      set({
        career: {
          ...career,
          secondaryPos: secPos,
          badges,
          role,
          coachTrust: syncedDual.coachTrust,
          relationships: syncedDual.relationships,
          milestones: [
            ...career.milestones,
            {
              id: `MS_DUAL_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `듀얼 포지션 (${career.primaryPos}/${secPos}) 등록`,
              description: '멀티 포지션 소화 능력을 인정받아 팀 내 입지 보너스(+2.5)를 확보했습니다.',
              type: 'SPECIAL',
              teamName: career.team.name,
            },
          ],
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `부포지션 ${secPos} 해금`,
          description: '멀티 포지션 소화로 출전 시간 확보에 유리해졌습니다.',
          tone: 'emerald',
        },
      });
    },

    runSpecialCamp: (campType) => {
      const { career } = get();
      if (!career) return;
      if (career.lastCampYear === career.seasonYear) {
        get().showToast(
          '이번 시즌 캠프 수료 완료',
          '특별 캠프 및 신체 개조는 시즌당 1회만 참가할 수 있습니다.',
          'amber'
        );
        return;
      }

      const result = applySpecialCampProgram(career, campType);
      const currentCash = getEffectiveCashBalance(career);
      if (currentCash < result.costUsd) {
        get().showToast(
          '보유 자산 부족',
          `필요 비용 ${formatCurrencyDetailed(result.costUsd)} (현재 ${formatCurrencyDetailed(currentCash)})`,
          'amber'
        );
        return;
      }

      const nextOvr = calculateOvr(
        result.nextStats,
        career.primaryPos,
        career.heightCm
      );
      const nextBadges = evaluatePlayerBadges(
        result.nextStats,
        career.secondaryPos,
        career.growthDna,
        career.playstyle,
        career.traits,
        career.primaryPos
      );
      const { role } = calculateRoleAndMpg({
        ...career,
        stats: result.nextStats,
        ovr: nextOvr,
      });

      const isVeteranCamp = career.age >= 31;
      set({
        career: {
          ...career,
          stats: result.nextStats,
          ovr: nextOvr,
          peakOvr: Math.max(career.peakOvr, nextOvr),
          potential: result.nextPotential,
          cashBalance: Math.max(0, currentCash - result.costUsd),
          draftStock: isVeteranCamp
            ? career.draftStock
            : Math.min(100, career.draftStock + 4),
          lastCampYear: career.seasonYear,
          campAgingShield:
            result.grantsAgingShield || Boolean(career.campAgingShield),
          badges: nextBadges,
          role,
          milestones: [
            ...career.milestones,
            {
              id: `MS_CAMP_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: isVeteranCamp
                ? `베테랑 컨디셔닝 캠프 수료 (${
                    campType === 'LEGEND_SKILL_CAMP'
                      ? '기량 유지·노쇠화 방어'
                      : campType === 'BULK_UP'
                      ? '코어 밸런스 조정'
                      : '체중 감량·기동 유지'
                  })`
                : `비시즌 특별 캠프 수료 (${
                    campType === 'LEGEND_SKILL_CAMP'
                      ? '엘리트 스킬 캠프'
                      : campType === 'BULK_UP'
                      ? '벌크업 신체 개조'
                      : '린매스업 신체 개조'
                  })`,
              description: result.summary,
              type: 'SPECIAL',
              teamName: career.team.name,
            },
          ],
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: isVeteranCamp ? '베테랑 캠프 수료' : '특별 훈련 캠프 수료',
          description: result.summary,
          tone: 'emerald',
        },
      });
    },

    purchasePersonalCare: (careId) => {
      const { career } = get();
      if (!career) return;

      if (!isPersonalCareAllowedInLeague(careId, career.league)) {
        get().showToast(
          '프로 무대 진출 후 이용 가능',
          '시그니처 스니커즈 및 글로벌 에이전시 마케팅은 프로 입단 이후 계약할 수 있습니다.',
          'amber'
        );
        return;
      }

      const currentCare = career.activePersonalCare || [];
      if (currentCare.includes(careId)) {
        get().showToast(
          '이미 적용된 프로그램',
          '다음 시즌 진행 시 효과가 자동 반영됩니다.',
          'amber'
        );
        return;
      }

      const costUsd = getPersonalCarePackageCost(careId, career.league);
      const currentCash = getEffectiveCashBalance(career);
      if (currentCash < costUsd) {
        get().showToast(
          '보유 자산 부족',
          `필요 비용 ${formatCurrencyDetailed(costUsd)} (현재 ${formatCurrencyDetailed(currentCash)})`,
          'amber'
        );
        return;
      }

      const sneakerCfg = ECONOMY_CONFIG.personalCare.SIGNATURE_SNEAKER_MARKETING;
      const rehabCfg = ECONOMY_CONFIG.personalCare.REHAB_LOAD_MGMT;
      const rehabRiskPct = Math.round((1 - rehabCfg.injuryRiskMultiplier) * 100);
      const rehabGamesPct = Math.round((1 - rehabCfg.injuryGamesMultiplier) * 100);
      const majorRehabPct = Math.round(
        (1 - ROLE_MPG_CONFIG.injury.tiers.major.majorRehabGamesMult) * 100
      );
      const careMeta: Record<
        PersonalCareId,
        { title: string; summary: string; stockBoost: number; popBoost: number; trustBoost: number }
      > = {
        BIOMECH_SKILL_LAB: {
          title: '전담 바이오메카닉스 · 스킬 랩 계약 완료',
          summary:
            '다음 시즌 능력치 성장 효율 +15% 상승 및 30대 노쇠화 완화 보정이 적용됩니다.',
          stockBoost: 3,
          popBoost: 4,
          trustBoost: 3,
        },
        REHAB_LOAD_MGMT: {
          title: '전담 재활 · 로드 매니지먼트 팀 구축',
          summary: `다음 시즌 부상 발생 확률 ${rehabRiskPct}% 감소 및 경미/중등도 결장 ${rehabGamesPct}%·중상 결장 ${majorRehabPct}% 경감이 적용됩니다.`,
          stockBoost: 2,
          popBoost: 2,
          trustBoost: 2,
        },
        SIGNATURE_SNEAKER_MARKETING: {
          title: '글로벌 에이전시 · 시그니처 스니커즈 런칭',
          summary:
            '팬 인지도와 스카우트 주가가 상승하고 은퇴 시 레거시 점수 보너스를 획득합니다.',
          stockBoost: sneakerCfg.stockBoost,
          popBoost: sneakerCfg.fanPopularityBoost,
          trustBoost: 1,
        },
      };

      const meta = careMeta[careId];
      const nextCareIds = [...currentCare, careId];
      const syncedCare = syncCareerRelationships(
        career,
        {
          mediaFan: careId === 'SIGNATURE_SNEAKER_MARKETING' ? 6 : 0,
          frontOffice: careId === 'BIOMECH_SKILL_LAB' ? 3 : 0,
        },
        meta.trustBoost
      );
      set({
        lastPersonalCareIds: nextCareIds,
        career: {
          ...career,
          cashBalance: Math.max(0, currentCash - costUsd),
          activePersonalCare: nextCareIds,
          purchasedPersonalCareCount: (career.purchasedPersonalCareCount || 0) + 1,
          fanPopularity: (career.fanPopularity || 0) + meta.popBoost,
          draftStock: Math.min(100, career.draftStock + meta.stockBoost),
          coachTrust: syncedCare.coachTrust,
          relationships: syncedCare.relationships,
          milestones: [
            ...career.milestones,
            {
              id: `MS_CARE_${careId}_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: meta.title,
              description: meta.summary,
              type: 'SPECIAL',
              teamName: career.team.name,
            },
          ],
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: meta.title,
          description: meta.summary,
          tone: 'emerald',
        },
      });
    },

    reapplyLastPersonalCare: () => {
      const { career, lastPersonalCareIds } = get();
      if (!career || lastPersonalCareIds.length === 0) return;

      const currentCare = career.activePersonalCare || [];
      let cash = getEffectiveCashBalance(career);
      const appliedNow: PersonalCareId[] = [];
      let totalCost = 0;
      let popBoost = 0;
      let stockBoost = 0;
      let trustBoost = 0;

      const sneakerCfg = ECONOMY_CONFIG.personalCare.SIGNATURE_SNEAKER_MARKETING;
      const boostMap: Record<
        PersonalCareId,
        { stock: number; pop: number; trust: number }
      > = {
        BIOMECH_SKILL_LAB: { stock: 3, pop: 4, trust: 3 },
        REHAB_LOAD_MGMT: { stock: 2, pop: 2, trust: 2 },
        SIGNATURE_SNEAKER_MARKETING: {
          stock: sneakerCfg.stockBoost,
          pop: sneakerCfg.fanPopularityBoost,
          trust: 1,
        },
      };

      for (const careId of lastPersonalCareIds) {
        if (currentCare.includes(careId)) continue;
        if (!isPersonalCareAllowedInLeague(careId, career.league)) continue;
        const cost = getPersonalCarePackageCost(careId, career.league);
        if (cash < cost) continue;
        cash -= cost;
        totalCost += cost;
        appliedNow.push(careId);
        popBoost += boostMap[careId].pop;
        stockBoost += boostMap[careId].stock;
        trustBoost += boostMap[careId].trust;
      }

      if (appliedNow.length === 0) {
        get().showToast(
          '재적용 가능한 항목 없음',
          '이미 모두 적용되었거나 보유 자산이 부족합니다.',
          'amber'
        );
        return;
      }

      const nextActive = [...currentCare, ...appliedNow];
      const syncedReapply = syncCareerRelationships(
        career,
        {
          mediaFan: appliedNow.includes('SIGNATURE_SNEAKER_MARKETING') ? 6 : 0,
          frontOffice: appliedNow.includes('BIOMECH_SKILL_LAB') ? 3 : 0,
        },
        trustBoost
      );
      set({
        lastPersonalCareIds: nextActive,
        career: {
          ...career,
          cashBalance: Math.max(0, cash),
          activePersonalCare: nextActive,
          purchasedPersonalCareCount:
            (career.purchasedPersonalCareCount || 0) + appliedNow.length,
          fanPopularity: (career.fanPopularity || 0) + popBoost,
          draftStock: Math.min(100, career.draftStock + stockBoost),
          coachTrust: syncedReapply.coachTrust,
          relationships: syncedReapply.relationships,
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `이전 퍼스널 케어 ${appliedNow.length}건 재적용`,
          description: `총 ${formatCurrencyDetailed(totalCost)} 집행 완료`,
          tone: 'emerald',
        },
      });
    },

    requestTrade: () => {
      const { career } = get();
      if (!career) return;

      if (
        !canUseProTradeSystem({
          league: career.league,
          contractType: career.contractType,
          isMilitaryTeam: career.team.isMilitaryTeam,
          teamId: career.team.id,
        })
      ) {
        return;
      }

      if (
        career.seasonPhase &&
        career.seasonPhase !== 'REGULAR_SEASON' &&
        career.seasonPhase !== 'OFFSEASON'
      ) {
        get().showToast(
          '트레이드 요청 불가 시점',
          '포스트시즌 또는 라이브 경기 진행 중에는 트레이드를 요청할 수 없습니다.',
          'amber'
        );
        return;
      }

      if (career.tradeRequestedThisYear) {
        get().showToast(
          '트레이드 요청 완료 상태',
          '구단 프런트와의 트레이드 협상은 시즌당 1회만 시도할 수 있습니다.',
          'amber'
        );
        return;
      }

      const pool = getTeamsByLeague(career.league, career.teamRatingsMap).filter(
        (t) => t.id !== career.team.id
      );
      if (pool.length === 0) return;

      // 연속 승인 확률 산출 (역할 약속 위반/높은 OVR 레버리지/낮은 신뢰도 반영)
      const trCfg = DRAFT_SCOUTING_CONFIG.trade;
      const acceptProb = clampNum(
        trCfg.baseAcceptanceProb +
          (career.brokenRolePromise ? trCfg.brokenPromiseBonus : 0) +
          (career.ovr - career.team.rating) * trCfg.highOvrLeverageSlope +
          (career.coachTrust < 45 ? trCfg.lowTrustBonus : 0),
        0.18,
        0.95
      );

      if (Math.random() >= acceptProb) {
        const nextRejectedTrust = Math.max(
          15,
          career.coachTrust + trCfg.rejectedTrustPenalty
        );
        const syncedRejected = syncCareerRelationships(
          career,
          { frontOffice: -6 },
          nextRejectedTrust - career.coachTrust
        );
        set({
          career: {
            ...career,
            tradeRequestedThisYear: true,
            coachTrust: syncedRejected.coachTrust,
            relationships: syncedRejected.relationships,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '구단 프런트가 트레이드 요청을 반려했습니다',
            description:
              '현재 계약 조건과 타 구단 매물 상황이 맞지 않아 트레이드가 보류되었습니다.',
            tone: 'amber',
          },
        });
        return;
      }

      const posFitCandidates = pool.filter(
        (t) =>
          t.neededPositions?.includes(career.primaryPos) ||
          (career.secondaryPos
            ? t.neededPositions?.includes(career.secondaryPos)
            : false)
      );
      const candidatePool =
        posFitCandidates.length > 0 ? posFitCandidates : pool;
      const target =
        candidatePool[Math.floor(Math.random() * candidatePool.length)];

      const promise = determineTeamRolePromise(
        career,
        target,
        career.contractType
      );
      const nextTrust =
        promise.promisedRole === 'ACE_FIRST_OPTION'
          ? 66
          : promise.promisedRole === 'STARTER_GUARANTEE'
          ? 58
          : 50;
      const { role } = calculateRoleAndMpg({
        ...career,
        team: target,
        coachTrust: nextTrust,
        promisedRole: promise.promisedRole,
      });
      const transferRelationships = buildTeamTransferRelationships(
        career,
        nextTrust
      );

      set({
        career: {
          ...career,
          team: target,
          seasonsOnCurrentTeam: 0,
          coachTrust: transferRelationships.coachTrust,
          relationships: transferRelationships,
          promisedRole: promise.promisedRole,
          brokenRolePromise: false,
          tradeRequestedThisYear: true,
          role,
          milestones: [
            ...career.milestones,
            {
              id: `MS_TRADE_${Date.now()}`,
              year: career.seasonYear,
              age: career.age,
              title: `공식 트레이드 이적: ${target.name}`,
              description: `출전 시간과 새로운 역할을 찾아 ${target.name} 구단으로 트레이드 이적했습니다 (${promise.promisedRoleLabel}).`,
              type: 'SPECIAL',
              teamName: target.name,
            },
          ],
        },
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `${target.name} 트레이드 이적 완료`,
          description: `약속 역할: ${promise.promisedRoleLabel} · 입지: ${role}`,
          tone: 'orange',
        },
      });
    },
  };
}
