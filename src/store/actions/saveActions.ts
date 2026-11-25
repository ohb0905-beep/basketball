/**
 * 세이브 내보내기/가져오기 액션
 * (useCareerStore.ts에서 동작 변경 없이 그대로 옮긴 코드입니다.)
 */
import {
  migratePersistedPayload,
} from '../saveMigration';
import type {
  CareerStoreGet,
  CareerStoreSet,
  CareerStoreState,
} from '../careerStoreTypes';

export type SaveActions = Pick<CareerStoreState, 'exportSaveJson' | 'importSaveJson'>;

export function createSaveActions(
  set: CareerStoreSet,
  get: CareerStoreGet
): SaveActions {
  return {
    exportSaveJson: () => {
      const { career, hofList, recordBook, fastSimEnabled, lastPersonalCareIds } =
        get();
      return JSON.stringify(
        {
          app: 'road-to-mvp',
          version: 2,
          exportedAt: new Date().toISOString(),
          career,
          hofList,
          recordBook,
          fastSimEnabled,
          lastPersonalCareIds,
        },
        null,
        2
      );
    },

    importSaveJson: (raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          return {
            ok: false,
            message: '올바른 JSON 백업 파일 형식이 아닙니다.',
          };
        }
        const importedCareer = parsed.career ?? null;
        const importedHof = Array.isArray(parsed.hofList)
          ? parsed.hofList
          : get().hofList;

        if (importedCareer !== null) {
          const validCareer =
            typeof importedCareer === 'object' &&
            typeof importedCareer.id === 'string' &&
            typeof importedCareer.name === 'string' &&
            typeof importedCareer.age === 'number' &&
            typeof importedCareer.seasonYear === 'number' &&
            importedCareer.stats &&
            typeof importedCareer.stats.ins === 'number' &&
            importedCareer.team &&
            typeof importedCareer.team.id === 'string' &&
            importedCareer.totals &&
            typeof importedCareer.totals.gp === 'number';

          if (!validCareer) {
            return {
              ok: false,
              message: '커리어 데이터가 손상되었거나 필수 항목이 누락되었습니다.',
            };
          }
        } else if (!Array.isArray(parsed.hofList)) {
          return {
            ok: false,
            message: '복원할 커리어 또는 명예의 전당 기록이 없습니다.',
          };
        }

        const migrated = migratePersistedPayload({
          career: importedCareer,
          hofList: importedHof,
          recordBook: parsed.recordBook ?? get().recordBook,
        });

        set({
          career: migrated.career,
          hofList: migrated.hofList,
          recordBook: migrated.recordBook,
          recordBookManuallyReset: false,
          fastSimEnabled:
            typeof parsed.fastSimEnabled === 'boolean'
              ? parsed.fastSimEnabled
              : get().fastSimEnabled,
          lastPersonalCareIds: Array.isArray(parsed.lastPersonalCareIds)
            ? parsed.lastPersonalCareIds
            : get().lastPersonalCareIds,
          lastEncounterOutcome: null,
          view: migrated.career
            ? migrated.career.retirementReason
              ? 'RETIREMENT'
              : 'DASHBOARD'
            : 'HOME',
          toast: {
            id: `TOAST_${Date.now()}`,
            title: '세이브 데이터 복원 완료',
            description: migrated.career
              ? `${migrated.career.name} (${migrated.career.seasonYear}시즌) 커리어를 불러왔습니다.`
              : `명예의 전당 기록 ${migrated.hofList.length}건을 복원했습니다.`,
            tone: 'emerald',
          },
        });

        return {
          ok: true,
          message: '백업 데이터를 복원했습니다.',
        };
      } catch {
        return {
          ok: false,
          message: 'JSON 파싱에 실패했습니다. 백업 파일 내용을 확인해 주세요.',
        };
      }
    },
  };
}
