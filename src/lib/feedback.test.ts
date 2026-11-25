import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_VERSION } from '../config/appMeta';
import { NBA_TEAMS } from '../data/teams';
import {
  FEEDBACK_CONTENT_MAX,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPE_VALUES,
  collectFeedbackGameContext,
  formatGameContextPreviewRows,
  sanitizeGameContext,
  validateFeedbackInput,
} from './feedback';
import type { CareerState } from '../types/game';

test('1. 게임 버전 SemVer(package.json과 일치) 및 제보 유형 매핑 검증', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  ) as { version: string };
  assert.equal(GAME_VERSION, packageJson.version);
  assert.match(GAME_VERSION, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...FEEDBACK_TYPE_VALUES], [
    'bug',
    'balance',
    'content',
    'ui',
    'other',
  ]);
  assert.equal(FEEDBACK_TYPE_LABELS.bug, '버그 제보');
  assert.equal(FEEDBACK_TYPE_LABELS.balance, '밸런스 및 게임 시스템 의견');
  assert.equal(FEEDBACK_TYPE_LABELS.content, '콘텐츠 추가 제안');
  assert.equal(FEEDBACK_TYPE_LABELS.ui, 'UI 및 사용성 개선');
  assert.equal(FEEDBACK_TYPE_LABELS.other, '기타');
});

test('2. 커리어 미초기화(null) 및 진행 중 커리어의 안전한 게임 컨텍스트 수집 검증', () => {
  const emptyCtx = collectFeedbackGameContext({
    view: 'HOME',
    activeTab: 'SEASON',
    career: null,
    now: new Date('2026-11-24T12:00:00.000Z'),
  });
  assert.equal(emptyCtx.submittedAt, '2026-11-24T12:00:00.000Z');
  assert.equal(emptyCtx.gameVersion, GAME_VERSION);
  assert.equal(emptyCtx.hasCareer, false);
  assert.equal(emptyCtx.player, null);
  assert.equal(emptyCtx.activeTab, null);

  const emptyRows = formatGameContextPreviewRows(emptyCtx);
  assert.ok(emptyRows.some((r) => r.label === '게임 버전' && r.value === `v${GAME_VERSION}`));
  assert.ok(emptyRows.some((r) => r.label === '커리어 상태'));

  const mockCareer = {
    league: 'NBA',
    seasonYear: 2031,
    seasonsPlayed: 5,
    seasonPhase: 'POSTSEASON_BRACKET',
    offseasonLocked: false,
    pendingEvent: null,
    liveGame: null,
    primaryPos: 'PG',
    secondaryPos: 'SG',
    age: 24,
    ovr: 88,
    role: '주전 에이스',
    team: NBA_TEAMS[0],
    contractType: 'STANDARD',
    contractYearsLeft: 3,
    militaryExempt: true,
    militaryServiceSeasonsLeft: 0,
    nationalTeamRetired: false,
  } as unknown as CareerState;

  const activeCtx = collectFeedbackGameContext({
    view: 'DASHBOARD',
    activeTab: 'TRAINING',
    career: mockCareer,
    now: new Date('2026-11-24T12:30:00.000Z'),
  });
  assert.equal(activeCtx.hasCareer, true);
  assert.equal(activeCtx.activeTab, 'TRAINING');
  assert.equal(activeCtx.league, 'NBA');
  assert.equal(activeCtx.seasonYear, 2031);
  assert.equal(activeCtx.player?.primaryPos, 'PG');
  assert.equal(activeCtx.player?.secondaryPos, 'SG');
  assert.equal(activeCtx.player?.ovr, 88);
  assert.equal(activeCtx.player?.teamName, NBA_TEAMS[0].name);
  assert.equal('name' in (activeCtx.player as unknown as Record<string, unknown>), false);

  const activeRows = formatGameContextPreviewRows(activeCtx);
  assert.ok(activeRows.some((r) => r.value.includes('PG/SG')));
  assert.ok(activeRows.some((r) => r.value.includes('NBA')));
});

test('3. 입력 검증 및 민감 필드 스트리핑(화이트리스트 정제) 검증', () => {
  const missingType = validateFeedbackInput({
    type: 'invalid',
    title: '제목',
    content: '내용',
  });
  assert.equal(missingType.ok, false);

  const tooLongTitle = validateFeedbackInput({
    type: 'bug',
    title: 'a'.repeat(FEEDBACK_TITLE_MAX + 1),
    content: '내용',
  });
  assert.equal(tooLongTitle.ok, false);

  const tooLongContent = validateFeedbackInput({
    type: 'balance',
    title: '제목',
    content: 'b'.repeat(FEEDBACK_CONTENT_MAX + 1),
  });
  assert.equal(tooLongContent.ok, false);

  const valid = validateFeedbackInput({
    type: 'ui',
    title: '  모바일 헤더 정렬 의견  ',
    content: '  버튼 간격이 깔끔합니다.  ',
    gameVersion: '1.0.0',
    gameContext: {
      submittedAt: '2026-11-24T12:00:00.000Z',
      gameVersion: '1.0.0',
      view: 'DASHBOARD',
      password: 'secret-should-be-dropped',
      token: 'bearer-should-be-dropped',
      email: 'user@example.com',
      fullSaveDump: { huge: true },
      player: {
        primaryPos: 'SF',
        age: 22,
        ovr: 80,
        name: 'PII-should-be-dropped',
      },
    },
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.title, '모바일 헤더 정렬 의견');
    assert.equal(valid.data.content, '버튼 간격이 깔끔합니다.');
    assert.equal(valid.data.gameVersion, '1.0.0');
    assert.equal('password' in valid.data.gameContext, false);
    assert.equal('token' in valid.data.gameContext, false);
    assert.equal('email' in valid.data.gameContext, false);
    assert.equal('fullSaveDump' in valid.data.gameContext, false);
    const playerCtx = valid.data.gameContext.player as Record<string, unknown>;
    assert.equal(playerCtx.primaryPos, 'SF');
    assert.equal('name' in playerCtx, false);
  }

  assert.deepEqual(sanitizeGameContext(['not-an-object']), {});
});

test('4. Supabase feedbacks SQL 마이그레이션 필수 제약·인덱스·RLS 검증', () => {
  const sqlPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261124_create_feedbacks.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.feedbacks'));
  assert.ok(sql.includes('gen_random_uuid()'));
  assert.ok(sql.includes("'bug', 'balance', 'content', 'ui', 'other'"));
  assert.ok(sql.includes("'received', 'reviewing', 'resolved', 'rejected'"));
  assert.ok(sql.includes('game_context jsonb'));
  assert.ok(sql.includes('created_at DESC'));
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(sql.includes('REVOKE ALL ON TABLE public.feedbacks FROM anon, authenticated'));
});

test('admin feedback search filter quotes PostgREST special characters', async () => {
  const { buildFeedbackSearchFilter } = await import('./supabaseAdmin');
  assert.equal(buildFeedbackSearchFilter('   '), null);
  assert.equal(
    buildFeedbackSearchFilter(' 드래프트 '),
    '(title.ilike."*드래프트*",content.ilike."*드래프트*",admin_note.ilike."*드래프트*")'
  );
  // 쉼표·괄호는 따옴표 안에 두고, 따옴표와 역슬래시는 이스케이프합니다.
  assert.equal(
    buildFeedbackSearchFilter('a,b) "c" \\'),
    '(title.ilike."*a,b) \\"c\\" \\\\*",content.ilike."*a,b) \\"c\\" \\\\*",admin_note.ilike."*a,b) \\"c\\" \\\\*")'
  );
  assert.equal(buildFeedbackSearchFilter('x'.repeat(80))?.includes('x'.repeat(51)), false);
});
