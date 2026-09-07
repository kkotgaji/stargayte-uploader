// 화면 오른쪽 아래 작은 오버레이 토스트 — 창 테두리 없고 투명, 항상 위, 클릭은 통과.
// "리플레이 N건이 스타게이트에 업로드되었습니다." 같이 한 줄만 몇 초 보였다 사라진다.
// (스타를 전체화면(독점)으로 켠 동안은 다른 창처럼 가려질 수 있다 — 창모드 전체화면은 보인다.)
import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

const W = 380;
const H = 64;
const SHOW_MS = 4500;

let win: BrowserWindow | null = null;
let hideTimer: NodeJS.Timeout | null = null;

function ensure(): BrowserWindow {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    width: W, height: H, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    focusable: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    hasShadow: false, show: false, backgroundColor: "#00000000",
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.on("closed", () => { win = null; });
  return win;
}

export function showToast(text: string): void {
  const w = ensure();
  const { workArea } = screen.getPrimaryDisplay();
  w.setBounds({ x: workArea.x + workArea.width - W - 16, y: workArea.y + workArea.height - H - 16, width: W, height: H });
  void w.loadFile(join(__dirname, "..", "toast.html"), { query: { text } }).then(() => {
    if (!win || win.isDestroyed()) return;
    win.showInactive();
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.hide(); }, SHOW_MS);
  });
}

// 등록은 한 판씩 이어져 들어오므로, 잠깐 모았다가 "N건"으로 한 번에 알린다.
let pending = 0;
let firstAt = 0;
let flushTimer: NodeJS.Timeout | null = null;
const GATHER_MS = 3000;
const GATHER_MAX_MS = 12000;

export function toastUploaded(count = 1): void {
  if (pending === 0) firstAt = Date.now();
  pending += count;
  if (flushTimer) clearTimeout(flushTimer);
  const wait = Math.max(0, Math.min(GATHER_MS, firstAt + GATHER_MAX_MS - Date.now()));
  flushTimer = setTimeout(() => {
    const n = pending;
    pending = 0;
    flushTimer = null;
    showToast(`리플레이 ${n}건이 스타게이트에 업로드되었습니다.`);
  }, wait);
}
