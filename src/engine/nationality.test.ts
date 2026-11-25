import test from 'node:test';
import assert from 'node:assert/strict';
import { rollSeasonEventQueue } from '../data/events';
import { getTeamsByLeague, KBL_TEAMS, U_LEAGUE_TEAMS, US_HIGH_SCHOOL_TEAMS } from '../data/teams';
import { generateOffseasonOptions } from './draftEngine';
import { normalizeCareerSave } from '../store/saveMigration';
import type { CareerState, NationalityCode, OffseasonOption } from '../types/game';

/** 대한민국 국적에만 나와야 하는 이벤트 (상무 입대, 국가대표 소집, 태극마크 아크) */
const KOREA_ONLY_EVENT_PATTERN = /^(EVT_SANGMU|EVT_ASIAN_GAMES|EVT_INTL_|ARC_NAT_)/;

async function createCareer(params: {
  highSchoolTeamId: string;
  nationality?: NationalityCode;
}): Promise<CareerState> {
  const { useCareerStore } = await import('../store/useCareerStore');
  const store = useCareerStore.getState();
  store.resetAllGameData();
  store.startNewCareer({
    name: '국적테스트',
    jerseyNumber: '9',
    heightCm: 196,
    primaryPos: 'SF',
    highSchoolTeamId: params.highSchoolTeamId,
    nationality: params.nationality,
  });
  const career = useCareerStore.getState().career!;
  store.resetAllGameData();
  return career;
}

function graduate(career: CareerState, ovr: number): CareerState {
  return {
    ...career,
    age: 19,
    ovr,
    contractYearsLeft: 0,
    seasonLogs: [],
    prospectStars: undefined,
  };
}

function hasKblDraft(options: OffseasonOption[]): boolean {
  return options.some((o) => o.actionType === 'ENTER_KBL_DRAFT');
}

test('1.2.0-1 국적과 미국 고교를 골라 시작하고, 한국 고교는 대한민국 국적만 입학한다', async () => {
  const usCareer = await createCareer({ highSchoolTeamId: 'USHS_MONTVERDE', nationality: 'FRA' });
  assert.equal(usCareer.league, 'US_HIGH_SCHOOL');
  assert.equal(usCareer.team.id, 'USHS_MONTVERDE');
  assert.equal(usCareer.nationality, 'FRA');
  assert.equal(usCareer.militaryExempt, true, '외국 국적은 병역 대상이 아닙니다');
  assert.equal(usCareer.age, 15, '미국 고교는 만 15세 9학년으로 입학합니다');
  assert.equal(usCareer.contractYearsLeft, 4, '미국 고교는 4년제입니다');

  const blocked = await createCareer({ highSchoolTeamId: 'HS_SAMIL', nationality: 'JPN' });
  assert.equal(blocked.league, 'US_HIGH_SCHOOL', '외국 국적은 한국 고교에 입학할 수 없어 미국 고교로 시작합니다');
  assert.ok(US_HIGH_SCHOOL_TEAMS.some((t) => t.id === blocked.team.id));

  const krCareer = await createCareer({ highSchoolTeamId: 'HS_SAMIL' });
  assert.equal(krCareer.league, 'HIGH_SCHOOL');
  assert.equal(krCareer.nationality, 'KOR', '국적을 주지 않으면 대한민국');
  assert.equal(krCareer.militaryExempt, false);
  assert.equal(krCareer.age, 16);
  assert.equal(krCareer.contractYearsLeft, 3, '한국 고교는 3년제 그대로입니다');
});

test('1.2.0-2 외국 국적은 병역·국가대표 이벤트가 나오지 않고, 대한민국 국적은 그대로 나온다', async () => {
  const seed = await createCareer({ highSchoolTeamId: 'USHS_IMG', nationality: 'KOR' });
  const kblTeam = KBL_TEAMS[0];
  const veteran: CareerState = {
    ...seed,
    league: 'KBL',
    team: kblTeam,
    age: 28,
    ovr: 80,
    contractType: 'KBL_VET',
    contractYearsLeft: 2,
    militaryExempt: false,
    militaryServiceSeasonsLeft: 0,
  };

  const koreanQueue = rollSeasonEventQueue(veteran, () => 0.5);
  assert.ok(
    koreanQueue.some((e) => KOREA_ONLY_EVENT_PATTERN.test(e.id)),
    '미국 고교 출신이어도 대한민국 국적이면 병역 이벤트가 나와야 합니다'
  );

  const foreignVeteran: CareerState = { ...veteran, nationality: 'USA' };
  for (const r of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    const queue = rollSeasonEventQueue(foreignVeteran, () => r);
    assert.ok(
      !queue.some((e) => KOREA_ONLY_EVENT_PATTERN.test(e.id)),
      `외국 국적에 한국 전용 이벤트가 나왔습니다: ${queue.map((e) => e.id).join(', ')}`
    );
  }
});

test('1.2.0-3 KBL 드래프트는 대한민국 국적만 신청할 수 있다', async () => {
  const krSeed = await createCareer({ highSchoolTeamId: 'HS_SAMIL', nationality: 'KOR' });
  const krGrad = graduate(krSeed, 64);
  assert.ok(hasKblDraft(generateOffseasonOptions(krGrad, () => 0.5)), '한국 국적 고교 졸업생은 KBL 얼리 드래프트 가능');

  const foreignGrad: CareerState = { ...krGrad, nationality: 'SRB' };
  const foreignOptions = generateOffseasonOptions(foreignGrad, () => 0.5);
  assert.ok(!hasKblDraft(foreignOptions), '외국 국적은 KBL 드래프트 불가');

  const foreignCollege: CareerState = {
    ...foreignGrad,
    league: 'U_LEAGUE',
    team: U_LEAGUE_TEAMS[0],
    age: 23,
    contractYearsLeft: 0,
  };
  const collegeOptions = generateOffseasonOptions(foreignCollege, () => 0.5);
  assert.ok(!hasKblDraft(collegeOptions), '외국 국적 대학 졸업생도 KBL 드래프트 불가');
  assert.ok(
    collegeOptions.some((o) => o.actionType === 'ENTER_NBA_DRAFT'),
    '외국 국적 대학 졸업생은 NBA 드래프트로 길이 열려 있어야 합니다'
  );
});

test('1.2.0-4 미국 고교 졸업생은 별점과 상관없이 NCAA 제안을 받는다', async () => {
  const seed = await createCareer({ highSchoolTeamId: 'USHS_COMPASS', nationality: 'NGA' });
  const weakGrad = graduate(seed, 48);
  const options = generateOffseasonOptions(weakGrad, () => 0.5);
  const ncaaOffers = options.filter((o) => o.targetLeague === 'NCAA');
  assert.ok(ncaaOffers.length >= 1, '약한 미국 고교 졸업생도 NCAA 오퍼가 있어야 합니다');
  assert.ok(
    ncaaOffers.every((o) => o.targetTeam?.direction !== 'CONTENDER'),
    '별이 낮으면 우승 후보 대학은 제안하지 않습니다'
  );
  assert.ok(!options.some((o) => o.targetLeague === 'U_LEAGUE'), '외국 국적 미국 고교 출신은 U-리그 제안 없음');
  assert.ok(!hasKblDraft(options));

  const koreanGrad: CareerState = { ...weakGrad, nationality: 'KOR' };
  const koreanOptions = generateOffseasonOptions(koreanGrad, () => 0.5);
  assert.ok(koreanOptions.some((o) => o.targetLeague === 'NCAA'));
  assert.ok(
    koreanOptions.some((o) => o.targetLeague === 'U_LEAGUE'),
    '대한민국 국적 미국 고교 출신은 U-리그 진학도 가능'
  );
});

test('1.2.0-5 외국 국적이 받는 KBL 구단 제안은 외국인 선수 계약으로 표시된다', async () => {
  const seed = await createCareer({ highSchoolTeamId: 'HS_SAMIL', nationality: 'AUS' });
  const kblFa: CareerState = {
    ...seed,
    league: 'KBL',
    team: KBL_TEAMS[0],
    age: 27,
    ovr: 76,
    contractType: 'KBL_VET',
    contractYearsLeft: 0,
  };
  const options = generateOffseasonOptions(kblFa, () => 0.5);
  const kblSigns = options.filter((o) => o.targetLeague === 'KBL' && o.actionType === 'SIGN_TEAM');
  for (const o of kblSigns) {
    assert.ok(o.badgeText.includes('외국인 선수'), `KBL 제안 배지: ${o.badgeText}`);
  }
  const korean = generateOffseasonOptions({ ...kblFa, nationality: 'KOR' }, () => 0.5);
  assert.ok(!korean.some((o) => o.badgeText.includes('외국인 선수')));
});

test('1.2.0-6 미국 고교 시즌은 미국 학교끼리만 치르고, 커리어 내내 한국 전용 이벤트가 없다', async () => {
  const { useCareerStore } = await import('../store/useCareerStore');
  const S = () => useCareerStore.getState();
  const usIds = new Set(US_HIGH_SCHOOL_TEAMS.map((t) => t.id));
  assert.equal(getTeamsByLeague('US_HIGH_SCHOOL').length, US_HIGH_SCHOOL_TEAMS.length);

  for (let run = 0; run < 2; run++) {
    S().resetAllGameData();
    S().startNewCareer({
      name: `US${run}`,
      jerseyNumber: '1',
      heightCm: 200,
      primaryPos: run === 0 ? 'SF' : 'PG',
      highSchoolTeamId: US_HIGH_SCHOOL_TEAMS[run].id,
      nationality: 'CAN',
    });
    const seenEventIds: string[] = [];
    for (let i = 0; i < 400 && S().view !== 'RETIREMENT'; i++) {
      const st = S();
      const c = st.career;
      if (!c) break;
      if (st.view === 'DRAFT_COMBINE') {
        st.completeCombineInterview('TEAM_FIRST');
        st.proceedToDraftLive();
        continue;
      }
      if (st.view === 'DRAFT_LIVE') {
        const dr = c.draftResult;
        st.finalizeDraftSigning(dr?.round === 1 ? 'NBA_STANDARD' : 'GLEAGUE');
        continue;
      }
      if (c.pendingEvent) {
        seenEventIds.push(c.pendingEvent.id);
        st.resolveEventChoice(c.pendingEvent.choices[0]);
        st.dismissEncounterOutcome();
        continue;
      }
      if (c.lastInternationalSummary) st.dismissInternationalSummary();
      if (c.seasonPhase === 'LIVE_FINAL_BROADCAST') {
        if (!c.liveGame?.isFinished) st.skipLiveGame();
        else st.closeLiveGameAndReturn();
        continue;
      }
      if (c.seasonPhase === 'POSTSEASON_BRACKET') {
        const b = c.playoffBracket!;
        if (b.championTeamId) st.enterOffseasonFromPlayoffs();
        else if (b.playerReachedFinals || b.pendingConfFinalsGame7) st.startFinalsLiveBroadcast();
        else st.advancePlayoffBracketRound();
        continue;
      }
      if (c.seasonPhase === 'OFFSEASON' || c.offseasonLocked) {
        const options = c.offseasonOptions || [];
        assert.ok(!hasKblDraft(options), '외국 국적에 KBL 드래프트 선택지가 나왔습니다');
        const pick = options.find((o) => o.targetLeague === 'NCAA') || options[0];
        if (!pick) break;
        st.selectOffseasonOption(pick);
        continue;
      }
      if (c.league === 'US_HIGH_SCHOOL') {
        for (const row of c.currentStandings ?? []) {
          assert.ok(usIds.has(row.team.id), `미국 고교 순위표에 다른 팀이 섞였습니다: ${row.team.id}`);
        }
      }
      st.playSeason();
    }

    const career = S().career!;
    assert.ok(career.seasonLogs.length >= 3, '여러 시즌을 진행해야 합니다');
    assert.equal(career.seasonLogs[0].league, 'US_HIGH_SCHOOL');
    const hsLogs = career.seasonLogs.filter((l) => l.league === 'US_HIGH_SCHOOL');
    assert.equal(hsLogs.length, 4, '미국 고교에서 4시즌을 뛰고 졸업합니다');
    assert.equal(hsLogs[hsLogs.length - 1].age, 18, '마지막 고교 시즌은 만 18세');
    for (const log of hsLogs) {
      assert.ok(usIds.has(log.teamId), `미국 고교 시즌 소속팀이 미국 학교가 아닙니다: ${log.teamId}`);
    }
    const allEvents = [...seenEventIds, ...(career.seenEventIds || [])];
    const koreaOnly = allEvents.filter((id) => KOREA_ONLY_EVENT_PATTERN.test(id));
    assert.deepEqual(koreaOnly, [], '외국 국적 커리어에 한국 전용 이벤트가 나왔습니다');
    assert.equal(career.militaryServiceSeasonsLeft, 0);
    assert.equal(career.totals.internationalCaps ?? 0, 0);
  }
  S().resetAllGameData();
});

test('1.2.0-7 국적이 없는 예전 세이브는 대한민국 국적으로 이어진다', async () => {
  const seed = await createCareer({ highSchoolTeamId: 'HS_SAMIL' });
  const legacy = { ...seed } as Partial<CareerState>;
  delete legacy.nationality;
  const migrated = normalizeCareerSave(legacy as CareerState);
  assert.equal(migrated?.nationality, 'KOR');

  const usSave = normalizeCareerSave({ ...seed, nationality: 'JPN', league: 'US_HIGH_SCHOOL', team: US_HIGH_SCHOOL_TEAMS[0] });
  assert.equal(usSave?.nationality, 'JPN');
  assert.equal(usSave?.league, 'US_HIGH_SCHOOL', '미국 고교 리그가 저장 후에도 유지되어야 합니다');
});

test('1.2.0-8 미국 고교 출발은 잠재력·성장 상한이 한국 고교보다 높다', async () => {
  const { LEAGUE_CONFIG } = await import('../data/leagues');
  const { US_HIGH_SCHOOL_DEVELOPMENT_CONFIG } = await import('../config/balanceConfig');
  assert.ok(LEAGUE_CONFIG.US_HIGH_SCHOOL.growthCap > LEAGUE_CONFIG.HIGH_SCHOOL.growthCap);
  assert.ok(US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.growthMultiplier > 1);

  const originalRandom = Math.random;
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  try {
    for (const seed of [1, 2, 3, 4, 5]) {
      Math.random = seeded(seed);
      const kr = await createCareer({ highSchoolTeamId: 'HS_SAMIL', nationality: 'KOR' });
      Math.random = seeded(seed);
      const us = await createCareer({ highSchoolTeamId: 'USHS_PROLIFIC', nationality: 'KOR' });
      assert.equal(
        us.potential,
        Math.min(
          US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.potentialMax,
          kr.potential + US_HIGH_SCHOOL_DEVELOPMENT_CONFIG.potentialBonus
        )
      );
      assert.equal(us.ovr, kr.ovr, '시작 능력치는 같고 잠재력만 높습니다');
    }
  } finally {
    Math.random = originalRandom;
  }
});
