// 자동 등록기의 고정 설정 — 사용자가 바꿀 수 있는 화면은 없다(요청: 기본값으로 포함, 변경 불가).
// 서버 주소만 빌드 때 UPLOADER_API_BASE 환경변수로 박는다(build.mjs의 define).

declare const __API_BASE__: string;
declare const __VERSION__: string;

/** 경기결과 서버(stargayte-api). 빌드 때 UPLOADER_API_BASE로 박히고, 없으면 로컬 서버다. */
export const API_BASE: string = typeof __API_BASE__ === "string" ? __API_BASE__ : "http://localhost:8000";
export const VERSION: string = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0";

/** 스타크래프트 리마스터가 게임이 끝날 때마다 리플레이를 두는 자리 — 문서 폴더 아래.
 *  문서 폴더가 OneDrive로 옮겨져 있어도 Electron의 app.getPath("documents")가 따라간다. */
export const REPLAY_SUBDIR = ["StarCraft", "Maps", "Replays", "AutoSave"] as const;

/** 처음 설치했을 때 이 시각(KST 2026-07-01 0시) 이후의 리플레이를 한 번 훑어 올린다(요청).
 *  그 뒤로는 새로 생기는 파일만 본다. */
export const INITIAL_SCAN_FROM = "2026-07-01T00:00:00+09:00";

/** 파일이 다 써졌다고 볼 조건 — 크기가 이 시간 동안 안 바뀌고 mtime이 이만큼 지났으면. */
export const SETTLE_MS = 3000;
/** 감시 이벤트가 새지 않도록 주기적으로 폴더를 다시 훑는 간격. */
export const RESCAN_MS = 60_000;
/** 서버 오류(네트워크·5xx)로 못 올린 파일을 다시 시도하는 간격과 횟수. */
export const RETRY_MS = 5 * 60_000;
export const RETRY_MAX = 12;

/** 등록 규칙 — 홈페이지의 검토 화면이 사람에게 묻던 것을 여기서는 고정값으로 정한다.
 *  · 승자를 못 가린 경기 → 결과 모름(unknown)으로 등록(홈페이지와 같다 — 래더에서 빠지고
 *    통계에선 전적·승률에만 안 센다. not_held는 '미실시'라 뜻이 다르다)
 *  · 회원과 안 이어지는 참가자 → 비회원 슬롯으로 등록
 *  · 이미 등록된 경기(게임 시작 시각 일치) → 리플레이 정보만 기존 경기에 머지(서버가 지금
 *    것보다 긴 저장본이면 파일도 갈아 끼우고 다시 굽는다)
 *  아래는 "조건 미달"로 건너뛰는 경우다(검토 화면이 사람 확인을 요구하거나 자동 제외하던 것). */
export const RULES = {
  /** 이보다 짧은 경기는 시작하자마자 나간 판일 가능성이 커 건너뛴다(사이트의 SHORT_MATCH_SEC). */
  minDurationSec: 2 * 60,
  /** 조작량이 적어 관전자로 "추정"해 뺀 사람이 있으면 — 초반에 나간 참가자를 잘못 지운 것일 수 있어 건너뛴다. */
  skipIfGuessedObservers: true,
  /** 컴퓨터(AI)가 낀 경기 — 사이트 검토 화면의 기본값(포함)을 따른다. */
  skipIfComputer: false,
  /** 로스터에 **회원이 이만큼은** 있어야 등록한다(요청: 양 팀 합쳐 2명 — 꼭 한 팀에 한 명씩일
   *  필요는 없다. 혼자 비회원·컴퓨터하고만 한 판을 거르려는 것이다). 컴퓨터·비회원 슬롯은
   *  안 세고, 같은 회원이 두 자리를 차지할 수는 없으니 서로 다른 회원의 수다. 홈페이지의
   *  검토 화면이 같은 기준으로 자동 제외한다(replayDraft.ts의 memberSlotCount). */
  minMembers: 2,
} as const;

/** 서버가 등록을 **거절하는** 리플레이 갈래 — 유즈맵(10) 하나다(서버 schemas.py의
 *  UMS_GAME_TYPE, 홈페이지 replayDraft.ts의 SERVER_REJECTS_GAME_TYPE과 같은 표). 이 표는
 *  서버 규칙의 사본이다 — 여기가 좁으면 서버가 400으로 잡고, 넓으면 등록만 안 된다. */
export const REJECTED_GAME_TYPES: ReadonlySet<number> = new Set([10]);
