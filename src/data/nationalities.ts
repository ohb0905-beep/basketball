import type { CareerState, NationalityCode } from '../types/game';

/**
 * 1.2.0: 선수 국적 목록
 * - 1차에서는 대한민국 국적만 병역(상무), 국가대표, 태극마크 아크, KBL 드래프트 대상입니다.
 * - 다른 국적은 국가대표 없이 커리어를 진행하고, KBL은 외국인 선수로 FA 영입만 됩니다.
 */
export interface NationalityInfo {
  code: NationalityCode;
  name: string;
  flag: string;
}

export const DEFAULT_NATIONALITY: NationalityCode = 'KOR';

export const NATIONALITIES: NationalityInfo[] = [
  { code: 'KOR', name: '대한민국', flag: '🇰🇷' },
  { code: 'USA', name: '미국', flag: '🇺🇸' },
  { code: 'CAN', name: '캐나다', flag: '🇨🇦' },
  { code: 'JPN', name: '일본', flag: '🇯🇵' },
  { code: 'CHN', name: '중국', flag: '🇨🇳' },
  { code: 'PHI', name: '필리핀', flag: '🇵🇭' },
  { code: 'AUS', name: '호주', flag: '🇦🇺' },
  { code: 'NZL', name: '뉴질랜드', flag: '🇳🇿' },
  { code: 'FRA', name: '프랑스', flag: '🇫🇷' },
  { code: 'ESP', name: '스페인', flag: '🇪🇸' },
  { code: 'SRB', name: '세르비아', flag: '🇷🇸' },
  { code: 'GRE', name: '그리스', flag: '🇬🇷' },
  { code: 'LTU', name: '리투아니아', flag: '🇱🇹' },
  { code: 'GER', name: '독일', flag: '🇩🇪' },
  { code: 'SLO', name: '슬로베니아', flag: '🇸🇮' },
  { code: 'TUR', name: '튀르키예', flag: '🇹🇷' },
  { code: 'ITA', name: '이탈리아', flag: '🇮🇹' },
  { code: 'CRO', name: '크로아티아', flag: '🇭🇷' },
  { code: 'ARG', name: '아르헨티나', flag: '🇦🇷' },
  { code: 'BRA', name: '브라질', flag: '🇧🇷' },
  { code: 'NGA', name: '나이지리아', flag: '🇳🇬' },
  { code: 'CMR', name: '카메룬', flag: '🇨🇲' },
  { code: 'SEN', name: '세네갈', flag: '🇸🇳' },
  { code: 'DOM', name: '도미니카공화국', flag: '🇩🇴' },
  { code: 'PUR', name: '푸에르토리코', flag: '🇵🇷' },
];

const NATIONALITY_CODES = new Set<string>(NATIONALITIES.map((n) => n.code));

export function isNationalityCode(value: unknown): value is NationalityCode {
  return typeof value === 'string' && NATIONALITY_CODES.has(value);
}

export function getNationalityInfo(code: NationalityCode | null | undefined): NationalityInfo {
  return NATIONALITIES.find((n) => n.code === code) || NATIONALITIES[0];
}

/** 국적 필드가 없는 예전 세이브·테스트 상태는 대한민국으로 봅니다. */
export function getCareerNationality(career: Pick<CareerState, 'nationality'> | null | undefined): NationalityCode {
  return isNationalityCode(career?.nationality) ? career.nationality : DEFAULT_NATIONALITY;
}

/** 병역·국가대표·태극마크·KBL 드래프트처럼 대한민국 국적에만 해당하는 시스템을 켤지 여부 */
export function isKoreanNational(career: Pick<CareerState, 'nationality'> | null | undefined): boolean {
  return getCareerNationality(career) === 'KOR';
}
