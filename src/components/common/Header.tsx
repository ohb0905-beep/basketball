'use client';

import React, { useEffect } from 'react';
import { BookOpen, MessageSquare, Moon, RotateCcw, Sun } from 'lucide-react';
import { generateLeagueFallbackSvgDataUri } from '../../data/logoFallbacks';
import {
  ALL_INTERNATIONAL_TEAMS,
  ALL_TEAMS,
  GLEAGUE_TEAMS,
  NBA_TEAMS,
  NCAA_TEAMS,
} from '../../data/teams';
import { useTheme } from '../../hooks/useTheme';
import { useCareerStore } from '../../store/useCareerStore';

interface HeaderProps {
  onRequestResetModal?: () => void;
  onRequestSaveGuideModal?: () => void;
  onRequestFeedbackModal?: () => void;
  wide?: boolean;
}

const CLIENT_LOGO_CACHE_KEY = 'bench_to_mvp_logo_cache_v3';
const CLIENT_LOGO_CACHE_TTL = 60 * 60 * 1000;

export function Header({
  onRequestResetModal,
  onRequestSaveGuideModal,
  onRequestFeedbackModal,
  wide = false,
}: HeaderProps = {}) {
  // 스토어 전체를 구독하면 커리어가 바뀔 때마다 헤더가 다시 그려지므로 필요한 값만 고릅니다.
  const view = useCareerStore((s) => s.view);
  const hasCareer = useCareerStore((s) => s.career !== null);
  const isRetired = useCareerStore((s) => Boolean(s.career?.retirementReason));
  const setView = useCareerStore((s) => s.setView);
  const resetActiveCareer = useCareerStore((s) => s.resetActiveCareer);
  const setEspnLogos = useCareerStore((s) => s.setEspnLogos);
  const { theme, mounted, toggleTheme } = useTheme();

  useEffect(() => {
    const baseLogos: Record<string, string> = {};
    for (const t of [...ALL_TEAMS, ...ALL_INTERNATIONAL_TEAMS]) {
      const svgFallback = generateLeagueFallbackSvgDataUri(t);
      baseLogos[`FALLBACK_${t.id}`] = svgFallback;
      baseLogos[t.id] = t.logoUrl || svgFallback;
    }
    baseLogos.KOR_NAT_TEAM = '/logos/NAT_KOR.svg';
    baseLogos.FALLBACK_KOR_NAT_TEAM = generateLeagueFallbackSvgDataUri({
      id: 'KOR_NAT_TEAM',
      name: '대한민국 남자농구 국가대표팀',
      shortName: '대한민국',
      city: '서울',
      league: 'KBL',
      rating: 78,
      primaryColor: '#0047A0',
      secondaryColor: '#CD2E3A',
      prestigeDesc: '',
    });
    for (const t of NBA_TEAMS) {
      if (t.espnAbbr) {
        const url = `https://a.espncdn.com/i/teamlogos/nba/500/${t.espnAbbr.toLowerCase()}.png`;
        baseLogos[t.id] = url;
        if (t.espnId) baseLogos[`ESPN_NBA_${t.espnId}`] = url;
      }
    }
    for (const t of NCAA_TEAMS) {
      if (t.espnId) {
        const url = `https://a.espncdn.com/i/teamlogos/ncaa/500/${t.espnId}.png`;
        baseLogos[t.id] = url;
        baseLogos[`ESPN_NCAA_${t.espnId}`] = url;
      }
    }
    for (const t of GLEAGUE_TEAMS) {
      if (t.espnAbbr) {
        const url = `https://a.espncdn.com/i/teamlogos/nba-development/500/${t.espnAbbr.toLowerCase()}.png`;
        baseLogos[t.id] = url;
        if (t.espnId) baseLogos[`ESPN_GLEAGUE_${t.espnId}`] = url;
      }
    }

    try {
      const rawCache = window.localStorage.getItem(CLIENT_LOGO_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (
          parsed &&
          typeof parsed.timestamp === 'number' &&
          Date.now() - parsed.timestamp < CLIENT_LOGO_CACHE_TTL &&
          parsed.logos
        ) {
          setEspnLogos({ ...baseLogos, ...parsed.logos });
        } else {
          setEspnLogos(baseLogos);
        }
      } else {
        setEspnLogos(baseLogos);
      }
    } catch {
      setEspnLogos(baseLogos);
    }

    fetch('/api/league-sync')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.logos) {
          const merged: Record<string, string> = { ...baseLogos, ...data.logos };
          if (data.fallbacks) {
            for (const [id, fb] of Object.entries(data.fallbacks)) {
              merged[`FALLBACK_${id}`] = String(fb);
            }
          }
          for (const t of NCAA_TEAMS) {
            if (t.espnId && data.logos[`ESPN_NCAA_${t.espnId}`]) {
              merged[t.id] = data.logos[`ESPN_NCAA_${t.espnId}`];
            }
          }
          for (const t of NBA_TEAMS) {
            if (t.espnId && data.logos[`ESPN_NBA_${t.espnId}`]) {
              merged[t.id] = data.logos[`ESPN_NBA_${t.espnId}`];
            }
          }
          for (const t of GLEAGUE_TEAMS) {
            if (t.espnId && data.logos[`ESPN_GLEAGUE_${t.espnId}`]) {
              merged[t.id] = data.logos[`ESPN_GLEAGUE_${t.espnId}`];
            }
          }
          setEspnLogos(merged);
          try {
            window.localStorage.setItem(
              CLIENT_LOGO_CACHE_KEY,
              JSON.stringify({ timestamp: Date.now(), logos: merged })
            );
          } catch {
            // ignore storage quota errors
          }
        }
      })
      .catch(() => {
        // fallback already loaded
      });
  }, [setEspnLogos]);

  return (
    <header className="sticky top-0 z-40 bg-[var(--t-bg)]/90 backdrop-blur-md pt-safe">
      <div
        className={`mx-auto px-4 h-[52px] flex items-center justify-between gap-2 transition-[max-width] duration-200 ${
          wide ? 'max-w-[760px]' : 'max-w-[560px]'
        }`}
      >
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="min-h-[44px] flex items-center text-left cursor-pointer min-w-0 t-tap"
        >
          <span className="font-bold tracking-[-0.03em] text-[17px] text-[var(--t-g900)] whitespace-nowrap truncate">
            로드 투 MVP
          </span>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          {hasCareer && view !== 'DASHBOARD' && !isRetired && (
            <button
              type="button"
              onClick={() => setView('DASHBOARD')}
              className="min-h-[40px] px-3 rounded-xl bg-[var(--t-accent-soft)] text-[var(--t-accent-ink)] text-[13px] font-semibold whitespace-nowrap cursor-pointer t-tap"
            >
              이어하기
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--t-g600)] hover:bg-[var(--t-g200)]/60 cursor-pointer t-tap"
            aria-label={theme === 'dark' ? '라이트 모드 전환' : '다크 모드 전환'}
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>

          {onRequestSaveGuideModal && (
            <button
              type="button"
              data-testid="open-save-guide-btn"
              onClick={onRequestSaveGuideModal}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--t-g600)] hover:bg-[var(--t-g200)]/60 cursor-pointer t-tap"
              title="저장 및 가이드"
              aria-label="저장 및 가이드"
            >
              <BookOpen className="w-[18px] h-[18px]" />
            </button>
          )}

          {onRequestFeedbackModal && (
            <button
              type="button"
              data-testid="open-feedback-btn"
              onClick={onRequestFeedbackModal}
              className="min-h-[44px] min-w-[44px] sm:px-2.5 flex items-center justify-center gap-1.5 rounded-xl text-[var(--t-g600)] hover:bg-[var(--t-g200)]/60 cursor-pointer t-tap shrink-0"
              title="피드백"
              aria-label="피드백"
            >
              <MessageSquare className="w-[18px] h-[18px] shrink-0" />
              <span className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap">
                피드백
              </span>
            </button>
          )}

          {hasCareer && (
            <button
              type="button"
              data-testid="header-reset-career-btn"
              onClick={() => {
                if (onRequestResetModal) {
                  onRequestResetModal();
                } else {
                  resetActiveCareer();
                }
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--t-g600)] hover:text-[var(--t-up)] hover:bg-[var(--t-g200)]/60 cursor-pointer t-tap"
              title="새 커리어"
              aria-label="새 커리어"
            >
              <RotateCcw className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
