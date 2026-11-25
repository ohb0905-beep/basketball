/**
 * 화면 전환 · 토스트 · 표시 설정 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  CareerState,
} from '../../types/game';
import {
  dequeueNextPendingEvent,
} from '../careerStoreHelpers';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
} from '../careerStoreTypes';

export type UiActions = Pick<CareerStoreState, 'setView' | 'openHofRetrospective' | 'closeHofRetrospective' | 'showToast' | 'clearToast' | 'dismissEncounterOutcome' | 'dismissInternationalSummary' | 'toggleFastSim' | 'setEspnLogos'>;

export function createUiActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): UiActions {
  return {
    setView: (view) => set({ view, hofRetrospectiveId: null }),
    openHofRetrospective: (entryId) => set({ hofRetrospectiveId: entryId }),
    closeHofRetrospective: () => set({ hofRetrospectiveId: null }),

    showToast: (title, description, tone = 'orange') => {
      const id = `TOAST_${Date.now()}`;
      set({ toast: { id, title, description, tone } });
    },

    clearToast: () => set({ toast: null }),

    dismissEncounterOutcome: () =>
      set((state) => ({
        lastEncounterOutcome: null,
        career:
          state.career &&
          !state.career.pendingEvent &&
          !state.career.liveGame &&
          !state.career.lastInternationalSummary
            ? dequeueNextPendingEvent(state.career)
            : state.career,
      })),

    dismissInternationalSummary: () =>
      set((state) => {
        if (!state.career) return { career: null };
        const cleared: CareerState = {
          ...state.career,
          lastInternationalSummary: null,
        };
        return {
          career:
            !cleared.pendingEvent && !cleared.liveGame
              ? dequeueNextPendingEvent(cleared)
              : cleared,
        };
      }),

    toggleFastSim: () =>
      set((state) => ({
        fastSimEnabled: !state.fastSimEnabled,
      })),

    setEspnLogos: (logos) =>
      set((state) => ({
        espnLogos: { ...state.espnLogos, ...logos },
        espnApiConnected: Object.keys(logos).length > 0,
      })),
  };
}
