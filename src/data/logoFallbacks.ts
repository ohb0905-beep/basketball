import { LeagueId, TeamInfo } from '../types/game';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 네트워크 오류 및 외부 이미지 차단 시 각 리그(고교, 대학, KBL/해외, G리그, NBA)의 규격에 맞는
 * 고품질 SVG 이니셜 앰블럼(Data URI)을 자동 생성합니다.
 */
export function generateLeagueFallbackSvgDataUri(team: TeamInfo): string {
  const primary = team.primaryColor || '#EA580C';
  const secondary = team.secondaryColor || '#F59E0B';
  const rawInitials = (team.espnAbbr || team.shortName || team.name)
    .replace(/\s+/g, '')
    .slice(0, 3)
    .toUpperCase();
  const initials = escapeXml(rawInitials);
  const cityLabel = escapeXml((team.city || team.league).slice(0, 6).toUpperCase());
  const league: LeagueId = team.league;

  let svg = '';

  if (team.id === 'KOR_NAT_TEAM' || team.id === 'NAT_KOR') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 120">
      <rect x="0.75" y="0.75" width="178.5" height="118.5" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <g transform="translate(90,60) rotate(33.6901)">
        <circle cx="0" cy="0" r="30" fill="#0047A0"/>
        <path d="M -30 0 A 30 30 0 0 1 30 0 Z" fill="#CD2E3A"/>
        <circle cx="-15" cy="0" r="15" fill="#CD2E3A"/>
        <circle cx="15" cy="0" r="15" fill="#0047A0"/>
        <g fill="#000000">
          <rect x="-50" y="-15" width="5" height="30"/>
          <rect x="-57.5" y="-15" width="5" height="30"/>
          <rect x="-65" y="-15" width="5" height="30"/>
          <rect x="45" y="-15" width="5" height="13.75"/>
          <rect x="45" y="1.25" width="5" height="13.75"/>
          <rect x="52.5" y="-15" width="5" height="13.75"/>
          <rect x="52.5" y="1.25" width="5" height="13.75"/>
          <rect x="60" y="-15" width="5" height="13.75"/>
          <rect x="60" y="1.25" width="5" height="13.75"/>
        </g>
      </g>
      <g transform="translate(90,60) rotate(-33.6901)" fill="#000000">
        <rect x="45" y="-15" width="5" height="13.75"/>
        <rect x="45" y="1.25" width="5" height="13.75"/>
        <rect x="52.5" y="-15" width="5" height="30"/>
        <rect x="60" y="-15" width="5" height="13.75"/>
        <rect x="60" y="1.25" width="5" height="13.75"/>
        <rect x="-50" y="-15" width="5" height="30"/>
        <rect x="-57.5" y="-15" width="5" height="13.75"/>
        <rect x="-57.5" y="1.25" width="5" height="13.75"/>
        <rect x="-65" y="-15" width="5" height="30"/>
      </g>
    </svg>`;
  } else if (team.id.startsWith('NAT_')) {
    const code = escapeXml(team.id.replace('NAT_', '').slice(0, 3).toUpperCase());
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 120">
      <rect x="1" y="1" width="178" height="118" rx="10" fill="${primary}" stroke="#E2E8F0" stroke-width="2"/>
      <rect x="1" y="84" width="178" height="35" fill="${secondary}" opacity="0.9"/>
      <text x="90" y="64" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="38" font-weight="900" letter-spacing="3">${code}</text>
      <text x="90" y="106" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="800" letter-spacing="1.5">NATIONAL TEAM</text>
    </svg>`;
  } else if (league === 'HIGH_SCHOOL') {
    // 고교 리그 규격: 전통 방패 교표 + 월계수 크레스트 + 상단 리본
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="hsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="#FFFFFF" stroke="${primary}" stroke-width="4"/>
      <path d="M60 12 L98 26 V58 C98 84 80 100 60 108 C40 100 22 84 22 58 V26 Z" fill="url(#hsGrad)" stroke="${secondary}" stroke-width="3.5"/>
      <path d="M34 32 H86" stroke="${secondary}" stroke-width="1.5" stroke-opacity="0.55"/>
      <text x="60" y="27" text-anchor="middle" fill="${secondary}" font-family="sans-serif" font-size="9" font-weight="800" letter-spacing="1">${cityLabel}</text>
      <text x="60" y="67" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="${rawInitials.length >= 3 ? 21 : 25}" font-weight="900">${initials}</text>
      <text x="60" y="90" text-anchor="middle" fill="#F8FAFC" font-family="sans-serif" font-size="8.5" font-weight="700" opacity="0.9">HIGH SCHOOL</text>
    </svg>`;
  } else if (league === 'U_LEAGUE' || league === 'NCAA') {
    // 대학 리그(U-League / NCAA) 규격: 아카데믹 바시티 실드 & 농구공 심볼
    const badgeTag = league === 'NCAA' ? 'NCAA D1' : 'U-LEAGUE';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="uniGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#1E293B" />
        </linearGradient>
      </defs>
      <path d="M18 16 H102 V64 C102 90 83 104 60 112 C37 104 18 90 18 64 Z" fill="url(#uniGrad)" stroke="${secondary}" stroke-width="4"/>
      <circle cx="60" cy="56" r="30" fill="none" stroke="${secondary}" stroke-width="1.5" stroke-opacity="0.35"/>
      <rect x="26" y="16" width="68" height="16" fill="${secondary}"/>
      <text x="60" y="27" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9.5" font-weight="900" letter-spacing="1">${badgeTag}</text>
      <text x="60" y="68" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="${rawInitials.length >= 3 ? 22 : 27}" font-weight="900">${initials}</text>
      <text x="60" y="92" text-anchor="middle" fill="#F1F5F9" font-family="sans-serif" font-size="9" font-weight="700">${cityLabel}</text>
    </svg>`;
  } else if (league === 'GLEAGUE') {
    // G리그 규격: 다이나믹 헥사곤/다이아몬드 디벨롭먼트 배지
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="glGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>
      <polygon points="60,8 106,32 106,88 60,112 14,88 14,32" fill="url(#glGrad)" stroke="${secondary}" stroke-width="4"/>
      <polygon points="60,16 98,36 98,84 60,104 22,84 22,36" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-opacity="0.3"/>
      <text x="60" y="34" text-anchor="middle" fill="${secondary}" font-family="sans-serif" font-size="9" font-weight="900" letter-spacing="1.2">G LEAGUE</text>
      <text x="60" y="69" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="25" font-weight="900" letter-spacing="0.5">${initials}</text>
      <text x="60" y="90" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="8.5" font-weight="700">${cityLabel}</text>
    </svg>`;
  } else if (league === 'NBA') {
    // NBA 규격: 프로 챔피언십 아레나 실드 & 크라운 배지
    const confLabel = team.conference === 'EAST' ? 'NBA EAST' : team.conference === 'WEST' ? 'NBA WEST' : 'NBA PRO';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="nbaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#090D16" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#nbaGrad)" stroke="${secondary}" stroke-width="4.5"/>
      <circle cx="60" cy="60" r="43" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.3"/>
      <path d="M18 60 H102 M60 18 V102" stroke="${secondary}" stroke-width="1.2" stroke-opacity="0.25"/>
      <text x="60" y="33" text-anchor="middle" fill="${secondary}" font-family="sans-serif" font-size="9" font-weight="900" letter-spacing="1.2">${confLabel}</text>
      <text x="60" y="69" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="27" font-weight="900" letter-spacing="1">${initials}</text>
      <text x="60" y="92" text-anchor="middle" fill="#F8FAFC" font-family="sans-serif" font-size="8.5" font-weight="800">${cityLabel}</text>
    </svg>`;
  } else {
    // KBL / B_LEAGUE / NBL / EUROLEAGUE 규격: 모던 프로 구단 크레스트
    const proLabel =
      league === 'KBL'
        ? 'KBL PRO'
        : league === 'B_LEAGUE'
        ? 'B.LEAGUE'
        : league === 'NBL'
        ? 'NBL PRO'
        : league === 'EUROLEAGUE'
        ? 'EUROLEAGUE'
        : 'PRO CLUB';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="proGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="#1E293B" />
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="92" height="92" rx="24" fill="url(#proGrad)" stroke="${secondary}" stroke-width="4"/>
      <circle cx="60" cy="60" r="32" fill="none" stroke="${secondary}" stroke-width="1.5" stroke-opacity="0.35"/>
      <text x="60" y="33" text-anchor="middle" fill="${secondary}" font-family="sans-serif" font-size="9" font-weight="900" letter-spacing="1">${proLabel}</text>
      <text x="60" y="68" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="${rawInitials.length >= 3 ? 22 : 26}" font-weight="900">${initials}</text>
      <text x="60" y="91" text-anchor="middle" fill="#F8FAFC" font-family="sans-serif" font-size="8.5" font-weight="700">${cityLabel}</text>
    </svg>`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}
