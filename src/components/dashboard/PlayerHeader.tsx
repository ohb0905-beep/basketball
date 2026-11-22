'use client';

import React from 'react';
import { LEAGUE_CONFIG } from '../../data/leagues';
import {
  getPlaystyleInfo,
  getTraitInfo,
} from '../../engine/statCalculator';
import { getEffectiveCashBalance } from '../../store/useCareerStore';
import { CareerState } from '../../types/game';
import {
  formatCurrencyCompact,
  formatHeaderContractSummary,
  getMilitaryStatusDisplay,
} from '../../utils/formatters';
import { TeamEmblem } from '../common/TeamEmblem';

export function PlayerHeader({ career }: { career: CareerState }) {
  const leagueInfo = LEAGUE_CONFIG[career.league];
  const isAtGrowthCap = career.ovr >= leagueInfo.growthCap && career.age <= 28;
  const playstyleLabel = getPlaystyleInfo(
    career.playstyle || 'ALL_ROUNDER',
    career.primaryPos
  ).label;
  const traitLabels = (career.traits || []).map((tId) => getTraitInfo(tId).name);
  const cash = getEffectiveCashBalance(career);
  const militaryStatus = getMilitaryStatusDisplay(career);
  const militaryToneClass =
    militaryStatus.tone === 'ok'
      ? 'text-[var(--t-ok)]'
      : militaryStatus.tone === 'accent'
      ? 'text-[var(--t-accent-ink)]'
      : militaryStatus.tone === 'gold'
      ? 'text-[var(--t-gold)]'
      : 'text-[var(--t-g500)]';

  return (
    <section className="t-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TeamEmblem team={career.team} size="md" />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--t-g500)] truncate">
              <span className="font-bold text-[var(--t-accent-ink)] shrink-0">
                {leagueInfo.shortName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[var(--t-g700)] truncate">
                {career.team.name}
              </span>
              {isAtGrowthCap && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[var(--t-gold)] shrink-0">
                    성장 한계
                  </span>
                </>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
              <h1 className="text-[20px] font-bold tracking-[-0.03em] text-[var(--t-g900)] truncate">
                #{career.jerseyNumber} {career.name}
              </h1>
              <span className="text-[12px] font-semibold text-[var(--t-g500)] shrink-0 tabular-nums">
                {career.primaryPos}
                {career.secondaryPos ? `/${career.secondaryPos}` : ''} · {career.heightCm}cm · {career.age}세
              </span>
            </div>

            <p className="text-[12px] text-[var(--t-g500)] truncate mt-0.5">
              {playstyleLabel}
              {traitLabels.length > 0 ? ` · ${traitLabels.join(' · ')}` : ''}
              {' · '}
              <span
                data-testid="header-military-status"
                className={`font-semibold ${militaryToneClass}`}
              >
                {militaryStatus.label}
              </span>
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 pl-2">
          <span className="block text-[10px] font-bold text-[var(--t-g400)] tracking-wider">
            OVR
          </span>
          <span className="text-[30px] font-bold text-[var(--t-accent)] tabular-nums leading-none">
            {career.ovr}
          </span>
        </div>
      </div>

      {/* 오픈 4열 핵심 지표 스트립 (무테두리 + 상단 헤어라인) */}
      <div className="grid grid-cols-4 pt-3.5 border-t border-[var(--t-g100)] text-center gap-1">
        <div className="min-w-0">
          <span className="block text-[11px] text-[var(--t-g500)]">입지</span>
          <span className="block text-[13px] font-bold text-[var(--t-g900)] truncate mt-0.5">
            {career.role}
          </span>
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] text-[var(--t-g500)]">신뢰도</span>
          <span className="block text-[13px] font-bold text-[var(--t-g900)] tabular-nums mt-0.5">
            {career.coachTrust}%
          </span>
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] text-[var(--t-g500)]">계약</span>
          <span
            data-testid="header-contract-summary"
            className="block text-[13px] font-bold text-[var(--t-g900)] tabular-nums truncate mt-0.5"
          >
            {formatHeaderContractSummary(career)}
          </span>
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] text-[var(--t-g500)]">자산</span>
          <span className="block text-[13px] font-bold text-[var(--t-ok)] tabular-nums mt-0.5">
            {formatCurrencyCompact(cash)}
          </span>
        </div>
      </div>
    </section>
  );
}
