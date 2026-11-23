'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { useCareerStore } from '../../store/useCareerStore';
import { BestFiveCourt } from './BestFiveCourt';

interface HeroSectionProps {
  onRequestResetModal?: () => void;
}

export function HeroSection({ onRequestResetModal }: HeroSectionProps = {}) {
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);

  return (
    <div className="max-w-[560px] mx-auto px-4 pt-2 pb-12 space-y-3">
      {/* 메인 히어로 카드 */}
      <section className="t-card space-y-6">
        <div className="space-y-2">
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-[1.24] text-balance">
            로드 투 <span className="text-[var(--t-accent)]">MVP</span>
          </h1>
          <p className="text-[14px] text-[var(--t-g600)] leading-relaxed">
            고교 신입생으로 시작해 드래프트와 파이널 우승, 영구결번에 도전하는 농구 커리어 시뮬레이션
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              if (career) {
                if (onRequestResetModal) {
                  onRequestResetModal();
                } else {
                  resetActiveCareer();
                }
              } else {
                setView('CREATE');
              }
            }}
            className="t-cta"
          >
            새 선수 만들기
          </button>

          {career && (
            <button
              type="button"
              onClick={() =>
                setView(career.retirementReason ? 'RETIREMENT' : 'DASHBOARD')
              }
              className="w-full min-h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] hover:bg-[var(--t-g200)] flex items-center justify-between gap-2 text-left cursor-pointer t-tap"
            >
              <div className="min-w-0">
                <span className="block text-[14px] font-bold text-[var(--t-g900)] truncate">
                  {career.name} 이어하기
                </span>
                <span className="block text-[12px] text-[var(--t-g600)] tabular-nums truncate">
                  {LEAGUE_CONFIG[career.league].shortName} · {career.team.shortName} · OVR {career.ovr}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--t-g400)] shrink-0" />
            </button>
          )}
        </div>
      </section>

      {/* 올타임 베스트 5 하프코트 & 명예의 전당 */}
      <BestFiveCourt />
    </div>
  );
}
