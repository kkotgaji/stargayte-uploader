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
 *  · 승자를 못 가린 경기 → 승패모름(not_held)으로 등록
 *  · 회원과 안 이어지는 참가자 → 비회원 슬롯으로 등록
 *  · 이미 등록된 경기(게임 시작 시각 일치) → 리플레이 정보만 기존 경기에 머지
 *  아래는 "조건 미달"로 건너뛰는 경우다(검토 화면이 사람 확인을 요구하던 것). */
export const RULES = {
  /** 이보다 짧은 경기는 시작하자마자 나간 판일 가능성이 커 건너뛴다(사이트의 SHORT_MATCH_SEC). */
  minDurationSec: 2 * 60,
  /** 조작량이 적어 관전자로 "추정"해 뺀 사람이 있으면 — 초반에 나간 참가자를 잘못 지운 것일 수 있어 건너뛴다. */
  skipIfGuessedObservers: true,
  /** 컴퓨터(AI)가 낀 경기 — 사이트 검토 화면의 기본값(포함)을 따른다. */
  skipIfComputer: false,
} as const;
