'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rollSeasonEvent } from '../data/events';
import { LEAGUE_CONFIG } from '../data/leagues';
import { GLEAGUE_TEAMS, HIGH_SCHOOL_TEAMS, KBL_TEAMS } from '../data/teams';
import {
  calculateProjectedNbaPick,
  createInitialCombineState,
  executeDraftResolution,
  generateOffseasonOptions,
} from '../engine/draftEngine';
import {
  buildHallOfFameEntry,
  checkRetirementEligibility,
  evaluateCareerLegacy,
} from '../engine/retirementEngine';
import { calculateRoleAndMpg, simulateSeason } from '../engine/seasonSimulator';
import {
  calculateOvr,
  createInitialStats,
  evaluatePlayerBadges,
} from '../engine/statCalculator';
import {
  CareerEventChoice,
  CareerState,
  HallOfFameEntry,
  OffseasonOption,
  PlayerStats,
  Position,
  RetirementReason,
  TeamInfo,
  TrainingFocus,
  ViewState,
} from '../types/game';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'orange' | 'emerald' | 'amber' | 'slate';
}

interface CareerStoreState {
  view: ViewState;
  career: CareerState | null;
  hofList: HallOfFameEntry[];
  espnLogos: Record<string, string>;
  espnApiConnected: boolean;
  toast: ToastMessage | null;

  // Actions
  setView: (view: ViewState) => void;
  showToast: (title: string, description?: string, tone?: ToastMessage['tone']) => void;
  clearToast: () => void;
  setEspnLogos: (logos: Record<string, string>) => void;

  startNewCareer: (params: {
    name: string;
    jerseyNumber: string;
    heightCm: number;
    primaryPos: Position;
    highSchoolTeamId: string;
  }) => void;

  setTrainingFocus: (focus: TrainingFocus) => void;
  switchPrimaryPosition: (newPos: Position) => void;
  unlockSecondaryPosition: (secPos: Position) => void;

  playSeason: () => void;
  resolveEventChoice: (choice: CareerEventChoice) => void;
  selectOffseasonOption: (option: OffseasonOption) => void;

  // Draft Combine & Live Draft Actions
  runCombineDrill: (drillId: string, label: string, statKey: keyof PlayerStats) => void;
  completeCombineInterview: (answerType: 'CONFIDENT' | 'TEAM_FIRST' | 'ANALYTICAL') => void;
  withdrawFromDraft: () => void;
  proceedToDraftLive: () => void;
  finalizeDraftSigning: (choice: 'NBA_STANDARD' | 'TWO_WAY' | 'GLEAGUE' | 'KBL') => void;

  // Retirement Actions
  triggerRetirement: (reason: RetirementReason) => void;
  completeRetirementAndReturnHome: () => void;
  resetActiveCareer: () => void;
}

function clampStat(val: number): number {
  return Math.max(35, Math.min(99, Math.round(val)));
}

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => ({
      view: 'HOME',
      career: null,
      hofList: [], // 초기 100% 공석 (더미 데이터 절대 금지)
      espnLogos: {},
      espnApiConnected: false,
      toast: null,

      setView: (view) => set({ view }),

      showToast: (title, description, tone = 'orange') => {
        const id = `TOAST_${Date.now()}`;
        set({ toast: { id, title, description, tone } });
      },

      clearToast: () => set({ toast: null }),

      setEspnLogos: (logos) =>
        set((state) => ({
          espnLogos: { ...state.espnLogos, ...logos },
          espnApiConnected: Object.keys(logos).length > 0,
        })),

      startNewCareer: ({ name, jerseyNumber, heightCm, primaryPos, highSchoolTeamId }) => {
        const hsTeam: TeamInfo =
          HIGH_SCHOOL_TEAMS.find((t) => t.id === highSchoolTeamId) || HIGH_SCHOOL_TEAMS[0];
        const initialStats = createInitialStats(primaryPos, heightCm);
        const initialOvr = calculateOvr(initialStats, primaryPos);
        const potential = Math.min(97, Math.max(84, 86 + Math.floor(Math.random() * 10)));

        const tempCareer = {
          ovr: initialOvr,
          team: hsTeam,
          coachTrust: 25,
          secondaryPos: null,
          contractType: 'AMATEUR' as const,
          league: 'HIGH_SCHOOL' as const,
        };
        const { role } = calculateRoleAndMpg(tempCareer);

        const newCareer: CareerState = {
          id: `PLAYER_${Date.now()}`,
          name: name.trim(),
          jerseyNumber,
          heightCm,
          primaryPos,
          secondaryPos: null,
          age: 17,
          seasonYear: 2026,
          seasonsPlayed: 0,
          ovr: initialOvr,
          peakOvr: initialOvr,
          potential,
          stats: initialStats,
          lastSeasonDelta: { ins: 0, out: 0, ply: 0, def: 0, reb: 0, phy: 0 },
          league: 'HIGH_SCHOOL',
          team: hsTeam,
          contractType: 'AMATEUR',
          contractYearsLeft: 3,
          twoWaySeasonsUsed: 0,
          role,
          coachTrust: 25,
          draftStock: 20,
          trainingFocus: 'BALANCED',
          militaryExempt: false,
          isFarewellTour: false,
          farewellTourCompleted: false,
          isOutOfLeagueWarning: false,
          badges: evaluatePlayerBadges(initialStats, null),
          seasonLogs: [],
          milestones: [
            {
              id: `MS_DEBUT_${Date.now()}`,
              year: 2026,
              age: 17,
              title: `${hsTeam.name} 농구부 입부`,
              description: `등번호 #${jerseyNumber}번을 달고 벤치 끝자리에서 농구 인생의 첫발을 내디뎠어요.`,
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
            pointsContext: '아직 공식 경기 기록이 없어요',
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
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${hsTeam.name}에 입학했어요!`,
            description: '벤치 끝자리에서 시작해 최고의 MVP가 될 때까지 훈련과 시즌을 이어가 봐요.',
            tone: 'orange',
          },
        });
      },

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
            title: '시즌 중점 훈련 프로그램이 변경되었어요!',
            description: '다음 시즌 결산 시 선택한 훈련 비중이 능력치 성장에 반영돼요.',
            tone: 'emerald',
          },
        });
      },

      switchPrimaryPosition: (newPos) => {
        const { career } = get();
        if (!career || career.primaryPos === newPos) return;
        const newOvr = calculateOvr(career.stats, newPos);
        const newSecondary =
          career.secondaryPos === newPos ? career.primaryPos : career.secondaryPos;
        const { role } = calculateRoleAndMpg({
          ...career,
          ovr: newOvr,
          secondaryPos: newSecondary,
        });

        set({
          career: {
            ...career,
            primaryPos: newPos,
            secondaryPos: newSecondary,
            ovr: newOvr,
            peakOvr: Math.max(career.peakOvr, newOvr),
            role,
            milestones: [
              ...career.milestones,
              {
                id: `MS_POS_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `주포지션 ${newPos} 전향 완료`,
                description: `감독님과의 전술 면담을 통해 주포지션을 ${newPos}(으)로 변경했어요 (OVR ${newOvr}).`,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `주포지션을 ${newPos}(으)로 전향했어요!`,
            description: `새로운 포지션 가중치가 적용되어 종합 OVR이 ${newOvr}(으)로 조정되었어요.`,
            tone: 'orange',
          },
        });
      },

      unlockSecondaryPosition: (secPos) => {
        const { career } = get();
        if (!career || career.primaryPos === secPos) return;
        const badges = evaluatePlayerBadges(career.stats, secPos);
        const { role } = calculateRoleAndMpg({
          ...career,
          secondaryPos: secPos,
        });

        set({
          career: {
            ...career,
            secondaryPos: secPos,
            badges,
            role,
            coachTrust: Math.min(100, career.coachTrust + 5),
            milestones: [
              ...career.milestones,
              {
                id: `MS_DUAL_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: `듀얼 포지션 (${career.primaryPos}/${secPos}) 장착`,
                description: `멀티 포지션 소화 능력을 인정받아 팀 내 입지 보너스(+2.5)를 획득했어요!`,
                type: 'SPECIAL',
                teamName: career.team.name,
              },
            ],
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `부포지션 ${secPos} 해금 완료!`,
            description: '듀얼 포지션 보너스로 출전 시간 확보가 한결 유리해졌어요.',
            tone: 'emerald',
          },
        });
      },

      playSeason: () => {
        const { career } = get();
        if (!career || career.offseasonLocked) return;

        const sim = simulateSeason(career);
        const bs = sim.boxScore;

        const seasonPts = Math.round(bs.ppg * bs.gp);
        const seasonReb = Math.round(bs.rpg * bs.gp);
        const seasonAst = Math.round(bs.apg * bs.gp);
        const seasonStl = Math.round(bs.spg * bs.gp);
        const seasonBlk = Math.round(bs.bpg * bs.gp);

        const isNba = career.league === 'NBA';
        const nextTotals = {
          gp: career.totals.gp + bs.gp,
          points: career.totals.points + seasonPts,
          rebounds: career.totals.rebounds + seasonReb,
          assists: career.totals.assists + seasonAst,
          steals: career.totals.steals + seasonStl,
          blocks: career.totals.blocks + seasonBlk,
          nbaGp: career.totals.nbaGp + (isNba ? bs.gp : 0),
          nbaPoints: career.totals.nbaPoints + (isNba ? seasonPts : 0),
          championships: career.totals.championships + (bs.wonChampionship ? 1 : 0),
          nbaChampionships:
            career.totals.nbaChampionships + (isNba && bs.wonChampionship ? 1 : 0),
          mvps: career.totals.mvps + (bs.wonMvp ? 1 : 0),
          nbaMvps: career.totals.nbaMvps + (isNba && bs.wonMvp ? 1 : 0),
          allStars: career.totals.allStars + (bs.allStarSelected ? 1 : 0),
          nbaAllStars: career.totals.nbaAllStars + (isNba && bs.allStarSelected ? 1 : 0),
        };

        const nextHighs = { ...career.careerHighs };
        if (bs.singleGameHighPts > nextHighs.points) {
          nextHighs.points = bs.singleGameHighPts;
          nextHighs.pointsContext = `${bs.year}시즌 ${bs.teamShortName} (${bs.leagueName})`;
        }
        nextHighs.rebounds = Math.max(nextHighs.rebounds, Math.round(bs.rpg * 1.85 + 2));
        nextHighs.assists = Math.max(nextHighs.assists, Math.round(bs.apg * 1.9 + 2));
        nextHighs.steals = Math.max(nextHighs.steals, Math.min(10, Math.round(bs.spg * 2.8 + 1)));
        nextHighs.blocks = Math.max(nextHighs.blocks, Math.min(11, Math.round(bs.bpg * 2.9 + 1)));

        const newMilestones = [...career.milestones];
        if (bs.wonChampionship) {
          newMilestones.push({
            id: `MS_CHAMP_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `💍 ${bs.leagueName} 챔피언십 우승!`,
            description: `${bs.teamName} 소속으로 평균 ${bs.ppg}점을 기록하며 정상에 등극했어요!`,
            type: 'CHAMPIONSHIP',
            teamName: bs.teamName,
          });
        }
        if (bs.wonMvp) {
          newMilestones.push({
            id: `MS_MVP_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🏆 ${bs.leagueName} 정규시즌 MVP 수상!`,
            description: `평균 ${bs.ppg}점 · ${bs.rpg}리바운드 · ${bs.apg}도움으로 리그 최고의 별이 되었어요!`,
            type: 'AWARD',
            teamName: bs.teamName,
          });
        }
        if (bs.singleGameHighPts >= 40) {
          newMilestones.push({
            id: `MS_40PTS_${bs.year}`,
            year: bs.year,
            age: bs.age,
            title: `🔥 단일 경기 ${bs.singleGameHighPts}득점 폭발`,
            description: `${bs.leagueName} 코트에서 잊지 못할 득점 쇼를 펼쳤어요!`,
            type: 'RECORD',
            teamName: bs.teamName,
          });
        }

        const nextAge = career.age + 1;
        const nextSeasonYear = career.seasonYear + 1;
        const nextSeasonsPlayed = career.seasonsPlayed + 1;
        const nextContractYearsLeft = Math.max(0, career.contractYearsLeft - 1);
        const nextTwoWaySeasonsUsed =
          career.contractType === 'TWO_WAY'
            ? career.twoWaySeasonsUsed + 1
            : career.twoWaySeasonsUsed;

        const updatedCareerBase: CareerState = {
          ...career,
          age: nextAge,
          seasonYear: nextSeasonYear,
          seasonsPlayed: nextSeasonsPlayed,
          ovr: sim.nextOvr,
          peakOvr: Math.max(career.peakOvr, sim.nextOvr),
          stats: sim.nextStats,
          lastSeasonDelta: sim.statDelta,
          contractYearsLeft: nextContractYearsLeft,
          twoWaySeasonsUsed: nextTwoWaySeasonsUsed,
          role: bs.role,
          coachTrust: sim.nextCoachTrust,
          draftStock: sim.nextDraftStock,
          badges: sim.nextBadges,
          seasonLogs: [...career.seasonLogs, bs],
          milestones: newMilestones,
          careerHighs: nextHighs,
          totals: nextTotals,
          offseasonLocked: true,
          offseasonOptions: [],
          pendingEvent: null,
        };

        // 1) 만약 레전드 은퇴 투어 시즌이었다면 시즌 종료와 동시에 자동 은퇴식 진행 (시나리오 ②)
        if (career.isFarewellTour) {
          const legacyEval = evaluateCareerLegacy(updatedCareerBase);
          set({
            career: {
              ...updatedCareerBase,
              farewellTourCompleted: true,
              retirementReason: 'LEGEND_FAREWELL_TOUR',
              legacyEvaluation: legacyEval,
            },
            view: 'RETIREMENT',
          });
          return;
        }

        // 2) 만 40세 정년 은퇴 도달 시 의무 은퇴식 진행 (시나리오 ⑤)
        if (nextAge >= 40) {
          const legacyEval = evaluateCareerLegacy(updatedCareerBase);
          set({
            career: {
              ...updatedCareerBase,
              retirementReason: 'AGE_40_MANDATORY',
              legacyEvaluation: legacyEval,
            },
            view: 'RETIREMENT',
          });
          return;
        }

        // 3) 시즌 이벤트 롤링 (포지션 분기점 / 아시안게임 병역특례 / 노장 치명적 부상)
        const rolledEvent = rollSeasonEvent(updatedCareerBase);
        const offseasonOptions = generateOffseasonOptions(updatedCareerBase);
        const { isOutOfLeague } = checkRetirementEligibility(updatedCareerBase);

        set({
          career: {
            ...updatedCareerBase,
            isOutOfLeagueWarning: isOutOfLeague,
            offseasonOptions,
            pendingEvent: rolledEvent,
          },
        });
      },

      resolveEventChoice: (choice) => {
        const { career } = get();
        if (!career) return;

        // 노장 치명적 부상 등에서 현역 은퇴를 선택한 경우 (시나리오 ④)
        if (choice.triggerRetirement) {
          const legacyEval = evaluateCareerLegacy(career);
          set({
            career: {
              ...career,
              pendingEvent: null,
              retirementReason: choice.triggerRetirement,
              legacyEvaluation: legacyEval,
            },
            view: 'RETIREMENT',
          });
          return;
        }

        const nextStats: PlayerStats = { ...career.stats };
        if (choice.statChanges) {
          for (const k of Object.keys(choice.statChanges) as (keyof PlayerStats)[]) {
            const diff = choice.statChanges[k] || 0;
            nextStats[k] = clampStat(nextStats[k] + diff);
          }
        }

        const nextPrimary = choice.switchPrimaryPos || career.primaryPos;
        const nextSecondary = choice.unlockSecondaryPos || career.secondaryPos;
        const nextOvr = calculateOvr(nextStats, nextPrimary);
        const nextTrust = Math.max(
          10,
          Math.min(100, career.coachTrust + (choice.trustDelta || 0))
        );
        const nextStock = Math.max(
          10,
          Math.min(100, career.draftStock + (choice.draftStockDelta || 0))
        );
        const nextMilitaryExempt = career.militaryExempt || Boolean(choice.grantMilitaryExemption);
        const nextMilestones = [...career.milestones];

        if (choice.grantMilitaryExemption && !career.militaryExempt) {
          nextMilestones.push({
            id: `MS_MILITARY_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: '🇰🇷 아시안게임 금메달 & 병역특례 획득!',
            description:
              '결승전 클러치 활약으로 금메달을 목에 걸며 해외 진출 걸림돌이던 병역 문제를 완전히 해결했어요!',
            type: 'AWARD',
            teamName: '대한민국 국가대표팀',
          });
        }

        const updatedBase: CareerState = {
          ...career,
          primaryPos: nextPrimary,
          secondaryPos: nextSecondary,
          stats: nextStats,
          ovr: nextOvr,
          peakOvr: Math.max(career.peakOvr, nextOvr),
          coachTrust: nextTrust,
          draftStock: nextStock,
          militaryExempt: nextMilitaryExempt,
          badges: evaluatePlayerBadges(nextStats, nextSecondary),
          milestones: nextMilestones,
          pendingEvent: null,
        };

        // 능력치 변화에 맞춰 오프시즌 선택지 재갱신
        const refreshedOptions = generateOffseasonOptions(updatedBase);

        set({
          career: {
            ...updatedBase,
            offseasonOptions: refreshedOptions,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '선택 결과가 선수에게 반영되었어요!',
            description: choice.effectSummary,
            tone: 'emerald',
          },
        });
      },

      selectOffseasonOption: (option) => {
        const { career } = get();
        if (!career || option.locked) return;

        // 1) 자율 명예 은퇴 또는 방출 은퇴 선택 시
        if (option.actionType === 'RETIRE_VOLUNTARY') {
          get().triggerRetirement('VOLUNTARY_HONOR');
          return;
        }
        if (option.actionType === 'RETIRE_OUT_OF_LEAGUE') {
          get().triggerRetirement('OUT_OF_LEAGUE');
          return;
        }

        // 2) 레전드 은퇴 투어 선언 시
        if (option.actionType === 'START_FAREWELL_TOUR') {
          set({
            career: {
              ...career,
              isFarewellTour: true,
              contractYearsLeft: 1,
              offseasonLocked: false,
              offseasonOptions: [],
              milestones: [
                ...career.milestones,
                {
                  id: `MS_TOUR_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: '🌟 공식 레전드 은퇴 투어(Farewell Tour) 선언',
                  description: `${career.team.name}에서의 마지막 시즌을 앞두고 전 구단 고별 투어를 시작했어요!`,
                  type: 'TOUR',
                  teamName: career.team.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: '🌟 공식 은퇴 투어 시즌이 시작되었어요!',
              description: '이번 시즌을 마치면 성대한 은퇴식과 영구결번 심사가 열려요.',
              tone: 'amber',
            },
          });
          return;
        }

        // 3) 고국 KBL 복귀 후 국내 팬 앞 마지막 1년 은퇴 투어
        if (option.actionType === 'RETURN_KBL_FAREWELL' && option.targetTeam) {
          const { role } = calculateRoleAndMpg({
            ...career,
            league: 'KBL',
            team: option.targetTeam,
            contractType: 'KBL_VET',
          });
          set({
            career: {
              ...career,
              league: 'KBL',
              team: option.targetTeam,
              contractType: 'KBL_VET',
              contractYearsLeft: 1,
              role,
              isFarewellTour: true,
              isOutOfLeagueWarning: false,
              offseasonLocked: false,
              offseasonOptions: [],
              milestones: [
                ...career.milestones,
                {
                  id: `MS_KBL_RETURN_${Date.now()}`,
                  year: career.seasonYear,
                  age: career.age,
                  title: `🇰🇷 ${option.targetTeam.name} 복귀 & 고별 투어 선언`,
                  description: '국내 팬들 앞에서 현역 마지막 시즌을 불태우기로 결정했어요!',
                  type: 'TOUR',
                  teamName: option.targetTeam.name,
                },
              ],
            },
            toast: {
              id: `TOAST_${Date.now()}`,
              title: `${option.targetTeam.name}에 합류했어요!`,
              description: '고국 팬들의 뜨거운 박수 속에 마지막 시즌을 시작해요.',
              tone: 'amber',
            },
          });
          return;
        }

        // 4) NBA 드래프트 참가 신청 -> 시카고 컴바인 화면으로 이동
        if (option.actionType === 'ENTER_NBA_DRAFT') {
          const combineState = createInitialCombineState(career);
          set({
            career: {
              ...career,
              combineState,
              draftResult: null,
            },
            view: 'DRAFT_COMBINE',
          });
          return;
        }

        // 5) KBL 신인드래프트 참가 신청 -> 즉시 드래프트 지명 무대로 이동
        if (option.actionType === 'ENTER_KBL_DRAFT') {
          const draftResult = executeDraftResolution(career, 'KBL');
          set({
            career: {
              ...career,
              draftResult,
            },
            view: 'DRAFT_LIVE',
          });
          return;
        }

        // 6) 소속팀 잔류 또는 신규 구단 계약
        const nextTeam = option.targetTeam || career.team;
        const nextLeague = option.targetLeague;
        const isTeamChanged = nextTeam.id !== career.team.id;
        const nextTrust = isTeamChanged ? 50 : career.coachTrust;

        const { role } = calculateRoleAndMpg({
          ovr: career.ovr,
          team: nextTeam,
          coachTrust: nextTrust,
          secondaryPos: career.secondaryPos,
          contractType: option.contractType,
          league: nextLeague,
        });

        const nextMilestones = [...career.milestones];
        if (isTeamChanged) {
          nextMilestones.push({
            id: `MS_SIGN_${Date.now()}`,
            year: career.seasonYear,
            age: career.age,
            title: `${nextTeam.name} (${LEAGUE_CONFIG[nextLeague].shortName}) 입단`,
            description: `'${role}' 입지로 새로운 도전을 시작했어요.`,
            type: 'SPECIAL',
            teamName: nextTeam.name,
          });
        }

        set({
          career: {
            ...career,
            league: nextLeague,
            team: nextTeam,
            contractType: option.contractType,
            contractYearsLeft: option.contractYears,
            twoWaySeasonsUsed:
              option.contractType === 'TWO_WAY' && isTeamChanged
                ? 0
                : career.twoWaySeasonsUsed,
            coachTrust: nextTrust,
            role,
            isOutOfLeagueWarning: false,
            offseasonLocked: false,
            offseasonOptions: [],
            milestones: nextMilestones,
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: isTeamChanged
              ? `${nextTeam.name} 계약을 완료했어요!`
              : `${nextTeam.name}에서 새 시즌을 준비해요!`,
            description: `현재 팀 내 입지: ${role}`,
            tone: 'orange',
          },
        });
      },

      runCombineDrill: (drillId, label, statKey) => {
        const { career } = get();
        if (!career || !career.combineState) return;
        if (career.combineState.completedDrills.includes(drillId)) return;
        if (career.combineState.completedDrills.length >= 2) return;

        const statVal = career.stats[statKey];
        const gradeBonus = statVal >= 78 ? 6.5 : statVal >= 68 ? 4.0 : 2.0;
        const updatedStats: PlayerStats = {
          ...career.stats,
          [statKey]: clampStat(career.stats[statKey] + 1),
        };
        const updatedOvr = calculateOvr(updatedStats, career.primaryPos);
        const newBonus = career.combineState.combineBonusScore + gradeBonus;

        const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(
          { ...career, ovr: updatedOvr },
          newBonus
        );

        set({
          career: {
            ...career,
            stats: updatedStats,
            ovr: updatedOvr,
            peakOvr: Math.max(career.peakOvr, updatedOvr),
            combineState: {
              ...career.combineState,
              completedDrills: [...career.combineState.completedDrills, drillId],
              combineBonusScore: newBonus,
              projectedPick,
              undraftedRisk,
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `${label} 측정 완료!`,
            description: `능력치 +1 상승 & 예상 지명 순위가 ${projectedPick}순위로 업데이트되었어요!`,
            tone: 'emerald',
          },
        });
      },

      completeCombineInterview: (answerType) => {
        const { career } = get();
        if (!career || !career.combineState || career.combineState.interviewCompleted) return;

        const interviewBonus =
          answerType === 'CONFIDENT' ? 4.5 : answerType === 'TEAM_FIRST' ? 3.5 : 4.0;
        const newBonus = career.combineState.combineBonusScore + interviewBonus;
        const { projectedPick, undraftedRisk } = calculateProjectedNbaPick(career, newBonus);

        set({
          career: {
            ...career,
            coachTrust: Math.min(100, career.coachTrust + 4),
            combineState: {
              ...career.combineState,
              interviewCompleted: true,
              combineBonusScore: newBonus,
              projectedPick,
              undraftedRisk,
            },
          },
          toast: {
            id: `TOAST_${Date.now()}`,
            title: 'NBA 구단 단장단 심층 면접 완료!',
            description: `인상적인 답변으로 예상 순위가 ${projectedPick}순위로 상승했어요!`,
            tone: 'orange',
          },
        });
      },

      withdrawFromDraft: () => {
        const { career } = get();
        if (!career) return;

        // 드래프트 신청을 철회하고 직전 소속팀(대학/KBL/해외)에 1시즌 잔류
        const { role } = calculateRoleAndMpg(career);
        set({
          career: {
            ...career,
            combineState: null,
            draftResult: null,
            offseasonLocked: false,
            offseasonOptions: [],
            contractYearsLeft: Math.max(1, career.contractYearsLeft),
            role,
          },
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '↩️ NBA 드래프트 참가를 철회하고 소속팀으로 복귀했어요.',
            description: '한 시즌 더 주전으로 활약하며 OVR과 스카우트 주가를 끌어올려 봐요!',
            tone: 'amber',
          },
        });
      },

      proceedToDraftLive: () => {
        const { career } = get();
        if (!career) return;
        const draftResult = executeDraftResolution(career, 'NBA');
        set({
          career: {
            ...career,
            draftResult,
          },
          view: 'DRAFT_LIVE',
        });
      },

      finalizeDraftSigning: (choice) => {
        const { career } = get();
        if (!career || !career.draftResult) return;

        const dr = career.draftResult;
        let nextLeague = career.league;
        let nextTeam = career.team;
        let nextContractType = career.contractType;
        let nextYears = 2;
        let milestoneTitle = '';
        let milestoneDesc = '';

        if (dr.draftType === 'KBL' && dr.draftedTeam) {
          nextLeague = 'KBL';
          nextTeam = dr.draftedTeam;
          nextContractType = 'KBL_ROOKIE';
          nextYears = 3;
          milestoneTitle = `🇰🇷 KBL 드래프트 전체 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `${nextTeam.name}의 부름을 받아 프로 무대에 공식 데뷔했어요!`;
        } else if (choice === 'NBA_STANDARD' && dr.draftedTeam) {
          nextLeague = 'NBA';
          nextTeam = dr.draftedTeam;
          nextContractType = 'NBA_STANDARD';
          nextYears = 4;
          milestoneTitle = `🏀 NBA 드래프트 1라운드 ${dr.pickNumber}순위 지명 (${nextTeam.shortName})`;
          milestoneDesc = `브루클린 바클레이스 센터에서 ${nextTeam.name} 모자를 쓰고 꿈의 NBA 정식 루키 계약을 체결했어요!`;
        } else if (choice === 'TWO_WAY') {
          const targetNbaTeam = dr.draftedTeam || dr.twoWayOfferTeam || career.team;
          nextLeague = 'NBA';
          nextTeam = targetNbaTeam;
          nextContractType = 'TWO_WAY';
          nextYears = 1;
          milestoneTitle = dr.pickNumber
            ? `🏀 NBA 드래프트 2라운드 ${dr.pickNumber}순위 지명 (${targetNbaTeam.shortName})`
            : `🔥 언드래프티 신화 도전! ${targetNbaTeam.shortName} 투웨이 계약 체결`;
          milestoneDesc = `${targetNbaTeam.name} 투웨이 로스터에 합류해 정식 계약 승격 경쟁을 시작해요!`;
        } else if (choice === 'GLEAGUE') {
          nextLeague = 'GLEAGUE';
          nextTeam = GLEAGUE_TEAMS[0];
          nextContractType = 'GLEAGUE_EXHIBIT';
          nextYears = 1;
          milestoneTitle = `🇺🇸 ${nextTeam.name} 입단`;
          milestoneDesc = '드래프트 아쉬움을 삼키고 G리그 쇼케이스에서 실력으로 증명하기로 했어요.';
        } else {
          // KBL 복귀
          nextLeague = 'KBL';
          nextTeam = KBL_TEAMS[0];
          nextContractType = 'KBL_ROOKIE';
          nextYears = 2;
          milestoneTitle = `🇰🇷 ${nextTeam.name} 입단`;
          milestoneDesc = 'KBL 무대에서 먼저 최고가 된 뒤 다시 미국 무대를 노크하기로 했어요.';
        }

        const { role } = calculateRoleAndMpg({
          ovr: career.ovr,
          team: nextTeam,
          coachTrust: 50,
          secondaryPos: career.secondaryPos,
          contractType: nextContractType,
          league: nextLeague,
        });

        set({
          career: {
            ...career,
            league: nextLeague,
            team: nextTeam,
            contractType: nextContractType,
            contractYearsLeft: nextYears,
            twoWaySeasonsUsed: nextContractType === 'TWO_WAY' ? 0 : career.twoWaySeasonsUsed,
            coachTrust: 50,
            role,
            combineState: null,
            draftResult: null,
            offseasonLocked: false,
            offseasonOptions: [],
            milestones: [
              ...career.milestones,
              {
                id: `MS_DRAFT_${Date.now()}`,
                year: career.seasonYear,
                age: career.age,
                title: milestoneTitle,
                description: milestoneDesc,
                type: 'DRAFT',
                teamName: nextTeam.name,
              },
            ],
          },
          view: 'DASHBOARD',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: milestoneTitle,
            description: `소속 구단: ${nextTeam.name} · 역할: ${role}`,
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
        const { career, hofList } = get();
        if (!career) {
          set({ view: 'HOME' });
          return;
        }

        const reason = career.retirementReason || 'VOLUNTARY_HONOR';
        const evaluation = career.legacyEvaluation || evaluateCareerLegacy(career);
        const newEntry = buildHallOfFameEntry(career, reason, evaluation);

        const updatedHof = [newEntry, ...hofList].sort(
          (a, b) => b.legacyScore - a.legacyScore
        );

        set({
          hofList: updatedHof,
          career: null,
          view: 'HOME',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: `🏛️ #${newEntry.jerseyNumber} ${newEntry.name} 선수가 명예의 전당에 헌액되었어요!`,
            description: '메인 화면의 올타임 베스트 5 하프코트와 명예의 전당 보드를 확인해 보세요.',
            tone: 'amber',
          },
        });
      },

      resetActiveCareer: () => {
        set({
          career: null,
          view: 'CREATE',
        });
      },
    }),
    {
      name: 'bench-to-mvp-career-storage-v1',
      partialize: (state) => ({
        career: state.career,
        hofList: state.hofList,
      }),
    }
  )
);
