'use client';

import React from 'react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import { ROLE_PROMISE_LABELS } from '../../engine/draftEngine';
import {
  getGrowthDnaInfo,
  getPlaystyleInfo,
  getTraitInfo,
} from '../../engine/statCalculator';
import { CareerState, ContractType, LeagueId } from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

const CONTRACT_LABELS: Record<ContractType, string> = {
  AMATEUR: '학생 아마추어',
  MILITARY_SERVICE: '국군체육부대(상무) 복무',
  KBL_ROOKIE: 'KBL 신인 계약',
  KBL_MAX: 'KBL 프랜차이즈 맥스',
  KBL_VET: 'KBL 베테랑 계약',
  OVERSEAS_CONTRACT: '해외 프로 정식 계약',
  GLEAGUE_EXHIBIT: 'G리그 쇼케이스 계약',
  SUMMER_LEAGUE_INVITE: 'NBA 서머리그 초청 쇼케이스',
  TWO_WAY: 'NBA 투웨이(Two-Way) 계약',
  NBA_STANDARD: 'NBA 정식 보장 계약',
  NBA_MAX: 'NBA 슈퍼맥스 계약',
  NBA_VET_MIN: 'NBA 베테랑 미니멈',
  FREE_AGENT: '자유계약 (FA)',
};

function getLeagueLevelBadge(league: LeagueId): string {
  switch (league) {
    case 'NBA':
      return '🔥 세계 최고 무대';
    case 'GLEAGUE':
    case 'OVERSEAS':
      return '🛡️ 글로벌 프로 무대';
    case 'KBL':
      return '🏀 국내 프로 1군';
    case 'NCAA':
      return '🦅 미국 대학 1부';
    case 'U_LEAGUE':
      return '🎓 대학 엘리트 무대';
    case 'HIGH_SCHOOL':
    default:
      return '🌱 고교 유망주 무대';
  }
}

function formatCurrencyK(amountUsd: number): string {
  if (!amountUsd || amountUsd <= 0) return '$0';
  if (amountUsd >= 1000000) {
    return `$${(amountUsd / 1000000).toFixed(2)}M`;
  }
  if (amountUsd >= 1000) {
    return `$${Math.round(amountUsd / 1000).toLocaleString()}K`;
  }
  return `$${amountUsd.toLocaleString()}`;
}

export function PlayerHeader({ career }: { career: CareerState }) {
  const leagueInfo = LEAGUE_CONFIG[career.league];
  const isAtGrowthCap = career.ovr >= leagueInfo.growthCap && career.age <= 28;
  const dnaInfo = getGrowthDnaInfo(career.growthDna || 'STANDARD');
  const playstyleInfo = getPlaystyleInfo(career.playstyle || 'ALL_ROUNDER');
  const traits = career.traits || [];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <TeamEmblem team={career.team} size="lg" />

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-extrabold text-orange-600">{leagueInfo.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-slate-800">{career.team.name}</span>
              <span aria-hidden="true">·</span>
              <span>
                {CONTRACT_LABELS[career.contractType]} ({career.contractYearsLeft}년)
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                #{career.jerseyNumber} {career.name}
              </h1>
              <span className="text-xs sm:text-sm font-extrabold text-orange-600">
                {career.primaryPos}
                {career.secondaryPos ? `/${career.secondaryPos}` : ''} · {career.heightCm}cm · 만 {career.age}세
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                {dnaInfo.badge}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                {playstyleInfo.badge}
              </span>
              {traits.map((tId) => {
                const tInfo = getTraitInfo(tId);
                return (
                  <span
                    key={tId}
                    title={tInfo.description}
                    className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 font-bold text-orange-700"
                  >
                    {tInfo.badge}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측 OVR 배지 */}
        <div className="px-3.5 py-2 rounded-2xl bg-orange-50 border border-orange-200 text-center shrink-0">
          <span className="block text-[10px] font-extrabold text-orange-700">OVR</span>
          <span className="text-2xl sm:text-3xl font-black text-orange-600 tabular-nums leading-none">
            {career.ovr}
          </span>
        </div>
      </div>

      {/* 하단 핵심 상태 요약 바 */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="block text-[10px] font-semibold text-slate-500">팀 내 입지</span>
          <span className="font-extrabold text-slate-900 truncate block mt-0.5">
            {career.role}
          </span>
          {career.promisedRole && (
            <span className="block text-[10px] text-indigo-600 font-bold mt-0.5">
              보장: {ROLE_PROMISE_LABELS[career.promisedRole]}
            </span>
          )}
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="block text-[10px] font-semibold text-slate-500">무대 수준</span>
          <span className="font-extrabold text-slate-900 block mt-0.5">
            {getLeagueLevelBadge(career.league)}
          </span>
          <span
            className={`block text-[10px] mt-0.5 ${
              isAtGrowthCap ? 'text-amber-600 font-bold' : 'text-slate-400'
            }`}
          >
            {isAtGrowthCap ? '⚠️ 무대 성장 한계 도달' : '✅ 기량 성장 가능'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="block text-[10px] font-semibold text-slate-500">신뢰도 · 연봉</span>
          <span className="font-extrabold text-slate-900 tabular-nums block mt-0.5">
            신뢰 {career.coachTrust}%
          </span>
          <span className="block text-[10px] text-emerald-700 font-bold tabular-nums mt-0.5">
            {formatCurrencyK(career.annualSalary)}
          </span>
        </div>
      </div>
    </div>
  );
}
