import { LeagueId, Position } from '../types/game';

export interface HeadlineContext {
  name?: string;
  playerName?: string;
  teamName: string;
  teamShortName?: string;
  league?: LeagueId;
  leagueName: string;
  pos?: Position;
  role?: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg?: number;
  bpg?: number;
  singleGameHighPts?: number;
  ovr?: number;
  age?: number;
  wonChampionship: boolean;
  wonMvp: boolean;
  allStarSelected?: boolean;
  isFarewellTour?: boolean;
  isRookie?: boolean;
  priorMvpsCount?: number;
}

const HEADLINE_TEMPLATES = {
  CHAMPION_MVP: [
    '{league} {team} {name}, 평균 {ppg}점·{rpg}리바운드·{apg}도움으로 통합 우승과 MVP 석권',
    '{team} {name}, 시즌 MVP에 이어 {league} 챔피언 결정전 우승까지 달성',
  ],
  MVP_FIRST: [
    '{league} 정규시즌 MVP는 {team} {name}… 평균 {ppg}점·{apg}어시스트로 팀 견인',
    '{team} {name}, 공수 핵심 활약 속에 생애 첫 {league} 정규시즌 MVP 수상',
  ],
  MVP_REPEAT: [
    '{league} 정규시즌 MVP는 또다시 {team} {name}… 평균 {ppg}점·{apg}어시스트로 리그 지배',
    '{team} {name}, 압도적 퍼포먼스로 통산 {mvpNum}번째 {league} 정규시즌 MVP 수상',
  ],
  ROOKIE_STAR: [
    '{team} 루키 {name}, 데뷔 시즌 평균 {ppg}점·{rpg}리바운드로 주전 도약',
    '신인 {name}, {league} 첫 시즌부터 평균 {ppg}점 기록하며 로테이션 안착',
  ],
  SUPERSTAR: [
    '{team} 주득점원 {name}, 평균 {ppg}점·{apg}어시스트로 {league} 득점 선두권 활약',
    '{name}, 높은 슈팅 효율 앞세워 {team} 공격 주도… 시즌 평균 {ppg}점 기록',
  ],
  PLAYMAKER: [
    '{team} {name}, 평균 {apg}어시스트·{ppg}점으로 앞선 경기 조율 주도',
    '{name}, 안정적인 볼핸들링과 패스 전개로 {team} 공격 흐름 이끌어',
  ],
  REBOUNDER: [
    '{team} {name}, 평균 {rpg}리바운드·{ppg}점으로 골밑 보드 장악',
    '{league} 페인트존 지킨 {team} {name}, 시즌 평균 {rpg}리바운드 수확',
  ],
  SOLID_ROTATION: [
    '{team} 로테이션 핵심 {name}, 평균 {ppg}점·{rpg}리바운드·{apg}도움으로 안정적 기여',
    '{name}, 공수 균형 잡힌 활약으로 {team} 주축 입지 다져',
  ],
  BENCH_GRIND: [
    '{team} {name}, 제한된 출전 속 평균 {ppg}점 기록하며 다음 시즌 도약 노려',
    '로테이션 경쟁 치른 {team} {name}, 비시즌 기량 보완으로 반등 준비',
  ],
};

export function generateSeasonHeadline(ctx: HeadlineContext): string {
  const displayName = ctx.name || ctx.playerName || '선수';
  const displayTeam = ctx.teamShortName || ctx.teamName;
  const priorMvps = Math.max(0, ctx.priorMvpsCount ?? 0);

  let pool = HEADLINE_TEMPLATES.SOLID_ROTATION;
  if (ctx.wonChampionship && ctx.wonMvp) {
    pool = HEADLINE_TEMPLATES.CHAMPION_MVP;
  } else if (ctx.wonMvp) {
    pool =
      priorMvps === 0
        ? HEADLINE_TEMPLATES.MVP_FIRST
        : HEADLINE_TEMPLATES.MVP_REPEAT;
  } else if (ctx.isRookie && ctx.ppg >= 12) {
    pool = HEADLINE_TEMPLATES.ROOKIE_STAR;
  } else if (ctx.ppg >= 20) {
    pool = HEADLINE_TEMPLATES.SUPERSTAR;
  } else if (ctx.apg >= 6.0) {
    pool = HEADLINE_TEMPLATES.PLAYMAKER;
  } else if (ctx.rpg >= 8.5) {
    pool = HEADLINE_TEMPLATES.REBOUNDER;
  } else if (ctx.ppg < 6.5) {
    pool = HEADLINE_TEMPLATES.BENCH_GRIND;
  }

  const template = pool[Math.floor(Math.random() * pool.length)];
  return template
    .replace(/\{league\}/g, ctx.leagueName)
    .replace(/\{team\}/g, displayTeam)
    .replace(/\{name\}/g, displayName)
    .replace(/\{ppg\}/g, ctx.ppg.toFixed(1))
    .replace(/\{rpg\}/g, ctx.rpg.toFixed(1))
    .replace(/\{apg\}/g, ctx.apg.toFixed(1))
    .replace(/\{mvpNum\}/g, String(priorMvps + 1));
}

export function generateSeasonNarrativeLogs(
  ctx: HeadlineContext,
  farewellLogs: string[] = []
): string[] {
  const displayName = ctx.name || ctx.playerName || '선수';
  const displayTeam = ctx.teamShortName || ctx.teamName;
  const logs: string[] = [];

  if (ctx.singleGameHighPts && ctx.singleGameHighPts >= 20) {
    logs.push(
      `시즌 최다 득점: ${displayTeam} ${displayName}, 단일 경기 ${ctx.singleGameHighPts}점을 기록했습니다.`
    );
  } else {
    logs.push(
      `${displayTeam} 소속으로 정규시즌 평균 ${ctx.ppg.toFixed(1)}점 ${ctx.rpg.toFixed(1)}리바운드 ${ctx.apg.toFixed(1)}도움을 기록했습니다.`
    );
  }

  if (ctx.wonMvp) {
    logs.push(
      `정규시즌 MVP: 공수 활약과 팀 성적을 인정받아 ${ctx.leagueName} 정규시즌 MVP를 수상했습니다.`
    );
  } else if (ctx.allStarSelected) {
    logs.push(
      `올스타 선정: ${ctx.leagueName} 올스타 로스터에 이름을 올렸습니다.`
    );
  }

  if (ctx.isFarewellTour && farewellLogs.length > 0) {
    const pick = farewellLogs[Math.floor(Math.random() * farewellLogs.length)];
    logs.push(pick.replace(/\{team\}/g, displayTeam).replace(/\{name\}/g, displayName));
  }

  return logs;
}
