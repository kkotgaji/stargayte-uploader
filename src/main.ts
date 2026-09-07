// 스타게이트 자동 등록기 — 트레이에 상주하며 스타크래프트 AutoSave 폴더의 새 리플레이를
// 홈페이지에 등록한다. 설정 화면은 없다(config.ts의 고정 규칙). 로그인 창은 토큰이
// 없거나 죽었을 때만 뜬다.
import { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, safeStorage, shell } from "electron";
import { hostname } from "node:os";
import { join } from "node:path";
import { ApiError, HttpApi } from "./api";
import { API_BASE, INITIAL_SCAN_FROM, REPLAY_SUBDIR, RETRY_MAX, RETRY_MS, VERSION } from "./config";
import { initLog, log } from "./log";
import { processReplay } from "./pipeline";
import { Store, type AuthState } from "./store";
import { showToast, toastUploaded } from "./toast";
import { ReplayWatcher } from "./watcher";
import type { Member } from "../web/src/types";

// 한 번에 하나만 — 두 번 켜면 먼저 켜진 쪽이 그대로 남는다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void boot();
}

let tray: Tray | null = null;
let loginWin: BrowserWindow | null = null;
let store: Store;
let api: HttpApi;
let auth: AuthState | null = null;
let watcher: ReplayWatcher | null = null;
let members: Member[] = [];
let membersAt = 0;
let status = "준비 중";
let recent: string[] = [];

const assetPath = (name: string): string => join(app.isPackaged ? process.resourcesPath : join(__dirname, ".."), "assets", name);
const replayDir = (): string => join(app.getPath("documents"), ...REPLAY_SUBDIR);

async function boot(): Promise<void> {
  await app.whenReady();
  app.setAppUserModelId("com.stargayte.uploader");
  initLog(app.getPath("userData"));
  log(`시작 v${VERSION} · 서버 ${API_BASE}`);

  const crypto = safeStorage.isEncryptionAvailable()
    ? { encrypt: (s: string) => safeStorage.encryptString(s).toString("base64"), decrypt: (b: string) => safeStorage.decryptString(Buffer.from(b, "base64")) }
    // 암호화 저장소가 없는 환경(드묾) — 평문이지만 base64로만 감싼다.
    : { encrypt: (s: string) => Buffer.from(s).toString("base64"), decrypt: (b: string) => Buffer.from(b, "base64").toString() };
  store = new Store(app.getPath("userData"), crypto);
  api = new HttpApi(API_BASE, () => auth?.token ?? null);
  auth = store.readAuth();

  // 윈도우 시작 때 함께 뜬다(설치본에서만 — 개발 실행은 등록하지 않는다).
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });

  makeTray();
  app.on("second-instance", () => { if (!auth) openLogin(); });
  app.on("window-all-closed", () => { /* 창이 다 닫혀도 트레이로 남는다 */ });

  if (auth) startWatching();
  else openLogin();
}

// ── 트레이 ──────────────────────────────────────────────────────────────────
function makeTray(): void {
  const img = nativeImage.createFromPath(assetPath("icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on("double-click", () => { if (!auth) openLogin(); });
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
  const who = auth ? `${auth.nickname || auth.userId}로 로그인됨` : "로그인 필요";
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
    { label: "로그 열기", click: () => { void shell.openPath(join(app.getPath("userData"), "uploader.log")); } },
    { type: "separator" },
    { label: auth ? "다른 계정으로 로그인" : "로그인", click: () => openLogin() },
    { label: "종료", click: () => { watcher?.stop(); app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ── 로그인 창 ───────────────────────────────────────────────────────────────
function openLogin(): void {
  if (loginWin) { loginWin.focus(); return; }
  loginWin = new BrowserWindow({
    width: 380, height: 420, resizable: false, minimizable: false, maximizable: false,
    title: "스타게이트 등록기 로그인", autoHideMenuBar: true, icon: assetPath("icon.png"),
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  loginWin.on("closed", () => { loginWin = null; });
  void loginWin.loadFile(join(__dirname, "..", "login.html"));
}

ipcMain.handle("login", async (_e, id: string, password: string): Promise<{ ok: true; nickname: string } | { ok: false; error: string }> => {
  try {
    const res = await api.appLogin(id.trim(), password, hostname());
    auth = { token: res.appToken, expiresAt: res.expiresAt, userId: res.user.id, nickname: res.user.nickname };
    store.writeAuth(auth);
    log(`로그인: ${auth.userId}`);
    members = [];
    membersAt = 0;
    startWatching();
    setTimeout(() => loginWin?.close(), 600);
    return { ok: true, nickname: auth.nickname };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
ipcMain.handle("info", () => ({ version: VERSION, apiBase: API_BASE, replayDir: replayDir(), user: auth?.nickname ?? null }));

function dropAuth(why: string): void {
  log(`로그인 필요: ${why}`);
  auth = null;
  store.writeAuth(null);
  watcher?.stop();
  watcher = null;
  setStatus("로그인 필요");
  notify("다시 로그인해 주세요", why);
  openLogin();
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
    onBatch: (n) => {
      // 처음 설치한 뒤의 첫 훑기 — 옛 리플레이를 한 번에 올리니 무엇을 하는지 알린다.
      if (!store.ledger.firstRun) return;
      store.ledger.firstRun = false;
      if (n === 0) return;
      const from = INITIAL_SCAN_FROM.slice(0, 10);
      log(`첫 훑기: ${from} 이후 리플레이 ${n}건`);
      showToast(`${from} 이후 리플레이 ${n}건을 스타게이트에 올립니다.`);
      notify("스타게이트 등록기", `${from} 이후 리플레이 ${n}건을 찾아 차례로 올려요. 끝나면 알려드릴게요.`);
    },
  });
  watcher.start();
  setStatus(watcher.watching ? "감시 중" : "리플레이 폴더가 아직 없어요(스타를 한 판 하면 생겨요)");
}

async function membersFresh(): Promise<Member[]> {
  // 회원 목록은 10분마다만 새로 받는다 — 새 회원이 가입해도 그 안에 붙는다.
  if (members.length === 0 || Date.now() - membersAt > 10 * 60_000) {
    members = await api.getMembers();
    membersAt = Date.now();
  }
  return members;
}

async function handleFile(path: string): Promise<void> {
  const name = path.split(/[\\/]/).pop() ?? path;
  setStatus(`처리 중: ${name}`);
  const prev = store.ledger.files[path];
  try {
    const out = await processReplay(path, api, await membersFresh());
    const at = new Date().toISOString();
    if (out.kind === "registered") {
      store.ledger.files[path] = { at, status: "registered", matchNo: out.matchNo, note: out.summary };
      log(`등록 ${out.matchNo}: ${name} — ${out.summary}`);
      noteRecent(`✔ 등록 ${out.matchNo} · ${out.summary}`);
      toastUploaded();
    } else if (out.kind === "merged" || out.kind === "duplicate") {
      store.ledger.files[path] = { at, status: out.kind, note: out.summary };
      log(`${out.kind === "merged" ? "기존 경기에 갱신" : "이미 등록됨"}: ${name} — ${out.summary}`);
      noteRecent(`${out.kind === "merged" ? "↻ 기존 경기 갱신" : "= 이미 등록됨"} · ${out.summary}`);
      // 다른 사람이 먼저 올린 같은 경기도 "올라갔다"로 센다 — 내 파일이 사이트에 반영된 건 같다.
      if (out.kind === "merged") toastUploaded();
    } else {
      store.ledger.files[path] = { at, status: "skipped", note: out.reason };
      log(`건너뜀: ${name} — ${out.reason}`);
      noteRecent(`– 건너뜀 · ${out.reason}`);
    }
  } catch (e) {
    if (e instanceof ApiError && e.needsLogin) { dropAuth(e.message); return; }
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
