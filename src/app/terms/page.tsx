import type { Metadata } from 'next';
import { LegalDocumentLayout } from '../../components/legal/LegalDocumentLayout';
import { GAME_NAME } from '../../config/appMeta';

export const metadata: Metadata = {
  title: `이용약관 · ${GAME_NAME}`,
  description: `${GAME_NAME}(Road to MVP) 서비스 이용약관 안내`,
};

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title="이용약관"
      updatedAt="2026.11.24"
      currentPath="/terms"
    >
      <p>
        본 약관은 웹 기반 무료 농구 커리어 시뮬레이션 게임{' '}
        <strong>{GAME_NAME}(Road to MVP)</strong>(이하 &ldquo;본
        서비스&rdquo;)의 이용과 관련한 기본 사항을 규정합니다.
      </p>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          1. 서비스의 성격 및 제공
        </h2>
        <p>
          본 서비스는 별도의 회원가입 없이 웹 브라우저에서 무료로 즐길 수 있는
          농구 커리어 시뮬레이션 게임입니다. 게임 내 경기 결과, 선수 성장,
          드래프트, 수상 및 서사는 시뮬레이션 규칙과 확률 모델에 따라
          생성됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          2. 로컬 세이브 데이터 저장 및 초기화 고지
        </h2>
        <p>
          본 서비스의 게임 진행 데이터와 명예의 전당 기록은 중앙 계정 서버가
          아닌 이용자 브라우저의 로컬 저장소(
          <code className="font-mono text-[13px]">localStorage</code>)에
          저장됩니다. 브라우저 캐시 및 사이트 데이터 삭제, 시크릿(사생활 보호)
          모드 이용, 기기 또는 브라우저 변경 시 기존 세이브 데이터가 초기화되거나
          복구되지 않을 수 있습니다. 중요한 기록은 게임 내 &lsquo;저장 ·
          가이드&rsquo; 메뉴의 JSON 백업 기능을 통해 직접 보관하시기 바랍니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          3. 서비스의 변경 및 중단
        </h2>
        <p>
          운영자는 게임 밸런스 조정, 기능 개선, 버그 수정 또는 서버·운영 사정에
          따라 본 서비스의 일부 또는 전부를 사전 공지 없이 변경, 수정하거나
          일시적·영구적으로 중단할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          4. 비정상적 이용 및 악용 제한
        </h2>
        <p>
          이용자는 다음 각 호에 해당하는 행위를 해서는 안 되며, 위반 시 서버
          요청 제한 등 필요한 보호 조치가 적용될 수 있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[var(--t-g700)]">
          <li>
            자동화 도구·스크립트를 이용한 피드백 API 스팸 제출 및 반복 호출
          </li>
          <li>
            서비스 서버, 데이터베이스, 관리자 경로 등에 대한 무단 접근 또는 공격
            시도
          </li>
          <li>
            법령에 위반되거나 타인의 권리를 침해하는 내용을 피드백으로 전송하는
            행위
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          5. 상표권·저작권 및 비공식 면책
        </h2>
        <p>
          본 게임은 비공식 농구 커리어 시뮬레이션 게임입니다. 게임 내 언급되는
          실제 리그·구단·대회 명칭 등 관련 상표 및 지식재산권은 각 원권리자에게
          있으며, 본 서비스는 해당 단체와 공식적인 제휴·후원 관계가 없습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          6. 면책 및 문의
        </h2>
        <p>
          본 서비스는 무료로 제공되며, 관련 법령이 허용하는 범위 내에서 로컬
          저장 데이터 유실, 브라우저 호환성 문제, 일시적 네트워크 장애 등으로
          발생한 손해에 대해 별도의 책임을 지지 않습니다. 서비스 이용과 관련한
          문의 및 오류 제보는 게임 내 &lsquo;문의 / 피드백&rsquo; 기능을 통해
          접수해 주세요.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
