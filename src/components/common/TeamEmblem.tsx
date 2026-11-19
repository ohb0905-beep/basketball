'use client';

import React, { useState } from 'react';
import { generateLeagueFallbackSvgDataUri } from '../../data/logoFallbacks';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamInfo } from '../../types/game';

interface TeamEmblemProps {
  team: TeamInfo;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TeamEmblem({ team, size = 'md', className = '' }: TeamEmblemProps) {
  const espnLogos = useCareerStore((s) => s.espnLogos);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  const leaguePrefix =
    team.league === 'NBA'
      ? 'ESPN_NBA_'
      : team.league === 'NCAA'
      ? 'ESPN_NCAA_'
      : team.league === 'GLEAGUE'
      ? 'ESPN_GLEAGUE_'
      : 'ESPN_';

  const syncedLogo =
    espnLogos[team.id] ||
    (team.espnId ? espnLogos[`${leaguePrefix}${team.espnId}`] : undefined);
  const primaryLogoUrl = syncedLogo || team.logoUrl;
  const fallbackDataUri =
    espnLogos[`FALLBACK_${team.id}`] || generateLeagueFallbackSvgDataUri(team);

  const useFallback =
    !primaryLogoUrl || Boolean(primaryLogoUrl && failedLogoUrl === primaryLogoUrl);
  const activeSrc = useFallback ? fallbackDataUri : primaryLogoUrl;

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-20 h-20 text-lg',
  }[size];

  return (
    <div
      className={`${sizeClasses} ${className} relative flex items-center justify-center rounded-full bg-[var(--t-g100)] p-1 shrink-0 overflow-hidden select-none`}
      title={team.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={team.name}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
        onError={() => {
          if (primaryLogoUrl && !useFallback) {
            setFailedLogoUrl(primaryLogoUrl);
          }
        }}
      />
    </div>
  );
}

export default TeamEmblem;
