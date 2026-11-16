import { LeagueId, Position, TeamDirection, TeamInfo } from '../types/game';

export const HIGH_SCHOOL_TEAMS: TeamInfo[] = [
  {
    id: 'HS_YONGSAN',
    name: '용산고등학교',
    shortName: '용산',
    city: '서울',
    league: 'HIGH_SCHOOL',
    rating: 60,
    primaryColor: '#7F1D1D',
    secondaryColor: '#F59E0B',
    prestigeDesc: '수많은 국가대표와 프로 레전드를 배출한 전국구 농구 명문고예요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SF', 'C'],
  },
  {
    id: 'HS_KYUNGBOK',
    name: '경복고등학교',
    shortName: '경복',
    city: '서울',
    league: 'HIGH_SCHOOL',
    rating: 60,
    primaryColor: '#1E3A8A',
    secondaryColor: '#93C5FD',
    prestigeDesc: '탄탄한 기본기와 장신 유망주 육성 시스템으로 정평이 난 전통의 강호예요.',
    direction: 'CONTENDER',
    neededPositions: ['SG', 'PF', 'C'],
  },
  {
    id: 'HS_SAMIL',
    name: '삼일고등학교',
    shortName: '삼일',
    city: '수원',
    league: 'HIGH_SCHOOL',
    rating: 58,
    primaryColor: '#065F46',
    secondaryColor: '#6EE7B7',
    prestigeDesc: '빠른 트랜지션과 자율적인 공격 농구로 돌풍을 일으키는 경기도 명문고예요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'SG', 'SF'],
  },
  {
    id: 'HS_WHIMOON',
    name: '휘문고등학교',
    shortName: '휘문',
    city: '서울',
    league: 'HIGH_SCHOOL',
    rating: 58,
    primaryColor: '#312E81',
    secondaryColor: '#E2E8F0',
    prestigeDesc: '끈끈한 조직력과 외곽 슈터 육성에 강점을 지닌 강남권 전통 명문교예요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['SG', 'SF', 'PF'],
  },
];

export const U_LEAGUE_TEAMS: TeamInfo[] = [
  {
    id: 'UL_YONSEI',
    name: '연세대학교',
    shortName: '연세',
    city: '서울 신촌',
    league: 'U_LEAGUE',
    rating: 64,
    primaryColor: '#003876',
    secondaryColor: '#FFFFFF',
    prestigeDesc: '신촌 독수리 군단이라 불리며 세련된 가드 농구와 빠른 공수 전환을 자랑해요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SG', 'SF'],
  },
  {
    id: 'UL_KOREA',
    name: '고려대학교',
    shortName: '고려',
    city: '서울 안암',
    league: 'U_LEAGUE',
    rating: 64,
    primaryColor: '#8B0029',
    secondaryColor: '#FDE68A',
    prestigeDesc: '안암골 호랑이 특유의 강한 피지컬과 리바운드, 투지 넘치는 수비 농구를 펼쳐요.',
    direction: 'CONTENDER',
    neededPositions: ['PF', 'C', 'SF'],
  },
  {
    id: 'UL_CHUNGANG',
    name: '중앙대학교',
    shortName: '중앙',
    city: '안성 · 서울',
    league: 'U_LEAGUE',
    rating: 61,
    primaryColor: '#1D4ED8',
    secondaryColor: '#BFDBFE',
    prestigeDesc: '대학 농구 최다 연승 기록의 자부심을 간직한 청룡 군단이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'SG', 'PF'],
  },
  {
    id: 'UL_KYUNGHEE',
    name: '경희대학교',
    shortName: '경희',
    city: '용인 기흥',
    league: 'U_LEAGUE',
    rating: 60,
    primaryColor: '#991B1B',
    secondaryColor: '#FCD34D',
    prestigeDesc: '체계적인 체력 훈련과 압박 수비로 상대 에이스를 봉쇄하는 강팀이에요.',
    direction: 'REBUILDING',
    neededPositions: ['PG', 'SF', 'C'],
  },
];

export const SANGMU_TEAM: TeamInfo = {
  id: 'KBL_SANGMU',
  name: '국군체육부대 상무 농구단',
  shortName: '상무',
  city: '문경',
  league: 'KBL',
  rating: 69,
  primaryColor: '#14532D',
  secondaryColor: '#FACC15',
  prestigeDesc: '대한민국 프로 선수들이 국방의 의무를 다하며 코트 감각을 유지하는 국군체육부대예요.',
  direction: 'PLAYOFF_HUNT',
  neededPositions: ['PG', 'SG', 'SF', 'PF', 'C'],
  isMilitaryTeam: true,
};

export const KBL_TEAMS: TeamInfo[] = [
  {
    id: 'KBL_SK',
    name: '서울 SK 나이츠',
    shortName: 'SK',
    city: '서울 잠실',
    league: 'KBL',
    rating: 72,
    primaryColor: '#DC2626',
    secondaryColor: '#FACC15',
    prestigeDesc: '잠실학생체육관을 홈으로 쓰며 리그 최고 수준의 속공과 드롭존 수비를 구사해요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SF', 'C'],
  },
  {
    id: 'KBL_KCC',
    name: '부산 KCC 이지스',
    shortName: 'KCC',
    city: '부산',
    league: 'KBL',
    rating: 72,
    primaryColor: '#1E3A8A',
    secondaryColor: '#EF4444',
    prestigeDesc: '화려한 스타 군단과 최다 우승의 역사를 자랑하는 KBL 대표 명문 구단이에요.',
    direction: 'CONTENDER',
    neededPositions: ['SG', 'PF', 'C'],
  },
  {
    id: 'KBL_DB',
    name: '원주 DB 프로미',
    shortName: 'DB',
    city: '원주',
    league: 'KBL',
    rating: 71,
    primaryColor: '#047857',
    secondaryColor: '#FDE047',
    prestigeDesc: '농구 도시 원주의 열광적인 응원과 막강한 프런트코트 높이를 자랑하는 전통 강호예요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SG', 'PF'],
  },
  {
    id: 'KBL_LG',
    name: '창원 LG 세이커스',
    shortName: 'LG',
    city: '창원',
    league: 'KBL',
    rating: 71,
    primaryColor: '#BE123C',
    secondaryColor: '#1E293B',
    prestigeDesc: '창원 팬들의 뜨거운 열기와 탄탄한 수비 조직력으로 정상에 도전하는 구단이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'SF', 'C'],
  },
  {
    id: 'KBL_KT',
    name: '수원 KT 소닉붐',
    shortName: 'KT',
    city: '수원',
    league: 'KBL',
    rating: 70,
    primaryColor: '#0F172A',
    secondaryColor: '#EF4444',
    prestigeDesc: '젊은 유망주 육성과 폭발적인 외곽 화력을 겸비한 수도권 강팀이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['SG', 'SF', 'C'],
  },
  {
    id: 'KBL_MOBIS',
    name: '울산 현대모비스 피버스',
    shortName: '모비스',
    city: '울산',
    league: 'KBL',
    rating: 70,
    primaryColor: '#B91C1C',
    secondaryColor: '#1D4ED8',
    prestigeDesc: '정교한 시스템 농구와 유망주 조련으로 정평이 난 구단이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'PF', 'C'],
  },
  {
    id: 'KBL_KGC',
    name: '안양 정관장 레드부스터스',
    shortName: '정관장',
    city: '안양',
    league: 'KBL',
    rating: 68,
    primaryColor: '#991B1B',
    secondaryColor: '#D97706',
    prestigeDesc: '끈질긴 압박 수비와 클러치 집중력으로 단기전에 강한 챔프전 단골 구단이에요.',
    direction: 'REBUILDING',
    neededPositions: ['PG', 'SG', 'C'],
  },
  {
    id: 'KBL_SONO',
    name: '고양 소노 스카이거너스',
    shortName: '소노',
    city: '고양',
    league: 'KBL',
    rating: 67,
    primaryColor: '#0284C7',
    secondaryColor: '#E0F2FE',
    prestigeDesc: '시원시원한 양궁 농구와 과감한 3점슛 시도로 코트를 폭격하는 팀이에요.',
    direction: 'REBUILDING',
    neededPositions: ['SF', 'PF', 'C'],
  },
  {
    id: 'KBL_KOGAS',
    name: '대구 한국가스공사 페가수스',
    shortName: '가스공사',
    city: '대구',
    league: 'KBL',
    rating: 67,
    primaryColor: '#1E40AF',
    secondaryColor: '#38BDF8',
    prestigeDesc: '빠른 가드진과 공격적인 외곽 전개로 돌풍을 일으키는 구단이에요.',
    direction: 'REBUILDING',
    neededPositions: ['SG', 'SF', 'PF'],
  },
  {
    id: 'KBL_SAMSUNG',
    name: '서울 삼성 썬더스',
    shortName: '삼성',
    city: '서울 잠실',
    league: 'KBL',
    rating: 66,
    primaryColor: '#1D4ED8',
    secondaryColor: '#FACC15',
    prestigeDesc: '잠실실내체육관을 홈으로 사용하며 새로운 프랜차이즈 스타의 등장을 갈망하는 구단이에요.',
    direction: 'REBUILDING',
    neededPositions: ['PG', 'SG', 'SF', 'PF'],
  },
];

export const OVERSEAS_TEAMS: TeamInfo[] = [
  {
    id: 'OVS_CHIBA',
    name: '치바 제츠 후나바시 (B.리그)',
    shortName: '치바',
    city: '일본 치바',
    league: 'OVERSEAS',
    rating: 74,
    primaryColor: '#DC2626',
    secondaryColor: '#FFFFFF',
    prestigeDesc: '일본 B.리그 최고 수준의 관중 동원력과 빠른 업템포 농구를 구사하는 메가 클럽이에요.',
    direction: 'CONTENDER',
    neededPositions: ['SG', 'SF', 'PF'],
  },
  {
    id: 'OVS_RYUKYU',
    name: '류큐 골든킹스 (B.리그)',
    shortName: '류큐',
    city: '일본 오키나와',
    league: 'OVERSEAS',
    rating: 73,
    primaryColor: '#B45309',
    secondaryColor: '#1E293B',
    prestigeDesc: '오키나와 아레나의 열광적인 홈 분위기와 탄탄한 공수 밸런스를 자랑해요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'SF', 'C'],
  },
  {
    id: 'OVS_SYDNEY',
    name: '시드니 킹스 (호주 NBL)',
    shortName: '시드니',
    city: '호주 시드니',
    league: 'OVERSEAS',
    rating: 76,
    primaryColor: '#581C87',
    secondaryColor: '#FACC15',
    prestigeDesc: 'NBA 스카우트들이 상시 주시하는 호주 NBL Next Stars 프로그램의 핵심 무대예요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SG', 'SF'],
  },
  {
    id: 'OVS_MELBOURNE',
    name: '멜버른 유나이티드 (호주 NBL)',
    shortName: '멜버른',
    city: '호주 멜버른',
    league: 'OVERSEAS',
    rating: 75,
    primaryColor: '#0F172A',
    secondaryColor: '#38BDF8',
    prestigeDesc: '강인한 유러피언-오세아니아 피지컬 농구로 NBA 진출의 교두보 역할을 하는 명문이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['SF', 'PF', 'C'],
  },
];

export const GLEAGUE_TEAMS: TeamInfo[] = [
  {
    id: 'GL_UNITED',
    name: 'G리그 유나이티드 (쇼케이스)',
    shortName: 'GL유나이티드',
    city: '미국 라스베이거스',
    league: 'GLEAGUE',
    rating: 76,
    primaryColor: '#3730A3',
    secondaryColor: '#F43F5E',
    prestigeDesc: '전 세계 드래프트 유망주와 NBA 콜업 도전자들이 모여 스카우트 앞에서 실력을 증명하는 곳이에요.',
    direction: 'REBUILDING',
    neededPositions: ['PG', 'SG', 'SF', 'PF', 'C'],
  },
  {
    id: 'GL_SOUTH_BAY',
    name: '사우스베이 레이커스',
    shortName: '사우스베이',
    city: '미국 엘세군도',
    league: 'GLEAGUE',
    rating: 75,
    primaryColor: '#581C87',
    secondaryColor: '#FACC15',
    prestigeDesc: '빅마켓 구단 산하 G리그 팀으로 언제든 10일 계약과 투웨이 콜업 기회가 열려 있어요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'SG', 'C'],
  },
  {
    id: 'GL_SANTA_CRUZ',
    name: '산타크루즈 워리어스',
    shortName: '산타크루즈',
    city: '미국 산타크루즈',
    league: 'GLEAGUE',
    rating: 75,
    primaryColor: '#1D4ED8',
    secondaryColor: '#FACC15',
    prestigeDesc: '현대적인 스페이싱과 3점슛 전술을 체계적으로 훈련받으며 NBA 콜업을 노리는 구단이에요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['SG', 'SF', 'PF'],
  },
];

export const NCAA_TEAMS: TeamInfo[] = [
  {
    id: 'NCAA_DUKE',
    name: '듀크 블루데블스 (Duke)',
    shortName: 'Duke',
    city: '미국 노스캐롤라이나 더럼',
    league: 'NCAA',
    rating: 78,
    primaryColor: '#003087',
    secondaryColor: '#FFFFFF',
    espnAbbr: 'duke',
    espnId: '150',
    prestigeDesc: '카메론 인도어 스타디움의 광기와 함께 수많은 NBA 1순위 픽을 배출한 최고의 명문대예요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SF', 'PF'],
  },
  {
    id: 'NCAA_KENTUCKY',
    name: '켄터키 와일드캣츠 (Kentucky)',
    shortName: 'Kentucky',
    city: '미국 켄터키 렉싱턴',
    league: 'NCAA',
    rating: 77,
    primaryColor: '#0033A0',
    secondaryColor: '#FFFFFF',
    espnAbbr: 'uk',
    espnId: '96',
    prestigeDesc: '원앤던(One-and-Done) 슈퍼 루키들의 산실로 NBA 프런트가 가장 주목하는 대학이에요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'SG', 'C'],
  },
  {
    id: 'NCAA_UNC',
    name: '노스캐롤라이나 타힐스 (UNC)',
    shortName: 'UNC',
    city: '미국 채플힐',
    league: 'NCAA',
    rating: 77,
    primaryColor: '#4B9CD3',
    secondaryColor: '#FFFFFF',
    espnAbbr: 'unc',
    espnId: '153',
    prestigeDesc: '농구 황제의 모교이자 유구한 역사와 전통을 자랑하는 캐롤라이나 블루 명문대예요.',
    direction: 'CONTENDER',
    neededPositions: ['SG', 'SF', 'PF'],
  },
  {
    id: 'NCAA_KANSAS',
    name: '캔자스 제이혹스 (Kansas)',
    shortName: 'Kansas',
    city: '미국 캔자스 로렌스',
    league: 'NCAA',
    rating: 77,
    primaryColor: '#0051BA',
    secondaryColor: '#E8000D',
    espnAbbr: 'ku',
    espnId: '2305',
    prestigeDesc: '대학 농구 발상지의 자부심과 마주할 때마다 압도되는 포그 알렌 필드하우스의 주인이에요.',
    direction: 'CONTENDER',
    neededPositions: ['PG', 'PF', 'C'],
  },
  {
    id: 'NCAA_UCONN',
    name: '코네티컷 허스키스 (UConn)',
    shortName: 'UConn',
    city: '미국 코네티컷 스토어스',
    league: 'NCAA',
    rating: 78,
    primaryColor: '#000E2F',
    secondaryColor: '#E4002B',
    espnAbbr: 'uconn',
    espnId: '41',
    prestigeDesc: '완벽한 모션 오펜스와 철벽 수비로 3월의 광란 토너먼트를 지배하는 디펜딩 강호예요.',
    direction: 'CONTENDER',
    neededPositions: ['SG', 'SF', 'C'],
  },
  {
    id: 'NCAA_GONZAGA',
    name: '곤자가 불독스 (Gonzaga)',
    shortName: 'Gonzaga',
    city: '미국 워싱턴 스포캔',
    league: 'NCAA',
    rating: 76,
    primaryColor: '#041E42',
    secondaryColor: '#C8102E',
    espnAbbr: 'gonz',
    espnId: '2250',
    prestigeDesc: '국제 유망주와 테크니컬 빅맨 육성에 특화된 미국 서부 최고의 농구 명문대예요.',
    direction: 'PLAYOFF_HUNT',
    neededPositions: ['PG', 'PF', 'C'],
  },
];

function inferNbaDirection(rating: number): TeamDirection {
  if (rating >= 85) return 'CONTENDER';
  if (rating >= 80) return 'PLAYOFF_HUNT';
  return 'REBUILDING';
}

const RAW_NBA_TEAMS: Omit<TeamInfo, 'direction'>[] = [
  { id: 'NBA_BOS', name: '보스턴 셀틱스', shortName: 'BOS', city: '보스턴', league: 'NBA', rating: 89, primaryColor: '#007A33', secondaryColor: '#BA9653', espnAbbr: 'bos', neededPositions: ['C', 'PG'], prestigeDesc: 'TD 가든 천장을 수놓은 영구결번과 최다 우승 배너가 빛나는 전통의 명가예요.' },
  { id: 'NBA_NYK', name: '뉴욕 닉스', shortName: 'NYK', city: '뉴욕', league: 'NBA', rating: 86, primaryColor: '#006BB6', secondaryColor: '#F58426', espnAbbr: 'ny', neededPositions: ['C', 'SG'], prestigeDesc: '농구의 메카 매디슨 스퀘어 가든의 주인이자 세계 최고의 스포트라이트가 쏟아지는 구단이에요.' },
  { id: 'NBA_PHI', name: '필라델피아 세븐티식서스', shortName: 'PHI', city: '필라델피아', league: 'NBA', rating: 84, primaryColor: '#006BB6', secondaryColor: '#ED174C', espnAbbr: 'phi', neededPositions: ['PF', 'SF'], prestigeDesc: '뜨거운 열정의 도시 필라델피아를 대표하는 동부 컨퍼런스 강호예요.' },
  { id: 'NBA_BKN', name: '브루클린 네츠', shortName: 'BKN', city: '브루클린', league: 'NBA', rating: 76, primaryColor: '#000000', secondaryColor: '#FFFFFF', espnAbbr: 'bkn', neededPositions: ['PG', 'SG', 'PF'], prestigeDesc: '바클레이스 센터를 홈으로 쓰며 젊은 유망주들에게 많은 출전 기회를 부여하는 팀이에요.' },
  { id: 'NBA_TOR', name: '토론토 랩터스', shortName: 'TOR', city: '토론토', league: 'NBA', rating: 77, primaryColor: '#CE1141', secondaryColor: '#000000', espnAbbr: 'tor', neededPositions: ['PG', 'C'], prestigeDesc: '캐나다 전역을 아우르는 팬덤과 뛰어난 윙 디펜더 육성 시스템을 갖춘 팀이에요.' },
  { id: 'NBA_MIL', name: '밀워키 벅스', shortName: 'MIL', city: '밀워키', league: 'NBA', rating: 85, primaryColor: '#00471B', secondaryColor: '#EEE1C6', espnAbbr: 'mil', neededPositions: ['SG', 'SF'], prestigeDesc: '막강한 페인트존 지배력과 외곽 슈터진의 조화로 우승을 노리는 동부 강팀이에요.' },
  { id: 'NBA_CLE', name: '클리블랜드 캐벌리어스', shortName: 'CLE', city: '클리블랜드', league: 'NBA', rating: 86, primaryColor: '#860038', secondaryColor: '#FDBB30', espnAbbr: 'cle', neededPositions: ['SF', 'PF'], prestigeDesc: '탄탄한 트윈타워 수비와 젊은 백코트 에이스들의 조화가 돋보이는 구단이에요.' },
  { id: 'NBA_IND', name: '인디애나 페이서스', shortName: 'IND', city: '인디애나폴리스', league: 'NBA', rating: 84, primaryColor: '#002D62', secondaryColor: '#FDBB30', espnAbbr: 'ind', neededPositions: ['SF', 'C'], prestigeDesc: '리그 최고 속도의 런앤건과 유기적인 패스 게임으로 득점력을 폭발시키는 팀이에요.' },
  { id: 'NBA_CHI', name: '시카고 불스', shortName: 'CHI', city: '시카고', league: 'NBA', rating: 78, primaryColor: '#CE1141', secondaryColor: '#000000', espnAbbr: 'chi', neededPositions: ['PG', 'PF', 'C'], prestigeDesc: '90년대 왕조의 전설이 살아 숨 쉬는 유나이티드 센터의 주인이에요.' },
  { id: 'NBA_DET', name: '디트로이트 피스톤스', shortName: 'DET', city: '디트로이트', league: 'NBA', rating: 76, primaryColor: '#C8102E', secondaryColor: '#1D42BA', espnAbbr: 'det', neededPositions: ['SG', 'PF'], prestigeDesc: '배드보이즈의 터프한 유산을 이어받아 젊은 코어로 재건 중인 구단이에요.' },
  { id: 'NBA_MIA', name: '마이애미 히트', shortName: 'MIA', city: '마이애미', league: 'NBA', rating: 83, primaryColor: '#98002E', secondaryColor: '#F9A01B', espnAbbr: 'mia', neededPositions: ['PG', 'PF'], prestigeDesc: '언드래프티와 2라운더도 올스타로 키워내는 강인한 히트 컬처(Heat Culture)의 본산이에요.' },
  { id: 'NBA_ORL', name: '올랜도 매직', shortName: 'ORL', city: '올랜도', league: 'NBA', rating: 84, primaryColor: '#0077C0', secondaryColor: '#C4CED4', espnAbbr: 'orl', neededPositions: ['PG', 'SG'], prestigeDesc: '장신 포워드진과 질식 수비를 바탕으로 급부상한 젊은 강팀이에요.' },
  { id: 'NBA_ATL', name: '애틀랜타 호크스', shortName: 'ATL', city: '애틀랜타', league: 'NBA', rating: 79, primaryColor: '#E03A3E', secondaryColor: '#C1D32F', espnAbbr: 'atl', neededPositions: ['SG', 'C'], prestigeDesc: '화려한 픽앤롤과 초장거리 3점슛으로 관중을 매료시키는 공격적인 팀이에요.' },
  { id: 'NBA_CHA', name: '샬럿 호네츠', shortName: 'CHA', city: '샬럿', league: 'NBA', rating: 75, primaryColor: '#1D1160', secondaryColor: '#00788C', espnAbbr: 'cha', neededPositions: ['SG', 'PF', 'C'], prestigeDesc: '신인에게 과감한 롤을 부여해 루키 시즌부터 주전 도약이 가능한 기회의 구단이에요.' },
  { id: 'NBA_WAS', name: '워싱턴 위저즈', shortName: 'WAS', city: '워싱턴 D.C.', league: 'NBA', rating: 74, primaryColor: '#002B5C', secondaryColor: '#E31837', espnAbbr: 'wsh', neededPositions: ['PG', 'SF', 'C'], prestigeDesc: '전면 리빌딩을 진행 중이어서 젊은 선수들이 출전 시간을 확보하기 유리한 팀이에요.' },
  { id: 'NBA_OKC', name: '오클라호마시티 썬더', shortName: 'OKC', city: '오클라호마시티', league: 'NBA', rating: 89, primaryColor: '#007AC1', secondaryColor: '#EF3B24', espnAbbr: 'okc', neededPositions: ['PF', 'C'], prestigeDesc: '전원 드리블과 슛, 수비가 가능한 5-Out 현대 농구의 정점을 보여주는 서부 최강팀이에요.' },
  { id: 'NBA_DEN', name: '덴버 너기츠', shortName: 'DEN', city: '덴버', league: 'NBA', rating: 87, primaryColor: '#0E2240', secondaryColor: '#FEC524', espnAbbr: 'den', neededPositions: ['PG', 'SG'], prestigeDesc: '고지대 홈구장의 이점과 완벽한 투맨 게임 시스템을 갖춘 챔피언십 컨텐더예요.' },
  { id: 'NBA_MIN', name: '미네소타 팀버울브스', shortName: 'MIN', city: '미니애폴리스', league: 'NBA', rating: 86, primaryColor: '#0C2340', secondaryColor: '#236192', espnAbbr: 'min', neededPositions: ['PG', 'PF'], prestigeDesc: '리그 최정상급 수비 효율과 폭발적인 운동능력을 겸비한 서부 강호예요.' },
  { id: 'NBA_POR', name: '포틀랜드 트레일블레이저스', shortName: 'POR', city: '포틀랜드', league: 'NBA', rating: 75, primaryColor: '#E03A3E', secondaryColor: '#000000', espnAbbr: 'por', neededPositions: ['SF', 'PF'], prestigeDesc: '차세대 에이스를 중심으로 리빌딩 중이며 루키의 성장 기회가 풍부한 구단이에요.' },
  { id: 'NBA_UTA', name: '유타 재즈', shortName: 'UTA', city: '솔트레이크시티', league: 'NBA', rating: 76, primaryColor: '#002B5C', secondaryColor: '#F9A01B', espnAbbr: 'utah', neededPositions: ['PG', 'SG', 'SF'], prestigeDesc: '정교한 스크린 전술과 외곽 슈팅 시스템을 갖춘 서부 전통의 구단이에요.' },
  { id: 'NBA_LAL', name: '로스앤젤레스 레이커스', shortName: 'LAL', city: '로스앤젤레스', league: 'NBA', rating: 84, primaryColor: '#552583', secondaryColor: '#FDB927', espnAbbr: 'lal', neededPositions: ['PG', 'C'], prestigeDesc: '할리우드의 화려한 조명 아래 전 세계 농구 팬들의 시선이 집중되는 퍼플앤골드 명문이에요.' },
  { id: 'NBA_GSW', name: '골든스테이트 워리어스', shortName: 'GSW', city: '샌프란시스코', league: 'NBA', rating: 84, primaryColor: '#1D428A', secondaryColor: '#FFC72C', espnAbbr: 'gs', neededPositions: ['SG', 'C'], prestigeDesc: '3점슛 혁명과 스몰볼 왕조를 이룩한 현대 농구의 아이콘 같은 구단이에요.' },
  { id: 'NBA_LAC', name: '로스앤젤레스 클리퍼스', shortName: 'LAC', city: '잉글우드', league: 'NBA', rating: 83, primaryColor: '#C8102E', secondaryColor: '#1D428A', espnAbbr: 'lac', neededPositions: ['PF', 'PG'], prestigeDesc: '최신식 인튜이트 돔을 개장하며 공수 밸런스가 잡힌 베테랑 로스터를 운영하는 팀이에요.' },
  { id: 'NBA_PHX', name: '피닉스 선즈', shortName: 'PHX', city: '피닉스', league: 'NBA', rating: 84, primaryColor: '#1D1160', secondaryColor: '#E56020', espnAbbr: 'phx', neededPositions: ['PG', 'C'], prestigeDesc: '막강한 미드레인지 및 3점 화력을 보유한 애리조나의 자존심이에요.' },
  { id: 'NBA_SAC', name: '새크라멘토 킹스', shortName: 'SAC', city: '새크라멘토', league: 'NBA', rating: 82, primaryColor: '#5A2D81', secondaryColor: '#63727A', espnAbbr: 'sac', neededPositions: ['PF', 'SF'], prestigeDesc: '승리할 때마다 밤하늘에 보라색 빔(Light the Beam)을 쏘아 올리는 열정적인 구단이에요.' },
  { id: 'NBA_DAL', name: '댈러스 매버릭스', shortName: 'DAL', city: '댈러스', league: 'NBA', rating: 86, primaryColor: '#00538C', secondaryColor: '#002B5E', espnAbbr: 'dal', neededPositions: ['SF', 'PF'], prestigeDesc: '국제적인 슈퍼스타 계보를 이어오며 클러치 승부에 강한 텍사스의 강호예요.' },
  { id: 'NBA_HOU', name: '휴스턴 로키츠', shortName: 'HOU', city: '휴스턴', league: 'NBA', rating: 83, primaryColor: '#CE1141', secondaryColor: '#000000', espnAbbr: 'hou', neededPositions: ['SG', 'PG'], prestigeDesc: '강력한 수비 에너지와 젊은 유망주 코어의 성장세가 무서운 서부 다크호스예요.' },
  { id: 'NBA_MEM', name: '멤피스 그리즐리스', shortName: 'MEM', city: '멤피스', league: 'NBA', rating: 83, primaryColor: '#5D76A9', secondaryColor: '#12173F', espnAbbr: 'mem', neededPositions: ['SF', 'C'], prestigeDesc: '그릿앤그라인드(Grit & Grind) 정신과 폭발적인 운동능력을 자랑하는 구단이에요.' },
  { id: 'NBA_NOP', name: '뉴올리언스 펠리컨스', shortName: 'NOP', city: '뉴올리언스', league: 'NBA', rating: 81, primaryColor: '#0C2340', secondaryColor: '#C8102E', espnAbbr: 'no', neededPositions: ['PG', 'C'], prestigeDesc: '탄탄한 윙 뎁스와 파워풀한 인사이드 공격력을 갖춘 서부 팀이에요.' },
  { id: 'NBA_SAS', name: '샌안토니오 스퍼스', shortName: 'SAS', city: '샌안토니오', league: 'NBA', rating: 79, primaryColor: '#000000', secondaryColor: '#C4CED4', espnAbbr: 'sa', neededPositions: ['PG', 'SF'], prestigeDesc: '이타적인 패스 시스템과 글로벌 유망주 육성의 교과서로 불리는 명문 구단이에요.' },
];

export const NBA_TEAMS: TeamInfo[] = RAW_NBA_TEAMS.map((t) => ({
  ...t,
  direction: inferNbaDirection(t.rating),
}));

export const ALL_TEAMS: TeamInfo[] = [
  ...HIGH_SCHOOL_TEAMS,
  ...U_LEAGUE_TEAMS,
  ...KBL_TEAMS,
  SANGMU_TEAM,
  ...OVERSEAS_TEAMS,
  ...GLEAGUE_TEAMS,
  ...NCAA_TEAMS,
  ...NBA_TEAMS,
];

const ALL_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

function inferDynamicDirection(league: LeagueId, rating: number): TeamDirection {
  if (league === 'NBA') {
    return rating >= 84 ? 'CONTENDER' : rating >= 78 ? 'PLAYOFF_HUNT' : 'REBUILDING';
  }
  if (league === 'KBL') {
    return rating >= 70 ? 'CONTENDER' : rating >= 66 ? 'PLAYOFF_HUNT' : 'REBUILDING';
  }
  if (league === 'OVERSEAS' || league === 'GLEAGUE') {
    return rating >= 75 ? 'CONTENDER' : rating >= 72 ? 'PLAYOFF_HUNT' : 'REBUILDING';
  }
  if (league === 'NCAA') {
    return rating >= 77 ? 'CONTENDER' : rating >= 75 ? 'PLAYOFF_HUNT' : 'REBUILDING';
  }
  if (league === 'U_LEAGUE') {
    return rating >= 63 ? 'CONTENDER' : rating >= 60 ? 'PLAYOFF_HUNT' : 'REBUILDING';
  }
  return rating >= 60 ? 'CONTENDER' : 'PLAYOFF_HUNT';
}

function inferDynamicNeededPositions(team: TeamInfo, currentRating: number): Position[] {
  const baseNeeds = team.neededPositions && team.neededPositions.length > 0
    ? team.neededPositions
    : (['PG', 'SF', 'C'] as Position[]);
  const ratingDiff = Math.abs(currentRating - team.rating);
  if (ratingDiff === 0) return baseNeeds;
  // 구단 전력이 변동함에 따라 보강 필요 포지션도 시즌마다 자연스럽게 순환
  return baseNeeds.map((pos) => {
    const idx = ALL_POSITIONS.indexOf(pos);
    return ALL_POSITIONS[(idx + ratingDiff) % ALL_POSITIONS.length];
  });
}

export function getTeamById(
  teamId: string,
  dynamicRatings?: Record<string, number>
): TeamInfo | undefined {
  const found = ALL_TEAMS.find((t) => t.id === teamId);
  if (!found) return undefined;
  if (dynamicRatings && typeof dynamicRatings[teamId] === 'number') {
    const newRating = dynamicRatings[teamId];
    return {
      ...found,
      rating: newRating,
      direction: inferDynamicDirection(found.league, newRating),
      neededPositions: inferDynamicNeededPositions(found, newRating),
    };
  }
  return found;
}

export function getTeamsByLeague(
  league: LeagueId,
  dynamicRatings?: Record<string, number>
): TeamInfo[] {
  return ALL_TEAMS.filter((t) => t.league === league && !t.isMilitaryTeam).map(
    (t) => getTeamById(t.id, dynamicRatings) || t
  );
}

/**
 * 특정 팀 인덱스([0] 등) 하드코딩 없이 선수의 포지션 니즈와 구단 기조에 맞춰 동적으로 최적 구단 선정
 */
export function selectBestFitTeamForPlayer(
  league: LeagueId,
  primaryPos: Position,
  secondaryPos: Position | null,
  dynamicRatings?: Record<string, number>,
  rng: () => number = Math.random
): TeamInfo {
  const pool = getTeamsByLeague(league, dynamicRatings);
  const scored = pool
    .map((team) => {
      const needs = team.neededPositions || [];
      const fitScore =
        (needs.includes(primaryPos) ? 6 : 0) +
        (secondaryPos && needs.includes(secondaryPos) ? 3 : 0) +
        (team.direction === 'REBUILDING' ? 2 : 0) +
        (rng() * 3 - 1.5);
      return { team, fitScore };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
  return scored[0]?.team || pool[0];
}

/**
 * 매 오프시즌마다 AI 구단들의 전력(rating)이 ±3 범위 내에서 유동적으로 변화
 */
export function evolveLeagueTeamRatings(
  currentMap: Record<string, number>,
  rng: () => number = Math.random
): Record<string, number> {
  const nextMap: Record<string, number> = { ...currentMap };
  for (const team of ALL_TEAMS) {
    if (team.isMilitaryTeam) continue;
    const baseRating = currentMap[team.id] ?? team.rating;
    const delta = Math.floor(rng() * 7) - 3; // -3 ~ +3
    let minR = 52;
    let maxR = 92;
    if (team.league === 'HIGH_SCHOOL') {
      minR = 54;
      maxR = 63;
    } else if (team.league === 'U_LEAGUE') {
      minR = 58;
      maxR = 67;
    } else if (team.league === 'KBL') {
      minR = 64;
      maxR = 75;
    } else if (team.league === 'OVERSEAS' || team.league === 'GLEAGUE') {
      minR = 70;
      maxR = 79;
    } else if (team.league === 'NCAA') {
      minR = 73;
      maxR = 80;
    } else if (team.league === 'NBA') {
      minR = 72;
      maxR = 92;
    }
    const reversion =
      baseRating > (minR + maxR) / 2 + 4
        ? -1
        : baseRating < (minR + maxR) / 2 - 4
        ? 1
        : 0;
    nextMap[team.id] = Math.max(minR, Math.min(maxR, baseRating + delta + reversion));
  }
  return nextMap;
}

