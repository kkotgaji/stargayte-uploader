// 사이트 창 — 스타게이트의 /uploader.html을 숨은 BrowserWindow로 띄워 두고, 리플레이 파일을
// 하나씩 넘겨 그 페이지가 사이트의 절차(파서·회원 매칭·규칙·서버 계약) 그대로 등록하게 한다.
// 등록기는 그 절차를 제 것으로 갖지 않는다 — 전에는 사이트 소스를 베껴 두었는데 사이트가
// 바뀔 때마다 사본이 조용히 어긋났다(요청: "내부적으로 stargayte에 연결해서 업로드").
//
// 로그인도 그 페이지의 것이다: 세션(리프레시 토큰)은 이 창의 localStorage(persist 파티션)에
// 남고, 등록기가 날마다 돌기 때문에 사이트와 같은 회전으로 이어진다. 세션이 없을 때만 창을
// 보여 로그인 칸을 채우게 한다.
import { BrowserWindow, ipcMain, session } from "electron";
import { JOB_TIMEOUT_MS, PAGE_RETRY_MS, PAGE_WAIT_MS } from "./config";
import { log } from "./log";

export interface PageUser { id: string; nickname: string }

export type Outcome =
  | { kind: "registered"; matchNo: string; summary: string }
  | { kind: "merged"; summary: string }
  | { kind: "duplicate"; summary: string }
  | { kind: "skipped"; reason: string; summary: string };

export interface PageEvents {
  /** 페이지가 뜨고 세션을 확인했다 — user가 null이면 로그인이 필요하다. 다시 뜰 때마다 온다. */
  onReady(user: PageUser | null): void;
  onLoginOk(user: PageUser): void;
  /** 처리 중 세션이 죽었다(리프레시까지 실패). */
  onNeedsLogin(why: string): void;
}

interface Pending { resolve(o: Outcome): void; reject(e: Error): void; timer: NodeJS.Timeout }

export class SitePage {
  private win: BrowserWindow | null = null;
  private ready = false;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private readyWaiters: (() => void)[] = [];
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(private url: string, private preload: string, private icon: string, private ev: PageEvents) {
    ipcMain.on("page-event", (e, event: string, payload?: unknown) => {
      if (!this.win || e.sender.id !== this.win.webContents.id) return;
      this.onPageEvent(event, payload);
    });
    ipcMain.on("job-result", (e, r: { id: number; ok: boolean; result?: Outcome; error?: string }) => {
      if (!this.win || e.sender.id !== this.win.webContents.id) return;
      const p = this.pending.get(r.id);
      if (!p) return;
      this.pending.delete(r.id);
      clearTimeout(p.timer);
      if (r.ok && r.result) p.resolve(r.result);
      else p.reject(new Error(r.error ?? "페이지가 결과를 돌려주지 않았어요"));
    });
  }

  open(): void {
    if (this.win && !this.win.isDestroyed()) { void this.load(); return; }
    this.win = new BrowserWindow({
      width: 440, height: 380, show: false, resizable: false, minimizable: false, maximizable: false,
      title: "스타게이트 등록기", autoHideMenuBar: true, icon: this.icon,
      webPreferences: {
        preload: this.preload, contextIsolation: true, nodeIntegration: false, sandbox: true,
        // 세션이 앱을 껐다 켜도 남게 — 기본 세션도 남지만 이름을 박아 두면 뜻이 분명하다.
        session: session.fromPartition("persist:stargayte"),
        // 숨은 창이라도 타이머·fetch가 느려지지 않게.
        backgroundThrottling: false,
      },
    });
    const wc = this.win.webContents;
    // 사용자가 X를 눌러도 페이지는 살아 있어야 한다 — 숨기기만.
    this.win.on("close", (e) => { if (this.win && !this.win.isDestroyed()) { e.preventDefault(); this.win.hide(); } });
    wc.on("did-start-loading", () => { this.setReady(false); });
    wc.on("did-fail-load", (_e, code, desc, url, isMain) => {
      if (!isMain) return;
      log(`사이트 창 로드 실패(${code} ${desc}): ${url} — ${PAGE_RETRY_MS / 1000}초 뒤 다시`);
      this.scheduleRetry();
    });
    wc.on("render-process-gone", (_e, d) => { log(`사이트 창 렌더러 종료(${d.reason}) — 다시 연다`); this.scheduleRetry(); });
    wc.on("unresponsive", () => { log("사이트 창이 응답하지 않아 다시 연다"); this.scheduleRetry(); });
    wc.on("console-message", (_e, level, msg) => { if (level >= 2) log(`[사이트] ${msg}`); });
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.win || this.win.isDestroyed()) return;
    try { await this.win.loadURL(this.url); } catch (e) {
      log(`사이트 창 열기 실패: ${e instanceof Error ? e.message : String(e)}`);
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.setReady(false);
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.load(); }, PAGE_RETRY_MS);
  }

  private setReady(v: boolean): void {
    this.ready = v;
    if (!v) {
      // 페이지가 내려갔으면 기다리던 작업은 실패로 — 등록기가 나중에 다시 시도한다.
      this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error("사이트 창이 다시 열려 처리가 끊겼어요")); });
      this.pending.clear();
      return;
    }
    this.readyWaiters.splice(0).forEach((w) => w());
  }

  private onPageEvent(event: string, payload?: unknown): void {
    const user = (payload as { user?: PageUser } | undefined)?.user ?? null;
    if (event === "ready") { this.setReady(true); this.ev.onReady(user); }
    else if (event === "login-ok" && user) { this.ev.onLoginOk(user); }
    else if (event === "needs-login") { this.ev.onNeedsLogin(String((payload as { why?: string } | undefined)?.why ?? "")); }
  }

  get isReady(): boolean { return this.ready; }

  /** 페이지가 준비될 때까지(최대 PAGE_WAIT_MS) 기다린다. */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== done);
        reject(new Error("사이트 창이 아직 준비되지 않았어요(네트워크나 사이트를 확인해 주세요)"));
      }, PAGE_WAIT_MS);
      const done = (): void => { clearTimeout(t); resolve(); };
      this.readyWaiters.push(done);
    });
  }

  /** 파일 하나를 페이지에 넘기고 결과를 기다린다. */
  async run(name: string, bytes: Buffer): Promise<Outcome> {
    await this.whenReady();
    const win = this.win;
    if (!win || win.isDestroyed()) throw new Error("사이트 창이 없어요");
    const id = ++this.seq;
    return new Promise<Outcome>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${JOB_TIMEOUT_MS / 60_000}분이 지나도 답이 없어요`));
      }, JOB_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      win.webContents.send("job", { id, name, data: bytes.toString("base64") });
    });
  }

  show(): void {
    if (!this.win || this.win.isDestroyed()) { this.open(); }
    this.win?.show();
    this.win?.focus();
  }

  hide(): void { this.win?.hide(); }

  logout(): void {
    this.win?.webContents.send("logout");
    this.show();
  }

  destroy(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setReady(false);
    if (this.win && !this.win.isDestroyed()) { this.win.removeAllListeners("close"); this.win.destroy(); }
    this.win = null;
  }
}
