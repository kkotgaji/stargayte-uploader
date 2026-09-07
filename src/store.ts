// 로컬 상태 — 처리 장부(어느 파일을 어떻게 했나). 로그인 세션은 여기 없다: 사이트 창의
// localStorage(persist 파티션)가 사이트와 같은 방식으로 갖는다(page.ts 머리말).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INITIAL_SCAN_FROM } from "./config";

export interface LedgerEntry {
  at: string;
  status: "registered" | "merged" | "duplicate" | "skipped" | "failed";
  note?: string;
  matchNo?: string;
  /** failed일 때 다시 시도한 횟수. */
  tries?: number;
}

export interface Ledger {
  /** 이 시각보다 오래된 파일은 건드리지 않는다 — 처음 설치 때 INITIAL_SCAN_FROM으로 잡는다. */
  since: string;
  files: Record<string, LedgerEntry>;
  /** 장부를 이번에 처음 만들었다 — 첫 훑기 안내(토스트)를 띄우는 근거. 저장되진 않는다. */
  firstRun?: boolean;
}

export class Store {
  private ledgerPath: string;
  ledger: Ledger;

  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
    this.ledgerPath = join(dir, "processed.json");
    this.ledger = this.readLedger();
  }

  private readLedger(): Ledger {
    try {
      if (existsSync(this.ledgerPath)) {
        const l = JSON.parse(readFileSync(this.ledgerPath, "utf8")) as Ledger;
        if (l && typeof l.since === "string" && l.files) return l;
      }
    } catch { /* 깨졌으면 새로 */ }
    return { since: new Date(INITIAL_SCAN_FROM).toISOString(), files: {}, firstRun: true };
  }

  saveLedger(): void {
    // 장부가 끝없이 자라지 않게 오래된 항목부터 덜어낸다.
    const entries = Object.entries(this.ledger.files);
    if (entries.length > 3000) {
      entries.sort((a, b) => a[1].at.localeCompare(b[1].at));
      this.ledger.files = Object.fromEntries(entries.slice(-2000));
    }
    const tmp = this.ledgerPath + ".tmp";
    const { firstRun: _firstRun, ...persisted } = this.ledger;
    writeFileSync(tmp, JSON.stringify(persisted, null, 1));
    renameSync(tmp, this.ledgerPath);
  }

  get dataDir(): string { return this.dir; }
}
