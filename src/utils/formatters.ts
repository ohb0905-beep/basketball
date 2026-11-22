import { MILITARY_SERVICE_CONFIG } from '../config/balanceConfig';
import { CareerState } from '../types/game';

/**
 * 달러 금액 축약 포맷 (예: $12.5M, $450K, $800)
 */
export function formatCurrencyCompact(amountUsd?: number | null): string {
  if (!amountUsd || amountUsd <= 0) return '$0';
  if (amountUsd >= 1_000_000) {
    return `$${(amountUsd / 1_000_000).toFixed(1)}M`;
  }
  if (amountUsd >= 1_000) {
    return `$${Math.round(amountUsd / 1_000).toLocaleString()}K`;
  }
  return `$${Math.round(amountUsd).toLocaleString()}`;
}

/**
 * 달러 금액 정밀 포맷 (계약·자산·캠프 비용 표시용, 예: $12.50M, $450K)
 */
export function formatCurrencyDetailed(amountUsd?: number | null): string {
  if (!amountUsd || amountUsd <= 0) return '$0';
  if (amountUsd >= 1_000_000) {
    return `$${(amountUsd / 1_000_000).toFixed(2)}M`;
  }
  if (amountUsd >= 1_000) {
    return `$${Math.round(amountUsd / 1_000).toLocaleString()}K`;
  }
  return `$${Math.round(amountUsd).toLocaleString()}`;
}

/**
 * 증감 금액 포맷 (예: +$250K, -$1.20M)
 */
export function formatCashDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '-';
  const abs = Math.abs(delta);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString()}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

/**
 * 오프시즌 연봉/계약 오퍼 포맷
 */
export function formatSalaryOffer(
  amountUsd?: number,
  years?: number,
  options?: { isExistingContract?: boolean }
): string {
  const isExisting = Boolean(options?.isExistingContract);
  if (!amountUsd || amountUsd <= 0) {
    if (years && years > 0) {
      return isExisting ? `재학 · 잔여 ${years}년` : `아마추어 · ${years}년`;
    }
    return '비계약 진로';
  }
  if (isExisting) {
    const yearSuffix = years && years > 0 ? ` · 잔여 ${years}년` : '';
    return `기존 계약 ${formatCurrencyDetailed(amountUsd)}${yearSuffix}`;
  }
  const yearSuffix = years && years > 0 ? ` · ${years}년` : '';
  return `${formatCurrencyDetailed(amountUsd)}${yearSuffix}`;
}

/**
 * 상단 선수 헤더용 연봉 · 잔여 계약 요약 포맷
 */
export function formatHeaderContractSummary(career: CareerState): string {
  if (career.militaryServiceSeasonsLeft > 0) {
    return `상무 · 잔여 ${career.militaryServiceSeasonsLeft}년`;
  }
  if (career.league === 'HIGH_SCHOOL') {
    if (career.contractYearsLeft <= 0) return '고교 졸업';
    const grade = Math.min(3, Math.max(1, 4 - career.contractYearsLeft));
    return `학생 · 고${grade}`;
  }
  if (career.league === 'U_LEAGUE' || career.league === 'NCAA') {
    if (career.contractYearsLeft <= 0) return '대학 졸업';
    const grade = Math.min(4, Math.max(1, 5 - career.contractYearsLeft));
    return `학생 · ${grade}학년`;
  }
  if (career.contractYearsLeft <= 0 || career.contractType === 'FREE_AGENT') {
    return 'FA 만료';
  }
  const sal =
    career.annualSalary > 0
      ? formatCurrencyCompact(career.annualSalary)
      : '계약';
  return `${sal} · 잔여 ${career.contractYearsLeft}년`;
}

/**
 * 구 세이브 데이터 하위 호환용: 문자열 선두 이모지/기호 제거
 */
export function stripLeadingEmoji(text: string): string {
  return text.replace(/^[^\p{L}\p{N}#"'(\[]+/u, '').trim();
}

/**
 * 시즌 탭 하단 플로팅 CTA 도크 표시 여부 (패딩·렌더링 단일 기준)
 */
export function hasSeasonBottomDock(career: CareerState | null): boolean {
  if (!career) return false;
  if (!career.offseasonLocked && career.seasonPhase === 'REGULAR_SEASON') {
    return true;
  }
  if (
    career.seasonPhase === 'POSTSEASON_BRACKET' &&
    Boolean(career.playoffBracket)
  ) {
    return true;
  }
  return false;
}

export interface MilitaryStatusDisplay {
  status: 'EXEMPTED' | 'COMPLETED' | 'SERVING' | 'UNFULFILLED';
  label: string;
  tone: 'ok' | 'accent' | 'gold' | 'muted';
}

/**
 * 선수 현재 병역 상태 요약 (헤더·프로필 단일 기준)
 */
export function getMilitaryStatusDisplay(
  career: Pick<
    CareerState,
    | 'militaryExempt'
    | 'militaryServiceSeasonsLeft'
    | 'league'
    | 'age'
    | 'internationalHistory'
    | 'milestones'
  >
): MilitaryStatusDisplay {
  if (career.militaryServiceSeasonsLeft > 0) {
    return {
      status: 'SERVING',
      label: `상무 복무 (${career.militaryServiceSeasonsLeft}시즌)`,
      tone: 'accent',
    };
  }
  if (career.militaryExempt) {
    const earnedByIntl = (career.internationalHistory || []).some(
      (rec) => rec.grantedMilitaryExemption
    );
    const dischargedFromSangmu = (career.milestones || []).some(
      (m) => m.id.startsWith('MS_DISCHARGE_') || m.title.includes('만기 전역')
    );
    if (earnedByIntl && !dischargedFromSangmu) {
      return {
        status: 'EXEMPTED',
        label: '병역특례',
        tone: 'ok',
      };
    }
    return {
      status: 'COMPLETED',
      label: dischargedFromSangmu ? '병역필' : '병역면제',
      tone: 'ok',
    };
  }
  const enlistAge =
    career.league === 'NBA'
      ? MILITARY_SERVICE_CONFIG.nbaDeferredEnlistAge
      : MILITARY_SERVICE_CONFIG.defaultEnlistAge;
  const yearsLeft = enlistAge - career.age;
  return {
    status: 'UNFULFILLED',
    label:
      career.league === 'NBA'
        ? `미필 (만 ${enlistAge}세)`
        : `미필 (만 ${enlistAge}세)`,
    tone: yearsLeft <= 2 ? 'gold' : 'muted',
  };
}

