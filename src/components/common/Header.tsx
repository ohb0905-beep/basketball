'use client';

import React, { useEffect } from 'react';
import { UserPlus, PlayCircle, RotateCcw } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';

interface HeaderProps {
  onRequestResetModal: () => void;
}

export function Header({ onRequestResetModal }: HeaderProps) {
  const view = useCareerStore((s) => s.view);
  const career = useCareerStore((s) => s.career);
  const hofList = useCareerStore((s) => s.hofList);
  const setView = useCareerStore((s) => s.setView);
  const setEspnLogos = useCareerStore((s) => s.setEspnLogos);
  const espnApiConnected = useCareerStore((s) => s.espnApiConnected);

  // 앱 실행 시 서버 API 라우트를 통해 ESPN 공식 Public API에서 NBA 및 NCAA 로고 동기화 (CORS 방지)
  useEffect(() => {
    if (espnApiConnected) return;
    let cancelled = false;

    async function syncEspnLogos() {
      try {
        const res = await fetch('/api/espn-logos');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.logos && Object.keys(data.logos).length > 0) {
            setEspnLogos(data.logos);
          }
        }
      } catch {
        // 오프라인 폴백 처리
      }
    }

    syncEspnLogos();
    return () => {
      cancelled = true;
    };
  }, [espnApiConnected, setEspnLogos]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Title */}
        <button
          type="button"
          onClick={() => setView('HOME')}
          className="text-lg font-extrabold tracking-tight text-slate-900 hover:text-orange-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          벤치에서 MVP까지
        </button>

        {/* Zone 2: Concise Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setView('HOME')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'HOME' ? 'text-orange-600 font-semibold' : ''
            }`}
          >
            올타임 베스트 5 ({hofList.length}명 헌액)
          </button>

          {career && (
            <button
              type="button"
              onClick={() => setView('DASHBOARD')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'DASHBOARD' ? 'text-orange-600 font-semibold' : ''
              }`}
            >
              진행 중인 커리어 (#{career.jerseyNumber} {career.name})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (career) {
                onRequestResetModal();
              } else {
                setView('CREATE');
              }
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'CREATE' ? 'text-orange-600 font-semibold' : ''
            }`}
          >
            새 선수 육성
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {career ? (
            view === 'DASHBOARD' ? (
              <button
                type="button"
                onClick={onRequestResetModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                새 선수 만들기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView('DASHBOARD')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                커리어 이어하기
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setView('CREATE')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              선수 생성하기
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
