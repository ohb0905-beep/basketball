'use client';

import React from 'react';
import { ArrowLeft, CheckCircle2, MessageSquare, Sparkles, Target, Users, Zap } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { PlayerStats } from '../../types/game';

const COMBINE_DRILLS: {
  id: string;
  title: string;
  desc: string;
  statKey: keyof PlayerStats;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'DRILL_SHOOTING',
    title: '3점 & 무빙 슈팅 쇼케이스',
    desc: 'NBA 스카우트진 앞에서 무빙 3점슛과 클러치 슈팅 정확도를 증명해요 (OUT +1, 드래프트 보너스).',
    statKey: 'out',
    icon: Target,
  },
  {
    id: 'DRILL_ATHLETIC',
    title: '맥스 버티컬 & 레인 어질리티 측정',
    desc: '서전트 점프와 셔틀런에서 폭발적인 운동능력을 기록해요 (PHY +1, 드래프트 보너스).',
    statKey: 'phy',
    icon: Zap,
  },
  {
    id: 'DRILL_SCRIMMAGE',
    title: '5대5 실전 스크리미지 픽앤롤 리딩',
    desc: '실전 스크리미지에서 노련한 경기 운영과 패스 센스를 입증해요 (PLY +1, 드래프트 보너스).',
    statKey: 'ply',
    icon: Users,
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
  const projectedRound = cs.projectedPick <= 30 ? '1라운드' : cs.projectedPick <= 58 ? '2라운드' : '언드래프트 위험';

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 text-slate-900">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={withdrawFromDraft}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl transition shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          드래프트 참가 철회 및 에이전트 데스크로 복귀
        </button>
        <span className="text-xs font-black text-amber-600 uppercase tracking-wider">
          CHICAGO NBA DRAFT COMBINE
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {career.seasonYear} NBA 드래프트 공식 컴바인
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              드래프트 컴바인 쇼케이스 &amp; 구단 면접
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              {cs.scoutingReport}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-right">
            <div className="text-xs font-bold text-slate-500">현재 예상 지명 순위</div>
            <div className="text-2xl font-black text-orange-600 mt-0.5 tabular-nums">
              예상 #{cs.projectedPick}순위
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {projectedRound}
            </div>
          </div>
        </div>

        {/* 1. 쇼케이스 측정 종목 (최대 2개 수행 가능) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">
              1. 컴바인 피지컬·스킬 드릴 측정 ({cs.completedDrills.length} / 2 완료)
            </h2>
            <span className="text-xs text-slate-500">최대 2개 종목 선택 가능</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {COMBINE_DRILLS.map((drill) => {
              const Icon = drill.icon;
              const done = cs.completedDrills.includes(drill.id);
              const disabled = done || cs.completedDrills.length >= 2;
              return (
                <button
                  key={drill.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => runCombineDrill(drill.id, drill.title, drill.statKey)}
                  className={`p-4 rounded-2xl border text-left transition flex items-start gap-4 ${
                    done
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : disabled
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-slate-50 hover:border-orange-400 hover:bg-white cursor-pointer'
                  }`}
                >
                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-orange-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-slate-900">{drill.title}</span>
                      {done && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 측정 완료
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{drill.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 구단 단장단 심층 인터뷰 */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              2. NBA 구단 단장단 심층 인터뷰
            </h2>
            {cs.interviewCompleted && (
              <span className="text-xs font-bold text-emerald-600">인터뷰 완료</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'CONFIDENT' as const,
                label: '🔥 당당한 에이스 포부',
                desc: '“이번 드래프트 최고의 스틸 픽이 될 자신이 있어요!”',
              },
              {
                id: 'TEAM_FIRST' as const,
                label: '🤝 헌신적인 팀 퍼스트',
                desc: '“수비와 궂은일부터 팀 승리에 필요한 모든 역할을 해낼게요.”',
              },
              {
                id: 'ANALYTICAL' as const,
                label: '🧠 전술 이해도 어필',
                desc: '“현대 농구의 스페이싱과 스위치 수비 시스템을 완벽히 이해하고 있어요.”',
              },
            ].map((ans) => (
              <button
                key={ans.id}
                type="button"
                disabled={cs.interviewCompleted}
                onClick={() => completeCombineInterview(ans.id)}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-amber-400 hover:bg-white disabled:opacity-50 text-left transition cursor-pointer"
              >
                <div className="text-xs font-black text-slate-900">{ans.label}</div>
                <p className="text-[11px] text-slate-600 mt-1">{ans.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={withdrawFromDraft}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer"
          >
            드래프트 참가 철회 (복귀 오퍼 선택)
          </button>

          <button
            type="button"
            onClick={proceedToDraftLive}
            className="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-base transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            브루클린 바클레이스 센터 · NBA 드래프트 본무대 입장하기
          </button>
        </div>
      </div>
    </div>
  );
}
