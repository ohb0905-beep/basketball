'use client';

import React from 'react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { CareerState, ContractType } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const CONTRACT_LABELS: Record<ContractType, string> = {
  AMATEUR: '학생 아마추어',
  KBL_ROOKIE: 'KBL 신인 계약',
  KBL_MAX: 'KBL 프랜차이즈 맥스',
  KBL_VET: 'KBL 베테랑 계약',
  OVERSEAS_CONTRACT: '해외 프로 정식 계약',
  GLEAGUE_EXHIBIT: 'G리그 쇼케이스 계약',
  TWO_WAY: 'NBA 투웨이(Two-Way) 계약',
  NBA_STANDARD: 'NBA 정식 보장 계약',
  NBA_MAX: 'NBA 슈퍼맥스 계약',
  NBA_VET_MIN: 'NBA 베테랑 미니멈',
  FREE_AGENT: '자유계약 (FA)',
};

export function PlayerHeader({ career }: { career: CareerState }) {
  const leagueInfo = LEAGUE_CONFIG[career.league];
  const isAtGrowthCap = career.ovr >= leagueInfo.growthCap && career.age <= 28;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* 좌측: 소속 구단 엠블럼 & 선수 기본 정보 */}
        <div className="flex items-center gap-4 min-w-0">
          <TeamEmblem team={career.team} size="xl" />

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{leagueInfo.name}</span>
              <span aria-hidden="true">·</span>
              <span>{career.team.name}</span>
              <span aria-hidden="true">·</span>
              <span>
                {CONTRACT_LABELS[career.contractType]} ({career.contractYearsLeft}년 남음)
              </span>
              {career.militaryExempt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-semibold">🎖️ 병역특례</span>
                </>
              )}
              {career.isFarewellTour && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 font-bold">🌟 공식 은퇴 투어 시즌</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                #{career.jerseyNumber} {career.name}
              </h1>
              <span className="text-sm font-bold text-orange-600">
                {career.primaryPos}
                {career.secondaryPos ? ` / ${career.secondaryPos}` : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
              <span>{career.heightCm}cm</span>
              <span aria-hidden="true">·</span>
              <span>만 {career.age}세 ({career.seasonYear}시즌)</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-800">역할: {career.role}</span>
            </div>
          </div>
        </div>

        {/* 우측: 종합 OVR, 리그 수비저항치(LDR), 감독 신뢰도 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="block text-[11px] font-semibold text-slate-500">종합 능력치</span>
            <span className="text-2xl sm:text-3xl font-black text-orange-600 tabular-nums">
              {career.ovr}
            </span>
            <span className="block text-[10px] text-slate-400 tabular-nums">
              최고 {career.peakOvr}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="block text-[11px] font-semibold text-slate-500">리그 수비저항</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              LDR {leagueInfo.ldr}
            </span>
            <span
              className={`block text-[10px] tabular-nums ${
                isAtGrowthCap ? 'text-amber-600 font-bold' : 'text-slate-400'
              }`}
            >
              성장캡 {leagueInfo.growthCap}
              {isAtGrowthCap ? ' (도달)' : ''}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="block text-[11px] font-semibold text-slate-500">감독 신뢰도</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              {career.coachTrust}%
            </span>
            <span className="block text-[10px] text-slate-400 tabular-nums">
              구단전력 {career.team.rating}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
