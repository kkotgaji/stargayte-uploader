// 파이프라인 시험 — Electron 없이 Node에서 리플레이 파일들을 돌려 무엇을 어떻게 했을지 본다.
// 서버는 가짜다(등록·머지는 안 하고 payload 요약만 찍는다). 회원 목록은 --members <json>.
//   node scripts/dry-run.mjs [--members members.json] [--live <API_BASE> --token <t>] file.rep ...
// --live를 주면 회원 목록·이름 분류·중복 확인은 진짜 서버에 묻고, 등록·머지만 가짜로 남긴다.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const membersFile = opt("--members");
const live = opt("--live");
const token = opt("--token");
const files = args;
if (files.length === 0) { console.error("리플레이 파일을 주세요."); process.exit(2); }

const here = (p) => new URL(p, import.meta.url).pathname;
const common = {
  bundle: true, platform: "node", format: "cjs", target: "node20", logLevel: "silent",
  define: { "import.meta.env": "{}", __API_BASE__: JSON.stringify(live ?? "http://localhost:8000"), __VERSION__: '"dry"' },
};
await build({ ...common, entryPoints: [here("../src/pipeline.ts")], outfile: here("../dist/pipeline.dry.cjs") });
await build({ ...common, entryPoints: [here("../src/api.ts")], outfile: here("../dist/api.dry.cjs") });
const { processReplay } = await import(pathToFileURL(here("../dist/pipeline.dry.cjs")).href);
const { HttpApi } = await import(pathToFileURL(here("../dist/api.dry.cjs")).href);

const members = membersFile ? JSON.parse(readFileSync(membersFile, "utf8")) : [];
const real = live ? new HttpApi(live, () => token ?? null) : null;
const fake = {
  getMembers: async () => (real ? real.getMembers() : members),
  lookupReplayNameClassifications: async (names) => (real ? real.lookupReplayNameClassifications(names) : []),
  checkReplayDuplicates: async (ts) => (real ? real.checkReplayDuplicates(ts) : []),
  mergeReplay: async (p) => { console.log("  [merge]", JSON.stringify({ ...p, mapData: p.mapData ? "(grid)" : null, players: p.players.map((x) => x.playerName) })); return { merged: true, matchNo: "DRY" }; },
  createGameResult: async (g) => {
    const slot = (s) => `${s.memberId.startsWith("__") ? s.memberId.slice(0, 14) : s.memberId}(${s.rawName}/${s.race})`;
    console.log("  [create]", JSON.stringify({ date: g.date, result: g.result, matchType: g.matchType, map: g.mapName, dur: g.durationSeconds,
      team1: g.team1.map(slot), team2: g.team2.map(slot), replayBytes: Math.round((g.replay.url.length - 37) * 3 / 4), mapData: g.mapData ? "(grid)" : null }));
    return { id: 0, matchNo: "DRY-0" };
  },
};
const mem = real ? await real.getMembers() : members;
for (const f of files) {
  const t0 = Date.now();
  try {
    const r = await processReplay(f, fake, mem);
    console.log(`${f.split("/").pop()} → ${r.kind}${r.kind === "skipped" ? " (" + r.reason + ")" : ""} · ${r.summary} · ${Date.now() - t0}ms`);
  } catch (e) {
    console.log(`${f.split("/").pop()} → 오류 ${e.message}`);
  }
}
