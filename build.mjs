// 번들 — 메인(Node)과 preload를 esbuild로 한 파일씩 만든다. 사이트 주소는 UPLOADER_SITE_BASE로
// (등록기는 그 사이트의 /uploader.html을 숨은 창으로 띄운다 — src/page.ts).
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const siteBase = process.env.UPLOADER_SITE_BASE ?? "http://localhost:5173";
if (!process.env.UPLOADER_SITE_BASE) console.warn("[build] UPLOADER_SITE_BASE가 없어 http://localhost:5173 으로 박습니다.");

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  sourcemap: false,
  logLevel: "info",
  define: {
    __SITE_BASE__: JSON.stringify(siteBase),
    __VERSION__: JSON.stringify(pkg.version),
  },
};
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.cjs" });
await build({ ...common, entryPoints: ["src/preload.ts"], outfile: "dist/preload.cjs" });
