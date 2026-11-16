import { NextResponse } from 'next/server';
import { NBA_TEAMS, NCAA_TEAMS } from '../../../src/data/teams';

export async function GET() {
  const logoMap: Record<string, string> = {};

  // 기본 공식 ESPN CDN URL 세팅
  for (const team of NBA_TEAMS) {
    if (team.espnAbbr) {
      logoMap[team.id] = `https://a.espncdn.com/i/teamlogos/nba/500/${team.espnAbbr.toLowerCase()}.png`;
    }
  }
  for (const team of NCAA_TEAMS) {
    if (team.espnId) {
      logoMap[team.id] = `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.espnId}.png`;
    }
  }

  // 서버 사이드에서 ESPN 공식 Public API 호출 (브라우저 CORS 우회)
  try {
    const nbaRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
      { next: { revalidate: 86400 } }
    );
    if (nbaRes.ok) {
      const data = await nbaRes.json();
      const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
      for (const item of teams) {
        const abbr = item?.team?.abbreviation?.toLowerCase();
        const href = item?.team?.logos?.[0]?.href;
        if (abbr && href) {
          const matched = NBA_TEAMS.find(
            (t) => t.espnAbbr?.toLowerCase() === abbr
          );
          if (matched) {
            logoMap[matched.id] = href;
          }
        }
      }
    }
  } catch {
    // 네트워크 제한 환경에서는 공식 ESPN CDN URL 매핑 유지
  }

  try {
    const ncaaRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=100',
      { next: { revalidate: 86400 } }
    );
    if (ncaaRes.ok) {
      const data = await ncaaRes.json();
      const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
      for (const item of teams) {
        const idStr = String(item?.team?.id || '');
        const href = item?.team?.logos?.[0]?.href;
        if (idStr && href) {
          const matched = NCAA_TEAMS.find((t) => t.espnId === idStr);
          if (matched) {
            logoMap[matched.id] = href;
          }
        }
      }
    }
  } catch {
    // 폴백 유지
  }

  return NextResponse.json({ logos: logoMap });
}
