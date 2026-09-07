// 서버 호출 — 홈페이지의 src/api/client.ts와 같은 경로·형식을 쓰되, 브라우저 저장소·리프레시
// 회전 없이 앱용 장기 토큰(POST /api/auth/app-login) 하나를 Bearer로 붙인다.
import type { ReplayMapGrid } from "../web/src/utils/replayParser";
import type { GameResultSlot, Member, NewGameResult, ReplayNameClassificationEntry, ReplayUpload } from "../web/src/types";
import { VERSION } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
  /** 토큰이 죽었거나(만료·비밀번호 변경) 회원이 막힌 경우 — 다시 로그인해야 한다. */
  get needsLogin(): boolean { return this.status === 401 || this.status === 403; }
}

export interface AppLoginResult {
  appToken: string;
  expiresAt: string;
  user: Member;
}

/** 중복 경기 머지 — 홈페이지 replayDraft.ts의 draftToMergePayload와 같은 꼴. */
export interface MergeReplayPayload {
  /** 새 저장본 파일 — 서버가 지금 것보다 길 때만 갈아 끼우고(늦게 나간 사람의 저장본이
   *  더 길다) 다시 굽는다. 짧으면 병합을 통째로 접는다. */
  replay: ReplayUpload | null;
  gameStartedAt: string;
  result: "team1" | "team2" | "draw" | null;
  mapName: string | null;
  durationSeconds: number | null;
  mapData: ReplayMapGrid | null;
  players: {
    playerName: string; race: string | null; apm: number | null; eapm: number | null;
    cmdCount: number | null; effectiveCmdCount: number | null; buildCount: number | null;
  }[];
}

/** 파이프라인이 기대는 서버 창 — 시험(dry-run)에서는 가짜로 바꿔 끼운다. */
export interface UploaderApi {
  getMembers(): Promise<Member[]>;
  lookupReplayNameClassifications(rawNames: string[]): Promise<ReplayNameClassificationEntry[]>;
  checkReplayDuplicates(gameStartedAt: string[]): Promise<string[]>;
  mergeReplay(payload: MergeReplayPayload): Promise<{ merged: boolean; matchNo: string | null }>;
  createGameResult(gameResult: NewGameResult): Promise<{ id: number; matchNo: string }>;
}

// 서버 계약은 슬롯의 리플레이 원본 게임아이디를 playerName으로 받는다(client.ts의 slotToWire).
type WireSlot = Omit<GameResultSlot, "rawName"> & { playerName?: string | null };
function slotToWire(slot: GameResultSlot): WireSlot {
  const { rawName, ...rest } = slot;
  return { ...rest, playerName: rawName ?? null };
}

export class HttpApi implements UploaderApi {
  constructor(private base: string, private token: () => string | null) {}

  private async request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `stargayte-uploader/${VERSION}`,
      // 접속 기록은 운영 프론트만 남긴다(백엔드 record_access) — 앱은 늘 운영으로 친다.
      "X-Client-Env": "production",
    };
    const tok = auth ? this.token() : null;
    if (tok) headers.Authorization = `Bearer ${tok}`;
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { ...init, headers });
    } catch (e) {
      throw new ApiError(0, `서버에 연결하지 못했어요 (${e instanceof Error ? e.message : String(e)})`);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json() as { detail?: unknown; message?: unknown };
        const d = body.detail ?? body.message;
        if (typeof d === "string") detail = d;
        else if (d !== undefined) detail = JSON.stringify(d);
      } catch { /* 본문 없음 */ }
      throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async appLogin(id: string, password: string, device: string): Promise<AppLoginResult> {
    return this.request<AppLoginResult>("/api/auth/app-login", {
      method: "POST", body: JSON.stringify({ id, password, device }),
    }, false);
  }

  async me(): Promise<Member> {
    return this.request<Member>("/api/auth/me");
  }

  async getMembers(): Promise<Member[]> {
    return this.request<Member[]>("/api/members");
  }

  async lookupReplayNameClassifications(rawNames: string[]): Promise<ReplayNameClassificationEntry[]> {
    if (rawNames.length === 0) return [];
    const res = await this.request<{ classifications: ReplayNameClassificationEntry[] }>(
      "/api/game-results/replay-name-classifications/lookup",
      { method: "POST", body: JSON.stringify({ rawNames }) },
    );
    return res.classifications;
  }

  async checkReplayDuplicates(gameStartedAt: string[]): Promise<string[]> {
    if (gameStartedAt.length === 0) return [];
    const res = await this.request<{ existing: string[] }>("/api/game-results/duplicate-check", {
      method: "POST", body: JSON.stringify({ gameStartedAt }),
    });
    return res.existing;
  }

  async mergeReplay(payload: MergeReplayPayload): Promise<{ merged: boolean; matchNo: string | null }> {
    return this.request("/api/game-results/merge-replay", { method: "POST", body: JSON.stringify(payload) });
  }

  async createGameResult(gameResult: NewGameResult): Promise<{ id: number; matchNo: string }> {
    const wire = { ...gameResult, team1: gameResult.team1.map(slotToWire), team2: gameResult.team2.map(slotToWire) };
    return this.request("/api/game-results", { method: "POST", body: JSON.stringify(wire) });
  }
}
