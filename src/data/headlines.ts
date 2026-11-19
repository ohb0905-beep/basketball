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
}

const HEADLINE_TEMPLATES = {
  CHAMPION_MVP: [
    '[{league}] "완벽한 대관식" {team} {name}, 평균 {ppg}점·{rpg}리바운드·{apg}어시스트로 통합 우승·MVP 석권!',
    '[{league}] 코트를 지배한 {team} {name}, 압도적 퍼포먼스로 챔피언십과 MVP 동시 제패!',
  ],
  MVP_ONLY: [
    '[{league}] 리그 최고의 별은 {name}! 평균 {ppg}점·{apg}어시스트 맹활약으로 정규시즌 MVP 등극!',
    '[{league}] "누구도 막을 수 없었다" {team} 에이스 {name}, 생애 최고의 활약으로 정규시즌 MVP 수상!',
  ],
  ROOKIE_STAR: [
    '[{league}] "괴물 신인의 등장" {team} 루키 {name}, 데뷔 시즌 평균 {ppg}점·{rpg}리바운드로 돌풍!',
    '[{league}] 겁 없는 신예 {name}, 첫 시즌부터 {team} 핵심 전력으로 도약하며 평균 {ppg}점 기록!',
  ],
  SUPERSTAR: [
    '[{league}] 더블팀도 무용지물! {team} 1옵션 에이스 {name}, 평균 {ppg}점·{apg}도움으로 리그 폭격!',
    '[{league}] 매 경기가 하이라이트! {team} {name}, 순도 높은 결정력으로 평균 {ppg}점 맹활약!',
  ],
  PLAYMAKER: [
    '[{league}] 코트 위의 야전사령관 {team} {name}, 평균 {apg}어시스트·{ppg}점으로 앞선 완전 장악!',
    '[{league}] 날카로운 패스와 리딩 선보인 {name}, {team} 공격의 엔진 역할 톡톡히 수행!',
  ],
  REBOUNDER: [
    '[{league}] "페인트존 장악!" {team} 골밑 수호신 {name}, 평균 {rpg}리바운드·{ppg}점 더블더블급 위력!',
    '[{league}] 보드를 지배하는 {team} {name}, 탄탄한 골밑 존재감으로 평균 {rpg}리바운드 수확!',
  ],
  SOLID_ROTATION: [
    '[{league}] {team} 주축으로 자리 잡은 {name}, 평균 {ppg}점·{rpg}리바운드·{apg}도움으로 알토란 활약!',
    '[{league}] 흔들림 없는 공수 밸런스! {team} {name}, 꾸준한 출전 속에 커리어 상승세 지속!',
  ],
  BENCH_GRIND: [
    '[{league}] 식지 않는 땀방울… {team} {name}, 제한된 출전 시간 속 평균 {ppg}점 기록하며 다음 시즌 도약 준비!',
    '[{league}] 치열한 주전 경쟁 치른 {team} {name}, 체육관 불 밝히며 절치부심 기량 담금질!',
  ],
};

export function generateSeasonHeadline(ctx: HeadlineContext): string {
  const displayName = ctx.name || ctx.playerName || '선수';
  const displayTeam = ctx.teamShortName || ctx.teamName;

  let pool = HEADLINE_TEMPLATES.SOLID_ROTATION;
  if (ctx.wonChampionship && ctx.wonMvp) {
    pool = HEADLINE_TEMPLATES.CHAMPION_MVP;
  } else if (ctx.wonMvp) {
    pool = HEADLINE_TEMPLATES.MVP_ONLY;
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
    .replace(/\{apg\}/g, ctx.apg.toFixed(1));
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
