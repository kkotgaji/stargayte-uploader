// 번들 — 메인(Node)과 preload를 esbuild로 한 파일씩 만든다. 리플레이 파서(screp-js)와
// 홈페이지의 유틸(../src/utils/*)을 그대로 끌어와 묶는다. 서버 주소는 UPLOADER_API_BASE로.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const apiBase = process.env.UPLOADER_API_BASE ?? "http://localhost:8000";
if (!process.env.UPLOADER_API_BASE) console.warn("[build] UPLOADER_API_BASE가 없어 http://localhost:8000 으로 박습니다.");

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  sourcemap: false,
  logLevel: "info",
  define: {
    "import.meta.env": "{}",
    __API_BASE__: JSON.stringify(apiBase),
    __VERSION__: JSON.stringify(pkg.version),
  },
};
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.cjs" });
await build({ ...common, entryPoints: ["src/preload.ts"], outfile: "dist/preload.cjs" });
