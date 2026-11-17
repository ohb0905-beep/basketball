'use client';

import React from 'react';
import { Award, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { evaluateCareerLegacy } from '../../engine/retirementEngine';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

export function RetirementCeremony() {
  const career = useCareerStore((s) => s.career);
  const completeRetirementAndReturnHome = useCareerStore(
    (s) => s.completeRetirementAndReturnHome
  );
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);
  const setView = useCareerStore((s) => s.setView);

  if (!career) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-900 space-y-4">
        <h2 className="text-2xl font-black">은퇴 리포트를 불러올 수 없어요.</h2>
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="px-6 py-3 rounded-xl bg-orange-600 text-white font-black text-sm cursor-pointer"
        >
          메인 화면으로 이동
        </button>
      </div>
    );
  }

  const evaluation = career.legacyEvaluation || evaluateCareerLegacy(career);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8 text-slate-900">
      {/* 메인 헌액 배너 */}
      <div className="bg-white border-2 border-amber-300 rounded-3xl p-8 text-center shadow-sm space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black tracking-widest uppercase">
          <Sparkles className="w-4 h-4" />
          OFFICIAL RETIREMENT &amp; LEGACY REPORT · 명예의 전당 심사 결과
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          #{career.jerseyNumber} {career.name} ({career.primaryPos})
        </h1>
        <p className="text-base sm:text-lg font-bold text-orange-600">
          {evaluation.tierTitle}
        </p>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {evaluation.summaryComment}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 max-w-3xl mx-auto">
          {[
            { label: '통산 시즌', val: `${career.seasonsPlayed}시즌 (최고 OVR ${career.peakOvr})` },
            { label: '통산 득점', val: `${career.totals.points.toLocaleString()}점` },
            {
              label: '우승 / MVP',
              val: `우승 ${career.totals.championships}회 · MVP ${career.totals.mvps}회`,
            },
            {
              label: '레거시 총점',
              val: `${evaluation.legacyScore.toLocaleString()}점`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4"
            >
              <div className="text-xs font-bold text-slate-500">{item.label}</div>
              <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 구단 영구결번 헌액식 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-black text-slate-900">
            대표 구단 헌액 &amp; 프랜차이즈 영구결번 심사
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200">
          <TeamEmblem team={evaluation.honoredTeam} size="xl" />
          <div className="flex-1 space-y-1.5 text-center sm:text-left">
            <span className="text-xs font-bold text-amber-700">
              커리어 대표 소속 구단
            </span>
            <h3 className="text-2xl font-black text-slate-900">
              {evaluation.honoredTeam.name}
            </h3>
            <p className="text-xs text-slate-600">
              해당 구단 소속 {evaluation.honoredTeamSeasons}시즌 활약 · 통산{' '}
              {evaluation.honoredTeamPoints.toLocaleString()}득점 · 우승{' '}
              {evaluation.honoredTeamChamps}회 · MVP {evaluation.honoredTeamMvps}회 · 올스타{' '}
              {evaluation.honoredTeamAllStars}회
            </p>
            <p className="text-xs font-bold text-orange-600 pt-1">
              {evaluation.jerseyRetired
                ? `🎽 ${evaluation.honoredTeam.name} 구단 영구결번 (#${career.jerseyNumber}) 헌액 확정!`
                : '아쉽게도 단일 프로 구단 영구결번 기준(7시즌+ & 압도적 구단 업적)에는 도달하지 못했어요.'}
            </p>
          </div>
          {evaluation.jerseyRetired && (
            <div
              className="w-20 h-24 rounded-2xl flex flex-col items-center justify-center text-3xl font-black border-2 shadow-md shrink-0"
              style={{
                backgroundColor: evaluation.honoredTeam.primaryColor,
                borderColor: evaluation.honoredTeam.secondaryColor,
                color: '#FFFFFF',
              }}
            >
              <span className="text-[10px] font-bold opacity-80">RETIRED</span>
              <span>#{career.jerseyNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={completeRetirementAndReturnHome}
          className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-sm transition shadow-sm cursor-pointer"
        >
          <Award className="w-4 h-4" />
          명예의 전당 헌액 완료 및 메인 화면으로 이동
        </button>
        <button
          type="button"
          onClick={() => {
            completeRetirementAndReturnHome();
            resetActiveCareer();
          }}
          className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-sm transition shadow-2xs cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          명예의 전당 등록 후 새 유망주 키우기
        </button>
      </div>
    </div>
  );
}
