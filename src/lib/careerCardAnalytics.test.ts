import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCareerCardSharedPayload } from './careerCardAnalytics';
import { validateAnalyticsEventPayload } from './analyticsSchema';
import { buildFallbackRetrospectiveFromHof } from '../engine/retrospectiveEngine';
import { KBL_TEAMS } from '../data/teams';
import type { HallOfFameEntry } from '../types/game';

const entry: HallOfFameEntry = {
  id: 'hof-a',
  inductedAt: '2045-06-01T00:00:00.000Z',
  name: '홍길동',
  jerseyNumber: '7',
  heightCm: 190,
  primaryPos: 'SG',
  secondaryPos: null,
  peakOvr: 80,
  finalAge: 34,
  finalSeasonYear: 2044,
  seasonsPlayed: 14,
  retirementReason: 'VOLUNTARY_HONOR',
  legacyTierId: 'PRO_VETERAN',
  legacyTitle: '프로 베테랑',
  legacyEmoji: '🏀',
  legacyScore: 40,
  jerseyRetired: false,
  iconicTeam: KBL_TEAMS[0],
  careerEarnings: 0,
  totals: {
    gp: 500, points: 5000, rebounds: 1000, assists: 1000,
    nbaGp: 0, nbaPoints: 0, championships: 0, nbaChampionships: 0,
    mvps: 0, nbaMvps: 0, finalsMvps: 0, dpoys: 0, sixthManAwards: 0,
    mips: 0, allLeagueSelections: 0, allStars: 0, nbaAllStars: 0,
  },
  careerAverages: { ppg: 10, rpg: 2, apg: 2 },
  careerHighPts: 30,
  epitaph: '',
};

test('buildCareerCardSharedPayload: NBA 없는 다시 보기 저장', () => {
  const retro = buildFallbackRetrospectiveFromHof(entry);
  assert.deepEqual(buildCareerCardSharedPayload(retro, 'save', true), {
    action: 'save',
    legacyTierId: 'PRO_VETERAN',
    seasonsPlayed: 14,
    reachedNba: false,
    isReplay: true,
  });
});

test('career_card_shared 이벤트는 검증을 통과하고 다섯 키가 모두 남는다', () => {
  const retro = buildFallbackRetrospectiveFromHof(entry);
  const payload = buildCareerCardSharedPayload(retro, 'share', false);
  const result = validateAnalyticsEventPayload({
    event_name: 'career_card_shared',
    anonymous_id: 'anon-card-1',
    session_id: 'sess-card-1',
    game_version: '1.3.0',
    device_type: 'mobile',
    payload,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.payload, payload);
  }
});
