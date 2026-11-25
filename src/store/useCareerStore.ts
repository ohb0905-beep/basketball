'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUiActions } from './actions/uiActions';
import { createSaveActions } from './actions/saveActions';
import { createCareerLifecycleActions } from './actions/careerLifecycleActions';
import { createGrowthActions } from './actions/growthActions';
import { createSeasonActions } from './actions/seasonActions';
import { createEventActions } from './actions/eventActions';
import { createOffseasonActions } from './actions/offseasonActions';
import { createInitialRecordBook } from '../engine/recordBookEngine';
import { migratePersistedPayload } from './saveMigration';
import type { CareerStoreState } from './careerStoreTypes';

export type { ToastMessage } from './careerStoreTypes';
export { getEffectiveCashBalance, getPersonalCarePackageCost } from './careerStoreHelpers';

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => ({
      view: 'HOME',
      career: null,
      hofList: [], // 초기 100% 공석 (더미 데이터 절대 금지)
      recordBook: createInitialRecordBook(),
      recordBookManuallyReset: false,
      fastSimEnabled: false,
      lastPersonalCareIds: [],
      espnLogos: {},
      espnApiConnected: false,
      toast: null,
      lastEncounterOutcome: null,
      hofRetrospectiveId: null,

      ...createUiActions(set, get),
      ...createSaveActions(set, get),
      ...createCareerLifecycleActions(set, get),
      ...createGrowthActions(set, get),
      ...createSeasonActions(set, get),
      ...createEventActions(set, get),
      ...createOffseasonActions(set, get),
    }),
    {
      name: 'bench-to-mvp-career-storage-v1',
      partialize: (state) => ({
        career: state.career,
        hofList: state.hofList,
        recordBook: state.recordBook,
        recordBookManuallyReset: state.recordBookManuallyReset,
        fastSimEnabled: state.fastSimEnabled,
        lastPersonalCareIds: state.lastPersonalCareIds,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CareerStoreState>) || {};
        const migrated = migratePersistedPayload({
          career: persisted.career ?? currentState.career,
          hofList: persisted.hofList ?? currentState.hofList,
          recordBook: persisted.recordBook ?? currentState.recordBook,
          skipRecordSync: Boolean(persisted.recordBookManuallyReset),
        });
        return {
          ...currentState,
          ...persisted,
          career: migrated.career,
          hofList: migrated.hofList,
          recordBook: migrated.recordBook,
        };
      },
    }
  )
);
