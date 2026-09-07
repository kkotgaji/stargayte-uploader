// 자동 등록기의 고정 설정 — 사용자가 바꿀 수 있는 화면은 없다(요청: 기본값으로 포함, 변경 불가).
// 사이트 주소만 빌드 때 UPLOADER_SITE_BASE 환경변수로 박는다(build.mjs의 define).
//
// ★ 등록 규칙(회원 2명·유즈맵·결과 모름·2분 미만…)은 여기 없다 — **사이트가 갖는다**
//   (stargayte의 src/uploader/register.ts). 등록기는 사이트의 /uploader.html을 숨은 창으로
//   띄워 파일을 넘길 뿐이라, 사이트가 배포되면 규칙도 그대로 따라온다(page.ts 머리말).

declare const __SITE_BASE__: string;
declare const __VERSION__: string;

/** 스타게이트 홈페이지 — 숨은 창이 `${SITE_BASE}/uploader.html`을 띄운다. 빌드 때 박힌다(build.mjs, 기본은 운영 사이트). */
export const SITE_BASE: string = typeof __SITE_BASE__ === "string" ? __SITE_BASE__ : "https://stargayte.vercel.app";
export const UPLOADER_PAGE = `${SITE_BASE.replace(/\/$/, "")}/uploader.html`;
export const VERSION: string = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0";

/** 스타크래프트 리마스터가 게임이 끝날 때마다 리플레이를 두는 자리.
 *  · 윈도우: 문서\StarCraft\Maps\Replays\AutoSave — 문서 폴더가 OneDrive로 옮겨져 있어도
 *    Electron의 app.getPath("documents")가 따라간다.
 *  · 맥: ~/Library/Application Support/Blizzard/StarCraft/Maps/Replays/AutoSave (클럽 맥 유저 확인). */
export function replayDirOf(platform: NodeJS.Platform, paths: { home: string; documents: string }): string {
  const tail = ["StarCraft", "Maps", "Replays", "AutoSave"];
  const base = platform === "darwin" ? [paths.home, "Library", "Application Support", "Blizzard"] : [paths.documents];
  return [...base, ...tail].join(platform === "win32" ? "\\" : "/");
}

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

/** 사이트 창이 안 뜨면(네트워크 없음·사이트 죽음) 이 간격으로 다시 연다. */
export const PAGE_RETRY_MS = 60_000;
/** 파일 하나를 넘긴 뒤 이만큼 답이 없으면 실패로 친다(파싱 + 업로드 — 큰 리플레이도 1분이면 끝난다). */
export const JOB_TIMEOUT_MS = 5 * 60_000;
/** 처리할 파일이 생겼는데 사이트 창이 아직 준비 전이면 이만큼 기다린다. */
export const PAGE_WAIT_MS = 2 * 60_000;
