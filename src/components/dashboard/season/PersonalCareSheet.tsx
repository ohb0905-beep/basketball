'use client';

import React from 'react';
import {
  isPersonalCareAllowedInLeague,
} from '../../../config/balanceConfig';
import {
  getEffectiveCashBalance,
  getPersonalCarePackageCost,
  useCareerStore,
} from '../../../store/useCareerStore';
import {
  PersonalCareId,
  CareerState,
} from '../../../types/game';
import {
  formatCurrencyDetailed,
} from '../../../utils/formatters';
import { Modal } from '../../common/Modal';

const PERSONAL_CARE_ITEMS: {
  id: PersonalCareId;
  effect: string;
  title: string;
}[] = [
  {
    id: 'BIOMECH_SKILL_LAB',
    effect: '성장 +15% · 노쇠화 -15% 완화',
    title: '바이오메카닉스 스킬 랩',
  },
  {
    id: 'REHAB_LOAD_MGMT',
    effect: '부상률 -48% · 결장 기간 단축',
    title: '전담 재활 · 로드 매니지먼트',
  },
  {
    id: 'SIGNATURE_SNEAKER_MARKETING',
    effect: '스카우트 주가 +7 · 레거시 보너스',
    title: '시그니처 스니커즈 런칭',
  },
];

export function PersonalCareSheet({
  career,
  showPersonalCareSheet,
  setShowPersonalCareSheet,
}: {
  career: CareerState;
  showPersonalCareSheet: boolean;
  setShowPersonalCareSheet: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const purchasePersonalCare = useCareerStore((s) => s.purchasePersonalCare);
  const effectiveCash = getEffectiveCashBalance(career);

  return (
    <>
      <Modal
        open={showPersonalCareSheet}
        title="퍼스널 케어 · 에이전시"
        subtitle={`보유 자산 ${formatCurrencyDetailed(effectiveCash)}`}
        onClose={() => setShowPersonalCareSheet(false)}
        testId="personal-care-desk"
      >
        <div className="divide-y divide-[var(--t-g100)]">
          {PERSONAL_CARE_ITEMS.map((item) => {
            const isPurchased = (career.activePersonalCare || []).includes(
              item.id
            );
            const allowedInLeague = isPersonalCareAllowedInLeague(
              item.id,
              career.league
            );
            const cost = getPersonalCarePackageCost(item.id, career.league);
            const canAfford = effectiveCash >= cost;

            return (
              <div
                key={item.id}
                className="py-3.5 first:pt-1 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[15px] font-bold text-[var(--t-g900)]">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-[var(--t-g500)]">
                    {allowedInLeague ? item.effect : '프로 리그 진출 시 해금'}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`care-btn-${item.id}`}
                  disabled={isPurchased || !allowedInLeague || !canAfford}
                  onClick={() => purchasePersonalCare(item.id)}
                  className={`min-h-[44px] px-4 rounded-xl text-[13px] font-bold whitespace-nowrap shrink-0 cursor-pointer t-tap tabular-nums ${
                    isPurchased
                      ? 'bg-[var(--t-ok-soft)] text-[var(--t-ok)] cursor-default'
                      : !allowedInLeague || !canAfford
                      ? 'bg-[var(--t-g100)] text-[var(--t-g400)] cursor-not-allowed'
                      : 'bg-[var(--t-accent)] text-white'
                  }`}
                >
                  {isPurchased
                    ? '적용됨'
                    : !allowedInLeague
                    ? '잠김'
                    : formatCurrencyDetailed(cost)}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
