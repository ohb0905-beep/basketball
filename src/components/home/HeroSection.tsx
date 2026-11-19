'use client';

import React from 'react';
import { ArrowRight, ChevronRight, Play, Sparkles } from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { useCareerStore } from '../../store/useCareerStore';
import { BestFiveCourt } from './BestFiveCourt';

const CAREER_FLOW_STEPS = [
  { badge: '🌱 고교 벤치', sub: '만 17세 입부' },
  { badge: '🔥 첫 위닝샷', sub: '주전 도약' },
  { badge: '🎙️ NBA 드래프트', sub: '운명의 지명' },
  { badge: '💍 파이널 우승', sub: '챔피언 등극' },
  { badge: '👑 만장일치 MVP', sub: '영구결번 헌액' },
];

export function HeroSection() {
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-14 w-full space-y-6">
        {/* 상단 히어로 카드 */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>고교 벤치 끝자락에서 NBA 명예의 전당까지</span>
          </div>

          <div className="space-y-2.5">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-[1.15]">
              벤치 끝자락에서 시작해
              <br />
              <span className="text-orange-600">전설의 MVP가 돼 보세요</span>
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              만 17세 고교 농구부 신입생으로 출발해 대학·KBL·해외·G리그를 거쳐 꿈의 무대인 NBA 파이널 우승과 영구결번에 도전해 보세요!
            </p>
          </div>

          {/* 커리어 여정 플로우 바 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 mb-2">
              농구 인생 커리어 여정
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {CAREER_FLOW_STEPS.map((step, idx) => (
                <React.Fragment key={step.badge}>
                  {idx > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 font-extrabold text-slate-800 shadow-2xs">
                    {step.badge}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                if (career) {
                  resetActiveCareer();
                } else {
                  setView('CREATE');
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-black px-6 py-4 rounded-2xl text-sm sm:text-base shadow-xs transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              새 선수 생성하기
            </button>

            {career && (
              <button
                type="button"
                onClick={() => setView(career.retirementReason ? 'RETIREMENT' : 'DASHBOARD')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold px-5 py-4 rounded-2xl text-xs sm:text-sm border border-slate-200 transition cursor-pointer"
              >
                <span>
                  이어하기 ({career.name} · {LEAGUE_CONFIG[career.league].shortName} · OVR {career.ovr})
                </span>
                <ArrowRight className="w-4 h-4 text-orange-600 shrink-0" />
              </button>
            )}
          </div>
        </section>

        {/* 올타임 베스트 5 하프코트 & 명예의 전당 */}
        <BestFiveCourt />
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        벤치에서 MVP까지 · 리얼 농구 커리어 시뮬레이션
      </footer>
    </div>
  );
}
