// 파일 로그 — userData/uploader.log 하나에 붙여 쓰고, 1MB를 넘으면 .1로 밀어 둔다.
import { appendFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

let logPath: string | null = null;
let listeners: ((line: string) => void)[] = [];

export function initLog(dir: string): string {
  logPath = join(dir, "uploader.log");
  return logPath;
}

export function onLog(fn: (line: string) => void): void {
  listeners.push(fn);
}

export function log(msg: string): void {
  const line = `${new Date().toISOString()} ${msg}`;
  listeners.forEach((fn) => fn(line));
  if (!logPath) { console.log(line); return; }
  try {
    try { if (statSync(logPath).size > 1_000_000) renameSync(logPath, `${logPath}.1`); } catch { /* 아직 없음 */ }
    appendFileSync(logPath, line + "\n");
  } catch (e) {
    console.error("log write failed", e);
  }
}
