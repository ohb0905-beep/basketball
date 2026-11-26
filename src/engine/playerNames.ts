import { LeagueId } from '../types/game';

/**
 * 절차적(Procedural) 음절 조합 라이벌 이름 생성기 (실존 선수/만화 캐릭터 이름 0%)
 */
const KR_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황'];
const KR_SYLLABLE_A = ['도', '시', '주', '민', '서', '지', '건', '태', '승', '현', '재', '성', '우', '준', '연', '하'];
const KR_SYLLABLE_B = ['훈', '우', '원', '혁', '빈', '호', '영', '찬', '결', '율', '환', '진', '석', '규', '민', '성'];

const EN_FIRST_A = ['Mar', 'Jay', 'De', 'Ty', 'Tre', 'Ka', 'Zay', 'Bran', 'Co', 'Da', 'Ke', 'La', 'Sha', 'Mal', 'Quin'];
const EN_FIRST_B = ['cus', 'len', 'vin', 'rese', 'von', 'lik', 'den', 'don', 'by', 'rius', 'gan', 'elo', 'ed', 'colm', 'ton'];
const EN_LAST_A = ['Vaughn', 'Mercer', 'Calloway', 'Sterling', 'Hawkins', 'Thornton', 'Prescott', 'Langford', 'Kessler', 'Bates', 'Hollis', 'Granger', 'redick', 'Rowe', 'Sutton'];

export function generateProceduralPlayerName(
  league: LeagueId,
  rng: () => number = Math.random
): string {
  if (league === 'KBL' || league === 'HIGH_SCHOOL' || league === 'U_LEAGUE') {
    const s = KR_SURNAMES[Math.floor(rng() * KR_SURNAMES.length)];
    const a = KR_SYLLABLE_A[Math.floor(rng() * KR_SYLLABLE_A.length)];
    const b = KR_SYLLABLE_B[Math.floor(rng() * KR_SYLLABLE_B.length)];
    return `${s}${a}${b}`;
  }
  const f1 = EN_FIRST_A[Math.floor(rng() * EN_FIRST_A.length)];
  const f2 = EN_FIRST_B[Math.floor(rng() * EN_FIRST_B.length)];
  const l = EN_LAST_A[Math.floor(rng() * EN_LAST_A.length)];
  const capLast = l.charAt(0).toUpperCase() + l.slice(1);
  return `${f1}${f2} ${capLast}`;
}
