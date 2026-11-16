'use client';

import React, { useState } from 'react';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamInfo } from '../../types/game';

interface TeamEmblemProps {
  team: TeamInfo;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: { box: 28, font: 9 },
  sm: { box: 36, font: 11 },
  md: { box: 48, font: 13 },
  lg: { box: 64, font: 16 },
  xl: { box: 84, font: 20 },
};

export function TeamEmblem({ team, size = 'md', className = '' }: TeamEmblemProps) {
  const espnLogos = useCareerStore((s) => s.espnLogos);
  const [imgFailed, setImgFailed] = useState(false);
  const dim = SIZE_MAP[size];

  // NBA & NCAA 공식 로고 URL 결정 (ESPN API 캐시 우선 -> ESPN 공식 CDN 폴백)
  let officialLogoUrl: string | null = null;
  if (team.league === 'NBA' && team.espnAbbr) {
    officialLogoUrl =
      espnLogos[team.id] ||
      `https://a.espncdn.com/i/teamlogos/nba/500/${team.espnAbbr.toLowerCase()}.png`;
  } else if (team.league === 'NCAA') {
    if (espnLogos[team.id]) {
      officialLogoUrl = espnLogos[team.id];
    } else if (team.espnId) {
      officialLogoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.espnId}.png`;
    }
  }

  if (officialLogoUrl && !imgFailed) {
    return (
      <div
        style={{ width: dim.box, height: dim.box }}
        className={`relative inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 p-1.5 shrink-0 select-none ${className}`}
        title={team.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={officialLogoUrl}
          alt={`${team.name} 로고`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // 한국 고교 · 한국 대학(U리그) · KBL 10개 구단 · 해외/G리그: 고유 컬러 SVG 방패/원형 크레스트 렌더링
  const isShield =
    team.league === 'HIGH_SCHOOL' ||
    team.league === 'U_LEAGUE' ||
    team.league === 'NCAA';

  const label = team.shortName.slice(0, 4);
  const smallText = label.length >= 3;

  return (
    <div
      style={{ width: dim.box, height: dim.box }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      title={team.name}
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full drop-shadow-xs"
        role="img"
        aria-label={`${team.name} 엠블럼`}
      >
        {isShield ? (
          <>
            {/* 대학/고교 클래식 방패형 크레스트 */}
            <path
              d="M10 8 H54 V30 C54 45 43 54 32 59 C21 54 10 45 10 30 Z"
              fill={team.primaryColor}
              stroke={team.secondaryColor}
              strokeWidth="3.5"
            />
            <path
              d="M15 13 H49 V29 C49 41 40 49 32 53 C24 49 15 41 15 29 Z"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1.5"
            />
            {/* 상단 농구공 크라운 디테일 */}
            <circle
              cx="32"
              cy="19"
              r="4.5"
              fill="none"
              stroke={team.secondaryColor}
              strokeWidth="1.4"
              opacity="0.85"
            />
          </>
        ) : (
          <>
            {/* 프로 구단(KBL / 해외 / G리그) 원형 엠블럼 배지 */}
            <circle
              cx="32"
              cy="32"
              r="28"
              fill={team.primaryColor}
              stroke={team.secondaryColor}
              strokeWidth="3.5"
            />
            <circle
              cx="32"
              cy="32"
              r="23"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />
            {/* 농구 코트 솔기 라인 */}
            <path
              d="M12 22 Q32 30 52 22"
              fill="none"
              stroke={team.secondaryColor}
              strokeWidth="1.5"
              opacity="0.55"
            />
            <path
              d="M12 42 Q32 34 52 42"
              fill="none"
              stroke={team.secondaryColor}
              strokeWidth="1.5"
              opacity="0.55"
            />
          </>
        )}

        <text
          x="32"
          y={isShield ? '38' : '37'}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={smallText ? '12.5' : '15.5'}
          fontWeight="800"
          style={{ letterSpacing: '-0.03em' }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
