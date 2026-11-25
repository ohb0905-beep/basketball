'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import {
  getHeightModifiers,
  POSITION_ARCHETYPES,
  POSITION_HEIGHT_RANGES,
  POSITION_LABELS,
} from '../../data/archetypes';
import { HIGH_SCHOOL_TEAMS, US_HIGH_SCHOOL_TEAMS } from '../../data/teams';
import {
  DEFAULT_NATIONALITY,
  getNationalityInfo,
  NATIONALITIES,
} from '../../data/nationalities';
import {
  calculateBiomechanicalProfile,
  getBiomechanicalGrowthElasticity,
  getPreviewStatsAndOvrRange,
} from '../../engine/statCalculator';
import { useCareerStore } from '../../store/useCareerStore';
import { BiomechanicalProfile, NationalityCode, Position } from '../../types/game';
import { SelectionCheckCircle } from '../common/Modal';
import { TeamEmblem } from '../common/TeamEmblem';

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/** 1.2.0: 입학할 고교의 나라 */
type SchoolCountry = 'KR' | 'US';
const SCHOOL_COUNTRY_TABS: { id: SchoolCountry; label: string; flag: string }[] = [
  { id: 'KR', label: '한국 고교', flag: '🇰🇷' },
  { id: 'US', label: '미국 고교', flag: '🇺🇸' },
];

function getSchoolsByCountry(country: SchoolCountry) {
  return country === 'US' ? US_HIGH_SCHOOL_TEAMS : HIGH_SCHOOL_TEAMS;
}

export function getScoutingBalanceBadges(bio: BiomechanicalProfile): {
  overallBadge: { text: string; toneClass: string };
  reachBadge: string;
  agilityBadge: string;
} {
  let overallBadge = {
    text: '포지션 최적 밸런스',
    toneClass: 'text-[var(--t-ok)]',
  };
  if (bio.positionalPhysicsStrain >= 0.42) {
    overallBadge = {
      text: '신체 부하 높음 · 체력 소모 증가',
      toneClass: 'text-[var(--t-up)]',
    };
  } else if (bio.positionalPhysicsStrain >= 0.2) {
    overallBadge = {
      text: '특수 체격 · 장단점 뚜렷',
      toneClass: 'text-[var(--t-gold)]',
    };
  }

  const reachBadge =
    bio.reachLeverage >= 1.1
      ? '높은 타점 · 림 장악 우위'
      : bio.reachLeverage >= 0.85
      ? '안정적 타점 · 리바운드 균형'
      : '낮은 타점 · 외곽 돌파 유리';

  const agilityBadge =
    bio.centerOfGravityAgility >= 1.05
      ? '최상급 민첩성 · 안정적 핸들링'
      : bio.centerOfGravityAgility >= 0.85
      ? '준수한 기동력 · 방향 전환'
      : '높은 무게중심 · 드리블 주의';

  return { overallBadge, reachBadge, agilityBadge };
}

export function PlayerCreator() {
  const startNewCareer = useCareerStore((s) => s.startNewCareer);
  const setView = useCareerStore((s) => s.setView);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [primaryPos, setPrimaryPos] = useState<Position>('PG');
  const [heightCm, setHeightCm] = useState<number>(186);
  const [highSchoolTeamId, setHighSchoolTeamId] = useState<string>(
    HIGH_SCHOOL_TEAMS[0].id
  );
  const [schoolQuery, setSchoolQuery] = useState('');
  const [nationality, setNationality] = useState<NationalityCode>(DEFAULT_NATIONALITY);
  const [schoolCountry, setSchoolCountry] = useState<SchoolCountry>('KR');
  const isKorean = nationality === 'KOR';
  const schoolList = getSchoolsByCountry(schoolCountry);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentArch = POSITION_ARCHETYPES[primaryPos];
  const heightRange = POSITION_HEIGHT_RANGES[primaryPos];
  const { baselineStats, minOvr, maxOvr } = getPreviewStatsAndOvrRange(
    primaryPos,
    heightCm
  );
  const heightMod = getHeightModifiers(heightCm);
  const bioProfile = calculateBiomechanicalProfile(heightCm, primaryPos);
  const elasticityMap = getBiomechanicalGrowthElasticity(
    heightCm,
    primaryPos,
    baselineStats
  );
  const { overallBadge, reachBadge, agilityBadge } =
    getScoutingBalanceBadges(bioProfile);

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schoolList;
    return schoolList.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q)
    );
  }, [schoolQuery, schoolList]);

  const handleSchoolCountryChange = (country: SchoolCountry) => {
    if (country === schoolCountry) return;
    setSchoolCountry(country);
    setSchoolQuery('');
    setHighSchoolTeamId(getSchoolsByCountry(country)[0].id);
  };

  const handlePosChange = (pos: Position) => {
    setPrimaryPos(pos);
    setHeightCm(POSITION_ARCHETYPES[pos].defaultHeightCm);
  };

  const handleBack = () => {
    if (step === 1) {
      setView('HOME');
    } else {
      setStep((s) => (s === 3 ? 2 : 1));
    }
  };

  const handleNextOrSubmit = () => {
    if (step === 1) {
      const trimmed = name.trim();
      if (!trimmed) {
        setErrorMsg('선수 이름을 입력해 주세요.');
        return;
      }
      setErrorMsg(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setStep(1);
      setErrorMsg('선수 이름을 입력해 주세요.');
      return;
    }

    startNewCareer({
      name: trimmed,
      jerseyNumber: jerseyNumber.trim(),
      heightCm,
      primaryPos,
      highSchoolTeamId,
      nationality,
    });
  };

  const selectedSchool =
    schoolList.find((t) => t.id === highSchoolTeamId) || schoolList[0];
  const nationalityInfo = getNationalityInfo(nationality);

  return (
    <div className="max-w-[560px] mx-auto px-4 pt-2 pb-28 space-y-4">
      {/* 상단 스텝 내비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="min-h-[44px] -ml-2 px-2.5 inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--t-g600)] hover:text-[var(--t-g900)] cursor-pointer t-tap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step === 1 ? '홈' : '이전'}</span>
        </button>

        <div className="flex items-center gap-1.5" aria-label={`3단계 중 ${step}단계`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                n === step
                  ? 'w-6 bg-[var(--t-accent)]'
                  : n < step
                  ? 'w-2 bg-[var(--t-accent)]/40'
                  : 'w-2 bg-[var(--t-g200)]'
              }`}
            />
          ))}
        </div>

        <span className="text-[13px] font-semibold text-[var(--t-g500)] tabular-nums">
          {step} / 3
        </span>
      </div>

      {/* STEP 1: 기본 프로필 */}
      {step === 1 && (
        <section className="t-card space-y-6">
          <div className="space-y-1">
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--t-g900)] leading-snug text-balance">
              선수 프로필 입력
            </h1>
            <p className="text-[14px] text-[var(--t-g600)]">
              만 16세 고교 신입생으로 커리어를 시작합니다. 국적은 자유롭게 고를 수 있습니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="player-name-input"
                className="block text-[13px] font-semibold text-[var(--t-g600)]"
              >
                이름
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={16}
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNextOrSubmit();
                  }
                }}
                placeholder="예: 강백호"
                className="w-full h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] text-[17px] font-bold text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]"
              />
              {errorMsg && (
                <p className="text-[13px] font-semibold text-[var(--t-up)]">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="jersey-number-input"
                className="block text-[13px] font-semibold text-[var(--t-g600)]"
              >
                등번호 <span className="text-[var(--t-g400)] font-normal">(비워두면 자동 배정)</span>
              </label>
              <input
                id="jersey-number-input"
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={jerseyNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  setJerseyNumber(digits);
                }}
                placeholder="0 ~ 99"
                className="w-full h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] text-[17px] font-bold text-[var(--t-g900)] placeholder:text-[var(--t-g400)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="nationality-select"
                className="block text-[13px] font-semibold text-[var(--t-g600)]"
              >
                국적
              </label>
              <select
                id="nationality-select"
                data-testid="nationality-select"
                value={nationality}
                onChange={(e) => setNationality(e.target.value as NationalityCode)}
                className="w-full h-[54px] px-4 rounded-2xl bg-[var(--t-g100)] text-[17px] font-bold text-[var(--t-g900)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)] cursor-pointer"
              >
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.flag} {n.name}
                  </option>
                ))}
              </select>
              <p
                data-testid="nationality-note"
                className="text-[12px] text-[var(--t-g500)] leading-relaxed"
              >
                {isKorean
                  ? '병역(상무), 국가대표 소집, KBL 드래프트가 모두 적용됩니다.'
                  : `${nationalityInfo.name} 국적은 병역과 국가대표 소집이 없고, KBL은 드래프트 없이 외국인 선수 계약으로만 입단할 수 있습니다.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: 포지션 & 체격 */}
      {step === 2 && (
        <div className="space-y-3">
          <section className="t-card space-y-5">
            <div className="space-y-1">
              <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
                포지션 · 신장 설정
              </h1>
              <p className="text-[13px] text-[var(--t-g600)]">
                {currentArch.title} · 권장 {heightRange.optimalMin}~{heightRange.optimalMax}cm
              </p>
            </div>

            {/* 5포지션 세그먼트 */}
            <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-[var(--t-g100)]">
              {POSITIONS.map((pos) => {
                const isSelected = primaryPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handlePosChange(pos)}
                    className={`min-h-[48px] rounded-xl text-center transition cursor-pointer t-tap ${
                      isSelected
                        ? 'bg-[var(--t-card)] text-[var(--t-accent)] font-bold shadow-2xs'
                        : 'text-[var(--t-g600)] font-semibold'
                    }`}
                  >
                    <span className="block text-[14px]">{pos}</span>
                    <span className="block text-[10px] text-[var(--t-g500)] truncate px-0.5">
                      {POSITION_LABELS[pos].split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 신장 슬라이더 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="height-slider"
                  className="text-[14px] font-semibold text-[var(--t-g600)]"
                >
                  신장
                </label>
                <div className="text-right tabular-nums">
                  <span className="text-[26px] font-bold text-[var(--t-g900)]">
                    {heightCm}
                  </span>
                  <span className="text-[14px] font-semibold text-[var(--t-g500)] ml-0.5">
                    cm
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--t-accent-ink)] ml-2">
                    {heightMod.label}
                  </span>
                </div>
              </div>

              <input
                id="height-slider"
                type="range"
                min={168}
                max={222}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="t-range"
              />

              <div className="flex justify-between text-[11px] text-[var(--t-g400)] tabular-nums">
                <span>168cm</span>
                <span className={overallBadge.toneClass}>{overallBadge.text}</span>
                <span>222cm</span>
              </div>

              <div className="pt-3 border-t border-[var(--t-g100)] divide-y divide-[var(--t-g100)] text-[13px]">
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-[var(--t-g500)]">타점 · 보드</span>
                  <span className="font-semibold text-[var(--t-g800)]">{reachBadge}</span>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-[var(--t-g500)]">기동 · 핸들링</span>
                  <span className="font-semibold text-[var(--t-g800)]">{agilityBadge}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 예상 초기 능력치 슬림 바 */}
          <section className="t-card space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-[var(--t-g900)]">
                예상 초기 능력치
              </span>
              <span
                data-testid="expected-ovr-range"
                className="text-[17px] font-bold text-[var(--t-accent)] tabular-nums"
              >
                OVR {minOvr} ~ {maxOvr}
              </span>
            </div>

            <div className="space-y-2.5">
              {(
                [
                  { key: 'ins', label: '골밑', val: baselineStats.ins },
                  { key: 'out', label: '외곽', val: baselineStats.out },
                  { key: 'ply', label: '패스', val: baselineStats.ply },
                  { key: 'def', label: '수비', val: baselineStats.def },
                  { key: 'reb', label: '리바운드', val: baselineStats.reb },
                  { key: 'phy', label: '피지컬', val: baselineStats.phy },
                ] as const
              ).map((item) => {
                const elasticity = elasticityMap[item.key] ?? 1;
                const isNearCap = elasticity < 0.78;
                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-[58px_1fr_52px] items-center gap-3 text-[13px]"
                  >
                    <span className="font-semibold text-[var(--t-g600)]">
                      {item.label}
                    </span>
                    <div className="h-[6px] rounded-full bg-[var(--t-g100)] overflow-hidden">
                      <div
                        style={{ width: `${item.val}%` }}
                        className="h-full rounded-full bg-[var(--t-accent)] transition-all duration-200"
                      />
                    </div>
                    <span
                      className={`text-right font-bold tabular-nums ${
                        isNearCap ? 'text-[var(--t-gold)]' : 'text-[var(--t-g900)]'
                      }`}
                    >
                      {item.val}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* STEP 3: 입학 고교 선택 */}
      {step === 3 && (
        <section className="t-card space-y-4">
          <div className="space-y-1">
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--t-g900)] text-balance">
              입학 고교 선택
            </h1>
            <p className="text-[13px] text-[var(--t-g600)] tabular-nums">
              {jerseyNumber ? `#${jerseyNumber} ` : ''}
              {name} · {nationalityInfo.flag} {nationalityInfo.name} · {primaryPos} · {heightCm}cm
            </p>
          </div>

          <div
            role="tablist"
            aria-label="고교 나라 선택"
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--t-g100)]"
          >
            {SCHOOL_COUNTRY_TABS.map((tab) => {
              const active = schoolCountry === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`school-country-${tab.id}`}
                  onClick={() => handleSchoolCountryChange(tab.id)}
                  className={`min-h-[44px] rounded-xl text-[14px] font-bold cursor-pointer t-tap ${
                    active
                      ? 'bg-[var(--t-card)] text-[var(--t-g900)] shadow-sm'
                      : 'text-[var(--t-g500)]'
                  }`}
                >
                  <span aria-hidden="true">{tab.flag}</span> {tab.label}
                </button>
              );
            })}
          </div>

          <p className="text-[12px] text-[var(--t-g500)] leading-relaxed">
            {schoolCountry === 'US'
              ? `졸업하면 NCAA 장학금 제안을 받을 수 있습니다.${
                  isKorean ? ' 한국 대학(U-리그)과 KBL 얼리 드래프트도 선택할 수 있습니다.' : ''
                }`
              : `졸업하면 한국 대학(U-리그)으로 진학하거나, 실력이 뛰어나면 NCAA와 프로 직행 제안을 받을 수 있습니다.${
                  isKorean ? ' KBL 얼리 드래프트에도 도전할 수 있습니다.' : ''
                }`}
          </p>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--t-g400)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={schoolQuery}
              onChange={(e) => setSchoolQuery(e.target.value)}
              placeholder="학교명 또는 지역 검색"
              className="w-full h-[44px] pl-10 pr-4 rounded-xl bg-[var(--t-g100)] text-[14px] text-[var(--t-g900)] placeholder:text-[var(--t-g400)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]"
            />
          </div>

          <div className="divide-y divide-[var(--t-g100)] max-h-[380px] overflow-y-auto -mx-2">
            {filteredSchools.map((team) => {
              const selected = highSchoolTeamId === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setHighSchoolTeamId(team.id)}
                  className={`w-full min-h-[60px] px-2.5 py-2.5 rounded-2xl text-left flex items-center gap-3 cursor-pointer t-tap ${
                    selected ? 'bg-[var(--t-accent-soft)]' : 'hover:bg-[var(--t-g50)]'
                  }`}
                >
                  <TeamEmblem team={team} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-[var(--t-g900)] truncate">
                      {team.name}
                    </span>
                    <span className="block text-[12px] text-[var(--t-g500)] tabular-nums">
                      {team.city} · 전력 {team.rating}
                    </span>
                  </div>
                  <SelectionCheckCircle selected={selected} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 하단 고정 CTA 도크 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 pt-4 px-4 pb-safe"
        style={{
          background:
            'linear-gradient(to top, var(--t-dock-fade) 72%, transparent)',
        }}
      >
        <div className="max-w-[528px] mx-auto">
          <button
            type="button"
            onClick={handleNextOrSubmit}
            className="t-cta"
          >
            {step < 3
              ? '다음'
              : `${selectedSchool.shortName} 입학하기`}
          </button>
        </div>
      </div>
    </div>
  );
}
