/**
 * 새 커리어 시작 · 은퇴 · 초기화 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  ECONOMY_CONFIG,
  US_HIGH_SCHOOL_DEVELOPMENT_CONFIG,
} from '../../config/balanceConfig';
import {
  ALL_TEAMS,
  HIGH_SCHOOL_TEAMS,
  US_HIGH_SCHOOL_TEAMS,
} from '../../data/teams';
import {
  createInitialRelationships,
  createInitialStoryArcs,
  evaluateNationalTeamRetirement,
  getEffectiveStoryArcs,
  isNationalTeamEvent,
  syncCareerRelationships,
} from '../../engine/progressionEngine';
import {
  createInitialRecordBook,
  syncRecordBookWithHof,
} from '../../engine/recordBookEngine';
import {
  buildHallOfFameEntry,
  evaluateCareerLegacy,
} from '../../engine/retirementEngine';
import {
  calculateRoleAndMpg,
} from '../../engine/seasonSimulator';
import {
  calculateOvr,
  createInitialStats,
  evaluatePlayerBadges,
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getTraitInfo,
  rollInitialPotential,
  rollInnateTrait,
  rollPlayerDnaAndPlaystyle,
} from '../../engine/statCalculator';
import {
  CareerMilestone,
  CareerState,
  NationalityCode,
  TeamInfo,
} from '../../types/game';
import {
  DEFAULT_NATIONALITY,
  isKoreanNational,
  isNationalityCode,
} from '../../data/nationalities';
import {
  dequeueNextPendingEvent,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
  ToastMessage,
} from '../careerStoreTypes';

export type CareerLifecycleActions = Pick<CareerStoreState, 'startNewCareer' | 'triggerRetirement' | 'completeRetirementAndReturnHome' | 'resetActiveCareer' | 'resetRecordBookOnly' | 'declareNationalTeamRetirement' | 'resetHallOfFameOnly' | 'resetAllGameData' | 'resetByScope'>;

export function createCareerLifecycleActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): CareerLifecycleActions {
  return {
    startNewCareer: ({
      name,
      jerseyNumber,
      heightCm,
      primaryPos,
      highSchoolTeamId,
      nationality: requestedNationality,
    }) => {
      const nationality: NationalityCode = isNationalityCode(requestedNationality)
        ? requestedNationality
        : DEFAULT_NATIONALITY;
      // 병역 의무는 대한민국 국적에만 있습니다. 다른 국적은 처음부터 병역 대상이 아닙니다.
      const isKorean = nationality === 'KOR';
      // 1.2.0: 한국 고교와 미국 고교 중 고른 학교의 리그로 출발합니다.
      // 한국 고교는 대한민국 국적만 입학할 수 있어, 외국 국적이 한국 고교를 고르면 미국 고교로 바꿉니다.
      const selectableSchools = isKorean
        ? [...HIGH_SCHOOL_TEAMS, ...US_HIGH_SCHOOL_TEAMS]
        : US_HIGH_SCHOOL_TEAMS;
      const hsTeam: TeamInfo =
        selectableSchools.find((t) => t.id === highSchoolTeamId) ||
        (isKorean ? HIGH_SCHOOL_TEAMS[0] : US_HIGH_SCHOOL_TEAMS[0]);
      const startingLeague: 'HIGH_SCHOOL' | 'US_HIGH_SCHOOL' =
        hsTeam.league === 'US_HIGH_SCHOOL' ? 'US_HIGH_SCHOOL' : 'HIGH_SCHOOL';
      // 미국 고교는 4년제(만 15세 입학), 한국 고교는 3년제(만 16세 입학). 둘 다 만 19세에 졸업합니다.
      const isUsHighSchoolStart = startingLeague === 'US_HIGH_SCHOOL';
      const startAge = isUsHighSchoolStart ? US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.startAge : 16;
      const schoolYears = isUsHighSchoolStart ? US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.schoolYears : 3;

      const trimmedNum = jerseyNumber.trim();
      const assignedJersey =
        trimmedNum.length > 0
          ? trimmedNum
          : String(Math.floor(Math.random() * 100));

      const initialStats = createInitialStats(primaryPos, heightCm);
      const initialOvr = calculateOvr(initialStats, primaryPos, heightCm);
      const { growthDna, playstyle } = rollPlayerDnaAndPlaystyle(
        initialStats,
        primaryPos
      );
      const innateTrait = rollInnateTrait(growthDna);
      const traitInfo = getTraitInfo(innateTrait);
      const dnaInfo = getGrowthDnaInfo(growthDna);
      const styleInfo = getPlaystyleInfo(playstyle, primaryPos);

      // 잠재력(Potential) 스펙트럼 전면 개방 (68 ~ 96 연속 분포)
      const rolledPotential = rollInitialPotential(
        initialOvr,
        growthDna,
        innateTrait
      );
      // 1.2.0: 미국 고교 출발은 잠재력을 높게 시작합니다.
      const potential =
        startingLeague === 'US_HIGH_SCHOOL'
          ? Math.min(
              US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.potentialMax,
              rolledPotential + US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.potentialBonus
            )
          : rolledPotential;

      const initialRatingsMap: Record<string, number> = {};
      for (const t of ALL_TEAMS) {
        initialRatingsMap[t.id] = t.rating;
      }

      const tempCareer = {
        ovr: initialOvr,
        team: hsTeam,
        coachTrust: 32,
        secondaryPos: null,
        contractType: 'AMATEUR' as const,
        league: startingLeague,
        stats: initialStats,
        primaryPos,
        growthDna,
        traits: [innateTrait],
      };
      const { role } = calculateRoleAndMpg(tempCareer);

      const newCareer: CareerState = {
        id: `PLAYER_${Date.now()}`,
        name: name.trim(),
        nationality,
        jerseyNumber: assignedJersey,
        heightCm,
        primaryPos,
        secondaryPos: null,
        growthDna,
        playstyle,
        traits: [innateTrait],
        age: startAge,
        seasonYear: 2026,
        seasonsPlayed: 0,
        ovr: initialOvr,
        peakOvr: initialOvr,
        ovrHistory: [initialOvr],
        potential,
        potentialBreakthroughCount: 0,
        stats: initialStats,
        lastSeasonDelta: { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 },
        league: startingLeague,
        team: hsTeam,
        contractType: 'AMATEUR',
        contractYearsLeft: schoolYears,
        annualSalary: 0,
        careerEarnings: 0, // 프로 통산 누적 연봉 (아마추어 장학금과 엄격히 분리)
        cashBalance: ECONOMY_CONFIG.amateurInitialScholarshipUsd, // 고교 유망주 훈련 장학금($20K) 가용 자산
        twoWaySeasonsUsed: 0,
        draftPedigreePick: null,
        draftPedigreeRound: null,
        draftPedigreeSeasonsLeft: 0,
        promisedRole: 'PROSPECT_DEVELOPMENT',
        brokenRolePromise: false,
        role,
        coachTrust: 32,
        draftStock: 20,
        trainingFocus: 'BALANCED',
        lastCampYear: 0,
        militaryExempt: !isKorean,
        militaryServiceSeasonsLeft: 0,
        previousTeamBeforeMilitary: null,
        isFarewellTour: false,
        farewellTourCompleted: false,
        nationalTeamRetired: false,
        nationalTeamRetiredYear: null,
        nationalTeamRetiredAge: null,
        nationalTeamRetirementNote: null,
        isOutOfLeagueWarning: false,
        agentAdviceShown: false,
        midSeasonEventTriggeredThisYear: false,
        lastTradeRumorYear: null,
        seasonsOnCurrentTeam: 0,
        tradeRequestedThisYear: false,
        pendingSeasonSettlement: null,
        seenEventIds: [],
        recentEventCategories: [],
        pendingChainEvent: null,
        seasonPhase: 'REGULAR_SEASON',
        currentStandings: [],
        playoffBracket: null,
        liveGame: null,
        rivals: [],
        teamRatingsMap: initialRatingsMap,
        relationships: createInitialRelationships(32, 15),
        storyArcs: createInitialStoryArcs(),
        badges: evaluatePlayerBadges(
          initialStats,
          null,
          growthDna,
          playstyle,
          [innateTrait],
          primaryPos
        ),
        seasonLogs: [],
        milestones: [
          {
            id: `MS_DEBUT_${Date.now()}`,
            year: 2026,
            age: startAge,
            title: `${hsTeam.name} 농구부 입부 (초기 OVR ${initialOvr} · ${dnaInfo.label})`,
            description: `등번호 #${assignedJersey} · ${dnaInfo.label} · ${styleInfo.label} · ${traitInfo.name}`,
            type: 'DEBUT',
            teamName: hsTeam.name,
          },
        ],
        careerHighs: {
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          pointsContext: '공식 경기 기록 없음',
        },
        totals: {
          gp: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          nbaGp: 0,
          nbaPoints: 0,
          championships: 0,
          nbaChampionships: 0,
          mvps: 0,
          nbaMvps: 0,
          finalsMvps: 0,
          dpoys: 0,
          sixthManAwards: 0,
          mips: 0,
          allLeagueSelections: 0,
          allStars: 0,
          nbaAllStars: 0,
        },
        offseasonLocked: false,
        offseasonOptions: [],
        pendingEvent: null,
        combineState: null,
        draftResult: null,
        retirementReason: null,
        legacyEvaluation: null,
      };

      set({
        career: newCareer,
        lastPersonalCareIds: [],
        lastEncounterOutcome: null,
        view: 'DASHBOARD',
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `${hsTeam.name} 입학 완료 · OVR ${initialOvr}`,
          description: `#${assignedJersey} · ${dnaInfo.label} · ${styleInfo.label} · ${traitInfo.name}`,
          tone: 'orange',
        },
      });
    },

    triggerRetirement: (reason) => {
      const { career } = get();
      if (!career) return;
      const legacyEval = evaluateCareerLegacy(career);
      set({
        career: {
          ...career,
          retirementReason: reason,
          legacyEvaluation: legacyEval,
        },
        view: 'RETIREMENT',
      });
    },

    completeRetirementAndReturnHome: () => {
      const { career, hofList, recordBook, recordBookManuallyReset } = get();
      if (!career) {
        set({ view: 'HOME' });
        return;
      }

      const reason = career.retirementReason || 'VOLUNTARY_HONOR';
      const evaluation =
        career.legacyEvaluation || evaluateCareerLegacy(career);
      const newEntry = buildHallOfFameEntry(
        career,
        reason,
        evaluation,
        recordBook
      );

      const updatedHof = [newEntry, ...hofList].sort(
        (a, b) => b.legacyScore - a.legacyScore
      );
      const syncedRecordBook = syncRecordBookWithHof(
        recordBook,
        recordBookManuallyReset ? [newEntry] : updatedHof,
        null
      );

      set({
        hofList: updatedHof,
        recordBook: syncedRecordBook,
        lastPersonalCareIds: [],
        career: null,
        hofRetrospectiveId: null,
        view: 'HOME',
        toast: {
          id: `TOAST_${Date.now()}`,
          title: `#${newEntry.jerseyNumber} ${newEntry.name} 명예의 전당 헌액`,
          description:
            '명예의 전당에서 언제든 커리어 회고 다큐멘터리를 다시 감상할 수 있습니다.',
          tone: 'amber',
        },
      });
    },

    resetActiveCareer: () => {
      set({
        career: null,
        lastPersonalCareIds: [],
        lastEncounterOutcome: null,
        view: 'CREATE',
      });
    },

    resetRecordBookOnly: () => {
      set({
        recordBook: createInitialRecordBook(),
        recordBookManuallyReset: true,
        toast: {
          id: `TOAST_${Date.now()}`,
          title: '역대 기록실 초기화 완료',
          description:
            '경신했던 모든 리그 역대 기록이 초기 기준 기록으로 복원되었습니다.',
          tone: 'emerald',
        },
      });
    },

    declareNationalTeamRetirement: () => {
      const career = get().career;
      if (!career || career.retirementReason || career.nationalTeamRetired) {
        return;
      }
      // 1.2.0: 국가대표는 대한민국 국적만 해당합니다.
      if (!isKoreanNational(career)) return;

      const evalRes = evaluateNationalTeamRetirement(career);
      const syncedRel = syncCareerRelationships(career, {
        mediaFan: evalRes.mediaFanDelta,
        lockerRoom: evalRes.lockerRoomDelta,
      });

      const currentArcs = getEffectiveStoryArcs(career);
      const natArc = currentArcs.NATIONAL_TORCH_ARC;
      const nextStoryArcs = natArc.completed
        ? currentArcs
        : {
            ...currentArcs,
            NATIONAL_TORCH_ARC: {
              ...natArc,
              summary: `국가대표 은퇴 선언(${career.seasonYear}년 · 만 ${career.age}세)으로 대표팀 세대교체 서사가 마무리되었습니다.`,
            },
          };

      const retirementMilestone: CareerMilestone = {
        id: `MS_NAT_RETIRE_${career.seasonYear}_${career.age}`,
        year: career.seasonYear,
        age: career.age,
        title: '대한민국 국가대표 은퇴 선언',
        description: evalRes.milestoneDescription,
        type: 'SPECIAL',
        teamName: '대한민국 국가대표팀',
      };

      const filteredQueue = (career.pendingEventQueue || []).filter(
        (evt) => !isNationalTeamEvent(evt)
      );
      const pendingWasNat = isNationalTeamEvent(career.pendingEvent);
      const filteredPendingChain = isNationalTeamEvent(career.pendingChainEvent)
        ? null
        : career.pendingChainEvent ?? null;

      let nextCareer: CareerState = {
        ...career,
        nationalTeamRetired: true,
        nationalTeamRetiredYear: career.seasonYear,
        nationalTeamRetiredAge: career.age,
        nationalTeamRetirementNote: evalRes.reactionSummary,
        relationships: syncedRel.relationships,
        coachTrust: syncedRel.coachTrust,
        storyArcs: nextStoryArcs,
        milestones: [...career.milestones, retirementMilestone],
        pendingEvent: pendingWasNat ? null : career.pendingEvent,
        pendingEventQueue: filteredQueue,
        pendingChainEvent: filteredPendingChain,
      };

      if (pendingWasNat) {
        nextCareer = dequeueNextPendingEvent(nextCareer);
      }

      const tone: ToastMessage['tone'] =
        evalRes.tier === 'HONORABLE'
          ? 'emerald'
          : evalRes.tier === 'RESPECTED'
          ? 'amber'
          : 'rose';

      const deltaParts: string[] = [];
      if (evalRes.mediaFanDelta !== 0) {
        deltaParts.push(
          `언론·팬 평판 ${
            evalRes.mediaFanDelta > 0
              ? `+${evalRes.mediaFanDelta}`
              : evalRes.mediaFanDelta
          }`
        );
      }
      if (evalRes.lockerRoomDelta !== 0) {
        deltaParts.push(
          `라커룸 ${
            evalRes.lockerRoomDelta > 0
              ? `+${evalRes.lockerRoomDelta}`
              : evalRes.lockerRoomDelta
          }`
        );
      }

      set({
        career: nextCareer,
        toast: {
          id: `TOAST_${Date.now()}`,
          title: evalRes.reactionTitle,
          description: `${evalRes.reactionSummary}${
            deltaParts.length > 0 ? ` (${deltaParts.join(' · ')})` : ''
          }`,
          tone,
        },
      });
    },

    resetHallOfFameOnly: () => {
      set({
        hofList: [],
        toast: {
          id: `TOAST_${Date.now()}`,
          title: '명예의 전당 초기화 완료',
          description:
            '헌액된 은퇴 선수와 올타임 베스트 5 목록을 모두 비웠습니다.',
          tone: 'emerald',
        },
      });
    },

    resetAllGameData: () => {
      set({
        career: null,
        hofList: [],
        recordBook: createInitialRecordBook(),
        recordBookManuallyReset: false,
        lastPersonalCareIds: [],
        lastEncounterOutcome: null,
        view: 'HOME',
        toast: {
          id: `TOAST_${Date.now()}`,
          title: '전체 기록 초기화 완료',
          description:
            '현재 커리어, 명예의 전당, 역대 기록실이 모두 초기 상태로 돌아갔습니다.',
          tone: 'emerald',
        },
      });
    },

    resetByScope: (scope) => {
      if (scope === 'RECORD_BOOK') {
        get().resetRecordBookOnly();
        return;
      }
      if (scope === 'HALL_OF_FAME') {
        get().resetHallOfFameOnly();
        return;
      }
      get().resetAllGameData();
    },
  };
}
