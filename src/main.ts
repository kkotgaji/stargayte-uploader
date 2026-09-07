// 스타게이트 자동 등록기 — 트레이에 상주하며 스타크래프트 AutoSave 폴더의 새 리플레이를
// 홈페이지에 등록한다. 등록 절차는 제 것이 아니다: 사이트의 /uploader.html을 숨은 창으로
// 띄워 파일을 넘기고 결과만 받는다(page.ts). 설정 화면은 없다. 로그인 창(그 페이지)은
// 세션이 없거나 죽었을 때만 보인다.
import { app, Menu, Notification, Tray, nativeImage, shell } from "electron";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { INITIAL_SCAN_FROM, RETRY_MAX, RETRY_MS, SITE_BASE, UPLOADER_PAGE, VERSION, replayDirOf } from "./config";
import { initLog, log } from "./log";
import { SitePage, type PageUser } from "./page";
import { Store } from "./store";
import { flushUploaded, noteUploaded } from "./toast";
import { ReplayWatcher } from "./watcher";

// 한 번에 하나만 — 두 번 켜면 먼저 켜진 쪽이 그대로 남는다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void boot();
}

let tray: Tray | null = null;
let store: Store;
let page: SitePage;
let user: PageUser | null = null;
let watcher: ReplayWatcher | null = null;
let status = "준비 중";
let recent: string[] = [];

const assetPath = (name: string): string => join(app.isPackaged ? process.resourcesPath : join(__dirname, ".."), "assets", name);
const replayDir = (): string => replayDirOf(process.platform, { home: app.getPath("home"), documents: app.getPath("documents") });

async function boot(): Promise<void> {
  await app.whenReady();
  app.setAppUserModelId("com.stargayte.uploader");
  initLog(app.getPath("userData"));
  log(`시작 v${VERSION} · 사이트 ${SITE_BASE}`);
  store = new Store(app.getPath("userData"));

  // 윈도우·맥 로그인 때 함께 뜬다(설치본에서만 — 개발 실행은 등록하지 않는다).
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
  // 맥: 독(Dock)에 안 나온다 — 메뉴 막대(트레이)에만 사는 앱이다.
  if (process.platform === "darwin") app.dock?.hide();

  makeTray();
  app.on("second-instance", () => { if (!user) page.show(); });
  app.on("window-all-closed", () => { /* 창이 다 닫혀도 트레이로 남는다 */ });
  app.on("before-quit", () => { watcher?.stop(); page.destroy(); });

  page = new SitePage(UPLOADER_PAGE, join(__dirname, "preload.cjs"), assetPath("icon.png"), {
    onReady: (u) => {
      user = u;
      if (u) {
        log(`사이트 창 준비 — ${u.nickname}(${u.id})`);
        page.hide();
        if (!watcher) startWatching();
        else setStatus(watcher.watching ? "감시 중" : "리플레이 폴더가 아직 없어요(스타를 한 판 하면 생겨요)");
      } else {
        log("사이트 창 준비 — 로그인 필요");
        setStatus("로그인 필요");
        page.show();
      }
    },
    onLoginOk: (u) => {
      user = u;
      log(`로그인: ${u.id}`);
      setTimeout(() => page.hide(), 800);
      if (!watcher) startWatching();
      else setStatus(watcher.watching ? "감시 중" : "리플레이 폴더가 아직 없어요");
    },
    onNeedsLogin: (why) => {
      log(`로그인 필요: ${why}`);
      user = null;
      setStatus("로그인 필요");
      notify("다시 로그인해 주세요", why || "세션이 끝났어요.");
      page.show();
    },
  });
  setStatus("사이트에 연결 중");
  page.open();
}

// ── 트레이 ──────────────────────────────────────────────────────────────────
function makeTray(): void {
  const img = nativeImage.createFromPath(assetPath("icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on("double-click", () => { if (!user) page.show(); });
  refreshTray();
}

function setStatus(s: string): void {
  status = s;
  refreshTray();
}

function noteRecent(line: string): void {
  recent = [line, ...recent].slice(0, 8);
  refreshTray();
}

function refreshTray(): void {
  if (!tray) return;
  const who = user ? `${user.nickname || user.id}로 로그인됨` : "로그인 필요";
  tray.setToolTip(`스타게이트 등록기 — ${status}`);
  const menu = Menu.buildFromTemplate([
    { label: `스타게이트 등록기 v${VERSION}`, enabled: false },
    { label: who, enabled: false },
    { label: `상태: ${status}`, enabled: false },
    { type: "separator" },
    ...(recent.length > 0
      ? [{ label: "최근", enabled: false } as const, ...recent.map((r) => ({ label: r, enabled: false }))]
      : [{ label: "아직 처리한 리플레이가 없어요", enabled: false }]),
    { type: "separator" },
    { label: "지금 폴더 다시 검사", click: () => { void watcher?.rescan(); }, enabled: !!watcher },
    { label: "리플레이 폴더 열기", click: () => { void shell.openPath(replayDir()); } },
    { label: "스타게이트 열기", click: () => { void shell.openExternal(SITE_BASE); } },
    { type: "separator" },
    { label: user ? "다른 계정으로 로그인" : "로그인", click: () => { if (user) page.logout(); else page.show(); } },
    { label: "종료", click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ── 감시·처리 ──────────────────────────────────────────────────────────────
function startWatching(): void {
  watcher?.stop();
  watcher = new ReplayWatcher({
    dir: replayDir(),
    since: () => Date.parse(store.ledger.since) || 0,
    seen: (p) => {
      const e = store.ledger.files[p];
      if (!e) return false;
      // 서버 오류로 실패한 파일은 RETRY_MS 뒤 재훑기에서 다시 잡힌다(RETRY_MAX까지).
      if (e.status !== "failed") return true;
      return (e.tries ?? 0) >= RETRY_MAX || Date.now() - Date.parse(e.at) < RETRY_MS;
    },
    onFile: handleFile,
    // 대기열이 다 빠졌을 때 한 번 — 그동안 올라간 건수를 토스트 하나로 알린다.
    onIdle: flushUploaded,
    onBatch: (n) => {
      // 처음 설치한 뒤의 첫 훑기 — 옛 리플레이를 한 번에 올리니 무엇을 하는지 알린다(알림 하나만,
      // 토스트는 다 올라간 뒤 "N건을 등록했습니다"로 한 번).
      if (!store.ledger.firstRun) return;
      store.ledger.firstRun = false;
      if (n === 0) return;
      const from = INITIAL_SCAN_FROM.slice(0, 10);
      log(`첫 훑기: ${from} 이후 리플레이 ${n}건`);
      notify("스타게이트 등록기", `${from} 이후 리플레이 ${n}건을 찾아 차례로 올려요. 끝나면 알려드릴게요.`);
    },
  });
  watcher.start();
  setStatus(watcher.watching ? "감시 중" : "리플레이 폴더가 아직 없어요(스타를 한 판 하면 생겨요)");
}

async function handleFile(path: string): Promise<void> {
  const name = path.split(/[\\/]/).pop() ?? path;
  setStatus(`처리 중: ${name}`);
  const prev = store.ledger.files[path];
  try {
    const out = await page.run(name, await readFile(path));
    const at = new Date().toISOString();
    if (out.kind === "registered") {
      store.ledger.files[path] = { at, status: "registered", matchNo: out.matchNo, note: out.summary };
      log(`등록 ${out.matchNo}: ${name} — ${out.summary}`);
      noteRecent(`✔ 등록 ${out.matchNo} · ${out.summary}`);
      noteUploaded();
    } else if (out.kind === "merged" || out.kind === "duplicate") {
      store.ledger.files[path] = { at, status: out.kind, note: out.summary };
      log(`${out.kind === "merged" ? "기존 경기에 갱신" : "이미 등록됨"}: ${name} — ${out.summary}`);
      noteRecent(`${out.kind === "merged" ? "↻ 기존 경기 갱신" : "= 이미 등록됨"} · ${out.summary}`);
      // 다른 사람이 먼저 올린 같은 경기도 "올라갔다"로 센다 — 내 파일이 사이트에 반영된 건 같다.
      if (out.kind === "merged") noteUploaded();
    } else {
      store.ledger.files[path] = { at, status: "skipped", note: out.reason };
      log(`건너뜀: ${name} — ${out.reason}`);
      noteRecent(`– 건너뜀 · ${out.reason}`);
    }
  } catch (e) {
    // 세션이 죽은 경우는 페이지가 needs-login으로 따로 알린다 — 여기선 실패로 적고 나중에 다시 한다.
    const tries = (prev?.tries ?? 0) + 1;
    const msg = e instanceof Error ? e.message : String(e);
    store.ledger.files[path] = { at: new Date().toISOString(), status: "failed", note: msg, tries };
    log(`실패(${tries}/${RETRY_MAX}): ${name} — ${msg}`);
    noteRecent(`✖ 실패 · ${name} · ${msg}`);
    if (tries === 1) notify("등록 실패 — 나중에 다시 시도해요", `${name}: ${msg}`);
  } finally {
    store.saveLedger();
    setStatus(watcher?.watching ? "감시 중" : "리플레이 폴더가 아직 없어요");
  }
}

function notify(title: string, body: string): void {
  try {
    if (Notification.isSupported()) new Notification({ title, body, icon: assetPath("icon.png") }).show();
  } catch { /* 알림이 막혀 있어도 등록엔 지장 없다 */ }
}
