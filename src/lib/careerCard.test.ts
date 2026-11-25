import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCareerCardData,
  compressStints,
  resolveCardLogoSrc,
  toSameOriginLogoUrl,
} from './careerCard';
import { buildFallbackRetrospectiveFromHof } from '../engine/retrospectiveEngine';
import { HIGH_SCHOOL_TEAMS, KBL_TEAMS, NBA_TEAMS, U_LEAGUE_TEAMS } from '../data/teams';
import type { CareerRetrospective, HallOfFameEntry, TeamInfo } from '../types/game';

function makeHofEntry(
  team: TeamInfo,
  totals: Partial<HallOfFameEntry['totals']>,
  careerHighPts = 41
): HallOfFameEntry {
  return {
    id: 'hof-test',
    inductedAt: '2045-06-01T00:00:00.000Z',
    name: '홍길동',
    jerseyNumber: '23',
    heightCm: 191,
    primaryPos: 'PG',
    secondaryPos: 'SG',
    peakOvr: 88,
    finalAge: 36,
    finalSeasonYear: 2045,
    seasonsPlayed: 18,
    retirementReason: 'VOLUNTARY_HONOR',
    legacyTierId: 'ASIA_KBL_LEGEND',
    legacyTitle: 'KBL 레전드',
    legacyEmoji: '🏅',
    legacyScore: 71,
    jerseyRetired: true,
    iconicTeam: team,
    careerEarnings: 1000,
    totals: {
      gp: 700,
      points: 12000,
      rebounds: 3000,
      assists: 4000,
      nbaGp: 0,
      nbaPoints: 0,
      championships: 0,
      nbaChampionships: 0,
      mvps: 0,
      nbaMvps: 0,
      finalsMvps: 0,
      dpoys: 0,
      sixthManAwards: 0,
      mips: 0,
      allLeagueSelections: 0,
      allStars: 0,
      nbaAllStars: 0,
      ...totals,
    },
    careerAverages: { ppg: 17.1, rpg: 4.3, apg: 5.7 },
    careerHighPts,
    epitaph: '',
  };
}

function retroOf(entry: HallOfFameEntry): CareerRetrospective {
  return buildFallbackRetrospectiveFromHof(entry);
}

test('compressStints: 4개 이하면 그대로 둔다', () => {
  assert.deepEqual(compressStints(['a', 'b', 'c']), { shown: ['a', 'b', 'c'], hidden: 0 });
  assert.deepEqual(compressStints(['a', 'b', 'c', 'd']), {
    shown: ['a', 'b', 'c', 'd'],
    hidden: 0,
  });
});

test('compressStints: 8개면 앞 3개 + 마지막 1개, 나머지 4개 숨김', () => {
  const result = compressStints(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(result.shown, ['a', 'b', 'c', 'h']);
  assert.equal(result.hidden, 4);
});

test('toSameOriginLogoUrl: 같은 서버 경로와 data URI는 그대로 둔다', () => {
  assert.equal(toSameOriginLogoUrl('/logos/KBL_SK.png'), '/logos/KBL_SK.png');
  const dataUri = 'data:image/svg+xml;utf8,<svg></svg>';
  assert.equal(toSameOriginLogoUrl(dataUri), dataUri);
});

test('toSameOriginLogoUrl: ESPN 로고는 Next 이미지 변환 주소로 감싼다', () => {
  assert.equal(
    toSameOriginLogoUrl('https://a.espncdn.com/i/teamlogos/nba/500/lal.png'),
    '/_next/image?url=https%3A%2F%2Fa.espncdn.com%2Fi%2Fteamlogos%2Fnba%2F500%2Flal.png&w=256&q=90'
  );
});

test('resolveCardLogoSrc: espnLogos → logoUrl → null 순서', () => {
  const team = { id: 'NBA_LAL', league: 'NBA' as const, espnId: '13', logoUrl: '/logos/x.png' };
  assert.equal(
    resolveCardLogoSrc(team, { NBA_LAL: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' }),
    toSameOriginLogoUrl('https://a.espncdn.com/i/teamlogos/nba/500/lal.png')
  );
  assert.equal(
    resolveCardLogoSrc(team, { ESPN_NBA_13: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' }),
    toSameOriginLogoUrl('https://a.espncdn.com/i/teamlogos/nba/500/lal.png')
  );
  assert.equal(resolveCardLogoSrc(team, {}), '/logos/x.png');
  assert.equal(resolveCardLogoSrc({ ...team, logoUrl: undefined }, {}), null);
});

test('buildCareerCardData: NBA 없는 커리어는 NBA 줄이 없고 0인 수상은 숨긴다', () => {
  const data = buildCareerCardData(
    retroOf(makeHofEntry(KBL_TEAMS[0], { championships: 2 })),
    '🏅'
  );
  assert.equal(data.nbaLine, null);
  assert.deepEqual(data.honors, [{ label: '우승', count: 2 }]);
  assert.equal(data.playerName, '홍길동');
  assert.equal(data.positionLabel, 'PG/SG');
  assert.equal(data.legacyEmoji, '🏅');
});

test('buildCareerCardData: NBA 커리어는 NBA 줄에 0이 아닌 항목만 넣는다', () => {
  const data = buildCareerCardData(
    retroOf(
      makeHofEntry(NBA_TEAMS[0], {
        nbaGp: 500,
        nbaPoints: 9000,
        nbaChampionships: 1,
        nbaMvps: 1,
        championships: 3,
        mvps: 2,
      })
    ),
    '🐐'
  );
  assert.ok(data.nbaLine);
  assert.ok(data.nbaLine.startsWith('NBA'));
  assert.ok(data.nbaLine.includes('우승 1'));
  assert.ok(data.nbaLine.includes('MVP 1'));
  assert.ok(!data.nbaLine.includes(' 0'));
});

test('buildCareerCardData: 커리어 하이 0은 null, fallback 팀 하나는 그대로', () => {
  const data = buildCareerCardData(retroOf(makeHofEntry(KBL_TEAMS[0], {}, 0)), '🏅');
  assert.equal(data.careerHighPts, null);
  assert.equal(data.stints.length, 1);
  assert.equal(data.hiddenStintCount, 0);
  assert.equal(data.stints[0].logoTeam.id, KBL_TEAMS[0].id);
});

function retroWithStints(teams: TeamInfo[]): CareerRetrospective {
  const retro = retroOf(makeHofEntry(teams[teams.length - 1], {}));
  const base = retro.stints[0];
  retro.stints = teams.map((t, i) => ({
    ...base,
    id: `s${i}`,
    teamId: t.id,
    teamName: t.name,
    teamShortName: t.shortName,
    league: t.league,
  }));
  return retro;
}

test('buildCareerCardData: 팀이 많으면 고교·대학을 빼고 프로 팀만 보여 준다', () => {
  const amateur = [HIGH_SCHOOL_TEAMS[0], U_LEAGUE_TEAMS[0]];
  const pro = [KBL_TEAMS[0], KBL_TEAMS[1], NBA_TEAMS[0], NBA_TEAMS[1]];
  const data = buildCareerCardData(retroWithStints([...amateur, ...pro]), '');
  assert.deepEqual(
    data.stints.map((s) => s.teamId),
    pro.map((t) => t.id)
  );
  assert.equal(data.hiddenStintCount, 0);
});

test('buildCareerCardData: 프로 팀만으로도 많으면 프로 팀 안에서 줄인다', () => {
  const pro = [KBL_TEAMS[0], KBL_TEAMS[1], KBL_TEAMS[2], NBA_TEAMS[0], NBA_TEAMS[1], NBA_TEAMS[2]];
  const data = buildCareerCardData(retroWithStints([HIGH_SCHOOL_TEAMS[0], ...pro]), '');
  assert.deepEqual(
    data.stints.map((s) => s.teamId),
    [pro[0].id, pro[1].id, pro[2].id, pro[5].id]
  );
  assert.equal(data.hiddenStintCount, 2);
});

test('buildCareerCardData: 4팀 이하면 고교·대학도 그대로 보여 준다', () => {
  const teams = [HIGH_SCHOOL_TEAMS[0], U_LEAGUE_TEAMS[0], KBL_TEAMS[0]];
  const data = buildCareerCardData(retroWithStints(teams), '');
  assert.equal(data.stints.length, 3);
});

test('buildCareerCardData: 전성기 문구에 득점·리바운드·어시스트를 모두 넣는다', () => {
  const retro = retroOf(makeHofEntry(KBL_TEAMS[0], {}));
  retro.peakSeason = {
    ...(retro.seasons[0] ?? ({} as CareerRetrospective['seasons'][number])),
    year: 2038,
    teamShortName: 'SK',
    ppg: 31.24,
    rpg: 8.06,
    apg: 7.4,
  } as CareerRetrospective['seasons'][number];
  const data = buildCareerCardData(retro, '');
  assert.equal(data.peakSeasonLabel, '2038 SK · 31.2득점 · 8.1리바운드 · 7.4어시스트');
});
