'use client';

import React from 'react';
import { Award, Crown, Home, Sparkles } from 'lucide-react';
import { evaluateCareerLegacy } from '../../engine/retirementEngine';
import { useCareerStore } from '../../store/useCareerStore';
import { RetirementReason } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const REASON_LABELS: Record<RetirementReason, string> = {
  VOLUNTARY_HONOR: '① 박수칠 때 떠나기 (자율 명예 은퇴)',
  LEGEND_FAREWELL_TOUR: '② 전 구단 기립박수 속 공식 레전드 은퇴 투어 완주',
  OUT_OF_LEAGUE: '③ 소속팀 부재(구단 오퍼 0건)로 인한 현역 은퇴',
  CRITICAL_INJURY: '④ 부상 투혼 끝에 내려놓은 정든 유니폼',
  AGE_40_MANDATORY: '⑤ 만 40세 불혹의 나이까지 코트를 지킨 철인의 정년 은퇴',
};

export function RetirementCeremony() {
  const career = useCareerStore((s) => s.career);
  const completeRetirementAndReturnHome = useCareerStore(
    (s) => s.completeRetirementAndReturnHome
  );

  if (!career) return null;

  const reason = career.retirementReason || 'VOLUNTARY_HONOR';
  const evaluation = career.legacyEvaluation || evaluateCareerLegacy(career);
  const gp = Math.max(1, career.totals.gp);
  const avgPpg = (career.totals.points / gp).toFixed(1);
  const avgRpg = (career.totals.rebounds / gp).toFixed(1);
  const avgApg = (career.totals.assists / gp).toFixed(1);
  const earningsM = ((career.careerEarnings || 0) / 1000).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
        {/* 상단 은퇴식 헤더 */}
        <div className="text-center space-y-2 border-b border-slate-100 pb-6">
          <span className="text-xs font-extrabold text-orange-600">
            {REASON_LABELS[reason]}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            #{career.jerseyNumber} {career.name} 공식 은퇴식 & 레거시 헌액
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {evaluation.summaryComment}
          </p>
        </div>

        {/* 6단계 레거시 등급 & 구단 영구결번 배너 연출 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* 좌측: 6단계 레거시 등급 카드 */}
          <div className="md:col-span-7 rounded-2xl bg-slate-50 border border-slate-200 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                최종 커리어 레거시 등급
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                {evaluation.tierTitle}
              </h2>
              <p className="text-xs font-bold text-orange-600 tabular-nums">
                레거시 총점: {evaluation.legacyScore.toLocaleString()}점 · 전성기 OVR{' '}
                {career.peakOvr} · 통산 수입 ${earningsM}M
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-center">
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="block text-[11px] text-slate-500">통산 시즌</span>
                <span className="text-base font-black text-slate-900 tabular-nums">
                  {career.seasonsPlayed}시즌
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="block text-[11px] text-slate-500">통산 득점</span>
                <span className="text-base font-black text-orange-600 tabular-nums">
                  {career.totals.points.toLocaleString()}점
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="block text-[11px] text-slate-500">통산 평균</span>
                <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                  {avgPpg} / {avgRpg} / {avgApg}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <span className="block text-[11px] text-slate-500">우승 / MVP</span>
                <span className="text-base font-black text-amber-600 tabular-nums">
                  {career.totals.championships}회 / {career.totals.mvps}회
                </span>
              </div>
            </div>
          </div>

          {/* 우측: 구단 영구결번(Jersey Retirement) 배너 게양 연출 */}
          <div className="md:col-span-5 rounded-2xl bg-slate-50 border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
            {evaluation.jerseyRetired ? (
              <div className="space-y-3">
                <div
                  style={{
                    backgroundColor: evaluation.honoredTeam.primaryColor,
                    borderColor: evaluation.honoredTeam.secondaryColor,
                  }}
                  className="w-40 mx-auto rounded-t-lg rounded-b-3xl border-4 px-5 py-6 text-white shadow-md transition-transform"
                >
                  <p className="text-[10px] font-bold tracking-widest uppercase opacity-90 truncate">
                    {evaluation.honoredTeam.shortName} RETIRED
                  </p>
                  <p className="text-4xl font-black tracking-tight my-1 tabular-nums">
                    #{career.jerseyNumber}
                  </p>
                  <p className="text-xs font-extrabold truncate">{career.name}</p>
                </div>

                <div>
                  <span className="text-xs font-extrabold text-amber-600 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    🎽 프랜차이즈 구단 영구결번 배너 게양 완료!
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    {evaluation.honoredTeam.name} 소속 {evaluation.honoredTeamSeasons}시즌 ·{' '}
                    {evaluation.honoredTeamPoints.toLocaleString()}득점 (우승{' '}
                    {evaluation.honoredTeamChamps}회 · MVP {evaluation.honoredTeamMvps}회 · 올스타{' '}
                    {evaluation.honoredTeamAllStars}회)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <TeamEmblem team={evaluation.honoredTeam} size="xl" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    대표 소속팀: {evaluation.honoredTeam.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    프로 구단 영구결번 기준(단일 프로 구단 7시즌+ &amp; 10,000점+ 및 구단 MVP 2회+ 또는
                    우승 2회+올스타 5회+)에는 미치지 못했지만(구단 기록: {evaluation.honoredTeamSeasons}
                    시즌 · {evaluation.honoredTeamPoints.toLocaleString()}점), 팬들의 박수 속에 명예롭게
                    은퇴했어요.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 명예의 전당 및 올타임 베스트 5 하프코트 등록 버튼 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={completeRetirementAndReturnHome}
            className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Award className="w-5 h-5" />
            명예의 전당 & 올타임 베스트 5 하프코트에 헌액하고 메인으로 이동
            <Home className="w-4 h-4 ml-1" />
          </button>
        </div>
      </section>
    </div>
  );
}
