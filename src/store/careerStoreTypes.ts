/**
 * 커리어 스토어 상태·액션 타입
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import type { StoreApi } from 'zustand';
import {
  CareerEventChoice,
  CareerState,
  ClutchChoiceId,
  EncounterResolutionResult,
  HallOfFameEntry,
  LiveTacticId,
  OffseasonOption,
  PersonalCareId,
  PlayerStats,
  Position,
  RecordBookState,
  ResetScope,
  RetirementReason,
  SpecialCampType,
  TrainingFocus,
  TrainingPresetId,
  ViewState,
} from '../types/game';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'orange' | 'emerald' | 'amber' | 'rose' | 'slate';
}

export interface CareerStoreState {
  view: ViewState;
  career: CareerState | null;
  hofList: HallOfFameEntry[];
  recordBook: RecordBookState;
  fastSimEnabled: boolean;
  lastPersonalCareIds: PersonalCareId[];
  espnLogos: Record<string, string>;
  espnApiConnected: boolean;
  toast: ToastMessage | null;
  lastEncounterOutcome: EncounterResolutionResult | null;
  hofRetrospectiveId: string | null;

  // Actions
  setView: (view: ViewState) => void;
  openHofRetrospective: (entryId: string) => void;
  closeHofRetrospective: () => void;
  showToast: (title: string, description?: string, tone?: ToastMessage['tone']) => void;
  clearToast: () => void;
  dismissEncounterOutcome: () => void;
  setEspnLogos: (logos: Record<string, string>) => void;
  toggleFastSim: () => void;
  exportSaveJson: () => string;
  importSaveJson: (raw: string) => { ok: boolean; message: string };

  startNewCareer: (params: {
    name: string;
    jerseyNumber: string;
    heightCm: number;
    primaryPos: Position;
    highSchoolTeamId: string;
  }) => void;

  setTrainingFocus: (focus: TrainingFocus) => void;
  applyTrainingPreset: (presetId: TrainingPresetId) => void;
  switchPrimaryPosition: (newPos: Position) => void;
  unlockSecondaryPosition: (secPos: Position) => void;
  runSpecialCamp: (campType: SpecialCampType) => void;
  purchasePersonalCare: (careId: PersonalCareId) => void;
  reapplyLastPersonalCare: () => void;
  requestTrade: () => void;
  declareNationalTeamRetirement: () => void;
  triggerMidSeasonCrossroads: () => void;

  playSeason: () => void;
  advancePlayoffBracketRound: () => void;
  batchAdvanceEarlyPlayoffs: () => void;
  skipPlayoffsToEnd: () => void;
  enterOffseasonFromPlayoffs: () => void;
  startFinalsLiveBroadcast: () => void;
  setLiveGameTactic: (tactic: LiveTacticId) => void;
  playNextLiveQuarter: () => void;
  resolveLiveClutchChoice: (choice: ClutchChoiceId) => void;
  skipLiveGame: () => void;
  closeLiveGameAndReturn: () => void;

  resolveEventChoice: (choice: CareerEventChoice) => void;
  selectOffseasonOption: (option: OffseasonOption) => void;

  // Draft Combine & Live Draft Actions
  runCombineDrill: (drillId: string, label: string, statKey: keyof PlayerStats) => void;
  completeCombineInterview: (answerType: 'CONFIDENT' | 'TEAM_FIRST' | 'ANALYTICAL') => void;
  withdrawFromDraft: () => void;
  proceedToDraftLive: () => void;
  finalizeDraftSigning: (choice: 'NBA_STANDARD' | 'TWO_WAY' | 'GLEAGUE' | 'KBL') => void;

  // Retirement & Reset Actions
  triggerRetirement: (reason: RetirementReason) => void;
  completeRetirementAndReturnHome: () => void;
  resetActiveCareer: () => void;
  recordBookManuallyReset: boolean;
  dismissInternationalSummary: () => void;
  resetRecordBookOnly: () => void;
  resetHallOfFameOnly: () => void;
  resetAllGameData: () => void;
  resetByScope: (scope: ResetScope) => void;
}

export type CareerStoreSet = StoreApi<CareerStoreState>['setState'];
export type CareerStoreGet = StoreApi<CareerStoreState>['getState'];
