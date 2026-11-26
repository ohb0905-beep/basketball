'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CareerSaveSummary,
  MovePayload,
  applyMovePayload,
  decideMove,
  decodeMovePayload,
  readEncodedFromHash,
  sanitizeReturnPath,
} from '../../lib/domainMove';

type Phase =
  | { kind: 'working' }
  | { kind: 'ask'; payload: MovePayload; incoming: CareerSaveSummary | null; existing: CareerSaveSummary }
  | { kind: 'failed' };

const LEGACY_STAY_URL = 'https://roadtomvp.vercel.app/?stay=1';

function describe(summary: CareerSaveSummary | null): string {
  if (!summary) return '저장된 커리어 없음';
  const parts: string[] = [];
  if (summary.playerName) parts.push(summary.playerName);
  if (summary.age !== null) parts.push(`${summary.age}세`);
  if (summary.teamName) parts.push(summary.teamName);
  if (parts.length === 0) parts.push('진행 중인 커리어 없음');
  if (summary.hallOfFameCount > 0) parts.push(`명예의 전당 ${summary.hallOfFameCount}명`);
  return parts.join(' · ');
}

function currentReturnPath(): string {
  return sanitizeReturnPath(new URLSearchParams(window.location.search).get('to'));
}

/**
 * 1.3.1 새 주소의 /move: 예전 주소에서 보낸 세이브를 받아 저장하고 게임으로 이동합니다.
 * 세이브는 주소의 # 뒤에 있어 서버로 전송되지 않으며, 받자마자 주소창에서 지웁니다.
 */
export function MoveReceiver() {
  const [phase, setPhase] = useState<Phase>({ kind: 'working' });

  useEffect(() => {
    const to = currentReturnPath();
    const encoded = readEncodedFromHash(window.location.hash);
    // 세이브가 담긴 주소가 방문 기록·공유에 남지 않도록 바로 지웁니다.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (!encoded) {
      window.location.replace(to);
      return;
    }

    let cancelled = false;
    (async () => {
      const payload = await decodeMovePayload(encoded);
      if (cancelled) return;
      if (!payload) {
        setPhase({ kind: 'failed' });
        return;
      }
      const decision = decideMove(payload, window.localStorage);
      if (decision.kind === 'ask') {
        setPhase({ kind: 'ask', payload, incoming: decision.incoming, existing: decision.existing });
        return;
      }
      if (decision.kind === 'import') applyMovePayload(payload, window.localStorage, true);
      window.location.replace(to);
    })().catch(() => {
      if (!cancelled) setPhase({ kind: 'failed' });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (useIncoming: boolean) => {
    if (phase.kind !== 'ask') return;
    try {
      applyMovePayload(phase.payload, window.localStorage, useIncoming);
      window.location.replace(currentReturnPath());
    } catch {
      setPhase({ kind: 'failed' });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--t-bg)] text-[var(--t-g900)]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--t-g200)] bg-[var(--t-card)] p-6 space-y-4">
        {phase.kind === 'working' && (
          <p className="text-[15px] font-bold text-center">새 주소로 커리어를 옮기는 중입니다…</p>
        )}

        {phase.kind === 'ask' && (
          <>
            <h1 className="text-[17px] font-bold">어느 커리어로 이어서 할까요?</h1>
            <p className="text-[14px] text-[var(--t-g600)] leading-relaxed">
              예전 주소(roadtomvp.vercel.app)의 기록과 이 주소에 이미 있는 기록이 서로 다릅니다.
              고르지 않은 쪽은 이 주소에서 사라집니다. 예전 주소의 기록은 지워지지 않습니다.
            </p>
            <button
              type="button"
              onClick={() => choose(true)}
              className="w-full min-h-[52px] rounded-xl bg-[var(--t-accent)] text-white px-4 py-3 text-left"
            >
              <span className="block text-[15px] font-bold">예전 주소의 기록 가져오기</span>
              <span className="block text-[13px] opacity-90">{describe(phase.incoming)}</span>
            </button>
            <button
              type="button"
              onClick={() => choose(false)}
              className="w-full min-h-[52px] rounded-xl border border-[var(--t-g200)] px-4 py-3 text-left"
            >
              <span className="block text-[15px] font-bold">이 주소의 기록 그대로 쓰기</span>
              <span className="block text-[13px] text-[var(--t-g600)]">{describe(phase.existing)}</span>
            </button>
          </>
        )}

        {phase.kind === 'failed' && (
          <>
            <h1 className="text-[17px] font-bold">커리어를 옮기지 못했습니다</h1>
            <p className="text-[14px] text-[var(--t-g600)] leading-relaxed">
              기록은 예전 주소에 그대로 남아 있습니다. 예전 주소에서 계속 플레이하거나, 잠시 뒤 다시 시도해 주세요.
            </p>
            <a
              href={LEGACY_STAY_URL}
              className="flex items-center justify-center w-full min-h-[48px] rounded-xl bg-[var(--t-accent)] text-white text-[15px] font-bold"
            >
              예전 주소에서 계속하기
            </a>
            <Link
              href="/"
              className="flex items-center justify-center w-full min-h-[48px] rounded-xl border border-[var(--t-g200)] text-[15px] font-bold"
            >
              새 주소에서 새로 시작하기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
