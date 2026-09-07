// 로그인 창 ↔ 메인 사이의 아주 좁은 다리 — 로그인 한 번과 안내 정보만.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("uploader", {
  login: (id: string, password: string) => ipcRenderer.invoke("login", id, password),
  info: () => ipcRenderer.invoke("info"),
});
