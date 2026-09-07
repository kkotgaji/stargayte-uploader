// 화면 오른쪽 아래 작은 오버레이 토스트 — 창 테두리 없고 투명, 항상 위, 클릭은 통과.
// "리플레이 N건을 스타게이트에 등록했습니다." 같이 한 줄만 몇 초 보였다 사라진다.
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

// 등록은 한 판씩 이어져 들어오므로(첫 훑기엔 수십 건) 건마다 띄우지 않고 세어 두었다가,
// 대기열이 다 빠졌을 때(watcher의 onIdle) "N건"으로 한 번만 알린다. 시간으로 모으면 파일 하나
// 올리는 데 그보다 오래 걸려 건마다 따로 떴다.
let pending = 0;

export function noteUploaded(count = 1): void {
  pending += count;
}

export function flushUploaded(): void {
  if (pending === 0) return;
  const n = pending;
  pending = 0;
  showToast(`리플레이 ${n}건을 스타게이트에 등록했습니다.`);
}
