'use client';

import React, { useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  Flame,
  Medal,
  Shield,
  Star,
  Trophy,
} from 'lucide-react';
import {
  ChampionshipRecord,
  TrophyCabinetItem,
} from '../../types/game';
import { TeamEmblem } from '../common/TeamEmblem';

interface TrophyCabinetSectionProps {
  championships: ChampionshipRecord[];
  bestPlayoffNote: string | null;
  trophies: TrophyCabinetItem[];
}

function getTrophyIcon(id: string) {
  switch (id) {
    case 'CHAMPIONSHIP':
      return Trophy;
    case 'FINALS_MVP':
    case 'MVP':
      return Crown;
    case 'ALL_STAR':
    case 'ALL_LEAGUE':
      return Star;
    case 'DPOY':
      return Shield;
    case 'INTL_MEDAL':
      return Medal;
    case 'LEAGUE_RECORD':
      return Flame;
    default:
      return Award;
  }
}

function getAccentTextClass(accent: TrophyCabinetItem['accent']): string {
  switch (accent) {
    case 'gold':
      return 'text-[var(--t-gold)]';
    case 'accent':
      return 'text-[var(--t-accent)]';
    case 'ok':
      return 'text-[var(--t-ok)]';
    default:
      return 'text-[var(--t-g800)]';
  }
}

export function TrophyCabinetSection({
  championships,
  bestPlayoffNote,
  trophies,
}: TrophyCabinetSectionProps) {
  const [expandedTrophyId, setExpandedTrophyId] = useState<string | null>(
    trophies.length > 0 ? trophies[0].id : null
  );

  const selectedTrophy =
    trophies.find((item) => item.id === expandedTrophyId) || null;

  return (
    <div className="space-y-6">
      {/* 1. 우승 연대기 */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold text-[var(--t-g900)]">
            우승 연대기
          </h3>
          <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
            총 {championships.length}회
          </span>
        </div>

        {championships.length === 0 ? (
          <div className="py-5 px-4 rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] space-y-1">
            <p className="text-[14px] font-semibold text-[var(--t-g700)]">
              우승 트로피와는 인연이 닿지 않았습니다
            </p>
            <p className="text-[12px] text-[var(--t-g500)] leading-relaxed">
              {bestPlayoffNote
                ? `최고 포스트시즌 무대 · ${bestPlayoffNote}`
                : '매 시즌 끝까지 코트 위에서 팀을 위해 싸웠습니다.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--t-g100)] border-y border-[var(--t-g100)]">
            {championships.map((champ) => (
              <div
                key={champ.id}
                className="py-3 flex items-center gap-3"
              >
                <span className="w-11 text-[13px] font-bold text-[var(--t-gold)] tabular-nums shrink-0">
                  {champ.year}
                </span>
                <TeamEmblem
                  team={{
                    id: champ.isInternational ? 'KOR_NAT_TEAM' : champ.teamId || champ.id,
                    name: champ.teamName,
                    shortName: champ.teamName,
                    city: '',
                    league: champ.league || 'KBL',
                    rating: 80,
                    primaryColor: champ.isInternational ? '#0047a0' : champ.primaryColor,
                    secondaryColor: champ.isInternational ? '#cd2e3a' : champ.secondaryColor,
                    logoUrl: champ.isInternational ? '/logos/NAT_KOR.svg' : champ.logoUrl,
                    prestigeDesc: '',
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[14px] font-bold text-[var(--t-g900)]">
                      {champ.titleLabel}
                    </span>
                    <span className="text-[12px] text-[var(--t-g500)]">
                      · {champ.teamName}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--t-g500)] tabular-nums mt-0.5">
                    {champ.statSummary}
                    {champ.wonFinalsMvp && (
                      <span className="font-bold text-[var(--t-accent-ink)]">
                        {' '}
                        · {champ.isInternational ? '대회 MVP' : '파이널 MVP'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 트로피 진열장 */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold text-[var(--t-g900)]">
            트로피 진열장
          </h3>
          <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
            {trophies.reduce((sum, t) => sum + t.count, 0)}개 수상 · 항목 선택 시 연도 확인
          </span>
        </div>

        {trophies.length === 0 ? (
          <div className="py-5 px-4 rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)]">
            <p className="text-[13px] text-[var(--t-g600)]">
              개인 타이틀 없이 묵묵히 팀의 빈자리를 채운 헌신적인 커리어였습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {trophies.map((item) => {
                const Icon = getTrophyIcon(item.id);
                const isExpanded = expandedTrophyId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`trophy-item-${item.id}`}
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedTrophyId(isExpanded ? null : item.id)
                    }
                    className={`min-h-[76px] p-3 rounded-2xl text-left border transition-colors cursor-pointer t-tap flex flex-col justify-between ${
                      isExpanded
                        ? 'bg-[var(--t-g50)] border-[var(--t-g800)]'
                        : 'bg-[var(--t-card)] border-[var(--t-g200)] hover:bg-[var(--t-g50)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${getAccentTextClass(
                          item.accent
                        )}`}
                      />
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--t-g400)] shrink-0" />
                      )}
                    </div>
                    <div className="pt-2">
                      <span
                        className={`block text-[20px] font-bold leading-none tabular-nums ${getAccentTextClass(
                          item.accent
                        )}`}
                      >
                        {item.count}
                      </span>
                      <span className="block text-[12px] font-semibold text-[var(--t-g700)] mt-1 truncate">
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 선택 트로피 연도별 상세 목록 */}
            {selectedTrophy && (
              <div
                data-testid="trophy-detail-panel"
                className="rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] p-4 space-y-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-bold text-[var(--t-g900)]">
                    {selectedTrophy.label} 상세 기록
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--t-g500)] tabular-nums">
                    {selectedTrophy.count}회
                  </span>
                </div>
                <div className="divide-y divide-[var(--t-g200)]/70">
                  {selectedTrophy.entries.map((ent, idx) => (
                    <div
                      key={`${selectedTrophy.id}_${ent.year}_${idx}`}
                      className="py-2 first:pt-1 last:pb-0 flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--t-g900)] tabular-nums mr-2">
                          {ent.year}
                        </span>
                        <span className="text-[var(--t-g700)]">
                          {ent.teamName}
                        </span>
                        <span className="text-[var(--t-g500)] text-[12px]">
                          {' '}
                          · {ent.leagueShortName}
                        </span>
                      </div>
                      {ent.note && (
                        <span className="text-[12px] font-semibold text-[var(--t-accent-ink)] shrink-0">
                          {ent.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
