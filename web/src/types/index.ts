import type { TruthMix } from "../utils/statsMix";
import type { ReplayMapGrid } from "../utils/replayParser";

// ===== 도메인 공용 타입 =====

// 기본 종족 (통계 집계 기준)
export type BaseRace = "테란" | "프로토스" | "저그";

// 경기결과 시 선택 가능한 종족 (랜덤은 어떤 종족이 나왔는지 구분하지 않고 통일)
/* 종족의 임자는 재생 패키지다(components/replay/race) — 그 패키지가 아는 유일한 앱 어휘라
   거기 두어야 패키지가 이 파일을 안 끌고 간다. 앱은 여기서 그대로 읽는다. */
import type { Race } from "scplay";

export type { Race };

// 경기 결과. not_held = 미실시(승패 없음, 통계 집계 제외)
// "unknown"(요청: 결과 모름) — 리플레이가 승자를 못 가린 판을 그대로 등록한다. 래더에선
// 빠지고, 통계에선 전적·승률에만 안 센다(서버 schemas.GameOutcome과 짝).
export type GameOutcome = "team1" | "team2" | "draw" | "not_held" | "unknown";

/* 경기유형 코드 — team1/team2 인원수와 별개로 "어떤 성격의 판인가"를 적는 값.
   0101 일대일 · 0102 팀전 · 0103 난투(프리 포 올).
   ★ **이름·집계 규칙은 여기 안 적는다** — constants/gameTypes.ts의 표 하나가 다 진다.
     유형이 늘 때 고칠 자리를 하나로 두려고 그렇게 나눠 놓았다(요청: "앞으로도 더
     추가될 수도 있어"): 이 줄에 코드를 더하고, 그 표에 줄 하나를 더하면 끝이다. */
export type GameType = "0101" | "0102" | "0103";

// 회원 이용 상태 — 가입 시 pending, 운영자가 승인하면 active, 정지시키면 suspended
export type MemberStatus = "pending" | "active" | "suspended" | "withdrawn";

// 회원 권한 — 0202=운영자, 0203=회원.
export type MemberRole = "0202" | "0203";

// 회원
export interface Member {
  id: string;
  nickname: string;
  battletag: string;
  insta: string;
  avatar: string | null; // data URL 또는 이미지 URL
  // 리플레이(.rep)에 실제로 기록되는 게임 내 표시 이름들. battletag와 다를 수 있어(예전
  // Battle.net 계정명, 부계정 등) 리플레이 일괄 등록의 회원 매칭 전용으로 따로 저장한다.
  // 회원당 최대 3개, 오래된순으로 정렬돼 있다.
  replayAliases: string[];
  roles: MemberRole[];
  status: MemberStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601 — status 변경(승인/정지/탈퇴 등)도 이 값을 갱신시킨다
}

// 회원가입 요청 페이로드
export interface SignupPayload {
  id: string;
  password: string;
  nickname: string;
  battletag: string;
  replayAliases: string[];
  insta: string;
  avatar: string | null;
}

// 운영자가 회원 화면에서 회원을 바로 만들 때 쓰는 페이로드 — 가입과 달리
// replayAliases는 선택이고(운영자가 아직 실제 플레이 이름을 모를 수 있음, 0개 허용),
// 승인 절차 없이 즉시 active로 만들어진다.
export interface MemberCreatePayload {
  id: string;
  password: string;
  nickname: string;
  battletag: string;
  replayAliases?: string[];
  insta: string;
  avatar: string | null;
}

// 배틀태그로 못 찾은 리플레이 참가자 이름을 컴퓨터/비회원으로 기억해두는 분류 —
// replay_name_classifications 테이블과 1:1 대응.
export type ReplayNameKind = "computer" | "unregistered";
export interface ReplayNameClassificationEntry {
  rawName: string;
  kind: ReplayNameKind;
}

// 유저연결 화면 — 리플레이 원본 이름(rawName) 하나가 지금 회원/컴퓨터/비회원
// 중 무엇으로 연결돼 있는지(또는 아직 연결이 없는지).
export type ReplayNameMappingKind = "member" | "computer" | "unregistered" | "unresolved";
export interface ReplayNameMappingMember {
  id: string;
  nickname: string;
  battletag: string;
  avatar: string | null;
}
export interface ReplayNameMappingEntry {
  rawName: string;
  kind: ReplayNameMappingKind;
  member: ReplayNameMappingMember | null;
  // 이 이름이 마지막으로 등장한 경기 날짜(YYYY-MM-DD) — 미해결 항목을 최근 순으로 보여주는
  // 데 쓴다. 단건 저장 응답에서는 항상 null.
  lastSeen: string | null;
  // 이 이름이 등장한 경기 수 — 미매핑 목록의 등장횟수순 정렬(요청)에 쓴다. 회원으로
  // 연결된 이름과 단건 저장 응답에서는 null.
  appearances?: number | null;
  // 이 게임아이디로 등록된 경기가 하나라도 있는지 — 있으면 휴지통(완전 삭제)이 막힌다.
  // 화면에서 삭제를 못 누르게 하고 경고를 띄운다. 단건 저장 응답에서는 false.
  hasMatches: boolean;
}

// 경기 내 한 명의 참가 슬롯
export interface GameResultSlot {
  memberId: string;
  race: Race | ""; // "" = 종족 미선택 (폼 작성 중). "랜덤"은 회원 주종족 개념일 뿐 저장은 안 됨
  // 리플레이에서 파싱된 원본 게임 아이디 — 회원 매칭 여부와 무관하게 리플레이로 등록된
  // 모든 슬롯에 있다(수동 등록 참가자는 없음). 회원의 battletag는 나중에 바뀔 수 있어
  // 이 값이 이 경기 시점의 유일한 증거이므로, 서버는 한 번 저장하면 다시는 지우거나
  // 바꾸지 않는다. 컴퓨터/비회원 슬롯은 "컴퓨터 N"/"비회원 N" 같은 순번 라벨 대신 이
  // 값이 있으면 그대로 표시에도 쓴다.
  rawName?: string | null;
  // 아래 5개는 리플레이 파싱으로 자동 등록된 참가자만 값이 있다 (수동 등록은 전부 null)
  apm: number | null;
  eapm: number | null;
  cmdCount: number | null;
  effectiveCmdCount: number | null;
  // 커맨드 스트림에서 센 '생산' 지표(유닛 훈련+건물 건설+변태 커맨드 수). 커맨드 스트림을
  // 못 읽은 리플레이/수동 등록은 null.
  buildCount: number | null;
  /* (걷음) buildMix — 경기 하나의 생산 구성은 이제 슬롯에 안 싣는다. 통계가 보는 값은
     서버가 참값에서 낸 합계(MemberStats.truthMix)뿐이고, 그것은 아래에 그대로 있다. */
}

// 리플레이(.rep). 서버는 별도 replays 테이블에 풀 메타데이터로 저장하고 경기는 그 id로
// 매핑한다. originalName은 업로드된 원본 파일명, displayName은 알아보기 쉽게 생성한
// 파일명(화면 표시/다운로드에 쓴다). url 은 저장 후 실제 접근 URL.
export interface Replay {
  id: number;
  originalName: string;
  displayName: string;
  url: string;
}

// 리플레이 업로드/유지 payload — 신규 업로드 시 url은 data URL(base64), 기존 리플레이를
// 그대로 유지할 땐 서버 저장 URL(서버가 변경 없음으로 처리). id는 서버가 부여하므로 없다.
export interface ReplayUpload {
  originalName: string;
  displayName: string;
  url: string;
}

// 경기 작성자 (수정/삭제 권한 판단 및 표시용)
export interface GameResultAuthor {
  id: string;
  nickname: string;
}

// 경기 댓글(메모)에 언급(@)된 회원 — 렌더 시 인라인 칩으로 표시한다.
export interface ActivityCommentMention {
  memberId: string;
  nickname: string;
}

export interface ActivityCommentAuthor {
  memberId: string;
  nickname: string;
  avatar: string | null;
}

// 경기 하나에 달린 댓글(메모) 한 건 — 게시판 댓글처럼 작성자와 본문(최대 50자)으로 이뤄지고
// 본인/운영자만 수정·삭제할 수 있다(canEdit). 본문에 @닉네임으로 언급 가능.
// 랭크(포인트/순위) 변동 이벤트 — 서버가 경기 등록/삭제 때마다 스냅샷으로 계산·저장해 두고,
// 실제 변동(shifts)이 있었던 것만 활동에 노출한다.
export interface RankingShiftEntry {
  memberId: string;
  nickname: string;
  from: number | null; // null = 순위권 밖에서 신규 진입
  to: number;
  // 포인트 변동(요청) — 이 필드가 생기기 전에 쌓인 스냅샷에는 없다. 둘 다 있을 때만 쓴다.
  fromPoints?: number | null;
  toPoints?: number | null;
}
/** 하루치 스냅샷 안의 경기유형 한 칸 — 카드가 좌우로 나눠 그리는 단위다(요청). */
export interface RankingShiftSection {
  matchType: GameType;
  shifts: RankingShiftEntry[];
}
/** 하루치 랭크 변동 스냅샷 — 하루에 한 건이고 그 안에 유형별 칸을 담는다(요청).
 *  유형이 늘어도 sections에 칸이 하나 더 붙을 뿐이라 이 형식은 그대로다. */
export interface RankingShift {
  id: number;
  reason: "daily" | "seed";
  createdAt: string;
  matchIds: number[];
  sections: RankingShiftSection[];
}

// 활동 댓글 — 대상(targetType, targetId)이 경기든 너 나와!든 순위변동 알림이든
// 같은 API 하나로 달린다.
export type ActivityTargetType =
  | "gameResult" | "challenge" | "rankingShift" | "leagueMatch" | "schedule" | "notice";
export interface ActivityComment {
  id: number;
  targetType: ActivityTargetType;
  targetId: number;
  text: string;
  author: ActivityCommentAuthor;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  mentions: ActivityCommentMention[];
}


// 저장된 경기
export interface GameResult {
  id: number;
  // 사람이 보고 지목하는 고유번호 — 등록 순서(id)가 아니라 실제 경기 시각 기준(리플레이가
  // 있으면 실제 시작 시각, 없으면 경기 날짜)이라 id와 순서가 다를 수 있다. 형식:
  // YYMMDDHHMMSS + 2자리 일련번호. 한 번 배정되면 이후 수정에서도 바뀌지 않는다.
  matchNo: string;
  date: string; // YYYY-MM-DD
  team1: GameResultSlot[];
  team2: GameResultSlot[];
  result: GameOutcome;
  matchType: GameType; // 경기유형
  /** 리플레이 머리말의 **게임 갈래 번호**(요청) — 멜리 2 · 일대일 4 · 유즈맵 10 ·
   *  팀멜리 11 · Top vs Bottom 15. 우리가 매기는 matchType과 다른 것이다: 저것은 우리
   *  판정이고 이것은 게임이 적어 둔 사실이다. 서버가 이 값으로 못 받는 갈래를 거른다.
   *  수기 등록과 못 읽은 리플레이는 모르므로 **안 보낸다**(없으면 서버도 안 막는다). */
  gameType?: number;
  replay: Replay | null; // 리플레이(.rep) — 없으면 수기등록
  createdBy: GameResultAuthor | null; // 작성자가 탈퇴 등으로 사라졌으면 null
  // 아래 3개는 리플레이 파싱으로만 채워진다 (수동 등록 경기는 항상 null)
  mapName: string | null;
  gameStartedAt: string | null; // ISO 8601 (리플레이 실제 시작 시각 — date와 별개)
  durationSeconds: number | null;
  // 이 경기 맵의 지형 격자를 가리키는 해시 — 미니맵을 그리는 데 쓴다. 격자 자체는 경기마다
  // 오지 않고(같은 맵을 쓰는 경기가 수십 건이라 22KB짜리가 되풀이된다) 이 해시로 따로
  // 받아 온다(api.getReplayMaps). 리플레이 없는 수기 등록과 옛 경기는 null.
  mapHash: string | null;
  // 이 맵이 묶인 대표맵 이름(서버가 목록에 실어 준다) — 격자 캐시가 오기 전에도 알약·머리줄이
  // 처음부터 이 이름으로 선다(요청: 맵 이름이 중간에 바뀌지 않게). 안 묶였으면 null.
  mapCanonName?: string | null;
  // 게임 상세 페이지 조회수(요청) — 페이지가 열릴 때마다 서버가 1씩 늘린다.
  viewCount?: number;
}

// 경기 생성/수정 요청 (id, 작성자는 서버가 채움). 리플레이는 업로드 payload(id 없음)로 보낸다.
// 댓글은 별도 API로 관리하므로 경기 저장 payload에는 넣지 않는다.
export type NewGameResult = Omit<GameResult, "id" | "matchNo" | "createdBy" | "replay" | "mapHash"> & {
  replay: ReplayUpload | null;
  // 보낼 때는 해시가 아니라 격자 자체를 싣는다 — 서버가 같은 해시를 이미 갖고 있으면 버리고
  // 해시만 이어 붙인다(요청: 맵이 동일하면 같은 미니맵을 함께 쓰자). 리플레이를 읽지 않은
  // 경로(수기 등록·수정 폼)에서는 null이고, 그때 서버는 기존 연결을 지우지 않는다.
  mapData: ReplayMapGrid | null;
};

// 경기결과 화면 무한스크롤용 커서 페이지 — 서버가 필터링/정렬까지 다 해서 내려준다.
export interface GameResultPage {
  items: GameResult[];
  nextCursor: string | null;
  hasMore: boolean;
  // 같은 필터 조건의 전체 건수 — 첫 페이지(커서 없음) 응답에만 값이 있고, 다음 페이지
  // 응답은 항상 null(다시 세지 않으므로 첫 응답 값을 그대로 들고 있어야 한다).
  total: number | null;
}

// 회원 통계 집계 결과. 실제 플레이한 종족별 집계는 아직 정확도가 떨어져 보류 중이라
// (경기결과 시 종족 입력은 계속 받지만) 지금은 전체 승/패/무만 집계한다.
export interface MemberStats {
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  /** 그 조건에서 BEST PLAYER로 뽑힌 횟수(요청) — 리플레이로 등록된 팀전에만 붙는 값이라, 개인전만
   *  뛰었거나 수기 등록·옛 경기뿐이면 0이다(옛 경기는 '경기 재분석'으로 채운다). */
  bests: number;
  /** 그중 진 판에서 뽑힌 수(요청: 졌잘싸 퀸) — 판을 가장 많이 만들고도 진 자리다.
   *  옛 응답에는 없다. */
  lostBests?: number;
  // 리플레이 파싱으로 apm/eapm/커맨드수 값이 있는 경기만 평균낸다. 그런 경기가 하나도 없으면 null.
  avgApm: number | null;
  avgEapm: number | null;
  avgCmd: number | null;
  avgEcmd: number | null;
  // 경기당 평균 '생산'(유닛 훈련+건물 건설+변태 커맨드 수). 리플레이 등록 경기만 반영, 없으면 null.
  avgBuild: number | null;
  /** 그 기간 경기들의 생산 구성 합계(statsMix.ts) — 도넛 셋을 그리는 값이다.
   *  구성이 실린 경기가 하나도 없거나 표본이 모자라면 null. */
  truthMix: TruthMix | null;
  /** (옛 이름) 서버가 `truthMix`로 바뀌기 전까지만 — 두 리포가 따로 배포돼서다. */
  buildMix?: TruthMix | null;
  /** 경기당 초반(5분) 일꾼 수(요청). 위와 같은 조건에서 null. */
  avgWorker5: number | null;
  /** truthMix에 실제로 더해진 경기 수 — 합계를 경기당 값으로 되돌릴 때 쓴다(평균 건설 수,
   *  공/방 평균 단계). 서버가 합계만 주고 나눗셈은 화면이 하는 이유는, 무엇을 무엇으로
   *  나눌지가 칸마다 다르기 때문이다(비율은 합계 그대로, 수치는 경기당). */
  mixPlays: number | null;
  /** 그 경기들의 '주요시간대' 총 길이(초) — 총합을 1분당 값으로 되돌릴 분모다(요청:
   *  시간에 영향받는 값은 모두 주요시간대 1분당). 초반 4분과 막판 1분을 뺀 구간이고, 그
   *  구간이 3분도 안 되는 짧은 경기는 아예 안 쌓인다(statsMix의 coreWindowOf).
   *  옛 경기에는 없다 — 운영 > 제어판의 '경기 재분석'을 돌려야 채워진다. */
  mixSeconds: number | null;
  /** 공/방/실드 평균 단계만의 분모 — 위 mixPlays와 따로 둔다. 3단계까지 올리려면 일정
   *  시간이 필요해서, 그만큼 길지 않은 경기는 아예 세지 않는다(요청). 옛 기록처럼 업그레이드
   *  값을 안 실은 경기도 여기서 빠진다 — 0으로 세면 평균이 그만큼 깎인다. */
  upPlays: number | null;
}

// 서버 집계(GET /api/game-results/stats) 응답 — 통계/랭킹 화면이 매치 원본을 직접 스캔하지 않고
// 이 결과를 그대로 쓴다. overall은 요청한 race 파라미터를 반영하고, byRace/mostPlayedRace는
// race 파라미터와 무관하게 항상 전체 종족 기준이다.
export interface MemberStatsEntry {
  memberId: string;
  overall: MemberStats;
  byRace: Record<BaseRace, MemberStats>;
  mostPlayedRace: Race | null;
  // 랭킹 순서 — 서버가 사람단위 점수(참가+우열) → 상대 강함(SoS) 순으로 가른 결과다.
  // 이 값(자리번호)으로만 클라이언트가 줄세운다. 0경기 회원도 모두 순위가 매겨진다(0점, 맨 아래).
  sortOrder: number | null;
  // 위 모든 기준까지 같아 완전 동률인 회원끼리 값이 같다 — 공동순위로 묶는 기준.
  tieGroup: number | null;
  // 랭킹 2순위 기준값(승자승 다음) — 우세 +1 / 동등 0 / 열세 -1을 사람별로 합산한 점수.
  // 카드에 이 숫자를 보여준다(경기 승점 대신). 순위 대상이 아니면 null.
  personScore: number | null;
  // 사람단위 우세/동등/열세 인원 — 랭킹 상세에서 쓴다.
  superiorCount: number | null;
  equalCount: number | null;
  inferiorCount: number | null;
  // 랭킹 총점 — TrueSkill 보수추정 레이팅(μ−3σ). 카드에 이 숫자를 보여주고 이 값으로 순위를
  // 매긴다. 음수 가능. 순위 대상이 아니면 null.
  rankScore: number | null;
  // TrueSkill 실력 추정(μ)·불확실성(σ). 순위 대상이 아니면 null.
  mu: number | null;
  sigma: number | null;
  // 이 경기유형에서 레이팅에 반영된 누적 경기 수. 순위 대상이 아니면 null.
  ratingGames: number | null;
  // 잠정 — 누적 경기가 기준 미만이라 레이팅이 아직 덜 여문 상태(뱃지 표시). 순위 대상 아니면 null.
  provisional: boolean | null;
}

// GET /api/game-results/rating-history — 랭킹 상세의 '경기당 점수 변화'. deltas는 이 회원이
// 뛴 경기의 matchNo → 그 판이 레이팅을 움직인 폭(양수=승). 레이팅(μ·σ)이 시간순 누적이라
// 백엔드가 계산해 준다. conservative는 카드에 뜨는 레이팅 자체(그 시점까지의 실력 점수)로,
// deltas의 합과는 다른 값이다.
export interface RatingHistoryResponse {
  deltas: Record<string, number>;
  mu: number | null;
  sigma: number | null;
  conservative: number | null;
  games: number;
  provisional: boolean;
}

// 유저 상성 한 쌍 — 두 회원의 1:1 상대전적(a/b는 회원 로그인 아이디, 무승부 별도).
export interface RivalryPair {
  a: string;
  b: string;
  aWins: number;
  bWins: number;
  draws: number;
}

/** 분포 한 줄 — 이름과 판수, 비율(%). 비율은 서버가 낸다(분모가 다섯 개의 합이 아니라
 *  그 분포가 센 판 전체라, 다섯 줄만 받는 화면에서는 되돌릴 수가 없다). */
export interface ClanBreakdownEntry {
  label: string;
  plays: number;
  ratio: number;
}

export interface GameResultStatsResponse {
  members: MemberStatsEntry[];
  /** 클랜 전체 한 줄(요청) — 회원별 값을 다시 평균 낸 것이 아니라 **같은 경기 행을 통째로
   *  한 번 더 묶은** 값이다. memberId는 빈 문자열이다(사람이 아니다). */
  clan: MemberStatsEntry;
  /** 맵·유형 분포 다섯씩(요청). 참가자가 아니라 **경기** 단위로 센 값이다. 범위는 편을
   *  갈라 붙은 판 — 팀전과 난투다(1:1은 래더가 보는 판이라 뺐다). 맵 이름은 리플레이
   *  원본이 아니라 사람이 지어 둔 대표 이름이다(원본을 쓰면 아류가 저마다 한 줄씩 선다). */
  clanMaps: ClanBreakdownEntry[];
  clanFormats: ClanBreakdownEntry[];
}

// 팀랭킹(GET /api/game-results/team-ranking) — 실제로 같은 편이었던 2인 이상 구성 하나가 한 행이다.
// dateFrom/dateTo를 안 넘기면 전체 경기가 대상, 넘기면(랭킹 화면의 월 기준 기본 집계) 그
// 기간만 대상이다.
export interface TeamRankEntry {
  // 개인 승점이 높은 순으로 서버가 이미 정렬해서 보내준다(화면은 이 순서 그대로 격자를 채운다).
  memberIds: string[];
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  // 승 +1, 무 0, 패 -1 — 음수일 수 있다.
  points: number;
}

export interface TeamRankingResponse {
  teams: TeamRankEntry[];
}

// 화면 라우팅 — 회원(게임아이디 연결 포함)은 운영자만, 나머지는 로그인한
// 회원 누구나 접근 가능(역할 기준으로만 판단 — 예전에 있던 메뉴 권한 매트릭스는 역할이
// 운영자/회원 둘로 단순화되면서 없앴다).
// "ranking"은 폐기 — 랭킹은 래더 화면이 이어받았다.
// 실제로 갈 수 있는 화면만 남긴다 — 기록실("match")·너 나와! 전용 화면("challenge")·
// 상성맵 화면("rivalry")은 메뉴에서 빠진 뒤 어디서도 이동하지 않아 함께 걷어냈다(요청).
//
// 한때 하나였던 "stats"가 둘로 갈렸다(요청: 래더와 내전은 메뉴 진입점부터 다르다).
//   "ladder" — 일대일 리더보드. 통계가 아니다: 줄 세운 순위표 하나가 화면의 전부다.
//   "clan"   — 내전 통계. 레이팅·순위가 없고 전적·생산·칭호를 본다.
/* 화면 열쇠 — "minimaps"는 이제 **대표맵** 화면이다(라벨은 AdminMenu에 있다). 열쇠 글자를
   그대로 두는 까닭: 이 값은 회원마다의 권한 행에 저장돼 있어서, 바꾸면 이미 권한을 받은
   사람들이 그 화면을 통째로 못 본다. 사람이 보는 글자가 아니라 **저장된 식별자**다. */
export type ScreenKey = "activity" | "ladder" | "clan" | "members" | "leagues" | "minimaps" | "control" | "scraps" | "guide";
/** 위 열쇠를 **값으로** 늘어놓은 것 — 주소에서 읽은 글자가 참인지 가릴 때 쓴다.
 *  열쇠 곁에 두는 까닭: 이 목록은 여태 App 안에만 있었는데, 주소를 읽는 자리가 App
 *  하나가 아니게 되면서(스토어의 screenBack) 목록이 갈릴 자리가 생겼다. 한 벌만 둔다. */
export const SCREEN_KEYS: ScreenKey[] = ["activity", "ladder", "clan", "members",
  "leagues", "minimaps", "control", "scraps", "guide"];

/* ── 외부 공유(요청: "외부 외부 공유용 리플레이 재생 목록") ────────────────────────────
   클럽 기록과 **표부터 다른 자리**다. 까닭은 서버 쪽 주석에 있다(extShare/models.py):
   클럽 경기의 참가자는 회원을 가리키는 NOT NULL이라, 인터넷에 공개된 프로 리플레이의
   선수는 애초에 들어갈 자리가 없다. 그래서 외부 공유는 제 표에 살고, 화면도 로고·메뉴
   없는 한 장짜리다. */
/** 재생 목록 하나 — 비밀번호·차례는 제어판이 볼 때만 실려 온다(문 앞에서는 안 나간다). */
export interface ExtShareList {
  id: number;
  name: string;
  gameCount: number;
  /** 비밀번호가 걸려 있나 — 비어 있으면 그냥 열린다(운영자가 그렇게 두었다는 뜻). */
  locked: boolean;
  password?: string;
  sortOrder?: number;
}

/** 외부 공유 경기 한 판 — 알맹이는 GameResult 그 꼴 그대로다(서버가 payload를 그대로 낸다).
 *  덧붙는 셋만 이 화면의 것이다. */
export type ExtShareGame = GameResult & {
  listId: number;
  sortOrder: number;
  /** 사람이 지은 제목(요청) — 비면 **보여주는 화면이** 선수 이름으로 짓는다(scplayer의
   *  gameTitleOf). 서버도 이 앱도 대체 이름을 안 짓는다(지시) — 기계가 지은 이름을 이
   *  칸에 실으면 "이 제목 누가 정했나"를 못 가린다. */
  title: string;
  /** 참값 자취를 이미 구웠나 — 제어판이 굽기 버튼을 켜고 끄는 데 쓴다. */
  hasTracks: boolean;
};

/** 스크랩해 둔 장면 하나(요청: "장면 스크랩 기능") — 담는 것은 공유 버튼이 만드는 그
 *  **주소 한 줄**이다(경기 번호·재생 시각·보던 자리·각도가 이미 거기 다 실려 있다).
 *  주소는 출처 없이(경로+질의) 오므로 여는 쪽이 지금 origin을 앞에 붙인다. */
export interface SceneScrap {
  id: number;
  /** 사람이 붙인 제목 — 안 붙였으면 공유 미리보기와 같은 제목이 들어와 있다. */
  title: string;
  /** 공유 미리보기의 설명 줄(맵 · 경기시간 · 장면 시각). 없으면 빈 문자열. */
  subtitle: string;
  link: string;
  gameNo?: string | null;
  createdAt: string;
}

// 랭킹/경기결과/전적통계 등 화면·메뉴 구성을 어느 버전 세트로 보여줄지 — 제어판에서 등록된
// 버전 중 하나로 배포하면 앱 전체가 즉시 바뀐다(개인별 설정이 아니라 서버에 저장된 전역 값).
// 숫자(정수 또는 소수, 예: "3", "3.1")로 구성된다(백엔드 정규식 제약과 동일 형식) — 계속
// 늘어나는 걸 전제로 유니언으로 고정하지 않는다. 숫자로 비교하려면 utils/appVersion.ts의
// versionNumber()를 쓴다.
export type AppVersion = string;

export interface AppVersionStatus {
  activeVersion: AppVersion;
  // 버전 안내(업데이트 안내 모달) 전역 표시 여부 — 관리자가 "버전 안내 설정"에서 끄면 false.
  noticeEnabled: boolean;
}

// 제어판의 버전 선택 팝업이 나열하는 '등록된 버전' 하나 — 서버 app_versions 레지스트리의 행.
export interface AppVersionInfo {
  number: AppVersion;
  // 이 버전이 배포된 뒤 처음 접속하는 회원에게 보여줄 안내 내용 — 한 줄에 한 항목(줄바꿈
  // 구분). 비어 있으면 그 버전은 안내를 띄우지 않는다. "버전 안내 설정"에서 편집한다.
  notes: string;
}

// "너 나와!" 도전장 — 경기결과/예약 시스템과는 독립된 게시판. 폼에서 직접 고르지 않고
// 지목 인원수로 서버가 정한다(1명=1:1, 2명 이상=팀전).
export type ChallengeMatchType = "0101" | "0102";
// "discarded" = 편지봉투를 열지 않고 사유 없이 "버림"(휴지통행) — 사유가 있는 "rejected"
// (거절)과 구분해 표시한다.
export type ChallengeTargetResponse = "pending" | "accepted" | "rejected" | "discarded";
// 4개 상태만 있다 — 응답대기(pending)/성사(confirmed, 너 나와 대기)/완료(done)/폐기(discarded,
// 휴지통). 거절·무응답·미실시·(레거시)취소는 모두 폐기로 통합됐다. 예정 시간이 지나도
// 결과가 안 들어왔으면 계속 성사(confirmed)다.
export type ChallengeStatus = "pending" | "confirmed" | "done" | "discarded";
// 도전자 쪽/지목된 쪽 — 리벤지 신청 자격 판정(패배한 쪽) 등에 쓰인다.
export type ChallengeSide = "creator" | "target";
// 확정 너 나와의 결과 — 이긴 쪽(creator/target) 외에 무승부(draw)/미실시(not_held)도 있다.
// not_held(미실시)는 완료가 아니라 폐기(휴지통)로 간다.
export type ChallengeResult = "creator" | "target" | "draw" | "not_held";

export interface ChallengeTarget {
  memberId: string;
  nickname: string;
  battletag: string;
  avatar: string | null;
  response: ChallengeTargetResponse;
  // 이 대상이 응답하며 남긴 한마디(선택) — 없으면 빈 문자열.
  responseMessage: string;
}

// 도전자와 같은 편(내 팀) — 본인은 자동 포함이라 이 목록엔 안 담기고, "본인 제외
// 나머지 팀원"만 온다. targets와 달리 개별 수락/거절이 없다.
export interface ChallengeOwnMember {
  memberId: string;
  nickname: string;
  battletag: string;
  avatar: string | null;
}

export interface Challenge {
  id: number;
  matchType: ChallengeMatchType;
  // 도전자가 호출 때 남긴 한마디(선택) — 없으면 빈 문자열.
  message: string;
  // 정렬/그룹핑/카운트다운용 파생 일시(UTC ISO) — 시간 미정이면 자정으로 채워져 온다.
  scheduledAt: string | null;
  // 실제 저장값 — 날짜 하나뿐이다(시각 필드는 없앴다).
  scheduledDate: string | null;
  // 약속 시간을 사람 말로 적어 둔 것 — "그날 봐서", "아무도 몰래" 같은 자유 텍스트(요청).
  // 안 적었으면 빈 문자열. 정렬/마감 계산에는 쓰지 않는다(그건 scheduledDate만 본다).
  scheduledTimeNote: string;
  status: ChallengeStatus;
  createdBy: { id: string; nickname: string; avatar: string | null };
  targets: ChallengeTarget[];
  ownMembers: ChallengeOwnMember[];
  createdAt: string;
  /** 마지막으로 손댄 시각 — 응답(수락/거절/버림), 일시 수정, 결과 입력, 취소가 전부 여기
   *  찍힌다. 활동 목록이 "새로 올라온 것(NEW)"과 "달라진 것(UPDATE)"을 가른다. */
  updatedAt: string;
  // 폐기(휴지통)된 시각(ISO) — 폐기 상태가 아니면 null. 휴지통을 "최근 버려진 순"으로 정렬한다.
  discardedAt: string | null;
  /** 그 폐기가 '취소'였다면 취소한 사람 — 아니면 null(상대의 거절·버림, 무응답 만료,
   *  미실시). 활동가 이 값으로 "취소"와 "만료"를 갈라 그 사람 자리에 적는다(요청). */
  canceledBy: { id: string; nickname: string; avatar: string | null } | null;
  // 확정 너 나와의 결과 — 아직 아무도 입력하지 않았으면 null.
  resultWinnerSide: ChallengeResult | null;
  /** 부른 사람이 올린 편지지 배경 사진 — 없으면 null이고 편지지는 평소의 유리 그대로다. */
  backdropUrl: string | null;
  /** 같은 사진에 로고·문구를 얹은 카카오 공유 카드판(사진의 원래 비율) — 없으면 종류별 기본 썸네일. */
  backdropShareUrl: string | null;
  /** 그 판의 실제 크기 — 카카오에 함께 넘겨야 원래 비율로 앉는다. */
  backdropShareWidth: number | null;
  backdropShareHeight: number | null;
}

export interface ChallengeCreatePayload {
  // 날짜만 정한다(시각 필드는 없앴다) — 날짜도 안 정하면 일정 미정.
  scheduledDate?: string | null;
  // "언제"를 사람 말로(선택, 30자). 날짜와 상관없이 따로 적을 수 있다.
  scheduledTimeNote?: string;
  // 호출 한마디(선택, 한글 50자).
  message?: string;
  targetMemberIds: string[];
  // 본인 제외 나머지 내 팀원(최대 3명, 본인 포함 최대 4명) — 안 넘기면 나 혼자.
  ownTeamMemberIds?: string[];
  /** 편지지 배경 사진(선택) — 브라우저에서 줄인 JPEG data URL(utils/image.ts). */
  backdrop?: string | null;
  /** 같은 사진에 로고·문구를 얹은 공유 카드판 — 사진의 원래 비율 그대로다. */
  backdropShare?: string | null;
}

// 기간 필터 프리셋 — "custom"일 때만 실제로 from/to(직접 입력) 값을 사용하고, 나머지는
// 화면이 오늘 날짜 기준으로 즉시 계산한다(periodPresetRange 참고). "all"은 기간 제한 없이
// 전체 기록을 본다(from/to 모두 빈 값).
export type PeriodPreset = "all" | "today" | "week" | "month" | "year" | "custom";

// 경기결과/통계 공용 검색 필터 상태 (정렬은 화면마다 의미가 달라 각 화면이 별도로 관리).
// race는 회원 프로필의 "주종족"이 아니라 실제 경기결과에서 가장 많이 플레이한 종족
// 기준 필터다 (computeMainPlayedRace 참고).
// ===== 리그(League/Tournament) — 운영자 전용, 단일 엘리미네이션 대진표 =====

export type LeagueMode = "team" | "individual";
export type LeagueStatus = "setup" | "active" | "completed";
export type LeagueMatchSide = "a" | "b";

export type LeaguePoolKind = "member" | "guest" | "computer";

export interface LeagueRosterMember {
  /** 이 자리에 앉은 선수풀 항목 — 끌어다 놓을 때 화면이 가리키는 열쇠다. */
  poolId: number;
  kind: LeaguePoolKind;
  /** 회원일 때의 login id. 비회원·컴퓨터는 빈 문자열이다. */
  memberId: string;
  nickname: string;
  battletag: string;
  avatar: string | null;
  position: number;
}

/** 선수풀 한 자리 — 리그의 참가자 명단(요청: 팀 짜기 전에 선수 추가).
 *  회원만 뛰는 게 아니라 비회원·컴퓨터도 있다(요청) — 그래서 로스터·세트 명단이 회원이
 *  아니라 **이 풀**을 가리킨다. */
export interface LeaguePoolMember {
  id: number;
  kind: LeaguePoolKind;
  /** 회원일 때의 login id. 비회원·컴퓨터는 빈 문자열이다. */
  memberId: string;
  nickname: string;
  battletag: string;
  avatar: string | null;
}

export interface LeagueTeam {
  id: number;
  label: string; // A, B, ... Z, AA, ...
  /** 이 팀의 자리 수(요청: 팀 명수 설정) — 로스터는 이보다 적을 수 있다(빈 칸). */
  size: number;
  roster: LeagueRosterMember[];
}

export interface LeagueMatchTeamRef {
  id: number;
  label: string;
}

export interface LeagueMatchSubstitution {
  teamId: number;
  rosterPosition: number;
  substituteMemberId: string;
  substituteNickname: string;
  note: string;
}

export interface LeagueMatch {
  id: number;
  round: number;
  slotInRound: number;
  teamA: LeagueMatchTeamRef | null;
  teamB: LeagueMatchTeamRef | null;
  /** 확정할 때 죽은 칸 — 아무도 안 앉은 가지다(요청: 확정을 누르면 필요 없는 칸이
   *  사라진다). 확정 전에는 늘 false다: 어느 가지가 살아남을지는 확정 순간에 정해진다. */
  isDead: boolean;
  scheduledAt: string | null;
  setsWonA: number | null;
  setsWonB: number | null;
  winnerTeamId: number | null;
  /** 경기 메모(요청) — 세트 정보처럼 진행이 리그마다 다른 것을 여기에 그대로 적는다.
   *  한때 이 자리에 로우(세트) 표가 있었는데, 서버가 진행의 모양을 정해 주면 그 틀에 안 맞는
   *  리그가 반드시 나와 적을 자리 자체가 없어졌다 — 자유롭게 적는 칸 하나가 무엇이든 담는다. */
  note: string;
  substitutions: LeagueMatchSubstitution[];
}

export interface League {
  id: number;
  name: string;
  mode: LeagueMode;
  status: LeagueStatus;
  // 대진표 생성 전엔 null — 생성 시점에 관리자가 정한 team_count 기준 다음 2의
  // 거듭제곱으로 확정된다.
  drawSize: number | null;
  // 대진표 생성 시 예약해둔 규모(실제 지금 만들어진 팀 수와 다를 수 있다) — 생성 전엔 null.
  plannedTeams: number | null;
  // 대진(시드)이 확정됐는지 — true면 1라운드 슬롯을 더 이상 바꿀 수 없다.
  bracketLocked: boolean;
  /** 선수풀 — 팀에 앉기 전의 참가자 전원. */
  pool: LeaguePoolMember[];
  teams: LeagueTeam[];
  matches: LeagueMatch[];
  createdAt: string;
}

export interface LeagueListItem {
  id: number;
  name: string;
  mode: LeagueMode;
  status: LeagueStatus;
  teamCount: number;
}

export interface LeagueCreatePayload {
  name: string;
  mode: LeagueMode;
  /* (걷어냄) bestOf — 몇 판제라는 값 자체가 없어졌다(요청: 경기 방식 제거). 세트 정보는
     경기의 메모(LeagueMatch.note)에 사람이 그대로 적는다. */
}

export interface LeagueUpdatePayload {
  name?: string;
}

/** 팀구성 일괄 저장의 한 팀 — id가 없으면 새 팀.
 *  roster는 **자리 단위**다: 선수풀 id를 자리 순서대로 담되 빈 칸은 null이다(요청 4·5의
 *  "칸 아무 곳에나 끌어다 놓기"와 "서로 맞바꾸기"가 이 모양이라야 뜻이 산다). */
export interface LeagueTeamCompositionEntry {
  id: number | null;
  size?: number;
  roster: (number | null)[];
}



// 대표맵 한 줄 — "빠른무한"·"투혼" 같은 **상위 이름**이다. 이름·판본만 다른 거의 같은 맵
// 격자 여럿이 이 한 줄에 묶이고, 통계의 맵 순위가 그 묶음으로 선다(요청).
//
// 한때 이 표는 '사람이 올려 둔 미니맵 그림'이었다. 지형이 참값으로 바뀌면서
// (ReplayMapGrid.terrain) 그림도 그 어림을 담던 칸도 설 자리가 없어졌다 — 남은 일은
// 이름을 묶는 것 하나다.
export interface MapCanon {
  id: number;
  name: string;
  /** 이 대표맵에 묶인 경기 수 — 어느 것부터 묶을지 정하는 기준. */
  matches?: number;
}

/** 제어판 맵 목록의 한 줄 — 격자(22KB)는 빼고 어떤 맵이 있는지만. */
export interface MapCatalogEntry {
  hash: string;
  name: string | null;
  width: number;
  height: number;
  /** 이 맵으로 치른 경기 수 — 어느 맵부터 묶을지 정하는 기준. */
  matches: number;
  /** 이 격자가 묶인 대표맵. 안 묶였으면 null이라 통계에 원본 이름으로 선다. */
  canonId: number | null;
  /** 맵 데이터에서 뽑은 참값 지형이 구워져 있나(요청: 지형 버튼이 맵마다 하나씩) —
   *  목록에는 있는지만 온다. 격자 자체는 재생 화면이 따로 묻는다. */
  hasTerrain?: boolean;
}

export interface MapCatalog {
  maps: MapCatalogEntry[];
  canons: MapCanon[];
}

/** 활동 목록의 아이템 하나 — 너 나와·랭크 변동·게임결과가 같은 것이다(요청).
 *
 *  화면의 한 줄이 곧 하나다. kind에 따라 채워지는 칸이 다를 뿐, 줄을 세우고 번호를 붙이고
 *  댓글을 다는 규칙은 셋이 똑같다. 게임결과만 여럿인 것은 한 자리에서 이어 친 경기가
 *  한 줄이기 때문이다. */
/** 리그 팀 로스터 한 사람 — 프사는 회원 목록에서 찾아 붙인다(닉네임만 오면 충분). */
export interface LeagueMatchMember {
  memberId: string;
  nickname: string;
}

/** 맞붙는 한 편 — 로스터가 사람 단위로 온다(카드가 세로로 한 줄씩 쌓기 때문). 로스터가
 *  비어 있는 팀은 라벨(A·B)만 남는다. */
export interface LeagueMatchTeam {
  label: string;
  members: LeagueMatchMember[];
}

/** 활동 목록에 뜨는 리그 경기 하나 — 일정이 적힌 경기만 온다(요청: 리그 매치에 일정
 *  등록 시 활동에 띄움). 대진표의 좌표(round·slot)나 대타 명단은 여기 없다: 활동 목록이
 *  알아야 하는 건 '언제 누가 붙나, 결과가 나왔나'뿐이다.
 *
 *  팀은 로스터로 부른다 — 라벨(A·B)은 대진표 밖에서는 뜻이 없다. */
export interface LeagueMatchActivity {
  id: number;
  leagueId: number;
  leagueName: string;
  /** "8강"처럼 사람이 부르는 라운드 이름. */
  roundName: string;
  teamA: LeagueMatchTeam | null;
  teamB: LeagueMatchTeam | null;
  scheduledAt: string | null;
  setsWonA: number | null;
  setsWonB: number | null;
  /** 어느 쪽이 이겼나 — 팀 이름으로 견주면 두 팀 이름이 같을 때 어긋난다. */
  winnerSide: "a" | "b" | null;
  /** 일정을 처음 적어 둔 때 — NEW의 기준. */
  postedAt: string;
  /** 마지막으로 손댄 때(일정 수정·결과 입력) — UPDATE의 기준. */
  updatedAt: string;
}

/** 일정에 붙은 첨부파일 한 개 — 내려받을 주소와 사람이 붙인 이름. */
export interface ScheduleFile {
  name: string;
  url: string;
  /** 바이트 수 — 카드에 "1.2MB"처럼 적는 데만 쓴다. */
  size: number;
}

/** 참가표시를 한 사람 — 아직 답 안 한 사람은 아예 목록에 없다. */
export interface ScheduleAttendee {
  memberId: string;
  nickname: string;
  avatar: string | null;
  response: "going" | "notGoing";
}

/** 모임 일정 하나(요청: "일정 등록").
 *
 *  너 나와!와 나란히 서지만 성격이 다르다 — 지목한 상대도 성사 조건도 없어서 상태 개념이
 *  통째로 없다. 참가표시는 성사 조건이 아니라 "나 갈게"라는 손들기다. */
export interface Schedule {
  id: number;
  title: string;
  /** YYYY-MM-DD — 필수다(요청: "일정 일시(시간은 선택)도 필수값"). */
  scheduledDate: string;
  /** HH:MM — 안 정했으면 null. */
  scheduledTime: string | null;
  content: string;
  linkUrl: string;
  files: ScheduleFile[];
  attendees: ScheduleAttendee[];
  createdBy: { id: string; nickname: string; avatar: string | null };
  createdAt: string;
  /** 마지막으로 손댄 때 — 활동 목록의 UPDATE 판정에 쓴다. */
  updatedAt: string;
}

/** 일정 등록/수정 폼이 보내는 것 — 두 경우가 같은 모양이다(폼이 하나라서다).
 *
 *  files는 '최종 목록'이다: 이미 올라가 있는 파일은 url만, 새로 고른 파일은 data까지
 *  담는다. 여기 없는 파일은 지운 것으로 본다. */
export interface ScheduleWrite {
  title: string;
  scheduledDate: string;
  scheduledTime: string | null;
  content: string;
  linkUrl: string;
  files: (ScheduleFile | { name: string; data: string })[];
}

/** 활동에 뜨는 알림 하나(요청: 활동 피드에 알림 유형) — 서버가 남기는 한 줄이다.
 *  무엇을 그릴지는 kind가 정한다. */
export interface ActivityNotice {
  id: number;
  /** "rankingShift" 등. 모르는 종류는 화면이 조용히 건너뛴다. */
  kind: string;
  /** 그 종류가 쓰는 값.
   *  - rankingShift: 스냅샷 그대로({ reason, matchIds, sections }) — 저장은 여전히
   *    제 테이블에 있고 활동에서만 알림으로 감싸 나온다(요청: 표시만 통합).
   *  닉네임은 안 담겨 있다 — 이름은 바뀌므로 볼 때 지금 회원 정보로 푼다. */
  payload: {
    reason?: RankingShift["reason"];
    matchIds?: number[];
    sections?: RankingShiftSection[];
  };
  createdAt: string;
}

export interface ActivityFeedItem {
  key: string;
  /* 랭크 변동은 제 종류를 안 갖는다(요청: rankingShift 제거하고 알림 유형으로 통합) —
     서버가 남기는 한 줄이라는 점에서 칭호 변경과 같은 것이라, 화면에서도 같은 자리에 선다.
     저장은 그대로라 댓글 대상(targetType)은 예전처럼 rankingShift다. */
  kind: "challenge" | "gameResultPost" | "leagueMatch" | "schedule" | "notice";
  /* 줄 번호(no)는 화면에서 걷어냈다(요청: "별 의미 없는 듯") — 서버는 아직 실어 보내지만
     쓰는 곳이 없어 여기서도 받지 않는다. */
  challenge?: Challenge | null;
  gameResults: GameResult[];
  leagueMatch?: LeagueMatchActivity | null;
  schedule?: Schedule | null;
  notice?: ActivityNotice | null;
  /** 이 줄에 달린 댓글 전부. 각 댓글이 제 대상을 들고 있어 카드가 자기 것을 찾아 붙는다. */
  comments: ActivityComment[];
}

export interface ActivityFeedPage {
  /** 목록 전체의 줄 수. */
  total: number;
  /** 활동 낱개의 수 — 줄이 아니라 '건'(묶인 경기는 그 안의 판 수만큼). */
  totalActivities: number;
  items: ActivityFeedItem[];
  nextCursor: string | null;
}
