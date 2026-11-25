'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RotateCcw, Share2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { CareerShareCard } from './CareerShareCard';
import {
  buildCareerCardData,
  CAREER_CARD_HEIGHT,
  CAREER_CARD_WIDTH,
  resolveCardLogoSrc,
} from '../../lib/careerCard';
import {
  buildCardFileName,
  downloadBlob,
  renderCardToPngBlob,
  shareBlob,
} from '../../lib/careerCardExport';
import { trackCareerCardShared } from '../../lib/careerCardAnalytics';
import { useCareerStore } from '../../store/useCareerStore';
import type { CareerRetrospective } from '../../types/game';

export interface CareerShareModalProps {
  open: boolean;
  retro: CareerRetrospective;
  legacyEmoji: string;
  isReplay: boolean;
  onClose: () => void;
}

type LogoStatus = 'ok' | 'fail';

const MIN_LOCK_MS = 800;

/**
 * 1.3.0 커리어 카드 미리보기 + 이미지 저장하기 / 공유하기
 * - 공식 로고가 하나라도 안 나오면 대체 엠블럼으로 바꾸지 않고 두 버튼을 잠급니다.
 */
export function CareerShareModal({ open, retro, legacyEmoji, isReplay, onClose }: CareerShareModalProps) {
  const espnLogos = useCareerStore((s) => s.espnLogos);
  const showToast = useCareerStore((s) => s.showToast);

  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [logoStatus, setLogoStatus] = useState<Record<string, LogoStatus>>({});
  const [scale, setScale] = useState(0.3);

  const data = useMemo(() => buildCareerCardData(retro, legacyEmoji), [retro, legacyEmoji]);
  const logoSrcs = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const stint of data.stints) {
      map[stint.teamId] = resolveCardLogoSrc(stint.logoTeam, espnLogos);
    }
    return map;
  }, [data, espnLogos]);

  const teamIds = data.stints.map((s) => s.teamId);
  const anyFailed = teamIds.some((id) => logoSrcs[id] === null || logoStatus[id] === 'fail');
  const allLoaded = teamIds.every((id) => logoStatus[id] === 'ok');
  const state: 'loading-logos' | 'ready' | 'logo-failed' | 'capturing' = capturing
    ? 'capturing'
    : anyFailed
    ? 'logo-failed'
    : allLoaded
    ? 'ready'
    : 'loading-logos';

  const handleLogoStatus = useCallback((teamId: string, ok: boolean) => {
    setLogoStatus((prev) => ({ ...prev, [teamId]: ok ? 'ok' : 'fail' }));
  }, []);

  const handleRetry = () => {
    setLogoStatus({});
    setRetryToken((t) => t + 1);
  };

  // 미리보기는 모달 폭에 맞춰 줄여 보여 주고, 캡처는 원본 크기 노드로 합니다.
  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CAREER_CARD_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  // 아이폰 사파리는 버튼을 누른 직후에만 공유 창을 열어 주므로,
  // 로고가 모두 나오면 이미지를 미리 만들어 두고 버튼을 누르면 바로 씁니다.
  const readyBlobRef = useRef<Blob | null>(null);
  const isReady = state === 'ready';
  useEffect(() => {
    readyBlobRef.current = null;
    if (!open || !isReady || !cardRef.current) return;
    let cancelled = false;
    renderCardToPngBlob(cardRef.current)
      .then((blob) => {
        if (!cancelled) readyBlobRef.current = blob;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, isReady, data, retryToken]);

  const capture = async (): Promise<Blob | null> => {
    if (readyBlobRef.current) return readyBlobRef.current;
    if (!cardRef.current) return null;
    try {
      return await renderCardToPngBlob(cardRef.current);
    } catch {
      showToast('이미지를 만들지 못했어요', '잠시 후 다시 시도해 주세요', 'rose');
      return null;
    }
  };

  const runExclusive = async (task: () => Promise<void>) => {
    if (busyRef.current || state !== 'ready') return;
    busyRef.current = true;
    setCapturing(true);
    const startedAt = Date.now();
    try {
      await task();
      // 미리 만든 이미지로 너무 빨리 끝나면 연타가 두 번 저장되므로 잠깐 잠가 둡니다.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOCK_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_LOCK_MS - elapsed));
      }
    } finally {
      busyRef.current = false;
      setCapturing(false);
    }
  };

  const fileName = buildCardFileName(data.playerName);

  const handleSave = () =>
    runExclusive(async () => {
      const blob = await capture();
      if (!blob) return;
      const result = downloadBlob(blob, fileName);
      trackCareerCardShared(retro, 'save', isReplay);
      if (result === 'opened') {
        showToast('이미지를 길게 눌러 저장해 주세요', undefined, 'slate');
      }
    });

  const handleShare = () =>
    runExclusive(async () => {
      const blob = await capture();
      if (!blob) return;
      try {
        const result = await shareBlob(blob, fileName);
        if (result === 'shared') {
          trackCareerCardShared(retro, 'share', isReplay);
        } else if (result === 'unsupported') {
          showToast(
            '이 브라우저는 바로 공유를 지원하지 않아요',
            '이미지 저장하기 후 올려 주세요',
            'slate'
          );
        }
      } catch {
        showToast('공유하지 못했어요', '잠시 후 다시 시도해 주세요', 'rose');
      }
    });

  const locked = state !== 'ready';

  return (
    <Modal
      open={open}
      title="커리어 카드"
      subtitle="이미지로 저장하거나 친구에게 공유해 보세요"
      onClose={capturing ? undefined : onClose}
      testId="career-share-modal"
    >
      <div className="space-y-4">
        <div
          ref={previewRef}
          className="w-full rounded-2xl overflow-hidden"
          style={{ height: CAREER_CARD_HEIGHT * scale }}
        >
          <div
            style={{
              width: CAREER_CARD_WIDTH,
              height: CAREER_CARD_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <CareerShareCard
              ref={cardRef}
              data={data}
              logoSrcs={logoSrcs}
              onLogoStatus={handleLogoStatus}
              retryToken={retryToken}
            />
          </div>
        </div>

        {state === 'logo-failed' && (
          <div
            data-testid="career-card-logo-failed"
            className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--t-g50)] border border-[var(--t-g100)] px-4 py-3"
          >
            <p className="text-[13px] font-semibold text-[var(--t-g700)]">
              일부 팀 로고를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--t-accent)] shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              다시 시도
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            data-testid="career-card-save"
            onClick={handleSave}
            disabled={locked}
            className="t-cta-sub inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {state === 'capturing' || state === 'loading-logos' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            이미지 저장하기
          </button>
          <button
            type="button"
            data-testid="career-card-share"
            onClick={handleShare}
            disabled={locked}
            className="t-cta inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            공유하기
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CareerShareModal;
