'use client';

import React from 'react';
import { ArrowRight, Play, ShieldAlert, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { useCareerStore } from '../../store/useCareerStore';
import { BestFiveCourt } from './BestFiveCourt';

export function HeroSection() {
  const career = useCareerStore((s) => s.career);
  const setView = useCareerStore((s) => s.setView);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* 코트 라인 배경 그래픽 (밝은 화이트/오렌지 코트 라인) */}
      <div className="absolute inset-0 pointer-events-none opacity-45">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full border-[3px] border-orange-200/70" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full border-[2px] border-amber-200/60" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 pt-10 pb-16 w-full space-y-10">
        <section className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-xs">
          {/* 상단 메타 텍스트 */}
          <div className="flex items-center gap-2 text-orange-600 text-xs font-extrabold tracking-wider uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Basketball Career Simulation · 고교 농구부에서 NBA 영구결번까지</span>
          </div>

          {/* 메인 헤드라인 */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.08] mb-5">
            벤치 끝자락에서 시작해
            <br />
            <span className="text-orange-600">
              전설의 MVP가 되다
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mb-8">
            만 17세 고교 신입생으로 입학해 한국 대학 U-리그, KBL, 해외 리그, 미국 NCAA D1, G리그를 거쳐
            세계 최고 무대인 NBA 파이널 MVP와 명예의 전당에 도전하세요. 양방향 생체역학 물리 엔진과
            전 리그 실제 구단·학교 공식 앰블럼이 살아 숨 쉬는 농구 커리어 시뮬레이션입니다.
          </p>

          {/* CTA 버튼 그룹 */}
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                if (career) {
                  resetActiveCareer();
                } else {
                  setView('CREATE');
                }
              }}
              className="inline-flex items-center gap-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black px-7 py-4 rounded-2xl text-base shadow-sm transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              새 선수 생성하기
            </button>

            {career && (
              <button
                type="button"
                onClick={() => setView(career.retirementReason ? 'RETIREMENT' : 'DASHBOARD')}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold px-6 py-4 rounded-2xl text-base border border-slate-200 transition cursor-pointer"
              >
                진행 중인 커리어 이어하기 ({career.name} · {LEAGUE_CONFIG[career.league].shortName} · 만 {career.age}세 · OVR {career.ovr})
                <ArrowRight className="w-4 h-4 text-orange-600" />
              </button>
            )}
          </div>
        </section>

        {/* 올타임 베스트 5 하프코트 & 명예의 전당 보드 */}
        <BestFiveCourt />

        {/* 핵심 시스템 3대 특징 카드 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">
              7대 리그 &amp; 동·서부 컨퍼런스
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              한국 고교 24개교 → U리그 12개교 → KBL 10구단 / 해외리그 / NCAA D1 24개교 / G리그 20구단 →
              NBA 동·서부 30구단으로 이어지는 리얼한 리그 생태계를 구현했습니다.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">
              양방향 생체역학 &amp; 포지션 밸런스
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              타점·림 장악력 지수(Reach)와 무게중심·볼 키핑 민첩성 지수(CoG)가 경기 야투율, 턴오버,
              리바운드, 블록, 성장 탄력성에 연속 함수로 반영됩니다.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">
              4년 주기 아시안게임 &amp; 영구결번
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              4년마다 열리는 아시안게임 본선 토너먼트(조별리그·8강·4강·결승) 제패를 통한 병역특례와
              프로 구단 영구결번 및 명예의 전당 헌액까지 경험할 수 있습니다.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500">
        From Bench to MVP · Basketball Career Simulator Engine
      </footer>
    </div>
  );
}
