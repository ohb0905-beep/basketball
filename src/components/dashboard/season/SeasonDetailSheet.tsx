'use client';

import React, { useState } from 'react';
import { LEAGUE_CONFIG } from '../../../data/leagues';
import { Modal } from '../../common/Modal';
import { CareerState } from '../../../types/game';

export function SeasonDetailSheet({
  career,
  showDetailSheet,
  setShowDetailSheet,
}: {
  career: CareerState;
  showDetailSheet: boolean;
  setShowDetailSheet: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [standingsConfTab, setStandingsConfTab] = useState<
    'ALL' | 'EAST' | 'WEST'
  >('ALL');
  const leagueInfo = LEAGUE_CONFIG[career.league];
  const lastSeason =
    career.seasonLogs.length > 0
      ? career.seasonLogs[career.seasonLogs.length - 1]
      : null;

  const standings = career.currentStandings || [];
  const hasConferenceStandings =
    career.league === 'NBA' ||
    career.league === 'GLEAGUE' ||
    career.league === 'B_LEAGUE';
  const filteredStandings =
    hasConferenceStandings && standingsConfTab !== 'ALL'
      ? standings
          .filter(
            (s) => (s.conference || s.team.conference) === standingsConfTab
          )
          .sort(
            (a, b) => (a.conferenceRank || a.rank) - (b.conferenceRank || b.rank)
          )
      : standings;

  return (
    <>
      <Modal
        open={showDetailSheet && Boolean(lastSeason)}
        title={lastSeason ? `${lastSeason.year}시즌 상세 기록` : ''}
        subtitle={
          lastSeason
            ? `${leagueInfo.name} · ${lastSeason.wins}승 ${lastSeason.losses}패`
            : undefined
        }
        onClose={() => setShowDetailSheet(false)}
      >
        {lastSeason && (
          <div className="space-y-5">
            <div className="divide-y divide-[var(--t-g100)] text-[14px]">
              {[
                {
                  label: '출전 경기',
                  val:
                    lastSeason.injuredGamesMissed > 0
                      ? `${lastSeason.gp}G (${
                          lastSeason.injurySeverity === 'MAJOR'
                            ? '장기 중상'
                            : lastSeason.injurySeverity === 'MODERATE'
                            ? '중등도 부상'
                            : '경미한 부상'
                        }${lastSeason.injuryLabel ? ` · ${lastSeason.injuryLabel}` : ''} ${
                          lastSeason.injuredGamesMissed
                        }G 결장)`
                      : `${lastSeason.gp}G`,
                },
                ...(lastSeason.injuryPermanentPhyPenalty &&
                lastSeason.injuryPermanentPhyPenalty > 0
                  ? [
                      {
                        label: '중상 후유증',
                        val: `PHY -${lastSeason.injuryPermanentPhyPenalty}${
                          lastSeason.age >= 34 ? ', DEF -1' : ''
                        } 영구 저하`,
                      },
                    ]
                  : []),
                { label: '평균 출전', val: `${lastSeason.mpg.toFixed(1)}분` },
                {
                  label: '스틸 / 블록',
                  val: `${lastSeason.spg.toFixed(1)} / ${lastSeason.bpg.toFixed(1)}`,
                },
                { label: '3점 성공률', val: `${lastSeason.tpPct.toFixed(1)}%` },
                {
                  label: '시즌 최다 득점',
                  val: `${lastSeason.singleGameHighPts}점`,
                },
                { label: '시즌 OVR / 역할', val: `${lastSeason.ovr} · ${lastSeason.role}` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-[var(--t-g600)]">{row.label}</span>
                  <span className="font-bold text-[var(--t-g900)] tabular-nums">
                    {row.val}
                  </span>
                </div>
              ))}
            </div>

            {lastSeason.narrativeLog.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[13px] font-bold text-[var(--t-g600)]">
                  시즌 노트
                </h4>
                <ul className="space-y-1.5 text-[13px] text-[var(--t-g700)]">
                  {lastSeason.narrativeLog.map((line, idx) => (
                    <li
                      key={idx}
                      className="px-3.5 py-2.5 rounded-xl bg-[var(--t-g100)] leading-snug"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {standings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[14px] font-bold text-[var(--t-g900)]">
                    리그 순위표
                  </h4>
                  {hasConferenceStandings && (
                    <div className="inline-flex rounded-xl bg-[var(--t-g100)] p-0.5 text-[12px] font-semibold">
                      {(
                        [
                          { id: 'ALL', label: '전체' },
                          { id: 'EAST', label: '동부' },
                          { id: 'WEST', label: '서부' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStandingsConfTab(tab.id)}
                          className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                            standingsConfTab === tab.id
                              ? 'bg-[var(--t-card)] text-[var(--t-g900)]'
                              : 'text-[var(--t-g500)]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[var(--t-g100)] text-[13px] tabular-nums">
                  {filteredStandings.map((row) => (
                    <div
                      key={row.team.id}
                      className={`py-2.5 px-2 rounded-xl flex items-center justify-between gap-2 ${
                        row.isPlayerTeam
                          ? 'bg-[var(--t-accent-soft)] font-bold text-[var(--t-g900)]'
                          : 'text-[var(--t-g700)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-center font-bold text-[var(--t-g500)] shrink-0">
                          {hasConferenceStandings && standingsConfTab !== 'ALL'
                            ? row.conferenceRank || row.rank
                            : row.rank}
                        </span>
                        <span className="truncate">{row.team.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold">
                          {row.wins}-{row.losses}
                        </span>
                        <span
                          className={`text-[11px] font-bold w-8 text-right ${
                            row.playInQualified
                              ? 'text-[var(--t-gold)]'
                              : row.qualifiedPlayoffs
                              ? 'text-[var(--t-accent-ink)]'
                              : 'text-[var(--t-g400)]'
                          }`}
                        >
                          {row.playInQualified
                            ? 'PI'
                            : row.qualifiedPlayoffs
                            ? 'PO'
                            : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
