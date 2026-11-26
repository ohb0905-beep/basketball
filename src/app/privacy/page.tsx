import type { Metadata } from 'next';
import { LegalDocumentLayout } from '../../components/legal/LegalDocumentLayout';
import { CONTACT_EMAIL, GAME_NAME } from '../../config/appMeta';

export const metadata: Metadata = {
  title: `개인정보처리방침 · ${GAME_NAME}`,
  description: `${GAME_NAME}(Road to MVP) 개인정보처리방침 안내`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="개인정보처리방침"
      updatedAt="2026.11.26"
      currentPath="/privacy"
    >
      <p>
        <strong>{GAME_NAME}(Road to MVP)</strong>(이하 &ldquo;본 서비스&rdquo;)는
        이용자의 개인정보를 소중히 여기며, 실제 서비스 동작에 필요한 최소한의
        범위 내에서 투명하게 데이터를 처리합니다.
      </p>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          1. 수집하지 않는 개인정보
        </h2>
        <p>
          본 서비스는 별도의 회원가입이나 로그인 절차를 두지 않으며, 이름·이메일
          주소·전화번호·결제 정보 등 개인을 식별할 수 있는 정보를 필수로
          수집하거나 요구하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          2. 브라우저 로컬 저장소(localStorage) 이용
        </h2>
        <p>
          커리어 진행 상황, 선수 기록, 명예의 전당, 역대 기록실, 화면
          테마(라이트/다크) 및 팀 로고 캐시 데이터는 이용자 기기의 브라우저 로컬
          저장소(<code className="font-mono text-[13px]">localStorage</code>)에만
          저장됩니다. 이 데이터는 별도의 회원 서버로 자동 전송되지 않으며,
          이용자가 브라우저 사이트 데이터를 삭제하거나 게임 내 초기화 기능을
          실행하면 즉시 삭제됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          3. 피드백 제출 시 처리되는 정보
        </h2>
        <p>
          이용자가 게임 내 &lsquo;피드백&rsquo; 또는 하단 &lsquo;문의 /
          피드백&rsquo; 기능을 통해 직접 제보를 제출하는 경우에 한해, 아래
          정보가 서버 API를 통해 Supabase 데이터베이스에 익명으로 저장됩니다.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[var(--t-g700)]">
          <li>이용자가 직접 입력한 제보 유형, 제목, 상세 내용</li>
          <li>
            디버깅용 최소 게임 상태 요약: 게임 버전, 제보 시각, 현재 화면·탭,
            리그·시즌·진행 단계 및 진행 중인 선수의 포지션·나이·OVR·소속팀 요약
          </li>
          <li>
            접속 환경 요약: 기기 유형(모바일/태블릿/데스크톱), 화면 해상도,
            브라우저·OS 종류 및 언어 설정
          </li>
        </ul>
        <p>
          피드백 제출 시 비밀번호, 인증 토큰, 전체 세이브 파일, 개인 식별 정보는
          자동 수집하지 않습니다. 이용자는 제출 전 모달 하단의 미리보기
          영역에서 전송될 요약 정보를 직접 확인할 수 있습니다. 또한 스팸 방지를
          위해 서버 메모리에서 일시적인 요청 빈도 제한을 적용할 수 있으며, 해당
          기록은 영구 저장하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          4. 익명 플레이 통계 수집
        </h2>
        <p>
          본 서비스는 게임 밸런스 조정, 리그 진행률 분석 및 오류 개선을 위해
          아래의 주요 플레이 마일스톤 발생 시점에 한해 개인을 식별할 수 없는
          익명 통계 데이터를 서버 API를 통해 Supabase 데이터베이스에 기록할 수
          있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[var(--t-g700)]">
          <li>
            수집 시점: 세션 시작, 커리어 생성 화면 진입, 새 커리어 생성, 시즌
            완료, 드래프트 결과, 리그 변경(승격·이적 등), 커리어 은퇴, 진행 중
            커리어 초기화
          </li>
          <li>
            수집 항목: 브라우저·세션·커리어 단위의 무작위 익명 식별자(UUID),
            게임 버전, 기기 유형(모바일/태블릿/데스크톱), 처음 접속한 경로(링크의
            출처 표시 또는 이전 사이트 도메인), 선택한 포지션·신장·성장
            유형·육성 방향, 시즌·리그·팀 성적·플레이오프 결과·선수 역할(벤치/주전)·
            부상 결장·계약 단계·드래프트 순번·OVR·경기 스탯 및 리그별 우승·MVP·FMVP
            등 수상 내역 요약
          </li>
          <li>
            수집 제외: 이용자가 직접 입력한 선수 이름, 실명, 이메일, 전화번호,
            IP 주소 원본, 인증 토큰 및 전체 세이브 파일
          </li>
        </ul>
        <p>
          익명 식별자 저장을 위해 브라우저 로컬 저장소(
          <code className="font-mono text-[13px]">localStorage</code>) 및 세션
          저장소(<code className="font-mono text-[13px]">sessionStorage</code>)를
          보조적으로 사용하며, 통계 전송이 실패하거나 오프라인 상태여도 게임
          플레이와 세이브 저장에는 영향을 주지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          5. 보유 기간 및 제3자 처리 위탁
        </h2>
        <p>
          익명으로 접수된 피드백 및 플레이 통계 데이터는 버그 수정, 게임 밸런스
          개선 및 서비스 품질 향상을 위해 활용되며, 목적 달성 시 또는 운영
          정책에 따라 파기됩니다. 데이터 보관을 위해 Supabase 클라우드
          데이터베이스 인프라를 이용하며, 법령에 의한 경우를 제외하고 제3자에게
          임의로 제공하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-[var(--t-g900)]">
          6. 방침 변경 및 문의
        </h2>
        <p>
          서비스 기능 변경 등에 따라 본 방침이 수정될 경우 본 페이지를 통해
          안내합니다. 개인정보 처리 또는 서비스와 관련한 문의는 게임 화면의
          &lsquo;문의 / 피드백&rsquo; 창구 또는 문의 메일(
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[var(--t-g900)] underline underline-offset-4 break-all"
          >
            {CONTACT_EMAIL}
          </a>)로 접수하실 수 있습니다.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
