// 리플레이 폴더 감시 — fs.watch(recursive)로 바로 알아채고, 놓친 것은 주기적 재훑기로 줍는다.
// 스타크래프트가 파일을 다 쓰기 전에 읽지 않도록 크기가 잠잠해질 때까지 기다린다.
import { existsSync, watch, type FSWatcher } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { RESCAN_MS, SETTLE_MS } from "./config";
import { log } from "./log";

export interface WatcherOptions {
  dir: string;
  /** 이 시각(ms) 이전 mtime의 파일은 무시한다. */
  since: () => number;
  /** 이미 장부에 있는 파일인가. */
  seen: (path: string) => boolean;
  /** 다 써진 새 파일 하나 — 순서대로 한 번에 하나씩 불린다. */
  onFile: (path: string) => Promise<void>;
  /** 재훑기 한 번이 끝날 때마다 새로 잡힌 파일 수(0 포함) — 첫 훑기 안내용. */
  onBatch?: (count: number) => void;
  /** 대기열의 파일을 다 처리하고 쉬게 될 때마다 — 모아 둔 알림을 내보내는 용도. */
  onIdle?: () => void;
}

export class ReplayWatcher {
  private fsw: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private pending = new Map<string, NodeJS.Timeout>();
  private queue: string[] = [];
  private running = false;
  private stopped = false;

  constructor(private opt: WatcherOptions) {}

  start(): void {
    this.stopped = false;
    this.attach();
    void this.rescan();
    this.timer = setInterval(() => { this.attach(); void this.rescan(); }, RESCAN_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.fsw?.close();
    this.fsw = null;
    this.pending.forEach((t) => clearTimeout(t));
    this.pending.clear();
  }

  get watching(): boolean { return this.fsw !== null; }

  /** 폴더가 아직 없으면(스타를 한 번도 안 돌렸으면) 생길 때까지 재훑기 때마다 다시 붙는다. */
  private attach(): void {
    if (this.fsw || !existsSync(this.opt.dir)) return;
    try {
      this.fsw = watch(this.opt.dir, { recursive: true }, (_ev, name) => {
        if (!name || !/\.rep$/i.test(String(name))) return;
        this.touch(join(this.opt.dir, String(name)));
      });
      this.fsw.on("error", (e) => { log(`감시 오류: ${e.message}`); this.fsw?.close(); this.fsw = null; });
      log(`감시 시작: ${this.opt.dir}`);
    } catch (e) {
      log(`감시 실패: ${e instanceof Error ? e.message : String(e)}`);
      this.fsw = null;
    }
  }

  /** 파일 변화가 잠잠해진 뒤(SETTLE_MS) 처리 대기열에 넣는다 — 쓰는 도중 여러 번 와도 한 번. */
  private touch(path: string): void {
    const prev = this.pending.get(path);
    if (prev) clearTimeout(prev);
    this.pending.set(path, setTimeout(() => { this.pending.delete(path); void this.consider(path); }, SETTLE_MS));
  }

  private async consider(path: string): Promise<boolean> {
    if (this.stopped || this.opt.seen(path) || this.queue.includes(path)) return false;
    let s;
    try { s = await stat(path); } catch { return false; }
    if (!s.isFile() || s.size === 0 || s.mtimeMs < this.opt.since()) return false;
    // 아직 커지는 중이면 조금 더 기다린다.
    if (Date.now() - s.mtimeMs < SETTLE_MS) { this.touch(path); return false; }
    this.queue.push(path);
    void this.drain();
    return true;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0 && !this.stopped) {
        const path = this.queue.shift()!;
        try { await this.opt.onFile(path); } catch (e) { log(`처리 중 예외 ${path}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); }
      }
    } finally {
      this.running = false;
    }
    this.opt.onIdle?.();
  }

  async rescan(): Promise<void> {
    if (!existsSync(this.opt.dir)) return;
    const found: { path: string; mtime: number }[] = [];
    const since = this.opt.since();
    const walk = async (d: string): Promise<void> => {
      let names: import("node:fs").Dirent[];
      try { names = await readdir(d, { withFileTypes: true }); } catch { return; }
      for (const ent of names) {
        const p = join(d, ent.name);
        if (ent.isDirectory()) { await walk(p); continue; }
        if (!/\.rep$/i.test(ent.name) || this.opt.seen(p)) continue;
        try {
          const s = await stat(p);
          if (s.mtimeMs >= since) found.push({ path: p, mtime: s.mtimeMs });
        } catch { /* 사라짐 */ }
      }
    };
    await walk(this.opt.dir);
    // 오래된 것부터 — 첫 훑기에서 여러 판을 올릴 때 경기번호가 시간순이 되게.
    found.sort((a, b) => a.mtime - b.mtime);
    let n = 0;
    for (const f of found) if (await this.consider(f.path)) n++;
    this.opt.onBatch?.(n);
  }
}
