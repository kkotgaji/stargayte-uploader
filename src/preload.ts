// 사이트의 /uploader.html ↔ 메인 사이의 좁은 다리 — 파일 하나 넘기고 결과 받기, 로그아웃 지시,
// 페이지가 알리는 세션 상태. 꼴은 stargayte의 src/uploader/bridge.d.ts와 **짝**이다: 바꾸면 둘 다 바꾼다.
import { contextBridge, ipcRenderer } from "electron";

interface UploadJob { id: number; name: string; data: string }

contextBridge.exposeInMainWorld("stargayteUploader", {
  onJob: (handler: (job: UploadJob) => Promise<unknown>) => {
    ipcRenderer.on("job", async (_e, job: UploadJob) => {
      try {
        ipcRenderer.send("job-result", { id: job.id, ok: true, result: await handler(job) });
      } catch (e) {
        ipcRenderer.send("job-result", { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    });
  },
  onLogout: (handler: () => Promise<void>) => {
    ipcRenderer.on("logout", () => { void handler(); });
  },
  emit: (event: string, payload?: unknown) => ipcRenderer.send("page-event", event, payload),
});
