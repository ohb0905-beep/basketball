'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  MessageSquare,
  RotateCcw,
  Target,
} from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { PlayerStats } from '../../types/game';

const COMBINE_DRILLS: {
  id: string;
  title: string;
  desc: string;
  statKey: keyof PlayerStats;
}[] = [
  {
    id: 'DRILL_SHOOTING',
    title: '3점 무빙 & 스팟업 슈팅 드릴',
    desc: 'NBA 3점 라인(7.24m) 거리에서 25개 연속 슈팅 테스트를 진행해요.',
    statKey: 'out',
  },
  {
    id: 'DRILL_AGILITY',
    title: '레인 어질리티 & 맥스 버티컬 점프',
    desc: '폭발적인 서전트 점프와 코트 왕복 스프린트 기록을 측정해요.',
    statKey: 'phy',
  },
  {
    id: 'DRILL_SCRIMMAGE',
    title: '5대5 풀코트 쇼케이스 스크리미지',
    desc: '스카우트들 앞에서 픽앤롤 전개와 수비 로테이션 이해도를 증명해요.',
    statKey: 'ply',
  },
];

export function DraftCombine() {
  const career = useCareerStore((s) => s.career);
  const runCombineDrill = useCareerStore((s) => s.runCombineDrill);
  const completeCombineInterview = useCareerStore((s) => s.completeCombineInterview);
  const withdrawFromDraft = useCareerStore((s) => s.withdrawFromDraft);
  const proceedToDraftLive = useCareerStore((s) => s.proceedToDraftLive);

  if (!career || !career.combineState) return null;

  const cs = career.combineState;
  const drillsLeft = Math.max(0, 2 - cs.completedDrills.length);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 상단 시카고 컴바인 헤더 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-extrabold text-orange-600">
              미국 일리노이주 시카고 · 윈트러스트 아레나
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              🏀 NBA 드래프트 시카고 컴바인 (Draft Combine)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              #{career.jerseyNumber} {career.name} ({career.primaryPos} · {career.heightCm}cm · OVR{' '}
              {career.ovr})
            </p>
          </div>

          <div className="px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center shrink-0">
            <span className="block text-xs font-bold text-slate-500">
              현재 예상 지명 순위
            </span>
            <span
              className={`block text-3xl font-black mt-0.5 tabular-nums ${
                cs.projectedPick <= 30
                  ? 'text-emerald-600'
                  : cs.projectedPick <= 58
                  ? 'text-orange-600'
                  : 'text-rose-600'
              }`}
            >
              {cs.projectedPick > 60 ? '60순위 밖 (Undrafted 권역)' : `전체 ${cs.projectedPick}순위`}
            </span>
            <span className="block text-[11px] text-slate-400">
              {cs.projectedPick <= 14
                ? '로터리 픽 유력'
                : cs.projectedPick <= 30
                ? '1라운드 보장 계약 권역'
                : cs.projectedPick <= 58
                ? '2라운드 지명 권역'
                : '언드래프티 위험 구간'}
            </span>
          </div>
        </div>

        {/* 스카우트 총평 & 언드래프티 경고 배너 */}
        <p className="text-sm text-slate-700 leading-relaxed">{cs.scoutingReport}</p>

        {cs.undraftedRisk && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-extrabold text-amber-900">
                  ⚠️ 언드래프티 위험 경고 (예상 순위 {cs.projectedPick}순위 &gt; 58순위)
                </p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  현재 예상 순위가 58순위 밖이어서 지명되지 못할 위험이 높아요! 컴바인 측정 후에도
                  순위가 낮다면 드래프트 신청을 철회하고 소속팀/대학으로 복귀해 기량을 더 쌓을 수 있어요.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={withdrawFromDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ↩️ 드래프트 신청 철회하고 소속팀/대학 복귀
            </button>
          </div>
        )}
      </section>

      {/* 중반: 컴바인 측정 드릴 (2종 선택) & 구단 단장 면접 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-orange-600" />
              1. 컴바인 코트 워크아웃 드릴 (남은 횟수: {drillsLeft}회)
            </h2>
            <span className="text-xs text-slate-500">최대 2개 종목 참가 가능</span>
          </div>

          <div className="space-y-3">
            {COMBINE_DRILLS.map((drill) => {
              const done = cs.completedDrills.includes(drill.id);
              const disabled = done || drillsLeft === 0;
              return (
                <button
                  key={drill.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => runCombineDrill(drill.id, drill.title, drill.statKey)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-4 ${
                    done
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : disabled
                      ? 'border-slate-200 bg-slate-50 opacity-55 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-orange-500 cursor-pointer'
                  }`}
                >
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {drill.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{drill.desc}</p>
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      측정 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 shrink-0">
                      <Target className="w-4 h-4" />
                      참가하기
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 우측: NBA 구단 단장 면접 */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-600" />
              2. NBA 프런트 & 단장 심층 면접
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              “NBA 무대는 이전까지 경험한 리그보다 수비 저항(LDR 84)이 훨씬 높습니다. 루키 시즌
              벤치에서 시작하더라도 팀에 어떻게 기여하겠습니까?”
            </p>

            {cs.interviewCompleted ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                단장단 면접을 성공적으로 마쳐 드래프트 주가가 상승했어요!
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => completeCombineInterview('CONFIDENT')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-500 text-left transition-colors cursor-pointer"
                >
                  <span className="block text-xs font-extrabold text-slate-900">
                    🔥 “어떤 수비 앞에서도 제 득점력과 승부욕을 증명해 보이겠어요!”
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    스타성 어필 · 예상 순위 큰 폭 상승
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => completeCombineInterview('TEAM_FIRST')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-500 text-left transition-colors cursor-pointer"
                >
                  <span className="block text-xs font-extrabold text-slate-900">
                    🛡️ “수비와 리바운드, 궂은일부터 완벽히 해내는 팀 퍼스트 선수가 될게요!”
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    감독 신뢰도 및 워크에씩 호평
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => completeCombineInterview('ANALYTICAL')}
                  className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-500 text-left transition-colors cursor-pointer"
                >
                  <span className="block text-xs font-extrabold text-slate-900">
                    🧠 “스페이싱과 전술 이해도로 코트 위 마진(+-)을 끌어올리겠어요!”
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    현대 농구 BQ 어필
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 하단 액션 버튼 (드래프트 철회 vs 바클레이스 센터 입장) */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={withdrawFromDraft}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              ↩️ 드래프트 철회 후 소속팀 복귀
            </button>
            <button
              type="button"
              onClick={proceedToDraftLive}
              className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              브루클린 지명식장 입장하기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
