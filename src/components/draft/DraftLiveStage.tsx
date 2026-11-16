'use client';

import React from 'react';
import { Award, CheckCircle2, Sparkles } from 'lucide-react';
import { useCareerStore } from '../../store/useCareerStore';
import { TeamEmblem } from '../common/TeamEmblem';

export function DraftLiveStage() {
  const career = useCareerStore((s) => s.career);
  const finalizeDraftSigning = useCareerStore((s) => s.finalizeDraftSigning);

  if (!career || !career.draftResult) return null;

  const dr = career.draftResult;
  const isKbl = dr.draftType === 'KBL';
  const isFirstRound = dr.round === 1 && dr.pickNumber !== null && dr.pickNumber <= 30;
  const isSecondRound = dr.round === 2 && dr.pickNumber !== null && dr.pickNumber > 30;
  const isUndrafted = dr.pickNumber === null;
  const twoWayTargetTeam = dr.draftedTeam || dr.twoWayOfferTeam;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs text-center space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-orange-600">
            {isKbl
              ? '서울 잠실학생체육관 · KBL 신인선수 드래프트'
              : '뉴욕 브루클린 바클레이스 센터 · NBA DRAFT LIVE'}
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {isUndrafted
              ? '60순위까지 이름이 불리지 않았어요 (Undrafted)'
              : `${dr.draftType} 드래프트 ${dr.round}라운드 전체 ${dr.pickNumber}순위 지명!`}
          </h1>
        </div>

        {/* 지명 구단 엠블럼 & 커미셔너 콜아웃 카드 */}
        {dr.draftedTeam ? (
          <div className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center space-y-4">
            <TeamEmblem team={dr.draftedTeam} size="xl" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">
                {dr.draftedTeam.city} · 구단 전력 {dr.draftedTeam.rating}
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {dr.draftedTeam.name}
              </h2>
              <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed">
                {dr.draftedTeam.prestigeDesc}
              </p>
            </div>

            <div className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium">
              {isKbl
                ? `“KBL 신인드래프트 전체 ${dr.pickNumber}순위로 ${dr.draftedTeam.name} 구단이 #${career.jerseyNumber} ${career.name} 선수를 지명했어요!”`
                : isFirstRound
                ? `“With the #${dr.pickNumber} pick in the NBA Draft, the ${dr.draftedTeam.name} select ${career.name}!” (1라운드 정식 루키 스케일 보장 계약)`
                : `2라운드 전체 ${dr.pickNumber}순위로 ${dr.draftedTeam.name}에 지명되었어요! 구단과 투웨이(Two-Way) 계약을 체결해 콜업을 노리거나 G리그·KBL 진로를 선택할 수 있어요.`}
            </div>
          </div>
        ) : dr.twoWayOfferTeam ? (
          <div className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-sm font-bold text-slate-800">
              아쉽게도 드래프트 1·2라운드 60명 안에 호명되지 못했어요.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              하지만 직전 시즌 실전 퍼포먼스와 잠재력을 눈여겨본{' '}
              <strong className="text-slate-900">
                {dr.twoWayOfferTeam.name}
              </strong>{' '}
              스카우팅 팀에서 라스베이거스 서머리그 초청과 함께{' '}
              <strong className="text-orange-600">투웨이(Two-Way) 계약</strong>을 공식 제안했어요!
            </p>
          </div>
        ) : (
          <div className="max-w-xl mx-auto p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
            <p className="text-sm font-bold text-amber-900">
              드래프트 미지명(Undrafted) 및 NBA 구단 투웨이 오퍼 부재
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              구단 스카우팅 AI 심사 결과(직전 시즌 실전 기록·효율·리그 수비저항 환산치), 아쉽게도 NBA 30개
              구단으로부터 투웨이(Two-Way) 계약을 제안받지 못했어요. NBA G리그 공개 트라이아웃에 참가해
              밑바닥부터 실력을 증명하거나, 국내 KBL 무대로 복귀해 기량을 끌어올려 보세요!
            </p>
          </div>
        )}

        {/* 계약 체결 선택 버튼들 */}
        <div className="max-w-xl mx-auto space-y-3 pt-2">
          {isKbl && (
            <button
              type="button"
              onClick={() => finalizeDraftSigning('KBL')}
              className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              {dr.draftedTeam?.name} 신인 루키 계약서 서명하기
            </button>
          )}

          {!isKbl && isFirstRound && (
            <button
              type="button"
              onClick={() => finalizeDraftSigning('NBA_STANDARD')}
              className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Award className="w-5 h-5" />
              {dr.draftedTeam?.name} 1라운드 NBA 정식 루키 보장 계약 체결하기
            </button>
          )}

          {!isKbl && (isSecondRound || isUndrafted) && (
            <>
              {twoWayTargetTeam && (
                <button
                  type="button"
                  onClick={() => finalizeDraftSigning('TWO_WAY')}
                  className="w-full py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  {twoWayTargetTeam.name} NBA 투웨이(Two-Way) 계약 수락하기
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => finalizeDraftSigning('GLEAGUE')}
                  className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  🇺🇸 NBA G리그 공개 트라이아웃 입단
                </button>
                <button
                  type="button"
                  onClick={() => finalizeDraftSigning('KBL')}
                  className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  🇰🇷 국내 KBL 복귀 후 재도전
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
