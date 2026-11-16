import { LeagueId, Position } from '../types/game';

interface HeadlineContext {
  playerName: string;
  teamName: string;
  teamShortName: string;
  league: LeagueId;
  leagueName: string;
  pos: Position;
  role: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  singleGameHighPts: number;
  wonChampionship: boolean;
  wonMvp: boolean;
  allStarSelected: boolean;
  isFarewellTour?: boolean;
}

const HEADLINE_TEMPLATES = {
  FAREWELL: [
    '[{league}] "굿바이 레전드" {team} {name}, 눈물과 기립박수 속에 치른 마지막 시즌 평균 {ppg}점 투혼!',
    '[{league}] 전 구단 기립박수 받은 {name}의 라스트 댄스, {team} 유니폼 입고 남긴 마지막 불꽃!',
    '[{league}] "당신과 같은 시대를 살아 행복했어요" {name}, 평균 {ppg}점·{apg}도움으로 장식한 피날레!',
    '[{league}] 원정 코트마다 울려 퍼진 연호… {team} {name}, 전설로 남을 아름다운 은퇴 투어 완주!',
    '[{league}] {team}의 살아있는 역사 {name}, 마지막 시즌에도 {high}점 폭발시키며 건재함 과시!',
  ],
  CHAMPION_MVP: [
    '[{league}] "왕관을 쓰려는 자, 그 무게를 견뎌라" {team} {name}, 평균 {ppg}점으로 통합 우승·MVP 석권!',
    '[{league}] 완벽했던 지배자! {name}, 평균 {ppg}점·{rpg}리바운드·{apg}어시스트로 {team} 왕조 건설!',
    '[{league}] 이견 없는 만장일치급 임팩트! {team} {name}, 챔피언십 트로피와 MVP 동시 제패!',
    '[{league}] "코트의 신이 강림했다" {name}, 단일 경기 {high}점 폭발 포함 시즌 내내 압도적 퍼포먼스!',
    '[{league}] {team} 팬들의 오랜 숙원 풀었다! 프랜차이즈 스타 {name}, 눈물의 우승 트로피 번쩍!',
  ],
  MVP_ONLY: [
    '[{league}] 리그 최고의 별은 {name}! 평균 {ppg}점·{apg}도움 경이로운 볼륨으로 정규시즌 MVP 수상!',
    '[{league}] "누구도 그를 막을 수 없었다" {team} {name}, 최고점 {high}점 기록하며 MVP 등극!',
    '[{league}] 코트를 지배한 {team}의 에이스 {name}, 득점력과 클러치 지배력으로 MVP 트로피 수집!',
    '[{league}] 상대 수비 전술을 무너뜨린 {name}, 평균 {ppg}점 활약으로 생애 최고의 시즌 완성!',
    '[{league}] "벤치에서 시작해 최고가 되기까지" {team} {name}, 드라마 같은 MVP 대관식!',
  ],
  CHAMPION_ONLY: [
    '[{league}] {team}, 대망의 챔피언 등극! {name}의 결정적 공헌으로 우승 반지 획득했어요!',
    '[{league}] 파이널 무대에서 빛난 {name}! 평균 {ppg}점·{rpg}리바운드로 {team} 우승 견인!',
    '[{league}] 화려한 꽃가루 속에 웃은 {team} {name}, 커리어에 빛나는 우승 반지 추가!',
    '[{league}] 승부처마다 터진 {name}의 득점포! {team}, 치열한 시리즈 끝에 정상 등극!',
    '[{league}] "원팀으로 일궈낸 기적" {team} {name}, 공수 맹활약으로 챔피언십 트로피 품에 안았어요!',
  ],
  SUPERSTAR_SCORER: [
    '[{league}] "오늘도 {high}점 폭격!" {team} 1옵션 에이스 {name}, 시즌 평균 {ppg}점으로 리그 폭격!',
    '[{league}] 더블팀도 소용없다! {team} {name}, 평균 {ppg}점·{apg}어시스트로 올스타급 위용 과시!',
    '[{league}] 매 경기가 하이라이트 필름! {name}, 순도 높은 결정력으로 {team} 공격 완전 주도!',
    '[{league}] 상대 감독들의 한숨 "어떻게 막나"… {team} {name}, 평균 {ppg}점 괴물 같은 득점 행진!',
    '[{league}] 클러치 타임의 절대자 {name}, {team}의 해결사로 자리매김하며 평균 {ppg}점 기록!',
    '[{league}] 내외곽 가리지 않는 득점 기계 {name}, 시즌 최고 {high}점 폭발시키며 맹활약!',
  ],
  PLAYMAKER_GUARD: [
    '[{league}] "눈이 몇 개야?" 마법 같은 패스 뿌린 {team} {name}, 평균 {apg}어시스트·{ppg}점 맹활약!',
    '[{league}] 코트 위의 지휘자 {name}, 정교한 픽앤롤 리딩으로 {team} 공격 혈 뚫었어요!',
    '[{league}] 득점과 패스 두 마리 토끼 잡은 {name}, 평균 {ppg}점·{apg}도움으로 앞선 완벽 장악!',
    '[{league}] 동료들의 슛 감각 살려준 {team} 야전사령관 {name}, 노련한 경기 운영에 찬사 쏟아져!',
    '[{league}] 빠른 트랜지션과 날카로운 킥아웃! {name}, {team}의 엔진 역할을 톡톡히 해냈어요!',
  ],
  REBOUND_BIG: [
    '[{league}] "페인트존 출입 금지!" {team} 골밑 수호신 {name}, 평균 {rpg}리바운드·{bpg}블록 괴력!',
    '[{league}] 보드를 장악하는 자가 경기를 지배한다! {name}, 평균 {ppg}점·{rpg}리바운드 더블더블급 위력!',
    '[{league}] 탄탄한 스크린과 골밑 장악력 선보인 {team} {name}, 상대 인사이드를 완벽히 압도했어요!',
    '[{league}] 공격 리바운드 후 호쾌한 풋백 덩크! {name}, {team}의 든든한 기둥으로 맹활약!',
    '[{league}] 골밑에서 존재감 폭발한 {name}, 평균 {rpg}리바운드 잡아내며 팀 수비의 핵으로 우뚝!',
  ],
  STARTER_SOLID: [
    '[{league}] {team} 주전 라인업의 핵심 {name}, 평균 {ppg}점·{rpg}리바운드로 탄탄한 풀타임 시즌 소화!',
    '[{league}] 흔들리지 않는 꾸준함! {team} 스타터 {name}, 공수 밸런스 잡아주며 감독 신뢰 100% 보답!',
    '[{league}] 결정적 순간마다 터진 외곽포! {name}, 단일 경기 최다 {high}점 기록하며 주전 입지 굳혔어요!',
    '[{league}] 묵묵히 코트를 지킨 {team}의 살림꾼 {name}, 평균 {ppg}점으로 커리어 상승세 지속!',
    '[{league}] "이제는 어엿한 팀의 주축" {name}, 안정적인 야투와 수비로 {team}의 중심을 잡았어요!',
  ],
  SIXTH_MAN_SPARK: [
    '[{league}] "벤치에 앉아있기엔 너무 뜨거운 손끝!" {team} 핵심 식스맨 {name}, 평균 {ppg}점 활력소 역할!',
    '[{league}] 2쿼터 흐름을 바꾸는 게임 체인저! {name}, 식스맨 롤에서 최고 {high}점 폭발하며 맹활약!',
    '[{league}] 주전 못지않은 존재감 뽐낸 {team} {name}, 제한된 출전 시간에도 알토란 같은 {ppg}점 기록!',
    '[{league}] 코트에 투입되는 순간 에너지 레벨 급상승! {name}, {team} 벤치 에이스로 팬들의 사랑 독차지!',
    '[{league}] 감독이 가장 신뢰하는 조커 카드 {name}, 평균 {ppg}점·{apg}도움으로 주전 도약 청신호!',
  ],
  TWO_WAY_SURVIVAL: [
    '[{league}] "단 1분의 콜업 기회도 허투루 쓰지 않았다" 투웨이 도전자 {name}, 평균 {ppg}점으로 생존 경쟁!',
    '[{league}] G리그와 1군을 오가는 강행군 속에서도 빛난 {name}! 최고 {high}점 터뜨리며 정식 계약 노크!',
    '[{league}] 배고픈 언더독의 반란! {team} 투웨이 계약 {name}, 궂은일 마다하지 않으며 코칭스태프 눈도장!',
    '[{league}] 치열한 로스터 생존 경쟁 한복판에 선 {name}, 평균 {ppg}점 기록하며 NBA 정식 계약 불씨 살렸어요!',
    '[{league}] "포기란 없다" {team} 콜업 명단에 이름 올린 {name}, 짧은 시간 속 강렬한 에너지 발산!',
  ],
  BENCH_GRIND: [
    '[{league}] 벤치 끝자리에서 시작된 땀방울… {team} {name}, 짧은 출전 시간 속에서도 최고 {high}점 가능성 증명!',
    '[{league}] 높은 리그 수비 벽 실감한 {name}, 평균 {ppg}점에 그쳤지만 체육관 불 끄며 절치부심 훈련 매진!',
    '[{league}] "기회는 준비된 자에게 온다" 가비지 타임에도 전력 질주한 {team} {name}, 다음 시즌 반등 예고!',
    '[{league}] 혹독한 프로의 세계 경험한 {name}, 제한된 기회 속에 기록한 평균 {ppg}점… 성장통 겪으며 단단해져요!',
    '[{league}] 벤치에서 전술 노트를 빼곡히 채운 {team} {name}, 묵묵한 웨이트와 슈팅 훈련으로 반격 준비!',
  ],
};

function formatTemplate(template: string, ctx: HeadlineContext): string {
  return template
    .replace(/\{league\}/g, ctx.leagueName)
    .replace(/\{team\}/g, ctx.teamShortName)
    .replace(/\{name\}/g, ctx.playerName)
    .replace(/\{ppg\}/g, ctx.ppg.toFixed(1))
    .replace(/\{rpg\}/g, ctx.rpg.toFixed(1))
    .replace(/\{apg\}/g, ctx.apg.toFixed(1))
    .replace(/\{spg\}/g, ctx.spg.toFixed(1))
    .replace(/\{bpg\}/g, ctx.bpg.toFixed(1))
    .replace(/\{high\}/g, String(ctx.singleGameHighPts));
}

export function generateSeasonHeadline(ctx: HeadlineContext): string {
  let pool: string[] = HEADLINE_TEMPLATES.STARTER_SOLID;

  if (ctx.isFarewellTour) {
    pool = HEADLINE_TEMPLATES.FAREWELL;
  } else if (ctx.wonChampionship && ctx.wonMvp) {
    pool = HEADLINE_TEMPLATES.CHAMPION_MVP;
  } else if (ctx.wonMvp) {
    pool = HEADLINE_TEMPLATES.MVP_ONLY;
  } else if (ctx.wonChampionship) {
    pool = HEADLINE_TEMPLATES.CHAMPION_ONLY;
  } else if (ctx.role.includes('투웨이')) {
    pool = HEADLINE_TEMPLATES.TWO_WAY_SURVIVAL;
  } else if (ctx.role.includes('가비지') || ctx.ppg < 6.0) {
    pool = HEADLINE_TEMPLATES.BENCH_GRIND;
  } else if (ctx.ppg >= 20.0) {
    pool = HEADLINE_TEMPLATES.SUPERSTAR_SCORER;
  } else if (ctx.apg >= 6.2) {
    pool = HEADLINE_TEMPLATES.PLAYMAKER_GUARD;
  } else if (ctx.rpg >= 8.5) {
    pool = HEADLINE_TEMPLATES.REBOUND_BIG;
  } else if (ctx.role.includes('식스맨') || ctx.role.includes('로테이션')) {
    pool = HEADLINE_TEMPLATES.SIXTH_MAN_SPARK;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return formatTemplate(chosen, ctx);
}

export function generateSeasonNarrativeLogs(ctx: HeadlineContext, farewellLogs: string[]): string[] {
  const logs: string[] = [];

  logs.push(
    `${ctx.teamName}에서 '${ctx.role}' 역할을 맡아 시즌을 출발했어요.`
  );

  if (ctx.singleGameHighPts >= 35) {
    logs.push(
      `손끝이 완전히 달아올랐던 날, 혼자서 무려 ${ctx.singleGameHighPts}득점을 폭격하며 경기장을 열광의 도가니로 만들었어요!`
    );
  } else if (ctx.singleGameHighPts >= 20) {
    logs.push(
      `시즌 베스트 경기에서 ${ctx.singleGameHighPts}득점을 몰아치며 코칭스태프와 팬들에게 강렬한 인상을 남겼어요!`
    );
  } else {
    logs.push(
      `단일 경기 최고 ${ctx.singleGameHighPts}득점을 기록하며 코트 위에서 묵묵히 자신의 몫을 해냈어요.`
    );
  }

  if (ctx.isFarewellTour && farewellLogs.length > 0) {
    const picked = farewellLogs[Math.floor(Math.random() * farewellLogs.length)];
    logs.push(`🌟 [은퇴 투어] ${picked}`);
  }

  if (ctx.allStarSelected) {
    logs.push(
      `⭐ 팬 투표와 감독 추천에 힘입어 ${ctx.leagueName} 올스타전에 당당히 선발되었어요!`
    );
  }

  if (ctx.wonMvp) {
    logs.push(
      `🏆 시즌 내내 압도적인 퍼포먼스를 선보이며 대망의 ${ctx.leagueName} 정규시즌 MVP 트로피를 들어 올렸어요!`
    );
  }

  if (ctx.wonChampionship) {
    logs.push(
      `💍 플레이오프 혈투 끝에 마침내 ${ctx.leagueName} 파이널 우승을 차지하며 챔피언 반지를 끼었어요!`
    );
  }

  return logs;
}
