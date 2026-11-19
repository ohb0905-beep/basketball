'use client';

import React, { useEffect } from 'react';
import { Award, Home, RotateCcw, Trophy } from 'lucide-react';
import { generateLeagueFallbackSvgDataUri } from '../../data/logoFallbacks';
import {
  ALL_TEAMS,
  ASIAN_NATIONAL_TEAMS,
  GLEAGUE_TEAMS,
  NBA_TEAMS,
  NCAA_TEAMS,
} from '../../data/teams';
import { useCareerStore } from '../../store/useCareerStore';

interface HeaderProps {
  onRequestResetModal?: () => void;
}

const CLIENT_LOGO_CACHE_KEY = 'bench_to_mvp_logo_cache_v2';
const CLIENT_LOGO_CACHE_TTL = 60 * 60 * 1000; // 1시간

export function Header({ onRequestResetModal }: HeaderProps = {}) {
  const {
    view,
    career,
    hofList,
    setView,
    resetActiveCareer,
    setEspnLogos,
  } = useCareerStore();

  useEffect(() => {
    const baseLogos: Record<string, string> = {};
    for (const t of [...ALL_TEAMS, ...ASIAN_NATIONAL_TEAMS]) {
      const svgFallback = generateLeagueFallbackSvgDataUri(t);
      baseLogos[`FALLBACK_${t.id}`] = svgFallback;
      baseLogos[t.id] = t.logoUrl || svgFallback;
    }
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
            // 스토리지 용량 초과 시 무시
          }
        }
      })
      .catch(() => {
        // 네트워크 차단 시 사전 생성된 공식 URL 및 리그별 SVG 이니셜 폴백 유지
      });
  }, [setEspnLogos]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <button
          onClick={() => setView('HOME')}
          className="flex items-center gap-2 text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center shadow-2xs group-hover:bg-orange-700 transition-colors">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-tight text-sm sm:text-base text-slate-900">
                벤치에서 MVP까지
              </span>
              <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">
                PRO
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          {hofList.length > 0 && (
            <button
              onClick={() => setView('HOME')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-800 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>전당 ({hofList.length})</span>
            </button>
          )}

          {career && view !== 'DASHBOARD' && !career.retirementReason && (
            <button
              onClick={() => setView('DASHBOARD')}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              복귀 ({career.name})
            </button>
          )}

          {view !== 'HOME' && (
            <button
              onClick={() => setView('HOME')}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="홈 화면"
            >
              <Home className="w-4 h-4" />
            </button>
          )}

          {career && (
            <button
              onClick={() => {
                if (onRequestResetModal) {
                  onRequestResetModal();
                } else {
                  resetActiveCareer();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors cursor-pointer"
              title="새 선수 키우기"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새 커리어</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
