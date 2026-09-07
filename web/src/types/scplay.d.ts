// 홈페이지가 npm 패키지(github:kkotdari/scplay, 재생기)에서 타입만 빌려 쓰는 두 꼴 —
// 등록기는 재생기를 통째로 설치할 까닭이 없어(그 패키지는 설치 때 vite 빌드를 돈다)
// 그 두 선언만 여기 베껴 둔다. 원본: scplay@58a4671
// src/components/replay/mapGrid.ts · race.ts. 홈페이지 쪽이 바뀌면 여기도 같이 맞춘다.
// (이 파일은 sync-web.mjs가 베끼는 목록에 없다 — 등록기가 갖는다.)
declare module "scplay" {
  export type Race = "테란" | "프로토스" | "저그" | "랜덤";

  /** 지도 격자 — 등록 payload의 mapData가 이 꼴이다. */
  export interface ReplayMapGrid {
    /** 격자 내용의 해시 — 서버에서 같은 맵을 두 번 저장하지 않게 하는 열쇠. */
    hash: string;
    /** 그 리플레이에 적혀 있던 맵 이름. */
    name: string;
    width: number;
    height: number;
    /** 이 맵에 나오는 타일 그룹 번호들 — tiles의 각 바이트가 이 배열의 첨자다. */
    palette: number[];
    /** width*height개의 팔레트 첨자를 바이트로 늘어놓고 base64로 옮긴 것. */
    tiles: string;
    /** 자원 자리 [타일x, 타일y, 가스있음(0/1)]. 못 읽었으면 빈 배열. */
    resources: [number, number, 0 | 1][];
    /** 대표맵 — 서버가 내려줄 때만 있다. */
    canonId?: number | null;
    canonName?: string | null;
    /** 참값 지형(서버가 굽는다) — 등록 때는 없다. */
    terrain?: string | null;
    tileset?: number | null;
  }
}
