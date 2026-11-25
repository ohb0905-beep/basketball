'use client';

import React, { forwardRef } from 'react';
import {
  CAREER_CARD_HEIGHT,
  CAREER_CARD_SITE_LABEL,
  CAREER_CARD_WIDTH,
  type CareerCardData,
} from '../../lib/careerCard';

/**
 * 1.3.0 은퇴 커리어 공유 카드 (1080×1350 고정)
 * - 공유 이미지가 보는 사람의 테마와 상관없이 같도록 테마 변수 대신 고정 색을 씁니다.
 * - 이 노드를 그대로 PNG로 캡처하므로 크기를 바꾸지 말고, 미리보기 축소는 바깥 래퍼에서 합니다.
 */

const CARD_COLORS = {
  bg: '#101318',
  panel: '#1a1f27',
  line: '#2a313c',
  text: '#f5f6f8',
  sub: '#9aa3b2',
  gold: '#f5c451',
  accent: '#ff7a1a',
} as const;

const FONT_STACK =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';

export interface CareerShareCardProps {
  data: CareerCardData;
  logoSrcs: Record<string, string | null>;
  onLogoStatus: (teamId: string, ok: boolean) => void;
  /** 다시 시도할 때마다 올려서 로고 이미지를 새로 불러옵니다. */
  retryToken: number;
}

const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: CARD_COLORS.sub, marginTop: 14 }}>
        {label}
      </div>
    </div>
  );
}

export const CareerShareCard = forwardRef<HTMLDivElement, CareerShareCardProps>(
  function CareerShareCard({ data, logoSrcs, onLogoStatus, retryToken }, ref) {
    return (
      <div
        ref={ref}
        data-testid="career-share-card"
        style={{
          width: CAREER_CARD_WIDTH,
          height: CAREER_CARD_HEIGHT,
          background: CARD_COLORS.bg,
          color: CARD_COLORS.text,
          fontFamily: FONT_STACK,
          padding: '84px 80px 64px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 레거시 등급 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {data.legacyEmoji && (
            <span style={{ fontSize: 64, lineHeight: 1 }}>{data.legacyEmoji}</span>
          )}
          <span style={{ fontSize: 36, fontWeight: 700, color: CARD_COLORS.gold, ...ellipsis }}>
            {data.legacyTitle}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 30, fontWeight: 700, color: CARD_COLORS.sub }}>
            레거시 {data.legacyScore}
          </span>
        </div>

        {/* 이름·기본 정보 */}
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <span style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em', ...ellipsis }}>
            {data.playerName}
          </span>
          <span style={{ fontSize: 56, fontWeight: 700, color: CARD_COLORS.accent, flexShrink: 0 }}>
            #{data.jerseyNumber}
          </span>
        </div>
        <div style={{ marginTop: 16, fontSize: 32, fontWeight: 600, color: CARD_COLORS.sub }}>
          {data.positionLabel} · {data.heightCm}cm · {data.yearSpan} · {data.seasonsPlayed}시즌 ·{' '}
          {data.finalAge}세 은퇴
        </div>

        {/* 통산 평균 */}
        <div
          style={{
            marginTop: 56,
            padding: '44px 24px',
            borderRadius: 32,
            background: CARD_COLORS.panel,
            display: 'flex',
          }}
        >
          <StatBlock value={data.averages.ppg.toFixed(1)} label="득점" />
          <StatBlock value={data.averages.rpg.toFixed(1)} label="리바운드" />
          <StatBlock value={data.averages.apg.toFixed(1)} label="어시스트" />
          <StatBlock value={String(data.peakOvr)} label="최고 OVR" />
        </div>

        {/* 수상 */}
        {data.honors.length > 0 && (
          <div style={{ marginTop: 40, fontSize: 36, fontWeight: 700, color: CARD_COLORS.gold }}>
            🏆 {data.honors.map((h) => `${h.label} ${h.count}`).join(' · ')}
          </div>
        )}
        {data.nbaLine && (
          <div style={{ marginTop: 14, fontSize: 30, fontWeight: 600, color: CARD_COLORS.text }}>
            {data.nbaLine}
          </div>
        )}

        {/* 팀 이력 */}
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          {data.stints.map((stint, idx) => {
            const src = logoSrcs[stint.teamId];
            return (
              <React.Fragment key={`${stint.teamId}-${idx}`}>
                {idx > 0 && (
                  <span style={{ fontSize: 32, color: CARD_COLORS.sub, marginTop: 40 }}>→</span>
                )}
                {idx === data.stints.length - 1 && data.hiddenStintCount > 0 && (
                  <>
                    <span
                      style={{ fontSize: 30, fontWeight: 700, color: CARD_COLORS.sub, marginTop: 40 }}
                    >
                      +{data.hiddenStintCount}
                    </span>
                    <span style={{ fontSize: 32, color: CARD_COLORS.sub, marginTop: 40 }}>→</span>
                  </>
                )}
                <div style={{ width: 150, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 56,
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${src}-${retryToken}`}
                        src={src}
                        alt={stint.teamShortName}
                        crossOrigin="anonymous"
                        style={{ width: 88, height: 88, objectFit: 'contain' }}
                        onLoad={() => onLogoStatus(stint.teamId, true)}
                        onError={() => onLogoStatus(stint.teamId, false)}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      fontSize: 24,
                      fontWeight: 700,
                      width: '100%',
                      textAlign: 'center',
                      ...ellipsis,
                    }}
                  >
                    {stint.teamShortName}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      color: CARD_COLORS.sub,
                      marginTop: 4,
                      width: '100%',
                      textAlign: 'center',
                      ...ellipsis,
                    }}
                  >
                    {stint.leagueShortName} · {stint.seasons}시즌
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* 커리어 하이·피크 시즌 */}
        {(data.careerHighPts !== null || data.peakSeasonLabel) && (
          <div style={{ marginTop: 44, fontSize: 30, fontWeight: 600, color: CARD_COLORS.sub }}>
            {[
              data.careerHighPts !== null ? `커리어 하이 ${data.careerHighPts}점` : null,
              data.peakSeasonLabel ? `피크 ${data.peakSeasonLabel}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}

        {/* 게임 주소 */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 36,
            borderTop: `2px solid ${CARD_COLORS.line}`,
            textAlign: 'center',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: CARD_COLORS.sub,
          }}
        >
          {CAREER_CARD_SITE_LABEL}
        </div>
      </div>
    );
  }
);

export default CareerShareCard;
